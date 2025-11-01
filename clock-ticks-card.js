// clock-ticks-card.js
// Eine Datei mit: Karte + integrierter UI-Editor + Card-Picker-Eintrag

/***** ---------- Editor (UI) ---------- *****/
class ClockTicksCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config || {};
    this.requestUpdate?.();
  }

  set hass(hass) {
    this._hass = hass;
    this.requestUpdate?.();
  }

  connectedCallback() {
    this.style.display = 'block';
    if (!this._root) {
      this._root = this.attachShadow({ mode: 'open' });
      this._root.innerHTML = `
        <style>
          .wrap { padding: 8px; }
          ha-form { --form-padding: 0; }
        </style>
        <div class="wrap">
          <ha-form></ha-form>
        </div>
      `;
    }
    this._render();
  }

  _render() {
    if (!this._root) return;
    const form = this._root.querySelector('ha-form');
    if (!form) return;

    const schema = [
      { name: 'entity', selector: { entity: {} } },
      {
        name: 'cols',
        selector: { select: { options: [6,7,8,9,10,11,12].map(v => ({ value: v, label: String(v) })) } }
      },
      {
        name: 'rows',
        selector: { select: { options: [1,2,3,4,5,6,7].map(v => ({ value: v, label: String(v) })) } }
      },
      { name: 'bgColor', selector: { color: {} } },
      { name: 'borderColor', selector: { color: {} } },
      { name: 'tickColor', selector: { color: {} } },
      { name: 'fontColor', selector: { color: {} } },
      {
        name: 'fontWeight',
        selector: { select: { options: [400,500,600,700,800].map(v => ({ value: v, label: String(v) })) } }
      },
      { name: 'fontFamily', selector: { text: {} } },

      { name: 'padPct', selector: { number: { min: 0, max: 20, step: 0.1, mode: 'slider' } } },
      { name: 'radiusPct', selector: { number: { min: 0, max: 40, step: 0.5, mode: 'slider' } } },
      { name: 'tickLenPct', selector: { number: { min: 0, max: 100, step: 1, mode: 'slider' } } },
      { name: 'tickThickPct', selector: { number: { min: 0, max: 5, step: 0.1, mode: 'slider' } } },
      { name: 'borderPct', selector: { number: { min: 0, max: 10, step: 0.1, mode: 'slider' } } },
      { name: 'labelTransformFactor', selector: { number: { min: -0.5, max: 0.5, step: 0.001 } } }
    ];

    form.schema = schema;
    form.data = {
      cols: 6,
      rows: 2,
      bgColor: 'white',
      borderColor: 'white',
      tickColor: '#A0A0A0',
      fontColor: 'black',
      fontWeight: 700,
      fontFamily: 'SF-Pro-Rounded, system-ui, -apple-system, Segoe UI, Roboto',
      padPct: 6,
      radiusPct: 18,
      tickLenPct: 50,
      tickThickPct: 0.9,
      borderPct: 2.4,
      labelTransformFactor: -0.142,
      ...this._config
    };
    form.hass = this._hass;

    form.addEventListener('value-changed', (ev) => {
      ev.stopPropagation();
      const newConfig = { ...this._config, ...ev.detail.value, type: 'custom:clock-ticks-card' };
      this._config = newConfig;
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: newConfig } }));
    });
  }

  requestUpdate() {
    this._render();
  }
}
customElements.define('clock-ticks-card-editor', ClockTicksCardEditor);

/***** ---------- Karte ---------- *****/
// Kleines Template-Helper (ohne Lit)
const html = (strings, ...values) =>
  strings.reduce((acc, s, i) => acc + s + (i < values.length ? values[i] : ''), '');

class ClockTicksCard extends HTMLElement {
  static get properties() {
    return { hass: {}, _config: {} };
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("Erforderlich: 'entity' (z. B. sensor.aktuelle_uhrzeit)");
    }
    this._config = {
      cols: 6,
      rows: 2,
      padPct: 6,
      radiusPct: 18,
      tickLenPct: 50,
      tickThickPct: 0.9,
      borderPct: 2.4,
      fontWeight: 700,
      fontColor: 'black',
      bgColor: 'white',
      tickColor: '#A0A0A0',
      borderColor: 'white',
      fontFamily: 'SF-Pro-Rounded, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
      labelTransformFactor: -0.142,
      ...config
    };
    this._update(true);
  }

  static getConfigElement() {
    // Editor kommt aus derselben Datei
    return document.createElement('clock-ticks-card-editor');
  }

  static getStubConfig() {
    return {
      type: 'custom:clock-ticks-card',
      entity: 'sensor.time',
      cols: 6,
      rows: 2
    };
  }

  connectedCallback() {
    if (!this._root) {
      this._root = this.attachShadow({ mode: 'open' });
      this._root.innerHTML = `<ha-card></ha-card>`;
    }
    this._update(true);
  }

  getCardSize() {
    const hmap = {1:56,2:120,3:184,4:248,5:312,6:376,7:440};
    const rows = this._config?.rows ?? 2;
    const h = hmap[rows] ?? 120;
    return Math.max(1, Math.round(h / 56));
  }

  _dims() {
    const { cols = 6, rows = 2 } = this._config || {};
    const wMap = {6:247,7:290,8:332,9:375,10:417,11:460,12:502};
    const hMap = {1:56,2:120,3:184,4:248,5:312,6:376,7:440};
    const W = wMap[cols] ?? 247;
    const H = hMap[rows] ?? 120;
    return { W, H };
  }

  _renderSVG(entityState) {
    const c = this._config || {};
    const {
      padPct, radiusPct, tickLenPct, tickThickPct, borderPct,
      tickColor, borderColor, bgColor, cols = 6, rows = 2, labelTransformFactor,
      fontColor, fontWeight, fontFamily
    } = c;

    const wMap = {6:247,7:290,8:332,9:375,10:417,11:460,12:502};
    const hMap = {1:56,2:120,3:184,4:248,5:312,6:376,7:440};
    const W = wMap[cols] ?? 247;
    const H = hMap[rows] ?? 120;

    const minWH = Math.min(W, H);
    const pad = (minWH * padPct) / 100;
    const rw  = W - 2 * pad;
    const rh  = H - 2 * pad;
    const cx  = W / 2;
    const cy  = H / 2;

    (minWH * radiusPct) / 100; // radius (wird nur für rect genutzt, unten per Template)
    const tickLen = (minWH * tickLenPct) / 100;
    const tickStroke = (minWH * tickThickPct) / 100;
    const borderW = (minWH * borderPct) / 100;

    const innerEx = rw/2 - rh*0.10;
    const innerEy = rh/2 - rh*0.10;
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
      ticks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                  stroke="${tickColor}" stroke-width="${sw}" stroke-linecap="round"/>`;
    }

    const radius = (Math.min(W, H) * (this._config.radiusPct ?? 18)) / 100;

    const rect = `<rect x="${pad}" y="${pad}" width="${rw}" height="${rh}"
                    fill="${bgColor}" stroke="${borderColor}" stroke-width="${borderW}"
                    rx="${radius}" ry="${radius}"/>`;

    const translateY = `translateY(${(labelTransformFactor * H).toFixed(2)}px)`;
    const labelFontSize = ((wMap[cols] ?? 247) * 0.3).toFixed(2) + 'px';

    return html`
      <div class="card-root" style="position:relative;display:flex;justify-content:center;align-items:center;width:${W}px;height:${H}px;overflow:hidden;background:${bgColor};border:6px solid ${bgColor};">
        <div class="svg-wrap" style="position:absolute;inset:0;">
          <svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="none" style="position:absolute;top:0;left:0;">
            ${ticks}
            ${rect}
          </svg>
        </div>
        <div class="label" style="
          z-index:2;
          color:${fontColor};
          font-weight:${fontWeight};
          font-family:${fontFamily};
          transform:${translateY};
          font-stretch:condensed;
          font-size:${labelFontSize};
          line-height:1;
          ">
          ${entityState ?? '—'}
        </div>
      </div>
    `;
  }

  _update(force = false) {
    if (!this._root || !this._config) return;
    const haCard = this._root.querySelector('ha-card');
    if (!haCard) return;

    const entityId = this._config.entity;
    const state = this._hass?.states?.[entityId]?.state;

    const content = this._renderSVG(state);
    if (force || this._lastHTML !== content) {
      this._lastHTML = content;
      haCard.innerHTML = content;
      // optional: click -> more-info
      haCard.style.cursor = 'var(--card-primary-action, pointer)';
      haCard.onclick = () => {
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

// Für den Karten-Picker im UI
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'clock-ticks-card',
  name: 'Clock Ticks Card',
  description: 'Uhr-/Label-Karte mit Ticks und festen Rastergrößen',
  preview: true,
  documentationURL: 'https://github.com/yourname/clock-ticks-card'
});
