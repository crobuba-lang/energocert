#!/usr/bin/env python3
"""parse_ki.py – KI Expert .docx parser - fast lxml for table 9"""
import sys, re, json, zipfile
from docx import Document
from lxml import etree

def sf(s):
    try: return float(str(s).replace(',','.').strip())
    except: return None

def uv(cells):
    seen=set(); r=[]
    for c in cells:
        v=c.strip()
        if v and v!='-' and v not in seen: seen.add(v); r.append(v)
    return r

def extract(path):
    data = {}
    doc = Document(path)
    ntbl = len(doc.tables)

    # ── TABLE 1 ──────────────────────────────────────────────────────
    if ntbl > 1:
        for row in doc.tables[1].rows:
            cells = [c.text.strip() for c in row.cells]
            k = cells[0] if cells else ''
            v = cells[-1] if len(cells)>1 else ''
            ku = k.upper()
            if 'INVESTITOR' in ku or 'Investitor' in k: data['narucitelj'] = v
            if 'Naziv zgrade' in k: data['gradjevina'] = v
            if 'Vrsta zgrade' in k:
                vr = v.strip()
                vl = vr.lower()
                if 'obiteljsk' in vl: data['vrsta'] = 'Obiteljska kuća'
                elif 'višestamb' in vl or 'visestamb' in vl: data['vrsta'] = 'Višestambena zgrada'
                elif 'uredsk' in vl or 'poslovn' in vl: data['vrsta'] = 'Uredska zgrada'
                elif 'hotel' in vl: data['vrsta'] = 'Hotel/restoran'
                elif 'bolnic' in vl: data['vrsta'] = 'Bolnica'
                elif 'sportsk' in vl: data['vrsta'] = 'Sportska dvorana'
                elif 'trgovin' in vl: data['vrsta'] = 'Zgrada trgovine'
                else: data['vrsta'] = vr
            if 'k.č' in k or 'k.o.' in k.lower(): data['katastar'] = v
            if 'Adresa' in k: data['lokacija'] = v
            if 'Oplošje' in k and '(' in k: data['oplosje'] = v
            if 'Obujam' in k and 'V e' in k: data['obujam'] = v
            if 'Faktor oblika' in k: data['faktor'] = v
            if 'korisne površine' in k: data['ak'] = v
            if 'Meteorološka' in k: data['meteo'] = v

    # ── TABLE 2 – QHnd ref, QCnd, Htr ────────────────────────────────
    if ntbl > 2:
        rows2 = list(doc.tables[2].rows)
        for i, row in enumerate(rows2):
            cells = [c.text.strip() for c in row.cells]
            u = uv(cells); k = u[0] if u else ''
            nums = [x for x in u if sf(x) is not None]
            if 'Q H,nd' in k and 'kWh/a' in k and 'jedinici' not in k:
                data['qhndKwh'] = u[-1] if len(u)>1 else ''
            if "Q'' H,nd" in k and 'kWh/(m 2' in k and len(nums)>=2:
                data['qhndMax'] = nums[0]; data['qhndM2'] = nums[-1]
            if 'Q C,nd' in k and 'kWh/a' in k and 'jedinici' not in k:
                data['qcndKwh'] = u[-1] if len(u)>1 else ''
            if "Q'' C,nd" in k and 'kWh/(m 2' in k and len(nums)>=2:
                data['qcndM2'] = nums[-1]
            if 'H tr,adj' in k and 'W/(m 2' in k and len(nums)>=2:
                data['htrMax'] = nums[0]; data['htrAdj'] = nums[-1]

    # ── TABLE 4 – Edel, Eprim, OIE ───────────────────────────────────
    if ntbl > 4:
        for row in doc.tables[4].rows:
            cells = [c.text.strip() for c in row.cells]
            u = uv(cells); k = u[0] if u else ''
            if 'isporučena energija' in k and 'termotehnički' in k and len(u)>1:
                data['edel'] = u[1]
            if 'primarna energija' in k and 'termotehnički' in k and len(u)>1:
                data['eprim'] = u[1]

    # ── TABLE 5 – Eprim/m2, nZEB ─────────────────────────────────────
    if ntbl > 5:
        rows5 = list(doc.tables[5].rows)
        for i, row in enumerate(rows5):
            cells = [c.text.strip() for c in row.cells]
            u = uv(cells); k = u[0] if u else ''
            if 'E del' in k and 'kWh/a' in k and len(u)>1:
                data['edel'] = u[1]
            if 'E prim' in k and 'kWh/a' in k and 'jedinici' not in k and len(u)>1:
                data['eprim'] = u[1]
            if 'jedinici' in k and 'E prim' in k and i+1<len(rows5):
                nu = uv([c.text.strip() for c in rows5[i+1].cells])
                nums = [x for x in nu if sf(x) is not None]
                if len(nums)>=2: data['eprimMax']=nums[0]; data['eprimM2']=nums[-1]
            if 'nZEB' in ' '.join(u): data['nzeb'] = 'da'
            if '%' in k and 'obnovlj' in k.lower():
                nums = [x for x in u if sf(x) is not None]
                if nums: data['oieUdio'] = nums[-1]

    # ── TABLE 8 – grijanje, energent ─────────────────────────────────
    if ntbl > 8:
        for row in doc.tables[8].rows:
            cells = [c.text.strip() for c in row.cells]
            u = uv(cells); k = u[0] if u else ''
            if k == 'Sustav grijanja:' and len(u)>1: data['grijVrsta'] = u[1]
            if 'energenta za grijanje' in k and len(u)>1: data['grijEnergent'] = u[1]
            if 'obnovljive energije' in k and len(u)>1: data['oieUdio'] = u[1]

    # ── SEARCH ALL TABLES for koeficijenti + Af ──────────────────────
    for tbl in doc.tables:
        for row in tbl.rows:
            cells = [c.text.strip() for c in row.cells]
            full = ' '.join(cells)
            nums_all = [c for c in cells if sf(c) is not None]
            if not nums_all: continue
            val = nums_all[-1]

            # Koeficijenti transmisijskih gubitaka
            if 'prema vanjskom okolišu' in full:
                data['hD'] = val
            if 'prema tlu' in full and ('g,avg' in full or 'Hg' in full):
                data['hGavg'] = val
            if 'kroz negrijani' in full and 'H' in full:
                data['hU'] = val
            if 'prema susjednoj' in full and 'H' in full:
                data['hA'] = val
            if 'Ukupni koeficijent' in full and 'izmjene topline' in full and 'H Tr' in full:
                data['hTr'] = val

            # Af - search everywhere
            if 'kondicionirane' in full and 'dimenzijama' in full:
                data['bruto'] = val

    # ── TABLE 9 – XML FAST ────────────────────────────────────────────
    NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    W = '{'+NS+'}'
    def gt(el):
        return ''.join(t.text or '' for t in el.iter(W+'t')).strip()

    with zipfile.ZipFile(path,'r') as z:
        xml = z.read('word/document.xml')
    root = etree.fromstring(xml)
    tbls = root.findall('.//' + W + 'tbl')

    if len(tbls) > 9:
        t9rows = []
        for tr in tbls[9].findall('.//' + W+'tr'):
            c = [gt(tc) for tc in tr.findall('.//' + W+'tc')]
            if c: t9rows.append(c)

        uvals=[]; seen=set(); raw=[]
        VALID=['Vanjski zid','Zid prema','Pod na tlu','Strop','Kosi krov','Ravni krov']
        SKIP=['2.A.','Unutarnja','Opći','Toplinska','Površinska','Dinamičke',
              'Slojevi','Ispravci','Proračun','Odabrani','Naziv otvora',
              'Gibanj','Stacionarni','Granice','Nema','Koriste','Popis',
              'Gubitak','A gd','Q sol','Q int','Q Ve','n inf','Godišnje',
              'Svi mj','Siječanj','Veljača','Ožujak','Travanj','Svibanj',
              'Lipanj','Srpanj','Kolovoz','Rujan','Listopad','Studeni',
              'Prosinac','Električna','SPF','Obnovlj','Ukupni','Ako je']

        for ct in t9rows:
            # raw
            su=set(); uniq=[]
            for c in ct:
                if c and c not in su: su.add(c); uniq.append(c)
            if len(raw)<2000 and uniq: raw.append(' | '.join(uniq[:6]))

            full = ' '.join(ct[:15])
            allc = ' '.join(ct)

            # n50
            if 'Broj izmjena zraka' in full and '50 Pa' in full:
                m = re.search(r'n\s*50\s*=\s*([\d.]+)', allc)
                if m: data['zrakN50'] = m.group(1)

            # Geometry
            def gn(cells, pat):
                return list(dict.fromkeys([c for c in cells if re.match(pat,c)]))
            if 'Oplošje grijanog dijela zgrade' in full and 'A,' in full:
                ns=gn(ct,r'^\d{2,}\.\d+$')
                if ns: data['oplosje']=ns[-1]
            if 'Obujam grijanog dijela zgrade' in full and 'V e,' in full:
                ns=gn(ct,r'^\d{2,}\.\d+$')
                if ns: data['obujam']=ns[-1]
            if 'Obujam grijanog zraka' in full:
                ns=gn(ct,r'^\d{2,}\.\d+$')
                if ns: data['obujamZrak']=ns[-1]
            if 'Faktor oblika zgrade' in full:
                ns=gn(ct,r'^0\.\d+$')
                if ns: data['faktor']=ns[-1]
            if 'Ploština korisne površine' in full and 'A K,' in full:
                ns=gn(ct,r'^\d{2,}\.\d+$')
                if ns: data['ak']=ns[-1]
            if 'kondicionirane' in full and 'dimenzijama' in full:
                ns=gn(ct,r'^\d{2,}\.\d+$')
                if ns: data['bruto']=ns[-1]
            if 'Ukupna ploština pročelja' in full:
                ns=gn(ct,r'^\d{2,}\.\d+$')
                if ns: data['procelj']=ns[-1]
            if 'Ukupna ploština prozora' in full:
                ns=gn(ct,r'^\d+\.\d+$')
                if ns: data['prozori']=ns[-1]

            # Systems
            if 'Vrsta dizalice topline' in full:
                pool=list(dict.fromkeys([c for c in ct if c and 'Vrsta' not in c and 'dizalice' not in c and c!='-']))
                if pool: data['grijIzvor']='Dizalica topline '+pool[-1]
            if 'Učinak u definiranoj radnoj točki' in full:
                ns=gn(ct,r'^\d+\.\d+$')
                if ns: data['grijSnaga']=ns[-1]
            if 'Sezonski toplinski množitelj' in full and 'grijanj' in full:
                ns=gn(ct,r'^\d+\.\d+$')
                if ns: data['grijCop']='SCOP = '+ns[-1]
            if 'Direktno grijani električni' in full:
                data['ptvTip']='Direktno grijani električni spremnik (DGA)'
            if 'Nema definiranih sustava hlađenja' in full:
                data['hladVrsta']='Nema – sustav hlađenja nije definiran'
            if 'Volumen' in full and 'spremnik' in full.lower():
                ns=gn(ct,r'^\d+\.?\d*$')
                if ns: data['ptvVol']=ns[-1]
            if 'Godišnja potrebna toplinska energija za PTV' in full:
                ns=gn(ct,r'^\d+\.\d+$')
                if ns: data['ptvQw']=ns[-1]
            if 'Nema definiranih sustava rasvjete' in full:
                data['rasvVrsta']='Nije predviđena – stambena zgrada'

            # Spec climate values (from spec file)
            if "Q'' H,nd" in full and 'spec' in full.lower():
                ns=gn(ct,r'^\d+\.\d+$')
                if ns: data['qhndSpec']=ns[-1]
            if 'E prim' in full and 'spec' in full.lower() and 'jedinici' in full:
                ns=gn(ct,r'^\d+\.\d+$')
                if ns: data['eprimSpec']=ns[-1]
            if 'E del' in full and 'spec' in full.lower():
                ns=gn(ct,r'^\d+\.\d+$')
                if ns: data['edelSpec']=ns[-1]

            # U-values (lxml gives real cells: naziv | A | U | Umax | OK)
            ne=[c for c in ct if c and c not in ['-','']]
            if len(ne)<3: continue
            naziv=ne[0]
            if any(naziv.startswith(s) for s in SKIP): continue
            if not any(v in naziv for v in VALID): continue
            if naziv in seen: continue
            rest=ne[1:]
            nums=[c for c in rest if re.match(r'^\d+\.?\d*$',c)]
            if len(nums)<2: continue
            if len(nums)>=3: av=nums[0]; us=nums[1]; ums=nums[2]
            else: av='—'; us=nums[0]; ums=nums[1]
            uv2=sf(us); umv=sf(ums)
            if uv2 is None or umv is None or umv==0: continue
            seen.add(naziv)
            uvals.append({'naziv':naziv,'area':av,'u':us,'umax':ums,
                'provjera':'ZADOVOLJAVA' if uv2<=umv else 'NE ZADOVOLJAVA'})

        data['uvalues']=uvals
        data['kiRefRaw']='\n'.join(raw)

    # Energy classes
    def cq(v):
        v=sf(v)
        if v is None: return '—'
        if v<=15: return 'A+'
        if v<=30: return 'A'
        if v<=50: return 'B'
        if v<=75: return 'C'
        if v<=100: return 'D'
        if v<=150: return 'E'
        if v<=200: return 'F'
        return 'G'
    def ce(v,mx):
        v=sf(v); mx=sf(mx)
        if not v or not mx: return '—'
        r=v/mx
        if r<=0.25: return 'A+'
        if r<=0.50: return 'A'
        if r<=0.75: return 'B'
        if r<=1.00: return 'C'
        if r<=1.50: return 'D'
        if r<=2.00: return 'E'
        if r<=2.50: return 'F'
        return 'G'
    data['razredQhnd']=cq(data.get('qhndM2'))
    data['razredEprim']=ce(data.get('eprimM2'),data.get('eprimMax'))
    return data

if __name__=='__main__':
    if len(sys.argv)<2:
        print(json.dumps({'error':'No file'})); sys.exit(1)
    try:
        print(json.dumps(extract(sys.argv[1]),ensure_ascii=False))
    except Exception as e:
        import traceback
        print(json.dumps({'error':str(e),'trace':traceback.format_exc()[-500:]}))
        sys.exit(1)
