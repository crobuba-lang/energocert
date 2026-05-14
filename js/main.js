// ═══════════════════════════════════════════
// MAIN.JS – Application orchestration
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {

  // ── INIT ──────────────────────────────────────────────────────────
  State.load();


  setType(State.buildingType);
  populateForm(State.data);
  Photos.renderAll();

  // Auto-fill today's date if not set
  const datumEl = document.getElementById('f-datum');
  if (datumEl && !datumEl.value) {
    const today = new Date();
    datumEl.value = today.toISOString().split('T')[0];
  }

  // Autosave on input
  let saveTimer;
  document.addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      State.data = collectFormData();
      State.save();
    }, 1500);
  });

  // ── STEP NAVIGATION ───────────────────────────────────────────────
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchStep(btn.dataset.step);
      if (btn.dataset.step === 'form') populateForm(State.data);
    });
  });

  // ── BUILDING TYPE ─────────────────────────────────────────────────
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setType(btn.dataset.type);
      State.save();
    });
  });

  // ── FILE UPLOADS ──────────────────────────────────────────────────
  document.getElementById('input-ki-ref').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    State.files.kiRef = f;
    document.getElementById('info-ki-ref').textContent = `✓ ${f.name} (${(f.size/1024).toFixed(0)} KB)`;
    document.getElementById('drop-ki-ref').classList.add('has-file');
    checkCanAnalyze();
  });

  document.getElementById('input-ki-spec').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    State.files.kiSpec = f;
    document.getElementById('info-ki-spec').textContent = `✓ ${f.name} (${(f.size/1024).toFixed(0)} KB)`;
    document.getElementById('drop-ki-spec').classList.add('has-file');
  });

  // Drag & drop
  ['drop-ki-ref','drop-ki-spec'].forEach(id => {
    const zone = document.getElementById(id);
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--accent)'; });
    zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.style.borderColor = '';
      const f = e.dataTransfer.files[0];
      if (!f) return;
      const inputId = id === 'drop-ki-ref' ? 'input-ki-ref' : 'input-ki-spec';
      // Simulate file input change
      if (id === 'drop-ki-ref') {
        State.files.kiRef = f;
        document.getElementById('info-ki-ref').textContent = `✓ ${f.name}`;
        zone.classList.add('has-file');
        checkCanAnalyze();
      } else {
        State.files.kiSpec = f;
        document.getElementById('info-ki-spec').textContent = `✓ ${f.name}`;
        zone.classList.add('has-file');
      }
    });
  });

  // ── PER-SLOT PHOTO INPUTS (step 1) ───────────────────────────────
  ['cover','grijanje','ptv','hladenje','ventilacija','rasvjeta'].forEach(slot => {
    const el = document.getElementById(`inp-${slot}`);
    if (el) el.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) Photos.setSlot(slot, file).then(() => toast(`📷 ${slot} slika učitana`, 'ok'));
    });
    // Also wire the form-photos section duplicates
    const el2 = document.getElementById(`inp-${slot}-form`);
    if (el2) el2.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) Photos.setSlot(slot, file).then(() => toast(`📷 ${slot} slika zamijenjena`, 'ok'));
    });
  });

  function checkCanAnalyze() {
    document.getElementById('btn-analyze').disabled = !State.files.kiRef;
  }

  // ── ANALYZE ───────────────────────────────────────────────────────
  document.getElementById('btn-analyze').addEventListener('click', () => {
    runAnalysis().catch(err => {
      console.error('Analysis failed:', err);
      toast('❌ Greška analize: ' + err.message, 'err');
    });
  });

  async function runAnalysis() {
    switchStep('analyze');
    const btn = document.getElementById('btn-analyze');

    const steps = [
      { id: 'prog-ki-ref', label: 'KI Expert referentni – ekstrakcija podataka…' },
      { id: 'prog-ki-spec', label: 'KI Expert specifični – ekstrakcija podataka…' },
      { id: 'prog-systems', label: 'Analiza termotehničkih sustava…' },
      { id: 'prog-energy',  label: 'Određivanje energetskih razreda…' },
    ];

    // Mark all as pending
    steps.forEach(s => {
      const el = document.getElementById(s.id);
      el.classList.remove('done','running');
      el.querySelector('.prog-status').textContent = '⏳';
    });

    // Step 1: running
    document.getElementById('prog-ki-ref').classList.add('running');
    log('Početak analize…', 'info');

    const extracted = await API.analyzeDocuments(State.files.kiRef, State.files.kiSpec);

    // Merge with existing data
    Object.entries(extracted).forEach(([k,v]) => { if (v !== null && v !== undefined) State.data[k] = v; });
    populateForm(State.data);
    State.save();

    // Animate steps done
    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 400));
      const el = document.getElementById(steps[i].id);
      el.classList.remove('running'); el.classList.add('done');
      el.querySelector('.prog-status').textContent = '✅';
      log(steps[i].label.replace('…','') + ' – GOTOVO', 'ok');
      if (i + 1 < steps.length) document.getElementById(steps[i+1].id).classList.add('running');
    }

    log('✅ Analiza završena. Provjerite i dopunite podatke.', 'ok');
    document.getElementById('btn-to-form').disabled = false;
    State.analyzed = true;
  } // end runAnalysis

  document.getElementById('btn-to-form').addEventListener('click', () => {
    switchStep('form');
    // Repopulate form with latest State.data when entering form step
    populateForm(State.data);
  });
  document.getElementById('btn-back-upload').addEventListener('click', () => switchStep('upload'));
  document.getElementById('btn-back-analyze').addEventListener('click', () => switchStep('analyze'));
  document.getElementById('btn-back-form').addEventListener('click', () => switchStep('form'));
  document.getElementById('btn-back-preview').addEventListener('click', () => switchStep('preview'));

  // ── FORM NAVIGATION ───────────────────────────────────────────────
  document.querySelectorAll('.fnav-item').forEach(item => {
    item.addEventListener('click', () => switchFormSec(item.dataset.sec));
  });

  // ── U-VALUES TABLE ────────────────────────────────────────────────
  document.getElementById('btn-add-uval').addEventListener('click', () => {
    const tbody = document.getElementById('uvalues-body');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input type="text" placeholder="Naziv"></td><td><input type="number" step="0.01"></td><td><input type="number" step="0.01"></td><td><input type="number" step="0.01"></td><td><select><option>ZADOVOLJAVA</option><option>NE ZADOVOLJAVA</option></select></td><td><button class="del-row">✕</button></td>`;
    tbody.appendChild(tr);
  });

  // ── MJERE ─────────────────────────────────────────────────────────
  document.getElementById('btn-add-mjera')?.addEventListener('click', () => {
    const sifra = document.getElementById('mjera-sifra').value.trim();
    const opis  = document.getElementById('mjera-opis').value.trim();
    const usteda = document.getElementById('mjera-usteda').value.trim();
    const invest = document.getElementById('mjera-invest').value.trim();
    const povrat = document.getElementById('mjera-povrat').value.trim();
    if (!opis) { toast('Unesite opis mjere', 'err'); return; }
    const m = { id: Date.now(), sifra, opis, usteda, invest, povrat };
    State.measures.push(m);
    renderMjere();
    // Clear inputs
    ['mjera-sifra','mjera-opis','mjera-usteda','mjera-invest','mjera-povrat'].forEach(id => document.getElementById(id).value = '');
    State.save();
    toast('Mjera dodana', 'ok');
  });

  function renderMjere() {
    const list = document.getElementById('mjere-list');
    if (!list) return;
    list.innerHTML = '';
    State.measures.forEach(m => {
      const el = document.createElement('div');
      el.className = 'mjera-item';
      el.innerHTML = `<span class="mi-sifra">${m.sifra||'—'}</span><span class="mi-opis">${m.opis}</span><span style="color:var(--muted);font-size:11px">${m.invest||''}</span><button class="mi-rm" onclick="removeMjera(${m.id})">✕</button>`;
      list.appendChild(el);
    });
  }
  window.removeMjera = id => { State.measures = State.measures.filter(m => m.id !== id); renderMjere(); State.save(); };
  renderMjere();

  // ── RAČUNI TABS ───────────────────────────────────────────────────
  document.querySelectorAll('.rtab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.rtab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.rtab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`rtab-${tab.dataset.rtab}`)?.classList.add('active');
    });
  });

  // ── PHOTO MANAGEMENT ─────────────────────────────────────────────
  // Cover photo slot
  document.querySelector('[data-slot="cover"]')?.parentElement?.querySelector('input[type=file]')?.addEventListener('change', e => {
    Photos.setCover(e.target.files[0]);
    toast('Naslovna fotografija postavljena', 'ok');
  });

  document.getElementById('add-more-photos')?.addEventListener('change', e => {
    Photos.addPhotos(Array.from(e.target.files));
    toast(`${e.target.files.length} fotografija dodano`, 'ok');
  });

  // ── AI MODAL ─────────────────────────────────────────────────────
  document.querySelectorAll('.btn-ai').forEach(btn => {
    btn.addEventListener('click', () => {
      const sec = btn.dataset.sec;
      const targetMap = {
        cover: null, s1: 'f-sazetak', s22: 'f-opis-konstr',
        grijanje: 'f-opis-grijanje', ptv: 'f-opis-ptv',
        hladenje: 'f-opis-hladenje', ventilacija: 'f-opis-vent',
        s4: 'f-preporuke-uvod', analiza: null, s6: 'f-zakljucak'
      };
      API.openModal(sec, targetMap[sec]);
    });
  });

  document.getElementById('btn-ai-fill')?.addEventListener('click', () => {
    API.openModal('s1', 'f-sazetak');
  });

  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('ai-modal')?.addEventListener('click', e => {
    if (e.target.id === 'ai-modal') closeModal();
  });

  function closeModal() { document.getElementById('ai-modal').classList.add('hidden'); }

  document.getElementById('btn-ai-gen').addEventListener('click', async () => {
    const prompt = document.getElementById('ai-prompt').value;
    const btn = document.getElementById('btn-ai-gen');
    btn.textContent = '⏳ Generiram…'; btn.disabled = true;

    const text = await API.generateText(API.currentSection, prompt);

    if (text) {
      document.getElementById('ai-result-text').value = text;
      document.getElementById('ai-result-wrap').classList.remove('hidden');
      document.getElementById('btn-ai-insert').classList.remove('hidden');
    }
    btn.textContent = '🔮 Generiraj'; btn.disabled = false;
  });

  document.getElementById('btn-ai-insert').addEventListener('click', () => {
    const text = document.getElementById('ai-result-text').value;
    if (API.currentTarget) {
      const el = document.getElementById(API.currentTarget);
      if (el) { el.value = text; toast('↩ Tekst umetnut', 'ok'); }
    }
    closeModal();
  });

  // ── GENERATE → PREVIEW ───────────────────────────────────────────
  document.getElementById('btn-generate').addEventListener('click', () => {
    State.data = collectFormData();
    State.save();
    buildPreview();
    switchStep('preview');
    toast('✅ Izvještaj spreman za izvoz', 'ok');
  });

  // ── EXPORT ────────────────────────────────────────────────────────
  document.getElementById('btn-to-export').addEventListener('click', () => switchStep('export'));
  document.getElementById('btn-export-word').addEventListener('click', () => Export.generateWord());

  document.getElementById('btn-save-proj').addEventListener('click', () => {
    State.data = collectFormData();
    State.data._photos = Photos.exportAll();
    const json = State.exportProject();
    const blob = new Blob([json], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fname = (State.data.narucitelj||'projekt').replace(/[^a-zA-Z0-9]/g,'_').slice(0,20);
    a.download = `EnergoCert_${fname}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('💾 Projekt pohranjen', 'ok');
  });

  document.getElementById('btn-load-proj').addEventListener('click', () => {
    document.getElementById('input-load-proj').click();
  });

  document.getElementById('input-load-proj').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        State.importProject(ev.target.result);
        setType(State.buildingType);
        populateForm(State.data);
        Photos.importAll(State.data._photos || {});
        Photos.renderAll();
        renderMjere();
        toast('✅ Projekt učitan', 'ok');
        switchStep('form');
      } catch (err) { toast('❌ Greška učitavanja: ' + err.message, 'err'); }
    };
    reader.readAsText(f);
  });

  // ── NETLIFY REDIRECT FALLBACK ────────────────────────────────────
  // If no API key error, show helpful message
  window.addEventListener('unhandledrejection', e => {
    if (e.reason?.message?.includes('401') || e.reason?.message?.includes('403')) {
      toast('ℹ️ API ključ nije konfiguriran – Claude AI analiza nije dostupna', 'info');
    }
  });

  console.log('✅ EnergoCert initialized');
});
