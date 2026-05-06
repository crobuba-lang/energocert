// ═══════════════════════════════════════════
// EXPORT.JS – Word document generation
// Uses docx.js from CDN
// ═══════════════════════════════════════════
const Export = {

  async generateWord() {
    const btn = document.getElementById('btn-export-word');
    btn.textContent = '⏳ Generiram...'; btn.disabled = true;

    try {
      // Load docx library
      if (!window.docx) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/docx/8.5.0/docx.umd.min.js');

      const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
              ImageRun, AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType, PageBreak } = window.docx;

      const d = State.data;
      const type = State.buildingType;
      const isPost = type === 'postojeca';

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
      const imgRun=(dataB64,w,h,mime='image/jpeg')=>{
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
      const getImgFromSlot=(slot,w,h)=>{
        const b64=Photos.getBase64(slot);
        if(!b64) return null;
        return new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:120,after:60},children:[imgRun(b64,w,h)]});
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
        ['VODITELJ ENERGETSKOG PREGLEDA',d.voditelj||'—'],
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
      if (d.opisHladenje) d.opisHladenje.split('\n').filter(Boolean).forEach(ln=>C.push(p(ln)));
      C.push(tbl(['Parametar hlađenja','Vrijednost'],[
        ['Vrsta sustava',d.hladVrsta||'—'],['Rashladna snaga [kW]',d.hladSnaga||'—'],
        ['Radna tvar',d.hladTvar||'—'],['EER / SEER',d.hladEer||'—'],
      ],[4500,4526]));
      const imgHlad = getImgFromSlot('hladenje',436,265);
      if (imgHlad) { C.push(imgHlad); C.push(getImgCaption('Slika 3 – Sustav hlađenja')); }
      C.push(gap());

      // Ventilacija
      C.push(h3('2.3.4. Opis sustava ventilacije, djelomične klimatizacije i klimatizacije'));
      if (d.opisVent) d.opisVent.split('\n').filter(Boolean).forEach(ln=>C.push(p(ln)));
      const imgVent = getImgFromSlot('ventilacija',436,265);
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
      C.push(h2('2.5. Sustavi potrošnje električne energije'));
      C.push(h3('2.5.1. Rasvjeta'));
      if (d.opisRasvjeta) C.push(p(d.opisRasvjeta));
      C.push(tbl(['Parametar rasvjete','Vrijednost'],[
        ['Vrsta rasvjetnih tijela',d.rasvVrsta||'—'],
        ['Instalirana snaga [kW]',d.rasvSnaga||'—'],
        ['Spec. instalirana snaga [W/m²]',d.rasvSpec||'—'],
        ['Senzori pokreta/daylight',d.rasvSenzori||'—'],
      ],[4500,4526]));
      const imgRasv = getImgFromSlot('rasvjeta',436,265);
      if (imgRasv) { C.push(imgRasv); C.push(getImgCaption('Slika 5 – Rasvjeta')); }
      C.push(h3('2.5.2. Ostali potrošači električne energije (kućna elektronika, kuhinjski uređaji)'));
      C.push(p('Kućanski uređaji i ostala oprema nisu zasebno proračunati u okviru energetskog certifikata. Preporuča se korištenje uređaja energetskog razreda A ili višeg.'));

      // ── GRANA: NOVA vs POSTOJEĆA ──────────────────────────────────
      if (!isPost) {
        // ── NOVA ZGRADA: 3. PRORAČUN ──────────────────────────────
        C.push(h1('3. PRORAČUN DO PRIMARNE ENERGIJE – IZVEDENO STANJE'));
        C.push(p('Proračun je proveden prema važećoj Metodologiji provođenja energetskog pregleda zgrada 2021 i Algoritmu za izračun energetskih svojstava zgrada.'));
        C.push(gap());
        C.push(h2('3.1. Klimatski podaci lokacije'));
        C.push(tbl(['Klimatski parametar','Referentni podaci','Specifični podaci'],[
          ['Meteorološka postaja',d.meteo||'—',d.meteo||'—'],
          ['Θint,set,H [°C]','20,00','20,00'],['Θint,set,C [°C]','24,00','24,00'],
        ],[3200,2913,2913]));
        C.push(gap());
        C.push(h2('3.2. Proračun godišnje potrebne toplinske energije za grijanje i hlađenje'));
        C.push(tbl(['Energetski pokazatelj','Jed.','Max. dop.','Ref. klim.','Spec. klim.'],[
          ["QH,nd",'kWh/a','—',d.qhndKwh||'—','—'],
          ["Q''H,nd",'kWh/(m²a)',d.qhndMax||'—',d.qhndM2||'—',d.qhndSpec||'—'],
          ["QC,nd",'kWh/a','—',d.qcndKwh||'—','—'],
          ["Q''C,nd",'kWh/(m²a)','50,00',d.qcndM2||'—','—'],
          ["H'tr,adj",'W/(m²K)',d.htrMax||'—',d.htrAdj||'—',d.htrAdj||'—'],
        ],[2800,900,1300,2013,2013]));
        C.push(gap());
        C.push(h2('3.3. Proračun godišnje potrebne toplinske energije za pripremu PTV'));
        C.push(tbl(['Energetski pokazatelj','Jed.','Vrijednost'],[
          ["Q''W specifična",'kWh/(m²a)','16,00'],
          ["QW godišnja",'kWh/a',d.ptvQw||'—'],["AK",'m²',d.ak||'—'],
        ],[4500,1200,3326]));
        C.push(gap());
        C.push(h2('3.4. Proračun godišnje potrebne energije za rasvjetu'));
        C.push(p('Proračun godišnje potrebne energije za rasvjetu ne provodi se za zgrade stambene namjene sukladno fusnoti 4 Metodologije 2021.'));
        C.push(gap());
        C.push(h2('3.5. Proračun ukupno isporučene i primarne energije'));
        C.push(tbl(['Energetski pokazatelj','Jed.','Max. dop.','Ref. klim.','Spec. klim.'],[
          ["Edel",'kWh/a','—',d.edel||'—',d.edelSpec||'—'],
          ["Eprim",'kWh/a','—',d.eprim||'—','—'],
          ["E'prim",'kWh/(m²a)',d.eprimMax||'—',d.eprimM2||'—',d.eprimSpec||'—'],
          ["OIE udio",'%','≥ 30,00',d.oieUdio||'—',d.oieSpec||'—'],
          ["nZEB",'—','—',d.nzeb==='da'?'DA – nZEB':'NE','—'],
        ],[2800,900,1300,2013,2013]));
        C.push(gap());
        C.push(h2('3.6. Energetski razred zgrade'));
        C.push(tbl(['Kriterij (referentni klim. podaci)','Izračunato','Max. dop.','Energetski razred'],[
          ["Q''H,nd [kWh/(m²a)]",d.qhndM2||'—',d.qhndMax||'—',`RAZRED ${d.razredQhnd||'—'}`],
          ["E'prim [kWh/(m²a)]",d.eprimM2||'—',d.eprimMax||'—',`RAZRED ${d.razredEprim||'—'}`],
        ],[3500,1500,1500,2526]));

        // 4. PREPORUKE (nova)
        C.push(h1('4. PREPORUKE ZA KORIŠTENJE ZGRADE'));
        if (d.preporukeUvod) C.push(p(d.preporukeUvod));
        C.push(gap());
        C.push(h3('Grijanje i hlađenje:'));
        ['Redovito servisiranje grijačkih uređaja prema uputama proizvođača (jednom godišnje).',
         'Termostatska regulacija unutarnje temperature po prostorijama (preporučeno 20–22 °C u sezoni grijanja).',
         'Izbjegavati dulje otvaranje prozora u sezoni grijanja. U ljetnom periodu koristiti rolete.'].forEach(t=>C.push(bullet(t)));
        C.push(gap());
        C.push(h3('Potrošna topla voda:'));
        ['Temperaturu u spremniku PTV-a održavati na min. 60 °C radi zaštite od legionele.',
         'Redovita provjera brtvljenja cijevnog razvoda i stanja cirkulacijske crpke.',
         'Preferirati tuš kupanju u kadi zbog smanjene potrošnje tople vode.'].forEach(t=>C.push(bullet(t)));
        C.push(gap());
        C.push(h3('Ventilacija i kvaliteta unutarnjeg zraka:'));
        ['Redovito prozračivanje prostorija (min. 2× dnevno, 10–15 minuta, poprečna ventilacija).',
         'Održavati relativnu vlažnost unutarnjeg zraka između 35 i 65 % radi sprječavanja kondenzacije i pojave plijesni.'].forEach(t=>C.push(bullet(t)));
        C.push(gap());
        C.push(h3('Rasvjeta i električni uređaji:'));
        ['Koristiti isključivo LED rasvjetu energetskog razreda A ili višeg.',
         'Ugraditi senzore pokreta u zajedničkim prostorima (stubište, hodnici).',
         'Koristiti kućanske uređaje energetskog razreda A ili višeg. Isključivati uređaje iz standby moda.'].forEach(t=>C.push(bullet(t)));
        C.push(gap());
        C.push(h3('Građevinska ovojnica:'));
        ['Vizualnim pregledom redovito kontrolirati stanje toplinske izolacije, brtvi stolarije i pokrovnog sloja krovova.',
         'Oštećenja žbuke i ETICS sustava sanirati odmah radi sprječavanja prodora vlage.',
         'Kontrolirati ispravnost i stanje roletnih kutija i roletnih traka.'].forEach(t=>C.push(bullet(t)));

        // 5. ZRAKOPROPUSNOST (nova)
        C.push(h1('5. ZRAKOPROPUSNOST'));
        C.push(tbl(['Parametar ispitivanja','Vrijednost'],[
          ['Izvoditelj ispitivanja',d.zrakIzv||'Nora inženjering d.o.o., Pula'],
          ['Primijenjena norma',d.zrakNorma||'HRN EN ISO 9972:2015, metoda 1'],
          ['Rezultat ispitivanja – n50',`${d.zrakN50||'—'} h⁻¹`],
          ['Maksimalno dopuštena vrijednost',`≤ ${d.zrakMax||'3,00'} h⁻¹`],
          ['Datum ispitivanja',d.zrakDatum||'—'],
          ['Ocjena',d.zrakOcj||'ZADOVOLJAVA'],
        ],[4500,4526]));
        C.push(gap());
        C.push(p(`Izmjerena vrijednost zrakopropusnosti n50 = ${d.zrakN50||'—'} h⁻¹ ${d.zrakOcj==='ZADOVOLJAVA'?'zadovoljava':'ne zadovoljava'} propisanu maksimalnu vrijednost od ${d.zrakMax||'3,00'} h⁻¹ za nove stambene zgrade prema TPRUETZZ.`));

        // 6. ZAKLJUČAK (nova)
        C.push(h1('6. ZAKLJUČAK'));

      } else {
        // ── POSTOJEĆA ZGRADA: 3. ENERGETSKA ANALIZA ──────────────
        C.push(h1('3. ENERGETSKA ANALIZA'));
        C.push(p('Energetska analiza provedena je na temelju prikupljenih računa za energiju i vodu za prethodne tri (3) uzastopne kalendarske godine.'));

        if (d.racuniEl?.length) {
          C.push(h2('3.1. Analiza i modeliranje potrošnje električne energije'));
          C.push(h3('3.1.1. Analiza računa za električnu energiju'));
          C.push(tbl(['Godina','Potrošnja [kWh]','Troškovi [EUR]','Spec. [kWh/m²a]'],
            (d.racuniEl||[]).map(r=>[r?.godina||'',r?.potrosnja||'',r?.troskovi||'',r?.spec||'']),[1500,2509,2509,2508]));
          if (d.modelEl) C.push(p(d.modelEl));
        }
        if (d.racuniVoda?.length) {
          C.push(h2('3.2. Analiza i modeliranje potrošnje vode'));
          C.push(tbl(['Godina','Potrošnja [m³]','Troškovi [EUR]','Spec. [l/dan]'],
            (d.racuniVoda||[]).map(r=>[r?.godina||'',r?.potrosnja||'',r?.troskovi||'',r?.spec||'']),[1500,2509,2509,2508]));
          if (d.modelVoda) C.push(p(d.modelVoda));
        }
        if (d.racuniTop?.length) {
          C.push(h2('3.3. Analiza i modeliranje potrošnje toplinske energije'));
          C.push(p(`Energent: ${d.energent||'—'}`));
          C.push(tbl(['Godina','Potrošnja [kWh ili m³]','Troškovi [EUR]','Spec. [kWh/m²a]'],
            (d.racuniTop||[]).map(r=>[r?.godina||'',r?.potrosnja||'',r?.troskovi||'',r?.spec||'']),[1500,2509,2509,2508]));
          if (d.modelTop) C.push(p(d.modelTop));
        }

        // 4. PRORAČUN (postojeća)
        C.push(h1('4. PRORAČUN DO PRIMARNE ENERGIJE – POSTOJEĆE STANJE'));
        C.push(h2('4.2. Proračun godišnje potrebne toplinske energije za grijanje i hlađenje'));
        C.push(tbl(['Energetski pokazatelj','Jed.','Max. dop.','Ref. klim.','Spec. klim.'],[
          ["Q''H,nd",'kWh/(m²a)',d.qhndMax||'—',d.qhndRefPost||d.qhndM2||'—',d.qhndSpecPost||'—'],
          ["Q''C,nd",'kWh/(m²a)','50,00','—','—'],
          ["H'tr,adj",'W/(m²K)',d.htrMax||'—',d.htrAdj||'—',d.htrAdj||'—'],
        ],[2800,900,1300,2013,2013]));
        C.push(gap());
        C.push(h2('4.5. Proračun ukupno isporučene i primarne energije'));
        C.push(tbl(['Energetski pokazatelj','Jed.','Max. dop.','Ref. klim.','Spec. klim.'],[
          ["Edel",'kWh/a','—',d.edelRefPost||d.edel||'—','—'],
          ["E'prim",'kWh/(m²a)',d.eprimMax||'—',d.eprimRefPost||d.eprimM2||'—',d.eprimSpecPost||'—'],
          ["OIE udio",'%','≥ 30,00',d.oieRefPost||d.oieUdio||'—','—'],
        ],[2800,900,1300,2013,2013]));
        C.push(gap());
        C.push(h2('4.6. Energetski razred zgrade'));
        C.push(tbl(['Kriterij','Izračunato','Max. dop.','Energetski razred'],[
          ["Q''H,nd [kWh/(m²a)]",d.qhndRefPost||d.qhndM2||'—',d.qhndMax||'—',`RAZRED ${d.razredQhnd||'—'}`],
          ["E'prim [kWh/(m²a)]",d.eprimRefPost||d.eprimM2||'—',d.eprimMax||'—',`RAZRED ${d.razredEprim||'—'}`],
        ],[3500,1500,1500,2526]));

        // 5. PRIJEDLOG MJERA (postojeća)
        C.push(h1('5. PRIJEDLOG MJERA POVEĆANJA ENERGETSKE UČINKOVITOSTI'));
        if (d.preporukeUvod) C.push(p(d.preporukeUvod));
        C.push(gap());
        C.push(h2('5.1. Gospodarenje energijom'));
        C.push(h3('Grijanje i hlađenje:'));
        ['Redovito servisiranje sustava grijanja i hlađenja prema uputama proizvođača (jednom godišnje).',
         'Termostatska regulacija unutarnje temperature po prostorijama.',
         'Izbjegavati dulje otvaranje prozora u sezoni grijanja.'].forEach(t=>C.push(bullet(t)));

        if (State.measures.length) {
          C.push(gap());
          C.push(h2('5.2. Prijedlog mjera u građevinskom dijelu'));
          const mRows = (State.measures||[]).map(m=>[m?.sifra||'',m?.opis||'',m?.usteda||'',m?.invest||'',m?.povrat||'']);
          C.push(tbl(['Mjera','Opis mjere','Ušteda energije','Investicija [EUR]','Povrat [god.]'],mRows,[700,2800,1700,1700,2126]));
        }

        // 6. ZAKLJUČAK (postojeća)
        C.push(h1('6. ZAKLJUČAK'));
      }

      // Zaključak (zajednički)
      if (d.zakljucak) d.zakljucak.split('\n').filter(Boolean).forEach(ln=>C.push(p(ln)));
      else {
        C.push(p(`Na temelju provedenog energetskog pregleda ${d.gradjevina||'zgrade'} na lokaciji ${d.lokacija||'—'} utvrđeno je sljedeće:`));
        C.push(gap());
        C.push(p(`Zgrada je energetskog razreda ${d.razredQhnd||'—'} prema Q''H,nd i razreda ${d.razredEprim||'—'} prema E'prim.`));
        C.push(gap());
        C.push(p('Izvješće je izrađeno u skladu s Metodologijom provođenja energetskog pregleda zgrada 2021 i važećim tehničkim propisima RH.'));
      }

      // 7. PRORAČUN (KI Expert)
      const chNum = isPost ? '7' : '7';
      C.push(h1(`${chNum}. PRORAČUN`));
      C.push(tbl(['Propis / Norma','Napomena'],[
        ['Metodologija provođenja energetskog pregleda zgrada 2021','NN 48/2014, 150/2014, 08/2017, 120/20'],
        ['Algoritam za izračun energetskih svojstava zgrade','MGIPU, verzija u primjeni'],
        ['HRN EN ISO 6946:2017','Toplinski otpor i koeficijent prolaska topline'],
        ['HRN EN ISO 13790:2008','Proračun potrebne energije za grijanje i hlađenje'],
        ['HRN EN 15316-1 do 4','Proračun od korisne do primarne energije'],
        ['HRN EN ISO 13370:2017','Gubici topline prema tlu'],
        ['HRN EN ISO 14683:2017','Toplinski mostovi'],
      ],[4500,4526]));
      if (d.kiNapomena) { C.push(gap()); C.push(p(d.kiNapomena)); }
      C.push(gap());
      C.push(p('[Zalijepiti ispis iz KI Expert programa – poglavlja 1. Tehnički opis do 2.A.6.8. Fotonaponski sustavi]',{color:G.light,italics:true}));

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

      const buf = await Packer.toBuffer(doc);
      const blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
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
