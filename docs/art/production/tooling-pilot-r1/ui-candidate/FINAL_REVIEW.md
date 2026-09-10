# Independent bounded UI review

## Latest revision: professional bright HUD R2

**No blocking visual issue found in the three inspected R2 screenshots. This is delegated visual review, not Owner approval or physical-device QA.** The earlier section below describes R1 and is retained as historical evidence; its no-layout-change and duplicate-clock observations do not describe R2.

Directly inspected:

- `qa/hud-r2-four-cages-390x844.png`
- `qa/hud-r2-system-menu.png`
- `qa/hud-r2-four-cages-360x800.png`

All paths are relative to `docs/art/production/tooling-pilot-r1/`. Also read the final scoped CSS block in `src/championship/app/intRh2Styles.css`.

R2 visibly follows the requested bright tactile direction: warm ivory controls, defined gold borders, blue/green information plates and an angled gold title tab. At both 360x800 and 390x844, the header, field, companion panel, status message and toolbar are distinct and fit in the screenshot. The 78px header avoids the earlier large empty strip; hiding the redundant local clock leaves the existing shared clock visible. CSS now intentionally adjusts presentation geometry and typography, including the header and companion layout and 62px toolbar cells; these are not accurately described as color-only changes.

The eight illustrated tool/menu icons fit their slots in both sizes. Their visible sprite slices are centered, recognizable and do not bleed adjacent atlas icons or show obvious clipping. The Save icon also fits. Text labels remain available beneath the art. System menu entries have clear separation and legible labels; the open-menu highlight is visible on the System button. The menu overlays the companion region as expected for the existing upward-opening menu, without clipping entries or covering the toolbar controls.

Scoped CSS uses the existing `.cm-toolbar[data-mode="1"]` and `.cm-status-bar[data-screen="RAISING_HOME"]` attributes. No new controls or DOM are needed for the illustrated pseudo-elements. The earlier season fallback issue is fixed by a scoped dark default. Root still plans to center desktop bars within 430px; these mobile screenshots cannot validate that pending desktop change.

Non-blocking visual limits remain explicit:

- Small supporting labels (LIVE HABITAT, FIELD ONLINE, COMPANION LINK, HP/TP and toolbar captions) are visually readable in the captured raster but remain very small, especially at360px. Physical-device and enlarged-text accessibility have not been assessed by this reviewer.
- Cage images retain bright cyan edge pixels, uncertain joins and visibly different component scales. The egg is visibly within the upper field composition, but a screenshot alone cannot establish its ground anchor, collision placement or correct actor transform. This review does not accept Cage geometry, module alignment or actor transforms as fixed.
- The new pale Pixi empty-space paint makes those existing source edge artifacts more noticeable; it does not establish or repair terrain composition. Four Cage visibility is evident in the screenshot, while root's normal-UI transaction and Save/Continue claims require its own receipts.
- No selected-tool, keyboard-focus, long resident name, maximum HP/TP text, all-season, reduced-motion, image-failure or physical-device state was directly tested by this reviewer.

Root-reported normal UI selection, four-Cage Save/Quit/reload/Continue and slot verification are attributed to root. This independent review directly covers only the three listed screenshots and the CSS scope. No Owner visual approval, shipping approval or complete gameplay parity is claimed.

## Historical R1 review

Reviewed 2026-09-06 by UI candidate agent; source read-only. Inspected the final bright block at the end of `src/championship/app/intRh2Styles.css`, the UI production manifest, and these root-captured screenshots:

- `docs/art/production/tooling-pilot-r1/qa/ui-after-390x844.png`
- `docs/art/production/tooling-pilot-r1/qa/ui-system-menu-390x844.png`

**No blocking issue found in the inspected scope.** The normal Raising screenshot shows bright silver/ivory header, blue-grey text, warm clock accent, readable companion panel and the existing eight-cell toolbar. The System submenu is legible, its selected opener is distinct in amber, and its entries do not visually overlap one another. The subdued generated material stays subordinate to live text and adds no misleading controls or artwork symbols.

The appended CSS block changes paint properties and locally scoped variables. It does not alter layout dimensions, DOM, input handlers, save state, renderer lifecycle or toolbar membership. Shared top bar is scoped by `[data-screen="RAISING_HOME"]`; actual toolbar overrides are scoped by `[data-mode="1"]`. Header pseudo-elements and existing focus/selected/expanded state rules retain their roles. The image URL resolves under `assets/production/`; manifest says original-created, runtime eligible, human review pending and not shipping ready, without claiming original pixel reuse or exact visual parity.

Non-blocking polish observation: the bright status-bar overrides supply dark colors for each of the four known seasons, but the base `.cm-status-bar__season` still uses pale `#ffd98a` for a missing/unknown season. A scoped generic season fallback color such as `#805011` would keep a transient dash legible on the bright bar; known-season overrides already look correct in the inspected screenshot. No claim that an unknown-season state is normally reachable.

Visual limits: the gameplay field still has dark exposed background and source-material edge artifacts; these belong to the pre-existing Pixi field and were intentionally not recolored by this UI pilot. The header has substantial empty vertical space and the UI retains small toolbar/field-label text and two clock displays; these are existing layout/control choices, not newly introduced by the bright palette. The candidate review did not redesign them.

The root reported focused 67 and full 1097 passes, five mobile viewport observations, no overflow, 44px toolbar buttons, one canvas and no console errors. Those are root QA results, not independently rerun by this reviewer. This review directly verifies only the two 390px screenshots and source/manifest scope. Requested 393px reportedly rendered 394px in the browser; do not describe that receipt as exact 393px verification. No physical-device, accessibility automation, image-failure or all-season runtime test was performed by this reviewer.
