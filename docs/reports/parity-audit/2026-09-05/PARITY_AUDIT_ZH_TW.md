# Championship 2026 原作符合度稽核

日期：2026-09-05，Asia/Taipei。結論：**目前不能判定遊戲程式、架構及內容已全面符合原作。原始來源吻合、資料轉錄可重現，工程基礎已存在；遊戲操作、養成與戰鬥進度的完整連接仍是 PARTIAL，並有可重現的缺口。**

這是目前工作樹的盤點與稽核，沒有修改玩法、替換美術或授權發布。檔案存在、資料表正確、單元測試通過、画面可達及原作完整等價，是不同判定。

## 1. 專案與來源基準

- 初始工作資料夾：`R:\Projects\Championship2026`。
- 唯一產品 Git root：`R:\Projects\Championship2026\championship-2026`。
- Branch：`main`；HEAD：`d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。
- 判定對象包含既有未提交修改，不能把 HEAD 的歷史版本當成目前產品。開始與報告編寫前，1,394 份來源／合約／協調文字檔雜湊一致，見 [來源比較](source-comparison-before-report.json)。這不是所有二進位美術的併發修改鎖。
- 使用者寫的 `R:\Projects\Championship2026\YDIJ\_PRIVATE\_ROM\_ART\_PACK` 不存在；實際存在並核對的資料夾是 `R:\Projects\Championship2026\YDIJ_PRIVATE_ROM_ART_PACK`。
- 附件 ROM：`R:\8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1.nds`；64 MiB；header `DIGIMONCHAMP` / `YDIJ`；實測 SHA-256 與檔名、美術包宣告來源一致。

已先讀產品 AGENTS、README、Owner Direction、Architecture、Current Status、Dependency、Blocker、相關 gameplay／presentation contracts，並查詢 Championship Evidence MCP。`R:\NEXUS LINK\原作` 僅作為既有原作研究檔案庫；沒有使用 Nexus Link 產品程式、存檔或玩法作为本專案真值。研究檔案內的操作指令均當作歷史內容，沒有據此擴張使用者授權。

## 2. 哪些已確認

| 對象 | 本次結果 | 結論的精確範圍 |
|---|---|---|
| 附件 ROM 身分 | SHA-256 相符 | 美術包與本次 ROM 是同一個來源版本 |
| 美術包原始 Nitro 資源 | **6,317 / 6,317 與 ROM FNT/FAT 對應檔逐位元組一致** | 證明原始檔來源一致；未宣稱所有解碼圖、動作或 UI 已逐像素／逐幀等價 |
| 16 份 gameplay catalogs | 使用現有 builders 在暫存目錄由附件重建；**16 / 16 JSON 完全一致** | 證明轉錄可重現；同一 builder 的語意錯誤不會因重建相同而自動排除 |
| Shop catalog | 獨立讀 ARM9 `0x020E0248`，stride 56；**118 筆 × 7 欄 = 826 欄相符** | 價格、初始持有、最大持有等被比較數字一致；沒有把所有 unlockKind 語意也算成已重證 |
| 工程權責 | standalone app、單一 screen stack、單一持久存檔入口、共享 Pixi stage 已存在 | 符合目前 Web 重建的主要工程邊界；不等於逐函式複製 NDS 架構 |
| 瀏覽器存檔基本流程 | SAVE → 重新載入 → 驗證後 Continue 可用 → 返回育成 | 只確認本次隔離測試來源的基本恢復；未驗證完整世代、賽事與進化存檔 |
| 戰鬥可結算 | 瀏覽器 MATCH 00 可進入自動戰鬥並產生己方勝利結果 | 證明目前戰鬥不是空畫面；沒有證明完整原作戰鬥、全部 natives 或玩家養成整合 |

來源機械驗證：[ROM 身分](rom-provenance.json)、[原始美術逐檔比較](raw-art-rom-comparison.json)、[17 份 catalog 比較](catalog-rom-comparison.json)、[可重跑腳本](verify_rom_sources.py)。重建產生的二進位研究資料只放在系統暫存目錄，報告保留雜湊與結果。

既有完整資料盤點另見 [INVENTORY_ZH_TW.md](../../inventory/2026-09-05/INVENTORY_ZH_TW.md)。同一工作樹已完成角色／UI／production index validators：224 個角色美術身分、17,235 cells、11,480 sequences、503 atlas pages；UI 96 scenes、1,369 nodes，其中 45 scenes 的 Main/Sub 角色未解。production index 有 19 entries、5 個明確 `runtimeEligible:true`、0 個 `shippingReady:true`。這些是資料與工作區成果，不能計成 224 隻角色及 96 頁完整遊戲都已接入。

## 3. 可重現缺口與程式依據

### F01 / P1 — FEED 的空地投食流程尚未接入

**更正紀錄：最初用「選 FEED → 點角色」測試餵食不正確，使用者指出後已撤回該測試的功能結論。** `feed-touch.dom.txt` 僅保留為錯誤測試方法的紀錄，不是餵食失敗證據。

正確的驗收流程是：**選肉圖示 → 點籠內角色旁的空白地面 → 場上落肉／顯示剩餘食物 → 角色接近並攝食 → 消耗物件與回饋**。不得替換成對角色按通用 CARE 或直接增加數值。

- 附件日文 ROM `ui/txt/txt_list_txt.dat` 第 1500、1501 條直接要求選肉圖示、觸碰數碼獸旁邊；已重新從附件讀出，見 [原作餵食教學](original-feeding-tutorial.json)。
- 現有 [工具合約](../../../contracts/championship/CHAMPIONSHIP_TOOLBAR_CONTRACT.v1.json) 的 `toolVocabulary.feed.interaction` 本來就寫著 `select, then touch beside the creature`。
- 使用者提供的[實機影片約 00:30](https://www.bilibili.com/video/BV13u411B7BK/?t=30)，可見肉塊與 Food remaining；原有 V03 影格本次重新開啟檢視。角色如何選食物、何時拒食及數值效果不由這一張影格推斷。
- 更正後在 390 × 844 瀏覽器選 FEED，點籠內空地 `(100,390)`、`(292,390)`，後續約 37 秒仍無肉塊或食物回饋。見 [操作收據](browser-observations.json)、[操作前](feed-ground-before.png)、[操作後](feed-ground-after-wait.png)。本次新檔角色為 `DIGITAMA_0`，因此這是投放／輸入檢查，沒有假稱已用原作飢餓、可進食個體驗收攝食 AI。
- 更關鍵的程式依據：`src/championship/app/main.js:544` 建立 toolbar 時只傳 `onMenuEntry`，沒有 `onToolChange`；`championshipToolbar.js:159` 的選擇只更新本地狀態與外觀。`presentation/intRh2/createRaisingFieldPixiPresentation.js:227` 僅處理角色選取與拖曳，`:411` 的場地事件只有拖曳移動／結束，沒有空地投食入口。`raisingPresentationSource.js:294` 暴露的 intents 也沒有投食座標命令。

判定：**已知原作操作結構、目前流程未接入**。食物尋路、食用條件、飢餓回復與成長寫入仍需 trace，不填入自創倍率。

### F02 / P1 — 戰鬥費用／獎金欄位誤讀，報名與結果未接錢包

實測 New Game → Battle → MATCH 00 → 結果 `YOUR TEAM`（`TEAM_ZERO_AHEAD`，結束原因 `TEAM DOWN`）→ PRIZE 150 → RETURN HOME → Shop，錢包仍是 **0 / 9999999 BITS**。

**2026-09-05 完成方案分析的更正：150 是該筆原作資料的報名扣款來源，獎金欄位是 7,000，不能把 PRIZE 150 直接當作應入帳額。** 本次由附件 ROM 獨立讀 OVL10：title `+0x24` → 畫面 `+0xD538` → 與 wallet 比較及扣款；title `+0x20` → session `+0xC94` → OVL8 pending／wallet credit。Record 0 為 `field24=150, field20=7000`，現行 `battleMatchSelection.js` 卻將 `BATTLE_MATCH_PAYOUT_FIELD` 指向 `field24`。0 Bits 仍能報名也是此流程的缺口。原始 DOM 觀察保留，沒有改寫為瀏覽器已顯示或入帳 7,000。

新增 [獨立 ROM 檢查腳本](battle-fee-payout-rom-check.py) 與 [64 項靜態核對結果](battle-fee-payout-rom-check.json)。此為讀寫鏈及限定分支的靜態驗證，未新做受控模擬器整場比較，亦未證實所有模式對應、取消／退款或原作保存時點。

`src/championship/app/main.js:423` 只把賽事設定 payout 傳給 result view；`:433` 返回時銷毀戰鬥並離頁。`championshipStandaloneApp.js:672` 的 `finishMatch()` 只切換畫面。已有 `battle/battleRewardTransaction.js` 記錄 OVL8 結果條件、pending credit 與上限邏輯，但這条 app 流程沒有引用它。結果頁 `vs5Screens.js:372` 以 payout 為數字便顯示 PRIZE，也未使用結果後的實際待發獎金。

證據：[己方勝利](battle-after-wait.dom.txt)、[PRIZE 150](battle-result-phase2.dom.txt)、[回到商店 0 Bits](shop-after-battle.dom.txt)。原有逆向鏈為 OVL8 `0x0210D0C8` → `0x0210EAB0`；本次確認現有 trace 模組與呼叫缺口，沒有把所有 OVL8 模式分支重新做模擬器 lockstep。

安全修復邊界：先更正 fee／reward consumer，接合法報名及扣款，再經原作勝負／模式 gate 計算獎勵，透過既有 wallet/save authority 一致提交，包含重複確認／進結果、失敗重試與重載不重複領獎的驗收。完整依賴與案例見 [完成方案](../../../planning/CHAMPIONSHIP_PARITY_COMPLETION_PLAN_2026-09-05.md)。

### F03 / P1 — 幾何閉合直接變成捕獲，省略原作中間流程

`src/championship/hunt/huntRuntime.js:344` 使用 `geometry.closed && contained` 決定成功，接著移除野生個體，`:357` 明示 `PRODUCT_AUTHORED_ENCLOSURE`。`championshipStandaloneApp.js:815` 通過容量 gate 後立刻寫 collection 並進 Hunt Result。每隻 G 成本仍使用 product unit 1。

原作影片與 ROM help 顯示 Rope、Shot、Wire 是不同工具；圈繩、拉扯、目標狀態／HP、手掌收取及結果管理需要區分。help body 104 明示目標 HP 歸零後可捕獲；body 89–91 描述三類工具各自效果。幾何 recognizer 和容量比較存在，不足以宣稱捕獲流程等價。

原作依據：[實機 01:01 起](https://www.bilibili.com/video/BV13u411B7BK/?t=61)、[既有影片索引的捕捉觀察](../../../research/ORIGINAL_VIDEO_EVIDENCE_INDEX_2026-09-03.md)、[ROM help 摘錄](original-help-excerpts.json)。不假設所有獵物都要依序用全部工具；工具條件及拉力數字仍需各自 trace。

完成方案分析又從附件獨立核對 [OVL0 幾何分支](hunt-geometry-rom-check.json)：5 組、70 條指定指令通過。20 槽循環覆寫與現行「满20點停止」不同；5 門檻附帶計數條件，25／15 涉及 helper 結果與差值，不能簡寫成現行外框／首尾距離判斷。這次沒有驗完完整幾何、pull、HP、容量及入庫；先建立 ROM／JS 筆跡對照，再接下游狀態。

### F04 / P1 — 戰鬥名單、賽程與玩家養成狀態未連接

`main.js:359` 呼叫 `createBattleRuntime()` 未傳玩家個體或當前日曆。`battleRuntime.js:85` 的 residents 預設空陣列，`:89` 以 ROM opponent team 1 代替玩家隊伍，`:349` 用預設隊伍展開戰鬥。預設 schedule 是 `(2,3)`，並明示 `PRODUCT_AUTHORED`，不是本次 Home 畫面顯示的 Spring Day 1。

瀏覽器可見「冠軍賽／頭銜賽／自由對戰／通訊對戰」四個模式按鈕全部 disabled，僅有 MATCH 00 入口。ROM 算術模組的進展值得保留，但目前沒有原作戰前「自己的個體 → 編隊／策略 → 合法賽事」完整流程。現有程式註解記錄此替代隊伍是階段性決定；本稽核不將它誤稱為未授權變更，也不將它計成最終原作等價。

證據：[戰鬥入口 DOM](battle-menu.dom.txt)、[戰前選擇原作觀察](../../../research/video-BV13u411B7BK/ANALYSIS_ZH_TW.md)。

### F05 / P1 — 時間與養成自然推進尚未形成完整循環

`time/championshipWorldClock.js` 已表達原作日／季節 cascade；ROM help body 96 描述遊戲時間推進與約十分鐘一天。`raisingHomeDefinition.js:211` 有顯式 ADVANCE reducer，`:222` 有 END_DAY，但目前 app 的可操作育成場景未找到持續呼叫 ADVANCE 的入口；Pixi ticker 在此僅更新 presentation／animation。瀏覽器長時間操作仍維持 08:00。

判定為 **PARTIAL：模型存在，場景時間驅動未接通**。08:00 起始時刻、精確現實時間倍率仍不是已完成的原作追蹤。不得自行新增第二個全域 ticker，或用影格回呼直接修改存檔。

完成方案分析補充：現有 ADVANCE 還會呼叫自訂 resident 數值更新，`worldMinutesForRealSeconds()` 逐次取整會丟 sub-minute 餘數，Raising session 又有 256 筆 accepted commands 上限；年與細分時間尚未完整保存。因此不能直接把 ADVANCE 接進逐幀 ticker。需先補純時計 transition、餘數／序號策略及原作 mode 暫停條件。

### F06 / P2 — 390 × 844 下的育成資訊被固定工具列覆蓋

`app/intRh2Styles.css:23` 把內層育成 root 設為 fixed/inset 0，`:36` 讓 shell 高度佔滿 `100dvh`；外層 `styles.css:466`、`:561` 雖保留 status／toolbar 高度，內層仍覆蓋這個範圍。

DOM 實測 HP/TP 範圍 y=785.4–803.0，toolbar 從 y=791.2 起；存檔狀態 y=813.8–843.8 全部落在工具列範圍。這是本次實測的 mobile-first 缺口，與 NDS 原始雙螢幕尺寸不必一致是兩回事。

證據：[版面座標](mobile-layout-bounds.json)、[手機畫面](feed-selected-390x844.png)。本次沒有以實體手機驗證，亦沒有宣稱每個 viewport 都有同樣缺陷。

## 4. 部分完成、未知與阻塞

| 領域 | 已有成果 | 仍不能宣布完成的部分 |
|---|---|---|
| 角色與新遊戲 | 原作 species catalog、名稱／身分資料、224 美術工作區 | 起始取第一枚蛋明示未知；預設畫面仍是幾何 fallback。faithful atlas 沒有完整綁定到生物、狀態及動作 |
| Cage | 36 identities、Shop 對應、rank slots、40 視覺 fields 與 compositor | `ranchSlotGeometry.js:62` 的 2 列配置屬 PRODUCT_AUTHORED；育成兩個圓角區域也非原作精確空間；training magnitude UNKNOWN |
| Hunt 地圖與野生 AI | 原作 map family、128×128 邏輯維度、bit 0 collision 結構、Hunt 載入範圍控制 | `huntWorld.js:72` 以 seeded 橢圓生成阻擋；`:41` 取前三個非蛋 species、固定 6 隻；目前不是原作 ATR／地區 encounter 綁定。移动、游走為 product 規則 |
| Gate | 17 筆地點／費用、出發 gate、裝備配置與 bounded Three 場景 | exact 3D interaction、全部 unlock/progression 與原作新檔條件仍需個別確認 |
| Shop | 118 筆資料、Bits／持有量與購買功能、focused tests | 顯示仍有 Training Goods 0 等內部名稱；詳情／数量／確認流程未全面驗收為原作等價 |
| Battle | VM／natives／傷害／結算的已追蹤模組、可運行對戰 | 所有 natives、策略、模式、場地綁定、賽程、己方名單、獎勵與後續進度未完整接通 |
| UI / Help / Database | 15 screen IDs、96 份 UI 工作區、ROM 順序的 Help、Database 登錄結構 | 15 routes 不等於96 NXR scenes；資料面板及工具行為未全接。未知值用破折號是正確的誠實呈現，不是數值已完成 |
| 進化／生命週期 | species、stat ladder、部分條件研究 | 持久個體欄位、feeding/training writers、rung 更新、進化／疾病／壽命與戰鬥紀錄連動缺受控證據；保留 UNKNOWN_REQUIRES_TRACE |
| Save | 單一產品持久寫入 authority、基本 save/continue、guard tests | 完整捕獲→養成→對戰→獎勵→進化→冠軍賽→重載的存檔等價尚未驗收 |
| 聲音／特效 | VFX 資源、場景及事件研究存在 | 本次未逐事件重驗全部音效／BGM／特效觸發；不因檔案在美術包就宣布整合完成 |

架構判斷：DOM UI、共享 Pixi 2D、限定 Three 場景是合理且符合 Owner 現代化邊界的工程分工。NDS overlay 與 browser modules 不需要同名或一對一；真正需相符的是相同入口、操作、條件、狀態變化及回饋。沒有理由另起 router/store/save/Pixi bootstrap。

美術政策仍有文件衝突：目前使用者規則與根目錄 AGENTS 要求 ROM/decoded 僅研究用途；2026-09-02 Owner Direction 與現有 production index 則記錄 licensed decoded promotion。**本次只記錄現況，不依歷史文件擅自擴張最新指示，不判定授權有效性，也不新增 promotion。** 採用經 Owner 核准的外觀改編本身不等於 gameplay 偏離，但当前灰色 fallback 也不能算完成該美術方向。

## 5. 影片證據與閱讀範圍

- 使用者提供的[遊戲介紹 BV13T4y137ef](https://www.bilibili.com/video/BV13T4y137ef/)已在瀏覽器開啟並抽樣觀看相關養成段落；約 01:58 可見 Cage 模組／編輯，約 02:08 可見育成狀態、角色需求氣泡及原作教學。這是抽樣，不宣稱整支 07:03 每個操作都逐幀查完。
- 使用者提供的[實機 BV13u411B7BK](https://www.bilibili.com/video/BV13u411B7BK/)本次重新播放約 00:24–00:37，並重新檢視既有 V03 原作肉塊影格；完整跨流程判斷另使用既有 52 條觀察索引，清楚保留歷史採樣標籤。
- 介紹片字幕的推論／作者自製圖表不等同 ROM 規格；實機英文版與日文 YDIJ 的版本差异、影片中 9999 等特殊數值，不作為一般倍率、初始值或完整進化條件。
- 播放器曾顯示登入提示。`original-feed-ground-placement.png` 與 `intro-care-tutorial.png` 是被提示遮住的無效畫面；**不採為玩法證據**。命名中的 sample/秒數是導航目標；真正觀察時刻依 media time 與影格時間。
- 該網站 web text fetch 曾回 412，但 in-app browser 可公開播放；沒有下載影片或取得帳號登入資料。

額外參照的原作研究包含 Evidence MCP 回傳的 `SHOP_REVERSE_SPEC_v1.md`（ARM9 118-row master table）、`CLAUDE_CODE_YDIJ_SYSTEMS_HANDOFF/05_GAMEPLAY_SYSTEMS/GAMEPLAY_MASTER_SPEC.md`（原作流程概覽）、既有 UNKNOWN dependency 文件。這些 source claims 與本次重新讀 ROM 的結果分開，不將 MCP 的搜尋分類當作驗證等級。

## 6. 測試、限制與下一個安全步驟

- ROM raw-art 比較：6,317/6,317；catalog 比較：17 份、0 差異、0 builder error。
- 本次預設 `npm test`：493 pass / 35 failed file workers（528 個報告項目）；35 筆都是 worker `test failed` 與程序退出，沒有据此判定35個 gameplay assertion錯誤。各程序含 Windows exit code 與134等不同值；根因未追。
- 同一來源、不修改程式，以 `node --test --test-concurrency=2 tests/*.mjs` 重跑：**835 pass / 0 fail / 0 skip / 0 todo**。見 [預設並行紀錄](npm-test.log)、[限定並行完整紀錄](node-test-concurrency-2.log)。降低並行後通過支持環境／並行負載相關性，但不等於已證明崩潰根因或預設指令穩定。
- 瀏覽器：獨立 `http://127.0.0.1:8879`，避免使用既有開發來源的玩家存檔；驗證基本 Save/Continue、Battle result/Shop wallet、修正後 FEED ground input、390×844 layout。
- 沒有全面 NDS 模擬器同步輸入、完整通關、所有野生 species／所有模式、實體觸控裝置或全部數值分支驗收。
- 最後來源檔／Git 驗證見 `audit-validation.json`；既有未提交程式與美術保持原樣，只新增稽核資料並補充 Current Product Status。

下一個符合 vertical-slice 原則的工作可以先收斂 **選 FEED → 籠內空地落肉 → 個體靠近／攝食 → 庫存／回饋 → save/reload**。先補齊食物投放、消費與個體寫入的原作追蹤，再經既有 authority 接線；不能用通用 careCount 或加14飽食度替代。战鬥獎勵 seam 亦已有清楚邊界，可排作獨立後續修復。這份稽核沒有開始任何玩法實作。
