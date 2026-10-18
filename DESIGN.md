# Design System - Wine Tracker

> **Single source of truth** for all UI decisions in the Wine Tracker app (templates + `style.css` + `theme.js`). Consolidated from the full as-is inventory of 2026-10-18 - it documents the current state, defines target scales and maintains the migration list. The former `STYLE_GUIDE.md` has been fully absorbed into this document.
>
> **Scope of authority:** New UI work follows the target values in this document. Existing code that deviates is listed in `## Known Gaps & Migration` - it gets migrated the next time the spot is touched, not in a big-bang rewrite.
>
> **For codegen + audits:** The machine-readable token layer lives in the JSONC block under `## Tokens (machine-readable)`. Audits read that block, not the prose.
>
> Out of scope: `docs/index.html` (landing page, own token set) and `wine-tracker-dev/` (generated mirror).

## Overview

Wine Tracker is a Flask app with classic server rendering and a hand-written CSS layer without a framework. The system rests on **10 core tokens** (`--bg --surface --border --accent --accent2 --gold --text --muted --empty --shadow`), fully defined in **6 themes x light/dark** (12 sets). On top of that come the theme-independent **wine type colors** (`--wine-*`), `--radius` and the **semantic tokens** (`--danger --success --warning --on-accent --overlay*`).

- **Default theme is `homeassistant`**, default mode is `system` (prefers-color-scheme). Dark is the `:root` base, light is the class `html.light`, themes via `html[data-theme]` (classic has no attribute).
- **Font:** system stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`), no webfonts. `monospace` is reserved for technical identifiers (API keys, model IDs, Vivino IDs). Icons: Material Design Icons (MDI webfont via CDN), sized through `font-size`.
- **Surface logic:** `--bg` is the canvas, `--surface` carries cards/modals/panels, `--empty` marks empty states. Separation through 1px `--border` lines and surface changes; shadows only for real elevation.
- **`--accent` is the action color** (primary buttons, active states, FAB, links), `--accent2` its darker hover step for surfaces. `--gold` is the accolade color for wine value (stars, prices, bottle badges) - an orange in the HA theme.
- **Accessibility:** WCAG AA (4.5:1 text, 3:1 UI components) is the binding target in all 12 sets. Known violations are listed in the migration list.

## Design Principles

1. **One token, one role.** Color, radius, shadow, spacing and duration come from the token/scale layer; code references the name, never an inline literal. What the scale does not provide is not invented but added here.
2. **Every role has exactly one component.** There is ONE primary button, ONE secondary button, ONE input recipe, ONE popover recipe. Variants come from modifiers, not from new parallel classes.
3. **12 sets or not at all.** Every color decision is made against all 6 themes x light/dark. A value that only works in dark mode gets a light/dark pair.
4. **Accent acts, gold accolades.** `--accent` marks actions and active states, `--gold` exclusively wine value. The two never swap roles.
5. **AA is non-negotiable.** Text 4.5:1, UI components 3:1 - in every set. Where a theme color misses that, the color is adjusted or an `--on-accent` override is set; the threshold is never softened.
6. **Touch first.** Hover is reinforcement, never the carrier of information; hover styles live behind `@media (hover: hover)`. `:active`, `:disabled` and `:focus-visible` are mandatory states of interactive components.

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
    "darkMode": true,          // all 6 themes in light + dark
    "responsive": true,        // breakpoints below
    "a11y": "WCAG AA"          // 4.5:1 text, 3:1 UI, focus-visible mandatory
  },
  // 10 core tokens x 12 sets (theme: [dark, light])
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
  // semantic tokens, theme-independent, as light/dark pairs
  "semantic": {
    "danger":   { "dark": "#e74c3c", "light": "#c0392b" },
    "dangerFill": "#c0392b",          // solid danger surfaces (delete button), same in both modes
    "dangerFillHover": "#a93226",
    "success":  { "dark": "#27ae60", "light": "#1e8449" },
    "warning":  { "dark": "#e67e22", "light": "#b45309" },
    "onAccent": "#ffffff",            // target; themes whose accent misses AA adjust the accent (see migration)
    "overlay":        "rgba(0,0,0,.75)",   // modal scrim
    "overlayStrong":  "rgba(0,0,0,.92)",   // lightbox
    "overlaySoft":    "rgba(0,0,0,.6)"     // dialog on top of a modal
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

- **Core tokens:** see the theme matrix above. `--accent2` is darker than `--accent` in all sets and serves as the **hover surface** for solid accent elements. As a hover **text color**, `--accent2` is forbidden in dark mode (too dark on dark ground, contrast down to 1.9:1) - hover text switches to `--text` or `--accent` instead.
- **Semantics:** `--danger`/`--success`/`--warning` progressively replace the ~30 hardcoded `#e74c3c`/`#27ae60`/`#e67e22` spots; every usage automatically gains the light variant. Danger surfaces (delete button) use `--danger-fill`/`--danger-fill-hover` (dark-enough reds, identical in both modes) with `--on-accent` text.
- **Hover tints:** `color-mix(in srgb, var(--accent) 10%, transparent)` is the standard tint for list/item hover. Black/white alpha tints are retired (they fail depending on mode; the nav still uses black alpha in dark mode - migration list).
- **Overlays:** `--overlay` (modal), `--overlay-strong` (lightbox), `--overlay-soft` (dialog on top of a modal). No other scrim values.
- **Wine type colors** (`--wine-*`) are data colors for ribbons, dots, charts - identical across all themes and never used for UI states. Ribbon text: `#333` on light types (white/rose/sparkling), otherwise `#fff`.
- **Theme preview colors** (settings dropdown) are deliberately hardcoded `[bg-dark, accent-dark, gold-dark]` - the only permitted hex duplication, since they show all themes at once.

## Typography

- **Family:** system stack on `body`; `font-family: inherit` on all form controls (global rule - migration list). `monospace` only for technical identifiers.
- **Target scale** (12 steps): `.65 / .7 / .75 / .8 / .85 / .9 / .95 / 1 / 1.1 / 1.25 / 1.5 / 2rem`. Larger values (2.5-4rem) only for icon placeholders and empty states. The legacy in-between values (`.72 .78 .82 .88 .92 .97 1.05 1.15 1.2rem`, `10px`) are deprecated and get rounded to the nearest scale step when touched.
- **Roles:** `.85rem` UI default (nav, tabs, tables, chips) - `.9rem` inputs and dialog buttons - `.8rem` labels and secondary text - `.7rem` uppercase section titles (+ `letter-spacing .05em`) - `.75rem` data chips - `1.1rem` modal headers and icon buttons.
- **Weights:** 400 body text - 500 navigation - 600 buttons, table headers, active secondary elements - 700 primary buttons, card/modal titles, active navigation. 800 only for big statistic numbers.
- **Uppercase label recipe:** `.7rem / 600 / uppercase / letter-spacing .05em / --muted` - applies to all section titles (unify settings, filter, table → migration list).

## Spacing & Layout

- **Grid:** 4px base; scale `.25 / .5 / .75 / 1 / 1.25 / 1.5 / 2 / 2.5rem`. Component fine values (`.35 .4 .6rem`) are allowed inside component recipes; new layout spacing comes from the scale. px spacing only for 1px lines and 2-6px micro details.
- **Core recipes:** input padding `.55rem .75rem` - button padding `0 1.2rem` (with fixed height) or `.6rem 1rem` - card body `.75rem 1rem` - modal header `1rem 1.25rem` - modal body `1.25rem` (gap `.9rem`) - modal footer `0 1.25rem 1.25rem` (gap `.75rem`) - this is the base rule for ALL modals (deviations in the migration list).
- **Containers:** content pages (stats/timeline) max-width 900px, padding 1.5rem. Card grid `1.25rem 1.5rem`, gap 1rem, padding-bottom 5rem (FAB space).
- **Safe area:** `env(safe-area-inset-bottom)` on tab bar, FAB and chat page - **except** `body.embedded` (HA ingress handles the safe area itself).

## Shape (Radius)

| Step | Value | Usage |
|---|---|---|
| container | `var(--radius)` = 12px | cards, modals, panels, stat cards, chat panel |
| popover | 10px | popovers, dropdown lists, tooltips, chat bubbles, accordion groups |
| control | 8px | buttons, inputs, selects, toasts, nav hover surface, segments |
| item | 6px | list row hover, small icon buttons in context, bar tracks |
| tag | 4px | data chips (card-meta/-extra), food tags, mini thumbnails |
| pill | 999px | count badges, filter chips, quantity badge |
| circle | 50% | FAB, spinners, dots, toggle knob, round chat buttons |

Legacy outliers (20px qty badge, 24px toggle slider, 16px badge with r8, 12px literal in login) → migration list; the toggle keeps its capsule shape via `pill`.

## Elevation & Depth

| Step | Value | Usage |
|---|---|---|
| elevation | `var(--shadow)` | header, card hover, modals, dropdown lists |
| floating | `0 8px 24px rgba(0,0,0,.4)` | popovers, tooltips (floating above content) |
| toast | `0 4px 16px rgba(0,0,0,.3)` | toasts, FAB resting state |

Named special cases remain: lightbox image `0 0 40px .6`, chat panel `0 8px 32px .45`, focus/selection rings via `box-shadow: 0 0 0 1-2px`. The remaining stray values (nav menu `.15`, stock tooltip `.25`, ribbon) get migrated onto the three steps.

## Motion

- **Durations:** 150ms color/text hover - 200ms standard (border, transform, surface) - 250ms layout changes (modal width, panels, `--kb-inset`) - 400ms fade in/out (toasts, images). Running animations: spinner .8-1s linear, chat dots 1.2s, shimmer 1.8s, glow 2s.
- **Easing:** `ease` as default, `linear` only for endless rotation.
- **Rules:** `transition: all` is forbidden (name properties explicitly). `@media (prefers-reduced-motion: reduce)` disables shimmer, glow, scale effects and transitions - mandatory (implemented as a global reduce block).

## Components

### Buttons

| Role | Canonical class | Recipe |
|---|---|---|
| Primary | `.btn-submit` | BG `--accent`, text `--on-accent`, h38, r8, `.95rem/700`, hover BG `--accent2`, `:disabled` opacity .5 |
| Secondary | `.btn-cancel` | BG `--bg`, 1px `--border`, text `--text`, r8, `.9rem/600`, hover border `--accent` + BG `--surface` |
| Danger | `.btn-delete` | BG `--danger-fill`, text `--on-accent`, hover `--danger-fill-hover`, otherwise secondary geometry |
| Icon (header) | 34x34 (mobile 30x30), outlined, r8, icon 1.1rem | hamburger, theme, filter, chat header |
| Icon (form) | 38x38, r8 or r6 in image context | reload trigger, image actions |
| FAB | 56px circle, `--accent`/`--on-accent`, shadow toast, hover `--accent2` + scale 1.05, active scale .92 | |
| Text button | no BG, `--gold` or `--muted`, hover tint accent 10% | toast undo, popover buttons |

`.btn-primary`/`.btn-secondary` (adv filter) and `.ai-btn` are **deprecated aliases** - they migrate onto the trio above. Mandatory states everywhere: `:active`, `:disabled`, `:focus-visible`.

### Inputs & Controls

- **Recipe:** BG `--bg`, 1px `--border`, r8, h38, padding `.55rem .75rem`, `.9rem`, `font-family: inherit`. Focus: `border-color: --accent` **plus** `:focus-visible` ring (`0 0 0 2px color-mix(accent 40%)`) - implemented as a global rule. `--surface` as input BG is deprecated (6 spots).
- Technical identifiers (keys, model IDs): additionally `monospace .85rem`.
- Toggle: 44x24 capsule, off `--muted`, on `--accent`; radios/checkboxes native with `accent-color: --accent`; star input 1.5rem `--border`→`--gold`.
- Dropzones (image upload): dashed, hover border `--accent` + tint 5%.

### Modals

- Base: overlay `--overlay` z200, `.modal` on `--surface` with `--radius`, `--shadow`, max-height 90vh; header sticky `1rem 1.25rem/1.1rem/700`; body `1.25rem` gap `.9rem`; footer `0 1.25rem 1.25rem` gap `.75rem`.
- **Width grid:** 360 (confirmations) - 480 (standard: view, settings, name dialog) - 640 (advanced filter, import) - 900 (from min-width 700: wine/view/settings with photo or wide layout). The 560/600 in-between values migrate onto the grid.
- **Mobile:** settings and advanced filter go fullscreen below 500/600px (`100dvh`, r0) - this is the target pattern for all complex modals; confirmation modals stay centered.
- Settings modal: top-anchored (10vh), tab bar between header and body, fixed account footer.
- Dialog on top of a modal (name dialog): overlay `--overlay-soft`, z220.

### Dropdowns, Popovers, Tooltips

- **Dropdown list** (theme, model, filter): BG `--surface`, r10, `--shadow`; item `.6rem .8rem`, hover `--bg`, active accent tint 8%; inside the settings modal `position: fixed` z10000. The filter dropdown migrates from `--bg` to `--surface`.
- **Popover** (qty, reload, Vivino ID): BG `--surface`, r10, shadow floating, padding by content (.3-.75rem).
- **Tooltip** (charts): like popover, z500.

### Toasts

- One component, bottom-centered (bottom 2rem), BG `--surface`, border, r8, shadow toast, z9999, fade 400ms.
- Variants: **undo** (message + gold text button, 6s) - **error** (`.error`: message in `--danger`, no button, 4s) - **success** (reload toast: BG `--gold`, text `--bg`, 2.5s). Reload and undo toast migrate onto one shared recipe.
- Mobile: toasts move above the tab bar (bottom 2rem + 56px) - migration list.

### Tabs & Navigation

- Header 56px sticky z100; desktop nav `.85rem/500`, active 700 `--text`; below 800px hamburger menu; below 600px bottom tab bar (56px + safe area, icon 1.25rem, active `--accent/700`).
- Content tabs (settings): icon + label `.85rem/600`, active tab `--accent` with 2px underline, horizontal swipe strip without visible scrollbar.

### Chips, Badges, Cards, Tables

- Data chips: BG `--bg`, r4, `.75rem`; count/status badges: pill, `--accent`/`--on-accent`, `.72→.75rem`; quantity badge on cards: dark overlay + blur, `--gold` when filled, clickable (popover).
- Card: `--surface`, 1px border, `--radius`, hover translateY(-2px) + `--shadow`; `.empty` opacity .5 dashed; ribbon diagonal with `--wine-*`.
- Table: TH `.75rem/600` uppercase `--muted`, row hover accent tint 8%, responsive column hiding (900/700/500).
- Empty state: centered, icon 4rem, logo 96px opacity .5 - one class for all pages.

## Responsive

Breakpoints (max-width, current = target): **500** phone condensing + fullscreen modals - **600** bottom tab bar, FAB offset, 2-column grid - **700** table trim 2 / min-width 700 wide modals - **768** chat sidebar as overlay - **800** nav collapse - **900** table trim 1. `100dvh` is the target value for fullscreen heights (migrate vh leftovers). JS breakpoints must match the CSS values (600/768).

## Accessibility

- **Contrast:** AA in all 12 sets. Open violations (computed): white on `--accent` in vineyard/champagne/slate/HA dark (2.3-3.7) and vineyard/champagne light; `--muted` borderline in classic/slate dark; `--accent2` as hover text (down to 1.9, retired per colors rule); `#fff` on `--wine-dessertwein`/`--wine-empty` ribbons; semantic colors on white (solved by the light pairs). → accent adjustment per affected theme in the migration list.
- **Focus:** `:focus-visible` ring for all interactive elements (mandatory, implemented globally). `outline: none` without replacement is forbidden. Non-native click targets (div/tr with onclick) must be keyboard-reachable: `button` element or `role` + `tabindex="0"` + Enter/Space (see gap 13).
- **Touch:** minimum target size 34px (header icons 30px on mobile is the documented floor); hover only behind `@media (hover: hover)`.
- **Motion:** respect `prefers-reduced-motion` (see Motion).
- Language: UI in 7 languages (`translations.py`), German by default; the German informal "du" forms are lowercase in the UI.

## Voice & Tone

Concise, functional, friendly - no exclamation-mark density, no marketing fluff. Error texts name the problem and the next step ("Stored - leave empty to keep"). Numbers in Swiss format, currency `CHF 12.50`. All visible strings go through `translations.py` (7 languages) - no hardcoded UI texts in templates/JS.

## Code Snippets

Semantic tokens as implemented in `style.css` (dark base in `:root`, light pairs on `html.light`):

```css
:root {
  --danger: #e74c3c;
  --success: #27ae60;
  --warning: #e67e22;
  --on-accent: #ffffff;
  --danger-fill: #c0392b;
  --danger-fill-hover: #a93226;
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

Prioritized list - to be worked off the next time the spot is touched, not as a big bang:

1. ~~**Introduce semantic tokens**~~ **Done (2026-10-18):** `:root` block added; ~30 hardcodes migrated to `--danger/--success/--warning/--on-accent/--overlay*`. The `.btn-delete` fill migrated to `--danger-fill`/`--danger-fill-hover` (gap 14).
2. **Contrast fixes:** adjust accent tones of vineyard/champagne/slate/HA dark (and vineyard/champagne light) towards 4.5:1 against white; lighten `--muted` slightly in classic/slate dark; review ribbon text colors for dessertwein/empty. Newly computed (audit 2026-10-18): accent as text on `--surface` in classic dark (3.2) and burgundy dark (3.6); `--gold` as text in classic/champagne/vineyard/slate/HA light (4.0-4.3); `--muted` in vineyard/champagne light (4.3); success toast (`--bg` on `--gold`) in classic light 3.6; qty badge (dark BG, light text values) down to 1.6; toggle track `--muted` in HA dark 2.8; empty star state `--border` on `--surface` below 3:1. → needs decisions: gold text variant for light, accent only as surface/underline or `--accent-text`, fixed dark text value for the qty badge.
3. **Button consolidation:** fold `.btn-primary`/`.btn-secondary` (adv filter) and `.ai-btn` back into `.btn-submit`/`.btn-cancel`; unify button height at 38 (the import 42px one); `white` → `--on-accent` (done for color usages; class consolidation open).
4. ~~**Focus-visible**~~ **Done (2026-10-18):** global ring rule plus input ring recipe introduced; all `outline: none` spots retrofitted. Keyboard reachability of non-native targets remains gap 13.
5. **Input unification:** 6 `--surface` inputs onto `--bg`; heights/font sizes of chat/adv inputs onto 38/.9rem; global `font-family: inherit` rule for controls; remove the `login.html` duplicate.
6. ~~**prefers-reduced-motion**~~ **Done (2026-10-18):** global reduce block added; 12x `transition: all` and the toggle `.3s` replaced with explicit properties on the motion scale.
7. **Hover policy:** replace `--accent2` as hover text color (4 spots); replace the nav's black alpha tints with the `color-mix` tint; put hover behind `(hover: hover)` in general.
8. **Z-index/shadow cleanup:** separate the filter dropdown from z200 (collides with modal); stray shadows onto the 3 steps (only 6 of 14 literals on a step, among them FAB rest/hover/active, chat sidebar); filter dropdown BG onto `--surface`; document or map the off-ladder values 5/10/301, reload/Vivino popovers from z100 to 150.
9. **Dead code:** remove `.qty-btn/.qty-controls`, `.step-link`, `.theme-segmented`, the `a.btn-cancel[href*="logout"]` selector; replace the undefined `--bg-soft`/`--text-muted`.
10. **Toast unification** (reload + undo as one recipe) incl. mobile offset above the tab bar.
11. **Page-level special styles:** move the inline `<style>` of `login.html`, `timeline.html`, `_import_preview_modal.html` into `style.css` (px → rem).
12. **Not validated:** the landing page (`docs/`) deliberately stays its own system; `design.html` (living styleguide) is not yet rebuilt on the Wine Tracker tokens; the gold glow uses classic gold instead of `--gold` (decision open: per theme or fixed).

Added after the consistency audit of 2026-10-18 (three agents: tokens/scales, components, hardcodes/a11y):

13. ~~**Keyboard reachability**~~ **Done (2026-10-18):** all div/td/tr click targets carry `tabindex="0"` (+ `role="button"` outside tables), activated via a shared Enter/Space handler in `theme.js`; star inputs are visually hidden instead of `display: none` and stars/toggles show a focus ring via sibling selectors. The card image stays without a tab stop (same action as the card body).
14. ~~**Button states**~~ **Done (2026-10-18):** trio has `:disabled` (opacity .5) and `:active` (translateY 1px); `.btn-delete` uses the new `--danger-fill`/`--danger-fill-hover` tokens (hover now darkens, white text >= 4.5:1).
15. **Unify close behavior:** ESC in the filter name dialog closes both overlays (bubbling bug, `_nameDialogResolve` is left dangling); ESC closes lightbox and view modal at the same time; the close/overlay/ESC logic is copied 4x (index/stats/timeline/chat) with slight differences; no dropdown/popover closes on ESC. Native `confirm()`/`alert()` (chat delete, filter, photo) are blocked in HA ingress/iOS - replace with the 360px confirmation modal or the error toast. → one shared implementation in `theme.js`, one layer per ESC.
16. **Icon buttons and touch targets:** a ghost icon button recipe is missing (borderless, minimum target 34px, `aria-label` mandatory). Current families: `.modal-close` (~13x21), `.chat-header-btn` (28x28), `.chat-session-delete` (~23), `.chat-image-remove`, `.search-clear`, `.adv-filter-preset-edit/-delete`, `.adv-cond-chip` (~28), `.adv-cond-op/-input` (~31 instead of 38), `.filter-option` (~29). `.chat-send`/`.chat-upload-btn` 36 instead of 34/38.
17. **Scale rounding when touched:** ~45 font-size declarations off-scale (clusters .72/.78/.82/.88/1.05/1.15/1.2rem, plus .55/.6/1.3/1.4/1.6/1.8rem) round to the nearest step; ~73 spacings off-grid (clusters .15/.2/.3/.45/.65/.7/.8/.85rem) plus px leftovers (`.nav-menu-item` 12px 20px and others); motion stray value .6s (chart fill) onto the scale; `@media (max-width: 420px)` onto 500; `100vh` leftovers onto `dvh`.
18. **Dead hex fallbacks and alpha tints:** remove the `var(--x, #hex)` fallbacks at ~14 spots (the tokens always exist; the fallbacks are wrong in light mode); black/white alpha hover outside the nav (`.filter-option`, chart tooltip, `wine-list-link`, Vivino thumb) onto `color-mix(accent 10%)`; chat code BG `rgba(0,0,0,.08)` (invisible in dark) onto `--empty`; image overlay controls (lightbox close, img actions) need a token (`--overlay-control`, decision open).
19. **Recipe drift, small items:** count badges (`.filter-btn-badge` r8, `.adv-filter-badge/-group-badge` r10) → pill 999px; `.modal-footer` has no base rule (4 footer patterns) → `0 1.25rem 1.25rem`, gap .75rem; section titles in 5 variants → `.7rem/600/uppercase/.05em/--muted`; data chips in 4 padding variants → one chip recipe; `.stock-tooltip` r8/z10 → popover recipe; `.taste-bar` r3 → 6px; FAB 1.6rem; drop `.reload-toast.neutral` during the toast merge (gap 10), errors = `.error` variant; fullscreen mobile also for the wine/view/import modal (target pattern).
20. **Hardcoded UI strings:** `login.html` (Sign in, Username, Password, error text), `title` attributes (Rotate, Delete, Past drink window), `'Delete photo?'` (wine-modal.js), fallback `'No conversations yet'` → through `translations.py` (voice rule).
