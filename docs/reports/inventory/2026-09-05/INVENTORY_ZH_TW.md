# Championship 2026 現有成果與資料盤點

盤點日期：2026-09-05（Asia/Taipei）。範圍為資料與完成度確認；本批只新增盤點文件／清單，更新既有 Current Product Status 入口。

## 判定

目前已有可重用的遊戲基礎、局部可玩流程、大量 ROM 轉寫資料及美術資料包；**完整的 New Game → 育成／捕獲 → 對戰 → 獎勵／成長 → Championship → 長期存檔循環仍是 PARTIAL**。

本次重跑 835 項測試全部通過，並實際執行兩場 deterministic battle，均產生傷害及勝負。這證明已覆蓋案例的運算可以運作，不能代表所有原作條件、瀏覽器版面、動畫、保存及流程皆已完成。

## 工作樹基準與範圍

| 項目 | 本次量測 |
|---|---|
| 開始位置 | `R:\Projects\Championship2026`，父層不是 Git repo |
| 唯一正式產品 repo | `R:\Projects\Championship2026\championship-2026` |
| Branch | `main` |
| HEAD | `d0c48f340baac61cf399bf5bd5922ce58f3d38c7` |
| HEAD 日期／內容 | 2026-09-02，BM00 repaint／slot geometry 文件 |
| HEAD 檔案 | 4,394 |
| 本批輸出前非 ignored 盤點 | 5,288 個項目：5,287 個存在，1 個 tracked 檔案已刪除 |
| 既有工作樹差異 | 75 個 tracked 修改、1 個刪除、894 個 untracked 檔案；均為開工前既有內容 |
| 現有產品檔案總 bytes | 965,344,473；排除本盤點目錄、ignored 內容、node_modules、Git objects |
| 來源程式 | `src/` 127 個 JavaScript 檔案 |
| 測試檔案 | 頂層 deterministic `.mjs` 101 份，browser／其他 `.cjs` 14 份 |

主清單 [files.csv](files.csv) 記錄 path、是否存在、是否屬於 HEAD、Git 狀態、bytes、mtime；程式、測試、契約、manifest 等關鍵輸入另記 SHA-256。此清單是**盤點開始時產品基準**，不包含後續新增的盤點文件與 Current Product Status 更新。

沒有將不同專案的產品來源合併。MCP 回傳的 `R:\NEXUS LINK\原作` 是 Championship 原作研究根目錄；本次只確認該唯讀來源設定，沒有掃描 Nexus Link 產品碼。`_archive`、套件、DeSmuME saves、外部完整 ROM reverse 樹不在逐檔內容驗證範圍內。

## 現有遊戲系統

「已接入」指入口／呼叫及 domain 測試證據；除另述外，本次未重跑真實瀏覽器 QA。畫面名稱不代表完整原作行為。

| 系統 | 已確認存在／運作 | 完成判定與剩餘界線 | 主要證據 |
|---|---|---|---|
| Boot／New Game／Continue／Save | 獨立 App、restore 檢查、單一 persistent writer、reload 測試 | 基礎可重用；舊 browser 報告不代表今日所有畫面已驗證 | `src/championship/app/championshipStandaloneApp.js`、`ChampionshipPersistentSavePort.js`、`tests/championship-vs1-runtime-cases.mjs` |
| UI 與 renderer authority | 15 個合法 screen ID；DOM UI；共享 Pixi stage；Gate／Battle menu／Battle VFX bounded Three 接線 | 架構存在；原作操作及畫面逐項 parity 仍需檢查 | `championshipScreenStack.js`、`main.js`、`championshipPixiStage.js` |
| Raising Home | 選取、照護反應、移動、保存／恢復、Cage 複合呈現接線 | PARTIAL；照護效果、消耗及個體持久成長欄位未閉合 | `raisingHomeP1RView.js`、`raisingPresentationSource.js`、`raising/statLadder.js` |
| Gate | 17 筆名稱／費用、選擇、費用 gate、bounded 3D／2D fallback | 已接入；免費旗標的觸發 writer、完整原作鏡頭／輸入未知 | `gate/gateCatalog.js`、`gate-table.r1.json`、Gate tests |
| Hunt Loadout／Field／Result | 五類裝備、四個 plugin 位置、探索、circle enclosure、容量比較、結果／帶回流程 | PARTIAL；每種原作 spawn／AI、道具效果、完整 Wire／Rope／Pull 行為及 per-species G 不可從現有原型反推 | `hunt/`、VS2／VS3 runtime tests、`vs3Screens.js` |
| Shop | 118 筆、錢包、可見性、購買、Cage／Hunt grants | 已接入局部流程；消耗道具與收入循環未完成 | `shop/shopRuntime.js`、`shop.r1.json`、VS4 Shop tests |
| Database／Digimon List | 224 圖鑑槽、216 個日文物種名、個體清單 | 資料及畫面存在；全物種養成／進化／登錄 writers 不是這些計數的含義 | `database/databaseCatalog.js`、`digimonListScreen.js` |
| Cage Edit／Ranch | 36 定義、14／16／18／20 槽、購買／配置／確認／保存、多 tile loader | PARTIAL；板面排列與 Training tile 排法為 `PRODUCT_AUTHORED`；訓練強度未知 | `cage/`、`runtimeMapArtBundle.js`、Cage contract、Cage tests |
| Help／Schedule／Tamer Info | 84 Help records、62 賽程 records、原作欄位結構、未知數值留空 | 畫面已接入；Help 群組、部分 rank writers、終身統計未知 | `helpScreen.js`、`scheduleScreen.js`、`tamerInfoScreen.js` |
| 時間／toolbar／繁中 | clock、status bar、八槽 toolbar、部分繁中 labels | PARTIAL；起始時刻／時間比例部分 product-authored，toolbar command/icon/submenu 與翻譯覆蓋仍不完整 | `time/championshipWorldClock.js`、toolbar／status contracts、`text/zhHant.js` |
| Battle | 選單／場地／結果、AI／script VM／碰撞傷害／勝負；兩個 seed 實跑完成 | domain 局部完成；玩家自己的養成 roster、全 native／動畫及模式條件仍有缺口 | `app/battleRuntime.js`、`battle/`、[battle-probe.json](battle-probe.json) |
| Battle → reward → Save | reward transaction 模組與測試存在；result 顯示 payout | **未找到產品接線**；`finishMatch()` 只切 screen，result mount 沒有 credit，reward module 不在入口的 literal import graph | `main.js:423`、`championshipStandaloneApp.js:671`、`battleRewardTransaction.js` |
| 成長／進化／Championship 長期進程 | 成長 ladder 及部分賽程資料存在 | UNKNOWN／未完成閉环；不能把 ladder 當成個體訓練或進化 writer | `statLadder.js`、`titleEventSchedule.js`、Current Product Status |

完整 screen 集合：`RAISING_HOME`、`SHOP`、`DATABASE`、`CAGE_EDIT`、`DIGIMON_LIST`、`SCHEDULE`、`HELP`、`TAMER_INFO`、`GATE_SELECT`、`HUNT_LOADOUT`、`HUNT_FIELD`、`HUNT_RESULT`、`BATTLE_SELECT`、`BATTLE_FIELD`、`BATTLE_RESULT`。Title 是 HTML boot surface，未計入這 15 個 stack ID。

## Gameplay 資料表：17 份

下列 `ROM_VERIFIED`／`VERIFIED_BINARY_STRUCTURE` 是現存 catalog 的證據宣告；本批確認實際筆數、引用、schema 與測試，**沒有重新逆向驗證每個欄位或替既有宣告升級**。完整欄位、SHA-256、consumer 及 HEAD 狀態在 [catalogs.json](catalogs.json)。

| Catalog | 實際資料量 | 界線 |
|---|---:|---|
| `battle-arenas.r1.json` | 11 records | 場地身分／結構 |
| `battle-eligibility.r1.json` | 46 records | 參賽／match 結構；非全部進度 writer |
| `battle-moves.r1.json` | 596 records | 行為資料不等於 596 個效果皆完成 |
| `battle-natives.r1.json` | 67 natives | catalog 大小不等於 native 實作覆蓋 |
| `battle-opponent-teams.r1.json` | 152 records | 對手隊伍組成 |
| `battle-presets.r1.json` | 456 records | 建構用 presets |
| `battle-scripts.r1.json` | 52 opcodes、41 routines、36 move entry points | 含 cartridge script blob；需保留研究／shipping 邊界核對 |
| `battle-title-event-strings.r1.json` | 62 records | 日文賽事名稱／說明 |
| `battle-title-events.r1.json` | 62 records | 賽程表；rank／長期進度不因此完成 |
| `cage-definitions.r1.json` | 36 records | 名稱／說明／身分；強度仍 UNKNOWN |
| `creature-species.r1.json` | 228 records | 底層 species table，不是 228 個可玩／美術角色 |
| `creature-stat-curve.r1.json` | 27 rows | 成長數值階梯，不是每種物種的固定六維基礎值 |
| `gate-table.r1.json` | 17 records | 16 biome＋Tutorial；不是 17 個正式 biome |
| `help-text.r1.json` | 84 records | 16 標題＋68 主題；群組未知 |
| `rng-channels.r1.json` | generator／distribution／channel table 設定 | 沒有 `records` 陣列；不虛填筆數 |
| `shop.r1.json` | 118 records | 部分 display label 仍為 product-authored |
| `species-names.r1.json` | 216 records＋6 stat names | 日文命名資料，繁中翻譯另存 |

17 份皆可找到 `src/` consumer；literal 相對 import graph 中未見缺檔。此為靜態依賴檢查，不包含所有 computed import／fetch 或實際 browser execution。底層 species、圖鑑、美術與命名集合不可互換計數。

## Contract：12 份

[contracts.json](contracts.json) 收錄每份的根層欄位、宣告、SHA-256、HEAD 狀態：

- Raising：`INT_RH2_RUNTIME_PRESENTATION_CONTRACT`、`raising-home-presentation`。
- Gate／Hunt：`VS2_GATE_HUNT_RUNTIME_PRESENTATION_CONTRACT`、`VS2_GATE_SELECT_3D_RUNTIME_CONTRACT`、`VS2_HUNT_LOADOUT_RUNTIME_CONTRACT`。
- 共用 UI／呈現：`CHAMPIONSHIP_TOOLBAR_CONTRACT`、`CHAMPIONSHIP_STATUS_BAR_CONTRACT`、`CHAMPIONSHIP_PRESENTATION_PACK_CONTRACT`。
- Cage：`CHAMPIONSHIP_CAGE_RANCH_COMPOSITION_CONTRACT`。
- Battle：`battle-field-presentation`、`battle-player-roster`、`CHAMPIONSHIP_BATTLE_WEATHER_VFX_EVENTS`。

Contract 存在表示接入規格可查；內含 UNKNOWN 的欄位仍未完成。

## 美術與呈現資料

| 集合 | 已確認資料 | Runtime／完成界線 |
|---|---|---|
| 原作 art registry | 1,248 records | source／replacement 單位，不是 1,248 個 production bundle |
| 224 faithful character baseline | 7 批、224 entities、503 atlas pages、17,235 Main／Sub cells、11,480 sequences | 全量 validator 通過；4× nearest baseline，非手繪新版；manifest `runtimeEligible:false`、`shippingReady:false` |
| UI HD96 | 96 scenes、1,369 nodes、87 backgrounds、193 sprite witnesses | validator 通過；23 Main／28 Sub／45 unknown；不是 96 個 DOM 畫面完成 |
| Hunt licensed bundle | 30 fields，涵蓋 hm00..hm16 系列 | manifest／runtime 接線存在；source rights 宣告與目前 Owner 指示需核對 |
| Cage licensed bundle | 40 fields | 視覺字段與 36 CageDefinition 非一對一序號平移；實際拼圖座標未知 |
| Battle licensed bundle | 11 fields | 圖層資料及消費者存在，不代表所有對戰行為完成 |
| VFX licensed bundle | 26 systems | 系統資料存在；conversion 與每個 gameplay trigger 的閉合分開判定 |
| Battle menu cube | 4 faces，512×512 textures，12 個可編輯 SVG layers | index eligible；既有五 viewport report PASS；human visual approval pending |
| m201 remix review | 47 個 unique technical candidates，83／83 slots，53 sequences，fallback 0 | 單角色技術候選預覽；不是全 224 remix 完成或視覺核准；受 query override 啟用 |

Production index 的 **19 entries = 4 licensed bundles＋3 舊 temporary／structural bundles＋11 review bundles＋1 cube bundle**。其中只有 5 entries 明寫 `runtimeEligible:true`；缺少該欄位的舊 entry 不當成 false 或 true。所有 entry 的 `shippingReady` 都是 false。A0 validator 顯示的 `95 ready-for-runtime` 是 crosswalk 計量，不能當成 95 bundles 或出貨數量。

詳見 [production-bundles.json](production-bundles.json)、[art-workspaces.json](art-workspaces.json)、[registry-summary.json](registry-summary.json)。沒有將本批盤點當成美術審核或授權驗證。

## 原作研究資料與外部檔案

- Repo 收錄 21 份 `docs/research` 檔案，加 1 份 `research/original-evidence/README.md`：影片證據索引、兩套影片 observations／validation、Cursor 記錄、Cage 身分 trace、Battle 動畫／物件 trace、地圖／Hunt input trace、舊 readiness／feature gap matrix。詳見 [research-files.csv](research-files.csv)。
- 本地 `YDIJ_PRIVATE_ROM_ART_PACK` 存在，metadata 盤點 47,301 檔、589,662,651 bytes；不是 shipping bundle 數。逐檔路徑／大小在 [external-private-pack-files.csv](external-private-pack-files.csv)，分類在 [external-evidence-summary.json](external-evidence-summary.json)。本次未重算全部 external payload hashes。
- Registry 路徑檢查分開處理檔案路徑、`rom:/...` 邏輯 URI、`digimon/...` 等 ROM 相對資源名稱，以及純 SHA-256 值；後三種不以 repo 檔案存在性判斷遺失。詳見 [registry-reference-paths.csv](registry-reference-paths.csv)。
- 舊 Cage 交接「整體錯一格」段落已被 9 月 5 日 ROM 複核註記否證。現存有效基準是 0 空地、1 運動場、15 小保健室、30 小健身房、35 等候室；既有 visual mapping 不應再次平移。依據是 `docs/research/CAGE_IDENTITY_BINDING_ROM_TRACE_2026-09-05.md` 與現有 cross-table tests，本批未重讀 ROM binary。

## 文件狀態衝突

| 文件／宣告 | 實際差異 | 本批處理 |
|---|---|---|
| 原 Current Product Status：182 tests、Battle planned | 本次 835 tests PASS，Battle 執行產生 verdict | 更新 canonical 入口；舊內容保存在 [CURRENT_PRODUCT_STATUS.before.md](CURRENT_PRODUCT_STATUS.before.md) |
| README：VS3 not started；architecture：Three unmounted／僅四 screen | 工作樹已有 15 stack screens、VS3、Battle Three 接線 | 記錄為 stale；不依此撤銷既有成果 |
| Dependency Matrix／Blocker Ledger：VS2 not authorized 等 | 保存的是歷史同步事實；部分後續成果只在 owned deltas | 不將 snapshot 當今日阻塞，也不偽造完成跨 lane sync |
| 根目錄 Claude status 與 coordination Claude status | 前者含後續 Battle 成果，後者仍是 8/28 快照；同一 JSON 中舊 open gap 也可能已被後續欄位關閉 | 回到 source／tests 驗證，不覆寫他方狀態檔 |
| Codex status 頂層仍是 light-fence，latestBoundedBatch 已是 cube | 不能只讀頂層 status 判斷全部成果 | 用最新 batch＋實際 manifest＋本次 tests |
| ROM／decoded 素材政策 | 本次 Owner／AGENTS 要求 RESEARCH_ONLY；歷史 9/2 Owner Direction 及 index 允許 licensed decoded runtime | 保留現況，標為政策與現有 manifest 未對齊；不在資料盤點中自行 promote、搬移、刪除或宣告合規 |

## 本次驗證

| 驗證 | 結果 | 證據 |
|---|---|---|
| `npm test` | 835 pass、0 fail、0 skipped／todo | [npm-test.log](npm-test.log) |
| Character 全量 validator | 224 entities、17,235 cells、11,480 sequences PASS | [character-validation.log](character-validation.log) |
| UI validator | 96 scenes、1,369 nodes、87 backgrounds、193 witnesses PASS | [ui-validation.log](ui-validation.log) |
| A0 production index validator | 1,248 crosswalk、19 bundles、0 shipping PASS | [production-index-validation.log](production-index-validation.log) |
| Battle domain probe | seed `0x14`：181 ticks；`0x20`：271 ticks；均 TEAM_DOWN／TEAM_ZERO_AHEAD，對手 HP 520→0 | [battle-probe.json](battle-probe.json) |
| Literal import graph | 137 reachable files（含 JSON／contract）；0 缺檔；reward transaction 未由入口引用 | [static-entry-dependencies.json](static-entry-dependencies.json) |
| 文件／工作樹檢查 | `git diff --check` PASS；catalog 宣告筆數一致、manifest 路徑存在、文件連結無缺漏；來源／測試等已雜湊輸入除本批 status 文件外未變動 | [audit-validation.json](audit-validation.json)、[git-diff-check.log](git-diff-check.log) |
| Browser／實機 | 本次未重跑；歷史 VS1／VS2／Gate reports 為 8/28，VS3 為 8/29；cube report 與 owned batch 記錄存在 | 不將歷史 PASS 當成本次 browser 驗證 |

目前沒有阻塞這次盤點的問題。**未知及後續完成門檻**是照護／訓練 writer、進化條件、Cage 原作幾何、Battle 尚未覆蓋 native／完整 modes、玩家 roster／獎勵／進度／save 閉環，以及逐畫面／實機 QA。

## 下一個安全步驟

1. 以本盤點與現有 Current Product Status 作為入口，先處理文件內的過期狀態及資料身分交叉表；保留所有來源與 unknown。
2. 下一個功能切片可針對「Battle verdict → 原作 reward transaction → canonical wallet → Save／reload」做精確接線盤點；先確認原作 payout 條件、重複領取及存檔規則，再實作。這是後續候選，不是本批已完成項目。
3. Raising 依現有 save/RAM 研究取得個體 persistent record 與照護 writer 的控制證據，再接訓練及進化。完整 fidelity 不以通過 835 tests 代替原作驗證。

可重跑的檔案／資料收集器為 [collect_inventory.py](collect_inventory.py)，從 repo root 執行；它會更新同目錄的 snapshot 清單，因此既有時間點若需保留，應複製整個盤點目錄後再跑。
