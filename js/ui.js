// ═══════════════════════════════════════════
// UI.JS – Navigation, form helpers, toast
// ═══════════════════════════════════════════

// ── TOAST ──────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast-item ${type}`;
  const icons = { ok: '✅', err: '❌', info: 'ℹ️' };
  el.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  document.getElementById('toast').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 3500);
}

// ── STEP NAVIGATION ────────────────────────────────────────────────
function switchStep(id) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`step-${id}`)?.classList.add('active');
  document.querySelector(`[data-step="${id}"]`)?.classList.add('active');
  window.scrollTo(0, 0);
}

// ── SECTION NAVIGATION (form) ─────────────────────────────────────
function switchFormSec(id) {
  document.querySelectorAll('.form-sec').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.fnav-item').forEach(i => i.classList.remove('active'));
  document.getElementById(`sec-${id}`)?.classList.add('active');
  document.querySelector(`.fnav-item[data-sec="${id}"]`)?.classList.add('active');
}

// ── BUILDING TYPE TOGGLE ──────────────────────────────────────────
function setType(type) {
  State.buildingType = type;
  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === type);
  });

  // Show/hide sections for existing buildings
  const isPost = type === 'postojeca';
  document.getElementById('sec-s3').classList.toggle('hidden', isPost);
  document.getElementById('sec-s3b').classList.toggle('hidden', !isPost);
  document.getElementById('snav-s3').style.display = isPost ? 'none' : '';
  document.getElementById('snav-s3b').style.display = isPost ? '' : 'none';
  document.getElementById('racuni-block')?.classList.toggle('hidden', !isPost);
  document.getElementById('mjere-block')?.classList.toggle('hidden', !isPost);

  // Zrakopropusnost – samo nova
  document.getElementById('snav-s5').style.display = isPost ? 'none' : '';
  document.getElementById('sec-s5')?.classList.toggle('hidden', isPost);

  // Step 2 heading
  const h2el = document.querySelector('#sec-s2 .sec-header h2');
  if (h2el) h2el.textContent = isPost ? '2.1. Podaci o naručitelju / projektu' : '2.1. Podaci o naručitelju';
}

// ── POPULATE FORM FROM EXTRACTED DATA ────────────────────────────
function populateForm(d) {
  if (!d) return;
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (!el || val === null || val === undefined) return;
    el.value = val;
  };

  set('f-narucitelj', d.narucitelj);
  set('f-oib', d.oib);
  set('f-gradjevina', d.gradjevina);
  set('f-lokacija', d.lokacija);
  set('f-katastar', d.katastar);
  set('f-godina', d.godina);
  // Voditelj je uvijek Goran Muhvić
  document.getElementById('f-voditelj') && (document.getElementById('f-voditelj').value = 'Goran Muhvić, dipl.ing.stroj.');
  set('f-ak', d.ak);
  set('f-oplosje', d.oplosje);
  set('f-obujam', d.obujam);
  set('f-obujam-zrak', d.obujamZrak);
  set('f-faktor', d.faktor);
  set('f-procelj', d.procelj);
  set('f-prozori', d.prozori);
  set('f-etaze', d.etaze);
  set('f-meteo', d.meteo);

  // Sustavi
  set('f-grij-vrsta', d.grijVrsta);
  set('f-grij-energent', d.grijEnergent);
  set('f-grij-izvor', d.grijIzvor);
  set('f-grij-snaga', d.grijSnaga);
  set('f-grij-cop', d.grijCop);
  set('f-grij-tijela', d.grijTijela);
  set('f-grij-temp', d.grijTemp);
  set('f-ptv-tip', d.ptvTip);
  set('f-ptv-vol', d.ptvVol);
  set('f-ptv-temp', d.ptvTemp);
  set('f-ptv-qw', d.ptvQw);
  set('f-hlad-vrsta', d.hladVrsta);
  set('f-hlad-snaga', d.hladSnaga);
  set('f-hlad-tvar', d.hladTvar);
  set('f-hlad-eer', d.hladEer);
  set('f-vent-vrsta', d.ventVrsta);
  set('f-vent-va', d.ventVa);
  set('f-rasv-vrsta', d.rasvVrsta);
  set('f-rasv-snaga', d.rasvSnaga);
  set('f-rasv-spec', d.rasvSpec);

  // Zrakopropusnost - n50
  if (d.zrakN50) set('f-zrak-n50', d.zrakN50);

  // Opis konstrukcije
  if (d.opisKonstrukcije) set('f-opis-konstr', d.opisKonstrukcije);

  // U-values table - populate if extracted
  if (d.uvalues && d.uvalues.length > 0) {
    const tbody = document.getElementById('uvalues-body');
    if (tbody) {
      tbody.innerHTML = '';
      d.uvalues.forEach(function(uv) {
        const tr = document.createElement('tr');
        const sel = '<select><option' + (uv.provjera==='ZADOVOLJAVA'?' selected':'') + '>ZADOVOLJAVA</option><option' + (uv.provjera==='NE ZADOVOLJAVA'?' selected':'') + '>NE ZADOVOLJAVA</option></select>';
        tr.innerHTML =
          '<td><input type="text" value="' + (uv.naziv||'') + '" placeholder="Naziv"></td>' +
          '<td><input type="number" value="' + (uv.area||'') + '" step="0.01"></td>' +
          '<td><input type="number" value="' + (uv.u||'') + '" step="0.01"></td>' +
          '<td><input type="number" value="' + (uv.umax||'') + '" step="0.01"></td>' +
          '<td>' + sel + '</td>' +
          '<td><button class="del-row">✕</button></td>';
        tbody.appendChild(tr);
      });
    }
  }

  // Proračun – nova zgrada
  set('f-qhnd', d.qhndKwh);
  set('f-qhnd-m2', d.qhndM2);
  set('f-qhnd-max', d.qhndMax);
  set('f-qcnd', d.qcndKwh);
  set('f-qcnd-m2', d.qcndM2);
  set('f-htr', d.htrAdj);
  set('f-htr-max', d.htrMax);
  set('f-edel', d.edel);
  set('f-eprim', d.eprim);
  set('f-eprim-m2', d.eprimM2);
  set('f-eprim-max', d.eprimMax);
  set('f-oie-udio', d.oieUdio);
  set('f-oie-kwh', d.oieKwh);
  set('f-qhnd-spec', d.qhndSpec);
  set('f-eprim-spec', d.eprimSpec);
  set('f-edel-spec', d.edelSpec);
  set('f-oie-spec', d.oieSpec);

  // Proračun – postojeća
  set('f-qhnd-ref-post', d.qhndM2);
  set('f-qhnd-max-post', d.qhndMax);
  set('f-eprim-ref-post', d.eprimM2);
  set('f-eprim-max-post', d.eprimMax);
  set('f-edel-ref-post', d.edel);
  set('f-oie-ref-post', d.oieUdio);
  set('f-qhnd-spec-post', d.qhndSpec);
  set('f-eprim-spec-post', d.eprimSpec);

  // Projekt podaci
  set('f-arhprojekt', d.arhProjekt);
  set('f-strojprojekt', d.strojProjekt);
  set('f-elprojekt', d.elProjekt);
  set('f-izvodac', d.izvodac);
  set('f-nadzor', d.nadzor);

  // Selecti
  if (d.razredQhnd) document.getElementById('f-razred-qhnd').value = d.razredQhnd;
  if (d.razredEprim) document.getElementById('f-razred-eprim').value = d.razredEprim;
  if (d.nzeb) document.getElementById('f-nzeb').value = d.nzeb === true || d.nzeb === 'da' ? 'da' : 'ne';
  if (d.grijTrv) document.getElementById('f-grij-trv').value = d.grijTrv;
}

// ── COLLECT FORM DATA ─────────────────────────────────────────────
function collectFormData() {
  const get = id => document.getElementById(id)?.value?.trim() || '';
  const data = {
    narucitelj: get('f-narucitelj'), oib: get('f-oib'),
    gradjevina: get('f-gradjevina'), lokacija: get('f-lokacija'),
    katastar: get('f-katastar'), godina: get('f-godina'),
    voditelj: get('f-voditelj'), datum: get('f-datum'),
    vrsta: get('f-vrsta'),
    // Ovlaštene osobe
    experts: [0,1,2].map(i => ({ tip: get(`exp-t${i}`), ime: get(`exp-n${i}`), reg: get(`exp-r${i}`) })),
    // Projekt
    arhProjekt: get('f-arhprojekt'), strojProjekt: get('f-strojprojekt'),
    elProjekt: get('f-elprojekt'), izvodac: get('f-izvodac'), nadzor: get('f-nadzor'),
    // Geometrija
    ak: get('f-ak'), oplosje: get('f-oplosje'), obujam: get('f-obujam'),
    obujamZrak: get('f-obujam-zrak'), faktor: get('f-faktor'),
    procelj: get('f-procelj'), prozori: get('f-prozori'),
    etaze: get('f-etaze'), meteo: get('f-meteo'),
    // Opis
    opisKonstr: get('f-opis-konstr'),
    opisGrijanje: get('f-opis-grijanje'), opisPtv: get('f-opis-ptv'),
    opisHladenje: get('f-opis-hladenje'), opisVent: get('f-opis-vent'),
    opisRasvjeta: get('f-opis-rasvjeta'),
    // Sustavi
    grijVrsta: get('f-grij-vrsta'), grijEnergent: get('f-grij-energent'),
    grijIzvor: get('f-grij-izvor'), grijSnaga: get('f-grij-snaga'),
    grijCop: get('f-grij-cop'), grijTijela: get('f-grij-tijela'),
    grijTrv: get('f-grij-trv'), grijTemp: get('f-grij-temp'),
    ptvTip: get('f-ptv-tip'), ptvVol: get('f-ptv-vol'),
    ptvTemp: get('f-ptv-temp'), ptvQw: get('f-ptv-qw'),
    hladVrsta: get('f-hlad-vrsta'), hladSnaga: get('f-hlad-snaga'),
    hladTvar: get('f-hlad-tvar'), hladEer: get('f-hlad-eer'),
    ventVrsta: get('f-vent-vrsta'), ventVa: get('f-vent-va'),
    rasvVrsta: get('f-rasv-vrsta'), rasvSnaga: get('f-rasv-snaga'),
    rasvSpec: get('f-rasv-spec'),
    // Voda
    vodaPot: get('f-voda-pot'), vodaSpec: get('f-voda-spec'),
    kisnica: get('f-kisnica'), perlatori: get('f-perlatori'),
    // Razredi & proračun
    razredQhnd: get('f-razred-qhnd'), razredEprim: get('f-razred-eprim'),
    nzeb: get('f-nzeb'),
    qhndM2: get('f-qhnd-m2'), qhndMax: get('f-qhnd-max'), qhndKwh: get('f-qhnd'),
    qcndM2: get('f-qcnd-m2'), qcndKwh: get('f-qcnd'),
    htrAdj: get('f-htr'), htrMax: get('f-htr-max'),
    edel: get('f-edel'), eprim: get('f-eprim'),
    eprimM2: get('f-eprim-m2'), eprimMax: get('f-eprim-max'),
    oieUdio: get('f-oie-udio'), oieKwh: get('f-oie-kwh'),
    qhndSpec: get('f-qhnd-spec'), eprimSpec: get('f-eprim-spec'),
    edelSpec: get('f-edel-spec'), oieSpec: get('f-oie-spec'),
    // Postojeća dodatni proračun
    qhndRefPost: get('f-qhnd-ref-post'), eprimRefPost: get('f-eprim-ref-post'),
    qhndSpecPost: get('f-qhnd-spec-post'), eprimSpecPost: get('f-eprim-spec-post'),
    // Tekst
    sazetak: get('f-sazetak'), preporukeUvod: get('f-preporuke-uvod'),
    zakljucak: get('f-zakljucak'), kiNapomena: get('f-ki-napomena'),
    modelEl: get('f-model-el'), modelVoda: get('f-model-voda'), modelTop: get('f-model-top'),
    energent: get('f-energent'),
    // Zrakopropusnost
    zrakIzv: get('f-zrak-izv'), zrakNorma: get('f-zrak-norma'),
    zrakN50: get('f-zrak-n50'), zrakMax: get('f-zrak-max'),
    zrakOcj: get('f-zrak-ocj'), zrakDatum: get('f-zrak-datum'),
    // Tablice
    uvalues: collectUValues(),
    racuniEl: collectRacuniRows('el'),
    racuniTop: collectRacuniRows('top'),
    racuniVoda: collectRacuniRows('voda'),
    // Foto assignments
    phGrijanje: get('ph-grijanje'), phPtv: get('ph-ptv'),
    phHladenje: get('ph-hladenje'), phVentilacija: get('ph-ventilacija'),
    phRasvjeta: get('ph-rasvjeta'),
  };
  return data;
}

function collectUValues() {
  const rows = [];
  document.querySelectorAll('#uvalues-body tr').forEach(tr => {
    const inputs = tr.querySelectorAll('input, select');
    if (inputs.length >= 5) rows.push({
      naziv: inputs[0].value, area: inputs[1].value,
      u: inputs[2].value, umax: inputs[3].value, provjera: inputs[4].value
    });
  });
  return rows;
}

function collectRacuniRows(type) {
  const rows = [];
  document.querySelectorAll(`#racuni-${type}-body tr`).forEach(tr => {
    const inputs = tr.querySelectorAll('input');
    if (inputs.length >= 4) rows.push({
      godina: inputs[0].value, potrosnja: inputs[1].value,
      troskovi: inputs[2].value, spec: inputs[3].value
    });
  });
  return rows;
}

// ── PREVIEW ──────────────────────────────────────────────────────
function buildPreview() {
  const d = State.data;
  const t = State.buildingType;
  const razQhnd = d.razredQhnd || '—';
  const razEprim = d.razredEprim || '—';

  const badgeCls = r => r === 'A+' || r === 'A' ? 'badge-A' : r === 'B' ? 'badge-B' : 'badge-C';

  document.getElementById('preview-summary').innerHTML = `
    <div class="prev-row"><span class="lbl">Vrsta zgrade</span><span class="val">${t === 'nova' ? 'Nova zgrada' : 'Postojeća zgrada'}</span></div>
    <div class="prev-row"><span class="lbl">Naručitelj</span><span class="val">${d.narucitelj || '—'}</span></div>
    <div class="prev-row"><span class="lbl">Lokacija</span><span class="val">${d.lokacija || '—'}</span></div>
    <div class="prev-row"><span class="lbl">AK [m²]</span><span class="val">${d.ak || '—'}</span></div>
    <div class="prev-row"><span class="lbl">Q''H,nd [kWh/(m²a)]</span><span class="val">${d.qhndM2 || d.qhndRefPost || '—'} → <span class="badge ${badgeCls(razQhnd)}">${razQhnd}</span></span></div>
    <div class="prev-row"><span class="lbl">E'prim [kWh/(m²a)]</span><span class="val">${d.eprimM2 || d.eprimRefPost || '—'} → <span class="badge ${badgeCls(razEprim)}">${razEprim}</span></span></div>
    <div class="prev-row"><span class="lbl">nZEB</span><span class="val">${(d.nzeb === 'da') ? '<span class="badge badge-A">DA – nZEB</span>' : 'NE'}</span></div>
    <div class="prev-row"><span class="lbl">Slike</span><span class="val">${State.photos.length} fotografija</span></div>
    <div class="prev-row" style="border:none; margin-top:12px; color:var(--muted); font-size:12px">
      Dokument je spreman za generiranje. Provjeri podatke i klikni "Izvoz".
    </div>
  `;
}

// ── PHOTO SELECT SYNC ────────────────────────────────────────────
function syncPhotoSelects() {
  const selects = ['ph-grijanje','ph-ptv','ph-hladenje','ph-ventilacija','ph-rasvjeta'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">— Odaberi fotografiju —</option>';
    State.photos.forEach(ph => {
      const opt = document.createElement('option');
      opt.value = ph.id;
      opt.textContent = ph.name;
      if (ph.id === current) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

// ── RACUNI ROW ADD ────────────────────────────────────────────────
function addRacunRow(type) {
  const tbody = document.getElementById(`racuni-${type}-body`);
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `<td><input type="text" placeholder="Godina"></td><td><input type="number" step="0.01"></td><td><input type="number" step="0.01"></td><td><input type="number" step="0.01"></td><td><button class="del-row" onclick="this.closest('tr').remove()">✕</button></td>`;
  tbody.appendChild(tr);
}

// ── DEL ROW DELEGATION ────────────────────────────────────────────
document.addEventListener('click', e => {
  if (e.target.classList.contains('del-row')) e.target.closest('tr').remove();
});
