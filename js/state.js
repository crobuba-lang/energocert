// ═══════════════════════════════════════════
// STATE.JS – Centralized application state
// Photos stored in memory only (too large for localStorage)
// ═══════════════════════════════════════════
const State = {
  buildingType: 'nova',
  files: { kiRef: null, kiSpec: null },
  analyzed: false,
  photos: [],      // [{id, name, dataUrl}] – memory only, not persisted
  data: {},
  measures: [],

  load() {
    try {
      const raw = localStorage.getItem('energocert_state');
      if (!raw) return;
      const saved = JSON.parse(raw);
      this.buildingType = saved.buildingType || 'nova';
      this.data = saved.data || {};
      this.measures = saved.measures || [];
      // Photos are NOT loaded from storage (too large)
      // User must re-upload photos after page refresh
    } catch (e) { console.warn('State load error', e); }
  },

  save() {
    try {
      // Save only text data – never photos
      const toSave = {
        buildingType: this.buildingType,
        data: this._dataWithoutPhotos(),
        measures: this.measures
      };
      const json = JSON.stringify(toSave);
      // Safety check – if data > 3MB skip saving
      if (json.length > 3 * 1024 * 1024) {
        console.warn('State too large, skipping localStorage save');
        return;
      }
      localStorage.setItem('energocert_state', json);
      const ind = document.getElementById('autosave');
      if (ind) ind.textContent = '● Saved ' + new Date().toLocaleTimeString('hr');
    } catch (e) {
      console.warn('State save error (storage full):', e.message);
    }
  },

  _dataWithoutPhotos() {
    // Strip base64 photo data from the data object before saving
    const clean = { ...this.data };
    delete clean.coverPhoto;
    return clean;
  },

  exportProject() {
    // Export includes photos (user saves to file, not localStorage)
    return JSON.stringify({
      buildingType: this.buildingType,
      data: this.data,
      measures: this.measures,
      photos: this.photos
    }, null, 2);
  },

  importProject(json) {
    const p = JSON.parse(json);
    this.buildingType = p.buildingType || 'nova';
    this.data = p.data || {};
    this.measures = p.measures || [];
    this.photos = p.photos || [];
    this.save();
  }
};
