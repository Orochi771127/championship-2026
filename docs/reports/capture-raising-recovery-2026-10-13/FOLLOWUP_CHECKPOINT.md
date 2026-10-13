# 2026-10-13 未解重啟的診斷續批檢查點

工作樹 `R:/Projects/Championship2026/capture-raising-recovery-20261013`，分支 `fix/capture-raising-recovery-20261013`，基底 `319c90c6ce7cfbdd1543d9544b1537589bf12b54`。使用者 main 未移動。

Parent 已獨立確認 CI 38361349574／Pages 38361349551 success，本輪不重查。已完成 live 核對：build ID `14ecc85322b79dc344ca596b3b4531d4244129bcf8b11bb15aa998f7197fe913`，commit 319c90c6；manifest 計算 hash 與實際 index.html／main-3XCZQV6L.js bytes 均一致（本機 `.tmp/live-release-319c90c6.json`）。

目前沒有新的確定重啟根因。既有 console 診斷無法跨 document／Safari web-content 重啟保留，正在補最多 32 筆／8 KiB 的本機技術事件 ring；獨立 diagnostic key，不改遊戲存檔 schema，不存玩家資料、網址參數或原始錯誤訊息，提供 TITLE 設定→資料與帳號下載。記錄 BOOT/navigation type、pagehide/pageshow persisted、WebGL context、載入失敗及明確 returnToTitle/reload 来源；缺少 pagehide 只標未觀察到，不推論 OOM。

不另開代理、不重跑美術、不做廣泛技術債或無限壓測。已完成診斷／設定／storage guard／asset ownership 50 個針對性測試；隔離 Chromium 實際下載、跨 document reload、受控 Raising 503 與 Pixi context lost/restored 三案例通過。正式 build 與實機 Safari 尚未驗收。

已整合 parent 的 docs-only `a660408cc0a739a2a03a0e2a8534e0bdf534667a`。本輪不修改 parent 擁有的 `docs/TECH_DEBT_REGISTER.md` 或 `docs/CURRENT_PRODUCT_STATUS.md`。

已讀 Owner `IMG_3929.jpeg`：洞穴說明 modal 上方可見第二隻角色橘色片段。新增正常 runtime 可見物種測試先失敗：escape 90 frames 後 `hunt-escape-explain` 仍回傳 species-021。接續最小 scripted actor 隱藏修復，涵蓋 message 1544/1545、return frame 180/181 及 checkpoint 重載；不改普通 Hunt AI、地圖、美術或存檔 schema。

洞穴修復與診斷邊界已完成自審，62 個相關測試通過。診斷可讀不可寫 storage 的記憶體事件保留亦先 red 後 green。正式產物的三個診斷下載／reload／context 案例與教學兩句說明＋重載＋回來可見性 browser case 均通過。正式 build 共 9336 檔案，build ID `45c4f2e6c7a1447d34f710374fdbe0fee26c8e2e51515ac517dc91b3537c200d`；未改資產 bytes。原始 HTML 269 preload 不是正式站請求數。

詳見 [續批報告](FOLLOWUP_REPORT_ZH_TW.md)，包含 TITLE→設定→資料與帳號→下載本機診斷的 Owner 操作與證據限制。Safari 重啟／舊大型捕獲無法 Continue 的根因仍未確認；實機驗收未完成。不重查 parent 已成功的 a660408c 流程，不做香港繁中或 Logo。

發布前檢查完成：必要 aggregate `test:ci` **1735/1735 PASS**，formal build／validate **9336 files PASS**，正式產物兩個 scoped browser script PASS、diff／報告連結檢查 PASS，12 個 Battle optional audio 既有案例 PASS。第一次 aggregate 的四個失敗來自測試 VM 未提供新增診斷相依，一個失敗來自 sandbox loopback EACCES；未當作產品根因。補 fixture／允許既有測試 loopback 後全部通過。按既有授權提交、非強制推送及發布；本輪 exact SHA 的 CI／Pages／live bytes 結果由最終交接訊息提供。
