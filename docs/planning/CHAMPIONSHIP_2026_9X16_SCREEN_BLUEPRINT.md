# Championship 2026 — 9:16 Single-Screen Blueprint

Date: 2026-08-29  
Reference size: 390×844 CSS px  
Input: touch-first; mouse, keyboard and gamepad supported through the same action map

## 1. Layout contract

Every screen uses one root occupying `100dvh`. Real-time gameplay screens do not document-scroll. Safe-area padding is recalculated when the viewport, browser chrome or orientation changes.

```text
┌──────────────────────────┐
│ safe top / status        │  compact, always readable
├──────────────────────────┤
│                          │
│ main playfield / hero    │  protected center
│                          │
├──────────────────────────┤
│ contextual surface       │  appears only when needed
├──────────────────────────┤
│ navigation / primary CTA │  thumb reachable
└──────────────────────────┘
```

Rules:

- minimum primary target: 44 CSS px; repeated thumb actions should approach 48–56 CSS px;
- no critical control under the notch, rounded corner, home indicator or browser bar;
- the playfield center and lower-middle stay free of persistent panels;
- decorative art may bleed beyond safe area; critical text and controls may not;
- full-page scrolling is reserved for non-live reference content; live screens use drawers, sheets or internal lists;
- state is never conveyed by color alone;
- every modal traps focus and restores prior focus when closed.

## 2. Responsive policy

| Viewport | Policy |
|---|---|
| 360×800 | minimum supported portrait; compact typography and toolbar gaps |
| 390×844 / 393×852 | primary design reference |
| 412×915 / 430×932 | allow playfield to grow before enlarging chrome |
| tablet portrait | centered 9:16 core with controlled wider sheets |
| desktop | centered portrait game column up to about 540 CSS px; mouse/keyboard/gamepad |
| landscape | supported recovery layout; do not require it for normal play |

Use CSS Grid/Flex, `clamp()`, container queries and safe-area variables. Do not port NXR pixel coordinates into shipping CSS.

## 3. Global navigation

```text
Boot / Title
  -> Raising Home
      -> Creature Detail
      -> Training / Cage Edit
      -> Shop
      -> Database
      -> Gate Select -> Hunt Loadout -> Hunt -> Capture -> Hunt Result -> Home
      -> Battle Select -> Team Setup -> Auto Battle -> Result -> Progression -> Home
      -> Settings / Help
```

The screen stack owns navigation. A modal or bottom sheet is pushed above its parent; Back pops exactly one level unless a confirmed exit explicitly unwinds the current expedition.

## 4. Screen contracts

| Screen | Primary purpose | Main visual / renderer | Persistent UI | Contextual UI | Primary touch | Required data |
|---|---|---|---|---|---|---|
| Boot / Title | New Game, Continue, recovery | DOM + light Pixi background | title, save status | migration/error dialog | large CTA | save metadata |
| Raising Home | observe and care for residents | Pixi layered home | time, season, Bits, compact resident state | selected-creature action sheet | tap creature, tap action | residents, clock, care state |
| Creature Detail | understand one creature | DOM hero + Pixi portrait | identity, condition | Profile/Stats/Growth/Evolution tabs | swipe/tab/list | creature record, discovered values |
| Cage Edit | assemble a functional training habitat | Pixi shape-aware board + DOM module tray | unlocked cells, capacity, effect preview | module detail/placement sheet | drag/place/rotate-if-allowed/confirm | ownership, board mask, shape footprints, placement transaction, Training effects |
| Training | choose and resolve training | Pixi resident + DOM command | energy/condition | exercise details/results | large exercise CTA | training rules, effects, clock |
| Database | browse collection | DOM list/detail | search/filter/completion | creature tab sheet | tap card, swipe tabs | seen/captured/owned states |
| Shop | buy equipment/cages | DOM list/cards | Bits, category | item detail/confirm | tap item, confirm | availability, price, ownership |
| Gate Select | choose biome | bounded Three globe + DOM; list fallback | day/night, gate count | selected-biome card | drag globe, tap node | 16 biomes, unlocks |
| Hunt Loadout | prepare expedition | DOM equipment slots | capacity, equipped rope | inventory bottom sheet | tap slot, choose item | 5 gear classes, plugins, inventory |
| Hunt Field | explore large world | Pixi camera over 128×128 map | tiny status/objective | transient interact/capture prompt | tap/drag movement | map, collision, spawns, AI |
| Capture | execute tether/circle interaction | Pixi overlay over field | tether/capacity only | success/failure feedback | pointer stroke | capture state machine |
| Hunt Result | commit expedition outcome | DOM reveal + Pixi/VFX | captures/rewards | detail/overflow resolution | reveal/continue | atomic result transaction |
| Battle Select | choose mode/match | DOM cards | rank, eligibility | mode description | tap mode/match | six-mode availability, Titles |
| Team Setup | prepare three-creature team | DOM + Pixi portraits | slots, strategy | creature/strategy sheet | drag/tap slots | roster, eligibility, strategy |
| Auto Battle | watch strategy resolve | Pixi arena + 2D VFX | team HP/TP/status | expandable timeline/detail | speed/detail/pause | deterministic resolver/events |
| Battle Result | understand outcome | DOM staged reveal | win/loss, reward | stat and progression details | reveal/continue | result writes, rewards |
| Progression | Titles and Championship path | DOM route/timeline | current rank/year | unlock details | tap milestone | rank, Titles, calendar |
| Settings / Help | accessibility and control | DOM | category navigation | rebind/confirm | sliders/toggles | settings/save, action bindings |

## 5. Raising Home composition

Preferred first frame:

- top: compact time/season/Bits strip;
- center: living field taking 60–70% of usable height;
- resident state appears only after selection;
- context sheet: Feed, Clean, Treat, Inspect or another verified action;
- bottom: five or fewer primary destinations, with overflow behind More if required;
- save status is transient, not a large permanent button.

Do not show all eight unknown toolbar slots as finished commands. Unverified slots remain developer-only or neutral until traced.

## 6. Hunt composition

- camera follows the player through a world larger than the viewport;
- no permanent visible logic grid;
- minimal location and capacity HUD at the edge;
- movement and capture never compete for the same pointer state;
- entering capture explicitly switches the action context from `move-field` to `capture-draw`;
- opening a panel suspends field pointer input;
- return-home requires an intentional action and preserves result semantics.

Movement options must share one simulation command:

- touch: tap destination or approved drag gesture;
- mouse: click destination;
- keyboard/gamepad: directional action vector;
- optional floating touch stick is an accessibility adaptation, not a separate movement implementation.

## 7. Capture gesture contract

Pipeline:

```text
Pointer Event
  -> viewport/safe-area normalization
  -> Pixi world transform
  -> canonical capture coordinates
  -> point filtering/interpolation
  -> tether/circle state machine
  -> simulation result event
```

PixiJS v8 event implementation contract:

- the capture surface is `eventMode = 'static'` with a bounded `hitArea`;
- field art and decorative subtrees are `eventMode = 'none'` when they never receive input;
- after `pointerdown`, path sampling uses `globalpointermove` so leaving the target does not interrupt the stroke;
- `pointerup`, `pointerupoutside` and `pointercancel` all terminate or safely cancel the active gesture;
- only the primary pointer participates unless an approved accessibility mode says otherwise;
- `event.global` is converted with the canonical field/capture container's `toLocal()` transform;
- point/vector output buffers are reused to avoid allocating on every move event.

Test at minimum:

- finger, mouse and pen produce equivalent canonical paths;
- resize/DPR changes do not change the result;
- very short segments are ignored;
- long gaps are interpolated;
- point capacity is bounded;
- closure requires enough points, minimum span and tolerance;
- cancel, lost pointer capture and backgrounding recover safely;
- accessibility tolerance never grants a hidden gameplay advantage without an explicit adaptation policy.

## 8. Auto Battle composition

The player prepares but does not issue a command every turn.

- upper edge: opponent/title and Battle clock;
- center: mostly unobstructed arena;
- team status clusters stay near edges and use icon + shape + text, not color alone;
- major events produce short readable VFX and timeline entries;
- detail drawer can expose action names, status and calculations without covering normal play;
- controls are limited to pause, speed, detail and approved late-game features;
- HP changes only after resolver events; presentation tweening cannot become Battle truth.

## 9. Dense information patterns

| Original need | 2026 pattern |
|---|---|
| two-screen status + detail | hero summary + tabs |
| long Shop/equipment data | list + detail bottom sheet |
| database profile/stats/growth | tab strip with internally scrolling panel |
| Battle setup data | stepper: team -> strategy -> confirm |
| result pages | progressive reveal with skip |
| tutorial explanations | contextual hint, then Help archive |

Localization layouts allow at least 30% text expansion. Text, icons and numbers remain separate assets.

## 10. Event-driven HUD contract

DOM and Pixi views subscribe to changes such as:

- `clockChanged`, `currencyChanged`, `residentSelected`;
- `conditionChanged`, `inventoryChanged`, `loadoutChanged`;
- `expeditionStarted`, `captureStateChanged`, `expeditionResolved`;
- `battleEventCommitted`, `battleResolved`, `progressionChanged`;
- `saveStateChanged`, `activeInputDeviceChanged`.

No DOM component polls the whole game state every animation frame.

## 11. Skinnable content contract

Every screen consumes neutral product IDs and presentation records. A Content Pack may replace:

- product title, display names, terminology and world text;
- creature portraits, sprites, animation atlases and vocals;
- biome, Cage/Training and Battle-field art;
- UI theme tokens, decorative frames, icons and VFX;
- music, ambience, SFX and tutorial copy.

A Content Pack may not replace or own simulation state, save schema, collision, capture rules, Battle formulas, progression writes, screen transitions or canonical input actions. Hit areas, focus order and accessibility names remain explicit UI contracts rather than being inferred from image alpha.

For Cage Edit specifically, visual skins may replace terrain art, names, icons, animation and audio, but not module `shapeMask`, occupied cells, capacity or Training-effect semantics. The portrait flow must provide a bottom module tray, drag ghost, snap preview, green/red validity feedback, effect-delta preview, undo/cancel and an atomic Confirm action. Exact original footprints and numeric effects remain evidence-gated; neutral test definitions must be visibly labelled in development data.

During functional development, all presentation records use original-neutral placeholders. Final original public content is selected only after the game can reach Championship.

## 12. Accessibility and comfort

- text scale with reflow, not canvas bitmap scaling;
- strong focus indicator distinct from hover;
- screen reader names for every DOM control;
- reduced shake, reduced camera motion and disable/reduce flashing;
- optional Battle speed controls without changing simulation ordering;
- audio sliders for Master/Music/SFX/Ambience/UI/Voice;
- no essential hover, right-click, stylus precision or simultaneous multi-touch;
- focus and input return to gameplay only after the active sheet/modal closes.

## 13. Scene loading and memory behavior

- the first screen loads only the `boot-ui` bundle;
- entering Home loads the current residents and one environment, not the full roster;
- Gate 3D is lazy-loaded and may background-load after Home becomes interactive;
- choosing a Hunt biome loads `hunt-{biomeId}` and only eligible/visible creature families;
- Battle loads one field and the two teams involved;
- the next probable scene may background-load, but unrelated future bundles do not;
- after a transition is committed, old scene bundles are unloaded once shared resources are retained safely;
- loading, retry, skip/fallback and out-of-memory states are visible product states rather than console-only failures.

## 14. Screen acceptance matrix

Every screen must pass:

1. 360×800, 390×844, 393×852, 412×915 and 430×932 screenshots;
2. safe-area simulation at top and bottom;
3. touch-only primary flow;
4. keyboard/gamepad-only primary flow;
5. mouse flow on desktop;
6. 200% text-scale stress where supported;
7. loading, empty, error, interrupted and restore states;
8. reduced-motion and reduced-flashing modes;
9. no horizontal overflow or document scroll during real-time play;
10. the central playfield remains readable before secondary UI opens.
