#!/usr/bin/env python3
"""
parse_ki.py – čita KI Expert .docx i vraća JSON s ekstrahiranim podacima
Poziva se: python3 parse_ki.py <path_to_docx>
"""
import sys, re, json
from docx import Document

def safe_float(s):
    try: return float(str(s).replace(',','.').strip())
    except: return None

def unique_vals(row):
    return list(dict.fromkeys([
        c.text.strip() for c in row.cells
        if c.text.strip() and c.text.strip() not in ['-','']
    ]))

def extract(path):
    doc = Document(path)
    data = {}

    # ── TABLE 1 – naslovnica ─────────────────────────────────────────
    t1 = doc.tables[1]
    for row in t1.rows:
        cells = [c.text.strip() for c in row.cells]
        k = cells[0] if cells else ''
        v = cells[-1] if len(cells)>1 else ''
        if 'Investitor' in k: data['narucitelj'] = v
        if 'Vrsta zgrade' in k: data['vrsta'] = v
        if ('k.c' in k.lower() or 'k.č' in k): data['katastar'] = v
        if 'Adresa' in k: data['lokacija'] = v
        if 'Oplošje' in k and '(' in k: data['oplosje'] = v
        if 'Obujam' in k and 'V e' in k: data['obujam'] = v
        if 'Faktor oblika' in k: data['faktor'] = v
        if 'korisne površine' in k: data['ak'] = v
        if 'Meteorološka' in k: data['meteo'] = v

    # ── TABLE 2 – QHnd, QCnd, Htr ────────────────────────────────────
    t2 = doc.tables[2]
    rows2 = list(t2.rows)
    r5 = unique_vals(rows2[5])
    data['qhndKwh'] = r5[-1] if len(r5)>1 else ''
    r7 = unique_vals(rows2[7])
    nums7 = [x for x in r7 if safe_float(x) is not None]
    if len(nums7)>=2: data['qhndMax']=nums7[0]; data['qhndM2']=nums7[-1]
    r8 = unique_vals(rows2[8])
    data['qcndKwh'] = r8[-1] if len(r8)>1 else ''
    r12 = unique_vals(rows2[12])
    nums12 = [x for x in r12 if safe_float(x) is not None]
    if len(nums12)>=2: data['htrMax']=nums12[0]; data['htrAdj']=nums12[-1]

    # ── TABLE 4 – Edel, Eprim, OIE ───────────────────────────────────
    t4 = doc.tables[4]
    for row in t4.rows:
        u = unique_vals(row)
        k = u[0] if u else ''
        if 'isporučena energija' in k and 'termotehnički' in k and len(u)>1:
            data['edel'] = u[1]
        if 'primarna energija' in k and 'termotehnički' in k and len(u)>1:
            data['eprim'] = u[1]
        if '51.77' in str(u) or ('30 %' in k and len(u)>1):
            for x in u:
                if safe_float(x) is not None and safe_float(x) > 1:
                    data['oieUdio'] = x

    # ── TABLE 5 – Eprim/m2, nZEB ─────────────────────────────────────
    t5 = doc.tables[5]
    for row in t5.rows:
        u = unique_vals(row)
        k = u[0] if u else ''
        if 'E del' in k and 'kWh/a' in k:
            data['edel'] = u[1] if len(u)>1 else data.get('edel','')
        if 'E prim' in k and 'kWh/a' in k and 'jedinici' not in k:
            data['eprim'] = u[1] if len(u)>1 else data.get('eprim','')
        if 'jedinici' in k and 'E prim' in k:
            nums = [x for x in u if safe_float(x) is not None]
            if len(nums)>=2: data['eprimMax']=nums[0]; data['eprimM2']=nums[-1]
        if 'nZEB' in str(u): data['nzeb']='da'

    # ── TABLE 8 – grijanje, energent ─────────────────────────────────
    t8 = doc.tables[8]
    for row in t8.rows:
        u = unique_vals(row)
        k = u[0] if u else ''
        if k == 'Sustav grijanja:' and len(u)>1: data['grijVrsta'] = u[1]
        if 'energenta za grijanje' in k and len(u)>1: data['grijEnergent'] = u[1]
        if 'obnovljive energije' in k and len(u)>1: data['oieUdio'] = u[1]

    # ── TABLE 9 – U-values + n50 + geometrija + sustavi ──────────────
    VALID_NAMES = {
        'Vanjski zid', 'Zid prema', 'Pod na tlu', 'Strop',
        'Kosi krov', 'Ravni krov', 'Prozori', 'Vanjska vrata',
        'Ulazna vrata', 'Unutarnji zid'
    }
    SKIP_NAMES = {
        '2.A.', 'Unutarnja proj', 'Opći podaci', 'Toplinska za',
        'Povrsinska', 'Površinska', 'Unutarnja kon', 'Dinamicke',
        'Dinamičke', 'Slojevi', 'Ispravci', 'Proracun', 'Proračun',
        'Odabrani', 'Naziv otvora', 'Gibanj', 'Stacionarni',
        'Granice', 'Nema', 'Koriste', 'Popis', 'Gubitak', 'A gd',
        'Tip', 'Faktor', 'Ukupni', 'Ako je', 'Smještaj',
        'Q sol', 'Q int', 'Q Ve', 'Q H,Ve', 'Q C,Ve', 'n inf',
        'Δn win', 'Godišnje', 'Svi mj', 'Siječanj', 'Veljača',
        'Ožujak', 'Travanj', 'Svibanj', 'Lipanj', 'Srpanj',
        'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac',
        'Električna', 'SPF', 'Obnovlj'
    }

    t9 = doc.tables[9]
    uvals = []
    seen_names = set()

    for row in t9.rows:
        cells = [c.text.strip() for c in row.cells]
        full20 = ' '.join(cells[:20])
        full_all = ' '.join(cells)

        # n50
        m = re.search(r'n\s*50\s*=\s*([\d.]+)', full_all)
        if m and 'Broj izmjena zraka' in full20:
            data['zrakN50'] = m.group(1)

        if len(cells) < 100:
            continue

        # Geometrija
        if 'Oplošje grijanog dijela zgrade' in full20 and 'A,' in full20:
            nums = list(dict.fromkeys([c for c in cells if re.match(r'^\d{2,}\.\d+$', c)]))
            if nums: data['oplosje'] = nums[-1]
        if 'Obujam grijanog dijela zgrade' in full20 and 'V e,' in full20:
            nums = list(dict.fromkeys([c for c in cells if re.match(r'^\d{2,}\.\d+$', c)]))
            if nums: data['obujam'] = nums[-1]
        if 'Obujam grijanog zraka' in full20:
            nums = list(dict.fromkeys([c for c in cells if re.match(r'^\d{2,}\.\d+$', c)]))
            if nums: data['obujamZrak'] = nums[-1]
        if 'Faktor oblika zgrade' in full20:
            nums = list(dict.fromkeys([c for c in cells if re.match(r'^0\.\d+$', c)]))
            if nums: data['faktor'] = nums[-1]
        if 'Ploština korisne površine' in full20 and 'A K,' in full20:
            nums = list(dict.fromkeys([c for c in cells if re.match(r'^\d{2,}\.\d+$', c)]))
            if nums: data['ak'] = nums[-1]
        if 'Ukupna ploština pročelja' in full20:
            nums = list(dict.fromkeys([c for c in cells if re.match(r'^\d{2,}\.\d+$', c)]))
            if nums: data['procelj'] = nums[-1]
        if 'Ukupna ploština prozora' in full20:
            nums = list(dict.fromkeys([c for c in cells if re.match(r'^\d+\.\d+$', c)]))
            if nums: data['prozori'] = nums[-1]

        # Sustavi
        if 'Vrsta dizalice topline' in full20:
            pool = list(dict.fromkeys([c for c in cells if c and not any(s in c for s in ['Vrsta','dizalice','topline','-']) and c not in ['']]))
            if pool: data['grijIzvor'] = 'Dizalica topline ' + pool[-1]
        if 'Učinak u definiranoj radnoj točki' in full20:
            nums = list(dict.fromkeys([c for c in cells if re.match(r'^\d+\.\d+$', c)]))
            if nums: data['grijSnaga'] = nums[-1]
        if 'Direktno grijani električni' in full20 and 'DA' in full_all:
            data['ptvTip'] = 'Direktno grijani električni spremnik (DGA)'
        if 'Nema definiranih sustava hlađenja' in full20:
            data['hladVrsta'] = 'Nema – sustav hlađenja nije definiran'
            data['hladVrsta'] = 'Nema – sustav hlađenja nije definiran'
        if 'Nema definiranih sustava rasvjete' in full20:
            data['rasvVrsta'] = 'Nije predviđena – stambena zgrada'

        # U-values
        naziv_pool = list(dict.fromkeys([c for c in cells[:55] if c and c not in ['-','']]))
        area_pool  = list(dict.fromkeys([c for c in cells[55:87] if re.match(r'^\d+\.?\d*$', c)]))
        u_pool     = list(dict.fromkeys([c for c in cells[87:120] if re.match(r'^[\d.]+$', c)]))
        umax_pool  = list(dict.fromkeys([c for c in cells[120:153] if re.match(r'^[\d.]+$', c)]))

        if not (naziv_pool and area_pool and u_pool and umax_pool):
            continue

        naziv = naziv_pool[0]

        # Skip unwanted rows
        if any(s in naziv for s in SKIP_NAMES):
            continue
        # Only keep rows that look like building element names
        if not any(naziv.startswith(v) for v in VALID_NAMES) and not any(v in naziv for v in ['zid', 'Zid', 'krov', 'Krov', 'pod', 'Pod', 'strop', 'Strop', 'Prozor', 'Vrata']):
            continue
        if naziv in seen_names:
            continue

        u_val = safe_float(u_pool[0])
        umax_val = safe_float(umax_pool[0])
        if u_val is None or umax_val is None or umax_val == 0:
            continue

        seen_names.add(naziv)
        uvals.append({
            'naziv': naziv,
            'area': area_pool[0],
            'u': u_pool[0],
            'umax': umax_pool[0],
            'provjera': 'ZADOVOLJAVA' if u_val <= umax_val else 'NE ZADOVOLJAVA'
        })

    data['uvalues'] = uvals

    # Energy classes
    def cls_qhnd(v):
        v = safe_float(v)
        if v is None: return '—'
        if v<=15: return 'A+'
        if v<=30: return 'A'
        if v<=50: return 'B'
        if v<=75: return 'C'
        if v<=100: return 'D'
        if v<=150: return 'E'
        if v<=200: return 'F'
        return 'G'

    def cls_eprim(v, mx):
        v = safe_float(v)
        mx = safe_float(mx)
        if v is None or mx is None or mx == 0: return '—'
        r = v/mx
        if r<=0.25: return 'A+'
        if r<=0.50: return 'A'
        if r<=0.75: return 'B'
        if r<=1.00: return 'C'
        if r<=1.50: return 'D'
        if r<=2.00: return 'E'
        if r<=2.50: return 'F'
        return 'G'

    data['razredQhnd'] = cls_qhnd(data.get('qhndM2'))
    data['razredEprim'] = cls_eprim(data.get('eprimM2'), data.get('eprimMax'))

    # Also extract raw text for chapter 7
    raw_parts = []
    for t in doc.tables:
        for row in t.rows:
            cells_text = [c.text.strip() for c in row.cells]
            unique_row = list(dict.fromkeys([c for c in cells_text if c and c != '-']))
            if unique_row:
                raw_parts.append(' | '.join(unique_row[:6]))
    data['kiRefRaw'] = '\n'.join(raw_parts[:3000])

    return data

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No file path provided'}))
        sys.exit(1)
    try:
        result = extract(sys.argv[1])
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
