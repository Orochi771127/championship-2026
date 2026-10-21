# Original UI intake / medal collection — 2026-10-07

Owner authorized local integration of delivered 61 medals, 100 items and 3 database icons, plus a player-reachable medal collection page. No new achievements, saves, unlock rules or public release are authorized.

## Evidence → contract

- Existing titleEventSchedule.js: ARM9 02089230 scans title records 0..60, schedule fields14/18, rank requirement 2*field10. Record61 is tutorial and excluded.
- Existing nativeTitleProgression.js: OVL8 result/rank writers; 600 retained CPU vectors. A title win adds its record index to canonical progression.battleBadges. This collection only reads that existing authority; missing old history remains empty.
- scripts/build-character-hud-reference.py: OVL8 resource format database/item_badge%03d uses match index+1 for 61 original medal positions. This is not one badge per creature.
- Delivery badges61/MANIFEST.json has exactly61 art candidates and no achievement assignment. Binding delivery order to existing title slots is PRODUCT_AUTHORED DISPLAY ASSIGNMENT, not an original creature-to-title fact. artIdentity is provenance only and never unlocks anything.
- Database targeted static trace: source ARM9 / OVL16 at metadata base0210b300. OVL16 0210bc94 creates a two-entry list; 0210bcc4 calls02095ee8, 0210bcd4 calls02095f88 with index0/1; loop bound2 at0210bd04. ARM9 02095f88 stores frame; 02095ff0/02096018..3c selects explicit frame through0207ee40. Selection0210c99c branches index0 to state4 and index1 to state7. Database scene node1 is database_icon. Only cell0 (book) and cell1 (medal board) are bound here. Cell2 remains UNKNOWN_REQUIRES_TRACE and is staged, not guessed as Help.
- Decoded database_icon/cells.json bounds provide logical48x64 origin24,32; 64x64 origin32,32; 56x48 origin24,24. Source is read-only research, not runtime pixels. New PNGs are Owner-supplied originals at density4.
- ITEM100_MANIFEST.json supplies83 non-cage shop record/item/product IDs and17 extra care frames. All83 identities match the current shop catalog. Existing16 in-world care cells match native dimensions/origins and raw ticks exactly. Fresh-food poses are quantity states. Spoiled/waste/clean two-pose timing remains18 ticks. No new cage icons or gameplay logic.

## Implementation and acceptance

Use existing application screen stack, DOM view, progression.battleBadges and title text. Collection shows61 slots with acquired status and readable condition/details. A local-only new menu entry is presentation adaptation. Title-result art uses the same display mapping. No save migration or writes from viewing. Return, scrolling, tapping, empty/full/legacy states and narrow portrait layout require normal browser checks in isolated saves. Data checks are not visual/physical-device acceptance.

Assets: assets/production/original-ui-intake-20261007/manifest.json. Loopback-only. Public release and commercial clearance remain false. Original bytes, full density and geometry retained. Source/intake/rollback evidence stays under R:/Projects/Championship2026/handoff-review-20261007. No runtime import from research or Nexus paths.

Additional 2026-10-07 bounded static scan: ARM9 plus all 22 uncompressed overlays retain one direct frame-setter caller (OVL16 0210bcd4, two-entry loop). The alternate constructor is a same-scene clone path, not evidence of cell2 use. Evidence: R:/Projects/Championship2026/handoff-review-20261007/database-cell2-trace-r2/trace-receipt.json. No emulator watchpoint trace was performed; indirect or alternate use remains UNKNOWN_REQUIRES_TRACE.
