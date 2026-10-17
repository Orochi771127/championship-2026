# MA50 / MA62 display correction — 2026-10-17

Classification: `OWNER_APPROVED_ADAPTATION`, presentation only.

The Owner identified the half-mechanical lion as MA50 and requested the MA50/MA62 evolution display correction. The receiving task explicitly selected these stable identities:

| Stable identity | Entity | Live code | Name |
|---|---|---|---|
| species-121 | m363_leomon | MA50 | 聖焰獅皇 |
| species-125 | m368_firamon | MA62 | 日焰獅 |

The original 224-row numbering receipt remains unchanged. `databaseDisplayCatalog.js` applies an explicit two-record correction to the live presentation, including when product extensions are unavailable. Preserve entry keys, species indices/IDs, numbering stages, legacy book ordinals, registration, first-published metadata and every unrelated code.

The expected displayed paths are GR18 (064) → MA62 (125) → AW31 (182) → UL01 (220), and GR38 (062) → MA50 (121) → AW43 (171). These edges already exist in the native graph. Keep all native targets, alternate branches, ordering, branch offsets, conditions, thresholds and values. In particular, 125 also has a branch to 171; 121 also has a branch to 177. This correction does not prune those branches or migrate save history.

Update both names, their profile metadata, and the two five-language profiles. MA62 describes a four-legged solar lion; MA50 describes a lion with mechanical armor. Neither profile may invent a carried sword. Change only the six existing move-label records 273, 274, 285–288; keep move identities, power, costs, kind, animation and all other raw fields.

This data commit generates, promotes or replaces no art. A later same-session Owner approval selects only the front-gaze MA62 v5 for separate publisher handoff preparation; its exact original PNG is kept outside this data commit (SHA-256 `ef08f82c8804cc912afe5e430332b4156af29a22dcf908110fb539a4b98e2d67`). Existing accepted HUD portraits remain `m363_leomon-mature-raw-r02` and `m368_firamon-mature-raw-r02`; neither stable identity has a dedicated hand-painted hero in this baseline. The parent verified that the two old MA62 trials are HOLD and unapproved. Historical folders `species-121_MA62_日焰獅` and `species-125_MA50_聖焰獅皇` are archival labels, not stable runtime authority. The main art lane produced and obtained Owner approval for the v5 from OC-125 / m368_firamon. Old side-facing or mismapped versions remain HOLD; approval is main portrait only and does not complete animation.

Acceptance: unique ordered live codes, both upstream/downstream paths and all native alternatives retained, five-language profile and move presentation, unchanged old-save identities/nicknames/history, exact native-data and art-binding preservation, focused regression and bounded browser evidence. Historical test receipts restore only the two prior profile records; the active correction has separate behavioral and preservation tests. The fixture with old prose is test-only and is never imported by runtime source.

Deliver a local commit and patch. No push, main merge, deployment, build-input approval changes, or full private production-index upload is part of this task. Do not interfere with the separate public/private index work.
