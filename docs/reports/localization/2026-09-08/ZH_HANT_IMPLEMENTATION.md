# 全遊戲繁體中文顯示整合

日期：2026-09-08。Owner 指示：「全遊戲都給我翻譯成中文」。

本階段完成目前已實作玩家畫面的繁體中文整合。翻譯屬於 `PRODUCT_AUTHORED`，原始資料仍保留日文、原作 record index 與證據標記。這項完成狀態只描述文字顯示，不改變各 gameplay vertical slice 的完成度。

## 工作樹基準

- 正式 repository：`R:\Projects\Championship2026\championship-2026`。
- 分支：`main`；HEAD：`d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。
- 開始前已有大量未提交修改。沿用當時的 runtime、UI 與翻譯資料，不覆寫其他工作，不修改原始 catalogs 或遊戲規則。
- 已讀取根 AGENTS、README、Owner Direction、Architecture、Current Product Status、Dependency Matrix、Blocker Ledger 與相關 presentation contracts。

## 已完成範圍

| 範圍 | 處理 |
|---|---|
| 啟動畫面 | 頁面語言 `zh-Hant`、標題、開始／繼續按鈕、載入與啟動失敗訊息 |
| 育成 | 共享狀態列、季節、工具列、兩組選單、生命值／技力、儲存狀態、所在地、無障礙標籤 |
| 夥伴名單 | 欄位標籤、物種名稱、未確認欄位說明；自訂暱稱保留大小寫與原文 |
| 圖鑑 | 216 個正式物種名稱；8 個蛋 identity 的中文類別名稱，不新增圖鑑欄位或揭露未登錄名稱 |
| 說明 | 84 個條目，保留 16 headings + 68 topics 與原作順序；每個可選主題的內文均有翻譯 |
| 賽程與對戰 | 62 筆賽事名稱與說明；正常年曆仍列 61 筆；報名費、獎金、結算、結果與無障礙文字 |
| 商店 | 全部 118 筆商品：4 育成用品、49 狩獵商品、30 外掛、35 設施；依同一 productItemId／shopRecordIndex 顯示中文名稱 |
| 設施 | 名稱、效果、格位標籤、放置／移除結果與錯誤訊息 |
| 狩獵 | 傳送門、整備、工具／外掛、耐久／數量、場地、結果、記憶卡、放生確認、儲存失敗 |
| 初始自動名字 | 原作初始命名函式 25 個 variant 對應 24 個不重複名字的中文顯示別名；原始個體 name 不改寫 |

沿用 `src/championship/text/uiText.js`、`catalogs.zhHant.js` 與 `zhHant.js`。畫面與現有 presentation source 消費這些資料。未加入 DOM 全頁替換 observer、router、store、save key、renderer 或 ticker。

`G` 保留為原作容量單位；α／β／γ 與目的地代碼保留其識別用途。未確認玩法欄位仍以橫線／未知標記呈現。開發者專用診斷、原始證據識別碼與 console 技術訊息不當作玩家翻譯詞彙。

狩獵結果頁只在使用者實際改名後發出既有改名 intent，避免只是顯示中文預設名稱便在返回時改寫記憶卡個體。放生按鈕保持原始 key；圖鑑保持原始解鎖與註冊判斷。

## 驗證

- 中文化 focused tests：**19/19 PASS**。包含所有物種／說明／賽事對應、118 筆商品的實際 DOM 輸出及購買參數、圖鑑隱藏內容、暱稱、失敗／放生文字與不可變輸入。
- 完整 regression：`node --test --test-concurrency=2 tests/*.mjs`，**1339/1339 PASS**，0 fail／skip。
- 修改的 JavaScript 語法檢查通過；`git diff --check` exit 0。
- 瀏覽器正常路徑：開始遊戲、管理／系統選單、馴獸師、夥伴名單、賽程、說明、商店分類、圖鑑與未登錄詳情、設施、Gate → Loadout → Hunt → Home、Save → 真實 reload → Continue。
- 對戰選單經正常路徑檢查；當日無可參加賽事。對戰費用、結算與結果的動態文字由 focused DOM 與既有 regression 驗證，本次未聲稱完成正常對戰全流程的視覺驗收。
- 育成與狩獵檢查 360×800、390×844、393×852、412×915、430×932 viewport 設定；桌面 Browser 對 393 設定實際回報 **394×852**，因此不將此項列為精確 393 px 驗收。所有實際 viewport 的 document scroll width／height 均未超出畫面；育成與狩獵各保持一個 canvas。
- 其他文字密集畫面檢查 360 或 390 px，測試期間未見 browser error log。這是桌面瀏覽器的手機尺寸檢查，沒有宣稱實體手機 QA。
- 舊 `test:browser` 腳本仍有「育成頁內 8 個 disabled shell」的歷史假設，與目前共享工具列不符；本次未修改或宣稱該歷史腳本通過，改以目前正常畫面作上述驗證。

## 驗證紀錄

本機證據目錄：

`C:\Users\USER\.codex\visualizations\2026\09\08\01a08136-00af-79c2-8bc7-80329ca8244d\localization`

- `localization-focused.log`：19/19。
- `regression-accepted.log`：1339/1339。
- `browser-evidence.json`：各畫面 DOM、viewport 實測尺寸、canvas 數量。
- `diff-check.log`：Git whitespace 檢查。
- `git-status-before.txt`／`git-status-after.txt`：共享工作樹背景。

沒有 commit、push、merge 或 deploy。正式本機入口 `http://127.0.0.1:8732/championship.html` 已回應 200，並確認包含繁中標題及 `lang="zh-Hant"`。既有遊戲視窗需重新整理才能載入新的模組。
