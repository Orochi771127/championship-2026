# Shop reverse catalog verification

Date: 2026-09-13  
Product: Championship 2026  
Purpose: verify the external research catalog before using it as original-text evidence

## Source

- External research file: `R:\NEXUS LINK\原作\YDIJ_RAW_RESEARCH_EVIDENCE\SHOP_REVERSE_CATALOG_118.csv`
- Size: 32,654 bytes
- SHA-256: `58e5beb04f8c75c388710291c5c5506a560453872743ca34c7c3a7ef2bf1bc28`
- Parsed as CSV with quoted multiline fields: 118 records, indexed continuously from 0 through 117
- `name_jp`: 118 non-empty values and 118 unique `name_text_id` values
- `description_jp`: 118 non-empty values and 118 unique `description_text_id` values

The apparent 318-line count came from physical newlines inside quoted Japanese descriptions. It is not the CSV record count.

## Category census

| source category | product category | records |
|---|---|---:|
| Training Goods | `TRAINING_GOODS` | 4 |
| Hunt Items | `HUNT_ITEMS` | 49 |
| Plugins | `PLUGINS` | 30 |
| Cages | `CAGES` | 35 |
| Total | | 118 |

## Cross-check against the product catalog

Every external row was compared with `src/data/championship/catalogs/shop.r1.json` by record position. The following fields matched for all 118 records:

- record index
- category
- item index
- initial owned quantity
- maximum owned quantity
- unit price
- unlock kind
- unlock parameter

Result: `118 compared / 0 mismatches`.

This closes the earlier claim that the original Shop names and descriptions were unavailable. The original Japanese strings are verified research evidence. They are not copied into the runtime. `src/championship/text/catalogs.zhHant.js` contains independently written Traditional Chinese names and descriptions keyed by the same 118 record indices and records this source hash.

## Implementation validation

- Focused Shop/localization/Raising scene tests: 25/25 pass
- Portable CI tests: 1,270/1,270 pass
- Full local tests, including local-reference coverage: 1,487/1,487 pass
- Startup module preload check: 179 modules pass
- Owner playtest build and independent validation: 6,282 files, build ID `59243f91f4222e615af638a2c6b78a25b816ec08a4141ab4394707c5dfa5f650`
- `git diff --check`: pass

These checks establish catalog mapping, product-text coverage, test integrity, and build integrity. They do not establish visual parity in a normal browser or on a physical device.

## Not established by this file

- The Japanese strings do not become an official Traditional Chinese localization.
- The external `R:\NEXUS LINK` tree does not become a runtime dependency or a second product authority.
- Text verification does not change gameplay, purchase, rights, browser, device, public-release, or shipping acceptance.
