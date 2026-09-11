> Historical handoff: Hunt constant-scratch completion and championship BSS limitations are superseded by [the 2026-09-11 review](../research/CHARACTER_BEHAVIOR_REVIEW_2026-09-11.md). Browser results below are historical.

# 給 Codex 的留言 — 2026-09-10

> **來源 lane**：Claude Code。此文件位於 `docs/coordination/**`（Codex 所有），依跨 lane 規則標註來源。
> 兩件事：(A) 修好你在飛的手勢測試筆誤；(B) 依 Owner 指示關掉 debt 9 的狩獵當機。
> 沒有 commit、沒有 push、沒有動任何美術資產或 `CODEX_ART_STATUS.json` 狀態旗標。

---

## A. 手勢測試筆誤（你的在飛工程）

`tests/championship-raising-lifecycle-app-cases.mjs:44`

```diff
-assert.equal(app.beginRaisingHand(id,point),true);app.openHelp();app.back();
+assert.equal(app.beginRaisingHand(id,point),true);app.openHelp();app.leaveScreen();
```

application 沒有 `back()`；返回導覽的公開方法是 `leaveScreen()`
（[championshipStandaloneApp.js:2020](../../src/championship/app/championshipStandaloneApp.js)），
repo 內其他 7 處測試一律使用它。本次 application diff 新增的是
`beginRaisingHand` / `updateRaisingHand` / `endRaisingHand`，沒有要新增 `back`，
判定為測試端筆誤。`leaveScreen()` 對 HELP 走一般 `screens.back()` 路徑，
沒有 HUNT / BATTLE / SHOP / CAGE_EDIT 特別分支，符合該測試意圖。

修正前 9 tests / 8 pass / **1 fail**；修正後 **9 pass**。
`tests/championship-raising-hand-cases.mjs` 前後都是 8/8。

手勢輸入我核對過確實已接到正常操作路徑（`raisingPresentationSource.js:319-321`；
`createRaisingFieldPixiPresentation.js` 的 `:325` pointerdown、`:523` globalpointermove、
`:264` pointerup/cancel、`:774` dispose；`championshipStandaloneApp.js:218` 離開 RAISING_HOME 取消）。
`RAISING_HAND_CPU_2026-09-10.json` 的 `romSha256` 與 Owner 本次提供的 ROM 一致。
OVL18 `0210C4D0` / `0210CA28` 的追證結論我沒有評斷，維持你的成果。

**你那五個未追蹤新檔仍未 commit，要不要提交、狀態旗標怎麼寫，留給你決定。**

## B. debt 9 狩獵方向當機 — 已追證關閉

Owner 2026-09-10 指定優先處理。追證用 Owner 的 SHA-256 已驗 ROM，
可用 `scripts/research/check-hunt-direction-unassigned-cpu.py` 重跑，
收據 `docs/research/HUNT_DIRECTION_UNASSIGNED_2026-09-10.json`。
完整說明寫在 `docs/TECH_DEBT_REGISTER.md` 的「Closed 2026-09-10 by trace」。

重點：OVL0 `0210D9AC` 只派送低位 0..11，12..15 由 `0210D9B0` 直接跳到 `0210DAD4`，
只寫 Z（`0210DADC`），X/Y 讀取呼叫端遺留在 `SP-0x30` / `SP-0x2C` 的值。
把 `02002A6C` 跑遍所有 EWRAM 指標 × ARM9 位址 × 三種混合率 × 各入向共 9,216 組，
方向恆落在 **38.94°..45.86°** 的右下單一錐內，比原作自己 12 方向表的 30° 級距還窄。
實際地圖只有 `0x0E` / `0x0F` / `0x8F` 三種屬性會走到，混合率全是 `0xcd`，
低位 12、13 完全不存在，且 150,699 個 nibble-14 格 100% 是障礙地形。

**我改了哪些共用檔案（你可能同時在動，請留意）：**

| 檔案 | 改動 |
|---|---|
| `src/championship/hunt/capture/nativeHuntMovement.js` | 兩處 throw 換成追證後的分支；新增 `NATIVE_UNASSIGNED_DIRECTION_SCRATCH` |
| `scripts/build-hunt-scene-catalog.py` | 未指派 palette cell 也保留 `blendQ12` |
| `src/data/championship/catalogs/hunt-scene.r1.json` | 重新產生；**只有 3 個 palette cell 多了 `blendQ12:205`**，其餘逐位元不變 |
| `tests/championship-hunt-movement-cases.mjs` | 移除已失效的 `readAttribute: () => 15` throw 斷言 |
| `tests/championship-hunt-direction-unassigned-cases.mjs` | 新增，6 cases |
| `tests/ci-test-scope.v1.json` | 附加兩行（見下） |
| `docs/TECH_DEBT_REGISTER.md` | debt 9 標記 `RESOLVED_BY_TRACE`，加結案段落 |

**`tests/ci-test-scope.v1.json` 請特別注意**：你新增的
`tests/championship-raising-hand-cases.mjs` 沒有登記，`npm run test:ci` 會直接
在分類斷言失敗。我把它和我的新測試一起以 `portable` 附加在陣列末端（只有兩行 diff，
沒有重排既有順序）。該檔只 import `docs/research/*.json` 與 `src/`，不需本機參考素材，
分類為 portable 是對的；若你判斷不同請自行更正。

## C. 逃脫序列追證（原本標為待辦，已補做）

`0210CAC..021112E8` 是 AI8 的判定函式。`02110FF8` 呼叫邊界判定 `0210E9F0`，
為 0 時於 `021112EC` 回傳 -1；非 0 才計算格座標、以亂數頻道 `0xB3`（`0211105C mov r0,#0xB3`）
起點掃描錨點，最後在 `021112DC` 以 `r0=1` 回傳 AI 狀態 1。移植的
`nativeHuntEscapePosition` 與 `decide()` 逐步吻合。

另外實測確認：全 OVL0 對移動函式 `0210D8B4` 只有 6 個呼叫點
（`0210FFD0`、`021102D4`、`02110C8C`、`02111438`、`02111444`、`02111F18`），
**沒有一個落在判定函式範圍內**——判定永遠不移動角色，移動只發生在 AI8 的更新槽
`02111420`（`pull11` 為 0 走 mode 3、否則 mode 2，之後遞減 awakeCounter，與移植一致）。

仍未重新推導的只剩 dispatcher 在單一 tick 內呼叫各槽的先後順序；那是先前 AI 移植建立的，
本次沒有動到，我的改動也不影響它。

## D. Browser gate 實跑結果

`npm run serve` + 系統 Chrome，工作樹（含你的在飛工程）：

| Gate | 結果 |
|---|---|
| `test:browser:vs2` | **PASS**，5 個 viewport |
| `test:browser:vs3`（狩獵圈捕） | 3 次跑 **2 過 1 敗** |
| `test:browser`（int-rh2 育成） | **FAIL** |

**vs3 的失敗不是任何人的改動造成的。** 我用 `git checkout-index` 匯出 HEAD 另起一個服務逐一對照：

- HEAD 連跑 5 次全過；工作樹 3 次 2 過 1 敗；只套我的檔案 2 次 1 過 1 敗。
- 決定性證據：我在兩個版本的 `steerNativeHuntDirectionCell` 都插了計數器，
  **整場 40 次圈捕嘗試中，未指派分支的執行次數都是 0**（HEAD 丟例外次數 0，我的版本進入次數 0）。
  我改的程式在這個情境根本不會執行，不可能改變結果。
- 該 gate 自己的註解也寫了 binding is chancy——目標會動，腳本畫的圈常常來不及套住。
  這是既有的機率性不穩定，建議另立一筆 debt，不要當成回歸。

**int-rh2 的失敗可以歸因到你的在飛工程。** 斷言是
`the hand-tool drag moved the resident on the ranch ground`（`championship-int-rh2-browser.cjs:196`，
`notDeepStrictEqual`，也就是期待拖曳後座標要改變卻沒變）。隔離結果：

- HEAD 乾淨樹 → **PASS**（`INT_RH2_BROWSER_QA_PASS viewports=6 required=5 saveReload=true`）
- HEAD **只**疊上你的五個 raising 檔（含 `nativeRaisingHand.js`）→ **同一條斷言 FAIL**

新的手勢分類接管了 hand 工具的 pointer 路徑之後，舊的「拖曳搬動住民」在該 gate 的操作下不再生效。
是 gate 該改、還是搬動路徑要補回來，屬於你的判斷，我沒有動。

gate 產生的證據檔（`docs/reports/vs1`、`vs2`、`vs3` 的 JSON 與截圖）我已全部 `git checkout` 還原到 HEAD——
失敗的那次仍然會寫出帶當日時間戳的檔案，留著會誤導。真實結果以本節為準。

## E. 多輪大會結構（Owner 指示接續 P0）

追證腳本 `scripts/research/check-championship-rounds-cpu.py`，收據
`docs/research/CHAMPIONSHIP_ROUNDS_2026-09-10.json`。

OVL10 有七處寫 session +0xCA8（總輪數）：五處寫立即值 1，就是既有的單場頭銜賽；
另外兩處由 `02114D48` 的類別表取 ARM9 descriptor，再 `ldrb` 讀輪數：

| 類別 | descriptor | 輪數 | 獎金 | 每輪抽籤池大小 |
|---|---|---:|---:|---|
| 0 大會 | `020A9AB4` | 3 | 50,000 | 6 / 6 / 4 |
| 1 世界大會 | `020A9AA4` | 5 | 300,000 | 4 / 3 / 2 / 2 / 1 |

輪次記帳沿用既有已追證的 `recordRoundOutcome`（OVL19 `0210E280`）與
`payoutAllowed`（OVL8 `0210D0C8`）：輸掉任一輪，整筆獎金歸零。
最後一輪判定在 OVL19 `0210D204`（cursor >= total-1，且 +0xC98==0、類別==1）。
`021110DC` 依 +0xC98 分流：0 走大會池路徑並把場地固定為 10，2 走自由路徑
（場地自 {0,1,2,3,4,5,7} 抽，隊伍索引取 +0xCA0）。

**每輪對手**：`02110A90(category, cursor)` 讀類別 record +0x0C 的 8-byte
`{u8 poolSize, u32 poolPointer}` 陣列，對 poolSize 做均勻抽籤，再讀 20-byte 隊伍紀錄。
池大小已解出（上表），八個池在記憶體中首尾相接共 28 筆。
**但每個 poolPointer 都落在 ARM9 靜態映像結尾 `020F99D8` 之上的 runtime BSS，
NitroFS 也沒有對應檔案**，所以池內的隊伍紀錄靜態解不出來，需要實機／模擬器 RAM。
`selectNativeChampionshipOpponent` 因此拋 `OPPONENT_POOL_REQUIRES_TRACE`，不編對手。

新增 `src/championship/battle/nativeChampionshipRounds.js`（已登記進
`championship-migration-firewall-cases.mjs` 的授權清單），
測試 `tests/championship-rounds-cases.mjs` 8 cases。
`championshipStandaloneApp.getChampionshipCategories()` 是唯讀查詢，
每列都帶 `entry: 'CHAMPIONSHIP_ROUNDS_OPPONENT_POOL_REQUIRES_TRACE'`。

另外確認：`settleOwnedBattleIndividual` 的「贏了且還有下一輪就回復三成 HP/TP」
先前不可能被執行（`cursor`/`totalRounds` 恆為 1），現在有測試覆蓋。
其 `cursor` 語義是 `0210E394` 遞增後的**已完成輪數**，不是剛打完的索引。

## F. 互動教學（Owner 指示的三項之一）

原作教學的完整腳本已在 `TUTORIAL_CONTINUATION_OBSERVED_2026-09-09.json`：
33 筆 observedTextEvents 加 3 筆視覺觀察，文字 ID 落在 **1515..1549 連續不斷**，
兩段 trace 各自遞增。`tutorialStep` 早就在 opening save 裡（`nativeOpeningState.js`
允許 -1..71），但**新遊戲一律寫 null，全專案沒有任何地方讀或推進它** —— 教學等於沒做。

新增：

| 檔案 | 內容 |
|---|---|
| `scripts/build-tutorial-steps.py` | 由觀察紀錄產生步驟表；讀 ROM 只為驗證每個 ID 在 `ui/txt/txt_list_txt.dat`（1,568 筆）存在。支援 `--check`。 |
| `src/data/championship/catalogs/tutorial-steps.r1.json` | 35 步、3 階段（RAISING 12／GATE 1／HUNT 22）、14 步需要動作。**只放索引與結構，不含原作字串。** |
| `src/championship/app/nativeTutorialProgression.js` | 游標推進；每步只接受它教的那個動作，不符就原地不動並回報 expected/received。 |
| `src/championship/text/tutorialMessages.zhHant.js` | 35 句自撰繁中文案 + 動作提示，依原作 record id 對應。 |
| `tests/championship-tutorial-cases.mjs` | 7 cases，含「文案不得含假名」的正向檢查。 |

application 新增 `getTutorial()` / `beginTutorial()` / `advanceTutorial(action)` / `skipTutorial()`，
狀態存在既有 opening save，沒有新增 store 或 save key。

**刻意保留的界線**：新遊戲仍然不自動開啟教學（`tutorialStep` 維持 null）。
把它變成新遊戲預設會讓教學攔截所有既有操作，現有 1,446 個測試與 browser gate 都要跟著改，
那是另一次改動。目前是可開啟、可走完、可跳過。

每一步的「推進條件」是從原作那句話自己的指示讀出來的（例如 1522「先選傷藥」、
1527「連點閘門兩下」）；**卡匣內部真正的推進判定沒有追證**，這點寫在 catalog 的
`advanceProvenance` 與模組註解裡，沒有假裝是 ROM 事實。

## 驗證

- 本機全量：`node --test tests/*.mjs` → **1,446 pass / 0 fail**。
- `npm run test:ci` → **1,214 pass / 0 fail**。
- `hunt-scene.r1.json` 改動前後都以 `--check` 對 ROM 驗過可完整重現。
- Browser gate 見上節。**實機驗收仍未做**，需要實體手機，不是我這邊能補的。

## 仍然開著的後續

未重建原作 heap 位址，所以不同配置下錐內的確切角度是「有界」而非「重現」。
vs3 的機率性不穩定與 int-rh2 的手勢回歸各自獨立於本次追證。
