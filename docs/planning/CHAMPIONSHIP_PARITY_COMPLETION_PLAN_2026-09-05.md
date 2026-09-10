# 五項原作符合度缺口：完成方案

日期：2026-09-05，Asia/Taipei。狀態：**第一、二輪已實作並通過限定範圍工程驗收；其餘工作包仍為方案。整體原作符合度仍為 PARTIAL。**

本文件最初回答 Owner「這些問題該如何完成」。Owner 隨後指示「請進行第一輪的開工」，授權工作包 A 的戰鬥經濟／保存接線與 F 的手機遮擋修復。第一輪已修改 runtime、測試及兩份 bounded contract，完成 868／868 回歸及本文末列出的瀏覽器驗收。Owner 再授權「請開工第二輪」，完成下述個體 ID／保存介面及純時間／共用日曆。捕獲、玩家隊伍／完整合法賽事、Hunt 地圖／分布與完整養成時間效果仍是後續工作；投食只列共同資料依賴。沒有修改美術或執行 push、merge、deploy。

## 1. 基準、證據與完成定義

- 工作資料夾／Git root：`R:\Projects\Championship2026\championship-2026`；初始 cwd 是上一層。
- Branch：`main`；HEAD：`d0c48f340baac61cf399bf5bd5922ce58f3d38c7`，包含既有未提交工作樹成果。
- 已先讀 AGENTS、README、Owner Direction、Architecture、Current Product Status、Dependency、Blocker 與相關 contracts。舊版文件中的「未開始」、舊三隻 product roster 等描述不能覆蓋現行程式與 Owner 最新方向。
- 原作來源為 Owner 附件 YDIJ ROM，SHA-256 `8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`。跨目錄歷史研究僅提供待重驗線索；不得引入其他專案的產品真值、程式、Save 或資產。
- 既有 [稽核](../reports/parity-audit/2026-09-05/PARITY_AUDIT_ZH_TW.md) 的 DOM、截圖、來源雜湊是第一輪修改前的缺口證據，保留原樣。第一輪修改後的驗收紀錄另行產出，不覆写舊觀察。

每個功能都以「相同入口 → 相同操作與條件 → 相同狀態變更 → 相同回饋 → 正確後續與保存」驗收。原作功能的保存時點也須查證；工程上的交易防重複不等於擅自增加自動存檔或離線成長。

維持既有 app／screen stack／Raising／Shop／persistent save／Pixi stage 權責。DOM 接受 intent 並呈現結果；domain 判斷合法性；app 協調交易及唯一存檔入口；Pixi 呈現 2D 互動。新狀態名稱是 2026 工程設計，不冒稱已恢復 ROM enum。

## 2. 先更正：150 是報名費，7,000 才是該筆資料的獎金

規劃時直接從附件 ROM 重新解碼 OVL10／OVL8，識別出 consumer 的語意錯誤；第一輪已據此修正：

| 資料／路徑 | 靜態 ROM 重驗 | 修改前稽核 | 第一輪已實作及驗收 |
|---|---|---|---|
| Title record `+0x24` | OVL10 讀到畫面 `+0xD538`，與 `PlayerData+0x4C8` 比較，再從錢包扣除 | 被當成 PRIZE | `matchEntryFee()` 讀 field24，app 驗餘額並扣款 |
| Title record `+0x20` | OVL10 讀到 session `+0xC94`，OVL8 傳入 pending，再加到錢包 | 結果頁未消費此來源 | `matchPayout()` 讀 field20，結果交給既有 reward gate |
| Record 0 | 報名費 150；獎金欄位 7,000 | 0 Bits 可進 MATCH 00，顯示 PRIZE 150，回 Shop 仍 0 | menu 分列 150 費用／7,000 獎金；餘額不足拒絕 |
| 實際付款 | 受勝負、回合、mode／matchIndex gate 與錢包上限控制 | 直接展示 catalog，沒有 settlement | app 更新同一 Shop wallet；result 顯示實際 credited／walletAfter |

可重跑證據：[檢查腳本](../reports/parity-audit/2026-09-05/battle-fee-payout-rom-check.py)、[檢查結果](../reports/parity-audit/2026-09-05/battle-fee-payout-rom-check.json)。這是欄位、分支與讀寫鏈的靜態驗證，尚未新做模擬器受控整場對局。

因此，先前瀏覽器的 **PRIZE 150／錢包 0 是正確的修改前觀察，但「應入帳 150」不是正確的原作需求**。原始觀察紀錄保留，不改成瀏覽器已顯示 7,000，也不再作為修改後 consumer 的現況描述。資料表重新生成完全一致，仍可能存在 consumer 將欄位命名錯誤的問題。

## 3. 工作包 A：報名 → 戰鬥結果 → 錢包 → 保存

### 已有成果與接點

- [battleMatchSelection.js](../../src/championship/battle/battleMatchSelection.js)：已修正 fee／reward 語意，menu 分列兩者。
- [battleOutcome.js](../../src/championship/battle/battleOutcome.js)：`recordRoundOutcome()` 與已完成回合旗標。
- [battleRewardTransaction.js](../../src/championship/battle/battleRewardTransaction.js)：`resolveBattleReward()`、`creditBattleReward()`；保留已追到的 gate 及 9,999,999 上限。
- [shopRuntime.js](../../src/championship/shop/shopRuntime.js)：同一 wallet authority，app 經 `applyBitsTransaction()` 一致套用交易。
- [championshipStandaloneApp.js](../../src/championship/app/championshipStandaloneApp.js)：`enterMatch()`／`finishMatch()` 已協調扣款、結算、receipt、dirty 狀態及畫面轉移。
- [battle-economy-runtime.v1.json](../contracts/championship/battle-economy-runtime.v1.json) 與 [championship-save-envelope.v2.json](../contracts/championship/championship-save-envelope.v2.json)：記錄本輪接口、持久化及未知邊界。

### 第一輪已實作的接線

1. 以獨立 ROM fixture 修正 consumer 與測試：`entryFee=field24`、名目 `payout=field20`；receipt 的 `rewardBits` 是經結果 gate 後的應得額。
2. app 固定 attempt ID、match、mode／battleType、費用與獎金；同一 attempt 不重扣。餘額不足與入場前返回不扣款，沒有更改新遊戲初始錢。當前只接既有單場 fixture：`mode=0`、`battleType=0`，並明標 PRODUCT_AUTHORED；原作模式 crosswalk、個體 ID 與完整合法性仍屬 C，不冒稱完成。
3. Runtime 直接輸出 numeric verdict、battleType、round cursor／flags、reward mode、matchIndex；開始後禁止替换所選 match，避免 session 與經濟身分分離。
4. 實際完成後才記錄一筆 round flag，並在 final observer 前發布；未完成的空 flags 不可結算。四個 mode 按鈕維持停用。
5. app 更新錢包並建立 settlement receipt，result 顯示實際增加額、結算後持有及封頂資訊；沒有 receipt 時顯示未入帳。單調序號／已結算界線及有界最新 receipt 防止重送／已保存 attempt 重播再次入帳。
6. wallet 與 receipt 一起進 schema v2 候選快照，仍用 `championshipModernSave:v1` key、既有 save port 和 guard。v1 可遷移並保留既有玩家資料／R2 serialized payload；不保存 ROM catalog、VM、逐幀 log 或研究 evidence。

以上接線已通過 focused／整合 regression／bounded browser 驗收。預設玩家隊伍與賽程仍為 fixture；不能將本輪經濟流程等同自己的養成個體與正式賽事完成。

### 存檔失敗不是例外捕捉問題

[ChampionshipPersistentSavePort.js](../../src/championship/app/ChampionshipPersistentSavePort.js) 的 `save()` 失敗返回 `phase: "SAVE_FAILED"`，不能只依 try/catch 判斷。第一輪保留錯誤／retry 提示，Save & Quit 僅在 `SAVED` 後回標題；未保存 receipt 留在 app 的同一狀態中。

原本 save port 的低階 `retry()` 可重播 `lastRequest`，存在舊錢包／道具覆蓋風險。現在 app presentation 的 retry intent 改呼叫 `app.save()`，從目前狀態重建一致候選快照，不直接重播舊 request。原有 64 KiB 上限及未知值政策持續適用。

本輪沿用手動 Save／Save & Quit，沒有新增結果頁保存入口或自動戰鬥 checkpoint。Active battle 沒有可恢復 runtime contract，因此 active 時拒絕保存，避免寫出已扣款但不能續戰的快照。只有已成功持久化的 checkpoint 才保證重載恢復；未保存的費用／獎勵不宣稱耐久。中途 Leave 保留現有 prototype 路徑，關閉 attempt 而不自行新增退款；原作取消／退款規則仍待 trace。

### 驗收

- 受控測試狀態 150 Bits，其他入場條件合法：報名後 0，勝利後 7,000，合法保存／reload／Continue 後仍 7,000。
- 149 Bits 拒絕；取消不扣；確認重送只扣一次。1,000 Bits 報名後 850，勝利後 7,850，敗北維持 850。
- tie、battleType 2、多輪、mode 1／index 61 特例、封頂，按已驗證 gate 測試。
- 結果重掛、完成事件重送、SAVE_FAILED→retry、存檔後重播舊 attempt，不能重領；receipt 與 Shop 相同。
- 交易測試可用明示 fixture；它通過不代表「玩家養成個體的正式賽事」已完成，後者依賴工作包 C。

## 4. 工作包 B：同一張地圖上的完整 Hunt 捕獲

使用一張已知場地、一種工具、一種已驗證目標先完成全流程。`hm00` 可作 tutorial 研究 fixture，但普通 Gate 的正式入口仍按原作條件，不能把 tutorial 變成新 biome。

### 先處理座標、鏡頭與幾何

[huntWorld.js](../../src/championship/hunt/huntWorld.js) 的場地模型、既有 camera/chunk kernel 與 [Pixi input adapter](../../src/championship/presentation/vs2/createHuntFieldPixiPresentation.js) 可延續。先將 native、world、viewport 轉換集中，校驗原作場地 pixel 與 128×128 grid 對應。現有視覺 1024／邏輯 2048 的 2 倍關係，不能默默把 pull／stroke 門檻也放大兩倍。

[本專案輸入追蹤](../research/HUNT_FIELD_INPUT_ROM_TRACE_2026-08-29.md) 記錄反向拖曳鏡頭；目前空白拖曳卻送 `moveTo`。在同一 input owner 中分配「進行中工具手勢、有效目標互動、空白場地 pan」，原作操作若與此優先序有差異再依證據調整。`pointercancel` 應獨立 abort，不可沿 `onPointerUp` 提交。

現有 [captureStrokeRecognizer.js](../../src/championship/hunt/capture/captureStrokeRecognizer.js) 和 [tetherSystem.js](../../src/championship/hunt/capture/tetherSystem.js) 已承認部分 endpoint／HUD 距離為 PRIOR_SPEC 或 PRODUCT_AUTHORED。舊報告、現行程式與測試之間有差異，不能直接挑一組 5／20／25／15 常數替換。

本次從附件 ROM 再驗幾何分支，另見 [幾何檢查結果](../reports/parity-audit/2026-09-05/hunt-geometry-rom-check.json)：5 組、70 條指定指令核對通過，直接確認 20 槽循環覆寫，與現行滿 20 點停止不同；5 門檻另有計數分支，25／15 不能簡寫成外框／首尾距離。它只證明明列的指令／資料流；helper 語意、計數條件與完整空間查詢須繼續追蹤。應錄製 native pointer stream 做 ROM／JS 對照，包含長筆跡、短距離重複點、狹長形狀、0／1／多目標；不能只保留目前 prototype 的 passing tests。

### 拆開捕獲的狀態轉移

目前 [huntRuntime.js](../../src/championship/hunt/huntRuntime.js) 把閉合且包含目標視為成功，提前 `splice` 野生個體；app 又立刻寫 collection、進結果。正確接線需要拆開：

1. 工具／手勢有效，只對原作適用目標產生對應互動事件。
2. Rope 路徑依證據處理套繩、pull、HP／受限狀態、解除或逃脫；Shot、Trap、Wire 各自保留原作效用，不強迫每次捕獲走同一工具序列。
3. 目標滿足手掌收取条件後才接受收取；ROM help #104 明示 HP 0 門檻。此時才處理記憶卡容量與暫存所有權。
4. 依原作確認收取後是否留在 Hunt、何時離場、結果命名／放生／取消、圖鑑與正式 Raising 個體的提交時點。

維持同一個 target instance 身分贯穿上述階段。圈線期間不建立 Home 個體，不能只在原有「成功」後播放更多動畫。

### 記憶卡、舊個體與未知值

[memoryCardCapacity.js](../../src/championship/hunt/capture/memoryCardCapacity.js) 現在以整個 Home collection 的隻數、每隻 1 G 計算。需重新追收取 event、on-card 清單、species G 欄位與容量拒絕路徑，再按真正 card ownership 求和。不能把卡中暫存數與家中飼育數當成同一集合。

舊檔中的 `PRODUCT_AUTHORED_ENCLOSURE` 個體保留 ID、名稱及原紀錄；不要刪除或 load 時升級成已驗證原作捕獲，也不按新容量回頭刪減。後續 ID allocator 不能繼續使用 `collection.length + 1`，加入放生後會重用 ID；在同一 save 中持久化不重用的序號。

待追蹤的硬依賴是 pull 傷害／位移／耐久、工具與 species 有效性、目标 AI、G 成本 reader、結果提交及正式個體初值。影片用來建立可見操作順序，不提供這些數值。

### 驗收

從正常入口進一張 verified field，完成一條原作可行的捕獲路徑 → 手掌收取 → 結果管理 → 回家 → 保存／Continue；同一個體只出現一次。圈線本身不入庫，HP／工具條件不足不能收取；pointercancel、離場、重複事件不生成個體。卡剛好容納／超額／拒絕及結果放生都有對照證據。不同手機 viewport 的相同 native 手勢得到相同 domain 結果。

## 5. 工作包 C：養成個體 → 編隊／策略 → 合法賽事

### 真正依賴是玩家個體資料

[battleRosterSource.js](../../src/championship/app/battleRosterSource.js) 仍接舊三隻 product profiles；[battleRuntime.js](../../src/championship/app/battleRuntime.js) 預設玩家使用 ROM opponent team 1。現在 Raising collection 只有 instance／species／名稱／捕獲來源等資訊，未包含完整原作成長與戰鬥資源欄位。

1. 在既有 Raising authority 建立一個 instance resolver，讓 starter、居民、捕獲個體能以同一 stable instance ID 解析。party 保存個體 ID，同 species 的兩隻不能合併成一份數值。
2. 從原作玩家 party 讀取追到 persistent record → combatant build：species identity、各 rung、招式／AI 來源、HP／TP／異常初值、`source12C/source130` 等。現有 species 表、stat ladder 及 opponent build 不證明玩家當前值已知。
3. 延續 `buildCreatureFromProfile()` 與 battle session 建立 adapter；正式入場前驗證必需欄位，缺值不得用對手隊伍、species 0 或固定 rung 默補。
4. 接原作的個體選擇、編隊合法性及已證實戰前策略；保留可空槽與非對稱隊伍，不強制補滿三隻。蛋能否出戰也須依原作資格。
5. 追戰後 writer 再把已驗證進度／狀態寫回同一個體；不能把戰鬥暫存 HP 直接當育成永久 HP。

這與投食的共同依賴是 persistent 個體及 writer。正確投食仍是「FEED → 點角色旁空地 → 落肉 → 接近／攝食」；不要為了讓 battle 能讀數值而先自創投食成長量。

### 賽程與模式

Schedule、Battle Menu、入場驗證消費同一 world clock／已驗證 progress snapshot，移除 `(2,3)` 預設。選賽事後跨日，要在入場重新驗資格；日曆不另算時間，rank 未追到 writer 不能自動增加。

四個 cube 按鈕、OVL10 entry mode、reward mode、battleType 是不同對照表。先追「按鈕 → handler → setup → session → filter」，不能用按鈕位置 0–3 猜 enum。

先開證據最完整的一個單場／頭銜賽模式；其後才是冠軍賽多輪與資格、Free Battle、通訊模式。通訊是原作功能保留項目，不能用舊程式 single-player 註解永久刪除；web 傳輸替代方案另作 bounded design，需要改變原玩法的部分明列 Owner adaptation。

### 驗收

使用實際保存的兩隻同種不同成長值個體驗證獨立 build；party reload 後 ID／順序不变。涵蓋合法 1v3／3v1／3v3、重複個體、空隊、未知 profile 與其他已驗證拒絕條件。Schedule 與 Battle 列出同一批合法賽事；費用、策略、戰鬥、結果、回寫、保存全部走通，才可稱這個模式完成。

## 6. 工作包 D：原作碰撞與野生分布

與工作包 B 共用一張場地的座標基礎，但 collision、encounter、AI 是分別驗證的內容。原作地圖美術載入不證明三者。

1. 同一 `fieldId` 對應 presentation manifest 及已驗證的邏輯資料，取代 `huntWorld.js` 的 seed 橢圓阻擋。先追 ATR reader、bit 意義、適用物件與半徑、邊界及動態障礙；目前僅知道部分 bit 結構，不能把其餘 class 一律視為可走。
2. 追 ESC／出現表 reader、species mapping、區域與座標、同時存在數量、時間／進度條件與 RNG 呼叫順序。原始 ESC class 不直接等於 species 或機率。
3. 用同一存檔基線重複入場，再各自只改日夜、進度或區域，記錄生成與 writer。現有「前三種非蛋、六隻、固定 wander」只保留歷史 fixture，正式場地不能繼續 fallback 到它。
4. 追野生 AI 的移動、受驚、攻擊、追逃及工具反應；先完成一種已知目標，再依行為家族擴充。不要以一套自訂遊走取代全部 AI。

研究原始 ATR／ESC 僅作查證；runtime 不讀私有 ROM 包。對 runtime 提供經語意驗證、符合專案政策的邏輯資料 contract，保持 art/presentation 與 gameplay authority 分開。

驗收須用 ROM reader 與受控軌跡對照格子、边界、碰撞及 spawn 條件；不只比「看起來同一張地圖」。完成一個場地後才逐批擴展到其他 Gate 及日夜變體。

## 7. 工作包 E：自然時間

### 開工前基線：不能直接把 ADVANCE 放進每幀 callback

以下列舉第二輪修改前的缺口；目前實作與證據修正見文末第二輪驗收。

- [championshipWorldClock.js](../../src/championship/time/championshipWorldClock.js) 已有 4／8／24／60／400 cascade；08:00 是產品預設，600 秒只是約十分鐘描述的推定。
- `worldMinutesForRealSeconds()` 每次 `floor`，逐幀轉換會丟掉所有餘數。
- [raisingHomeDefinition.js](../../src/championship/raising/raisingHomeDefinition.js) 的 ADVANCE 把 0／缺值變成 5 分鐘，還呼叫含自訂 satiety／energy／ease／readiness 與移動的 `updateResident()`。
- [createRaisingHomeRuntime.js](../../src/championship/raising/createRaisingHomeRuntime.js) 的 accepted command IDs 累計上限 256；時間派送會耗盡整個 session，連玩家操作也被拒絕。
- 純時計 helper 支援 year，但現行 reducer／[R2 persistence](../../src/championship/raising/raisingHomePersistenceR2.js) 未完整傳遞／保存年與細分餘數。

### 完成步驟

1. 從現有時間欄位與 writer 線索追正常育成的增量／頻率，並建 mode 矩陣：工具 submenu、Shop、Database、Schedule、Hunt、Battle、結果頁各自走時／暫停／結算的規則。
2. 同一 Raising runtime 提供狹窄的 clock-only transition，使用整數原作 units 或可保存餘數；不呼叫舊 ADVANCE 的未證實養成效果。
3. 由頁面級 adapter 接既有唯一 Pixi ticker 的 elapsed measurement，再送入 app/domain；可視場景 callback 不各自推進世界時間。採有界序號／revision 去重，不耗盡玩家命令集合。
4. 同一 publication 更新 status、Schedule 及 Battle eligibility。存檔 schema／migration／digest 一併保留時間精度，舊檔未知歷史年份不猜填。
5. session 結束、New Game、Continue、visibility/context loss 重設或處理 elapsed 基準，避免舊 callback 或大 delta 誤推新局。背景、鎖屏、離線補時不由 web-first 自動推定。
6. End Day 與自然跨日共用已驗證 cascade；飢餓、訓練、疾病、壽命、進化的跨日 writer 各自追完再接。時計接通只能先稱「時間完成」，不能稱「完整養成完成」。

驗收：30／60／120 fps 及不同時間分塊結果一致；午夜、Day 8、跨季、跨年及保存重載精度一致；超過 256 次更新仍可操作。未知養成值不被舊 reducer 偷改。所有走時／暫停與恢复行為按矩陣驗證，日曆與比賽讀值同步。

## 8. 工作包 F：手機遮擋

這是可獨立處理的版面問題，不依賴原作數值追蹤。

[修改前實測](../reports/parity-audit/2026-09-05/mobile-layout-bounds.json) 在 390×844 中，HP／TP 是 y=785.4–803.0，toolbar 從 791.2 起，save status 是 813.8–843.8，確實重疊。此歷史檔保留，不作為修改後量測。

修改前外層 [styles.css](../../src/championship/app/styles.css) 已扣 status／toolbar；內層 [intRh2Styles.css](../../src/championship/app/intRh2Styles.css) 卻用 `100dvh`，忽略父層可用高度，並有五列 grid 對應四塊 DOM 的不一致。第一輪已調整為父層可用高度與一致 grid。

第一輪已集中修改既有 shared chrome，並完成下列五尺寸的瀏覽器檢查：

1. Root 提供 `--cm-screen-height`，內層依父層 100%／`min-height:0`；field 吸收剩餘空間，避免再次消耗完整 viewport。
2. Toolbar 量測實際 rail border-box 高度，safe-area 計一次，模式切換同步高度並在 dispose 清除 observer。
3. Hunt／Battle 同樣改讀可用高度，保留既有 screen shell 與 stage resize authority，沒有新增 canvas／ticker。

按 contract 驗收 **360×800、390×844、393×852、412×915、430×932**：每尺寸保存 screenshot＋DOM bounds，實際點選／拖曳，確認 HP／TP／save 完整可見、工具列／submenu 可用、無水平 overflow、screen→world 座標一致。Home→Hunt→Home／Battle 轉場及 resize 不新增 canvas／ticker。實體手機測試須另有執行紀錄，不能由桌面 viewport 模擬代稱。

## 9. 排序、停止條件與交付

| 輪次 | 實作交付 | 可平行進行的只讀研究 | 完成後能宣稱什麼 |
|---|---|---|---|
| 1 | F 手機可用範圍；A 費用／結果交易與保存 | 個體來源、Hunt 幾何／收取、時間 writer | 版面缺口修正、戰鬥經濟切片完成；整體正式 Battle 仍部分完成 |
| 2 | 已驗證的個體 identity／save 接口；E 純時間與共同日曆 | 玩家 build、跨日 effects、模式 crosswalk | 同一個體／時間資料來源可用；未知成長仍未知 |
| 3 | B＋D 一張圖、一工具、一目標的捕獲與返家 | 其他工具、場地、AI 家族 | 一條原作捕獲流程可玩與保存 |
| 4 | C 自己的個體、一個合法賽事，加上 A 的交易 | 冠軍賽多輪、rank／qualification、其他模式 | 養成個體 → 合法戰鬥 → 結果／錢包／保存完成 |
| 後續 | 依同一驗收模板擴其他場地、模式及日結效果 | 未閉合 writers | 逐項增加已驗證範圍，不用總檔數推算百分比 |

輪次是依賴排序，並非要求未知項目阻塞所有工作；已閉合的獨立切片可先做。實作 WIP 保持一個主要可玩流程，研究可分工，避免同時改 app／save authority。

停止／不宣稱完成的條件：只找到數值未找到讀取／寫入路徑；原作報告與 binary 不一致；玩家必需欄位未知；只靠 catalog 重建或 prototype tests；只完成畫面而沒有狀態與保存；runtime 需要讀 research-only payload。此時留下具體地址、缺失 caller／writer 與下一個受控實驗，繼續不依賴它的工作。

每一輪交付 code／contract 對照、原作證據 receipt、focused tests、必要 regression、手機操作紀錄、save migration fixtures、`git diff --check`。上一輪同一來源的 bounded regression 為 835／835；default `npm test` 曾有 35 個 worker process failures。兩種結果均保留，沒有把測試通過當成原作真值。

第一輪交付包含 A／F 接線、兩份 contract、focused tests 及限定範圍工程驗收。修改前 835／835 保留為基線；本輪 `node --test --test-concurrency=2 tests/*.mjs` 為 **868／868 PASS，0 skipped／todo**，`git diff --check` PASS，附件 ROM 費用／獎金的 64 個靜態檢查也重新通過。B／C／D／E 沒有因此變成已完成。

瀏覽器使用隔離 localhost 測試來源，以明示 150 Bits 的 v1 存檔進入實際產品頁：Continue → MATCH 00 → PRIZE 7000／HAVE 7000 → Shop 7000 → Save & Quit → 重載 → Continue → Shop 7000，流程通過。另一筆 0 Bits 實測顯示不足額並留在選單；149 Bits 拒絕、失敗保存後購物再重試、敗北、封頂及重複事件由 focused tests 覆蓋。沒有改變 New Game 的 0 Bits，初始收入與完整進程仍待後續原作證據接線。

五個要求尺寸均保存選中個體的截圖／DOM bounds，完成 SYSTEM 開關及 HAND 跨籠拖曳；HP／TP 與保存狀態沒有被固定工具列遮住，無水平 overflow。390×844 的 save status 現為 y=761–791，toolbar 起於 y=791.2。393×852 的要求在此主機回報實際 DOM innerWidth=394，紀錄保留要求值與實際值，不冒稱精確實機尺寸。Home → Hunt → Home 往返均只有一個 DOM canvas；程式仍沿用原 stage／ticker，瀏覽器未記錄 error。

本輪 local QA artifacts 位於 repo 外 `C:\Users\USER\.codex\visualizations\2026\09\05\championship-round1`，包含 `regression-final.log`、`mobile-layout-bounds.json`、`mobile-pointer-results.json`、`transitions-and-console.json`、結算／商店 DOM 與截圖。實體手機、非零 safe-area、強制 WebGL context loss 恢復及完整原作模式沒有在本輪通過驗收。


## 11. 第二輪驗收：個體介面與純時計／共用日曆

Owner 指示「請開工第二輪」後，沿用 app、Raising、Shop、persistent save 與 Pixi stage 實作，沒有新增第二套 authority。沒有修改美術、投食、原作捕獲狀態機或玩家戰鬥 profile。

- **完成**：統一 starter/resident/collection resolver、可保存 ID 配置高水位、同種不同個體資料獨立、外層 save v1/v2→v3、Raising payload v1/v2/v3→v4、原 digest 先驗後遷移、保存失敗重試最新快照。
- **完成**：時計專用 transition、可保存年與 raw/subunit 餘數、共用日期、日期／rank 入場再驗、End Day 次日07:00、正常可見育成場景的名義原作幀速率，超過256次走時後仍可操作。自然時間不调用舊 ADVANCE 的自訂居民效果。
- **ROM 追證修正**：132/132檢查；分鐘字0210AA98、原預設07:00、自然22:00後stop清餘數；Training entry divisor200、exit400；原機未落幀時每VBlank轉16raw。舊600秒推定与576000/4608000 RAM divisor預測已撤回；後兩者實為1440／11520分鐘。詳見 [時計追證](../research/round2-clock-2026-09-05/CLOCK_ROM_TRACE.md)。
- **瀏覽器通過**：390×844育成走時／角色選取／HAND搬籠、選單gate、Home↔Shop、End Day日期與Schedule今天一致、手動保存重載、未知日期舊檔、21:59→22:00停止。實際秋季Day4測試對局勝利→獎金7000→Shop7000→手動保存重載仍7000。修復美術非同步載入導致Home時計留在21:59的競態，補直接重現的regression。
- **驗證**：最終917/917 regression PASS，git diff --check PASS；本機QA記錄在 `C:\Users\USER\.codex\visualizations\2026\09\05\championship-round2`。這是本輪實作後證據，不改寫前輪稽核觀察。
- **部分／未知**：其他mode/modal的完整stop/resume條件、原機stall/jitter及受控模擬器時序、全自動日結效果、個體成長／HP/TP／進化與戰鬥profile、四模式和完整賽事資格。UI對未知個體能力保留「--」；對舊檔未知日期保留「—」。本輪不宣稱完整原作時間或合法賽事已完成。

保存契約見 [v3 envelope](../contracts/championship/championship-save-envelope.v3.json)、[個體ID](../contracts/championship/raising-instance-identity.v1.json)、[時計](../contracts/championship/world-clock-runtime.v1.json)。下一個安全切片維持第三輪 B＋D：一張圖、一工具、一目標的原作捕獲與返家；先閉合pull／收取writer與field幾何，不能由本輪ID介面反推未知個體初值。
