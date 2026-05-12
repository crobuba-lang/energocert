#!/usr/bin/env python3
"""
parse_ki.py – FAST KI Expert .docx parser
Uses direct XML parsing instead of python-docx table API for table 9
"""
import sys, re, json, zipfile
from docx import Document
from lxml import etree

def safe_float(s):
    try: return float(str(s).replace(',','.').strip())
    except: return None

def unique_vals_from_texts(texts):
    seen = set(); result = []
    for v in texts:
        v = v.strip()
        if v and v != '-' and v not in seen:
            seen.add(v); result.append(v)
    return result

# Fast XML cell text extractor
NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
W = '{' + NS + '}'

def get_cell_text(cell_el):
    parts = []
    for t in cell_el.iter(W+'t'):
        if t.text: parts.append(t.text)
    return ''.join(parts).strip()

def parse_table_xml(tbl_el):
    """Parse a table element directly from XML - much faster than python-docx API"""
    rows = []
    for tr in tbl_el.findall('.//' + W+'tr'):
        cells = []
        for tc in tr.findall('.//' + W+'tc'):
            cells.append(get_cell_text(tc))
        if cells: rows.append(cells)
    return rows

def extract(path):
    data = {}

    # Use python-docx only for tables 1,2,4,5,8 (small tables)
    doc = Document(path)

    # ── TABLE 1 ──────────────────────────────────────────────────────
    if len(doc.tables) > 1:
        for row in doc.tables[1].rows:
            cells = [c.text.strip() for c in row.cells]
            k = cells[0] if cells else ''
            v = cells[-1] if len(cells) > 1 else ''
            if 'Investitor' in k: data['narucitelj'] = v
            if 'Vrsta zgrade' in k: data['vrsta'] = v
            if 'k.č' in k or ('k.' in k.lower() and 'br' in k.lower()): data['katastar'] = v
            if 'Adresa' in k: data['lokacija'] = v
            if 'Oplošje' in k and '(' in k: data['oplosje'] = v
            if 'Obujam' in k and 'V e' in k: data['obujam'] = v
            if 'Faktor oblika' in k: data['faktor'] = v
            if 'korisne površine' in k: data['ak'] = v
            if 'Meteorološka' in k: data['meteo'] = v

    # ── TABLE 2 ──────────────────────────────────────────────────────
    if len(doc.tables) > 2:
        for row in doc.tables[2].rows:
            cells = [c.text.strip() for c in row.cells]
            u = unique_vals_from_texts(cells)
            k = u[0] if u else ''
            nums = [x for x in u if safe_float(x) is not None]
            if 'Q H,nd' in k and 'kWh/a' in k and 'jedinici' not in k:
                data['qhndKwh'] = u[-1] if len(u) > 1 else ''
            if "Q'' H,nd" in k and 'kWh/(m 2' in k and len(nums) >= 2:
                data['qhndMax'] = nums[0]; data['qhndM2'] = nums[-1]
            if 'Q C,nd' in k and 'kWh/a' in k and 'jedinici' not in k:
                data['qcndKwh'] = u[-1] if len(u) > 1 else ''
            if "Q'' C,nd" in k and 'kWh/(m 2' in k and len(nums) >= 2:
                data['qcndM2'] = nums[-1]
            if 'H tr,adj' in k and 'W/(m 2' in k and len(nums) >= 2:
                data['htrMax'] = nums[0]; data['htrAdj'] = nums[-1]

    # ── TABLE 4 ──────────────────────────────────────────────────────
    if len(doc.tables) > 4:
        for row in doc.tables[4].rows:
            cells = [c.text.strip() for c in row.cells]
            u = unique_vals_from_texts(cells)
            k = u[0] if u else ''
            if 'isporučena energija' in k and len(u) > 1: data['edel'] = u[1]
            if 'primarna energija' in k and 'termotehnički' in k and len(u) > 1: data['eprim'] = u[1]
            for x in u:
                f = safe_float(x)
                if f and 1 < f < 100 and '%' in ' '.join(u): data['oieUdio'] = x

    # ── TABLE 5 ──────────────────────────────────────────────────────
    if len(doc.tables) > 5:
        rows5 = list(doc.tables[5].rows)
        for i, row in enumerate(rows5):
            cells = [c.text.strip() for c in row.cells]
            u = unique_vals_from_texts(cells)
            k = u[0] if u else ''
            if 'E del' in k and 'kWh/a' in k and len(u) > 1:
                data['edel'] = u[1]
            if 'E prim' in k and 'kWh/a' in k and 'jedinici' not in k and len(u) > 1:
                data['eprim'] = u[1]
            if 'jedinici' in k and 'E prim' in k and i+1 < len(rows5):
                next_cells = [c.text.strip() for c in rows5[i+1].cells]
                next_u = unique_vals_from_texts(next_cells)
                nums = [x for x in next_u if safe_float(x) is not None]
                if len(nums) >= 2: data['eprimMax'] = nums[0]; data['eprimM2'] = nums[-1]
            if 'nZEB' in ' '.join(u): data['nzeb'] = 'da'

    # ── TABLE 8 ──────────────────────────────────────────────────────
    if len(doc.tables) > 8:
        for row in doc.tables[8].rows:
            cells = [c.text.strip() for c in row.cells]
            u = unique_vals_from_texts(cells)
            k = u[0] if u else ''
            if k == 'Sustav grijanja:' and len(u) > 1: data['grijVrsta'] = u[1]
            if 'energenta za grijanje' in k and len(u) > 1: data['grijEnergent'] = u[1]
            if 'obnovljive energije' in k and len(u) > 1: data['oieUdio'] = u[1]

    # ── TABLE 9 – FAST XML parsing ────────────────────────────────────
    # Get raw XML from docx zip
    with zipfile.ZipFile(path, 'r') as z:
        xml_content = z.read('word/document.xml')

    root = etree.fromstring(xml_content)
    all_tables = root.findall('.//' + W + 'tbl')

    if len(all_tables) > 9:
        t9_el = all_tables[9]
        t9_rows = parse_table_xml(t9_el)

        uvals = []
        seen_names = set()
        raw_lines = []

        VALID = ['Vanjski zid', 'Zid prema', 'Pod na tlu', 'Strop',
                 'Kosi krov', 'Ravni krov']
        SKIP_PREFIXES = ['2.A.', 'Unutarnja', 'Opći', 'Toplinska', 'Površinska',
                'Dinamičke', 'Slojevi', 'Ispravci', 'Proračun', 'Odabrani',
                'Naziv otvora', 'Gibanj', 'Stacionarni', 'Granice',
                'Nema', 'Koriste', 'Popis', 'Gubitak', 'A gd',
                'Q sol', 'Q int', 'Q Ve', 'n inf', 'Δn', 'Godišnje',
                'Svi mj', 'Siječanj', 'Veljača', 'Ožujak', 'Travanj',
                'Svibanj', 'Lipanj', 'Srpanj', 'Kolovoz', 'Rujan',
                'Listopad', 'Studeni', 'Prosinac', 'Električna', 'SPF',
                'Obnovlj', 'Ukupni', 'Ako je', 'Smještaj', 'Tip ']

        for cells_text in t9_rows:
            # Compact unique vals for raw output
            seen = set(); unique = []
            for c in cells_text:
                if c and c not in seen: seen.add(c); unique.append(c)

            if len(raw_lines) < 2000 and unique:
                raw_lines.append(' | '.join(unique[:6]))

            full20 = ' '.join(cells_text[:20])

            # n50
            if 'Broj izmjena zraka' in full20 and '50 Pa' in full20:
                m = re.search(r'n\s*50\s*=\s*([\d.]+)', ' '.join(cells_text))
                if m: data['zrakN50'] = m.group(1)


            # Geometry
            if 'Oplošje grijanog dijela zgrade' in full20 and 'A,' in full20:
                nums = list(dict.fromkeys([c for c in cells_text if re.match(r'^\d{2,}\.\d+$', c)]))
                if nums: data['oplosje'] = nums[-1]
            if 'Obujam grijanog dijela zgrade' in full20 and 'V e,' in full20:
                nums = list(dict.fromkeys([c for c in cells_text if re.match(r'^\d{2,}\.\d+$', c)]))
                if nums: data['obujam'] = nums[-1]
            if 'Obujam grijanog zraka' in full20:
                nums = list(dict.fromkeys([c for c in cells_text if re.match(r'^\d{2,}\.\d+$', c)]))
                if nums: data['obujamZrak'] = nums[-1]
            if 'Faktor oblika zgrade' in full20:
                nums = list(dict.fromkeys([c for c in cells_text if re.match(r'^0\.\d+$', c)]))
                if nums: data['faktor'] = nums[-1]
            if 'Ploština korisne površine' in full20 and 'A K,' in full20:
                nums = list(dict.fromkeys([c for c in cells_text if re.match(r'^\d{2,}\.\d+$', c)]))
                if nums: data['ak'] = nums[-1]
            if 'Ukupna ploština pročelja' in full20:
                nums = list(dict.fromkeys([c for c in cells_text if re.match(r'^\d{2,}\.\d+$', c)]))
                if nums: data['procelj'] = nums[-1]
            if 'Ukupna ploština prozora' in full20:
                nums = list(dict.fromkeys([c for c in cells_text if re.match(r'^\d+\.\d+$', c)]))
                if nums: data['prozori'] = nums[-1]

            # Systems
            if 'Vrsta dizalice topline' in full20:
                pool = list(dict.fromkeys([c for c in cells_text if c and 'Vrsta' not in c and 'dizalice' not in c and c != '-']))
                if pool: data['grijIzvor'] = 'Dizalica topline ' + pool[-1]
            if 'Učinak u definiranoj radnoj točki' in full20:
                nums = list(dict.fromkeys([c for c in cells_text if re.match(r'^\d+\.\d+$', c)]))
                if nums: data['grijSnaga'] = nums[-1]
            if 'Direktno grijani električni' in full20 and any('DA' in c for c in cells_text):
                data['ptvTip'] = 'Direktno grijani električni spremnik (DGA)'
            if 'Nema definiranih sustava hlađenja' in full20:
                data['hladVrsta'] = 'Nema – sustav hlađenja nije definiran'

            # U-values – lxml sees real cells: [naziv, A, U, Umax, OK]
            non_empty = [c for c in cells_text if c and c not in ['-', '']]
            if len(non_empty) < 3: continue

            naziv = non_empty[0]
            if any(naziv.startswith(s) for s in SKIP_PREFIXES): continue
            if not any(v in naziv for v in VALID): continue
            if naziv in seen_names: continue

            # Remaining values after naziv: area, U, Umax
            rest = non_empty[1:]
            nums = [c for c in rest if re.match(r'^\d+\.?\d*$', c)]
            if len(nums) < 2: continue

            # Structure: nums[0]=area, nums[1]=U, nums[2]=Umax (if 3 nums)
            # Or: nums[0]=U, nums[1]=Umax (if only 2 nums)
            if len(nums) >= 3:
                area_val = nums[0]; u_str = nums[1]; umax_str = nums[2]
            else:
                area_val = '—'; u_str = nums[0]; umax_str = nums[1]

            u_val = safe_float(u_str); umax_val = safe_float(umax_str)
            if u_val is None or umax_val is None or umax_val == 0: continue
            seen_names.add(naziv)
            uvals.append({'naziv': naziv, 'area': area_val, 'u': u_str,
                          'umax': umax_str,
                          'provjera': 'ZADOVOLJAVA' if u_val <= umax_val else 'NE ZADOVOLJAVA'})

        data['uvalues'] = uvals
        data['kiRefRaw'] = '\n'.join(raw_lines)

    # Energy classes
    def cls_q(v):
        v = safe_float(v)
        if v is None: return '—'
        if v <= 15: return 'A+'; 
        if v <= 30: return 'A'
        if v <= 50: return 'B'
        if v <= 75: return 'C'
        if v <= 100: return 'D'
        if v <= 150: return 'E'
        if v <= 200: return 'F'
        return 'G'

    def cls_e(v, mx):
        v = safe_float(v); mx = safe_float(mx)
        if not v or not mx: return '—'
        r = v/mx
        if r <= 0.25: return 'A+'
        if r <= 0.50: return 'A'
        if r <= 0.75: return 'B'
        if r <= 1.00: return 'C'
        if r <= 1.50: return 'D'
        if r <= 2.00: return 'E'
        if r <= 2.50: return 'F'
        return 'G'

    data['razredQhnd'] = cls_q(data.get('qhndM2'))
    data['razredEprim'] = cls_e(data.get('eprimM2'), data.get('eprimMax'))
    return data

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No file path'}))
        sys.exit(1)
    try:
        result = extract(sys.argv[1])
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        import traceback
        print(json.dumps({'error': str(e), 'trace': traceback.format_exc()[-800:]}))
        sys.exit(1)
