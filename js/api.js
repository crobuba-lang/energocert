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

    // Use server-side Python parser for accurate table extraction
    if (kiRefFile) {
      try {
        log('Šaljem KI Expert referentni na server za parsiranje...', 'info');
        const formData = new FormData();
        formData.append('file', kiRefFile, kiRefFile.name);

        const parseResp = await fetch(window.location.origin + '/api/parse-docx', {
          method: 'POST',
          body: formData
        });

        if (parseResp.ok) {
          const parsed = await parseResp.json();
          if (!parsed.error) {
            log('✅ Server parsiranje uspješno – ' + Object.keys(parsed).length + ' polja', 'ok');
            if (parsed.kiRefRaw) {
              State.data.kiRefRaw = parsed.kiRefRaw;
              delete parsed.kiRefRaw;
            }
            return parsed;
          } else {
            log('Server parse greška: ' + parsed.error + ' – probavam AI...', 'info');
          }
        }
      } catch(e) {
        log('Server parse nedostupan: ' + e.message + ' – probavam AI...', 'info');
      }
    }

    // Fallback: AI-based extraction (less accurate for table-heavy docs)
    log('Koristim AI ekstrakciju (fallback)...', 'info');

    let refText = '';
    let specText = '';

    if (kiRefFile) {
      refText = await this.readFileAsText(kiRefFile).catch(() => '');
      State.data.kiRefRaw = refText.slice(0, 80000);
      log('Referentni dokument učitan: ' + refText.length + ' znakova', 'info');
    }
    if (kiSpecFile) {
      specText = await this.readFileAsText(kiSpecFile).catch(() => '');
      log('Specifični dokument učitan: ' + specText.length + ' znakova', 'info');
    }

    const combined = (refText + '\n\n' + specText).slice(0, 14000);

    // Very specific extraction prompt
    const prompt =
      'Iz sljedeceg KI Expert dokumenta tocno procitaj i izvuci podatke.\n' +
      'Vrati SAMO JSON objekt, bez teksta prije ili poslije.\n\n' +
      'DOKUMENT:\n' + combined + '\n\n' +
      'PRAVILA EKSTRAKCIJE:\n' +
      '1. Za tablicu koeficijenata (odjeljak "Proracun gradevinskih dijelova" ili "2.A.1."):\n' +
      '   - Izvuci SVE redove: naziv, A [m2], U [W/m2K], Umax [W/m2K]\n' +
      '   - Primjer retka: "Vanjski zidovi 1 - obloga kamen | 65.53 | 0.23 | 0.45"\n' +
      '2. Za energetske rezultate (odjeljak "Rezultati proracuna" ili "2.A.5.4."):\n' +
      '   - QHnd: trazi "Q H,nd = X [kWh/a]"\n' +
      '   - QHndM2: trazi "Q\'\' H,nd = X (max = Y) [kWh/m2 a]"\n' +
      '   - QHndMax: uzmi vrijednost u zagradi max = Y\n' +
      '   - Eprim: trazi "E prim = X [kWh/a]"\n' +
      '   - EprimM2: trazi "E\'\' prim = X (max = Y) [kWh/m2 a]"\n' +
      '   - EprimMax: uzmi Y iz zagrade\n' +
      '   - Edel: trazi "E del = X [kWh/a]"\n' +
      '   - HtrAdj: trazi "H\' tr,adj = X (max = Y) [W/m2 K]"\n' +
      '3. Za n50: trazi redak "Broj izmjena zraka pri nametnutoj razlici tlaka od 50 Pa"\n' +
      '   - Vrijednost je n50 = X.XX ili samo broj uz [h-1]\n' +
      '4. Za OIE: trazi "Udio obnovljivih izvora" ili "%"\n\n' +
      'Vrati JSON tocno ovog oblika (sve vrijednosti kao stringovi ili null):\n' +
      '{\n' +
      '  "narucitelj": null,\n' +
      '  "oib": null,\n' +
      '  "gradjevina": null,\n' +
      '  "lokacija": null,\n' +
      '  "katastar": null,\n' +
      '  "godina": null,\n' +
      '  "vrsta": null,\n' +
      '  "ak": null,\n' +
      '  "oplosje": null,\n' +
      '  "obujam": null,\n' +
      '  "obujamZrak": null,\n' +
      '  "faktor": null,\n' +
      '  "procelj": null,\n' +
      '  "prozori": null,\n' +
      '  "etaze": null,\n' +
      '  "meteo": null,\n' +
      '  "uvalues": [\n' +
      '    {"naziv": "Vanjski zidovi 1 - obloga kamen", "area": "65.53", "u": "0.23", "umax": "0.45", "provjera": "ZADOVOLJAVA"}\n' +
      '  ],\n' +
      '  "grijVrsta": null,\n' +
      '  "grijEnergent": null,\n' +
      '  "grijIzvor": null,\n' +
      '  "grijSnaga": null,\n' +
      '  "grijCop": null,\n' +
      '  "grijTijela": null,\n' +
      '  "grijTrv": null,\n' +
      '  "grijTemp": null,\n' +
      '  "ptvTip": null,\n' +
      '  "ptvVol": null,\n' +
      '  "ptvTemp": null,\n' +
      '  "ptvQw": null,\n' +
      '  "hladVrsta": null,\n' +
      '  "hladSnaga": null,\n' +
      '  "hladTvar": null,\n' +
      '  "hladEer": null,\n' +
      '  "ventVrsta": null,\n' +
      '  "ventVa": null,\n' +
      '  "rasvVrsta": null,\n' +
      '  "rasvSnaga": null,\n' +
      '  "rasvSpec": null,\n' +
      '  "qhndKwh": null,\n' +
      '  "qhndM2": null,\n' +
      '  "qhndMax": null,\n' +
      '  "qcndKwh": null,\n' +
      '  "qcndM2": null,\n' +
      '  "htrAdj": null,\n' +
      '  "htrMax": null,\n' +
      '  "edel": null,\n' +
      '  "eprim": null,\n' +
      '  "eprimM2": null,\n' +
      '  "eprimMax": null,\n' +
      '  "oieUdio": null,\n' +
      '  "oieKwh": null,\n' +
      '  "razredQhnd": null,\n' +
      '  "razredEprim": null,\n' +
      '  "nzeb": null,\n' +
      '  "qhndSpec": null,\n' +
      '  "eprimSpec": null,\n' +
      '  "edelSpec": null,\n' +
      '  "oieSpec": null,\n' +
      '  "zrakN50": null,\n' +
      '  "arhProjekt": null,\n' +
      '  "strojProjekt": null,\n' +
      '  "elProjekt": null,\n' +
      '  "izvodac": null,\n' +
      '  "nadzor": null,\n' +
      '  "opisKonstrukcije": null\n' +
      '}';

    try {
      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) throw new Error('API ' + response.status);
      const resp = await response.json();
      const text = (resp.content && resp.content[0]) ? resp.content[0].text : '{}';

      // Extract JSON from response
      let clean = text.replace(/```json|```/g, '').trim();
      const s = clean.indexOf('{');
      const e = clean.lastIndexOf('}');
      if (s >= 0 && e > s) clean = clean.substring(s, e + 1);

      let extracted = {};
      try {
        extracted = JSON.parse(clean);
        log('Podaci uspješno ekstrahirani', 'ok');
      } catch(err) {
        log('JSON parse upozorenje: ' + err.message, 'info');
        // Try to extract partial data
        extracted = {};
      }

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
      return '  ' + (u.naziv||'') + ': A=' + (u.area||'') + 'm2, U=' + (u.u||'') + ' W/m2K (max ' + (u.umax||'') + ')';
    }).join('\n') || '  nisu dostupni';

    const context =
      'PODACI IZ KI EXPERT IZVJESTAJA:\n' +
      'Tip: ' + (type === 'nova' ? 'NOVA ZGRADA' : 'POSTOJECA ZGRADA') + '\n' +
      'Gradjevina: ' + (d.gradjevina || '?') + '\n' +
      'Lokacija: ' + (d.lokacija || '?') + '\n' +
      'AK: ' + (d.ak || '?') + ' m2, Etaze: ' + (d.etaze || '?') + '\n' +
      'Meteo: ' + (d.meteo || '?') + '\n\n' +
      'KOEFICIJENTI PROLASKA TOPLINE:\n' + uvalStr + '\n\n' +
      'TERMOTEHNICKI SUSTAVI:\n' +
      '- Grijanje: ' + (d.grijVrsta||'?') + ', ' + (d.grijEnergent||'?') + ', ' + (d.grijIzvor||'?') + '\n' +
      '- Snaga: ' + (d.grijSnaga||'?') + ' kW, COP/SCOP: ' + (d.grijCop||'?') + '\n' +
      '- Ogrijev. tijela: ' + (d.grijTijela||'?') + ', TRV: ' + (d.grijTrv||'?') + '\n' +
      '- PTV: ' + (d.ptvTip||'?') + ', vol. ' + (d.ptvVol||'?') + 'L, QW=' + (d.ptvQw||'?') + ' kWh/a\n' +
      '- Hladenje: ' + (d.hladVrsta||'?') + ', EER=' + (d.hladEer||'?') + '\n' +
      '- Ventilacija: ' + (d.ventVrsta||'?') + '\n\n' +
      'ENERGETSKI REZULTATI:\n' +
      '- QHnd: ' + (d.qhndM2||'?') + ' kWh/m2a [max ' + (d.qhndMax||'?') + '], razred: ' + (d.razredQhnd||'?') + '\n' +
      '- Eprim: ' + (d.eprimM2||'?') + ' kWh/m2a [max ' + (d.eprimMax||'?') + '], razred: ' + (d.razredEprim||'?') + '\n' +
      '- Edel: ' + (d.edel||'?') + ' kWh/a, Eprim ukupno: ' + (d.eprim||'?') + ' kWh/a\n' +
      '- OIE: ' + (d.oieUdio||'?') + '%, nZEB: ' + (d.nzeb||'?') + '\n' +
      '- n50: ' + (d.zrakN50||'?') + ' h-1\n\n' +
      'OPIS KONSTRUKCIJE:\n' + (d.opisKonstrukcije || d.opisKonstr || 'nije dostupno');

    const sectionNames = {
      s1: 'sazetak energetskog pregleda',
      s22: 'opis gradjevinske ovojnice - nosivi zidovi, izolacija, krov, pod, stolarija, na temelju slojeva iz KI Expert',
      grijanje: 'strucni opis sustava grijanja',
      ptv: 'strucni opis sustava pripreme potrosne tople vode',
      hladenje: 'strucni opis sustava hladenja (ili napomena da nije predvidjen)',
      ventilacija: 'strucni opis sustava ventilacije',
      s4: type === 'nova' ? 'preporuke za koristenje nove zgrade bez investicijskih mjera' : 'prijedlog mjera povecanja energetske ucinkovitosti',
      s6: 'zakljucak energetskog pregleda'
    };

    const finalPrompt =
      context + '\n\n' +
      'ZADATAK: Generiraj strucni tekst na HRVATSKOM jeziku za: ' +
      (customPrompt || sectionNames[sectionKey] || sectionKey) + '\n\n' +
      'PRAVILA:\n' +
      '- Koristi iskljucivo podatke iz KI Expert izvjestaja navedene gore\n' +
      '- NE izmisljaj vrijednosti koje nisu navedene\n' +
      '- Tekst treba biti koncizan, formalan, 2-4 paragrafa\n' +
      '- NE koristi markdown formatiranje (bez **, bez #)\n' +
      '- Pisi u skladu s Metodologijom provođenja energetskog pregleda zgrada 2021';

    try {
      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini',
          max_tokens: 2000,
          messages: [{ role: 'user', content: finalPrompt }]
        })
      });

      if (!response.ok) throw new Error('API ' + response.status);
      const resp = await response.json();
      return (resp.content && resp.content[0]) ? resp.content[0].text : '';
    } catch (err) {
      toast('AI greška: ' + err.message, 'err');
      return '';
    }
  },

  openModal(sectionKey, targetFieldId) {
    this.currentTarget = targetFieldId;
    this.currentSection = sectionKey;

    const defaults = {
      s1: 'Generiraj sažetak energetskog pregleda na temelju KI Expert podataka.',
      s22: 'Opiši građevinsku ovojnicu i konstruktivni sustav na temelju slojeva opisanih u KI Expert dokumentu.',
      grijanje: 'Opiši sustav grijanja stručno i precizno.',
      ptv: 'Opiši sustav pripreme potrošne tople vode.',
      hladenje: 'Opiši sustav hlađenja ili napiši da nije predviđen centralni sustav.',
      ventilacija: 'Opiši sustav ventilacije.',
      s4: 'Generiraj preporuke za korištenje zgrade.',
      s6: 'Generiraj zaključak energetskog pregleda.'
    };

    document.getElementById('ai-prompt').value = defaults[sectionKey] || ('Generiraj tekst za: ' + sectionKey);
    document.getElementById('ai-result-wrap').classList.add('hidden');
    document.getElementById('btn-ai-insert').classList.add('hidden');
    document.getElementById('btn-ai-gen').classList.remove('hidden');
    document.getElementById('ai-modal').classList.remove('hidden');
  }
};
