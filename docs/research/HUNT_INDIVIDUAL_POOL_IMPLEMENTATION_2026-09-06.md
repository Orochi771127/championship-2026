# Hunt A：候選與個體池實作／原作 CPU 比對

狀態：**A 的子項已實作、原作 CPU 比對通過；A 一般入口交付仍未完成，B／C 未驗收。**

本輪正式專案及 Git root 為 `R:/Projects/Championship2026/championship-2026`，branch `main`，HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。初始 cwd 為上層工作區；開始時449筆 dirty entries，均保留。本輪依既有 Owner 授權開工，使用 engineering:debug 從第一筆分歧查到原作指令。沒有新增 router、store、save key、renderer 或 ticker。

## 一般入口的目標

維持育成場景 → 原作 Hunt／Gate 選擇層級 → 地區與裝備確認 → 狩獵場景。9:16 調整顯示排列與觸控呈現，已驗證的選項、條件、操作與結果仍保留。這裡的 Gate01 驗收指 Grass／`field_hm01` 系列，不是以目前 alphabetic Gate catalog 的第一個按鈕替代原作場景身份。

一般入口應由當次 app 狀態與延續 RNG 生成野生個體，再由正常 Hunt owner 推動 AI／工具／捕獲。現在的 `beginHunt` 仍呼叫 prototype `createHuntWorld`；這份報告沒有把新函式誤列為已掛入一般入口。没有正常入口瀏覽器捕獲驗收，也没有新入口畫面交付。

## 原作證據與新實作

先查 championship-evidence MCP 的 `02062100`。返回的歷史檔案部分屬不同 overlay 的同位址用途，未當成此次 OVL0 生成的證明。實際依據是指定 YDIJ ROM 的反組譯、原 CPU 執行、既有真實觸控入口 receipt，以及以下可重跑的比較。

| 部分 | 原作範圍 | 這次完成 |
| --- | --- | --- |
| 候選名單 | OVL0 `0211B8E4..0211BA30` | 使用季節表權重、地區物種表首次匹配與修正 byte；權重扣除 `byte >>> 1`，最低0；保持順序及重複候選 |
| 整批選取 | OVL0 `0211A768..0211AA44` | B4候選索引、重複索引重試、100次門檻、species19的B2條件、追加同種個體及增加目標數量 |
| 個體建構 | ARM9 `02062100` | 初始化明確寫入欄位、性格、5個UTF-16單位命名、HP／TP、其餘9項能力及上下界／rungs、AI候選來源 |
| 建構後更新 | ARM9 `02062C28` | C5欄位更新、C4前代路徑、限制物種重試與11次上限、generation6／species217特殊分支 |
| 特殊候選 | OVL0 `0211A7EC..0211A874` | 已由入口挑出的既有紀錄保留name／trait、跳過B5／B6抽樣、寫入tag2；只首次選中使用特殊建構 |

程式：

- [nativeHuntIndividual.js](../../src/championship/hunt/capture/nativeHuntIndividual.js)
- [nativeHuntIndividualPool.js](../../src/championship/hunt/capture/nativeHuntIndividualPool.js)
- [原 CPU oracle](../../scripts/research/check-hunt-individual-pool-cpu.py)
- [focused tests](../../tests/championship-hunt-individual-pool-cases.mjs)
- [CPU receipt](HUNT_INDIVIDUAL_POOL_CPU_CHECK_2026-09-06.json)

`fields` 使用已證實寫入位置的中性名稱，不把所有未知 bytes 或 padding 當0。窄欄位另有 `narrowFields`。這是功能投影，不是完整 ROM record，也還不是已接通的玩家育成／戰鬥存檔 profile。既有 `capturedVitals` 仍只持久保存它原本允許的欄位。

## 比對中修正的實際差異

1. 原作24格去重表的初值是 `[-1, 0, …, 0]`，不是24個 `-1`。追加個體不寫該格，因此留下的0會參與後續候選索引去重。首次移植在RNG第109次出現分歧；核對 OVL0 `02128280` 後修正，整批順序與217個channel結束狀態吻合。
2. 建構後 `02062C28` 必須執行。舊 `trace-hunt-live-encounter.py` 明確跳過這個函式，只能支持當時的有限HP主張；本次oracle不跳過它，不能沿用舊236次抽樣作為完整個體池結束狀態。
3. 原作attribute輸入存在4；性格override可為8。僅允許常見範圍會錯誤拒絕合法個體。本次使用真實species資料及受控特殊候選實際執行確認。
4. 候選不只是固定權重重複。地區表的修正 byte 會減少出現次數；目前只確認此讀取／運算，byte的完整writer／持久生命週期仍待入口供應端閉合，未自行命名為捕獲次數。

## 證據分級與驗證

| CPU案例 | 個體數 | 個體池RNG呼叫數 | 證據邊界 |
| --- | ---: | ---: | --- |
| observed-entry | 15 | 270 | 使用真實Gate入口的RNG起點與已載入context；原CPU結束217-channel snapshot等於真實入口的 `0211AA44`；species／HP亦相等 |
| continued-after-pool | 17 | 301 | 從上一批結束RNG繼續，用同一場景context執行；是受控第二批CPU案例，不是第二次實機重入 |
| controlled-released-candidate | 15 | 266 | 明確注入合法格式特殊候選做分支測試；不是正常遊戲生成／觸控歷史證明 |
| controlled-depleted-released | 15 | 376 | 受控修正byte耗盡一般候選，仍有特殊候選；確認100次重試門檻及不能錯誤拒絕此輸入，並不主張此byte狀態已由正常玩法到達 |

另以原 CPU 逐一執行228種species的constructor及post-update，對照明確寫入欄位、名字、窄欄位、每次RNG channel／結果及完整終點。6組候選修正案例包含原狀態、0、1、2、4、254，確認奇數右移及耗盡權重的行為。

JS自己執行條件與選取，測試逐次核對它主動要求的channel；沒有用錄好的channel排程驅動程式，也沒有把15／17隻輸出放入runtime。輸入facts及CPU結果只在研究receipt／測試中使用，`runtimeEligible:false`；原ROM、RAM、ATR／ESC及素材未複製進production。新模組沒有import這份receipt。

Focused 20/20；最終全量serial regression 971/971，53.709秒，fail／skip／todo均為0。git diff --check與新檔UTF-8/LF／空白檢查通過；CPU receipt重建SHA-256完全相同。測試結果另見[本輪 validation receipt](../reports/parity-audit/2026-09-06/hunt-individual-pool-validation.json)；本報告的CPU通過不代替一般入口或手機觸控驗收。

## A 尚缺的明確接線

1. Gate確認的實際場景變體，以及季節表、地區修正 byte 和放生紀錄的正式來源／生命週期；不能把觀察到的index1、13:00或全0修正表設成所有入口的固定值。
2. 帶入既有個體的分支（player+24==1）及其紀錄寫入尚未移植；新個體池對 `carried` 非null明確拒絕，不默默丟失既有個體。
3. `0210D240` AI建構抽樣、`0210D5DC`個體參數初始化、既有位置函式與同種配置 `0211B1AC..0211B2AC` 的完整組合。原作AI建構的3次抽樣在每隻位置抽樣之前，不能把全部位置先做完才補AI。
4. 經contract約束的功能地形／方向資料供應與正常 `beginHunt → huntWorld → huntRuntime`；已選field identity必須同時供碰撞與presentation。原作研究grid不能直接經art loader進shipping runtime。
5. 正常入口兩組合法狀態、重入及Save／Continue驗收。這些未通過前維持 `normalSpawnRuntimeBound:false`、`huntGenerationConsumesGameplayRng:false`、`normalEntryCapturePlayable:false`。

接續應先完成A剩餘生成／資料供應／正常接線，A通過後再做B正常AI／工具／階段，最後C Gate01捕獲返家。Owner授權已涵蓋這個順序，沒有新增許可門檻。本次只算A子項進度。
