# Battle character animation — R3

2026-09-07, Championship 2026, main, HEAD d0c48f340baac61cf399bf5bd5922ce58f3d38c7. Shared work preserved. No commit, deployment, new dependency or asset promotion.

This extends R2 static character identity with bounded sequence playback for 加魯哥獸 / m313_gargomon, 火焰獸 / m353_meramon and 玩具亞古獸 / m223_toyagumon. It is integrated in the existing battle scene used by `main.js`. It does not establish original battle choreography or a complete Home-to-battle party workflow.

## Implemented

- The presentation reads existing committed action family 0..3 and projects the corresponding raw sequence 7..10. Down actors request 15; the current implementation's no-action boundary requests 0. Unknown committed families use static identity. No presentation request writes combatant state, damage, RNG, cooldown or notifications.
- Playback reuses the existing native timeline: source frame durations, mode 1 stop, mode 2 loop. The scene advances it by the existing battle frame number; redraw and resizing do not restart or advance it. Equal sequence requests retain progress. No extra Application, ticker, router, save or store.
- All 179 Main cells for the three entities have per-frame packing scale, source origin and native bounds. Production files are hashed against the prior numerical pixel-equality receipt and current manifest. Source origins remain fixed through pose changes; texture packing or trim changes do not move the character's world origin.
- Existing production-index and replacement-art checks remain. Baseline geometry is not applied to an accepted appearance replacement. Other species remain static. Reduced-motion preference displays the initial frame of each requested action while retaining action transitions.
- No pixels from the raw art pack or ROM were copied. Generated runtime data contains numerical transforms and file hashes only. Existing internal production packages retain their release restrictions.

## Original evidence

Evidence MCP was read before implementation:

- `CLAUDE_CODE_YDIJ_SYSTEMS_HANDOFF/06_BATTLE_STATS_DATA/BATTLE_ACTION_TIMELINE_ARCHITECTURE.md:3-14`: action scripts, actor/effect separation and native timeline boundary.
- `YDIJ_RAW_RESEARCH_EVIDENCE/YDIJ_BATTLE_ANIMATION_PARALLEL_RE_PROGRESS_v2.md:95-142`: sequence 34 maps to raw slot 33 in a specific Main call. It is not a general attack alias.

Direct ROM replay uses `scripts/research/trace-battle-character-requests.py`. ROM SHA-256 is `8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`; ARM9 and OVL19 hashes are in `docs/research/BATTLE_CHARACTER_REQUESTS_CPU_2026-09-07.json`.

- OVL19 notification table 0x0211F8A0 -> selected handlers -> 0x02114310 -> ARM9 0x02047984. The last wrapper reads the main actor from combatant +4.
- **117 CPU cases** cover 13 notifications, entry/non-entry counters and three HP values. Synthetic combatant/actor addresses are explicit; speed helpers return controlled 4096. Execution stops at the animator boundary, before motion/effects. This proves the selected raw requests only.
- **49 CPU cases** execute ARM9 SetIfChanged: equal requests return without entering 0x02047904, changed requests enter it.
- Existing `battleTurnStates.js` launch evidence at 0x02116D9C derives notification as move.field10 + 8. This slice projects from the existing engine's committed action boundary. It does **not** run or claim the original complete launch/approach state graph.
- The reused native timeline has separate existing CPU evidence in `CHARACTER_ANIMATION_CPU_CHECK_2026-09-06.json`; its 9,288 update comparisons and Hunt presentation regression ran again with this slice.

## Validation

- Focused **86/86**: original selector cases, equal request continuity, action changes, stop/loop behavior, static fallback restoration, reduced motion, file hashes, per-cell trim geometry, fixed origin across packing and resizing, existing Hunt presentation, approved replacement guards and battle runtime. `qa/focused.log`.
- Complete serial regression **1,152/1,152**. `qa/regression.log`. `node scripts/build-battle-character-geometry.mjs --check` passes. `git diff --check` passes, with pre-existing CRLF normalization warnings only.
- Browser fixture uses the real app, battle runtime, loaded production atlases, scene, result view and wallet transaction with an isolated in-memory save. Autumn Day 4 and 10,000 bit are explicitly labelled fixture data. Normal saved game is untouched; this does not unlock a match on Spring Day 1.
- **390×844 and 320×740**: no horizontal overflow. Three actors switch from sequence 0 to raw 8; raw 8 changes from frame 0 to 1 between sampled battle frames 12 and 18. Screenshots and numerical DOM diagnostics are saved in `qa/`. Reduced-motion run retains frame 0 while its action identity changes.
- The background browser did not progress via live requestAnimationFrame. The final result was verified with the fixture's `推進到結算` button, which repeatedly calls the same scene advance until its actual session ends. It forces no outcome, HP, damage or wallet result. This is deterministic browser/session verification, not realtime cadence or physical device acceptance.
- Actual result is a team-down win: entry fee 150 leaves **9,850 bit**, reward **7,000 bit** produces **16,850 bit**, next page shows the receipt and Return completes. `qa/browser-qa.json`, `qa/battle-result-320.png`, `qa/battle-prize-320.png`.
- Browser console inspection found no error or warning during final fixture flow. No physical Android/iOS QA or public build acceptance was performed.

## Remaining and next bounded step

Exact original movement, approach/launch/return timing, facing/camera, hit effects and full VM actor-object graph remain incomplete. Raw request selection alone does not prove these. Current authored stands and preset player party remain as in R2. Home party binding depends on original entry/team selection and authoritative resident combat-stat writers; it must not manufacture those values from appearance or species defaults.

Next: trace one existing battle from its actual approach state through launch and return, then bind that verified timeline and world coordinates in this same scene. Keep existing verified UI and economy behavior while replacing the current dispatch timing boundary. Other battle types, the complete Shop portrait inventory and ranch training writers are separate unfinished slices.

Contract: `docs/contracts/championship/CHAMPIONSHIP_BATTLE_CHARACTER_ANIMATION.v1.json`.
