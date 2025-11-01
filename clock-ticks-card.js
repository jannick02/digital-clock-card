// clock-ticks-card.js
// Enthält Sekunden-Sweep exakt wie im [[[]]]-Beispiel (Mask + conic-gradient + Rotation)
// Mit UI-Schalter "Sekundenanzeige (animierter Ring)"

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
          Größe kommt vom Dashboard-Layout (Rows/Spans). Mit dem Schalter kann die Sekundenanzeige aktiviert werden.
        </div>
      </div>
    `;
    this._config = {};
    this._bound = false;
  }

  setConfig(config) { this._config = config || {}; this._render(); }
  set hass(hass) { this._hass = hass; this._render(); }

  connectedCallback() { this._render(); }

  _render() {
    const form = this.shadowRoot.querySelector("ha-form");
    if (!form) return;

    const schema = [
      { name: "entity", label: "Uhrzeit-Entity (z. B. sensor.uhrzeit)", selector: { entity: {} } },
      { name: "showSecondsSweep", label: "Sekundenanzeige (animierter Ring)", selector: { boolean: {} } },
      { name: "fontSizePct", label: "Schriftgröße (% der Kartenhöhe)", selector: { number: { min: 5, max: 80, step: 1, mode: "slider" } } },
      { name: "outerBorderColor", label: "Rahmenfarbe außen", selector: { color: {} } },
      { name: "outerBorderWidth", label: "Rahmenstärke außen (px)", selector: { number: { min: 0, max: 20, step: 1, mode: "slider" } } },
      { name: "fontColor", label: "Textfarbe", selector: { color: {} } },
      { name: "bgColor", label: "Hintergrundfarbe", selector: { color: {} } }
    ];

    form.schema = schema;
    form.data = {
      entity: this._config.entity ?? "",
      showSecondsSweep: this._config.showSecondsSweep ?? true,
      fontSizePct: this._config.fontSizePct ?? 30,
      outerBorderColor: this._config.outerBorderColor ?? "#FFFFFF",
      outerBorderWidth: this._config.outerBorderWidth ?? 6,
      fontColor: this._config.fontColor ?? "black",
      bgColor: this._config.bgColor ?? "white",
    };
    form.hass = this._hass;

    if (!this._bound) {
      this._bound = true;
      form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const newConfig = { ...this._config, ...ev.detail.value, type: "custom:clock-ticks-card" };
        this._config = newConfig;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: newConfig } }));
      });
    }
  }
}
customElements.define("clock-ticks-card-editor", ClockTicksCardEditor);

// ----------------------------------------------

const html = (s, ...v) => s.reduce((a, x, i) => a + x + (v[i] ?? ""), "");

class ClockTicksCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; height:100%; }
        ha-card { height:100%; position:relative; overflow:hidden; box-sizing:border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
      <ha-card></ha-card>
    `;
    this._config = {};
  }

  setConfig(config) {
    if (!config.entity) throw new Error("Erforderlich: 'entity'");
    this._config = {
      showSecondsSweep: true,
      fontSizePct: 30,
      outerBorderColor: "#FFFFFF",
      outerBorderWidth: 6,
      fontColor: "black",
      bgColor: "white",
      ...config,
    };
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  _renderSVG(state) {
    const c = this._config;
    const { showSecondsSweep, bgColor, outerBorderColor, outerBorderWidth, fontColor, fontSizePct } = c;
    const now = new Date();
    const secondsPhase = (now.getSeconds() + now.getMilliseconds() / 1000).toFixed(3);
    const negDelay = `-${secondsPhase}s`;

    // Sekunden-Sweep nur wenn aktiviert
    const secondsSweep = showSecondsSweep
      ? `
        <defs>
          <mask id="tick-mask">
            ${(() => {
              let mask = "";
              for (let i = 0; i < 60; i++) {
                const angle = i * 6;
                mask += `<line x1="98" y1="-200" x2="98" y2="50" transform="rotate(${angle}, 98, 58)" stroke="white" stroke-width="1.5" />`;
              }
              return mask;
            })()}
          </mask>
        </defs>
        <foreignObject width="120" height="120" style="mask: url(#tick-mask);">
          <div xmlns="http://www.w3.org/1999/xhtml">
            <div style="
              width: 250px;
              height: 250px;
              position: absolute;
              top: -60px;
              left: -60px;
              background: conic-gradient(grey, grey, black);
              animation: spin 60s linear infinite;
              animation-delay: ${negDelay};
              transform-origin: center;
              z-index: -1;
            "></div>
          </div>
        </foreignObject>
      `
      : "";

    const labelFontSize = (120 * (fontSizePct / 100)).toFixed(1) + "px";

    return `
      <svg viewBox="0 0 120 120" style="position:absolute;top:0;left:0;">
        ${secondsSweep}
        <rect x="10" y="10" width="100" height="100"
              fill="${bgColor}" stroke="${outerBorderColor}" stroke-width="${outerBorderWidth}"
              rx="25" ry="25"/>
        <text x="60" y="67" fill="${fontColor}" font-size="${labelFontSize}" font-family="sans-serif"
              text-anchor="middle" alignment-baseline="middle" dominant-baseline="middle">
          ${state ?? "—"}
        </text>
      </svg>
    `;
  }

  _update() {
    const card = this.shadowRoot.querySelector("ha-card");
    if (!card || !this._config) return;
    const entityId = this._config.entity;
    const state = this._hass?.states?.[entityId]?.state;
    const svg = this._renderSVG(state);
    card.innerHTML = svg;
  }
}
customElements.define("clock-ticks-card", ClockTicksCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "clock-ticks-card",
  name: "Clock Ticks Card",
  description: "Tick-Uhr mit optionaler Sekundenanzeige (Mask + conic-gradient, 60s Spin)",
});
