# QA unlock — `?qa=unlock`

Date: 2026-09-12
Owner request: open every item, field and cage for acceptance testing, then
return to ordinary progression afterwards.

## What it does

Adds `?qa=unlock` to the address. On the next new game or continue, the session
is granted the three resources the original's own rules read:

| Granted | Value | Derived from |
|---|---|---|
| Money | 9,999,999 (`BITS_WALLET_CAP`) | the cap the shop itself enforces |
| Tamer rank | 9 (existing higher values preserved) | `TAMER_RANK_TABLE_LAST_INDEX`, plus gate prerequisites |
| Battle badges | all 61 ordinary titles, indices 0..60 | `TITLE_EVENT_SCAN_LIMIT`, plus gate prerequisites; existing flags preserved |

Rank 9 also raises the ranch to its full 20 slots
(`TAMER_RANK_SLOT_TABLE`), so every cage module can be bought and placed.

## What it deliberately does not do

**It changes no rule.** Gate admission, the fee debit, shop purchase caps, cage
slot counts and placement validation all still run and still decide. A gate that
opens under the grant opened because `gateAdmission()` said so — which is the
point: a tester proves the admission code works rather than that it was skipped.

It is a grant, not a bypass, and it reaches the game only through seams that
already existed for this purpose: `creditBits` and `setTamerRank` were already
marked PRODUCT_AUTHORED. `setBattleBadges` was added beside them in the same
shape, because gate unlock kind 2 reads a list that previously only a battle
result could write.

## Measured

| | without | with |
|---|---|---|
| Hardest gate (`gate:ruins`, rank 8, fee 4,000) — confirm button | disabled | **enabled** |
| Wallet | 0 | 9,999,999 |
| Shop rows buyable | 0 of 4 | **4 of 4** |

## Safety

- **Off unless asked for by name.** `?qa`, `?qa=`, `?qa=1`, `?qa=UNLOCK` and an
  absent query all refuse. A test pins the whole refusal list.
- **One call site.** A test asserts `applyQaUnlock` is called exactly once in the
  product, that the call sits behind the request check, and that no other file
  under `src/` so much as mentions the module.
- **Cannot break a boot.** A seam that refuses is collected and reported, never
  thrown.
- **Full grant, additive.** The Owner clarified on 2026-09-12 that money, rank
  and badges should all be maxed for QA. The first implementation supplied only
  gate prerequisites; review corrected it to the native rank/title tables.
  Tests verify every gate and all 118 shop rows open, repeated grants preserve
  progression, and title settlement plus Save/Continue retains it.

## Reverting

There is deliberately **no second QA save slot**: the repository rule is one save
repository and one save key, and a debug convenience is not a reason to break it.
So the grant changes the running session, and saving while unlocked persists it.

The Owner will decide the restoration workflow after QA; no automatic rollback
or second save slot is introduced. Starting a new game without the parameter
still uses ordinary progression. Removing the parameter does not undo a saved grant.

To remove the feature entirely: delete `src/championship/app/qaUnlock.js`, its
test, the two lines in `main.js`, and the `setBattleBadges` seam.
