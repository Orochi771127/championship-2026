# Cursor → Claude Code：戰鬥算術交接（先審查，再繼續）

日期：2026-08-31  
來源：Cursor（Grok）戰鬥轉譯工作階段  
Owner：Terence

**請先審查，通過後再繼續照原作轉譯。不要做戰鬥畫面。美術／UI 仍歸 Codex。**

聊天紀錄不是進度真相。這份檔與 Serena MCP（`mem:claude-code/battle-arithmetic-handoff`、`mem:core`）是同一交接。審查後請更新 **Claude Code 自己的** `CLAUDE_REBUILD_STATUS.json` / `CLAUDE_SYNC_DELTA.json`。Cursor **沒有**改那兩份專屬檔。

Claude-mem MCP 在寫入當下是 error／未連線，交接寫在 Serena + 本檔。

---

## 分工與禁止

- Codex：美術、UI、presentation pack。
- Claude／本交接的後續：原作架構與數值（ROM 再 dump，不猜）。
- 不要發明：命中／落空公式、TP、Sense→命中率、3v3 UI、假 always-hit 對戰、戰鬥存檔欄位、596 招日文名進 `src/`。
- `src/` 不得 import `research/` 或 Nexus。Runtime 圖只在 `assets/production/`。
- 一個 app、一個 screen stack、一個 save key `championshipModernSave:v1`、一個 Pixi ticker。Stack 沒有 `BATTLE`；VS2 測試把字串 `"BATTLE"` 當未知畫面。不要加 `openBattle`。

## 證據來源（只讀）

- ROM：`C:\Users\USER\Downloads\8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1.nds`  
  SHA-256 `8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`（YDIJ / DIGIMONCHAMP）
- 研究包：`R:\NEXUS LINK\原作`  
  Stage 4 `YDIJ_BATTLE_REVERSE_CLOSURE_STAGE4_2026-08-24`  
  Stage 6 `YDIJ_BATTLE_REVERSE_CLOSURE_STAGE6_DELTA_2026-08-25`
- OVL19 RAM `0x0210B300`，size `0x26920`

閘門：`BATTLE_IMPLEMENTATION_GATE_STAGE4.md`、`BATTLE_STAGE6_IMPLEMENTATION_GATE.md`。

---

## 產品裡已落地的檔（純算術，未接 app）

| 檔 | 職責 |
|---|---|
| `src/championship/battle/battleDamageCore.js` | OVL19 `0x021149A8` 曲線 × power /100 |
| `src/championship/battle/battleDamageResolver.js` | global%／地形 120／1.5×／亂數／HP／冷卻／可選 +1／進場種子 |
| `src/championship/battle/battleSupport.js` | 治療／清除／正面 900 tick／曲線 +1 |
| `src/championship/battle/battleStatus.js` | 對應／時長／proc／DoT／抗性跳表／行動閘門 |

測試：`tests/championship-battle-*-cases.mjs`  
Firewall 允許上述四檔（`tests/championship-migration-firewall-cases.mjs`）。

Cursor 最後一次驗證（2026-08-31）：對這五個測試檔 `node --test` → **50 pass / 0 fail**。完整 `npm test` 可能仍因 Hunt HD remaster 美術雜湊失敗——**不要在戰鬥刀裡「修」美術 hash**。

確認 `src/championship/app/**` 沒有 import 這些 battle 模組。

---

## 已從 ROM 轉譯的數字（審查時請再 dump，不要信註解）

**傷害核心：** ARM9 `0x020CA00C` stride 16，27 值  
`10,14,18,22,26,30,38,46,54,66,78,90,102,117,132,147,162,180,198,216,234,252,270,290,310,330,350`  
`A = curve[min(i,26)]`，`core = trunc(5A/2) - D`，`dmg = trunc(core * power / 100)`，power = action `+0x4A` u16。  
負 index：產品拋錯（ARM 會讀到表前）。

**後段：** global 預設 100；11×11 有號矩陣 `0x0213007C`，第一格 `>0` 或第二格 `<0` → `×120/100`；dmg>0 時 RNG channel **216**：`roll < {2,3,5,7}[tier]` 才 `×3/2`（tier≥4 當 3）；再 `rem 100`，`dmg += trunc(dmg * roll / 1000)`。  
HP：`current > 0` 才減，可為負。  
冷卻 `+0x28`：`90 - 2 * speedIndex`；`+0x160 == 3` → `trunc(×80/100)`。tick：`>0` 則 -1。6 個戰鬥單位迴圈。不要把 `+0x24` 的遞減當成節奏。

**治療 field_5C 14–19：** +300 / +900 / +2100 / +200 / +600 / +1400，再夾到 maxHP。  
20 = 清 `+0x158/+0x15C`。21–29 → 正面代碼 1–9，時長 **900**。  
field_54 的 1/2 只匯出，沒有選目標迴圈。

**曲線 +1：** 攻擊端正面 1 或負面 runtime 1（兩個同時也只 +1）。防禦端 action `+0x58` 0..5 → 正面代碼 2,5,6,8,9,7（>5 同 0）。  
查表高邊夾 26；狀態 proc 用的 leftover `r4`/`sl` **不夾**（`clampHigh: false`）。  
`resolveBattleDamage` 若傳 `positiveEffectCode` / `negativeRuntimeCode` / `actionElementSelector`，會把 index 當 **base** 再 +1。舊測試沒傳這些欄位。

**狀態：** field_5C 1..13 → runtime `5,7,10,9,11,8,6,12,13,2,1,4,14`。  
時長 u16 `0x0212FECC`：0；1–11 = 600；12–14 = 900。單槽覆蓋。  
Proc：`clamp(atk-resist,-4,+4)+4`；stride 8 第一個 word。一般表 `0x02130038`：`0,5,10,15,20,25,30,35,40`。id13 `0x02130034`：`0,0,0,0,5,6,8,12,24`。`roll < 門檻` 才上。**不是百分比。**

**抗性跳表 `0x021152F4`：**  
1/4/7/8 = leftover 已選防禦 index；2/9/10 = 能力 `+0xA0`；3 = `+0xA4`；5/13 = `+0x9C`；6/11/12 = 哨兵 **999**（`0x021156B0`）。

**DoT：** 先減 tick。runtime 7 或 13 且新剩餘 `% 180 == 0` → `trunc(max×3/100)`；14 且 `% 10 == 0` → `trunc(max×5/100)`。HP&lt;0 → 歸零並清除；剛好 0 **不清**。tick 開始時剩餘 ≤0：清除且不做 DoT。

**行動閘門 `0x021157BC`：** 3→狀態 9；4→12；8/9/10/12 先清再一般選招；1/5 若 `+0x24<=0` → 狀態 8 或 10，否則寫 Q12 `204800`/`122880`、冷卻 `90-2*speed`（**這條不加 80%**）、狀態 3。狀態號是 ARM 傳給 `0x02114984` 的 r1，不要用 Blind／Freeze 當程式識別字。

**進場種子 `0x021169E8`（僅這條 handler，不是全模式開場公式）：**  
`+0x16C != 0` 不寫冷卻；`+0x17C == 1` 先花 **兩次** channel 216 再 `30 + (餘數 31)`；否則 **42**。然後 `+0x28<=0` 才進閘門。

RNG helper `0x020431D4` 模 103 已見；channel 216 分佈未證。產品一律 **注入** `rng.next(216)`。

---

## 審查清單（繼續之前必須過）

1. 用上面那顆 ROM 再 dump OVL19 表；對不上就改產品，不要「抹平」。
2. 跑：

```text
node --test tests/championship-battle-damage-core-cases.mjs tests/championship-battle-resolver-cases.mjs tests/championship-battle-support-cases.mjs tests/championship-battle-status-cases.mjs tests/championship-migration-firewall-cases.mjs
```

3. app 樹沒有 battle import。
4. 沒有日文招名、沒有把重建狀態名當 gameplay id、沒有 hitChance／accuracy／TP 發明。
5. 不要新增戰鬥畫面。

未要求前不要 commit。

---

## 審查通過後：下一刀（仍照原作）

Dump 命中／接觸在 DamageResolver **上游**。Stage 6：三處呼叫 `0x0211C92C` / `0x0211D9E0` / `0x0211D9FC`。有界呼叫 `0x0211C714–0x0211C92C` **沒有** RNG216。只實作已證明的拒絕（空目標、HP≤0）。**不要**發明命中率公式。

仍擋：Sense 機制、TP、Bits 獎勵公式、AI 策略人話、同幀同時歸零誰先動、596 招表進產品。
