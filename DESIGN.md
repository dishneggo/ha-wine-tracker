# Design System - Wine Tracker

> **Single Source of Truth** für alle UI-Entscheidungen der Wine-Tracker-App (Templates + `style.css` + `theme.js`). Konsolidiert aus der vollständigen Ist-Aufnahme vom 18.10.2026 - dokumentiert den Bestand, legt Ziel-Skalen fest und führt die Migrationsliste. Das frühere `STYLE_GUIDE.md` ist vollständig in dieses Dokument aufgegangen.
>
> **Geltung:** Neue UI-Arbeit folgt den Ziel-Werten dieses Dokuments. Bestehender Code, der abweicht, steht in `## Known Gaps & Migration` - er wird beim nächsten Anfassen der Stelle migriert, nicht flächig umgebaut.
>
> **Für Codegen + Audits:** Die maschinenlesbare Token-Schicht steht im JSONC-Block unter `## Tokens (machine-readable)`. Audits lesen diesen Block, nicht die Prosa.
>
> Nicht Geltungsbereich: `docs/index.html` (Landing Page, eigenes Token-Set) und `wine-tracker-dev/` (generierter Spiegel).

## Overview

Wine Tracker ist eine Flask-App mit klassischem Server-Rendering und einer handgeschriebenen CSS-Schicht ohne Framework. Das System ruht auf **10 Kern-Tokens** (`--bg --surface --border --accent --accent2 --gold --text --muted --empty --shadow`), die in **6 Themes × Hell/Dunkel** (12 Sets) vollständig definiert sind. Dazu kommen die themenunabhängigen **Weintyp-Farben** (`--wine-*`), `--radius` und neu die **semantischen Tokens** (`--danger --success --warning --on-accent --overlay*`).

- **Default-Theme ist `homeassistant`**, Modus-Default ist `system` (prefers-color-scheme). Dark ist die `:root`-Basis, Light die Klasse `html.light`, Themes via `html[data-theme]` (Classic ohne Attribut).
- **Schrift:** System-Stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`), keine Webfonts. `monospace` ist reserviert für technische Identifier (API-Keys, Modell-IDs, Vivino-IDs). Icons: Material Design Icons (MDI-Webfont via CDN), Grösse über `font-size`.
- **Flächenlogik:** `--bg` ist das Canvas, `--surface` trägt Karten/Modals/Panels, `--empty` markiert Leerzustände. Trennung über 1px `--border`-Linien und Flächenwechsel, Schatten nur für echte Elevation.
- **`--accent` ist die Aktionsfarbe** (Primär-Buttons, aktive Zustände, FAB, Links), `--accent2` ihre dunklere Hover-Stufe für Flächen. `--gold` ist die Auszeichnungsfarbe für Wein-Wertigkeit (Sterne, Preise, Flaschen-Badges) - im HA-Theme ein Orange.
- **Erreichbarkeit:** WCAG AA (4.5:1 Text, 3:1 UI-Komponenten) ist verbindliches Ziel in allen 12 Sets. Bekannte Verstösse stehen in der Migrationsliste.

## Design Principles

1. **Ein Token, eine Rolle.** Farbe, Radius, Schatten, Abstand und Dauer kommen aus der Token-/Skalen-Schicht; Code referenziert den Namen, nie ein Inline-Literal. Was die Skala nicht hergibt, wird nicht erfunden, sondern hier ergänzt.
2. **Jede Rolle hat genau eine Komponente.** Es gibt EINEN Primär-Button, EINEN Sekundär-Button, EIN Input-Rezept, EIN Popover-Rezept. Varianten entstehen über Modifier, nicht über neue Parallel-Klassen.
3. **12 Sets oder gar nicht.** Jede Farbentscheidung wird gegen alle 6 Themes × Hell/Dunkel getroffen. Ein Wert, der nur im Dark-Mode funktioniert, bekommt ein Hell/Dunkel-Paar.
4. **Accent handelt, Gold adelt.** `--accent` markiert Aktionen und aktive Zustände, `--gold` ausschliesslich Wein-Wertigkeit. Die beiden tauschen nie die Rolle.
5. **AA ist nicht verhandelbar.** Text 4.5:1, UI-Komponenten 3:1 - in jedem Set. Wo eine Themefarbe das verfehlt, wird die Farbe justiert oder ein `--on-accent`-Override gesetzt, nicht die Schwelle aufgeweicht.
6. **Touch zuerst.** Hover ist Verstärkung, nie Informationsträger; Hover-Stile stehen hinter `@media (hover: hover)`. `:active`, `:disabled` und `:focus-visible` sind Pflichtzustände interaktiver Komponenten.

## Tokens (machine-readable)

```jsonc
{
  "$id": "design-tokens/wine-tracker",
  "meta": {
    "defaultTheme": "homeassistant",
    "defaultMode": "system",
    "themeStrategy": ":root = dark base; html.light; html[data-theme=x]; classic = no attribute",
    "fontStrategy": "system stack, no webfonts; monospace only for technical identifiers"
  },
  "requirements": {
    "darkMode": true,          // alle 6 Themes je Hell + Dunkel
    "responsive": true,        // Breakpoints siehe unten
    "a11y": "WCAG AA"          // 4.5:1 Text, 3:1 UI, focus-visible Pflicht
  },
  // 10 Kern-Tokens x 12 Sets (Theme: [dark, light])
  "themes": {
    "tokens": ["bg", "surface", "border", "accent", "accent2", "gold", "text", "muted", "empty"],
    "classic":       { "dark": ["#1a0a0f","#2a1520","#5a2a3a","#c0392b","#8b1a2a","#d4a843","#f0e0e5","#9a7a82","#3a2a30"],
                       "light": ["#f5f0eb","#ffffff","#ddd0c8","#a03025","#7a1520","#9a7a20","#2a1a10","#7a6a60","#ece5de"] },
    "vineyard":      { "dark": ["#0f1a12","#1a2a1e","#3a5a3e","#4caf50","#2e7d32","#c9a84c","#e0f0e5","#7a9a80","#253525"],
                       "light": ["#f0f5ef","#ffffff","#c5d8c5","#388e3c","#2e7d32","#8a7a25","#1a2a1a","#607a60","#e0ece0"] },
    "champagne":     { "dark": ["#1a1508","#2a2418","#5a4a35","#c9a84c","#a08030","#d4a843","#f0ebe0","#9a8a70","#352e20"],
                       "light": ["#faf8f0","#ffffff","#e0d8c5","#a08030","#806520","#9a7a20","#2a2510","#807560","#f0ebe0"] },
    "slate":         { "dark": ["#12151c","#1c2030","#3a4058","#5c7cfa","#4263d8","#c9a84c","#dde0f0","#7a82a0","#252838"],
                       "light": ["#f0f2f8","#ffffff","#c8cee0","#4263d8","#3050b8","#7a7a30","#1a1e30","#606880","#e2e5f0"] },
    "burgundy":      { "dark": ["#180a1c","#281525","#58284e","#ab47bc","#8e24aa","#d4a843","#f0e0f2","#9a7a95","#301a30"],
                       "light": ["#f8f0f8","#ffffff","#ddc5dd","#9c27b0","#7b1fa2","#8a6a30","#2a1a2c","#7a6080","#ece0ee"] },
    "homeassistant": { "dark": ["#111111","#1c1c1c","#3a3a3a","#009ac7","#006787","#ff9800","#e1e1e1","#9b9b9b","#282828"],
                       "light": ["#fafafa","#ffffff","#cccccc","#006787","#004156","#c94e00","#141414","#5e5e5e","#e6e6e6"] }
  },
  "shadowToken": { "dark": "0 4px 24px rgba(0,0,0,.5)", "light": "0 4px 24px rgba(0,0,0,.1)" },
  // NEU: semantische Tokens, themenuebergreifend als Hell/Dunkel-Paar
  "semantic": {
    "danger":   { "dark": "#e74c3c", "light": "#c0392b" },
    "success":  { "dark": "#27ae60", "light": "#1e8449" },
    "warning":  { "dark": "#e67e22", "light": "#b45309" },
    "onAccent": "#ffffff",            // Ziel; Themes, deren Accent AA verfehlt, justieren den Accent (siehe Migration)
    "overlay":        "rgba(0,0,0,.75)",   // Modal-Scrim
    "overlayStrong":  "rgba(0,0,0,.92)",   // Lightbox
    "overlaySoft":    "rgba(0,0,0,.6)"     // Dialog-auf-Modal
  },
  "wineColors": {
    "rotwein": "#803039", "weisswein": "#f4ca4f", "rose": "#ffd1d8", "schaumwein": "#f3efaf",
    "dessertwein": "#eb7a17", "likoerwein": "#800f1c", "anderes": "#6c3461", "empty": "#aaa"
  },
  "scales": {
    "fontSize":  [".65rem", ".7rem", ".75rem", ".8rem", ".85rem", ".9rem", ".95rem", "1rem", "1.1rem", "1.25rem", "1.5rem", "2rem"],
    "fontWeight": [400, 500, 600, 700],
    "spacing":   [".25rem", ".5rem", ".75rem", "1rem", "1.25rem", "1.5rem", "2rem", "2.5rem"],
    "radius":    { "container": "12px", "popover": "10px", "control": "8px", "item": "6px", "tag": "4px", "pill": "999px", "circle": "50%" },
    "controlHeight": { "bar": "56px", "control": "38px", "iconButton": "34px", "iconButtonMobile": "30px", "toggle": "24px" },
    "zIndex":    { "inCard": 2, "stickyHeader": 100, "tabBar": 140, "fabPopover": 150, "chatPanel": 160, "modal": 200, "dialogOnModal": 220, "lightbox": 300, "tooltip": 500, "dropdown": 1000, "toast": 9999, "modalDropdown": 10000 },
    "motionMs":  { "hoverColor": 150, "standard": 200, "layout": 250, "fade": 400 },
    "shadow":    { "elevation": "var(--shadow)", "floating": "0 8px 24px rgba(0,0,0,.4)", "toast": "0 4px 16px rgba(0,0,0,.3)" }
  },
  "breakpoints": { "phone": 500, "mobileNav": 600, "modalWide": 700, "chatSidebar": 768, "navCollapse": 800, "tableTrim": 900 }
}
```

## Colors

- **Kern-Tokens** siehe Theme-Matrix oben. `--accent2` ist in allen Sets dunkler als `--accent` und dient als **Hover-Fläche** für solide Accent-Elemente. Als Hover-**Textfarbe** ist `--accent2` im Dark-Mode verboten (zu dunkel auf dunklem Grund, Kontrast bis 1.9:1) - Hover-Text wechselt stattdessen auf `--text` oder `--accent`.
- **Semantik:** `--danger`/`--success`/`--warning` ersetzen schrittweise die ~30 hardcodierten `#e74c3c`/`#27ae60`/`#e67e22`-Stellen; jede Verwendung bekommt damit automatisch die Light-Variante. Danger-Flächen (Delete-Button) nutzen die Light-Werte als BG mit `--on-accent`-Text.
- **Hover-Tints:** `color-mix(in srgb, var(--accent) 10%, transparent)` ist der Standard-Tint für Listen-/Item-Hover. Schwarz-/Weiss-Alpha-Tints sind abgelöst (sie versagen je nach Modus; die Nav nutzt heute schwarzes Alpha im Dark-Mode - Migrationsliste).
- **Overlays:** `--overlay` (Modal), `--overlay-strong` (Lightbox), `--overlay-soft` (Dialog über Modal). Keine weiteren Scrim-Werte.
- **Weintyp-Farben** (`--wine-*`) sind Datenfarben für Ribbons, Dots, Charts - sie sind in allen Themes identisch und werden nicht für UI-Zustände verwendet. Ribbon-Text: `#333` auf hellen Typen (Weiss-/Rosé-/Schaumwein), sonst `#fff`.
- **Theme-Vorschaufarben** (Settings-Dropdown) sind bewusst hardcodiert `[bg-dark, accent-dark, gold-dark]` - einzige erlaubte Hex-Duplikation, da sie alle Themes gleichzeitig zeigen.

## Typography

- **Familie:** System-Stack auf `body`; `font-family: inherit` auf allen Form-Controls (globale Regel - Migrationsliste). `monospace` nur für technische Identifier.
- **Ziel-Skala** (12 Stufen): `.65 / .7 / .75 / .8 / .85 / .9 / .95 / 1 / 1.1 / 1.25 / 1.5 / 2rem`. Grössere Werte (2.5-4rem) nur für Icon-Platzhalter und Empty-States. Die Zwischenwerte des Bestands (`.72 .78 .82 .88 .92 .97 1.05 1.15 1.2rem`, `10px`) sind deprecated und werden beim Anfassen auf den nächsten Skalenwert gerundet.
- **Rollen:** `.85rem` UI-Standard (Nav, Tabs, Tabellen, Chips) · `.9rem` Eingaben und Dialog-Buttons · `.8rem` Labels und Nebentext · `.7rem` Uppercase-Sektions-Titel (+ `letter-spacing .05em`) · `.75rem` Datenchips · `1.1rem` Modal-Header und Icon-Buttons.
- **Gewichte:** 400 Fliesstext · 500 Navigation · 600 Buttons, Tabellen-Header, aktive Sekundärelemente · 700 Primär-Buttons, Karten-/Modal-Titel, aktive Navigation. 800 nur für Statistik-Grosszahlen.
- **Uppercase-Label-Rezept:** `.7rem / 600 / uppercase / letter-spacing .05em / --muted` - gilt für alle Sektions-Titel (Settings, Filter, Tabelle vereinheitlichen → Migrationsliste).

## Spacing & Layout

- **Raster:** 4px-Basis; Skala `.25 / .5 / .75 / 1 / 1.25 / 1.5 / 2 / 2.5rem`. Komponenten-Feinwerte (`.35 .4 .6rem`) sind innerhalb von Komponenten-Rezepten erlaubt, neue Layout-Abstände kommen aus der Skala. px-Abstände nur für 1px-Linien und 2-6px-Mikrodetails.
- **Kernrezepte:** Input-Padding `.55rem .75rem` · Button-Padding `0 1.2rem` (bei fester Höhe) bzw. `.6rem 1rem` · Card-Body `.75rem 1rem` · Modal-Header `1rem 1.25rem` · Modal-Body `1.25rem` (gap `.9rem`) · Modal-Footer `0 1.25rem 1.25rem` (gap `.75rem`) - gilt als Basisregel für ALLE Modals (Abweichler in Migrationsliste).
- **Container:** Inhaltsseiten (Stats/Timeline) max-width 900px, padding 1.5rem. Karten-Grid `1.25rem 1.5rem`, gap 1rem, padding-bottom 5rem (FAB-Raum).
- **Safe-Area:** `env(safe-area-inset-bottom)` an Tab-Bar, FAB und Chat-Seite - **ausser** `body.embedded` (HA-Ingress übernimmt die Safe-Area selbst).

## Shape (Radius)

| Stufe | Wert | Verwendung |
|---|---|---|
| container | `var(--radius)` = 12px | Karten, Modals, Panels, Stat-Cards, Chat-Panel |
| popover | 10px | Popover, Dropdown-Listen, Tooltips, Chat-Bubbles, Akkordeon-Gruppen |
| control | 8px | Buttons, Inputs, Selects, Toasts, Nav-Hover-Fläche, Segmente |
| item | 6px | Listenzeilen-Hover, kleine Icon-Buttons in Kontexten, Bar-Tracks |
| tag | 4px | Datenchips (card-meta/-extra), Food-Tags, Mini-Thumbnails |
| pill | 999px | Zähl-Badges, Filter-Chips, Mengen-Badge |
| circle | 50% | FAB, Spinner, Dots, Toggle-Knopf, runde Chat-Buttons |

Ausreisser im Bestand (20px qty-badge, 24px Toggle-Slider, 16px-Badge mit r8, 12px-Literal im Login) → Migrationsliste; Toggle behält seine Kapselform über `pill`.

## Elevation & Depth

| Stufe | Wert | Verwendung |
|---|---|---|
| elevation | `var(--shadow)` | Header, Karten-Hover, Modals, Dropdown-Listen |
| floating | `0 8px 24px rgba(0,0,0,.4)` | Popover, Tooltips (frei schwebend über Inhalt) |
| toast | `0 4px 16px rgba(0,0,0,.3)` | Toasts, FAB-Ruhezustand |

Sonderfälle bleiben benannt: Lightbox-Bild `0 0 40px .6`, Chat-Panel `0 8px 32px .45`, Fokus-/Auswahl-Ringe über `box-shadow: 0 0 0 1-2px`. Die übrigen Streuwerte (Nav-Menu `.15`, Stock-Tooltip `.25`, Ribbon) werden auf die drei Stufen migriert.

## Motion

- **Dauern:** 150ms Farb-/Text-Hover · 200ms Standard (Border, Transform, Fläche) · 250ms Layoutwechsel (Modalbreite, Panels, `--kb-inset`) · 400ms Ein-/Ausblenden (Toasts, Bilder). Laufende Animationen: Spinner .8-1s linear, Chat-Dots 1.2s, Shimmer 1.8s, Glow 2s.
- **Easing:** `ease` als Default, `linear` nur für Endlos-Rotation.
- **Regeln:** `transition: all` ist verboten (Eigenschaften explizit benennen - 12 Bestandsstellen in Migrationsliste). `@media (prefers-reduced-motion: reduce)` deaktiviert Shimmer, Glow, Scale-Effekte und Transitions > 200ms - **neu, Pflicht** (Migrationsliste).

## Components

### Buttons

| Rolle | Kanonische Klasse | Rezept |
|---|---|---|
| Primär | `.btn-submit` | BG `--accent`, Text `--on-accent`, h38, r8, `.95rem/700`, Hover BG `--accent2`, `:disabled` opacity .5 |
| Sekundär | `.btn-cancel` | BG `--bg`, 1px `--border`, Text `--text`, r8, `.9rem/600`, Hover Border `--accent` + BG `--surface` |
| Danger | `.btn-delete` | BG `--danger`(light-Wert), Text `--on-accent`, sonst wie Sekundär-Geometrie |
| Icon (Header) | 34×34 (mobil 30×30), outlined, r8, Icon 1.1rem | Hamburger, Theme, Filter, Chat-Header |
| Icon (Form) | 38×38, r8 bzw. r6 im Bildkontext | Reload-Trigger, Img-Actions |
| FAB | 56er Kreis, `--accent`/`--on-accent`, shadow toast, Hover `--accent2` + scale 1.05, Active scale .92 | |
| Text-Button | ohne BG, `--gold` oder `--muted`, Hover-Tint accent 10% | Toast-Undo, Popover-Buttons |

`.btn-primary`/`.btn-secondary` (adv-Filter) und `.ai-btn` sind **deprecated Aliase** - sie migrieren auf das Trio oben. Pflichtzustände überall: `:active`, `:disabled`, `:focus-visible`.

### Inputs & Controls

- **Rezept:** BG `--bg`, 1px `--border`, r8, h38, Padding `.55rem .75rem`, `.9rem`, `font-family: inherit`. Focus: `border-color: --accent` **plus** `:focus-visible`-Ring (`0 0 0 2px color-mix(accent 40%)`) - Ring neu, Pflicht (Migrationsliste). `--surface` als Input-BG ist deprecated (6 Stellen).
- Technische Identifier (Keys, Modell-IDs): zusätzlich `monospace .85rem`.
- Toggle: 44×24 Kapsel, aus `--muted`, an `--accent`; Radios/Checkboxen nativ mit `accent-color: --accent`; Sterne-Input 1.5rem `--border`→`--gold`.
- Dropzonen (Bild-Upload): gestrichelt, Hover Border `--accent` + Tint 5%.

### Modals

- Basis: Overlay `--overlay` z200, `.modal` auf `--surface` mit `--radius`, `--shadow`, max-height 90vh; Header sticky `1rem 1.25rem/1.1rem/700`; Body `1.25rem` gap `.9rem`; Footer `0 1.25rem 1.25rem` gap `.75rem`.
- **Breitenraster:** 360 (Bestätigungen) · 480 (Standard: View, Settings, Name-Dialog) · 640 (Advanced Filter, Import) · 900 (ab min-width 700: Wine/View/Settings mit Foto- bzw. Breitlayout). 560/600-Zwischenwerte migrieren auf das Raster.
- **Mobil:** Settings und Advanced Filter gehen unter 500/600px in Fullscreen (`100dvh`, r0) - das ist das Zielmuster für alle komplexen Modals; Bestätigungs-Modals bleiben zentriert.
- Settings-Modal: top-verankert (10vh), Tab-Leiste zwischen Header und Body, fixer Konto-Footer.
- Dialog über Modal (Name-Dialog): Overlay `--overlay-soft`, z220.

### Dropdowns, Popover, Tooltips

- **Dropdown-Liste** (Theme, Modell, Filter): BG `--surface`, r10, `--shadow`; Item `.6rem .8rem`, Hover `--bg`, Active accent-Tint 8%; im Settings-Modal `position: fixed` z10000. Filter-Dropdown migriert von `--bg` auf `--surface`.
- **Popover** (Qty, Reload, Vivino-ID): BG `--surface`, r10, shadow floating, Padding nach Inhalt (.3-.75rem).
- **Tooltip** (Charts): wie Popover, z500.

### Toasts

- Eine Komponente, unten zentriert (bottom 2rem), BG `--surface`, Border, r8, shadow toast, z9999, Fade 400ms.
- Varianten: **Undo** (Meldung + Gold-Textbutton, 6s) · **Fehler** (`.error`: Meldung in `--danger`, kein Button, 4s) · **Erfolg** (Reload-Toast: BG `--gold`, Text `--bg`, 2.5s). Reload- und Undo-Toast migrieren auf ein gemeinsames Rezept.
- Mobil: Toasts rücken über die Tab-Bar (bottom 2rem + 56px) - Migrationsliste.

### Tabs & Navigation

- Header 56px sticky z100; Desktop-Nav `.85rem/500`, aktiv 700 `--text`; unter 800px Hamburger-Menü; unter 600px Bottom-Tab-Bar (56px + Safe-Area, Icon 1.25rem, aktiv `--accent/700`).
- Inhalts-Tabs (Settings): Icon + Label `.85rem/600`, aktiver Tab `--accent` mit 2px-Unterstrich, horizontale Wischleiste ohne sichtbaren Scrollbalken.

### Chips, Badges, Karten, Tabellen

- Datenchips: BG `--bg`, r4, `.75rem`; Zähl-/Status-Badges: Pille, `--accent`/`--on-accent`, `.72→.75rem`; Mengen-Badge auf Karten: dunkles Overlay + blur, `--gold` wenn gefüllt, klickbar (Popover).
- Karte: `--surface`, 1px Border, `--radius`, Hover translateY(-2px) + `--shadow`; `.empty` opacity .5 dashed; Ribbon diagonal mit `--wine-*`.
- Tabelle: TH `.75rem/600` uppercase `--muted`, Zeilen-Hover accent-Tint 8%, responsive Spalten-Ausblendung (900/700/500).
- Empty-State: zentriert, Icon 4rem, Logo 96px opacity .5 - eine Klasse für alle Seiten.

## Responsive

Breakpoints (max-width, Bestand = Ziel): **500** Phone-Verdichtung + Fullscreen-Modals · **600** Bottom-Tab-Bar, FAB-Versatz, Grid 2-spaltig · **700** Tabellen-Trim 2 / min-width 700 breite Modals · **768** Chat-Sidebar als Overlay · **800** Nav-Collapse · **900** Tabellen-Trim 1. `100dvh` ist der Zielwert für Fullscreen-Höhen (vh-Reste migrieren). JS-Breakpoints müssen den CSS-Werten entsprechen (600/768).

## Accessibility

- **Kontrast:** AA in allen 12 Sets. Offene Verstösse (gerechnet): Weiss auf `--accent` in vineyard/champagne/slate/HA dark (2.3-3.7) und vineyard/champagne light; `--muted` knapp in classic/slate dark; `--accent2` als Hover-Text (bis 1.9, abgeschafft per Colors-Regel); `#fff` auf `--wine-dessertwein`/`--wine-empty` Ribbons; Semantikfarben auf Weiss (durch Light-Paare gelöst). → Accent-Justierung pro betroffenem Theme in der Migrationsliste.
- **Fokus:** `:focus-visible`-Ring für alle interaktiven Elemente (neu, Pflicht). `outline: none` ohne Ersatz ist verboten.
- **Touch:** Mindest-Zielfläche 34px (Header-Icons mobil 30px ist die dokumentierte Untergrenze); Hover nur hinter `@media (hover: hover)`.
- **Motion:** `prefers-reduced-motion` respektieren (siehe Motion).
- Sprache: UI in 7 Sprachen (`translations.py`), Deutsch per Default, Du-Form kleingeschrieben im UI.

## Voice & Tone

Knapp, funktional, freundlich - keine Ausrufezeichen-Dichte, keine Marketing-Floskeln. Fehlertexte benennen das Problem und den nächsten Schritt ("Hinterlegt - leer lassen zum Behalten"). Zahlen im Schweizer Format, Währung `CHF 12.50`. Alle sichtbaren Strings laufen über `translations.py` (7 Sprachen) - keine hardcodierten UI-Texte in Templates/JS.

## Code Snippets

Ziel-Zustand der neuen Tokens (einmalig in `style.css` zu ergänzen, dann Hardcodes migrieren):

```css
:root {
  --danger: #e74c3c;
  --success: #27ae60;
  --warning: #e67e22;
  --on-accent: #ffffff;
  --overlay: rgba(0,0,0,.75);
  --overlay-strong: rgba(0,0,0,.92);
  --overlay-soft: rgba(0,0,0,.6);
}
html.light {
  --danger: #c0392b;
  --success: #1e8449;
  --warning: #b45309;
}
```

## Known Gaps & Migration

Priorisierte Liste - abzuarbeiten beim nächsten Anfassen der jeweiligen Stelle, nicht als Big Bang:

1. **Semantik-Tokens einziehen:** `:root`-Block oben ergänzen; ~30 Hardcodes (`#e74c3c #c0392b #27ae60 #e67e22 #f39c12 #fdecea #5a1010`) auf `--danger/--success/--warning` migrieren (Light-Varianten kommen gratis mit).
2. **Kontrast-Fixes:** Accent-Töne von vineyard/champagne/slate/HA dark (und vineyard/champagne light) Richtung 4.5:1 gegen Weiss justieren; `--muted` in classic/slate dark leicht aufhellen; Ribbon-Textfarben für dessertwein/empty prüfen.
3. **Button-Konsolidierung:** `.btn-primary`/`.btn-secondary` (adv-Filter) und `.ai-btn` auf `.btn-submit`/`.btn-cancel` zurückführen; Button-Höhe einheitlich 38 (Import-42er); `white`→`--on-accent`.
4. **Focus-visible:** Ring-Rezept global einführen; alle `outline: none`-Stellen nachrüsten.
5. **Input-Vereinheitlichung:** 6 `--surface`-Inputs auf `--bg`; Höhen/Fontgrössen der Chat-/adv-Inputs auf 38/.9rem; globale `font-family: inherit`-Regel für Controls; `login.html`-Duplikat entfernen.
6. **prefers-reduced-motion** einführen; 12× `transition: all` auflösen.
7. **Hover-Politik:** `--accent2` als Hover-Textfarbe ersetzen (4 Stellen); schwarze Alpha-Tints der Nav durch `color-mix`-Tint; Hover generell hinter `(hover: hover)`.
8. **Z-Index/Schatten aufräumen:** Filter-Dropdown von z200 trennen (kollidiert mit Modal); Streuschatten auf die 3 Stufen; Filter-Dropdown-BG auf `--surface`.
9. **Toter Code:** `.qty-btn/.qty-controls`, `.step-link`, `.theme-segmented`, `a.btn-cancel[href*="logout"]`-Selektor entfernen; undefinierte `--bg-soft`/`--text-muted` ersetzen.
10. **Toast-Vereinheitlichung** (Reload+Undo ein Rezept) inkl. Mobile-Offset über der Tab-Bar.
11. **Seiten-Sonderstile:** Inline-`<style>` von `login.html`, `timeline.html`, `_import_preview_modal.html` in `style.css` überführen (px→rem).
12. **Nicht validiert:** Landing Page (`docs/`) bleibt bewusst ein eigenes System; `design.html` (Living Styleguide) ist noch nicht auf die Wine-Tracker-Tokens umgebaut; Gold-Glow nutzt Classic-Gold statt `--gold` (Entscheid offen: pro Theme oder fix).
