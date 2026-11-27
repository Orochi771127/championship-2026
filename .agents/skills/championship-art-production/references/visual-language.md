# Visual language for UI art

## What is live

- Colours, sizes and curves come from `src/championship/app/ui/tokens.css`.
  A literal colour typed elsewhere is a defect unless the file says why.
- Themes are an attribute on `<html>` (`data-theme`) chosen in settings:
  `arcade` (default since 2026-10-26), `night`, `arena`, `clear`, `warm`,
  `classic`. `data-palette` scopes one palette to an element (the title keeps
  night in every theme). Character and scene art is never recoloured by a
  theme.
- Every palette keeps body text at 4.5:1 or better on each surface it sits on
  (`tests/championship-settings-cases.mjs`). Do not retune a shared panel or
  slot token without checking every component that pairs it with text: that
  is how white-on-white titles and dialogs happened in the 2026-09 daylight
  skin. `daylightSkin.css` is retired and not linked; editing it changes
  nothing.
- In-game HUD layout, button physics and motion: juicy-monster-ui.
- Frosted panels are a quality-tier feature (`backdropBlur`), off in saver.
- No emoji or third-party characters in place of game art. Existing glyph
  uses (lock, cup, shield) are listed in `git grep` and are candidates for
  drawn icons, not new precedents.

## Owner direction to respect

- 2026-09-16: transparent glass for the top data card and the season/day
  strip, a rounded capsule toolbar, values inside their bars, keep the
  original ground image, and fewer capsules after the first pass
  (OWNER_DIRECTION).
- 2026-10-26: one game on the arcade theme; layout, motion and sound rebuilt
  on this codebase.

## Pending proposals (not approved)

### Tactical handheld armour UI (proposal received 2026-10-30)

An external AI proposal, relayed by the Owner, asks for:
- **One frame shape for every panel**: a 2.5–3 px `#141824` frame, a top
  inset highlight, a solid 5 px drop and a 40 ms press.
- **Two shells**:
  - a warm titanium light shell (`#F4F1EA` / `#E6E1D6`, ink `#181C2A`, 7:1) for ranch, shop, partners and Dex;
  - an obsidian dark shell (`#0D1322` / `#182235`, cyan `#00B4D8`, amber `#FFB703`) for Data Area, portals, Data Arena, gacha and evolution.
- **No blur and no emoji anywhere.**

It conflicts with the 2026-09-16 glass and capsule direction and with the
player-selectable themes. Its original name used a third-party trademark and
must not be used. **Treat it as a design option, not a rule, until the Owner
decides.** If adopted, the natural form is one new theme in `tokens.css` (or a
retune of `arcade`) checked by the contrast test, not edits across the
per-screen sheets.
