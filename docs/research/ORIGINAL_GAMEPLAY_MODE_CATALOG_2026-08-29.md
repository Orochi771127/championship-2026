# Digimon Championship — Original Gameplay and Mode Catalog

Date: 2026-08-29  
Purpose: 2026 web-remake planning  
Policy: web sources describe player-visible behavior; ROM-derived claims remain governed by binary evidence.

## Source hierarchy

1. Local YDIJ ROM research under `R:\NEXUS LINK\原作\research-only\YDIJ_FULL_ROM_DECONSTRUCTION_2026-08-29`.
2. [Bandai Namco official product page](https://digimon-gameportal.bn-ent.net/product/ds_digimon03/) and its
   [gameplay](https://digimon-gameportal.bn-ent.net/product/ds_digimon03/game1.html) /
   [Championship](https://digimon-gameportal.bn-ent.net/product/ds_digimon03/cs1.html) sections.
3. Contemporary preview: [GameSpot First Look](https://www.gamespot.com/articles/digimon-world-championship-first-look/1100-6189379/).
4. Cross-check catalogs: [Wikimon guide](https://wikimon.net/Digimon_Championship_Guide),
   [Japanese guide](https://nhoko.xxxxxxxx.jp/r-champ.html), and
   [GameFAQs FAQ](https://gamefaqs.gamespot.com/boards/943756-digimon-world-championship/45325515).

Community-guide claims are `WEB_CROSSCHECK_PENDING_BINARY` unless the local ROM research independently verifies them.

## Original player fantasy and core loop

The player is a Tamer managing multiple creatures rather than a field-adventure protagonist. The original loop is:

`Acquire egg / Hunt → Care and train → Evolve → Prepare team and strategy → Auto battle → Earn titles, rank, Bits and unlocks → Repeat toward the four-year Championship`

The official site frames the game around capture, raising and team battle. Contemporary coverage likewise describes
hunting, training and battling as its three main pillars, with more than 200 creatures and teams of up to three.

## Calendar and lifecycle

| Feature | Player-visible behavior | Evidence status |
|---|---|---|
| Daily clock | Active day runs 07:00–22:00; Hunt, Battle and Training consume/pass time | `WEB_CROSSCHECK_PENDING_BINARY` |
| Seasons | 8 days per season; Spring → Summer → Autumn → Winter; four seasons make one year | `WEB_CROSSCHECK_PENDING_BINARY` |
| Seasonal effects | Wild availability, training effectiveness and injury/sleep tendencies vary by season | `WEB_CROSSCHECK_PENDING_BINARY` |
| Championship cadence | Main Championship occurs once every four in-game years | `OFFICIAL_WEB_CROSSCHECK` + local title/progression evidence |
| Lifespan | Creatures eventually die/revert to eggs; evolution can reset lifespan and egg reversion participates in later evolution conditions | `WEB_CROSSCHECK_PENDING_BINARY` |
| Save cadence | Community documentation reports end-of-day autosave plus manual save from the home state | `WEB_CROSSCHECK_PENDING_BINARY` |

## Raising, care and cages

Player-facing care includes feeding, cleaning waste, treating illness/injury, managing hunger, HP, stress/discontent,
and moving creatures among cages. Training is environmental: placing a creature into a cage changes one or more stats,
family values or resistances, while recovery cages restore readiness.

Owner confirmation on 2026-08-29 establishes three additional implementation obligations as `OWNER_VERIFIED_ORIGINAL_BEHAVIOR`: Cage Edit is a spatial assembly system, its modules/terrain pieces have specific shapes, and different functional terrain improves different raising values. Exact per-module footprints, rotation/mirroring, adjacency, numeric gains, cadence, stacking and caps remain `UNKNOWN_REQUIRES_TRACE`; the obligation to preserve the mechanic does not authorize guessed parity data.

Local binary research proves 36 CageDefinitions: 35 shop cages plus one non-shop waiting cage, level-up behavior, and a
Tamer-rank cap. Community sources describe a 14-block initial layout expanding to 20 blocks and cage effects including
Attack, Defense, HP, TP, Speed, Wisdom, family affinity, elemental resistance, recovery and automation. Exact numeric
mutations, occupancy consequences and several care-item handlers remain unverified.

## Evolution and collection

The guide material identifies these visible evolution inputs:

- current stage and Tamer licence/rank;
- visible combat stats and hidden family/attribute values;
- battle count and win ratio;
- care mistakes/penalties from injury or illness;
- elapsed time;
- prior egg reversions and recent life history.

The local ROM research has 224 entities (8 eggs + 216 regular creatures), complete 8-file sprite contracts and a
Database UI family. A shippable remake still needs one canonical evolution graph with priority/tie behavior, reset
rules, hidden-stat visibility policy and regression fixtures.

## Hunt

The original contains 16 Hunt locations with progression unlocks and entrance fees. The public flow is:

1. Choose a location and equipment/loadout.
2. Find a creature whose appearance may depend on area, season, time and weather.
3. Circle it with the rope, pull against it and reduce its capture HP/endurance.
4. Confirm capture when subdued, subject to carrying capacity.

Food, decoys, wire, shots/stun equipment, traps, radar/analyzer plugins and memory capacity supplement the rope.
Local evidence verifies five runtime equipment classes, 49 Hunt items, 30 plugins, four gear slots, four plugin
positions and plugin-gated HUD fields. Precise per-item behaviors, wild-AI states and all state-transition branches
still require runtime trace.

## Battle preparation and combat

The original is not a turn-command RPG. The player selects up to three creatures and gives pre-battle strategy; combat
then runs automatically. Community sources consistently identify three high-level strategy biases:

- Normal / attack-oriented;
- Special Attack-oriented;
- Support-oriented.

Local Stage 4 binary evidence verifies the 3v3 runtime, independent action cooldowns, 596 actions, damage core,
element routing, battlefield matrix, status framework, support/heal families and AI candidate/selector structure.
Hit/miss, TP/resource behavior, exact critical probability, some status semantics, initialization/tie behavior and the
complete result write graph remain unresolved.

## Battle modes

| Mode | Original role | 2026 requirement |
|---|---|---|
| Title Match | Scheduled/conditional matches; rewards titles, Bits, rank and unlocks | Preserve 62 matches and 45 eligibility rules; build calendar and eligibility UI |
| Free Battle | Repeatable practice/reward battles outside the title schedule | Build opponent/parameter selection and bounded rewards |
| Password Battle | Encode/decode a creature/team representation for asynchronous challenge | Decide compatibility scope; do not expose unsafe raw save state |
| Championship | Four-year main tournament with qualification and consecutive battles | Preserve qualification, multi-round endurance and final progression writes |
| Multiplayer | Local wireless / Nintendo WFC competition | Requires a new web networking design and service; original WFC cannot be reused |
| Practice | Training battle counted by some evolution/battle counters | Confirm exact reward, injury and counter-write behavior before parity claim |

Community sources also report a late-game reward allowing direct control of one creature after 100% Database
completion. This remains `WEB_CROSSCHECK_PENDING_BINARY` until its unlock and runtime branch are traced.

## Supporting modes and functions

- Title/Login, New Game, Continue and name entry.
- Raising Home and direct creature manipulation.
- Cage Edit and cage upgrades.
- Creature Detail and Database/Digipedia.
- Shop for Training, Hunt, Plugin and Cage categories.
- Gate Select, Hunt Loadout, Hunt, Hunt Result and release/capacity management.
- Battle mode cube, match lists, team setup, strategy, battle and result reveal.
- Schedule/calendar, Tamer info, rank/licence, medals/titles and statistics.
- Mail/event notifications, Help/Tutorial, Settings and save feedback.
- Password and multiplayer flows.

## Modernization boundary

Presentation may be rebuilt for portrait touch browsers, but the following are gameplay obligations until explicitly
changed by the Owner: the time-management loop, environmental training, branching evolution, rope/circle Hunt,
pre-battle strategy plus auto battle, conditional Title Matches and the four-year Championship cadence.

The Nintendo Wi-Fi Connection service ended on 2014-05-20, so online multiplayer must use a new authenticated web
service rather than attempt to connect to the original network. See
[Nintendo's service notice](https://en-americas-support.nintendo.com/app/answers/detail/a_id/6026/p/50/c/120).
