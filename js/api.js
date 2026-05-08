// ── LOG HELPER ────────────────────────────────────────────────────
function log(msg, type) {
  const body = document.getElementById('log-body');
  if (!body) { console.log(msg); return; }
  const el = document.createElement('div');
  el.className = 'log-entry ' + (type || 'info');
  el.textContent = '[' + new Date().toLocaleTimeString('hr') + '] ' + msg;
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
}

// ── API ────────────────────────────────────────────────────────────
const API = {
  currentTarget: null,
  currentSection: null,

  readFileAsText(file) {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result);
      reader.onerror = rej;
      reader.readAsText(file, 'UTF-8');
    });
  },

  async analyzeDocuments(kiRefFile, kiSpecFile) {
    log('Učitavam KI Expert dokumente...', 'info');

    const texts = [];
    if (kiRefFile) {
      const txt = await this.readFileAsText(kiRefFile).catch(() => '[binary]');
      texts.push('=== KI EXPERT – REFERENTNI PODACI ===\n' + txt.slice(0, 6000));
      State.data.kiRefRaw = txt.slice(0, 80000);
    }
    if (kiSpecFile) {
      const txt = await this.readFileAsText(kiSpecFile).catch(() => '[binary]');
      texts.push('=== KI EXPERT – SPECIFIČNI PODACI ===\n' + txt.slice(0, 6000));
    }

    const combined = texts.join('\n\n');

    const prompt = 'Analiziraj KI Expert dokumente energetskog certificiranja zgrade u Republici Hrvatskoj.\n' +
      'Pažljivo pronađi SVAKI od navedenih podataka i vrati ISKLJUČIVO JSON objekt bez ikakvih objašnjenja.\n\n' +
      'DOKUMENTI:\n' + combined + '\n\n' +
      'NAPOMENE:\n' +
      '- U vrijednosti traži u tablicama s kolonama Naziv, A [m2], U [W/m2K]\n' +
      '- n50 traži u retku "Broj izmjena zraka pri nametnutoj razlici tlaka od 50 Pa" - n50 = X.XX [h-1]\n' +
      '- Q_H,nd traži kod "Godisnja potrebna toplinska energija za grijanje"\n' +
      '- E_prim traži kod "Primarna energija" ili "kWh/(m2a)"\n' +
      '- Edel traži kod "Isporucena energija"\n\n' +
      'Vrati JSON:\n' +
      '{"narucitelj":null,"oib":null,"gradjevina":null,"lokacija":null,' +
      '"katastar":null,"godina":null,"voditelj":null,"vrsta":null,' +
      '"ak":null,"bruto":null,"oplosje":null,"obujam":null,' +
      '"obujamZrak":null,"faktor":null,"procelj":null,"prozori":null,' +
      '"etaze":null,"meteo":null,' +
      '"uvalues":[{"naziv":"naziv","area":"A","u":"U","umax":"Umax","provjera":"ZADOVOLJAVA"}],' +
      '"grijVrsta":null,"grijEnergent":null,"grijIzvor":null,' +
      '"grijSnaga":null,"grijCop":null,"grijTijela":null,"grijTrv":null,"grijTemp":null,' +
      '"ptvTip":null,"ptvVol":null,"ptvTemp":null,"ptvQw":null,' +
      '"hladVrsta":null,"hladSnaga":null,"hladTvar":null,"hladEer":null,' +
      '"ventVrsta":null,"ventVa":null,' +
      '"rasvVrsta":null,"rasvSnaga":null,"rasvSpec":null,' +
      '"qhndKwh":null,"qhndM2":null,"qhndMax":null,' +
      '"qcndKwh":null,"qcndM2":null,' +
      '"htrAdj":null,"htrMax":null,' +
      '"edel":null,"eprim":null,"eprimM2":null,"eprimMax":null,' +
      '"oieUdio":null,"oieKwh":null,' +
      '"razredQhnd":null,"razredEprim":null,"nzeb":null,' +
      '"qhndSpec":null,"eprimSpec":null,"edelSpec":null,"oieSpec":null,' +
      '"zrakN50":null,' +
      '"arhProjekt":null,"strojProjekt":null,"elProjekt":null,' +
      '"izvodac":null,"nadzor":null,"opisKonstrukcije":null}';

    try {
      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gemini', max_tokens: 4000, messages: [{ role: 'user', content: prompt }] })
      });

      if (!response.ok) throw new Error('API ' + response.status);
      const resp = await response.json();
      const text = resp.content && resp.content[0] ? resp.content[0].text : '{}';

      let clean = text.replace(/```json|```/g, '').trim();
      const jsonStart = clean.indexOf('{');
      const jsonEnd = clean.lastIndexOf('}');
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        clean = clean.substring(jsonStart, jsonEnd + 1);
      }

      let extracted = {};
      try { extracted = JSON.parse(clean); }
      catch(e) { console.warn('JSON parse failed:', e.message); }

      log('Analiza završena', 'ok');
      return extracted;

    } catch (err) {
      log('API greška: ' + err.message, 'err');
      console.error(err);
      return {};
    }
  },

  async generateText(sectionKey, customPrompt) {
    const d = State.data;
    const type = State.buildingType;

    const uvalStr = (d.uvalues || []).map(function(u) {
      return '  ' + u.naziv + ': A=' + u.area + 'm2, U=' + u.u + ' W/m2K (max ' + u.umax + ')';
    }).join('\n') || '  nisu dostupni';

    const context = 'PODACI IZ KI EXPERT:\n' +
      'Tip: ' + (type === 'nova' ? 'NOVA' : 'POSTOJECA') + '\n' +
      'Gradjevina: ' + (d.gradjevina || '?') + '\n' +
      'Lokacija: ' + (d.lokacija || '?') + '\n' +
      'AK: ' + (d.ak || '?') + ' m2\n' +
      'Etaze: ' + (d.etaze || '?') + '\n' +
      'Meteo: ' + (d.meteo || '?') + '\n\n' +
      'KOEFICIJENTI PROLASKA TOPLINE:\n' + uvalStr + '\n\n' +
      'SUSTAVI:\n' +
      '- Grijanje: ' + (d.grijVrsta || '?') + ', ' + (d.grijEnergent || '?') + ', ' + (d.grijIzvor || '?') + '\n' +
      '- Snaga: ' + (d.grijSnaga || '?') + ' kW, COP: ' + (d.grijCop || '?') + '\n' +
      '- PTV: ' + (d.ptvTip || '?') + ', ' + (d.ptvVol || '?') + 'L\n' +
      '- Hladenje: ' + (d.hladVrsta || '?') + '\n' +
      '- Ventilacija: ' + (d.ventVrsta || '?') + '\n\n' +
      'ENERGETSKI REZULTATI:\n' +
      '- QHnd: ' + (d.qhndM2 || '?') + ' kWh/m2a, razred: ' + (d.razredQhnd || '?') + '\n' +
      '- Eprim: ' + (d.eprimM2 || '?') + ' kWh/m2a, razred: ' + (d.razredEprim || '?') + '\n' +
      '- nZEB: ' + (d.nzeb || '?') + '\n' +
      '- n50: ' + (d.zrakN50 || '?') + ' h-1\n\n' +
      'OPIS KONSTRUKCIJE:\n' + (d.opisKonstrukcije || d.opisKonstr || 'nije dostupno');

    const sectionNames = {
      cover: 'naslovnica', s1: 'sazetak', s22: 'opis gradevinske ovojnice i konstrukcije',
      grijanje: 'opis sustava grijanja', ptv: 'opis sustava PTV',
      hladenje: 'opis sustava hladenja', ventilacija: 'opis ventilacije',
      s4: 'preporuke za koriscenje', analiza: 'energetska analiza', s6: 'zakljucak'
    };

    const finalPrompt = context + '\n\nZADATAK: Generiraj strucni tekst na HRVATSKOM jeziku za: ' +
      (customPrompt || sectionNames[sectionKey] || sectionKey) + '\n\n' +
      'Tekst treba biti koncizan, formalan, 2-4 paragrafa. ' +
      'Koristi podatke iz KI Expert izvjestaja. NE izmisljaj vrijednosti. ' +
      'NE koristi markdown formatiranje.';

    try {
      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gemini', max_tokens: 2000, messages: [{ role: 'user', content: finalPrompt }] })
      });

      if (!response.ok) throw new Error('API ' + response.status);
      const resp = await response.json();
      return resp.content && resp.content[0] ? resp.content[0].text : '';
    } catch (err) {
      toast('API greska: ' + err.message, 'err');
      return '';
    }
  },

  openModal(sectionKey, targetFieldId) {
    this.currentTarget = targetFieldId;
    this.currentSection = sectionKey;

    const defaultPrompts = {
      grijanje: 'Opiši sustav grijanja stručno i precizno na temelju unesenih podataka.',
      ptv: 'Opiši sustav pripreme potrošne tople vode.',
      hladenje: 'Opiši sustav hlađenja ili napiši da sustav nije predviđen.',
      ventilacija: 'Opiši sustav ventilacije.',
      s22: 'Opiši građevinsku ovojnicu i konstruktivni sustav zgrade na temelju slojeva opisanih u KI Expert dokumentu.',
      s1: 'Generiraj sažetak energetskog pregleda.',
      s6: 'Generiraj zaključak energetskog pregleda.',
      s4: 'Generiraj tekst preporuka za korištenje zgrade.',
    };

    const modal = document.getElementById('ai-modal');
    const promptEl = document.getElementById('ai-prompt');
    promptEl.value = defaultPrompts[sectionKey] || ('Generiraj tekst za sekciju: ' + sectionKey);
    document.getElementById('ai-result-wrap').classList.add('hidden');
    document.getElementById('btn-ai-insert').classList.add('hidden');
    document.getElementById('btn-ai-gen').classList.remove('hidden');
    modal.classList.remove('hidden');
  }
};
