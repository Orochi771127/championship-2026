# CODEX 自動分批修復交接 — 2026-09-13

> 同日續修：以下原批次數字保留歷史；最新內容見本文件末尾「同日續修」與 `docs/reports/tooling-parity-audit-2026-09-13/本階段續修驗證收據.json`。整階段仍未結案。

正式 repo：R:/Projects/Championship2026/championship-2026。branch main；基準 HEAD 08445ba4629aac5757f31b0c1e68fbf40e7966de。
Owner 已授權連續分批修復、ROM 查证和沿用美術包，不需逐小項再次詢問。本輪沒有 push／merge／deploy／rebase／reset，沒有修改其他專案。

## 已完成的 bounded repairs

- 狩獵：場景就緒前時計暫停、避免排隊 HUD 通知重掛場景；並行角色／地圖／特效下載；依攜帶工具縮小特效 bank；載入提示／工具禁用；載入中退出與重入；可選特效 503 降級。
- 名單：原作 ARM9 02088480 的 228 種 × 11 欄，另 50 組個體勝率原作算術／soft-float；接入生命／技力目前及上限、容量、能力、兩技能、場次／勝率、退化次數和繁中分類。family 選原作最低有效 bit。
- 馴獸師：OVL4 0210BB9C 的 40 組 CPU 收據；have 修為 rank capacity，非居民數；接頭銜／圖鑑完成度、戰績、階級、執照與設施格數。地圖／遊玩時間仍保留未知。
- 籠子：36 定義／108 native programs 與既有 writer 核對；修正過時 magnitudeParity，明列 NATIVE_PROFILE_TRAINING_COMMANDS_ONLY；overfill 未推定。36 項審查 CSV 同步。
- 戰鬥：實際截圖發現 await 素材期間畫布空白；補載入／失敗提示、並行素材和就緒回報。Chrome 以既有成年測試存檔走正常選單、隊伍、對戰、結果／獎金／戰績、返回牧場；測試刻意延遲素材並等待真正就緒才截圖。
- 商店圖的 imageEvidence 改讀既有 manifest 的 productionStatus，不再把授權像素衍生物標成 ORIGINAL_CREATED。

## 驗證

- npm test：1493/1493 PASS；npm run test:ci：1276/1276 PASS。
- tests/championship-hunt-loading-browser.cjs：PASS，含延遲、退出、重入、可選特效 503。
- tests/championship-owned-battle-browser.cjs：PASS，含延遲、HUD、結果分頁、返回。
- tests/championship-vs3-browser.cjs：CHAMPIONSHIP_VS3_ENCLOSURE_BROWSER_QA_PASS。
- 正常新遊戲回訪 17 份畫面紀錄；61 賽程與 68 說明點選；沒有 pageerror、巡覽失敗或橫向溢出。對戰／捕獲另由上述流程補驗，不把 17 份截圖算作所有狀態。
- 中途一項籠子身分測試仍斷言舊 UNKNOWN 標記，已同步為有範圍的已驗標記後重跑完整測試。
- 最終程式／測試檔 SHA-256：docs/reports/tooling-parity-audit-2026-09-13/修復驗證收據.json。
- 詳細 console／Chrome 收據：../tools/development-toolkit/reports/batch-repair-2026-09-13/。

## 未完成與續查入口

按 docs/reports/tooling-parity-audit-2026-09-13/分批修復進度.md 繼續。
完整正常新遊戲導覽仍未上線；原作接受／拒絕已確認在 OVL18 0210FC04 子狀態 7，但正常教程之後的事件、專用場地與清理尚未閉合，不能啟用推定的 35 步 predicates。
79 項狩獵裝備／外掛 icon 未補；36 籠子與 26 特效尚未逐項原作／正常瀏覽器視覺驗收。名單抗性圖及三操作、戰鬥四模式、自然育成到參賽等仍部分完成。fullOriginalParity=false、physicalDeviceAccepted=false。

## 研究工具與檔案

已用 Ghidra／pyghidra-mcp、ndspy、Capstone、Unicorn 和 py-desmume；沿用工程除錯、game-playtest、championship-art-production 與 pixijs-assets skills。
原有 Ghidra 專案仍被既有 server 鎖定，沒有刪除 lock 或終止其他服務；本輪使用獨立 ../tools/development-toolkit/research/ghidra-batch-20260913/championship.gpr，含 ARM9、OVL0、OVL18、OVL4、OVL10。
可重跑 CPU scripts：scripts/research/check-roster-ui-fields-cpu.py、check-roster-win-rate-cpu.py、check-tamer-ui-fields-cpu.py。新增 docs/research/ROSTER_*_2026-09-13、TAMER_*_2026-09-13、TUTORIAL_CHOICE_WRITERS_2026-09-13 收據。
原作 ROM／截圖／分析程式保留外部工具研究區；沒有新增 ROM 素材進 shipping runtime。

## 共享工作樹

本輪 22 個已追蹤程式／樣式／測試修改及新增兩個 browser scripts、三個 CPU scripts、研究／審查／交接文件皆為本輪工作，未 stage 或 commit。未改寫其他 Agent 的狀態 authority。繼續前重讀 git status 和上述收據，避免覆寫後來進場者的修改。

## 同日續修：載入取消、圖片使用與導覽缺漏

Owner 再次要求用 Skills／外掛處理未完部分並估算進度。已沿用 game-playtest、engineering debug、championship-art-production、pixijs-assets，以及 Evidence MCP、Ghidra／pyghidra-mcp、ndspy、Unicorn、py-desmume。沒有另開產品、另建存檔 authority 或啟動平行 Agent。

- `vs2Screens.js` 的狩獵載入等待可取消／30 秒逾時；取消會釋放串行掛載等待，過期結果自行釋放。`main.js` 在 Pixi attach 前及素材完成後檢查該次 signal，而不只看目前是否也是 HUNT_FIELD。
- 在既有 `pixiCharacterRuntimeBundle.js` 增加 `createPixiAssetScope`，仍用同一 Pixi Assets。已接角色、狩獵地圖及狩獵回饋 loader；延遲清理不能卸載另一畫面的圖片，失敗記錄允許新畫面重試。這不是全域新 loader 或新的渲染 bootstrap。底層所有 Pixi HTTP 請求的 abort 尚未全部實作。
- 正常瀏覽器驗證故意持續擋住前一次 manifest，先回牧場、再進狩獵，最後才放行舊下載；畫面／控制仍正常。另用受控時鐘驗 30 秒逾時、時間不扣及返回。正常捕獲與對戰結算返回也通過。
- 導覽原表少 37 則文字。新增 72 則資料範圍、37 則獨立繁中文案、36 個原作 selector CPU 收據；有 14 則仍僅文字庫證據。未把文案 coverage 當成正常教學實作。保留舊 cursor，generator 和 catalog 增加中間片段標示。
- 原作 55 個 tutorial native wrappers 與 44 個 helpers 已查；三段 VM／專用 controller 後續入口在 `docs/research/TUTORIAL_MESSAGE_COVERAGE_2026-09-13.md`。新 probe scripts 都只輸出數值／來源 metadata，未拷貝原作程式或圖像。
- 名單依 ARM9 `0208890C` 的讀取順序接上熱、寒、雷、光、闇五段抗性圖，沿用原作 78 格比例與最後一段補足規則；pyghidra-mcp 已重新反編譯同一函式，焦點測試覆蓋順序及總格數。
- 更新原有 modulepreload 及 20 個既定建置檔案 hash，保持 LF canonical bytes；建置清單沒有擴大，沒有 push 或部署。

完成度是有權重的估算，不是已驗收百分比：目前約 60–75%；若本階段所有已列缺漏完成並驗收，約 85–90%。計算、假設和缺項見 `整體完成度估算.md`。完整導覽、79 商品圖示、36 籠子／26 特效逐狀態、名單三操作和戰鬥模式仍不能標記完成。

續修最終驗證：`npm test` 1498/1498、`npm run test:ci` 1281/1281；正常捕獲、載入／逾時／重入、成年受控隊伍對戰至結算皆 PASS。全頁 Chrome 回訪 17 個狀態、61 個賽程與 68 個說明，無 pageerror／failure。`validate:preload` 179 模組；本機 `build:playtest`／`validate:playtest` 6282 檔，build ID `5bb6263578840f93aec456704221e0e815ce4c8ea52549326db85b4213a191dc`。96 個 UI 場景、26 組特效參考與 224 個角色素材驗證通過。tutorial generator `--check` 與 `git diff --check` 通過。結果不代表完整教學、全原作或實體手機已驗收。
