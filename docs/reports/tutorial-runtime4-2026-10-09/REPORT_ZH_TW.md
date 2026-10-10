# Championship 教學 Slice4 交接 — 2026-10-09

已完成授權的 Gate16 → 固定 species13／21 → 第二次捕捉 → 返回牧場提示。這是本機限定預覽的有界里程碑；完整教學與正常新手入口仍未開放，Battle 未開始。

## 驗證結果

- 31 個相關測試檔，220/220 通過。包含一般 Gate/Hunt、工具、存檔、育成與新教學；6 個新增 Hunt 測試。
- 39 個 Hunt／Gate／返回牧場語意存檔階段逐一續讀，再各自完成剩餘流程至 `raising-battle-ready`。
- Chrome 隔離情境，繁中 390×844、DPR2：從新遊戲、育成、Gate16、兩次實際圈繩／拉繩至 HP0／手掌收卡，完整返回牧場提示。主流程零 pageerror、正常基線不變、單一 canvas。
- 主流程含 Hunt 首次拉繩時重新整理續讀、育成治療與第一次捕捉保存失敗後透過 UI 重試；錯誤餌料位置、空白點擊、射擊未命中均不推進。
- 受控測試另涵蓋 Gate 保存失敗、第二次捕捉／返回牧場／Hunt 中途退出保存失敗、重複／過期輸入拒絕，以及目標不在鏡頭時不完成移動鏡頭步驟。
- 正常新遊戲390×844與續讀360×800通過，舊版開場保持、正常教學 eligibility=false。Hunt 中途結束預覽已另以正常呈現的 UI 驗證，回牧場且基線不變。
- 最後呈現文案調整後有23項聚焦回歸通過；其後退出修復已包含在最終220項中。不是把重跑計入額外測試數。
- 沒有進行全遊戲長時間測試、實體裝置驗收、發布或部署。

## 實作與根因修復

1. Gate16 專用身份，原始 field32 對應 `field_hm00_01`，未借用普通 Gate0。一般 Gate0..15 與普通場景目錄不變；重用既有 HM00 生產美術，未修改可走網格迎合圖片。
2. 固定原生 species13、21，以既有個體建構器、Hunt runtime、actor、圈繩、拉繩 HP、射擊暈眩和手掌收卡控制器運作。僅加入原教學外層 control state5 的有界分支，不另建場景權威或 ticker。
3. demo 使用隔離的正常初始道具副本。只保存既有 checkpoint；不把示範卡片寫入家園，不改玩家金錢、獎勵、圖鑑、正常 RNG／Hunt history 或存檔鍵。
4. 重載時牧場工具列收到 ROPE 而拋出 `UNKNOWN_TUTORIAL_TOOL`：已限制牧場工具列只處理牧場階段。另補齊 main.js 已使用但漏匯入的 uiText，避免錯誤處理掩蓋真正錯誤。
5. 一般 Gate 原本同步確認被教學 async 包装延後：已保留一般同步返回，教學才等待非同步準備。
6. 中途結束 Hunt 預覽時只回復內部牧場狀態、漏通知畫面：補發既有畫面通知並驗證失敗重試。未另建導航。
7. 圈繩 UI 測試先前每個 mousemove 另加延遲，超出20格辨識器時間窗；改為連續真實 pointer 操作。未放寬幾何判定、未用直接成功指令取代 UI。
8. Gate 頁原本固定「16」及轉動地球提示；專用教學頁現依實際數量顯示，並使用現有「選擇目的地／教學關卡」字典鍵。未改寫五語字典、底欄 CSS、觸控尺寸或美術。

## 證據與限制

- 原始 VM：`tutorial-phase2-20261009/private/gate-tutorial-script.asm`、`hunt-tutorial-script.asm`、`hunt-special-setup-observed.json`，以及 `_archive/lifecycle-two-stage-2026-09-09/tutorial-script.asm` 返回段02127AB6。
- OVL0 0211AAB0 固定個體建構；0210CA24..0210D1AC 教學 control state5；0211E564 以負傷害回復HP、解綁並發3B。裝備使用已存原版 phase2 checkpoint 的 category1/2/4 item0觀察。來源細節與功能資料保存在本任務 `private/`，未上傳原版畫面或 ROM。
- field32 功能 terrain/direction 資料循現有 offline ATR/ESC builder 產生，runtime 未 import research、未載入私有 archive URL；無新增原版圖像／模型 payload。
- demo 圈繩指標軌跡為網頁呈現，仍由既有辨識器判斷；不宣稱原機 Bezier、逐幀或全部 RNG 呼叫順序一致。裝備初始數量沿用現有隔離副本，未宣稱完整原生數量 trace。
- 返回牧場僅完成1553/1554提示與保存邊界；未宣稱 phase3 完整 roster／actor 原版對照。
- 特殊進化 code1、Battle 敗／平手維持 UNKNOWN；完整19狀態／逐幀差異、實體裝置、Hunt完整五語UI仍未完成。
- 截圖為既有生產美術的網頁實際呈現，保留「教學預覽」控制列。其覆蓋上方HUD是現有本機預覽呈現，未宣稱最終新手UX／商業發布驗收。

## 可檢視成品

下列五張原生 PNG 來自完整 UI 流程實際保存的 checkpoint，於獨立乾淨情境以正常呈現續讀後拍攝（390×844、DPR2）。沒有圖片合成、CSS隱藏或 research 原版圖。

- `CHAMPIONSHIP_TUTORIAL4_gate_select_20261009.png`：Gate16 專用場地列表。
- `CHAMPIONSHIP_TUTORIAL4_hunt_first_enclose_20261009.png`：第一隻圈繩練習。
- `CHAMPIONSHIP_TUTORIAL4_hunt_food_place_20261009.png`：第二隻餌料落點引導。
- `CHAMPIONSHIP_TUTORIAL4_hunt_shot_hit_20261009.png`：第二隻射擊練習。
- `CHAMPIONSHIP_TUTORIAL4_raising_after_hunt_20261009.png`：返回牧場提示。

完整 UI 流程紀錄：`R:\Projects\Championship2026\tutorial-runtime4-20261009/FULL_RAISING_HUNT_BROWSER_RESULT.json`；正常入口：`BROWSER_RESULT.json`；退出：`HUNT_EXIT_BROWSER.json`。先前失敗檔案保留為診斷歷史，不能取代最終 PASS 紀錄。

## 安全狀態與下一步

分支 `handoff/dot-continuation-20261001`；HEAD `1fb7d5fd21d3da47775d34ab0d3a1a95f6623972`。cached origin/main `7487731ff690506a56027d74ad5e105c632e9d67`；origin/main...HEAD仍為23/2（未fetch）。開始1089條、結束1101條 porcelain紀錄，包含協作者既有大量未提交改動。

既有伺服器127.0.0.1:8766／PID38660保留。所有瀏覽器測試均為隔離、非持久化context；未碰玩家存檔。未執行commit/push/merge/checkout/reset/delete/deploy，未開新伺服器、未使用重置、點數或自動儲值。

本任務只保存18個程式／契約／測試檔的必要前版、變更清單與差異；沒有複製整個專案。安全紀錄、SHA與差異：`SAFETY_RECEIPT.json`、`RUNTIME4_FILES.json`、`RUNTIME4_OWNED_DIFF.patch`。共享 Master／其他代理狀態檔未覆寫。

額度最近讀值：Codex週窗口使用47%、剩53%；未觸及上限，無重置操作。

下一個開發範圍是既有 Battle record61/mode4/species189/212/207 與 completed。先讀本報告及契約 runtimeSlice4，再依原始證據接入；正常 onboarding 需等完整教學 UI 驗收才開。不要把本里程碑當作 Battle／全部教學完成，也不要因此發布。

## 本次 Library 傳遞阻塞

已用當前 Library skill 的官方 prepared-upload 流程，單次提交1份報告＋5張原生PNG；本機執行回報 `library upload failed: Library prepare_uploads is not available`，exit code 1。未取得成功建立回覆或 Library ID；不能宣稱已交付。未反覆重試、未改為直接上傳、未猜下載／上傳URL或繞過權限。

全部成品已存在本機上述任務目錄。`LIBRARY_DELIVERY_BLOCKER.json` 保存確切阻塞；由 parent 協調可用的原生傳檔能力後續交接，不需使用者搬整批。當前 checkpoint 安全，可直接續接；Battle 尚未開始。
