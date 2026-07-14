/*
 * openlamp-beat-card — a Lovelace control panel for the OpenLamp Beat add-on.
 *
 * WHY: the add-on (openlamp/ha-addon-beat) makes WLED lamps flash on an Ableton
 * Link / MIDI-clock tempo and publishes, via MQTT discovery, one switch + three
 * selects (Action, Couleur temps fort, Couleur autres temps). The raw HA form for
 * those is functional but ugly; this card turns them into a one-tap control surface:
 * a pulsing metronome toggle, the action as pills, a one/two-colour mode, and colour
 * swatches. Every tap calls the matching switch/select service — the add-on re-issues
 * the beat live, so a change lands on the next beat with no restart.
 *
 * "Une seule couleur" mode is purely card-side: it writes the SAME colour to both the
 * downbeat and off-beat selects, so the add-on flashes one uniform colour every beat.
 *
 * Pure client-side: no build step, self-contained vanilla web component, theme-aware,
 * mobile-first. Degrades gracefully to a hint when the add-on entities are absent.
 */

const VERSION = "0.2.1";

// The engine's colour vocabulary (beatsync COLORS_RGB / lamp.py). name → CSS colour +
// localized label. Order matches the MQTT select `options`.
const COLORS = [
  { key: "rouge",     rgb: "rgb(230,0,40)",    fr: "Rouge",      en: "Red" },
  { key: "bleu",      rgb: "rgb(0,100,200)",   fr: "Bleu",       en: "Blue" },
  { key: "vert",      rgb: "rgb(0,200,80)",    fr: "Vert",       en: "Green" },
  { key: "jaune",     rgb: "rgb(255,210,0)",   fr: "Jaune",      en: "Yellow" },
  { key: "orange",    rgb: "rgb(255,125,0)",   fr: "Orange",     en: "Orange" },
  { key: "violet",    rgb: "rgb(150,70,170)",  fr: "Violet",     en: "Purple" },
  { key: "rose",      rgb: "rgb(255,130,170)", fr: "Rose",       en: "Pink" },
  { key: "cyan",      rgb: "rgb(0,200,200)",   fr: "Cyan",       en: "Cyan" },
  { key: "magenta",   rgb: "rgb(200,0,200)",   fr: "Magenta",    en: "Magenta" },
  { key: "turquoise", rgb: "rgb(0,200,160)",   fr: "Turquoise",  en: "Turquoise" },
  { key: "bleuclair", rgb: "rgb(130,195,255)", fr: "Bleu clair", en: "Light blue" },
  { key: "blanc",     rgb: "rgb(255,255,255)", fr: "Blanc",      en: "White" },
];

const ACTIONS = [
  { key: "pulse", fr: "Pulse", en: "Pulse", icon: "☀", descFr: "Luminosité seule",           descEn: "Brightness only" },
  { key: "flash", fr: "Flash", en: "Flash", icon: "⚡", descFr: "Une couleur par temps",       descEn: "One colour per beat" },
  { key: "cycle", fr: "Cycle", en: "Cycle", icon: "🔄", descFr: "Alterne les couleurs",        descEn: "Cycle the colours" },
];

const T = {
  fr: {
    title: "OpenLamp Beat", tagline: "Tes lampes clignotent sur le tempo Ableton Link.",
    sync: "Suivi du beat", action: "Effet", on: "Actif", off: "Coupé",
    colorMode: "Couleurs", modeTwo: "Temps fort / faible", modeOne: "Une seule",
    downbeat: "Temps fort", offbeat: "Temps faibles", single: "Couleur",
    start: "Démarrer le beat", stop: "Arrêter le beat",
    missing: "Add-on OpenLamp Beat non détecté. Installe-le et démarre-le, puis la carte prendra le relais.",
    colorNote: "Le temps fort = le 1ᵉʳ temps de la mesure.",
    pulseNote: "En Pulse, seule la luminosité bat — les couleurs ne s'appliquent pas.",
    soon: "Bientôt : tempo & pairs Link en direct · sélection des lampes.",
  },
  en: {
    title: "OpenLamp Beat", tagline: "Your lamps flash on the Ableton Link tempo.",
    sync: "Beat sync", action: "Effect", on: "On", off: "Off",
    colorMode: "Colours", modeTwo: "Strong / weak beat", modeOne: "Single",
    downbeat: "Strong beat", offbeat: "Weak beats", single: "Colour",
    start: "Start the beat", stop: "Stop the beat",
    missing: "OpenLamp Beat add-on not detected. Install & start it, then this card takes over.",
    colorNote: "The strong beat = beat 1 of the bar.",
    pulseNote: "In Pulse, only brightness beats — colours don't apply.",
    soon: "Soon: live Link tempo & peers · per-lamp targeting.",
  },
};

// Default entity_ids as HA derives them from the add-on's (French) entity names.
// Override via the card's `entities:` config if renamed.
const DEFAULTS = {
  switch: "switch.openlamp_beat_beat_sync",
  action: "select.openlamp_beat_action",
  downbeat: "select.openlamp_beat_couleur_temps_fort",
  offbeat: "select.openlamp_beat_couleur_autres_temps",
};

class OpenLampBeatCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._built = false;
    this._colorMode = null;     // 'two' | 'one' — inferred once, then user-driven
  }

  static getStubConfig() { return { type: "custom:openlamp-beat-card", language: "fr" }; }

  setConfig(config) {
    this._config = {
      language: (config && config.language) || "fr",
      title: config && config.title,
      entities: Object.assign({}, DEFAULTS, (config && config.entities) || {}),
    };
    this._built = false;
    if (this._hass) this._render();
  }

  set hass(hass) { this._hass = hass; this._render(); }
  getCardSize() { return 6; }

  _t(k) { return (T[this._config.language] || T.fr)[k]; }
  _lang() { return this._config.language === "en" ? "en" : "fr"; }
  _st(id) { return this._hass && this._hass.states[id]; }
  _callSelect(entity, option) { if (this._hass) this._hass.callService("select", "select_option", { entity_id: entity, option }); }
  _toggleSwitch(entity, on) { if (this._hass) this._hass.callService("switch", on ? "turn_on" : "turn_off", { entity_id: entity }); }

  _render() {
    if (!this._config || !this._hass) return;
    if (!this._built) { this._buildSkeleton(); this._built = true; }
    this._patch();
  }

  _buildSkeleton() {
    const lang = this._lang();
    const style = `
      <style>
        :host { display: block; }
        .card {
          background: var(--ha-card-background, var(--card-background-color, #fff));
          border-radius: var(--ha-card-border-radius, 14px);
          box-shadow: var(--ha-card-box-shadow, none);
          border: var(--ha-card-border-width, 1px) solid var(--divider-color, #e0e0e0);
          padding: 18px; color: var(--primary-text-color);
          font-family: var(--paper-font-body1_-_font-family, Roboto, system-ui, sans-serif);
        }
        .missing { color: var(--secondary-text-color); font-size: 14px; line-height: 1.5; }
        .head { display: flex; align-items: center; gap: 14px; }
        .metro {
          flex: 0 0 auto; width: 58px; height: 58px; border-radius: 50%;
          border: none; cursor: pointer; font-size: 26px; line-height: 58px; text-align: center;
          background: var(--disabled-color, #9e9e9e); color: #fff; transition: background .2s, box-shadow .2s;
          -webkit-tap-highlight-color: transparent;
        }
        .metro.on { background: var(--primary-color, #03a9f4);
          animation: beat var(--beat-ms, 1000ms) ease-in-out infinite; }
        @keyframes beat {
          0%,100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary-color, #03a9f4) 45%, transparent); transform: scale(1); }
          50%     { box-shadow: 0 0 0 11px transparent; transform: scale(1.07); }
        }
        .titles { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .titles .t1 { font-size: 19px; font-weight: 680; letter-spacing: -.01em; }
        .titles .tag { font-size: 12.5px; color: var(--secondary-text-color); line-height: 1.35; }
        .titles .t2 { font-size: 12.5px; font-weight: 600; }
        .t2 .st { display: inline-flex; align-items: center; gap: 6px; }
        .t2 .st .d { width: 8px; height: 8px; border-radius: 50%; background: var(--disabled-color, #9e9e9e); }
        .t2.on .st .d { background: var(--success-color, #43a047); }
        .t2.on { color: var(--success-color, #43a047); }
        .t2.off { color: var(--secondary-text-color); }

        .power {
          width: 100%; margin-top: 16px; border: none; cursor: pointer; border-radius: 13px; padding: 15px;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          font: inherit; font-size: 15.5px; font-weight: 680;
          background: var(--primary-color, #03a9f4); color: var(--text-primary-color, #fff);
          -webkit-tap-highlight-color: transparent; transition: filter .15s, transform .05s;
        }
        .power:hover { filter: brightness(1.06); }
        .power:active { transform: translateY(1px); }
        .power.on { background: transparent; color: var(--primary-text-color); border: 1.5px solid var(--divider-color, #e0e0e0); }

        .section { margin-top: 20px; }
        .label { font-size: 12px; font-weight: 680; color: var(--secondary-text-color);
                 text-transform: uppercase; letter-spacing: .06em; margin-bottom: 9px; }

        .seg { display: flex; padding: 3px; gap: 3px; background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
               border-radius: 11px; }
        .seg button { flex: 1; border: none; background: transparent; cursor: pointer; border-radius: 8px;
          padding: 9px 6px; font: inherit; font-size: 13px; font-weight: 620; color: var(--secondary-text-color);
          min-height: 40px; transition: background .14s, color .14s, box-shadow .14s; -webkit-tap-highlight-color: transparent; }
        .seg button.active { background: var(--ha-card-background, var(--card-background-color, #fff)); color: var(--primary-text-color);
          box-shadow: 0 1px 3px rgba(0,0,0,.14); }

        .pills { display: flex; gap: 8px; flex-wrap: wrap; }
        .pill { flex: 1 1 0; min-width: 92px; min-height: 54px; border-radius: 10px; cursor: pointer;
          border: 1.5px solid var(--divider-color, #e0e0e0); background: transparent; color: var(--primary-text-color);
          padding: 6px 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
          transition: border-color .15s, background .15s; -webkit-tap-highlight-color: transparent; }
        .pill .pt { font-size: 14.5px; font-weight: 640; }
        .pill .pd { font-size: 10.5px; color: var(--secondary-text-color); line-height: 1.2; text-align: center; }
        .pill.active { border-color: var(--primary-color, #03a9f4);
          background: color-mix(in srgb, var(--primary-color, #03a9f4) 12%, transparent); }

        .crow { margin-top: 14px; }
        .crow .label { display: flex; align-items: center; gap: 8px; }
        .crow .ref { width: 13px; height: 13px; border-radius: 50%; border: 1.5px solid var(--divider-color, #e0e0e0); }
        .swatches { display: flex; flex-wrap: wrap; gap: 10px; }
        .swatch { width: 42px; height: 42px; border-radius: 50%; cursor: pointer; position: relative;
          border: 2px solid var(--divider-color, #e0e0e0); box-sizing: border-box; padding: 0; background-clip: padding-box;
          -webkit-tap-highlight-color: transparent; transition: transform .1s; }
        .swatch:active { transform: scale(.9); }
        .swatch.active { border-color: var(--primary-text-color); box-shadow: 0 0 0 3px var(--primary-color, #03a9f4); }
        .swatch.active::after { content: "✓"; position: absolute; inset: 0; display: grid; place-items: center;
          font-size: 19px; font-weight: 800; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.55); }

        .note { font-size: 12px; color: var(--secondary-text-color); margin-top: 10px; }
        .soon { font-size: 11.5px; color: var(--secondary-text-color); opacity: .8; margin-top: 16px;
          padding-top: 12px; border-top: 1px solid var(--divider-color, #e0e0e0); }
        .colors.disabled .swatches, .colors.disabled .seg { opacity: .4; pointer-events: none; }
        [hidden] { display: none !important; }
        @media (max-width: 420px) { .pill { min-width: 0; } .swatch, .swatch::after { width: 40px; height: 40px; } }
        @media (prefers-reduced-motion: reduce) { .metro.on { animation: none; } }
      </style>`;

    const actionPills = ACTIONS.map(a => `
      <button class="pill" data-action="${a.key}" type="button">
        <span class="pt">${a.icon} ${a[lang]}</span>
        <span class="pd">${a["desc" + (lang === "en" ? "En" : "Fr")]}</span>
      </button>`).join("");

    const swatches = (row) => COLORS.map(c => `
      <button class="swatch" type="button" data-row="${row}" data-color="${c.key}"
        title="${c[lang]}" aria-label="${c[lang]}" style="background:${c.rgb};"></button>`).join("");

    this.shadowRoot.innerHTML = `${style}
      <ha-card class="card">
        <div class="missing" hidden></div>
        <div class="body">
          <div class="head">
            <button class="metro" type="button" title="${this._t("sync")}">♪</button>
            <div class="titles">
              <span class="t1">${this._config.title || this._t("title")}</span>
              <span class="tag">${this._t("tagline")}</span>
              <span class="t2 off"><span class="st"><span class="d"></span><span class="stlbl"></span></span></span>
            </div>
          </div>

          <button class="power" type="button"><span class="pmetro">▶</span><span class="plbl"></span></button>

          <div class="section">
            <div class="label">${this._t("action")}</div>
            <div class="pills">${actionPills}</div>
          </div>

          <div class="section colors">
            <div class="label">${this._t("colorMode")}</div>
            <div class="seg" data-modeseg>
              <button type="button" data-mode="two">${this._t("modeTwo")}</button>
              <button type="button" data-mode="one">${this._t("modeOne")}</button>
            </div>

            <div class="rows-two">
              <div class="crow">
                <div class="label"><span class="ref" data-ref="downbeat"></span>${this._t("downbeat")}</div>
                <div class="swatches" data-swrow="downbeat">${swatches("downbeat")}</div>
              </div>
              <div class="crow">
                <div class="label"><span class="ref" data-ref="offbeat"></span>${this._t("offbeat")}</div>
                <div class="swatches" data-swrow="offbeat">${swatches("offbeat")}</div>
              </div>
              <div class="note">${this._t("colorNote")}</div>
            </div>

            <div class="rows-one" hidden>
              <div class="crow">
                <div class="label"><span class="ref" data-ref="single"></span>${this._t("single")}</div>
                <div class="swatches" data-swrow="single">${swatches("single")}</div>
              </div>
            </div>

            <div class="note pulsenote" hidden>${this._t("pulseNote")}</div>
          </div>

          <div class="soon">🔜 ${this._t("soon")}</div>
        </div>
      </ha-card>`;

    // metronome + power both toggle the switch
    const toggle = () => {
      const s = this._st(this._config.entities.switch);
      this._toggleSwitch(this._config.entities.switch, !(s && s.state === "on"));
    };
    this.shadowRoot.querySelector(".metro").addEventListener("click", toggle);
    this.shadowRoot.querySelector(".power").addEventListener("click", toggle);

    this.shadowRoot.querySelectorAll(".pill").forEach(p =>
      p.addEventListener("click", () => this._callSelect(this._config.entities.action, p.dataset.action)));

    // colour mode segmented
    this.shadowRoot.querySelectorAll("[data-mode]").forEach(b =>
      b.addEventListener("click", () => { this._colorMode = b.dataset.mode; this._patch(); }));

    // swatch taps: two-colour rows write their own select; single row writes BOTH.
    this.shadowRoot.querySelectorAll(".swatch").forEach(sw =>
      sw.addEventListener("click", () => {
        const row = sw.dataset.row, color = sw.dataset.color, e = this._config.entities;
        if (row === "single") { this._callSelect(e.downbeat, color); this._callSelect(e.offbeat, color); }
        else { this._callSelect(e[row], color); }
      }));
  }

  _patch() {
    const e = this._config.entities;
    const sw = this._st(e.switch), act = this._st(e.action);
    const down = this._st(e.downbeat), off = this._st(e.offbeat);

    const missingEl = this.shadowRoot.querySelector(".missing");
    const bodyEl = this.shadowRoot.querySelector(".body");
    if (!sw || !act) { missingEl.hidden = false; missingEl.textContent = this._t("missing"); bodyEl.hidden = true; return; }
    missingEl.hidden = true; bodyEl.hidden = false;

    // running state → metronome, power button, status line
    const on = sw.state === "on";
    const metro = this.shadowRoot.querySelector(".metro");
    metro.classList.toggle("on", on); metro.textContent = on ? "♫" : "♪";
    const power = this.shadowRoot.querySelector(".power");
    power.classList.toggle("on", on);
    power.querySelector(".pmetro").textContent = on ? "■" : "▶";
    power.querySelector(".plbl").textContent = on ? this._t("stop") : this._t("start");
    const t2 = this.shadowRoot.querySelector(".t2");
    t2.classList.toggle("on", on); t2.classList.toggle("off", !on);
    t2.querySelector(".stlbl").textContent = this._t("sync") + " · " + (on ? this._t("on") : this._t("off"));

    // action pills
    const action = act.state;
    this.shadowRoot.querySelectorAll(".pill").forEach(p => p.classList.toggle("active", p.dataset.action === action));

    // colour mode: infer once from equality, then honour user choice
    if (this._colorMode === null) this._colorMode = (down && off && down.state === off.state) ? "one" : "two";
    const one = this._colorMode === "one";
    this.shadowRoot.querySelectorAll("[data-mode]").forEach(b => b.classList.toggle("active", b.dataset.mode === (one ? "one" : "two")));
    this.shadowRoot.querySelector(".rows-two").hidden = one;
    this.shadowRoot.querySelector(".rows-one").hidden = !one;

    // pulse dims the whole colour block
    const colorsEl = this.shadowRoot.querySelector(".colors");
    const isPulse = action === "pulse";
    colorsEl.classList.toggle("disabled", isPulse);
    this.shadowRoot.querySelector(".pulsenote").hidden = !isPulse;

    // selected swatches + colour reference dots
    const mark = (row, val) => this.shadowRoot.querySelectorAll(`.swatch[data-row="${row}"]`)
      .forEach(s => s.classList.toggle("active", s.dataset.color === (val && val.state)));
    mark("downbeat", down); mark("offbeat", off); mark("single", down);
    const rgbOf = (k) => { const c = COLORS.find(x => x.key === k); return c ? c.rgb : "transparent"; };
    const setRef = (name, val) => { const el = this.shadowRoot.querySelector(`.ref[data-ref="${name}"]`); if (el && val) el.style.background = rgbOf(val.state); };
    setRef("downbeat", down); setRef("offbeat", off); setRef("single", down);
  }
}

customElements.define("openlamp-beat-card", OpenLampBeatCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "openlamp-beat-card",
  name: "OpenLamp Beat Card",
  description: "Control panel for the OpenLamp Beat add-on (beat sync + colour swatches).",
  preview: false,
});

console.info(`%c openlamp-beat-card %c v${VERSION} `,
  "color:#fff;background:#5560f0;border-radius:3px 0 0 3px;padding:2px 4px",
  "color:#5560f0;background:#eee;border-radius:0 3px 3px 0;padding:2px 4px");
