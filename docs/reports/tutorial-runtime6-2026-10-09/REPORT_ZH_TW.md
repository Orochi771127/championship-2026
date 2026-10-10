# 互動教學第6切片：五語本機正常 onboarding



日期：2026-10-09。分支 handoff/dot-continuation-20261001；HEAD 1fb7d5fd21d3da47775d34ab0d3a1a95f6623972。未提交、推送或部署。



## 已完成的有界成果



en／ja／th／vi 已從真實新遊戲完整走完預覽鏈；繁中沿用已接受的 Slice5 完整預覽證據。此前置條件全部成立後，才開啟本機正常 URL 的新遊戲邀請。入口限 localhost、127.0.0.1、[::1]；沒有公開發布授權。



正常網址五語 zh-Hant／en／ja／th／vi 全數通過：LOGIN → 故事 → 馴獸師及夥伴命名 → 接受邀請 → 全部育成操作 → Gate16 → 兩次真實圈繩、拉HP至0及手收取 → 育成 → 既有 Battle 核心 → 育成 → completed。完成後重載 Continue 不再邀請。不是靠修改 checkpoint 跳到片段。



正常入口的五語文案使用正式新手教學稱呼，說明示範隊伍及結束後還原起始進度、保留名字。正常畫面沒有 preview 用詞；明示 review query 仍保留獨立的預覽標示。提示區位於共用 HUD 下方並預留高度，不覆蓋育成／Hunt／Battle；桌面縮放使用未縮放的排版高度，修正重複套用縮放造成的間距偏差。



沿用同一應用、router／screen stack、canonical save key、Pixi Application／ticker 及既有 Battle 核心。正常存檔 baseline 與教學 checkpoint 同鍵保存；教學的錢、物品、角色、收集、時間、RNG與戰績不污染 baseline。保存失敗留在隔離狀態，可重試。舊存檔 Continue 不注入邀請。



## 驗證與計數



- 最終單次去重 node --test：48個檔案、352／352測項、0失敗。未累加前幾切片、重跑結果或另跑的2項測試。

- 五語正常 URL 完整鏈：5條皆PASS。360或390×844，DPR2，隔離 Chrome context；全程 baseline內容一致、單canvas、零pageerror。

- 五語正常分支：20個案例皆PASS。每語各1個真實新遊戲略過、1個接受後主動結束，皆驗證保存失敗／重試及重載不重播；另各2個明示受控的舊v1存檔（無cursor／cursor0），驗證不注入邀請。

- 五語版面：5個案例各測360×800及1280×720，全部PASS。HUD→提示列→內容位置正確，沒有橫向溢出；按鈕排版高度至少44px。桌面既有portrait frame可縮放整體畫面，此數值不是物理裝置尺寸宣稱。

- 每語完整鏈均驗證邀請重載／接受保存失敗、清理中重載、Hunt拉繩重載／捕獲保存失敗，以及Battle開始／結束／completed保存失敗、running與已保存結果重載。英文另有錯籠放置重試；繁中另有治療保存失敗。

- 真實 Battle 本輪結果為 TEAM_ZERO_AHEAD（5語）。中途重載重用原entry seed，結果保存後直接恢復原結果；沒有強制勝利或為了勝利重抽。



完整資料見 [VALIDATION.json](VALIDATION.json)。腳本、逐步回條和PNG保存在 `R:\Projects\Championship2026\tutorial-runtime6-20261009`，正常流程在 `normal` 子目錄。4條新預覽鏈及1條沿用的繁中預覽，與上述正常入口驗證分開列示。



## 修正與未完成邊界



正常日文提示文字換行觸發畫布resize時，原取消處理會在UI沒有持有指標時仍取消原生控制，造成自動示範卡住。修正為只取消自己持有的使用者手勢；新增既有Hunt腳本回歸在修正前失敗、修正後通過，並以修正後版本重跑全部五語正常完整鏈。此為網頁輸入所有權修正，沒有改寫捕獲判定或原版證據。



首次正常繁中流程的射擊測試沿用截圖前座標並瞬間click，未推進而逾時；改為截圖後即時取樣、依畫面提示按住目標。受控診斷與之後五語完整重跑分開保存，不把診斷 checkpoint 當全鏈證据。另一次邀請重載比較因 autosave metadata revision 更新而失敗，改為分別核對玩法baseline與checkpoint。失敗回條未刪除。



原版 native loss/draw 到達性仍 UNKNOWN_REQUIRES_TRACE；web安全結束仍是 Owner-approved adaptation。原版完整 RNG 順序、逐幀差分、phase3/5完整roster parity、physical device、最終美術／權利／商業與公開發布驗收均未宣稱完成。



## 安全與交接



保留協作者未提交修改、production美術、styles.css、五語共用字典及brandTerms。僅保存本任務必要before副本及回條；沒有整批複製、刪除或玩家存檔操作。沿用既有8766服務、PID38660；未開新伺服器，沒有checkout／reset／merge／commit／push／部署。



Library官方遠端保存嘗試1次，回報 `Library prepare_uploads is not available`，6個檔案均未取得Library ID；parent尚未看過本輪本機PNG。helper共啟動2次：第一次因我誤填新檔命名欄位，在本機參數檢查即被拒絕、未呼叫遠端；移除該欄位後才進行唯一遠端嘗試。未繞過或改用替代上傳。額度只讀查詢，不使用重置、購買或自動儲值。
