# Championship Decision Log

Record only explicit Owner decisions or genuinely new cross-agent decisions.
This log does not restate every report and never replaces `OWNER_DIRECTION.md`.

## 2026-08-27 — Owner — Cross-Agent Coordination SSOT

- Championship progress truth moves from individual chat threads to
  `docs/coordination/championship/` in the formal NexusLink repository.
- Claude Code exclusively owns `CLAUDE_REBUILD_STATUS.json`; Codex Art
  exclusively owns `CODEX_ART_STATUS.json`. Neither may overwrite the other.
- Gameplay truth belongs to runtime evidence; presentation/art truth belongs to
  Codex Art; Owner product decisions override both.
- Every bounded batch requires start-of-work and end-of-work synchronization.
- Owner/QA-approved bounded work should receive a local checkpoint; checkpoint
  does not mean merge, shipping, or deployment.
- Initial round is `SYNC ONLY` and stops for Owner review. No new production
  batch is authorized.

Evidence: explicit Owner directive received 2026-08-27.

## 2026-08-27 — Owner — Execute Championship SYNC Revision 2

- Codex is the coordination merge writer for Revision 2 only; this grants no
  gameplay, art, or Owner authority.
- Claude checkpoint root is `d7a66b1`; current verified HEAD is `b2a46cd` after
  follow-up commits. These identities must remain distinct.
- Claude QA baseline is 471 pass / 3 expected / 0 unexpected. The added expected
  condition is the tracked `tools/reverse/ydi/**` protected-path exposure, not
  an unexpected runtime regression.
- CL-001 is resolved by the local recovery checkpoint. No checkpoint branch is
  pushed or merged.
- CL-008 is `ACCEPTED / NO_ACTION_NOW`; the cosmetic `@ ` commit-subject prefix
  does not authorize history rewriting.
- CL-009 is `ACCEPTED_IN_LOCAL_RECOVERY_CHECKPOINT`; preserve the deterministic
  staging evidence locally, do not push the branch as-is, and use a clean
  integration path before any future push.
- O3-D is `OWNER_APPROVED_REFERENCE_BASELINE` at checkpoint `9d33b9e`; it remains
  copyrighted research reference and not shipping-ready. BM03/BM04 animated
  composition remains unknown.
- SYNC-2 is coordination-only and ends at Owner review. O2, O4, P3-P6, new art,
  runtime, reverse, and environment batches remain prohibited.

Evidence: explicit Owner SYNC-2 approval received 2026-08-27.

## 2026-08-27 — Owner — SYNC-2 Verdict, Renderer Policy, Toolbar Delta, And O2

- SYNC revision 2 is approved and closed as the Championship Modern
  cross-agent coordination SSOT.
- Claude is authorized to execute only `RAISING_TOOLBAR_BINDING_CLOSURE` from
  OVL18 `0x0211CF10` onward. Unclosed fields must remain
  `UNKNOWN_REQUIRES_TRACE` and Claude writes only its owned Status/Delta.
- Renderer authority is fixed: DOM owns application/screen UI; PixiJS owns
  playable 2D field/actor/sprite/2D-VFX presentation; Three.js is bounded to
  verified original 3D evidence or explicitly approved new 3D use. ALL_DOM,
  ALL_PIXI, ALL_THREE, a second global renderer authority, second ticker, and
  second router are forbidden.
- CL-008 is accepted cosmetic with no history rewrite now. CL-009 remains in
  the local recovery checkpoint; the current forensic branch must not be
  pushed as-is and needs a clean integration path before push/PR.
- O2 Original Character Master Catalog is authorized for 224/224 decoded
  entity coverage only. It does not authorize mass high-resolution redraw,
  redesign, animation semantic inference, Nexus-original creatures, or P3.
- `CHAMPIONSHIP_REBUILD_INTEGRATION_PLAN_V1.md` is required as an evidence-only
  complete-flow index. SYNC-3 begins only after the Claude toolbar delta, O2,
  Integration Plan, and both owned Status/Delta pairs are complete.
- P3-P6, modern environment expansion, Nexus integration, and shipping
  promotion remain frozen.

Evidence: explicit Owner SYNC-2 verdict received 2026-08-27.

## 2026-08-27 — Owner — SYNC-3 Approval And INT-RH2 Authorization

- SYNC revision 3 and `CHAMPIONSHIP_REBUILD_INTEGRATION_PLAN_V1.md` are
  approved as the current cross-agent integration planning SSOT.
- O2 is approved as the 224/224 Original Character Owner reference catalog;
  this does not authorize mass high-resolution reconstruction or product art.
- Before integration, Codex must create the exact O2-only checkpoint and the
  coordination merge writer must create a separate SYNC-3 coordination-only
  checkpoint. Neither checkpoint may be pushed, merged, or deployed.
- `INT-RH2 — Raising Home Phase 2 Presentation Integration` is the only
  authorized implementation slice: Boot/Entry → Raising Home → direct resident
  interaction → neutral toolbar presentation → Save → reload → restored state.
- Claude owns runtime truth, save/data, interaction behavior, the presentation
  producer, and the single field-scoped Pixi bootstrap. Codex owns P1R DOM
  presentation, contract binding, responsive tokens, and visual QA.
- Codex may depend only on
  `INT_RH2_RUNTIME_PRESENTATION_CONTRACT.json`; it may not import Claude
  internals or create a second state, save, router, ticker, or Pixi bootstrap.
- Toolbar slot order/count/mode/asset family/submenu capacity may be shown from
  verified evidence. Unknown command, icon, population, enable, slot-7, and
  exact-care semantics remain neutral, disabled, raw-id placeholders.
- No new environment direction, ROM runtime pixels, Hunt/Battle/Shop/Database,
  Cage Edit, Nexus integration, P3-P6, shipping promotion, push, merge, or
  deployment is authorized.

Evidence: explicit Owner SYNC-3 verdict received 2026-08-27.

## 2026-08-27 — Owner — INT-RH2 Baseline Approval And VS2 Candidate

- INT-RH2 is `OWNER_APPROVED_INTEGRATION_BASELINE`, the first formal
  cross-agent playable Championship presentation slice. It is not final visual
  production approval.
- DOM/P1R owns application and screen UI. Claude owns exactly one field-scoped
  PixiJS application for the Raising field/residents. Three.js is not used.
- The eight-slot toolbar is DOM/P1R presentation, while unresolved command,
  label, icon, submenu population, enable mask, slot-7 identity and care values
  remain neutral disabled `RAW_SLOT` evidence placeholders.
- Implemented CARE remains separate from any verified ROM slot mapping.
- Current habitat and resident visuals are temporary presentation assets. No
  Moonlake/Verdant Relay expansion, new Raising environment or P3 creature work
  is authorized.
- Separate Claude runtime, Codex presentation and Codex-written coordination
  checkpoints are authorized locally. Push, merge and deploy remain prohibited.
- VS2 is defined as Gate-to-Hunt Entry and excludes Capture, Hunt Result,
  Battle, Shop and Database. This definition is not an implementation GO.

Evidence: explicit Owner INT-RH2 verdict received 2026-08-27.

## 2026-08-27 — Owner — Championship 2026 Product Reset

- The current product is `DIGIMON CHAMPIONSHIP — 2026 MODERN REBUILD`, a
  standalone web-first/mobile-first, portrait 9:16, touch-first game with
  desktop-browser compatibility.
- Nexus Link integration is frozen and outside current product scope. Existing
  Nexus decisions remain in history but are superseded for Championship 2026;
  no Nexus-specific gameplay dependency or architectural compromise is allowed.
- Original `ROM_VERIFIED` Championship behavior is `DEFAULT_PRESERVE`.
  `PARTIAL` preserves known structure, `UNKNOWN_REQUIRES_TRACE` remains neutral,
  and only `OWNER_APPROVED_ADAPTATION` may intentionally change gameplay.
- Modernization may change renderer, resolution, responsive/mobile UX,
  controls, loading/save infrastructure, animation technology, asset
  resolution, VFX, accessibility, performance, and packaging. It may not
  silently replace auto battle, Hunt tether/circle capture, contextual toolbar
  behavior, or Raising systems.
- Renderer authority remains DOM for application UI, PixiJS for playable 2D,
  and bounded Three.js for verified or explicitly approved 3D. React rewrite
  and duplicate global router/store/save/ticker authority are forbidden.
- INT-RH2 Raising Home is accepted as VS1. The next sequence is VS2 Gate/Hunt
  exploration, VS3 Capture/Result, VS4 Training/Cage/Shop/Database, VS5 Battle
  Setup/Auto Battle/Result, VS6 Progression/Save, and VS7 production completion.
- Original decoded art stays ROM-copyrighted research reference and separate
  from Championship 2026 production assets. Temporary INT-RH2 visuals are not
  final art direction.
- This directive authorizes documentation reconciliation only. It does not
  authorize VS2 implementation, Nexus integration, production expansion,
  shipping promotion, push, merge, or deployment.

Evidence: explicit Owner Product Reset received 2026-08-27.
