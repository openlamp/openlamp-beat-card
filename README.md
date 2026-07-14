# OpenLamp Beat Card

> **You have Ableton Live and Home Assistant? Make your lamps flash on the tempo.**

A Lovelace control panel for the [**OpenLamp Beat** add-on](https://github.com/openlamp/ha-addon-beat) —
it turns the add-on's raw entities (a switch + three selects) into a one-tap surface: a pulsing
metronome toggle, the effect as pills, a one/two-colour mode, and colour swatches. Every tap calls
the matching `switch`/`select` service, and the add-on re-issues the beat **live** — a colour change
lands on the next beat with no restart.

[![Open in HACS](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/)
![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Lovelace-41BDF5.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

Pure client-side: a self-contained vanilla web component — no build step, theme-aware (light & dark),
mobile-first. It degrades gracefully to a hint when the add-on isn't running.

---

## What you need

1. The **[OpenLamp Beat add-on](https://github.com/openlamp/ha-addon-beat)** installed and started
   (it publishes the entities this card drives, via MQTT discovery). The add-on itself needs the
   **Mosquitto** broker add-on and one or more **WLED** lamps.
2. An **Ableton Link** session on your LAN (Ableton Live, or any Link-capable app) — that's the tempo.

> No WLED lamp yet? Many ESP8266/ESP32 LED controllers convert to WLED by flashing them from your
> browser — [install.wled.ge](https://install.wled.ge/).

## Install (HACS)

This card isn't in the HACS default store yet, so add it as a **custom repository**:

1. HACS → **⋮** (top-right) → **Custom repositories**.
2. Repository: `https://github.com/openlamp/openlamp-beat-card` · Category: **Dashboard**.
3. Add, then find **OpenLamp Beat Card** in HACS and **Download**.
4. HACS registers the resource for you. Refresh your browser (hard-reload) once.

### Manual install (without HACS)

1. Copy `openlamp-beat-card.js` into `config/www/`.
2. Register it as a dashboard resource — in `configuration.yaml`:
   ```yaml
   frontend:
     extra_module_url:
       - /local/openlamp-beat-card.js?v=0.2.1
   ```
   (or Settings → Dashboards → ⋮ → Resources → add `/local/openlamp-beat-card.js` as a JS module).
3. Restart Home Assistant.

## Use it

Add the card to any dashboard:

```yaml
type: custom:openlamp-beat-card
language: fr        # fr (default) | en
```

Tap the metronome (or the **Start/Stop** button) to follow the beat; pick the **effect**
(Pulse / Flash / Cycle); choose **one colour for everything** or a distinct **strong-beat / weak-beat**
colour. The strong beat is beat 1 of the bar.

## Options

| Option | Default | Description |
|---|---|---|
| `language` | `fr` | UI language — `fr` or `en`. |
| `title` | add-on name | Override the card title. |
| `entities` | *(auto)* | Override the entity ids (see below) if you renamed them. |

The card targets the add-on's default entities:

```yaml
type: custom:openlamp-beat-card
entities:
  switch:   switch.openlamp_beat_beat_sync
  action:   select.openlamp_beat_action
  downbeat: select.openlamp_beat_couleur_temps_fort
  offbeat:  select.openlamp_beat_couleur_autres_temps
```

## Roadmap

- 🔜 Live **Link telemetry** on the card — tempo (BPM), bar phase, number of peers (all available from
  Ableton Link via the add-on).
- 🔜 **Per-lamp targeting** (all lamps / a subset).

## Part of OpenLamp

- Add-on: [openlamp/ha-addon-beat](https://github.com/openlamp/ha-addon-beat)
- Engine: [openlamp/engine](https://github.com/openlamp/engine) · beatsync: [openlamp/midi](https://github.com/openlamp/midi)
- Companion card for WLED palettes/effects: [openlamp/wled-assets-card](https://github.com/openlamp/wled-assets-card)

## License

[MIT](LICENSE) © 2026 Benoît Besson (OpenLamp)
