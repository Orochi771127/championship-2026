# Cage identity / text / shop / visual trace — 2026-09-05

## Result

The 2026-09-05 handoff's shifted catalog is disproved by the ROM. The existing visual binding is correct: definition 0 is vacant lot (あきち), field_cm01_01, defence up, recommended 2; definition 1 is the running track, field_cm02_01, HP up, recommended 6. Waiting Room remains definition 35. Lid is the adjacent structural visual, outside the 36 definitions.

ROM SHA-256: 8AD375BA0BD9B652A25F72DEAD2B47F78DA401E188A8F3E1B7A6F2867EE0C5D1. Text bank SHA-256: e9f390cab3c61e4c17791f2253043a8d1ca9bfc036f48ea9723ef769ef8012b3. The bank was read directly through the ROM FAT/FNT and decoded with the existing ydij_text_bank parser. No ROM or image payload was copied into runtime by this work.

## Root cause and independent evidence

The field-pointer column starts at 0x020C8CC0; the NAME column starts at 0x020C8CDC; description starts at 0x020C8CE0. All advance by 40 bytes. The handoff builder mistakenly used offsets +0x28/+0x2C from the NAME column, reading the next identity. Correct offsets from that base are +0/+4.

OVL15 function 0x0210C424 multiplies the incoming index by 0x28 at 0x0210C42C/430. It loads name base 0x020C8CDC through the literal at 0x0210C604 and reads [base + index*40] at 0x0210C440. It independently loads description base 0x020C8CE0 through 0x0210C608 and reads it at 0x0210C454. There is no extra one-record offset. Instruction witnesses are in the companion JSON.

An independent join of all 35 category-3 ShopItemTable records (ARM9 0x020E0248, stride 56) matches each itemIndex to exactly the same name and description IDs. Shop row 83 is itemIndex 0, name 494, description 534. Mini Gym is shop row 88/itemIndex 30; Mini Infirmary is row 112/itemIndex 15. Screenshots confirm displayed effects, but cannot establish a numeric record index by themselves.

The name-to-description gap of 40 is necessary but insufficient: both the correct and shifted rows satisfy it. The builder now rejects disagreement with the independent shop table, and validates the bank against the ROM even when an extracted nitrofs is supplied.

## Complete referenced crosswalk

| Definition | ROM Japanese name | Field | Name/description IDs | Shop row | Role |
|---|---|---|---|---|---|
| 0 | あきち | field_cm01_01 | 494/534 | 83 | SHOP_CAGE |
| 1 | うんどうじょう | field_cm02_01 | 495/535 | 85 | SHOP_CAGE |
| 2 | きょうぎじょう | field_cm03_01 | 496/536 | 86 | SHOP_CAGE |
| 3 | どうじょう | field_cm04_01 | 497/537 | 87 | SHOP_CAGE |
| 4 | ジム | field_cm05_01 | 498/538 | 89 | SHOP_CAGE |
| 5 | けんきゅうじょ | field_cm06_01 | 499/539 | 109 | SHOP_CAGE |
| 6 | かざん | field_cm07_01 | 500/540 | 93 | SHOP_CAGE |
| 7 | そうげん | field_cm08_01 | 501/541 | 91 | SHOP_CAGE |
| 8 | ビーチ | field_cm09_01 | 502/542 | 95 | SHOP_CAGE |
| 9 | こうざん | field_cm10_01 | 503/543 | 97 | SHOP_CAGE |
| 10 | もり | field_cm11_01 | 504/544 | 98 | SHOP_CAGE |
| 11 | ジャングル | field_cm12_01 | 505/545 | 99 | SHOP_CAGE |
| 12 | しんでん | field_cm13_01 | 506/546 | 107 | SHOP_CAGE |
| 13 | はかば | field_cm14_01 | 507/547 | 103 | SHOP_CAGE |
| 14 | こうじょう | field_cm15_01 | 508/548 | 100 | SHOP_CAGE |
| 15 | ミニほけんしつ | field_cm16_01 | 509/549 | 112 | SHOP_CAGE |
| 16 | びょういん | field_cm17_01 | 510/550 | 110 | SHOP_CAGE |
| 17 | はなぞの | field_cm18_01 | 511/551 | 102 | SHOP_CAGE |
| 18 | おんせん | field_cm19_01 | 512/552 | 114 | SHOP_CAGE |
| 19 | さばく | field_cm20_01 | 513/553 | 104 | SHOP_CAGE |
| 20 | こおり | field_cm21_01 | 514/554 | 105 | SHOP_CAGE |
| 21 | はつでんしょ | field_cm22_01 | 515/555 | 106 | SHOP_CAGE |
| 22 | ガスルーム | field_cm23_01 | 516/556 | 111 | SHOP_CAGE |
| 23 | おてら | field_cm24_01 | 517/557 | 90 | SHOP_CAGE |
| 24 | どうぶつえん | field_cm25_01 | 518/558 | 115 | SHOP_CAGE |
| 25 | ぼくじょう | field_cm26_01 | 519/559 | 116 | SHOP_CAGE |
| 26 | リング | field_cm27_01 | 520/560 | 117 | SHOP_CAGE |
| 27 | ミニうんどうじょう | field_cm30_01 | 523/563 | 84 | SHOP_CAGE |
| 28 | ほけんしつ | field_cm31_01 | 524/564 | 113 | SHOP_CAGE |
| 29 | ミニはなぞの | field_cm32_01 | 525/565 | 101 | SHOP_CAGE |
| 30 | ミニジム | field_cm34_01 | 527/567 | 88 | SHOP_CAGE |
| 31 | ミニかざん | field_cm35_01 | 528/568 | 92 | SHOP_CAGE |
| 32 | ミニこうざん | field_cm37_01 | 530/570 | 96 | SHOP_CAGE |
| 33 | ミニビーチ | field_cm39_01 | 532/572 | 94 | SHOP_CAGE |
| 34 | どうくつ | field_cm40_01 | 533/573 | 108 | SHOP_CAGE |
| 35 | ひかえしつ | field_cm28_01 | 521/561 | — | WAITING_ROOM |
| — | ふた | field_cm29_01 | 522/562 | — | LID |

Of 40 field assets, 36 belong to definitions, one is Lid (cm29), and three (cm33/cm36/cm38) are not referenced by this table. Their original runtime use remains UNKNOWN_REQUIRES_TRACE; they are not silently assigned to cages.

## Repairs and preserved boundaries

- Corrected the existing catalog builder and regenerated all 36 text/effect rows.
- Restored Defence for the vacant lot, Dark resistance for the cave at 34, and the empty Waiting Room description at 35. Tick magnitude stays UNKNOWN_REQUIRES_TRACE.
- Corrected all 36 index-keyed Chinese cage names and added the product-authored Defence label. Japanese catalog text remains Japanese.
- Retained existing art bindings, shop indices, stable module IDs and save authority. No save migration or asset replacement is needed.
- Added cross-table runtime tests covering all 36 identities. Before the fix all three new tests failed; after the fix the focused group passed 23/23.
- In-memory positive controls reintroduced +0x28/+0x2C and shifted the name-column base by 40 independently. Both were rejected at shop row 83 by SHOP_CAGE_TEXT_MISMATCH.
- Final complete regression: 831/831 pass, 0 fail, 0 skipped. ROM catalog `--check` passes. `git diff --check` passes with existing line-ending notices only. Browser QA was not rerun for this data-identity batch; existing save/restore and Cage presentation-seam tests passed in the full suite.

## Reproduction

From the product repository, with the owner-supplied matching ROM outside it:

```powershell
python scripts/build-cage-definitions.py --rom <YDIJ.nds> --check
node scripts/audit-original-map-bindings.mjs <YDIJ.nds>
node --test tests/championship-cage-identity-crosswalk-cases.mjs tests/championship-vs4-cage-edit-cases.mjs tests/championship-zh-hant-text-cases.mjs tests/championship-original-map-bindings-cases.mjs
```

The Python builder and JavaScript audit read the ROM independently and agree on all 36 text/visual identities and 35 shop joins. The old SHOP_REVERSE_SPEC §12.3 and external SHOP_CAGE_CROSSWALK incorrectly combine shifted field pointers with correct text identities; they remain read-only historical evidence. The supplied handoff remains preserved with a correction notice in its repository copy.

## Still unknown / outside this batch

Training magnitudes, unreferenced-field runtime roles, and Waiting Room's original acquisition/use trigger are not resolved here. The current alwaysOwned behavior is retained, not newly verified by this trace. The old negative claim about six stat-magnitude columns used the faulty row/column basis and is withdrawn as evidence; this does not authorize a replacement formula. Battle cube panels and general DOM localization are subsequent batches.
