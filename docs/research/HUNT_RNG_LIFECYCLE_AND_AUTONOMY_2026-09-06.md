# 一般入口工作包 A：RNG 生命週期與自主行為盤點

本輪確認正式專案為 `R:/Projects/Championship2026/championship-2026`，branch `main`，HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。開工已有444筆 dirty entries，沿用共享工作樹，未 commit/push。根目錄與最新 authority、狀態、依賴、阻塞及 Hunt contract 已先閱讀；MCP 的同位址異 overlay 結果沒有被提升成此工作包證據。

**此輪完成的是既有 app 的 RNG 初始化／保存／恢復，不是完整野生生成。** `beginHunt()` 仍呼叫目前的 prototype world；它尚未消耗這份原作 channel RNG。局部 CPU 比對、app 邊界驗證與正常 Hunt 驗收分開記錄。

## 已實作、已驗證

- ARM9 `02043240` 的 master=0 路徑呼叫 `0201034C` 取得三個 RTC word，相加；全零時改為1。
- SDK callback case1 `02010580..020105CC` 解碼 BCD；同 SDK 的 `02010B1C` 按 `(word0*60+word1)*60+word2` 使用它們。這條讀取／消費鏈支持 hour、minute、second 的命名。
- 新研究 probe 以隔離 Unicorn 執行原 BCD 解碼、時間轉秒、完整 seeder 與 roll；外部 RTC 為明確受控輸入。六組含午夜／單秒／最大合法時間的結果，全部217個channel的 seeds/cursors 與 JS 相同。沒有宣稱這是原作正常開機／battery-save 驗收。
- `createClockChannelRng()` 重用既有原作 RNG，未引入另一套亂數算法。App 的 New Game 使用平台本地時分秒初始化；換場景不重設。這個 RTC 與育成遊戲時鐘分開。
- `championshipStandaloneApp` 持有唯一一份 gameplay channel state，提供共享 draw 邊界及複本投影。有效抽樣標記既有存檔為 dirty；無效 channel 不讀時鐘、不改序列。
- 同一 save key 的外層 schema 升為4，加入 `gameplayRng`。普通 Save 和既有捕獲返家交易都寫入相同投影。Continue 驗證兩個217元素陣列後才替換 session，且不重新讀 RTC。失敗重試保留最新記憶體狀態。
- v1/v2/v3 保留既有會員、錢包、cage、identity 與 nested Raising digest。不存在的 RNG 歷史保留為 null，直到第一個有效 native draw 才新建序列；不使用固定20、83或記錄好的未來抽樣。遷移不等於找回原本不存在的歷史。

本輪的 app 測試經過正常 New Game、Gate 選取／進出、Save、dispose、Continue；抽樣由核心 draw 邊界驅動，不是由正常 Hunt 生成器驅動。重載後再比較1,200次抽樣，含cursor wrap。這證明保存與延續，**不能證明一般入口已完整生成**。

## 自行走動、被捕獲逃跑、自動戰鬥目前做到了哪裡

| 行為 | ROM／原作證據 | 正常 runtime | 結論 |
| --- | --- | --- | --- |
| 育成場景自主生活、追地面食物並吃掉 | 原作流程與部分資料讀寫有研究；完整行為／消費 writer 尚未閉合 | `raisingHomeDefinition` 仍有基礎 resident intent；FEED 尚不是完整地面食物流程 | 未完成，不能以「會動」判定原作育成 AI 已完成 |
| Hunt 自行走動 | 正常原作入口觀察 AI1/2/3，已取得部分位移、地形／方向來源及目標指標寫入 | `huntRuntime` 正常野生個體仍用 product-authored wander；原作正常 AI host 未接 | 部分拆解，未完整實作接入 |
| 套繩後逃跑／掙扎 | 真實原作觸控取得 Rope 傷害、11/13事件、AI8反應／位移及AI10倒地的局部比較 | port及研究流程存在；正常工具取樣、AI切換／跟隨／陷阱與presentation未完整接入 | 部分完成，正常捕獲不成立 |
| 自動戰鬥 | AI選招、腳本VM、動作／命中、HP與勝負已有原作追蹤及實作 | `battleRuntime` 呼叫 `stepBattleSession` 推進對戰；能自行打完 | 已有 runtime 自動戰鬥，但尚不是自己的養成個體→編隊／策略→完整賽事 |

以上是本輪讀取實際 source 與本專案既有 ROM／影片研究的盤點。本輪沒有重新播放兩段 bilibili 影片，也沒有把影片中的可見動作當成其內部公式證明。戰鬥仍用預設 ROM 隊伍及目前 match seed 邊界；這次沒有更換它的 RNG 或重寫戰鬥。

## A 仍需完成的生成鏈

1. Gate `0210D1A4` 的場景變體生產：已看到遊戲時間、Gate world vector、固定點旋轉／正規化／dot sign；尚未把同一 Gate 的原始位置與整條選擇結果閉合。因此不能用單一時刻門檻或固定 dayFieldId 替代。
2. `0211A568` 季節候選、候選索引去重／重試、特殊物種、返回野生個體與追加同種的完整選擇。
3. `02062100` 不只HP：特徵、B6命名、11項能力各自消耗不同channel。`02062C28` 還會用C5及可變次數C4處理後續資料。只略去非畫面欄位，仍會改變後續位置抽樣。
4. Actor／AI初始化與位置必須按原順序執行；`0211B1AC..0211B2AC` 的同種配置另外消耗B2/B3。既有15個初始位置比對只截止在每隻位置初始化返回，沒有涵蓋這個階段。
5. 為既有 Hunt owner 接入已核對的功能性地形／方向資料供應及完整生成，使用 app-owned RNG，最後比較整批個體與生成後全部channel狀態。正常路徑不能載入固定重播個體或直接塞入 decoded map。

以上尚未形成可替换現行 `createHuntWorld` 的完整輸入／輸出鏈。`normalSpawnRuntimeBound=false`、`normalEntryCapturePlayable=false` 保留。完成A後還有B的正常AI／工具／動畫，以及C的正常手機捕獲返家驗收；此輪不宣告A、B或C完成。

## 保存範圍與證據界線

保存完整channel狀態是本次已授權工作包A的2026保存邊界，不代表已證明原作 DS battery save 也保存這兩個陣列。原作 load 另有 `0206AD6C` 從結構+0C呼叫 seeder 的路徑，其寫入／載入語意仍需追蹤。此差異在 [v4保存合約](../contracts/championship/championship-save-envelope.v4.json) 中明示。

- [CPU receipt](GAMEPLAY_RNG_CLOCK_CPU_CHECK_2026-09-06.json)
- [測試](../../tests/championship-gameplay-rng-lifecycle-cases.mjs)
- [驗證摘要](../reports/parity-audit/2026-09-06/gameplay-rng-lifecycle-validation.json)
- 前置來源：[正常原作入口10584次RNG與環境receipt](HUNT_ENTRY_ENVIRONMENT_REPLAY_2026-09-06.json)、[工作包A/B/C](HUNT_ENTRY_ENVIRONMENT_AND_COMPLETION_2026-09-06.md)、[兩段影片與目前玩法盤點](../reports/parity-audit/2026-09-06/TWO_VIDEO_GAMEPLAY_AND_CURRENT_PARITY_RECHECK.md)。
