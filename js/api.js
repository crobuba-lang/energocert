// ═══════════════════════════════════════════
// API.JS – Anthropic Claude API integration
// ═══════════════════════════════════════════
const API = {
  currentTarget: null,  // field id that AI result goes into

  // ── READ FILE AS TEXT ──────────────────────────────────────────────
  readFileAsText(file) {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result);
      reader.onerror = rej;
      reader.readAsText(file, 'UTF-8');
    });
  },

  readFileAsBase64(file) {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result.split(',')[1]);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
  },

  // ── ANALYZE DOCUMENTS ─────────────────────────────────────────────
  async analyzeDocuments(kiRefFile, kiSpecFile) {
    log('Učitavam KI Expert dokumente…', 'info');

    const texts = [];
    if (kiRefFile) {
      const txt = await this.readFileAsText(kiRefFile).catch(() => '[binary – cannot read as text]');
      texts.push(`=== KI EXPERT – REFERENTNI PODACI ===\n${txt.slice(0, 6000)}`);
    }
    if (kiSpecFile) {
      const txt = await this.readFileAsText(kiSpecFile).catch(() => '[binary – cannot read as text]');
      texts.push(`=== KI EXPERT – SPECIFIČNI PODACI ===\n${txt.slice(0, 6000)}`);
    }

    const combined = texts.join('\n\n');

    const prompt = `Analiziraj sljedeće KI Expert dokumente energetskog certificiranja zgrade u Republici Hrvatskoj.
Ekstrahiraj SVE dostupne podatke i vrati ISKLJUČIVO JSON objekt (bez markdown, bez objašnjenja).

DOKUMENTI:
${combined}

Vrati JSON s ovim poljima (null za nedostupne podatke):
{
  "narucitelj": null,
  "oib": null,
  "gradjevina": null,
  "lokacija": null,
  "katastar": null,
  "godina": null,
  "voditelj": null,
  "vrsta": null,
  "ak": null,
  "bruto": null,
  "oplosje": null,
  "obujam": null,
  "obujamZrak": null,
  "faktor": null,
  "procelj": null,
  "prozori": null,
  "etaze": null,
  "meteo": null,
  "tGrijanje": null,
  "tHladenje": null,
  "grijVrsta": null,
  "grijEnergent": null,
  "grijIzvor": null,
  "grijSnaga": null,
  "grijCop": null,
  "grijTijela": null,
  "grijTrv": null,
  "grijTemp": null,
  "ptvTip": null,
  "ptvVol": null,
  "ptvTemp": null,
  "ptvQw": null,
  "hladVrsta": null,
  "hladSnaga": null,
  "hladTvar": null,
  "hladEer": null,
  "ventVrsta": null,
  "ventVa": null,
  "rasvVrsta": null,
  "rasvSnaga": null,
  "rasvSpec": null,
  "qhndKwh": null,
  "qhndM2": null,
  "qhndMax": null,
  "qcndKwh": null,
  "qcndM2": null,
  "htrAdj": null,
  "htrMax": null,
  "edel": null,
  "eprim": null,
  "eprimM2": null,
  "eprimMax": null,
  "oieUdio": null,
  "oieKwh": null,
  "razredQhnd": null,
  "razredEprim": null,
  "nzeb": null,
  "qhndSpec": null,
  "eprimSpec": null,
  "edelSpec": null,
  "oieSpec": null,
  "arhProjekt": null,
  "strojProjekt": null,
  "elProjekt": null,
  "izvodac": null,
  "nadzor": null
}`;

    try {
      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) throw new Error(`API ${response.status}: ${response.statusText}`);
      const resp = await response.json();
      const text = resp.content?.find(b => b.type === 'text')?.text || '{}';
      // Clean markdown and extract JSON
      let clean = text.replace(/```json|```/g, '').trim();
      // Find JSON object in response
      const jsonStart = clean.indexOf('{');
      const jsonEnd = clean.lastIndexOf('}');
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        clean = clean.substring(jsonStart, jsonEnd + 1);
      }
      let extracted = {};
      try { extracted = JSON.parse(clean); } catch(e) {
        console.warn('JSON parse failed, using empty object:', e.message);
        extracted = {};
      }
      log('✅ Ekstrakcija podataka uspješna', 'ok');
      return extracted;

    } catch (err) {
      log('❌ API greška: ' + err.message, 'err');
      console.error(err);
      return {};
    }
  },

  // ── GENERATE TEXT ──────────────────────────────────────────────────
  async generateText(sectionKey, customPrompt) {
    const d = State.data;
    const type = State.buildingType;

    const contextMap = {
      cover: 'naslovnica i opći podaci o zgradi',
      s1: 'sažetak energetskog pregleda',
      s22: `opis konstrukcije i ovojnice: zidovi, krov, pod, stolarija`,
      grijanje: `opis sustava grijanja – vrsta: ${d.grijVrsta||'?'}, energent: ${d.grijEnergent||'?'}, izvor: ${d.grijIzvor||'?'}`,
      ptv: `opis sustava pripreme potrošne tople vode – tip: ${d.ptvTip||'?'}, volumen: ${d.ptvVol||'?'}L`,
      hladenje: `opis sustava hlađenja – vrsta: ${d.hladVrsta||'?'}`,
      ventilacija: `opis sustava ventilacije – vrsta: ${d.ventVrsta||'?'}`,
      s4: type === 'nova' ? 'preporuke za korištenje nove zgrade (bez investicijskih mjera, samo savjeti)' : 'prijedlog mjera povećanja energetske učinkovitosti postojeće zgrade',
      analiza: 'tekst energetske analize potrošnje energije i vode',
      s6: 'zaključak energetskog pregleda zgrade'
    };

    const context = `
PODACI O PROJEKTU:
- Tip zgrade: ${type === 'nova' ? 'NOVA ZGRADA' : 'POSTOJEĆA ZGRADA'}
- Naručitelj: ${d.narucitelj || '?'}
- Građevina: ${d.gradjevina || '?'}
- Lokacija: ${d.lokacija || '?'}
- Korisna površina AK: ${d.ak || '?'} m²
- Broj etaža: ${d.etaze || '?'}
- Meteorološka postaja: ${d.meteo || '?'}
- Sustav grijanja: ${d.grijVrsta || '?'}, energent: ${d.grijEnergent || '?'}
- Sustav PTV: ${d.ptvTip || '?'}
- Sustav hlađenja: ${d.hladVrsta || '?'}
- Ventilacija: ${d.ventVrsta || '?'}
- Q''H,nd: ${d.qhndM2 || '?'} kWh/(m²a), razred: ${d.razredQhnd || '?'}
- E'prim: ${d.eprimM2 || '?'} kWh/(m²a), razred: ${d.razredEprim || '?'}
- nZEB: ${d.nzeb || '?'}
- OIE udio: ${d.oieUdio || '?'} %`;

    const sectionDesc = contextMap[sectionKey] || sectionKey;
    const userQ = customPrompt || `Generiraj stručni tekst za sekciju: ${sectionDesc}`;

    const finalPrompt = `${context}

ZADATAK: ${userQ}

Napiši profesionalni stručni tekst na HRVATSKOM jeziku za Izvješće o energetskom pregledu zgrade.
Koristi terminologiju sukladnu hrvatskoj Metodologiji provođenja energetskog pregleda zgrada 2021.
Tekst treba biti koncizan, formalan i prikladan za arhivsku dokumentaciju.
NE koristi markdown formatiranje – samo čisti tekst s paragrafima.
Duljina: 2-4 paragrafa.`;

    try {
      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2000,
          messages: [{ role: 'user', content: finalPrompt }]
        })
      });

      if (!response.ok) throw new Error(`API ${response.status}`);
      const resp = await response.json();
      return resp.content?.find(b => b.type === 'text')?.text || '';
    } catch (err) {
      toast('❌ API greška: ' + err.message, 'err');
      console.error(err);
      return '';
    }
  },

  // ── AI MODAL ──────────────────────────────────────────────────────
  openModal(sectionKey, targetFieldId) {
    this.currentTarget = targetFieldId;
    this.currentSection = sectionKey;

    const defaultPrompts = {
      grijanje: 'Opiši sustav grijanja stručno i precizno na temelju unesenih podataka.',
      ptv: 'Opiši sustav pripreme potrošne tople vode.',
      hladenje: 'Opiši sustav hlađenja ili napiši da sustav nije predviđen.',
      ventilacija: 'Opiši sustav ventilacije.',
      s22: 'Opiši građevinsku ovojnicu i konstruktivni sustav zgrade.',
      s1: 'Generiraj sažetak energetskog pregleda.',
      s6: 'Generiraj zaključak energetskog pregleda.',
      s4: 'Generiraj tekst preporuka za korištenje / prijedlog mjera.',
    };

    const modal = document.getElementById('ai-modal');
    const promptEl = document.getElementById('ai-prompt');
    promptEl.value = defaultPrompts[sectionKey] || `Generiraj tekst za sekciju: ${sectionKey}`;
    document.getElementById('ai-result-wrap').classList.add('hidden');
    document.getElementById('btn-ai-insert').classList.add('hidden');
    document.getElementById('btn-ai-gen').classList.remove('hidden');
    modal.classList.remove('hidden');
  }
};

// Helper
function log(msg, type = 'info') {
  const body = document.getElementById('log-body');
  if (!body) return;
  const el = document.createElement('div');
  el.className = `log-entry ${type}`;
  el.textContent = `[${new Date().toLocaleTimeString('hr')}] ${msg}`;
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
}
