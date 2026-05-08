// ═══════════════════════════════════════════
// EXPORT.JS – Word document generation
// Uses docx.js from CDN
// ═══════════════════════════════════════════
const Export = {

  async generateWord() {
    const btn = document.getElementById('btn-export-word');
    btn.textContent = '⏳ Generiram...'; btn.disabled = true;

    try {
      // docx loaded via <script> tag in index.html
      if (!window.docx) { toast('❌ docx biblioteka nije učitana – osvježite stranicu', 'err'); return; }

      const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
              ImageRun, AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType, PageBreak } = window.docx;

      const d = State.data;
      const type = State.buildingType;
      const isPost = type === 'postojeca';

      // ── METHODOLOGY RULES per building type ───────────────────────
      const stamb = ['obiteljska','visestambena'].includes(d.vrsta||'obiteljska');
      const calcLighting = !stamb;  // stambene ne proracunavaju rasvjetu
      const calcCooling  = !stamb;  // stambene ne uzimaju hlađenje u primarnu energiju
      // Penalizacijski faktori iz Tablice 5-22 Metodologije
      const penGrijanje = stamb ? 1.50 : (d.vrsta==='visestambena'?1.60:1.40);

      // ── HELPERS ──────────────────────────────────────────────────
      const G = { dark:'2B2B2B', mid:'555555', light:'888888', head:'D0D0D0', row:'F4F4F4', line:'AAAAAA' };
      const FONT='Calibri', SZ=24, SZT=22, SZH1=28, SZH2=24, SZH3=22, SZS=18;
      const SP  ={before:0,  after:100, line:360, lineRule:'auto'};
      const SPH1={before:400,after:140, line:360, lineRule:'auto'};
      const SPH2={before:300,after:100, line:360, lineRule:'auto'};
      const SPH3={before:200,after:60,  line:360, lineRule:'auto'};
      const SPT ={before:0,  after:0,   line:260, lineRule:'auto'};
      const W=9026;
      const brd=()=>({style:BorderStyle.SINGLE,size:4,color:G.line});
      const ABRD={top:brd(),bottom:brd(),left:brd(),right:brd()};
      const CMAR={top:60,bottom:60,left:100,right:100};

      const h1=t=>new Paragraph({heading:HeadingLevel.HEADING_1,spacing:SPH1,
        border:{bottom:{style:BorderStyle.SINGLE,size:10,color:G.mid,space:4}},
        children:[new TextRun({text:t,bold:true,size:SZH1,font:FONT,color:G.dark})]});
      const h2=t=>new Paragraph({heading:HeadingLevel.HEADING_2,spacing:SPH2,
        children:[new TextRun({text:t,bold:true,size:SZH2,font:FONT,color:G.mid})]});
      const h3=t=>new Paragraph({heading:HeadingLevel.HEADING_3,spacing:SPH3,
        children:[new TextRun({text:t,bold:true,italics:true,size:SZH3,font:FONT,color:G.light})]});
      const p=(t,o={})=>new Paragraph({spacing:SP,
        children:[new TextRun({text:t||'',size:SZ,font:FONT,color:G.dark,...o})]});
      const bullet=t=>new Paragraph({spacing:SP,
        children:[new TextRun({text:`• ${t}`,size:SZ,font:FONT,color:G.dark})]});
      const ps=t=>new Paragraph({spacing:{before:0,after:60,line:240,lineRule:'auto'},
        children:[new TextRun({text:t,size:SZS,font:FONT,color:G.light,italics:true})]});
      const gap=()=>new Paragraph({spacing:{before:0,after:80,line:240,lineRule:'auto'},children:[new TextRun('')]});
      const pb=()=>new Paragraph({children:[new PageBreak()]});

      const tbl=(headers,rows,colWidths)=>{
        const widths=colWidths||headers.map(()=>Math.floor(W/headers.length));
        const cell=(txt,isHdr,isAlt)=>new TableCell({borders:ABRD,margins:CMAR,
          width:{size:0,type:WidthType.AUTO},
          shading:isHdr?{fill:G.head,type:ShadingType.CLEAR}:isAlt?{fill:G.row,type:ShadingType.CLEAR}:undefined,
          children:[new Paragraph({spacing:SPT,children:[new TextRun({
            text:String(txt??'—'),bold:isHdr,size:SZT,font:FONT,color:G.dark})]})]});
        return new Table({width:{size:W,type:WidthType.DXA},columnWidths:widths,rows:[
          new TableRow({children:headers.map(h=>cell(h,true,false))}),
          ...rows.map((row,ri)=>new TableRow({children:row.map(v=>cell(v,false,ri%2!==0))}))
        ]});
      };

      // Image helper
      const imgRun=(dataB64,w,h,rotate=false)=>{
        const bytes=atob(dataB64);
        const arr=new Uint8Array(bytes.length);
        for(let i=0;i<bytes.length;i++) arr[i]=bytes.charCodeAt(i);
        const transform = rotate
          ? {width:h, height:w, rotation:90}  // 90° CW: swap w/h
          : {width:w, height:h};
        return new ImageRun({data:arr.buffer, transformation:transform, type:'jpg'});
      };

      const getImg=(id,w,h)=>{
        if(!id) return null;
        const b64=Photos.getBase64(id);
        if(!b64) return null;
        return new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:120,after:60},children:[imgRun(b64,w,h)]});
      };
      const getImgFromSlot=(slot,w,h,rotate=false)=>{
        const b64=Photos.getBase64(slot);
        if(!b64) return null;
        return new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:120,after:60},children:[imgRun(b64,w,h,rotate)]});
      };
      const getImgCaption=(caption)=>new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:160},
        children:[new TextRun({text:caption,italics:true,size:SZS,font:FONT,color:G.light})]});

      // ── CONTENT BUILDER ───────────────────────────────────────────
      const C = [];

      // NASLOVNA
      C.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:600,after:120,line:240,lineRule:'auto'},
        children:[new TextRun({text:'IZVJEŠĆE O PROVEDENOM',bold:true,size:48,font:FONT,color:G.dark})]}));
      const titleType = isPost ? 'ENERGETSKOM PREGLEDU POSTOJEĆE ZGRADE' : 'ENERGETSKOM PREGLEDU NOVE ZGRADE';
      C.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:360,line:240,lineRule:'auto'},
        children:[new TextRun({text:titleType,bold:true,size:48,font:FONT,color:G.dark})]}));

      // Cover photo
      const coverB64 = Photos.getBase64('cover');
      if (coverB64) {
        C.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:240},
          children:[imgRun(coverB64,477,284)]}));
      }

      C.push(tbl(['Polje','Vrijednost'],[
        ['NARUČITELJ',d.narucitelj||'—'],['OIB',d.oib||'—'],
        ['GRAĐEVINA',d.gradjevina||'—'],['LOKACIJA',d.lokacija||'—'],
        ['KATASTARSKA ČESTICA',d.katastar||'—'],
        ...(isPost ? [['GODINA IZGRADNJE',d.godina||'—']] : []),
        ['VODITELJ ENERGETSKOG PREGLEDA','Goran Muhvić, dipl.ing.stroj.'],
        ['DATUM',d.datum||'—'],
      ],[3000,6026]));
      C.push(gap()); C.push(p('Ovlaštene osobe:',{bold:true}));
      if (d.experts?.length) {
        C.push(tbl(['Dio zgrade','Ovlaštena osoba','Registarski broj','Potpis'],
          (d.experts||[]).map(e=>[e?.tip||'',e?.ime||'',e?.reg||'','']),
          [1700,3826,1900,1600]));
      }
      C.push(pb());

      // 1. SAŽETAK
      C.push(h1('1. SAŽETAK'));
      if (d.sazetak) {
        d.sazetak.split('\n').filter(Boolean).forEach(ln => C.push(p(ln)));
      } else {
        C.push(p(`Predmet ovog energetskog pregleda je ${d.gradjevina||'zgrada'}.`));
        C.push(gap());
        C.push(p('Dobiveni su sljedeći energetski razredi zgrade (referentni klimatski podaci):', {bold:true}));
        C.push(p(`Energetski razred prema Q''H,nd,ref [kWh/(m²a)]:   ${d.razredQhnd||'—'}`));
        C.push(p(`Energetski razred prema E'prim [kWh/(m²a)]:   ${d.razredEprim||'—'}`));
      }
      C.push(gap());
      C.push(h3('Osnovni podaci o zgradi:'));
      const basicRows = [
        ['Vrsta zgrade',d.vrsta||'—'],['Lokacija',d.lokacija||'—'],
        ['Katastarska čestica',d.katastar||'—'],
        ...(isPost?[['Godina izgradnje',d.godina||'—']]:[]),
        ['Korisna površina AK [m²]',d.ak||'—'],['Bruto površina [m²]',d.bruto||'—'],
        ['Broj etaža',d.etaze||'—'],['Temp. grijanja [°C]','20,00'],['Temp. hlađenja [°C]','24,00'],
      ];
      C.push(tbl(['Rb.','Opis','Vrijednost'], basicRows.map((r,i)=>[(i+1)+'.',r[0],r[1]]), [600,4800,3626]));

      // 2. SNIMAK
      const snimakTitle = isPost ? '2. SNIMAK POSTOJEĆEG STANJA' : '2. SNIMAK IZVEDENOG STANJA';
      C.push(h1(snimakTitle));
      C.push(h2('2.1. Podaci o naručitelju'));
      C.push(tbl(['Sudionik','Podatak'],[
        ['Vlasnik / Naručitelj',d.narucitelj||'—'],['OIB',d.oib||'—'],
        ...(d.arhProjekt?[['Arhitektonski projekt',d.arhProjekt]]:[]),
        ...(d.strojProjekt?[['Strojarski projekt',d.strojProjekt]]:[]),
        ...(d.elProjekt?[['Elektrotehnički projekt',d.elProjekt]]:[]),
        ...(d.izvodac?[['Izvođač',d.izvodac]]:[]),
        ...(d.nadzor?[['Nadzorni inženjer',d.nadzor]]:[]),
      ],[3000,6026]));
      C.push(gap());

      C.push(h2('2.2. Građevinski i arhitektonski elementi zgrade'));
      if (d.opisKonstr) d.opisKonstr.split('\n').filter(Boolean).forEach(ln=>C.push(p(ln)));
      else C.push(p('[Opis konstrukcije i ovojnice – unijeti ručno]',{color:G.light,italics:true}));
      C.push(gap());
      C.push(h3('Geometrijske karakteristike zgrade:'));
      C.push(tbl(['Potrebni podaci','Jed.','Vrijednost'],[
        ['Oplošje grijanog dijela – A','m²',d.oplosje||'—'],
        ['Obujam grijanog dijela – Ve','m³',d.obujam||'—'],
        ['Obujam grijanog zraka – V','m³',d.obujamZrak||'—'],
        ['Faktor oblika – f₀','m⁻¹',d.faktor||'—'],
        ['Ploština korisne površine – AK','m²',d.ak||'—'],
        ['Ukupna ploština pročelja – Auk','m²',d.procelj||'—'],
        ['Ukupna ploština prozora – Awuk','m²',d.prozori||'—'],
        ['Broj etaža','—',d.etaze||'—'],
        ['Meteorološka postaja','—',d.meteo||'—'],
      ],[4500,900,3626]));
      C.push(gap());

      C.push(h2('2.2.1. Koeficijenti prolaska topline'));
      if (d.uvalues?.length) {
        C.push(tbl(['Naziv građevnog dijela','A [m²]','U [W/m²K]',isPost?'Umax [W/m²K] dop.*':'Umax [W/m²K] dop.','Provjera'],
          (d.uvalues||[]).map(u=>[u?.naziv||'',u?.area||'',u?.u||'',u?.umax||'',u?.provjera||'']),
          [2600,900,1500,1600,2426]));
        if (isPost) C.push(ps('* Max. dopuštene vrijednosti prema TPRUETZZ za rekonstrukciju postojeće zgrade.'));
      }
      C.push(gap());
      C.push(h2('2.2.2. Koeficijenti toplinskih gubitaka'));
      C.push(tbl(['Koeficijent toplinskih gubitaka','Vrijednost [W/K]'],[
        ['Koef. transmisijske izmjene topline prema vanjskom okolišu HD','—'],
        ['Uprosječeni koef. prema tlu Hg,avg','—'],
        ['Koef. prema negrijanim prostorima HU','—'],
        ['Ukupni koef. HTr','—'],
        ["H'tr,adj [W/(m²K)]",d.htrAdj||'—'],
      ],[5500,3526]));

      // 2.3 SUSTAVI
      C.push(h2('2.3. Termotehnički sustavi'));

      // Grijanje
      C.push(h3('2.3.1. Opis sustava grijanja'));
      if (d.opisGrijanje) d.opisGrijanje.split('\n').filter(Boolean).forEach(ln=>C.push(p(ln)));
      C.push(tbl(['Parametar','Vrijednost'],[
        ['Vrsta sustava',d.grijVrsta||'—'],['Energent',d.grijEnergent||'—'],
        ['Izvor topline',d.grijIzvor||'—'],['Nom. toplinska snaga [kW]',d.grijSnaga||'—'],
        ['COP / SCOP / η',d.grijCop||'—'],['Vrsta ogrjevnih tijela',d.grijTijela||'—'],
        ['Termostatski ventili',d.grijTrv||'—'],['Temp. režim polaz/povrat [°C]',d.grijTemp||'—'],
      ],[4500,4526]));
      const imgGrij = getImgFromSlot('grijanje',436,265,true);
      if (imgGrij) { C.push(imgGrij); C.push(getImgCaption('Slika 1 – Sustav grijanja')); }
      C.push(gap());

      // PTV
      C.push(h3('2.3.2. Opis sustava pripreme potrošne tople vode'));
      if (d.opisPtv) d.opisPtv.split('\n').filter(Boolean).forEach(ln=>C.push(p(ln)));
      C.push(tbl(['Parametar PTV sustava','Vrijednost'],[
        ['Tip podsustava',d.ptvTip||'—'],['Volumen spremnika [l]',d.ptvVol||'—'],
        ['Temperatura u spremniku [°C]',d.ptvTemp||'—'],
        ['Cirkulacijska petlja',d.ptv_cirk||'—'],
        ['QW – energija za PTV [kWh/a]',d.ptvQw||'—'],
      ],[4500,4526]));
      const imgPtv = getImgFromSlot('ptv',436,265,true);
      if (imgPtv) { C.push(imgPtv); C.push(getImgCaption('Slika 2 – Sustav PTV')); }
      C.push(gap());

      // Hlađenje
      C.push(h3('2.3.3. Opis sustava hlađenja'));
      if (d.opisHladenje) d.opisHladenje.split('\n').filter(Boolean).forEach(ln=>C.push(p(ln)));
      C.push(tbl(['Parametar hlađenja','Vrijednost'],[
        ['Vrsta sustava',d.hladVrsta||'—'],['Rashladna snaga [kW]',d.hladSnaga||'—'],
        ['Radna tvar',d.hladTvar||'—'],['EER / SEER',d.hladEer||'—'],
      ],[4500,4526]));
      const imgHlad = getImgFromSlot('hladenje',436,265,true);
      if (imgHlad) { C.push(imgHlad); C.push(getImgCaption('Slika 3 – Sustav hlađenja')); }
      C.push(gap());

      // Ventilacija
      C.push(h3('2.3.4. Opis sustava ventilacije, djelomične klimatizacije i klimatizacije'));
      if (d.opisVent) d.opisVent.split('\n').filter(Boolean).forEach(ln=>C.push(p(ln)));
      const imgVent = getImgFromSlot('ventilacija',436,265,true);
      if (imgVent) { C.push(imgVent); C.push(getImgCaption('Slika 4 – Ventilacija')); }
      C.push(gap());

      // Sumarni potrošači
      C.push(h3('2.3.5. Sumarni prikaz potrošača električne energije u termotehničkim sustavima'));
      C.push(tbl(['Termotehnički sustav','Podsustav','Vrsta energije','El. snaga [kW]','Napomena'],[
        ['Sustav grijanja',d.grijIzvor||'—','Električna energija',d.grijSnaga||'—','—'],
        ['Sustav PTV-a',d.ptvTip||'—','Električna energija','—','—'],
        ['Sustav hlađenja',d.hladVrsta||'—','Električna energija',d.hladSnaga||'—','—'],
        ['Ventilacija',d.ventVrsta||'—','—','—','—'],
      ],[1800,2200,1800,1300,1926]));
      C.push(gap());

      // 2.4 Voda
      C.push(h2('2.4. Sustavi potrošnje vode'));
      C.push(tbl(['Parametar','Vrijednost'],[
        ['Priključak na javni vodovod','DA'],
        ['God. potrošnja vode [m³]',d.vodaPot||'—'],
        ['Spec. potrošnja [l/osobi/dan]',d.vodaSpec||'—'],
        ['Sustav za kišnicu',d.kisnica||'—'],
        ['Perlatori / aeratori',d.perlatori||'—'],
      ],[4500,4526]));
      C.push(gap());

      // 2.5 El. energija
      C.push(h2('3.4. Proračun godišnje potrebne energije za rasvjetu'));
      if (!calcLighting) {
        C.push(p('Proračun godišnje potrebne energije za rasvjetu ne provodi se za zgrade stambene namjene sukladno fusnoti 4 Metodologije provođenja energetskog pregleda zgrada 2021.'));
      } else {
        C.push(p(`Godišnja potrebna električna energija za rasvjetu: EL = ${d.rasvSnaga||'—'} kWh/a (${d.rasvSpec||'—'} kWh/(m²a)).`));
      }
      C.push(gap());
      // Insert actual KI Expert content if available
      const kiContent = d.kiRefRaw || '';
      if (kiContent && kiContent.length > 100) {
        // Split into paragraphs and add to document
        const lines = kiContent.split('\n').filter(l => l.trim().length > 0);
        let paraCount = 0;
        for (const line of lines) {
          if (paraCount > 800) break; // limit lines
          const trimmed = line.trim();
          if (trimmed.length === 0) continue;
          // Detect headings (short lines in caps or starting with number)
          const isHeading = (trimmed.length < 80 && /^[0-9]+\.|^[A-ZČŠŽĆĐ\s]{10,}$/.test(trimmed));
          if (isHeading) {
            C.push(new Paragraph({spacing:{before:200,after:60,line:360,lineRule:'auto'},
              children:[new TextRun({text:trimmed,bold:true,size:22,font:'Calibri',color:G.dark})]}));
          } else {
            C.push(new Paragraph({spacing:{before:0,after:60,line:276,lineRule:'auto'},
              children:[new TextRun({text:trimmed,size:20,font:'Calibri',color:G.dark})]}));
          }
          paraCount++;
        }
      } else {
        C.push(p('[KI Expert sadržaj nije učitan – učitajte referentni KI Expert dokument na prvom koraku]',{color:G.light,italics:true}));
      }

      // ── ASSEMBLE DOCUMENT ─────────────────────────────────────────
      const doc = new Document({
        styles:{
          default:{document:{run:{font:FONT,size:SZ,color:G.dark}}},
          paragraphStyles:[
            {id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,
              run:{size:SZH1,bold:true,font:FONT,color:G.dark},
              paragraph:{spacing:SPH1,outlineLevel:0,border:{bottom:{style:BorderStyle.SINGLE,size:10,color:G.mid,space:4}}}},
            {id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',quickFormat:true,
              run:{size:SZH2,bold:true,font:FONT,color:G.mid},
              paragraph:{spacing:SPH2,outlineLevel:1}},
            {id:'Heading3',name:'Heading 3',basedOn:'Normal',next:'Normal',quickFormat:true,
              run:{size:SZH3,bold:true,italics:true,font:FONT,color:G.light},
              paragraph:{spacing:SPH3,outlineLevel:2}},
          ]
        },
        sections:[{
          properties:{page:{size:{width:11906,height:16838},margin:{top:1134,right:1134,bottom:1134,left:1134}}},
          children:C
        }]
      });

      // Use toBlob in browser (toBuffer needs Node.js)
      let blob;
      if (typeof Packer.toBlob === 'function') {
        blob = await Packer.toBlob(doc);
      } else {
        const buf = await Packer.toBuffer(doc);
        blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fname = (d.narucitelj||'Izvjestaj').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,30);
      a.download = `EnergoCert_${fname}_${type}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast('✅ Word dokument preuzet!', 'ok');

    } catch (err) {
      console.error('Export error:', err);
      toast('❌ Greška: ' + (err.message || String(err)), 'err');
    } finally {
      btn.textContent = '⬇ Preuzmi Word';
      btn.disabled = false;
    }
  }
};

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}
