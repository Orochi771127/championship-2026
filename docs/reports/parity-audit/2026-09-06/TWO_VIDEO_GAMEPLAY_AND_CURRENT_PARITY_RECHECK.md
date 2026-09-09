# 兩支指定影片：玩法、模式與目前製作對照

日期：2026-09-06，Asia/Taipei；本輪觀察跨越 09-05／09-06。

**結論：原作的主要操作結構已有影片及 ROM 證據支持；目前產品僅部分接入，不能宣告「已完成內容全部與原作相同」。** 尤其投食的地面物件流程、正常入口捕獲、玩家養成個體參賽仍未完成。這次只新增查核紀錄，沒有修改 gameplay、資產、存檔或其他專案。

## 1. 查核邊界與來源

- 開始所在資料夾：`R:/Projects/Championship2026`。正式產品／Git root：`R:/Projects/Championship2026/championship-2026`。
- Branch：`main`；HEAD：`d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。結論包含現有未提交工作樹，不能當成該 commit 單獨的完成度。既有大量 dirty changes 保留。
- 已讀專案 AGENTS、README、Owner Direction、Architecture、Current Product Status、Dependency Matrix、Blocker Ledger、Hunt 相關 contracts／reverse reports；檔案內的歷史授權及舊狀態沒有覆蓋使用者本次指示。
- Evidence MCP 對 `BV13T4y137ef` 查詢無結果；這是該次檢索無匹配，並非原作沒有該功能。Web 文字抓取失敗後，使用 in-app browser 成功開啟兩支指定影片。
- 原作 ROM 本輪重新計算 SHA-256：`8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`，67,108,864 bytes。YDIJ 身分與既有 [ROM provenance](../2026-09-05/rom-provenance.json) 相符。
- 本輪是影片畫面／可見字幕採樣、既有影格重看及 source audit；**沒有逐幀看完、完整音訊轉錄、新跑模擬器 trace 或正常產品全流程驗收**。

| 指定來源 | 身分與用途 | 本次證據範圍 |
| --- | --- | --- |
| [BV13T4y137ef：遊戲介紹](https://www.bilibili.com/video/BV13T4y137ef/) | 風月Official；2020-04-24；約 7:03。涵蓋育成、進化解說、Hunt、Championship、圖鑑。 | 新存 6 張影格：4 張遊戲畫面、1 張作者進化圖、1 張登入遮蔽排除。頁面有進化表勘誤及日／美版差異的作者提醒。 |
| [BV13u411B7BK：数码宝贝---冠军](https://www.bilibili.com/video/BV13u411B7BK/) | 超丸Beletia-Tisha；2022-03-24；13:17。現有存檔的育成、Hunt、購物、編隊、戰鬥與日期推進。 | 重新開啟頁面及約 1:12 容量不足畫面；重新讀取既有 52 筆索引並實際重看其中 13 張歸檔影格。不是新增 52 次播放。 |

此前詳細總索引的另一支影片 `BV1RQ4y1B7up` 是「前期攻略」，與本次指定的介紹片不同。本報告不把那支片的獨有內容冒充成這兩支的直接觀察。

介紹片與實機片均顯示英文版畫面；本地基準是日版 YDIJ。操作結構可以交叉驗證，文字、數值及版本特有條件不能直接等同。實機片可見 HP／TP 9999、Funds 9999999；既有索引記錄作者提及使用金手指。因此不從該片推導正常傷害、收益、成長速度或平衡。

## 2. ROM 沒有原始碼，對重建意味著什麼

「沒有開發者原始專案程式碼」與「ROM 只有機碼」是不同的陳述。這份 ROM 的既有拆解已包含可執行機碼、overlay、文字、資料表、地圖及圖像／動畫資源，也包含已分析的戰鬥腳本／命令資料。函式名稱、型別、註解與原始建置專案通常無法由這些成品完整還原。

所以需要反向分析，但可以依不同問題使用不同證據：

1. **影片**：玩家在哪個畫面、選了什麼、觸控位置、可見狀態與回饋、返回哪裡。作者解說與剪輯圖表另外標示。
2. **ROM 文字及資料**：工具用途、提示、物種／裝備／賽事欄位、資源身分。資料存在不等於已知道消費它的條件。
3. **反組譯與模擬器追蹤**：讀寫欄位、條件分支、RNG、碰撞、傷害與更新順序。受控重播需要保留輸入和來源。
4. **2026 runtime**：把已證實的行為接回既有 application、SavePort、DOM／Pixi 與共用 ticker，再從正常入口操作驗證。

例如「畫出圈線」只證明輸入形狀；仍須確認套繩、HP 寫入、倒地、手掌、卡片及返家提交。移植部分數值函式、測試通過，均不能省略這些階段。

## 3. 兩支影片呈現的玩法與操作方式

以下時間使用索引中的實際 `recordedMediaSeconds`，畫面播放器可能顯示四捨五入後的一秒差。網址的 `t` 與檔名是導航用途，不能取代實際時間。

| 流程 | 可見證據 | 2026 必須保留的行為；未證實部分 |
| --- | --- | --- |
| 育成／投食 | 實機 00:30.88，場上肉塊及食物剩餘數；介紹 02:33.72，多場地育成與能力訊息。 | 使用者已糾正：選食物後點附近空地放置，個體再前往吃。ROM 教學 1500／1501／1547 支持肉圖示、旁邊投食及誘導。不是選角色即直接補值；影格內 HP UP 不能一律歸因於肉。完整尋食／攝食時序仍需 trace。 |
| 籠舍／訓練環境 | 實機 02:01.08 的 Playground、HP Up、Occupancy Limit 6，以及不等形場地模組；介紹 02:33.72 的訓練反饋。 | 場地配置與個體所處環境有玩法意義。不能只當背景換皮，也不能把畫面上的容量數字等同於地圖占格大小或硬性放置上限。 |
| Gate／出獵設定 | 實機 00:45.46，球形地區選擇、Dina Plains、入場費、Settings、Return；既有 V48–V50 顯示裝備配置。 | 選地區、查看條件並配置工具，再進實際場地。地圖貼圖載入不證明碰撞／野生分布正確。 |
| Rope／拉扯 | 實機 01:02.03／01:02.63／01:03.43 的分段繩線、Pull 提示、目標狀態。 | 套索與拉扯是持續互動。ROM help89 支持 Rope 綁住及傷害、耐久影響斷裂；強拉扯分支和 AI 反應須以原作更新鏈為準。 |
| 倒地後手掌／卡片 | 介紹 03:54.43 直接要求用手掌收取；ROM help104 說明 HP 歸零後以手掌放入記憶卡。 | HP 歸零、可收取、手掌動作、卡片插入是不同階段。動畫或計數通知的實際來源須 trace，不能任意用繪圖 callback 提前捕獲。 |
| 捕獲後管理 | 實機 01:12.75 可見 New、命名、隨機命名、Release、066G／64G、Return；本輪直播約 01:12 亦見容量不足提示。 | 保留命名、容量檢查、放生選擇與返回。畫面 G 容量不足不能直接當作 Home 16 個體滿額的證明；兩種容量域要各自確認。 |
| 戰前準備 | 實機 02:42.84 編隊三槽、HP／TP／策略；V21–V22 為挑成員與戰前總覽。 | 個體養成資料、隊伍與策略要進入實際戰鬥計算；只用固定 ROM 隊伍可做引擎驗證，不能取代玩家隊伍。 |
| 戰鬥呈現 | 實機 03:00.39 開場，V24 到 03:30.49 顯示計時、位置、HP 及效果持續變化，V25 勝負。 | 這段呈現戰前決策後由個體自動交戰；影片不足以證明所有模式都沒有任何戰中操作，也不能據金手指戰局驗證傷害平衡。 |
| 商店與工具差異 | 既有 V14 購物數量／總額／確認，V31、V42–V43 商品分類；實機 12:30.50 Normal Wire 說明。 | Rope 與 Wire 必須分開。Wire 是設於地面阻擋／引導的工具，ROM help91 另記設置限制和消失；不是另一個名稱的套索。Shot 用途另由 help90 支持，不能憑分類按鈕宣告其效果已觀察。 |
| 日期及退出 | 實機 07:11.74 End Day Yes／No；V34 儲存提示、V35 次日；V52 另有 Save & Quit。 | 自然經過時間、主動結束一天、存檔退出及退出 Hunt 是不同命令，不能共用一個概念模糊的 Exit。影片不足以確認各模式暫停／計時倍率。 |
| 進化／圖鑑 | 介紹 03:04.94 是作者進化圖；06:11.21 是 Digipedia／Profile 及其他分頁；實機 V39 顯示進化結果。 | 進化與圖鑑均屬保留範圍。作者圖上的戰鬥次數、勝率及世代門檻須對照日版 ROM，不能直接當公式。 |

### 戰鬥模式與功能選單的區別

| 名稱 | 這兩支片支持到哪裡 | 不能額外宣告的內容 |
| --- | --- | --- |
| Free Battle | 實機 02:42 附近編隊、03:00 自動交戰，04:30.76 有 1VS1／3VS3 選擇。 | 尚不能由這兩張卡片推得所有人數配置及限制。 |
| Title Match | 實機 02:22.30 的入口；07:39.56 Challenge Gears、日期、入場費與 1 對 1 說明；V37–V38 戰鬥及勝負。 | 不能由一場推定全部稱號賽的規則、獎勵或解鎖條件相同。 |
| Championship | 介紹 05:36.61 參賽確認。 | 作者字幕談四年週期；本輪未追完整資格／周期／賽程鏈，不能只憑字幕升格為 YDIJ 已驗證規則。 |
| Password Battle／Wi-Fi Matching | 實機 02:22.30 模式立方體可見入口。 | 入口存在不代表影片展示了連線、配對、密碼處理或完整戰局。本次沒有該完整操作證據。 |
| 管理及系統選單 | V13：Help、Database、Battle、Save & Quit、Hunt、Shop；V15：Tamer、Schedule、Cage Edit、Digimon、End Day。 | 這是功能層級，不要全部當成互相獨立的戰鬥模式，也不要因為方便而自創第二套頂層流程。 |

## 4. 目前工作樹完成度重新判定

| 項目 | 已完成／部分完成 | 未完成與證據落點 |
| --- | --- | --- |
| 架構 | 延續既有 application／SavePort／DOM、Pixi、bounded Three 分工；這是 Web 架構。 | 不要求複製 NDS 原始程式架構，但須維持玩家行為語義。這次未重新做全資產依賴／授權盤點，不能把架構分工當成美術全部接入或可發布的證明。 |
| 投食 | toolbar 已有 FEED 文字／提示。 | `main.js:621` 只傳 `onMenuEntry`，未接 `onToolChange`；`raisingPresentationSource.js` 提供選取、移動、care、save intents，沒有地面食物流程。不能宣告可放肉、走去吃及其狀態寫入已完成。 |
| 戰鬥金流 | `main.js:370` 讀共用賽程、入場交易；`:476` 傳實際結果給 `app.finishMatch`。既有錢包／結果／存檔 receipt 已接線。 | 原始 MATCH 00 的 150 是入場費，該日版資料列 reward 欄是 7000；依模式和結果條件計算，不能保留舊的 PRIZE 150 誤讀。需要成功 Save 才能承諾重載持久化，沒有自動結算存檔的概括承諾。 |
| 玩家戰鬥／模式 | 現在已有共用日曆賽程，舊「仍固定預設賽程」描述過時。 | `battleRuntime.js:85` 附近仍使用代替玩家的 ROM 隊伍；主入口只傳 schedule，未把完整養成個體傳入；四種模式映射未完成。尚無自己的個體→編隊／策略→合法賽事完整驗收。 |
| 時間／育成 | `main.js:121` 已建立共用 ticker 的 clock driver；Round 2 日曆／身份持續化已實作。 | 時鐘走動不等於尋食、訓練、飢餓、成長、進化等自然行為都與原作相同。 |
| Hunt 地圖／野生生成 | 可進場；另有原作真實 15 隻 encounter／RNG 的研究重播。 | 正常 `huntWorld.js` 仍使用自訂 seeded 阻擋、前三個非蛋 species、六隻配置。真實 encounter 未取代正常生成，不能以美術相同宣告原作地形／AI 相同。 |
| 捕獲底層 | 已有 HP／Rope 數值、採樣、AI8 事件前段、AI10／倒地／手掌／卡片計數等 bounded ports。 | `huntRuntime.js:180` 以明確 `captureReplay` 建立原作 capture flows；`gateHuntPresentationSource.js:75` 等仍有 unbound tool placeholders。Contract 的 `normalEntryCapturePlayable` 仍為 false。正常工具、觸控採樣、AI8 位移、時序與完整畫面回饋未閉合。 |
| 卡片返家／固定居民遷移 | 原有 capture owner／SavePort 支持卡片命名、放生、返家提交；nested Raising v5 保留真實居民集合。既有隔離 fixture 驗過 full16、放掉初始居民、存檔失敗重試、Continue 不復活。 | 此驗收從研究 fixture 進入結果階段，沒有證明正常 Gate01 抓到的一隻已走完整段。也不等同所有原作 G 容量和放生畫面已完全一致。 |
| 手機版面 | Round 1 已保存五組 viewport 改善與操作紀錄，舊遮擋狀態不能直接當成現在。 | 本輪未重新跑裝置／safe-area 或全流程 touch QA，不能提升成所有手機已驗收。 |

上一輪 [phase port 報告](../../../research/HUNT_PHASE_PORT_AND_RESIDENT_MIGRATION_2026-09-05.md) 記錄 18 次繩線採樣、207 次 AI8 前段、15 次 AI10 位移／倒地、94 次手掌控制更新，以及 951／951 regression。**這些是上一輪的驗證紀錄，本輪未重跑，也不是完整原作 parity 的百分比。**

特別保留上一輪修正：`0210C034` 檢查 `W+11C > 0` 計數，不是 sprite 動畫完成位。不能因影片看起來像倒地動畫，就把這個條件改成任意 animation-end callback。

## 5. 下一個 bounded 步驟與驗收條件

先續完目前 Hunt slice 是合理順序：追同一個成功捕獲個體呼叫 `0210D8B4` 的 mode2／3、地形屬性及碰撞讀取，閉合 AI8 位移；接著把原作工具選擇、採樣、目標查詢、AI 更新與已移植階段接回現有正常 Hunt owner。實際 encounter／RNG 不可以研究中的一隻固定錄製個體硬編碼代替。

這一段驗收必須從正常 New Game／Continue 進 Gate01：

1. 合法選地區、帶入裝備並生成可追溯的野生個體與 RNG。
2. 真實 pointer／touch 畫 Rope、套中、拉扯；HP／位置／耐久的寫入與原作相同條件鏈吻合。
3. HP 歸零，按原作計數及狀態進入手掌可收取階段，再完成手掌／卡片流程；畫面不得提前移除或提交。
4. 命名／放生／容量不足操作、Return Home、成功存檔、Continue 後只有一隻相同身份的捕獲個體；失敗可重試且不重複獎勵／提交。
5. 保留正常入口的觸控、狀態、console、存檔及畫面證據，另外記錄 viewport。研究 fixture 不代替這次驗收。

完成此 slice 後再續地面投食與環境育成，以及養成個體接入戰鬥。這些是未完成的原作功能，不能因為捕獲底層進展而從 backlog 消失。9:16 的介面轉換仍需保留原作可選操作、條件、結果與回饋。

## 6. 證據檔案與本次檢查

- [本輪 19 筆影格 receipt](two-video-recheck-observations.json)：6 張新介紹片採樣、13 張歷史實機片重看，記錄來源、實際時間、分類與 SHA-256；其中 1 張遮蔽排除，1 張作者圖不作 ROM 數值依據。圖片留在私有研究目錄，沒有複製到 runtime。
- [實機原 52 筆索引](../../../research/video-BV13u411B7BK/VIDEO_OBSERVATIONS.json)；[既有分析](../../../research/video-BV13u411B7BK/ANALYSIS_ZH_TW.md)。未重新目視的索引項目在上文以 V 編號注明。
- [早先指定影片採樣](../2026-09-05/video-evidence-index.json)，保留所有排除／錯誤 seek 記錄。
- [ROM 工具／捕獲／時間 help](../2026-09-05/original-help-excerpts.json)；[投食教學](../2026-09-05/original-feeding-tutorial.json)；[入場費／獎勵指令與欄位檢查](../2026-09-05/battle-fee-payout-rom-check.json)。本輪讀取既有拆解 receipt，沒有重新宣告所有反組譯已跑過。
- [捕獲 contract](../../../contracts/championship/HUNT_CAPTURE_DATAFLOW.v1.json) 明確保留 `normalEntryCapturePlayable:false`。

本次 validation 記錄於 [two-video-recheck-validation.json](two-video-recheck-validation.json)。文件及影格完整性檢查與 gameplay 回歸為不同範圍；本輪只做前者。
