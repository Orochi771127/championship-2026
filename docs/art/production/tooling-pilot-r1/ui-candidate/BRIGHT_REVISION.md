# Bright Raising Home revision

Owner steering: retain the existing art-pack style where useful, avoid dark UI, keep it bright. This supersedes the dark graphite prompt/background proposal in `brief.md`. Root has inspected the faithful-hd96 manifest and fragmented menu/list witness cells; those are style/layout references and do not become runtime imagery through this packet. One original-generated bright header material remains the raster pilot; companion/control/clock/toolbar recoloring is CSS only.

Read-only source refresh 2026-09-06: repository root `R:/Projects/Championship2026/championship-2026`, branch `main`, HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`. `intRh2Styles.css`, `styles.css`, and `raisingHomeP1RView.js` were already modified; `championshipToolbar.js` was untracked. No source edits by this child.

## Proposed palette

Use silver-white/ivory surfaces, pale sky blue wells and amber accents. Main readable text remains dark: bright UI means bright surfaces, not pale text everywhere.

| Role | Value | Notes |
| --- | --- | --- |
| Main surface | `#eef6f9` | Bright cool silver |
| Header / ivory | `#fffaf0` | Quiet warm highlight |
| Raised control | `#ffffff` to `#d8edf7` | Sky blue gradient |
| Main ink | `#203d50` | 10.40:1 on main surface |
| Secondary ink | `#526675` | 5.46:1 on main surface |
| Cyan/blue readable ink | `#226183` | 5.60:1 on sky-blue well |
| Amber fill | `#fff2cc` | Selected/tool or clock well |
| Amber readable ink | `#87501c` | 5.89:1 on amber fill |
| Edge line | `#93b5c8` | Decoration, not small text |
| Decorative gold | `#d4a13d` | Borders/highlights only |

Ratios above are calculated sRGB contrast for solid swatches, not rendered-image/browser QA. Text over the generated header and translucent field label still needs screenshot inspection; do not claim these values verify the actual composite.

## Scoped updates in intRh2Styles.css

Set variables on `.int-rh2-root`, not global `:root`, to keep other screens out of this bounded change. Proposed `--rh2-ink:#203d50`, `--rh2-muted:#526675`, `--rh2-ink-soft:#526675`, `--rh2-cyan:#226183`, `--rh2-gold:#d4a13d`, `--rh2-gold-bright:#87501c`, `--rh2-shell:#eef6f9`, `--rh2-shell-dark:#d8e7ef`, `--rh2-display:#eef6f9`, `--rh2-panel:#fffaf0`, `--rh2-line:#93b5c8`.

| Existing selector | Required paint-only revision |
| --- | --- |
| `.int-rh2-root` | Replace hardcoded `#050b10` backdrop with bright silver; this is visible around the 430px shell on desktop. |
| `.int-rh2-shell` | Keep grid treatment but use bright base and restrained blue seams/border. |
| `.int-rh2-header` | Bright original material + white/ivory readability scrim and bright solid fallback. Replace black shadow with low-alpha blue-grey. Preserve both existing gold pseudo-elements. |
| `.int-rh2-title` | Remove glowing cyan text shadow or replace with subtle white highlight. Dark ink. |
| `.int-rh2-kicker`, `.int-rh2-clock` | Resolve through dark blue and amber ink variables. Do not leave old pale yellow clock on bright header. |
| `.int-rh2-system-button` | White-to-pale-blue fill, dark blue or amber ink, stronger blue border; preserve `.is-dirty`, focus and active states. Existing minimum height remains 44px. |
| `.int-rh2-field-frame` | Replace hardcoded dark fallback/inset outline and black shadow with pale sky-blue fallback, silver border and subtle blue-grey shadow. Do not tint/overlay the Pixi canvas. |
| `.int-rh2-field-frame__label` | Change dark scrim to sufficiently opaque pale-white at the text row, fading to transparent lower down; text stays dark. Keep existing dimensions and pointer-events. |
| `.int-rh2-field-state` | Replace hardcoded translucent near-white text with `#526675`; otherwise unreadable against new pale scrim. |
| `.int-rh2-companion` | Replace its hardcoded dark radial/linear background with ivory/silver and pale-blue variation. Keep structure, border geometry and typography. |
| `.int-rh2-companion__location`, `.int-rh2-vitals__label` | Use secondary dark ink. Define `--rh2-ink-soft` because HP/TP labels otherwise retain pale-blue fallback. |
| `.int-rh2-status` | Replace nearly black fill with silver/ivory; use secondary ink. |

Do not spend scope recoloring `.int-rh2-toolbar`, `.int-rh2-raw-slot` or `.int-rh2-care-button`: these legacy controls are not mounted in the current Raising view. The actual toolbar is shared at body level.

## Shared toolbar and top clock in styles.css

The actual toolbar/status are siblings of the screen, so `.int-rh2-root` variables do not reach them. Both already expose state attributes. No new JS state or `:has()` is needed:

```css
.cm-toolbar[data-mode="1"] { /* Raising only, never mode 2 Hunt */ }
.cm-status-bar[data-screen="RAISING_HOME"] { /* Raising only */ }
```

Prefix all toolbar overrides with `.cm-toolbar[data-mode="1"]`:

- ` .cm-toolbar__rail`: silver/sky-blue plate, blue-grey border.
- ` .cm-toolbar__cell`: white/pale-blue control and dark ink; blue edge.
- ` .cm-toolbar__cell:hover`: slightly stronger pale blue.
- ` .cm-toolbar__cell[aria-pressed="true"]`: pale amber `#fff2cc`, dark amber ink `#87501c`, clear amber edge.
- ` .cm-toolbar__cell[aria-expanded="true"]`: pale sky blue and dark blue ink, visibly distinct edge. Keep selected/expanded specificity and focus ring.
- ` .cm-toolbar__menu`: opaque ivory/silver, pale blue border and softer blue-grey shadow. Current 0.97 alpha was designed for a dark panel; white nearly opaque is preferable over arbitrary field pixels.
- ` .cm-toolbar__entry`, hover/focus states: white/sky-blue surfaces, dark ink; preserve disabled behavior, labels and all hitboxes.

For `.cm-status-bar[data-screen="RAISING_HOME"]` set silver-to-pale-blue background, blue-grey bottom border and main dark ink. Descendant overrides are necessary because child colors are hardcoded in the existing source:

- ` .cm-status-bar__day`: `#526675`.
- ` .cm-status-bar__day-number`, ` .cm-status-bar__time`: `#203d50`.
- ` .cm-status-bar__mode`: `#87501c`.
- ` .cm-status-bar__season`: dark season accents; preserve the `data-season` mapping: spring `#2e674d`, summer `#895200`, autumn `#944520`, winter `#286785`. Each exceeds 5.6:1 on solid `#eef6f9`; verify actual bar gradient.

Do not create or restore `.cm-status-bar__end-day`; the actual main runtime intentionally no longer mounts it (End Day belongs to Management submenu). Preserve shared geometry and safe-area/status-height/toolbar-height rules.

## Root generation and QA adjustment

Generate a **bright pearly silver/ivory satin surface**, subtle sky-blue material variation, little visual noise and a quiet center for dark DOM text. Gold/amber edge accents can remain in existing CSS. No text, frame, controls, markings or source-pixel references. Keep all previous neutral-asset constraints and one-raster scope; do not recolor the gameplay field or redraw existing icons.

Add QA screenshots with the Management and System submenu each open plus tool-selected and menu-expanded states. Verify both clock locations, season/day/time, HP/TP labels, small field-state label, focus ring and Save button. Normal Raising → Gate/Hunt → Home verifies the scoped bright shared bars apply only to Raising and restore on return. Existing interaction and responsive tests still apply; no new gameplay tests requested.
