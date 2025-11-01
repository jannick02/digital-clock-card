// clock-ticks-card.js
// Skaliert NUR mit dem HA-Layout: Breite & Höhe kommen vom Container (rows/cols/Spans).
// Features: anpassbare Schrift (fontSizePct), äußerer Rahmen, Theme-Radius, zentrierter Text.
// Robust: Shadow DOM im Konstruktor; keine Null-Refs; ResizeObserver.

class ClockTicksCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        .wrap { padding: 8px; }
        ha-form { --form-padding: 0; }
        .hint { color: var(--secondary-text-color); font-size: 12px; margin-top: 8px; }
      </style>
      <div class="wrap">
        <ha-form></ha-form>
        <div class="hint">
          Größe kommt vollständig vom Dashboard-Layout (Spalten/Zeilen/Spans). Keine Ratio-Option.
        </div>
      </div>
    `;
    this._config = {};
    this._hass = undefined;
    this._bound = false;
  }

  setConfig(config) { this._config = config || {}; this._render(); }
  set hass(hass) { this._hass = hass; this._render(); }
  connectedCallback() { this._render(); }

  _render() {
    const form = this.shadowRoot.querySelector('ha-form');
    if (!form) return;

    const schema = [
      { name: 'entity', selector: { entity: {} } },

      // Farben & Schrift
      { name: 'bgColor', selector: { color: {} } },
      { name: 'borderColor', selector: { color: {} } },
      { name: 'tickColor', selector: { color: {} } },
      { name: 'fontColor', selector: { color: {} } },
      { name: 'fontWeight', selector: { select: { options: [400,500,600,700,800].map(v => ({ value: v, label: String(v) })) } } },
      { name: 'fontFamily', selector: { text: {} } },

      // Äußerer Rahmen
      { name: 'outerBorderColor', selector: { color: {} } },
      { name: 'outerBorderWidth', selector: { number: { min: 0, max: 20, step: 1, mode: 'slider' } } },

      // Schriftgröße (% der kleineren Kante)
      { name: 'fontSizePct', selector: { number: { min: 5, max: 80, step: 1, mode: 'slider' } } },

      // Feintuning SVG
      { name: 'padPct', selector: { number: { min: 0, max: 20, step: 0.1, mode: 'slider' } } },
      { name: 'radiusPct', selector: { number: { min: 0, max: 40, step: 0.5, mode: 'slider' } } },
      { name: 'tickLenPct', selector: { number: { min: 0, max: 100, step: 1, mode: 'slider' } } },
      { name: 'tickThickPct', selector: { number: { min: 0, max: 5, step: 0.1, mode: 'slider' } } },
      { name: 'borderPct', selector: { number: { min: 0, max: 10, step: 0.1, mode: 'slider' } } },
      { name: 'labelTransformFactor', selector: { number: { min: -0.5, max: 0.5, step: 0.001 } } }
    ];

    form.schema = schema;
    form.data = {
      bgColor: 'white', borderColor: 'white', tickColor: '#A0A0A0', fontColor: 'black',
      fontWeight: 700,
      fontFamily: 'SF-Pro-Rounded, system-ui, -apple-system, Segoe UI, Roboto',

      outerBorderColor: '#FFFFFF',
      outerBorderWidth: 6,

      fontSizePct: 30,
      padPct: 6, radiusPct: 18, tickLenPct: 50, tickThickPct: 0.9, borderPct: 2.4,
      labelTransformFactor: -0.142,
      ...this._config
    };
    form.hass = this._hass;

    if (!this._bound) {
      this._bound = true;
      form.addEventListener('value-changed', (ev) => {
        ev.stopPropagation();
        const newConfig = { ...this._config, ...ev.detail.value, type: 'custom:clock-ticks-card' };
        this._config = newConfig;
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: newConfig } }));
      });
    }
  }
}
customElements.define('clock-ticks-card-editor', ClockTicksCardEditor);

const html = (s, ...v) => s.reduce((a, x, i) => a + x + (i < v.length ? v[i] : ''), '');

class ClockTicksCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `<ha-card style="box-sizing:border-box;"></ha-card>`;
    this._config = {};
    this._hass = undefined;
    this._connected = false;
    this._resizeObs = null;
    this._borderRadiusPx = 12;
    this._lastHTML = '';
  }

  static get properties() { return { hass: {}, _config: {} }; }
  set hass(hass) { this._hass = hass; this._update(); }

  setConfig(config) {
    if (!config || !config.entity) throw new Error("Erforderlich: 'entity' (z. B. sensor.aktuelle_uhrzeit)");
    this._config = {
      // Farben & Schrift
      fontWeight: 700, fontColor: 'black', bgColor: 'white', tickColor: '#A0A0A0', borderColor: 'white',
      fontFamily: 'SF-Pro-Rounded, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Helvetica Neue, Arial, Noto Sans, sans-serif',

      // Rahmen außen
      outerBorderColor: '#FFFFFF',
      outerBorderWidth: 6,

      // Schrift & Geometrie
      fontSizePct: 30,
      padPct: 6, radiusPct: 18, tickLenPct: 50, tickThickPct: 0.9, borderPct: 2.4,
      labelTransformFactor: -0.142,

      ...config
    };
    this._update(true);
  }

  static getConfigElement() { return document.createElement('clock-ticks-card-editor'); }

  connectedCallback() {
    const card = this.shadowRoot.querySelector('ha-card');
    if (!this._resizeObs) this._resizeObs = new ResizeObserver(() => { this._readThemeRadius(); this._update(true); });
    if (card && !this._connected) { this._resizeObs.observe(card); this._connected = true; }
    this._readThemeRadius();
    this._update(true);
  }

  disconnectedCallback() { if (this._resizeObs) { this._resizeObs.disconnect(); this._connected = false; } }

  _readThemeRadius() {
    const card = this.shadowRoot.querySelector('ha-card');
    if (!card) return;
    const cs = getComputedStyle(card);
    const r = (cs.borderRadius || '12px').trim();
    const px = parseFloat(r) || 12;
    this._borderRadiusPx = px;
  }

  // Nimmt die Container-Höhe (rows) wirklich ab:
  _dims() {
    const card = this.shadowRoot.querySelector('ha-card');
    let W = Math.max(1, card?.clientWidth ?? 300);
    let H = Math.max(0, card?.clientHeight ?? 0);

    // Wenn HA den Height noch nicht gesetzt hat, versuche Eltern hochzuklettern:
    if (H <= 1) {
      let el = card;
      for (let i = 0; i < 6 && el && H <= 1; i++) {
        el = el.parentElement;
        const h = el ? (el.clientHeight || el.offsetHeight || 0) : 0;
        H = Math.max(H, h);
      }
    }
    // Falls immer noch 0 → letzter Fallback (verhindert "Linie", wird beim nächsten Resize ersetzt)
    if (H <= 1) H = Math.round(W * 0.5);

    return { W, H };
  }

  _renderSVG(entityState) {
    const c = this._config || {};
    const {
      padPct, radiusPct, tickLenPct, tickThickPct, borderPct,
      tickColor, borderColor, bgColor, fontColor, fontWeight, fontFamily,
      fontSizePct, labelTransformFactor, outerBorderColor, outerBorderWidth
    } = c;

    const { W, H } = this._dims();
    const minWH = Math.min(W, H);
    const pad = (minWH * padPct) / 100;
    const rw = W - 2 * pad;
    const rh = H - 2 * pad;
    const cx = W / 2, cy = H / 2;

    const themeRadius = this._borderRadiusPx;
    const svgRx = Math.max(0, themeRadius * (Math.min(rw, rh) / Math.min(W, H)));

    const tickLen = (minWH * tickLenPct) / 100;
    const tickStroke = (minWH * tickThickPct) / 100;
    const borderW = (minWH * borderPct) / 100;

    const innerEx = rw / 2 - rh * 0.10;
    const innerEy = rh / 2 - rh * 0.10;
    const outerEx = innerEx + tickLen;
    const outerEy = innerEy + tickLen;

    let ticks = '';
    for (let i = 0; i < 60; i++) {
      const a = (i * 6) * Math.PI / 180;
      const cos = Math.cos(a), sin = Math.sin(a);
      const x1 = cx + cos * outerEx;
      const y1 = cy + sin * outerEy;
      const x2 = cx + cos * innerEx;
      const y2 = cy + sin * innerEy;
      const sw = (i % 5 === 0) ? tickStroke * 1.6 : tickStroke;
      ticks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${tickColor}" stroke-width="${sw}" stroke-linecap="round"/>`;
    }

    const rect = `<rect x="${pad}" y="${pad}" width="${rw}" height="${rh}"
                    fill="${bgColor}" stroke="${borderColor}" stroke-width="${borderW}"
                    rx="${svgRx}" ry="${svgRx}"/>`;

    // Wrapper füllt Container vollständig (Breite & Höhe aus HA)
    const wrapperStyle = `
      position:relative;display:block;width:100%;height:100%;
      border:${outerBorderWidth}px solid ${outerBorderColor};
      border-radius:var(--ha-card-border-radius, 12px);
      background:${bgColor};
      overflow:hidden;box-sizing:border-box;
    `;

    const labelFontSize = (minWH * (fontSizePct / 100)).toFixed(2) + 'px';
    const translateYpx = (labelTransformFactor * H).toFixed(2);
    const labelStyle = `
      position:absolute;left:50%;top:50%;
      transform:translate(-50%,${translateYpx}px);
      z-index:2;color:${fontColor};
      font-weight:${fontWeight};
      font-family:${fontFamily};
      font-size:${labelFontSize};
      line-height:1;
      white-space:nowrap;
      text-align:center;
    `;

    return html`
      <div class="card-root" style="${wrapperStyle}">
        <svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="none"
             style="position:absolute;inset:0;">
          ${ticks}
          ${rect}
        </svg>
        <div class="label" style="${labelStyle}">${entityState ?? '—'}</div>
      </div>
    `;
  }

  _update(force = false) {
    const card = this.shadowRoot && this.shadowRoot.querySelector('ha-card');
    if (!card || !this._config) return;

    const entityId = this._config.entity;
    const state = this._hass?.states?.[entityId]?.state;
    const content = this._renderSVG(state);

    if (force || this._lastHTML !== content) {
      this._lastHTML = content;
      card.innerHTML = content;
      card.style.cursor = 'var(--card-primary-action, pointer)';
      card.onclick = () => {
        if (entityId && this._hass) {
          const ev = new Event('hass-more-info', { bubbles: true, composed: true });
          ev.detail = { entityId };
          this.dispatchEvent(ev);
        }
      };
    }
  }
}
customElements.define('clock-ticks-card', ClockTicksCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'clock-ticks-card',
  name: 'Clock Ticks Card',
  description: 'Skaliert vollständig mit dem HA-Layout (Rows/Spans). Theme-Radius, Rahmen & UI-Editor inklusive.',
  preview: true,
  documentationURL: 'https://github.com/yourname/clock-ticks-card'
});
