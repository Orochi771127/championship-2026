# 育成生命週期整合階段：進化、排泄、睡眠與換日

> 2026-09-09 續作更新：以下為前一輪快照；賽程、晨間訊息、治療、Home 對照與開場現況請以 [兩階段續作紀錄](LIFECYCLE_OPENING_TWO_STAGE_2026-09-09.md) 為準。整體仍為 PARTIAL。


開始 2026-09-08，更新 2026-09-09。Repo：`R:\Projects\Championship2026\championship-2026`；branch `main`；HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。父資料夾不是 Git root。保留開工前已有的大量共用工作樹變更。

Owner 要求：「遊戲中進化內容,進化畫面,進化條件都完成了嗎?你查ROM跟影片將進化,包含排泄物生成的完整流程、睡眠與隔夜成長／食物處理，以及原作完整換日過場 都在一個階段完成」。本文件將這些項目放在同一階段追蹤。

**狀態：主要可玩流程已接通；原作完整階段仍開啟。** 不以數值測試通過代替全流程、全部原作分支、聲音或手機驗收。約束見 [RAISING_LIFECYCLE_STAGE.v1](../contracts/championship/RAISING_LIFECYCLE_STAGE.v1.json)。

## 實作前的缺口與目前結果

先前有孵化、個體資料、照顧與部分成長 helper；育成 caller 並未完整連接普通進化、壽命分支、睡眠、排泄及夜間結算。自然換日只有換日期，原作的日曆停留與確認也缺少。

現在用原有 app-owned actors、R2 calendar、217-channel RNG、v5 save 和同一個 Pixi ticker 連接下列流程：

| 項目 | 目前已接入 | 證據範圍 |
|---|---|---|
| 進化條件 | 179 個規則群內的 477 條有序規則；26 個條件；等級、容量、血統、延長壽命與分支順序 | 2,736 次原版 CPU 呼叫，逐一比對 profile、結果、actor fields 和 RNG |
| 訓練與進化 | 36 種設施的三選一權重程式；28 類 writer；同設施放回不重複訓練；完成後進化判定與受傷風險 | 672 組 writer；6 組原 CPU popup phase timeline；正常拖放測試 |
| 進化／重生 | 聚焦、放大、新舊剪影交替、新形態、返回；第 272 幀才提交形態；同個體 ID、圖鑑與分支記錄 | 原作實機自然進化、3 組 CPU phase timeline、456 組重生選擇 |
| 消失 | 無可用重生目標時走獨立 state 21，效果結束才移除育成 membership；續玩不復活已移除的 starter | 原指令分支、30 tick 效果 metadata、165 幀 handler 對照；受控存檔整合測試 |
| 排泄 | 累積與 idle 判定、30 幀生成、容量與 40 個全域槽位、生成失敗的壓力與累積值處理、髒污訊號、清理與持久化 | live allocator 呼叫；216 組 allocator；原 hit box `[-6,-19,10,5]` |
| 睡眠 | 疲勞門檻、原睡眠長度、提早叫醒、正常醒來、次晨等待及回復；危急狀態與壽命分支 | 880 組 entry/exit 與 880 組 morning writer |
| 夜間成長／食物 | 先結算當日剩餘分鐘，再結算夜間 540 分鐘；依設施 resident 順序做兩輪處理；食物消耗、腐敗、環境、同伴與設施效果 | 168 組有食物／同伴的 overnight 原 CPU；168 組 live-growth writer |
| 一般換日 | 管理選單的「是／否」→ 淡出 → 儲存 → 黑底日期與八日曆 → 點按確認 → 07:00 育成 | 日文 ROM 的自然換日、影片人工選單片段、正常瀏覽器操作；另有 1,024 組原 CPU 日曆投影 |

數值 catalog 只包含實作消費的功能資料，沒有 ROM code、RAM、原始圖像或新加入的 ROM 音訊。進化背景、剪影處理、粒子、排泄物圖形與日曆表面由程式繪製。角色與場地延續已有的資產載入及權限狀態，沒有提高 shipping gate。

## 原作查證

ROM SHA-256：`8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`。私有輸入與影像在 `R:\Projects\Championship2026\_archive\raising-lifecycle-2026-09-08`，不放進產品輸出。

### ROM 控制流程

- OVL18 `02112734`：進化條件與有序規則。`021164E4`：重生或消失。
- OVL18 `02113C2C`／`0211459C`：訓練 writer；`021192A8`：拖放後的設施反應；`0211A0C4`／`02119B50`：訓練 entry、兩個交替提示及結束判定。原作有季節、等級、隨機修正與 MAX/MIN 的不同寫入規則。
- OVL18 `0211A338`：272 幀普通進化／重生。`0211C038`／`0211C778`：消失與效果更新；效果只在 phase 3 推進。`common/e001_ikusei.nanr` sequence 15 為 10 個 3 tick frame、raw mode 1。
- OVL18 `0211B6A4`：排泄第 30 幀呼叫配置器；`0210E380`：配置；`02121308`：hit test。效果期間的原 writer 與成功／失敗分支分開處理。
- OVL18 `02118240`／`021182B4`：睡眠進出；`0211CA00`：次晨；`02114A10`：成長；`0211BB38`：危急狀態。ARM9 `02084CA0` 是夜間兩輪處理。
- OVL1 `0210C028`／`0210C010`：日曆進入；`0210C0A4`：等待輸入；`0210C078`／`0210C05C`：確認後離開。`0210BC14` 與 ARM9 `020892B0` 產生當季八日的已登錄／未取得冠軍且未登錄數量。最終查證修正先前把勾選數誤作勝場、把另一欄誤作未參加的對應。
- ARM9 `020895DC`／`02089600`：賽程選項切換 player `+BC + index*8` 登錄旗標；OVL8 `0210D238` 寫入 `+C0 + index*8` 首次勝利。日曆先判登錄，才判未獲勝；不能拿歷史參加紀錄替代登錄。
- OVL8 `0210D344..0210D35C`：升級結果為 rank 4 時開啟大會 stage 1；`0210D3EC..0210D450` 的大會結果分支寫 stage 2/3 並清除相應 entry。ARM9 `02097434..020974A0` 切換一般／世界大會登錄。這些 writer 已找到，尚未與現有完整賽程及升級流程接合。

### 新增的原作實機追蹤

Observer 只透過手把、觸控與 frame 輸入操作原作，沒有 RAM mutation 命令。checkpoint 和截圖都留在私有 archive。

- `live01`：5,100 frames。記錄兩隻角色進入睡眠、兩次排泄配置，並從原 body 讀得清理 hit box。
- `live02`：續跑 2,400 frames。從晚間自然進入 **春季第 5 日的黑底日期與八日曆**，停留等待操作。
- `live03`：觸控日曆後回到第 5 日 07:00。底部文字是「バトルの エントリーじかんがきました。」（已到戰鬥登錄時間）。最終重新檢查截圖與 `mail_text_txt.dat` index 94 後，確認不是登錄容量增加。
- `live04`：續跑 8,500 frames。第 7,557 tick 進入壽命進化判定，之後記錄 272 次原進化 handler，目標 profile species index 29。
- `live05`：從同一 `calendar-ack.dst` 重跑，於第 7,520 tick 保存 before-evolution；以 `0211AFAC` hook 啟動每 5 幀截圖。可見聚焦、黑場、藍色進化背景、白色形態交替、綠色上升效果、新形態及返回原場地。`evolution-contact.png` 為私有人工檢查聯絡表。

### 影片

這次透過瀏覽器實際查看 [Bilibili 原作影片 BV13u411B7BK](https://www.bilibili.com/video/BV13u411B7BK/)，沒有下載影片。

- 約 431.739 秒：Day 6 13:00，手動 End Day 的 Yes/No。
- 約 433.503 秒：黑底 Saving；約 436 秒已回到 Day 7。
- 約 509.49 至 514.164 秒的片段存在剪接／日期跳動，畫面已出現進化通知，無法用這段證明完整進化過場。

影片剪接省略日曆不代表原作沒有日曆；本階段以原 ROM 可操作的完整流程補足這個缺口。

## 可重跑驗證與實際限制

CPU oracle：`scripts/research/check-raising-lifecycle-cpu.py`。輸出為 `docs/research/RAISING_LIFECYCLE_CPU_CHECK_2026-09-08.json` 與功能 catalog。原指令執行，但視覺、文字、音效、部分資源配置與硬體介面使用明列的 boundary stubs。Overnight 的地面位置、排泄成功與 food render/delete list 是邊界；waste oracle 的 initializer 是邊界；消失效果使用已解碼的 30 tick 完成訊號。這些不構成全 ROM、全部角色或音畫相同的證明。

另以 `scripts/research/check-raising-calendar-cpu.py` 執行 OVL1 `0210B7EC..0210BCCC`，輸出 `RAISING_CALENDAR_CPU_CHECK_2026-09-09.json`。1,024 組控制輸入比較日曆的登錄／未獲勝計數、stage 0..3、兩種 entry 旗標及倒數；包括超出四年週期的輸入，保留原 signed remainder，不把負數擅改為正數。這證明投影函式，沒有證明 app 已具備完整登錄與大會旗標來源；目前 app 的一般日曆使用既有勝場，尚未接入原作登錄選項。

晨間 entry 分支在 OVL18 `0210EB0C..0210EB88`：生日提示可先入列；季節第一日使用 season/year 提示，其他日以 RNG channel 213 決定隨機訊息或順序教學訊息。`0211DA04..0211DB64` 另外檢查已登錄賽程與 07:00–15:00 時段，發出 mail index 94。這些不是單純換日期後固定顯示一句話；原作 mail queue、教學游標、生日／贈禮效果尚未完整接入。

- `tests/championship-raising-lifecycle-cases.mjs`：CPU 數值、RNG、進化／消失／訓練時間線。
- `tests/championship-raising-lifecycle-app-cases.mjs`：正常孵化、跨設施訓練、同設施不重訓、餵食及多次換日到自動進化、同 ID 續玩、夜間場地物件續玩、清理，以及存檔失敗後重試；另有受控忽略照顧的 adult save 測試消失後不復活。
- `tests/championship-round2-clock-driver-cases.mjs`：原有時鐘暫停、自然換日及日曆確認後恢復。
- 本機 [逐幀視覺驗證頁](../../../tests/fixtures/championship-raising-lifecycle-review.html)：從真實 newGame / food / endDay 公開 command 走到進化，沒有直接塞入進化 actor 或 profile。測試自己的 memory storage，不讀寫玩家的瀏覽器存檔。使用相同 production scene；在 390×620 及 320×620 的 field host 驗證白色剪影、藍色背景、新形態與返回。DOM 可見紀錄：day 3、07:03、species 14 → 21、第 272 幀；1 canvas、0 asset failures。
- 正式 `championship.html` 已驗證手動換日的否／是、日曆停留、日曆確認、重新載入後 Continue。日曆遮罩不再露出原狀態列與工具列。

最終重點測試 **30/30**、完整 `npm test` **1,361/1,361** 通過，沒有失敗或跳過；`git diff --check` 與三支研究腳本的 Python 編譯檢查通過。CPU receipt 與功能 catalog 的 SHA-256 已重新核對。詳細統計與檢查紀錄見 [validation receipt](../reports/parity-audit/2026-09-09/raising-lifecycle-validation.json)。

## 同一階段尚未通過的部分

1. **原作賽程登錄、大會旗標與倒數版面。** 原 CPU 投影及原 writer 地址已查明；現有 app 尚未接通「賽程登錄／取消 → 到點入場 → 結果升級 → 大會進度」的完整持久化鏈。一般日曆不再把勝場誤畫為登錄數。不能由年份／季節臆造旗標，也不能把受控 CPU 旗標輸入說成正常遊玩已產生。
2. **晨間通知完整佇列。** 截圖證實「已到戰鬥登錄時間」；目前沒有把原作 mail queue、教學游標、生日／贈禮，以及劇情、賽程與解鎖通知的產生順序和效果接完。
3. **整個 Home 重建的逐步對照。** 個別 writer／handler 已驗證；原作重新建立 Home 時的位置與 RNG 消耗、所有例外路徑尚未做完整同輸入逐步比較。
4. **全部音畫及裝置驗收。** 一般進化的可見階段已實作並檢查，獨立繪製的效果幾何、完整訓練提示、聲音、全部形態配對與實體手機尚未全部驗收。新的屬性 writer 不代表所有畫面提示都完成。

這些仍屬本階段的未結案項目，不另外宣稱下一階段已開始。`fullOriginalStageComplete=false`；`shippingReady=false`。

## 發布檢查

本輪沒有 commit、push、merge、部署或改寫他人的成果。Pages build 的預檢仍被工作樹中已刪除的 tracked `src/data/championship/catalogs/entities.r1.json` 擋下；預檢在替換 output 之前失敗。此缺檔不由本階段恢復成舊的產品資料。新模組也仍未提交，不能把目前 dirty working tree 的本機運作視為 committed-tree 發布完成。
