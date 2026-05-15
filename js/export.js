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

      // ── METHODOLOGY RULES per building type (Metodologija 2021) ───
      const vrsta = (d.vrsta||'').toLowerCase();
      const isStamb = vrsta.includes('stamb') || vrsta.includes('obiteljska') || vrsta.includes('višestamb') || vrsta === '';
      const isNova  = type === 'nova';
      // Stambene zgrade: grijanje+PTV ulaze u izračun, hlađenje i rasvjeta NE
      // Nestambene: svi sustavi ulaze
      const calcHladenje = !isStamb;   // hlađenje ulazi samo kod nestambenih
      const calcLighting = !isStamb;   // rasvjeta ulazi samo kod nestambenih
      // Ventilacija: ulazi samo ako je mehanička
      const hasMehVent = (d.ventVrsta||'').toLowerCase().includes('mehan');

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
      // imgRun - fixed size, no distortion
      const imgRun=(dataB64,w,h)=>{
        const bytes=atob(dataB64);
        const arr=new Uint8Array(bytes.length);
        for(let i=0;i<bytes.length;i++) arr[i]=bytes.charCodeAt(i);
        return new ImageRun({data:arr.buffer,transformation:{width:w,height:h},type:'jpg'});
      };

      const getImg=(id,w,h)=>{
        if(!id) return null;
        const b64=Photos.getBase64(id);
        if(!b64) return null;
        return new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:120,after:60},children:[imgRun(b64,w,h)]});
      };
      const getImgFromSlot=(slot,maxW,maxH)=>{
        const b64=Photos.getBase64(slot);
        if(!b64) return null;
        const dims=Photos.getDims ? Photos.getDims(slot) : null;
        let fw=maxW, fh=maxH;
        if(dims && dims.w>0 && dims.h>0) {
          const ratio=dims.w/dims.h;
          // Fit within maxW x maxH preserving aspect ratio
          if(ratio > maxW/maxH) {
            // wider than box: constrain by width
            fw=maxW; fh=Math.round(maxW/ratio);
          } else {
            // taller than box: constrain by height
            fh=maxH; fw=Math.round(maxH*ratio);
          }
        }
        return new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:120,after:60},children:[imgRun(b64,fw,fh)]});
      };
      const getImgCaption=(caption)=>new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:160},
        children:[new TextRun({text:caption,italics:true,size:SZS,font:FONT,color:G.light})]});


      // ── CHART GENERATOR (SVG → PNG → docx ImageRun) ──────────────
      const makeChart = async (svgStr, w, h) => {
        return new Promise((res) => {
          const svg = new Blob([svgStr], {type: 'image/svg+xml'});
          const url = URL.createObjectURL(svg);
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = w * 2; canvas.height = h * 2; // 2x for quality
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            const dataUrl = canvas.toDataURL('image/png');
            const b64 = dataUrl.split(',')[1];
            const bytes = atob(b64);
            const arr = new Uint8Array(bytes.length);
            for(let i=0;i<bytes.length;i++) arr[i]=bytes.charCodeAt(i);
            res(new ImageRun({data:arr.buffer, transformation:{width:w,height:h}, type:'png'}));
          };
          img.onerror = () => res(null);
          img.src = url;
        });
      };

      // Chart 1: Energetski razredi (bar chart Q''H,nd i E'prim vs max)
      const makeEnergyClassChart = async () => {
        const qhnd = parseFloat(d.qhndM2||0);
        const qmax = parseFloat(d.qhndMax||100);
        const eprim = parseFloat(d.eprimM2||0);
        const emax = parseFloat(d.eprimMax||100);
        const barW = 160; const barH = 20; const pad = 40; const gap = 50;
        const totalW = 520; const totalH = 180;
        const scaleQ = Math.min(barW, qmax>0 ? (qhnd/qmax)*barW : barW);
        const scaleE = Math.min(barW, emax>0 ? (eprim/emax)*barW : barW);
        const colQ = qhnd<=qmax ? '#4caf81' : '#e05555';
        const colE = eprim<=emax ? '#4caf81' : '#e05555';
        const svg = `<svg width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg" font-family="Calibri,Arial">
          <rect width="${totalW}" height="${totalH}" fill="white"/>
          <text x="10" y="25" font-size="14" font-weight="bold" fill="#333">Usporedba energetskih pokazatelja s max. dopuštenim</text>
          <!-- Q''H,nd -->
          <text x="10" y="60" font-size="11" fill="#555">Q''H,nd [kWh/(m²a)]</text>
          <rect x="${pad+100}" y="45" width="${barW}" height="${barH}" fill="#eee" rx="3"/>
          <rect x="${pad+100}" y="45" width="${scaleQ}" height="${barH}" fill="${colQ}" rx="3"/>
          <rect x="${pad+100+barW}" y="45" width="3" height="${barH}" fill="#999"/>
          <text x="${pad+100+scaleQ+5}" y="60" font-size="10" fill="${colQ}">${qhnd} / max ${qmax}</text>
          <text x="${pad+100+barW+8}" y="60" font-size="9" fill="#999">max</text>
          <text x="${pad+5}" y="60" font-size="12" font-weight="bold" fill="${colQ}">${d.razredQhnd||'—'}</text>
          <!-- E'prim -->
          <text x="10" y="${60+gap}" font-size="11" fill="#555">E'prim [kWh/(m²a)]</text>
          <rect x="${pad+100}" y="${45+gap}" width="${barW}" height="${barH}" fill="#eee" rx="3"/>
          <rect x="${pad+100}" y="${45+gap}" width="${scaleE}" height="${barH}" fill="${colE}" rx="3"/>
          <rect x="${pad+100+barW}" y="${45+gap}" width="3" height="${barH}" fill="#999"/>
          <text x="${pad+100+scaleE+5}" y="${60+gap}" font-size="10" fill="${colE}">${eprim} / max ${emax}</text>
          <text x="${pad+100+barW+8}" y="${60+gap}" font-size="9" fill="#999">max</text>
          <text x="${pad+5}" y="${60+gap}" font-size="12" font-weight="bold" fill="${colE}">${d.razredEprim||'—'}</text>
          <!-- nZEB -->
          <rect x="${pad+100}" y="${45+gap*2}" width="120" height="${barH}" fill="${d.nzeb==='da'?'#4caf81':'#e05555'}" rx="3"/>
          <text x="${pad+100+60}" y="${60+gap*2}" font-size="11" fill="white" text-anchor="middle">${d.nzeb==='da'?'nZEB ✓':'nZEB ✗'}</text>
          <text x="10" y="${60+gap*2}" font-size="11" fill="#555">nZEB status</text>
        </svg>`;
        return svg;
      };

      // Chart 2: Energetska bilanca (pie/donut - struktura primarne energije)
      const makeEnergyPieChart = async () => {
        const edel = parseFloat(d.edel||0);
        const oiePct = parseFloat(d.oieUdio||0);
        const nonOie = Math.max(0, 100-oiePct);
        const svg = `<svg width="400" height="200" xmlns="http://www.w3.org/2000/svg" font-family="Calibri,Arial">
          <rect width="400" height="200" fill="white"/>
          <text x="10" y="22" font-size="14" font-weight="bold" fill="#333">Struktura isporučene energije</text>
          <!-- Donut chart -->
          <circle cx="110" cy="110" r="70" fill="none" stroke="#eee" stroke-width="30"/>
          <circle cx="110" cy="110" r="70" fill="none" stroke="#4caf81" stroke-width="30"
            stroke-dasharray="${(oiePct/100)*440} ${440-(oiePct/100)*440}" stroke-dashoffset="110"
            transform="rotate(-90 110 110)"/>
          <text x="110" y="105" text-anchor="middle" font-size="18" font-weight="bold" fill="#333">${oiePct}%</text>
          <text x="110" y="122" text-anchor="middle" font-size="10" fill="#666">OIE</text>
          <!-- Legend -->
          <rect x="210" y="60" width="14" height="14" fill="#4caf81" rx="2"/>
          <text x="230" y="72" font-size="11" fill="#333">OIE – ${oiePct}%</text>
          <rect x="210" y="82" width="14" height="14" fill="#eee" stroke="#ccc" rx="2"/>
          <text x="230" y="94" font-size="11" fill="#333">Ostalo – ${nonOie.toFixed(1)}%</text>
          <rect x="210" y="114" width="14" height="14" fill="none"/>
          <text x="210" y="130" font-size="11" fill="#555">Edel = ${edel} kWh/a</text>
          <text x="210" y="148" font-size="11" fill="#555">Eprim = ${d.eprim||'—'} kWh/a</text>
          <text x="210" y="166" font-size="11" fill="${d.oieUdio>=30?'#4caf81':'#e05555'}" font-weight="bold">OIE uvjet ≥30%: ${parseFloat(d.oieUdio||0)>=30?'✓ ZADOVOLJAVA':'✗ NE ZADOVOLJAVA'}</text>
        </svg>`;
        return svg;
      };

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
        ['GRAĐEVINA',d.vrsta||d.gradjevina||'—'],['LOKACIJA',d.lokacija||'—'],
        ['KATASTARSKA ČESTICA',d.katastar||'—'],
        ...(isPost ? [['GODINA IZGRADNJE',d.godina||'—']] : []),
        ['VODITELJ ENERGETSKOG PREGLEDA','Goran Muhvić, dipl.ing.stroj.'],
        ['DATUM',d.datum||new Date().toLocaleDateString('hr-HR')],
      ],[3000,6026]));
      C.push(gap()); C.push(p('Ovlaštene osobe:',{bold:true}));
      // Ovlaštene osobe - uvijek iste, fiksno
      C.push(tbl(['Dio zgrade','Ovlaštena osoba','Registarski broj','Potpis'],[
        ['Arhitektura','Nataša Kordej Čuljak, dipl.ing.arh.','P-1234-XXXX',''],
        ['Strojarske instalacije','Goran Muhvić, dipl.ing.stroj.','F_4512_0042',''],
        ['Elektrotehnički','Goran Klanj, dipl.ing.el.','P-5678-XXXX',''],
      ],[1700,3826,1900,1600]));
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
        ['Korisna površina AK [m²]',d.ak||'—'],['Površina kondicionirane zone Af [m²]',d.bruto||'—'],
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
        ['Površina kondicionirane zone Af [m²]','m²',d.bruto||'—'],
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
      C.push(new Paragraph({spacing:{before:0,after:60},
        children:[new TextRun({text:'Ukupni koeficijenti transmisijskih gubitaka',bold:true,size:SZT,font:FONT,color:G.dark})]}));
      C.push(tbl(['Koeficijent toplinskih gubitaka','Vrijednost [W/K]'],[
        ['Koeficijent transmisijske izmjene topline prema vanjskom okolišu, HD [W/K]',d.hD||'—'],
        ['Uprosječeni koeficijent transmisijske izmjene topline prema tlu, Hg,avg [W/K]',d.hGavg||'—'],
        ['Koeficijent transmisijske izmjene topline kroz negrijani prostor, HU [W/K]',d.hU||'0.000'],
        ['Koeficijent transmisijske izmjene topline prema susjednoj zgradi, HA [W/K]',d.hA||'0.000'],
        ['Ukupni koeficijent transmisijske izmjene topline, HTr [W/K]',d.hTr||'—'],
      ],[6000,3026]));
      C.push(gap());
      C.push(tbl(["H'tr,adj [W/(m²K)]",'Izračunata vrijednost','Max. dopuštena vrijednost','Provjera'],[
        ["Koef. toplinskog gubitka po oplošju grijanog dijela zgrade",d.htrAdj||'—',d.htrMax||'—',
          (parseFloat(d.htrAdj||99) <= parseFloat(d.htrMax||0.01) ? 'ZADOVOLJAVA' : 'NE ZADOVOLJAVA')],
      ],[3000,1800,1800,2426]));

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
      const imgGrij = getImgFromSlot('grijanje',436,265);
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
      const imgPtv = getImgFromSlot('ptv',436,265);
      if (imgPtv) { C.push(imgPtv); C.push(getImgCaption('Slika 2 – Sustav PTV')); }
      C.push(gap());

      // Hlađenje
      C.push(h3('2.3.3. Opis sustava hlađenja'));
      if (!calcHladenje) {
        C.push(p('Sukladno Metodologiji provođenja energetskog pregleda zgrada 2021, za stambene zgrade hlađenje ne ulazi u proračun primarne energije. U zgradi ' + (d.hladVrsta && !d.hladVrsta.includes('Nema') ? 'postoji lokalni sustav hlađenja (' + d.hladVrsta + '), međutim isti' : 'nije predviđen sustav hlađenja koji') + ' ne ulazi u energetski proračun.'));
      } else {
        if (d.opisHladenje) d.opisHladenje.split('\n').filter(Boolean).forEach(ln=>C.push(p(ln)));
        C.push(tbl(['Parametar hlađenja','Vrijednost'],[
          ['Vrsta sustava',d.hladVrsta||'—'],['Rashladna snaga [kW]',d.hladSnaga||'—'],
          ['Radna tvar',d.hladTvar||'—'],['EER / SEER',d.hladEer||'—'],
        ],[4500,4526]));
        const imgHlad = getImgFromSlot('hladenje',436,265);
        if (imgHlad) { C.push(imgHlad); C.push(getImgCaption('Slika 3 – Sustav hlađenja')); }
      }
      C.push(gap());

      // Ventilacija
      C.push(h3('2.3.4. Opis sustava ventilacije, djelomične klimatizacije i klimatizacije'));
      if (d.opisVent) {
        d.opisVent.split('\n').filter(Boolean).forEach(ln=>C.push(p(ln)));
      } else {
        const ventTip = (d.ventVrsta||'').toLowerCase();
        if (ventTip.includes('mehan')) {
          C.push(p('U zgradi je predviđen mehanički sustav ventilacije s kontroliranom izmjenom zraka. Sustav osigurava minimalne protoke svježeg zraka prema zahtjevima norme HRN EN 15251 i Tehničkog propisa o racionalnoj uporabi energije i toplinskoj zaštiti u zgradama. Mehanička ventilacija omogućuje energetski učinkovito prozračivanje s minimalnim toplinskim gubicima.'));
          if ((d.ventVa||0) > 0) C.push(p('Specifični volumni protok zraka: VA = ' + d.ventVa + ' m³/(m²h).'));
        } else {
          C.push(p('U zgradi je predviđena prirodna ventilacija prostora. Prozračivanje se odvija kroz netesnost ovojnice i kontroliranim otvaranjem prozora i vrata. Sukladno Metodologiji provođenja energetskog pregleda zgrada 2021, za stambene zgrade s prirodnom ventilacijom uzima se infiltracija zraka prema izmjerenom ili procijenjenom broju izmjena zraka pri nametnutoj razlici tlaka od 50 Pa (n50 = ' + (d.zrakN50||'—') + ' h⁻¹).'));
          C.push(p('Preporuča se redovito kratko intenzivno prozračivanje prostorija (minimum 2× dnevno po 10–15 minuta) radi osiguranja kvalitete unutarnjeg zraka i sprječavanja kondenzacije i pojave plijesni.'));
        }
      }
      const imgVent = getImgFromSlot('ventilacija',436,265);
      if (imgVent) { C.push(imgVent); C.push(getImgCaption('Slika 4 – Ventilacija')); }
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

      // ── GRANA: NOVA vs POSTOJEĆA ──────────────────────────────────
      if (!isPost) {
        // ── NOVA ZGRADA: 3. PRORAČUN ──────────────────────────────
        C.push(h1('3. PRORAČUN DO PRIMARNE ENERGIJE – IZVEDENO STANJE'));
        C.push(p('Proračun je proveden prema važećoj Metodologiji provođenja energetskog pregleda zgrada 2021 i Algoritmu za izračun energetskih svojstava zgrada.'));
        C.push(gap());
        C.push(h2('3.1. Klimatski podaci lokacije'));
        C.push(tbl(['Klimatski parametar','Referentni podaci (certifikat)','Specifični podaci (lokacija)'],[
          ['Meteorološka postaja referentna',d.meteo||'—','—'],
          ['Meteorološka postaja specifična','—',d.meteoSpec||d.lokacija||'—'],
          ['Zona Sunčevog zračenja','—','—'],
          ['Θint,set,H [°C]','20,00','20,00'],
          ['Θint,set,C [°C]','24,00','24,00'],
        ],[3200,2913,2913]));
        C.push(gap());
        C.push(h2('3.2. Proračun godišnje potrebne toplinske energije za grijanje i hlađenje'));
        if (!calcHladenje) {
          C.push(p('Sukladno Metodologiji 2021, za stambene zgrade hlađenje ne ulazi u energetski proračun. Prikazuju se rezultati samo za grijanje.'));
        }
        C.push(tbl(['Energetski pokazatelj','Jed.','Max. dop.','Ref. klim.','Spec. klim.'],[
          ["QH,nd – god. topl. energija za grijanje",'kWh/a','—',d.qhndKwh||'—','—'],
          ["Q''H,nd po m² korisne površine",'kWh/(m²a)',d.qhndMax||'—',d.qhndM2||'—',d.qhndSpec||'—'],
          ...(calcHladenje ? [
            ["QC,nd – god. topl. energija za hlađenje",'kWh/a','—',d.qcndKwh||'—','—'],
            ["Q''C,nd po m² korisne površine",'kWh/(m²a)','50,00',d.qcndM2||'—','—'],
          ] : [
            ["Hlađenje – napomena",'—','—','Ne ulazi u proračun za stambene zgrade','—'],
          ]),
          ["H'tr,adj – transmisijski gubitak",'W/(m²K)',d.htrMax||'—',d.htrAdj||'—',d.htrAdj||'—'],
        ],[2800,900,1300,2013,2013]));
        C.push(gap());
        C.push(h2('3.3. Proračun godišnje potrebne toplinske energije za pripremu PTV'));
        C.push(tbl(['Energetski pokazatelj','Jed.','Vrijednost'],[
          ["Q''W – specifična godišnja potrebna toplinska energija za PTV",'kWh/(m²a)','16,00'],
          ["QW – godišnja potrebna toplinska energija za PTV",'kWh/a',d.ptvQw||'—'],
          ["AK – korisna površina grijanog dijela zgrade",'m²',d.ak||'—'],
          ["Sustav pripreme PTV",'—',d.ptvTip||'—'],
        ],[5000,900,3126]));
        C.push(gap());
        C.push(h2('3.4. Proračun godišnje potrebne energije za rasvjetu'));
        if (!calcLighting) {
          C.push(p('Sukladno fusnoti 4 Metodologije provođenja energetskog pregleda zgrada 2021, proračun godišnje potrebne energije za rasvjetu ne provodi se za zgrade stambene namjene.'));
        } else {
          C.push(p('Godišnja potrebna električna energija za rasvjetu: EL = ' + (d.rasvSnaga||'—') + ' kWh/a (' + (d.rasvSpec||'—') + ' kWh/(m²a)).'));
        }
        C.push(gap());
        C.push(h2('3.5. Proračun ukupno isporučene i primarne energije'));
        C.push(tbl(['Energetski pokazatelj','Jed.','Max. dop.','Ref. klim.','Spec. klim.'],[
          ["Edel – ukupno isporučena energija",'kWh/a','—',d.edel||'—',d.edelSpec||d.edel||'—'],
          ["Eprim – ukupna primarna energija",'kWh/a','—',d.eprim||'—',d.eprimSpec||d.eprim||'—'],
          ["E''prim po m² korisne površine",'kWh/(m²a)',d.eprimMax||'—',d.eprimM2||'—',d.eprimSpec||d.eprimM2||'—'],
          ["OIE – udio obnovljivih izvora energije",'%','≥ 30,00',d.oieUdio||'—',d.oieSpec||d.oieUdio||'—'],
          ["nZEB – ispunjava li zgrada zahtjev",'—','—',d.nzeb==='da'?'DA – nZEB':'NE',d.nzeb==='da'?'DA – nZEB':'NE'],
        ],[2800,900,1300,2013,2013]));
        C.push(gap());
        C.push(h2('3.6. Energetski razred zgrade'));
        C.push(tbl(['Kriterij (referentni klimatski podaci)','Izračunato','Max. dop.','Energetski razred'],[
          ["Q''H,nd [kWh/(m²a)]",d.qhndM2||'—',d.qhndMax||'—','RAZRED ' + (d.razredQhnd||'—')],
          ["E'prim [kWh/(m²a)]",d.eprimM2||'—',d.eprimMax||'—','RAZRED ' + (d.razredEprim||'—')],
        ],[3500,1500,1500,2526]));
        C.push(gap());
        // Graf 1: Energetski pokazatelji vs max
        try {
          const svg1 = await makeEnergyClassChart();
          const chartImg1 = await makeChart(svg1, 500, 170);
          if (chartImg1) {
            C.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:120,after:40},children:[chartImg1]}));
            C.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:120},children:[new TextRun({text:'Graf 1 – Energetski pokazatelji u odnosu na maksimalno dopuštene vrijednosti',italics:true,size:18,font:'Calibri',color:'888888'})]}));
          }
          const svg2 = await makeEnergyPieChart();
          const chartImg2 = await makeChart(svg2, 380, 190);
          if (chartImg2) {
            C.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:60,after:40},children:[chartImg2]}));
            C.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:120},children:[new TextRun({text:'Graf 2 – Struktura isporučene i primarne energije s udjelom OIE',italics:true,size:18,font:'Calibri',color:'888888'})]}));
          }
        } catch(chartErr) { console.warn('Chart error:', chartErr.message); }

        // 4. PREPORUKE
        C.push(h1('4. PREPORUKE ZA KORIŠTENJE ZGRADE'));
        C.push(p('Na temelju provedenog energetskog pregleda, za pravilno korištenje i održavanje energetski učinkovite zgrade, preporučuju se sljedeće opće mjere:'));
        C.push(gap());

        // MJERA 1
        C.push(new Paragraph({spacing:{before:120,after:40},children:[new TextRun({text:'Mjera 1 – Pravilno korištenje sustava grijanja',bold:true,size:SZ,font:FONT,color:G.dark})]}));
        ['Redovito servisiranje grijačkih uređaja prema uputama proizvođača, jednom godišnje.',
         'Termostatska regulacija unutarnje temperature po prostorijama (preporučeno 20–22 °C u sezoni grijanja).',
         'Izbjegavati dulje otvaranje prozora u sezoni grijanja. U prijelaznom periodu i ljeti koristiti prirodno prozračivanje.',
         'Ne pokrivati radijatore ili podno grijanje namještajem ili tepisima.'].forEach(t=>C.push(bullet(t)));
        C.push(gap());

        // MJERA 2
        C.push(new Paragraph({spacing:{before:120,after:40},children:[new TextRun({text:'Mjera 2 – Racionalno korištenje potrošne tople vode',bold:true,size:SZ,font:FONT,color:G.dark})]}));
        ['Temperaturu u spremniku PTV-a održavati na min. 60 °C radi zaštite od legionele.',
         'Redovita provjera brtvljenja cijevnog razvoda i stanja cirkulacijske crpke.',
         'Preferirati tuširanje kupanju u kadi – tuš troši 3× manje tople vode.',
         'Ugradnja perlata na slavine smanjuje potrošnju vode za 30–50% bez gubitka komfora.'].forEach(t=>C.push(bullet(t)));
        C.push(gap());

        // MJERA 3
        C.push(new Paragraph({spacing:{before:120,after:40},children:[new TextRun({text:'Mjera 3 – Ventilacija i kvaliteta unutarnjeg zraka',bold:true,size:SZ,font:FONT,color:G.dark})]}));
        ['Redovito prozračivanje prostorija kratkim intenzivnim otvaranjem prozora (min. 2× dnevno, 10–15 minuta).',
         'Održavati relativnu vlažnost unutarnjeg zraka između 40 i 60 % radi sprječavanja kondenzacije i plijesni.',
         'Redovito čistiti filtre ventilacijskih uređaja i rekuperatora (svakih 6–12 mjeseci).'].forEach(t=>C.push(bullet(t)));
        C.push(gap());

        // MJERA 4
        C.push(new Paragraph({spacing:{before:120,after:40},children:[new TextRun({text:'Mjera 4 – Rasvjeta i električni uređaji',bold:true,size:SZ,font:FONT,color:G.dark})]}));
        ['Koristiti isključivo LED rasvjetu energetskog razreda A ili višeg (ušteda 80% u odnosu na žarulje).',
         'Ugraditi senzore pokreta u zajedničkim prostorima (stubište, hodnici, ostave).',
         'Koristiti kućanske uređaje energetskog razreda A+++ ili višeg te isključivati uređaje iz standby moda.',
         'Koristiti višestruke utičnice s prekidačem za eliminaciju "phantom load" potrošnje.'].forEach(t=>C.push(bullet(t)));
        C.push(gap());

        // MJERA 5
        C.push(new Paragraph({spacing:{before:120,after:40},children:[new TextRun({text:'Mjera 5 – Održavanje građevinske ovojnice',bold:true,size:SZ,font:FONT,color:G.dark})]}));
        ['Vizualnim pregledom jednom godišnje kontrolirati stanje toplinske izolacije, brtvi stolarije i pokrovnog sloja krovova.',
         'Oštećenja žbuke i toplinsko-izolacijskog sustava sanirati odmah radi sprječavanja prodora vlage.',
         'Kontrolirati ispravnost i stanje roletnih kutija, roletnih traka i brtvi prozora i vrata.',
         'Redovito provjeravati stanje dilatacijskih spojeva i hidroizolacije.'].forEach(t=>C.push(bullet(t)));

        // Dodatne mjere iz forme
        if (State.measures && State.measures.length > 0) {
          C.push(gap());
          C.push(h3('Dodatne preporučene mjere'));
          State.measures.forEach(m => {
            C.push(bullet((m.sifra ? m.sifra + ' – ' : '') + m.opis));
          });
        }
        if (d.preporukeUvod) { C.push(gap()); C.push(p(d.preporukeUvod)); }

        // 5. ZRAKOPROPUSNOST
        C.push(h1('5. ZRAKOPROPUSNOST'));
        C.push(tbl(['Parametar ispitivanja','Vrijednost'],[
          ['Izvoditelj ispitivanja',d.zrakIzv||'Nora inženjering d.o.o., Pula'],
          ['Primijenjena norma',d.zrakNorma||'HRN EN ISO 9972:2015, metoda 1'],
          ['Rezultat ispitivanja – n50','n50 = ' + (d.zrakN50||'—') + ' h⁻¹'],
          ['Maksimalno dopuštena vrijednost','n50 ≤ ' + (d.zrakMax||'3,00') + ' h⁻¹'],
          ['Datum ispitivanja',d.zrakDatum||'—'],
          ['Ocjena',d.zrakOcj||'ZADOVOLJAVA'],
        ],[4500,4526]));
        C.push(gap());
        C.push(p('Izmjerena vrijednost zrakopropusnosti n50 = ' + (d.zrakN50||'—') + ' h⁻¹ ' + (d.zrakOcj==='ZADOVOLJAVA'?'zadovoljava':'ne zadovoljava') + ' propisanu maksimalnu vrijednost od n50 ≤ ' + (d.zrakMax||'3,00') + ' h⁻¹ za nove stambene zgrade prema čl. 21. Tehničkog propisa o racionalnoj uporabi energije i toplinskoj zaštiti u zgradama (NN 128/15).'));

        // 6. ZAKLJUČAK (nova)
        C.push(h1('6. ZAKLJUČAK'));

      } else {
        // ── POSTOJEĆA ZGRADA: 3. ENERGETSKA ANALIZA ──────────────
        C.push(h1('3. ENERGETSKA ANALIZA'));
        C.push(p('Energetska analiza provedena je na temelju prikupljenih računa za energiju i vodu za prethodne tri (3) uzastopne kalendarske godine.'));
        if (d.racuniEl?.length) {
          C.push(h2('3.1. Potrošnja električne energije'));
          C.push(tbl(['Godina','Potrošnja [kWh]','Troškovi [EUR]','Spec. [kWh/m²a]'],
            (d.racuniEl||[]).map(r=>[r?.godina||'',r?.potrosnja||'',r?.troskovi||'',r?.spec||'']),[1500,2509,2509,2508]));
          if (d.modelEl) C.push(p(d.modelEl));
        }
        if (d.racuniVoda?.length) {
          C.push(h2('3.2. Potrošnja vode'));
          C.push(tbl(['Godina','Potrošnja [m³]','Troškovi [EUR]','Spec. [l/dan]'],
            (d.racuniVoda||[]).map(r=>[r?.godina||'',r?.potrosnja||'',r?.troskovi||'',r?.spec||'']),[1500,2509,2509,2508]));
          if (d.modelVoda) C.push(p(d.modelVoda));
        }
        if (d.racuniTop?.length) {
          C.push(h2('3.3. Potrošnja toplinske energije'));
          C.push(p('Energent: ' + (d.energent||'—')));
          C.push(tbl(['Godina','Potrošnja [kWh ili m³]','Troškovi [EUR]','Spec. [kWh/m²a]'],
            (d.racuniTop||[]).map(r=>[r?.godina||'',r?.potrosnja||'',r?.troskovi||'',r?.spec||'']),[1500,2509,2509,2508]));
          if (d.modelTop) C.push(p(d.modelTop));
        }

        // 4. PRORAČUN (postojeća)
        C.push(h1('4. PRORAČUN DO PRIMARNE ENERGIJE – POSTOJEĆE STANJE'));
        C.push(tbl(['Energetski pokazatelj','Jed.','Max. dop.','Ref. klim.','Spec. klim.'],[
          ["Q''H,nd",'kWh/(m²a)',d.qhndMax||'—',d.qhndRefPost||d.qhndM2||'—',d.qhndSpecPost||'—'],
          ["E'prim",'kWh/(m²a)',d.eprimMax||'—',d.eprimRefPost||d.eprimM2||'—',d.eprimSpecPost||'—'],
          ["OIE udio",'%','≥ 30,00',d.oieRefPost||d.oieUdio||'—','—'],
        ],[2800,900,1300,2013,2013]));
        C.push(gap());
        C.push(tbl(['Kriterij','Izračunato','Max. dop.','Energetski razred'],[
          ["Q''H,nd [kWh/(m²a)]",d.qhndRefPost||d.qhndM2||'—',d.qhndMax||'—','RAZRED ' + (d.razredQhnd||'—')],
          ["E'prim [kWh/(m²a)]",d.eprimRefPost||d.eprimM2||'—',d.eprimMax||'—','RAZRED ' + (d.razredEprim||'—')],
        ],[3500,1500,1500,2526]));

        // 5. MJERE (postojeća)
        C.push(h1('5. PRIJEDLOG MJERA POVEĆANJA ENERGETSKE UČINKOVITOSTI'));
        if (d.preporukeUvod) C.push(p(d.preporukeUvod));
        C.push(gap());
        C.push(h3('5.1. Opće mjere gospodarenja energijom'));
        ['Redovito servisiranje svih energetskih sustava prema uputama proizvođača.',
         'Termostatska regulacija temperature grijanja i hlađenja.',
         'Racionalno korištenje potrošne tople vode.',
         'Zamjena konvencionalne rasvjete LED rasvjetom.',
         'Redovito održavanje i provjera stanja toplinske ovojnice.'].forEach(t=>C.push(bullet(t)));
        if (State.measures && State.measures.length > 0) {
          C.push(gap());
          C.push(h3('5.2. Tehničke mjere'));
          C.push(tbl(['Mjera','Opis','Ušteda energije','Investicija [EUR]','Povrat [god.]'],
            (State.measures||[]).map(m=>[m?.sifra||'',m?.opis||'',m?.usteda||'',m?.invest||'',m?.povrat||'']),
            [700,2800,1700,1700,2126]));
        }

        // 6. ZAKLJUČAK (postojeća)
        C.push(h1('6. ZAKLJUČAK'));
      }

      // ── ZAKLJUČAK (zajednički) ────────────────────────────────────
      // ── ZAKLJUČAK ─────────────────────────────────────────────────
      if (d.zakljucak) {
        d.zakljucak.split('\n').filter(Boolean).forEach(ln=>C.push(p(ln)));
      } else {
        C.push(p('Na temelju provedenog energetskog pregleda ' + (d.gradjevina||'zgrade') + ' na lokaciji ' + (d.lokacija||'—') + ', utvrđeno je sljedeće:'));
        C.push(gap());
        C.push(p('Zgrada je svrstana u energetski razred ' + (d.razredQhnd||'—') + ' prema godišnjoj potrebnoj toplinskoj energiji za grijanje (Q\'\' H,nd) = ' + (d.qhndM2||d.qhndRefPost||'—') + ' kWh/(m²a) (max. dopušteno: ' + (d.qhndMax||'—') + ' kWh/(m²a)).'));
        C.push(p('Zgrada je svrstana u energetski razred ' + (d.razredEprim||'—') + ' prema godišnjoj primarnoj energiji E\'prim = ' + (d.eprimM2||d.eprimRefPost||'—') + ' kWh/(m²a) (max. dopušteno: ' + (d.eprimMax||'—') + ' kWh/(m²a)).'));
        C.push(gap());
        C.push(p('Izvješće je izrađeno u skladu s Metodologijom provođenja energetskog pregleda zgrada 2021 (NN 48/2014, 150/2014, 08/2017, 120/2020) i važećim tehničkim propisima Republike Hrvatske.'));
      }

      // 7. PRORAČUN (KI Expert)
      const kiContent = d.kiRefRaw || State.data.kiRefRaw || '';
      if (kiContent && kiContent.length > 50) {
        const lines = kiContent.split('\n').filter(l => l.trim().length > 0);
        let paraCount = 0;
        for (const line of lines) {
          if (paraCount > 1500) break;
          const trimmed = line.trim();
          if (!trimmed || trimmed === '|') continue;
          // Detect headings: starts with 2.A., or is short all-caps, or numbered section
          const isHeading = (trimmed.startsWith('2.A.') || /^[0-9]+\.[0-9]/.test(trimmed) || (trimmed === trimmed.toUpperCase() && trimmed.length > 8 && trimmed.length < 80)) && trimmed.length < 100;
          if (isHeading) {
            C.push(new Paragraph({spacing:{before:240,after:80,line:360,lineRule:'auto'},
              children:[new TextRun({text:trimmed,bold:true,size:22,font:'Calibri',color:G.dark})]}));
          } else {
            C.push(new Paragraph({spacing:{before:0,after:40,line:260,lineRule:'auto'},
              children:[new TextRun({text:trimmed,size:19,font:'Calibri',color:G.dark})]}));
          }
          paraCount++;
        }
      } else {
        C.push(p('Napomena: Učitajte KI Expert referentni dokument na prvom koraku kako bi se sadržaj automatski umetnuo ovdje.',{color:G.light,italics:true}));
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
