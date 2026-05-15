// ═══════════════════════════════════════════
// PHOTOS.JS – Per-slot photo management
// Each section (cover, grijanje, ptv, hlađenje, ventilacija, rasvjeta)
// has its own independent upload slot
// ═══════════════════════════════════════════

const SLOTS = ['cover', 'grijanje', 'ptv', 'hladenje', 'ventilacija', 'rasvjeta'];

const Photos = {
  // Store dimensions per slot for aspect ratio preservation
  dims: {},

  // Store one dataUrl per slot
  slots: {
    cover: null,
    grijanje: null,
    ptv: null,
    hladenje: null,
    ventilacija: null,
    rasvjeta: null,
  },

  readAsDataUrl(file) {
    // Auto-correct EXIF rotation using canvas
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          // Create canvas to re-draw image (browser auto-corrects EXIF)
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          res(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = rej;
        img.src = e.target.result;
      };
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
  },

  async setSlot(slot, file) {
    if (!file || !file.type.startsWith('image/')) return;
    const dataUrl = await this.readAsDataUrl(file);
    this.slots[slot] = dataUrl;
    // Store natural dimensions for aspect ratio
    await new Promise(res => {
      const img = new Image();
      img.onload = () => { this.dims[slot] = {w: img.naturalWidth, h: img.naturalHeight}; res(); };
      img.onerror = res;
      img.src = dataUrl;
    });
    this.renderSlot(slot);
    // Also sync the matching preview2 in the form (sys blocks)
    this.renderSlot2(slot);
  },

  renderSlot(slot) {
    // Render in step-1 grid AND form photos section (same ids)
    for (const id of [`prev-${slot}`]) {
      // There may be multiple elements with same id across step1 and form-photos
      document.querySelectorAll(`#prev-${slot}`).forEach(el => {
        if (this.slots[slot]) {
          el.innerHTML = `<img src="${this.slots[slot]}" alt="${slot}">`;
          el.classList.add('has-image');
        } else {
          el.innerHTML = '<span>Nema slike</span>';
          el.classList.remove('has-image');
        }
      });
    }
  },

  renderSlot2(slot) {
    // Update the inline preview in the sys block (prev2-xxx)
    const el = document.getElementById(`prev2-${slot}`);
    if (!el) return;
    if (this.slots[slot]) {
      el.innerHTML = `<img src="${this.slots[slot]}" alt="${slot}">`;
      el.classList.add('has-image');
    } else {
      el.innerHTML = '<span>Nema slike – učitaj na 1. koraku</span>';
      el.classList.remove('has-image');
    }
  },

  renderAll() {
    SLOTS.forEach(slot => {
      this.renderSlot(slot);
      this.renderSlot2(slot);
    });
  },

  // Get base64 string (without data: prefix) for a slot
  getBase64(slot) {
    const d = this.slots[slot];
    if (!d) return null;
    return d.split(',')[1] || null;
  },

  // Export/import support
  exportAll() {
    return { ...this.slots };
  },

  importAll(data) {
    if (!data) return;
    SLOTS.forEach(slot => {
      if (data[slot]) this.slots[slot] = data[slot];
    });
    this.renderAll();
  }
};
