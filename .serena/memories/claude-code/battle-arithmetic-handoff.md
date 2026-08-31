# Claude Code handoff — battle arithmetic (Cursor → Claude)

Owner Terence 2026-08-31: Codex owns art/UI. Runtime architecture and numbers from YDIJ ROM only. Chat is not SSOT — also `docs/coordination/CURSOR_BATTLE_ARITHMETIC_HANDOFF.md`.

**Do this first: REVIEW. Do not extend until the review below is green.**
Then continue original translation. Do not open a BATTLE screen.

## Authority
- ROM: `C:\Users\USER\Downloads\8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1.nds` SHA-256 `8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1` YDIJ/DIGIMONCHAMP
- Research (read-only, never copy into `src/` or runtime): `R:\NEXUS LINK\原作` Stage4 `YDIJ_BATTLE_REVERSE_CLOSURE_STAGE4_2026-08-24` Stage6 `YDIJ_BATTLE_REVERSE_CLOSURE_STAGE6_DELTA_2026-08-25`
- OVL19 RAM `0x0210B300` size `0x26920`. FAT overlay 19.
- Product: one app, one screen stack, one save `championshipModernSave:v1`, one Pixi ticker. DOM UI / Pixi 2D. No BATTLE screen in stack.
- After review, Claude updates *its own* `CLAUDE_REBUILD_STATUS.json` / `CLAUDE_SYNC_DELTA.json`. Cursor must not overwrite those files.

## Product files (arithmetic only — not wired to `src/championship/app`)
- `src/championship/battle/battleDamageCore.js` — OVL19 `0x021149A8` curve×power/100
- `src/championship/battle/battleDamageResolver.js` — global% / field 120 / crit 1.5× / variance / HP / cooldown / optional +1 / state-entry seed
- `src/championship/battle/battleSupport.js` — heal / clear / positive 900 / curve +1
- `src/championship/battle/battleStatus.js` — map / duration / proc / DoT / resistance jump / action gate
- Tests: `tests/championship-battle-*-cases.mjs` + firewall allowlist of those four files
- Last Cursor verify 2026-08-31: `node --test` on those five files → **50 pass / 0 fail**. Full `npm test` may still fail Hunt HD remaster art — do not “fix” art hashes in this lane.

## Verified numbers (re-dump ROM; do not trust comments)
Damage: curve 27 @ ARM9 `0x020CA00C` stride 16: 10,14,18,22,26,30,38,46,54,66,78,90,102,117,132,147,162,180,198,216,234,252,270,290,310,330,350. `A=curve[min(i,26)]` `core=trunc(5A/2)-D` `dmg=trunc(core*power/100)` power u16 action+0x4A. Negative index: product throws (ARM would underflow).
Post-core: global default 100; field 11×11 signed @ `0x0213007C` cell>0 or second<0 → ×120/100; if dmg>0 RNG ch 216: roll<threshold{2,3,5,7} → ×3/2; then rem100, `dmg+=trunc(dmg*roll/1000)`. HP: if current>0 then -=dmg (can go negative). Cooldown +0x28: `90-2*speedIndex`; +0x160==3 → trunc(×80/100). Tick: if >0 -=1. Loop of 6 combatants. Do not implement +0x24 decrement as cadence.
Heal field_5C 14–19: +300/+900/+2100/+200/+600/+1400 then clamp to maxHP. 20=clear +0x158/+0x15C. 21–29 → positive codes 1–9 duration **900**. field_54 1/2 exported; no targeting loop.
Attacker +1 if +0x160==1 OR +0x158==1 (once). Defender +1 via action+0x58 selector 0..5 → codes 2,5,6,8,9,7 (selector>5 same as 0). Damage lookup clamps 26; leftover r4/sl used by proc is **unclamped** (`clampHigh:false`).
Status map 1..13 → 5,7,10,9,11,8,6,12,13,2,1,4,14. Duration u16 @ `0x0212FECC`: 0; 1–11=600; 12–14=900. One slot overwrite. Proc: clamp(atk-resist,-4,+4)+4; stride-8 first word; normal `0x02130038` 0,5,10,15,20,25,30,35,40; id13 `0x02130034` 0,0,0,0,5,6,8,12,24. Apply iff roll<threshold. **Not percents.** RNG 216.
Resistance jump `0x021152F4`: 1/4/7/8 selected leftover defense index; 2/9/10 stats+0xA0; 3 +0xA4; 5/13 +0x9C; 6/11/12 sentinel **999** @ `0x021156B0`.
DoT after decrement: runtime 7|13 and rem%180==0 → trunc(max*3/100); 14 and rem%10==0 → trunc(max*5/100). HP<0 → 0 and clear; HP==0 keeps slot. remaining<=0 at tick start clears without DoT.
Action gate `0x021157BC`: 3→state 9; 4→state 12; 8/9/10/12 clear then normal; 1/5 if +0x24<=0 → states 8/10 else Q12 204800/122880, cooldown 90-2*speed (**no** 80%), state 3. State ids are ARM r1 to `0x02114984` — not reconstructed names.
Seed `0x021169E8` (this handler only, not universal start): +0x16C!=0 no seed; +0x17C==1 spends **two** ch216 then `30+(rem 31)`; else **42**. Then if +0x28<=0 call gate.
`resolveBattleDamage` optional `positiveEffectCode`/`negativeRuntimeCode`/`actionElementSelector` treats indices as **base** and raises. Existing tests omit those fields.

## Review checklist (must pass before continue)
1. Re-dump OVL19 tables from the ROM above; mismatch → fix product, do not “smooth”.
2. `node --test tests/championship-battle-damage-core-cases.mjs tests/championship-battle-resolver-cases.mjs tests/championship-battle-support-cases.mjs tests/championship-battle-status-cases.mjs tests/championship-migration-firewall-cases.mjs`
3. Confirm `src/championship/app/**` does not import battle modules.
4. Confirm no Japanese action names, no Blind/Freeze as gameplay ids, no hitChance/accuracy/TP invention.
5. Confirm VS2 tests still treat screen name `BATTLE` as unknown — do not add `openBattle`.

## Hard no
Hit/miss formula; Sense mechanic; TP; 596-action Japanese table in product; Bits reward formula; AI strategy meanings; universal battle-start seed; same-frame tie order; 3v3 UI; fake always-hit match; save field for battle.

## After review: next original slice
Dump hit/contact **upstream** of DamageResolver. Stage6: three calls `0x0211C92C` / `0x0211D9E0` / `0x0211D9FC`. Bounded caller `0x0211C714–0x0211C92C` has no RNG216. Implement only proven rejects (null target, HP<=0). Do **not** invent accuracy%.
RNG helper `0x020431D4` modulus 103 is ARM9; channel-216 distribution unproven — keep RNG injected.

Gates: Stage4 `BATTLE_IMPLEMENTATION_GATE_STAGE4.md`; Stage6 `BATTLE_STAGE6_IMPLEMENTATION_GATE.md`.
