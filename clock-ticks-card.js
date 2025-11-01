// clock-ticks-card.js
// Skaliert mit HA-Layout (rows/Spans).
// Verbesserungen:
// - min-height + robuste Messung
// - Label-Schrift schneidet unten nicht ab
// - Deutlichere Bezeichnungen der Optionen im UI (deutsche Beschriftungen)
// Neu:
// - Conic-Gradient als Hintergrund, nur durch Tick-Schlitze sichtbar (Maske), mittig & 60s/360° synchron.

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
          Die Größe kommt vom Dashboard-Layout (Rows/Spans). 
          Falls Home Assistant anfangs keine Höhe liefert, sorgt <code>minHeightPx</code> für eine sinnvolle Mindesthöhe.
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
      { name: 'entity', label: 'Uhrzeit-Entity (z. B. sensor.uhrzeit)', selector: { entity: {} } },

      // Layout / Größe
      { name: 'minHeightPx', label: 'Mindesthöhe (px, falls Layout noch nicht geladen)', selector: { number: { min: 0, max: 1000, step: 10 } } },

      // Farben & Schrift
      { name: 'bgColor', label: 'Hintergrundfarbe', selector: { color: {} } },
      { name: 'borderColor', label: 'Innenrand-Farbe', selector: { color: {} } },
      { name: 'tickColor', label: 'Strich-Farbe (Ticks)', selector: { color: {} } },
      { name: 'fontColor', label: 'Textfarbe (Uhrzeit)', selector: { color: {} } },
      { name: 'fontWeight', label: 'Schriftstärke (Fettgrad)', selector: { select: { options: [400,500,600,700,800].map(v => ({ value: v, label: String(v) })) } } },
      { name: 'fontFamily', label: 'Schriftart', selector: { text: {} } },

      // Äußerer Rahmen
      { name: 'outerBorderColor', label: 'Rahmenfarbe außen', selector: { color: {} } },
      { name: 'outerBorderWidth', label: 'Rahmenstärke außen (px)', selector: { number: { min: 0, max: 20, step: 1, mode: 'slider' } } },

      // Schriftgröße (%)
      { name: 'fontSizePct', label: 'Schriftgröße (% der Kartenhöhe)', selector: { number: { min: 5, max: 80, step: 1, mode: 'slider' } } },

      // Feintuning SVG (klar benannt)
      { name: 'padPct', label: 'Innenabstand zum Rand (%)', selector: { number: { min: 0, max: 20, step: 0.1, mode: 'slider' } } },
      { name: 'radiusPct', label: 'Eckenrundung (SVG, %)', selector: { number: { min: 0, max: 40, step: 0.5, mode: 'slider' } } },
      { name: 'tickLenPct', label: 'Länge der Striche (Ticks, %)', selector: { number: { min: 0, max: 100, step: 1, mode: 'slider' } } },
      { name: 'tickThickPct', label: 'Dicke der Striche (Ticks, %)', selector: { number: { min: 0, max: 5, step: 0.1, mode: 'slider' } } },
      { name: 'borderPct', label: 'Innenrand-Breite (%)', selector: { number: { min: 0, max: 10, step: 0.1, mode: 'slider' } } },
      { name: 'labelTransformFactor', label: 'Vertikale Textposition (Feineinstellung)', selector: { number: { min: -0.5, max: 0.5, step: 0.001 } } }
    ];

    form.schema = schema;
    form.data = {
      minHeightPx: 120,
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

// ---------------------------------------------------------------------------
// Karte
// ---------------------------------------------------------------------------

class ClockTicksCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; height:100%; }
        ha-card { height:100%; box-sizing:border-box; }
      </style>
      <ha-card></ha-card>`;
    this._config = {};
    this._hass = undefined;
    this._resizeObs = null;
    this._borderRadiusPx = 12;
    this._lastHTML = '';
  }

  static get properties() { return { hass: {}, _config: {} }; }
  set hass(hass) { this._hass = hass; this._update(); }

  setConfig(config) {
    if (!config || !config.entity) throw new Error("Erforderlich: 'entity' (z. B. sensor.aktuelle_uhrzeit)");
    this._config = {
      minHeightPx: 120,
      fontWeight: 700, fontColor: 'black', bgColor: 'white', tickColor: '#A0A0A0', borderColor: 'white',
      fontFamily: 'SF-Pro-Rounded, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Helvetica Neue, Arial, Noto Sans, sans-serif',
      outerBorderColor: '#FFFFFF',
      outerBorderWidth: 6,
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
    if (!this._resizeObs) {
      this._resizeObs = new ResizeObserver(() => { this._readThemeRadius(); this._update(true); });
    }
    if (card) this._resizeObs.observe(card);
    this._readThemeRadius();
    this._update(true);
  }

  disconnectedCallback() {
    if (this._resizeObs) this._resizeObs.disconnect();
  }

  _readThemeRadius() {
    const card = this.shadowRoot.querySelector('ha-card');
    if (!card) return;
    const cs = getComputedStyle(card);
    this._borderRadiusPx = parseFloat(cs.borderRadius) || 12;
  }

  _dims() {
    const minH = Number(this._config.minHeightPx) || 0;
    const hostRect = this.getBoundingClientRect?.() || { width: 300, height: minH };
    const card = this.shadowRoot.querySelector('ha-card');
    const cardRect = card?.getBoundingClientRect?.() || hostRect;
    const W = Math.max(1, cardRect.width || hostRect.width || 300);
    const H = Math.max(minH, cardRect.height || hostRect.height || 0);
    return { W, H };
  }

  _renderSVG(entityState) {
    const c = this._config;
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

    // ---- Ticks als Maske (weiß = sichtbar) ----
    let ticksMask = '';
    for (let i = 0; i < 60; i++) {
      const a = (i * 6) * Math.PI / 180;
      const cos = Math.cos(a), sin = Math.sin(a);
      const x1 = cx + cos * outerEx;
      const y1 = cy + sin * outerEy;
      const x2 = cx + cos * innerEx;
      const y2 = cy + sin * innerEy;
      const sw = (i % 5 === 0) ? tickStroke * 1.6 : tickStroke;
      ticksMask += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                    stroke="white" stroke-width="${sw}" stroke-linecap="round"/>`;
    }

    // Rechteck-Hintergrund (Karte)
    const rect = `<rect x="${pad}" y="${pad}" width="${rw}" height="${rh}"
                    fill="${bgColor}" stroke="${borderColor}" stroke-width="${borderW}"
                    rx="${svgRx}" ry="${svgRx}"/>`;

    // Sekunden-Phase für korrekte Startstellung (Sekunde 0 -> 0°)
    const now = new Date();
    const secondsPhase = (now.getSeconds() + now.getMilliseconds()/1000).toFixed(3);
    const negDelay = `-${secondsPhase}s`;

    // Wrapper
    const wrapperStyle = `
      position:relative;display:block;width:100%;height:100%;
      min-height:${this._config.minHeightPx || 0}px;
      border:${outerBorderWidth}px solid ${outerBorderColor};
      border-radius:var(--ha-card-border-radius, 12px);
      background:${bgColor};
      overflow:hidden;box-sizing:border-box;
    `;

    // Label (Uhrzeit)
    const labelFontSize = (minWH * (fontSizePct / 100)).toFixed(2) + 'px';
    const labelStyle = `
      position:absolute;
      left:50%; top:50%;
      transform:translate(-50%, calc(-50% + ${(labelTransformFactor * 100).toFixed(3)}%));
      z-index:2;
      color:${fontColor};
      font-weight:${fontWeight};
      font-family:${fontFamily};
      font-size:${labelFontSize};
      line-height:1.1;
      overflow:visible;
      white-space:nowrap;
      text-align:center;
      display:flex; align-items:center; justify-content:center;
    `;

    // Conic-Gradient als Hintergrund, nur in Tick-Schlitzen sichtbar (Maske)
    // pointer-events:none => UI bleibt klickbar
    const secondsFO = html`
      <defs>
        <mask id="tick-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
          <rect x="0" y="0" width="${W}" height="${H}" fill="white"/>
          ${ticksMask}
        </mask>
      </defs>
      <foreignObject x="0" y="0" width="${W}" height="${H}"
                     style="mask:url(#tick-mask); pointer-events:none;">
        <div xmlns="http://www.w3.org/1999/xhtml"
             style="position:relative;width:100%;height:100%; pointer-events:none;">
          <style>
            @keyframes sweep-spin { to { transform: rotate(360deg); } }
          </style>
          <div style="
            position:absolute; width:500px; height:500px;
            left:${cx - 125}px; top:${cy - 125}px;
            background: conic-gradient(grey, grey, black);
            transform-origin:center;
            animation: sweep-spin 60s linear infinite;
            animation-delay:${negDelay};
            pointer-events:none;
          "></div>
        </div>
      </foreignObject>
    `;

    return html`
      <div class="card-root" style="${wrapperStyle}">
        <svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="none"
             style="position:absolute;inset:0;">
          ${rect}
          ${secondsFO}
        </svg>
        <div class="label" style="${labelStyle}">${entityState ?? '—'}</div>
      </div>
    `;
  }

  _update(force = false) {
    const card = this.shadowRoot.querySelector('ha-card');
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
  description: 'Analoge Tick-Uhr mit conic-gradient-Hintergrund durch Tick-Maske, skaliert mit dem HA-Layout (Rows/Spans).',
  preview: true,
  documentationURL: 'https://github.com/yourname/clock-ticks-card'
});
