# Championship 2026 商業上架差距稽核

稽核日期：2026-09-09。判定：**尚未達到商業公開發行／商店送審標準**。

目前具備多個已接通的遊玩流程及大量原作數值對照，可作內部開發與研究驗證。完整長期遊玩、可發布內容、可重建的發行包、真機與商店準備仍有缺口。本判定是依下列工作樹、程式、實際測試與當日官方政策作出的工程評估；不是完成率估算、法律授權結論或商店預先核准。

## 範圍與基準

- 起始目錄：`R:/Projects/Championship2026`，不是 Git repository。
- 正式 root：`R:/Projects/Championship2026/championship-2026`。
- branch：`main`；HEAD：`d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。
- 稽核的是包含大量尚未提交成果的共享工作樹；HEAD 本身不足以重建本次看到的遊戲。
- 閱讀：根 AGENTS、README、Owner Direction、Current Product Status、兩份 Architecture、Dependency Matrix、Blocker Ledger、相關 lifecycle／opening／save／battle contracts、rights registry 及打包程式。
- 近期功能以 `docs/research/LIFECYCLE_OPENING_TWO_STAGE_2026-09-09.md` 與實際程式優先。舊技術債、Dependency／Blocker 文件中的部分「尚未接入」已過時。
- 平台尚未指定，分別評估 Web 公開發行及日後 iOS／Android 商店包。沒有把原生包、帳號、雲端存檔、廣告或內購自動列為 Web 單機遊戲的必備玩法。
- 本次只新增稽核文件，未修改產品程式、既有契約或既有美術，未 commit、push、merge 或 deploy。

## 本次實際驗證

| 檢查 | 結果 | 能證明的範圍 |
| --- | --- | --- |
| `node --test --test-concurrency=2 tests/*.mjs` | **1379 pass / 0 fail / 0 skip**，86.75 秒 | 當前工作樹的 Node 測試，不含全部瀏覽器或實體手機驗收 |
| Pages closure、save economy、storage guard focused tests | **13 pass / 0 fail / 0 skip** | 公開依賴檢查與既有存檔／金錢保護案例 |
| `npm audit --omit=dev --json` | **0 已知漏洞** | 當日正式依賴 advisory 查詢；不是完整資安審計 |
| `git diff --check` | exit 0；既有 LF／CRLF 提示 | tracked diff 的空白檢查；不代表未追蹤資產或全部內容已驗收 |
| Pages build 到獨立稽核輸出路徑 | **失敗：PAGES_INPUTS_MISSING** | 缺少 tracked `src/data/championship/catalogs/entities.r1.json`；前置檢查在替換輸出前停止 |
| 使用實際 tracked／private 選檔規則的唯讀靜態 ESM 檢查 | 已訪問 71 模組；**95 筆 EXCLUDED_DEPENDENCY** | 是目前入口圖可見的被排除 import 邊數，並非 95 個獨立 bug，也不是全部 dynamic fetch 的完整計數 |
| 實際 production index | **25 登錄包；0 shippingReady** | 有本機可用素材，尚無索引核准的 shipping bundle |
| 純 `publicArtIndex` 投影 | 留下 20 筆，20 筆皆不是 shippingReady | 公開過濾本身不是正式發行核准閘門；並未實際发布這些項目 |
| Browser 正常入口 | LOGIN → 繼續遊戲 → 育成可進入；已查看場地及工具列；捕捉到的 warn/error 為 0 | 桌面瀏覽器目前預設 viewport，未冒稱真機、完整新遊戲或全流程 E2E |
| 三個 SVG 的實際本機 HTTP HEAD | 皆 200，Content-Type 為 `application/octet-stream` | 執行中的 server 與程式內已設定的 `image/svg+xml` 不一致 |

測試日誌及靜態問題明細位於 `R:/Projects/Championship2026/_archive/commercial-readiness-2026-09-09/`，不是 runtime 資料。Browser 抽查沿用既有本機存檔「小光」；遊戲由第 2 日晚間自然進入第 3 日 07:00 的日曆並觸發既有換日保存，然後關閉分頁。未使用隱藏 state 或 storage 注入，未清除存檔。

## 已完成的基礎，不應重列為完全沒做

- 獨立 Web 產品、DOM UI、既有共享 Pixi 場地與單一存檔權威已存在；不需要為了商業化另起 router／store／save 或遷移引擎。
- 原作起始蛋、孵化、個體身分與圖鑑登錄、狩獵生成／工具／捕獲／返回、Gate 費用及部分解鎖均有正常 app 接入。
- 餵食、蛋白質、清潔、治療、活動、訓練 writers、進化條件、壽命／轉生／消失、睡眠／喚醒、過夜／換日保存已接入。全部情境與形態配對尚未結案。
- 一般賽程登錄／取消、結果、階級與部分晨間信件已有實作；四張故事與姓名流程已接入。
- 既有戰鬥數值、效果池、動作腳本與本機參考演出已有大量受控驗證；原作全部正常比賽演出仍未完整驗收。
- 目前實作玩家畫面已有繁中顯示層、名稱保存與相關測試。商店、設施、圖鑑及說明也已有可用範圍。
- 存檔具有 v1–v4 → v5 遷移、嚴格驗證、寫入失敗／重試及一次性結算保護；不能稱為「沒有存檔系統」。

以上證據主要見 [當前狀態](../../../CURRENT_PRODUCT_STATUS.md)、[最新兩階段紀錄](../../../research/LIFECYCLE_OPENING_TWO_STAGE_2026-09-09.md)、[狩獵核心](../../../research/HUNT_CORE_TWO_STAGE_IMPLEMENTATION_2026-09-08.md) 與 [繁中整合](../../localization/2026-09-08/ZH_HANT_IMPLEMENTATION.md)。

## 上架差距與完成標準

優先級是這次商業發行稽核的工程分類，不改寫既有 gameplay evidence。P0 是阻止公開 release candidate 的問題；P1 是正式發布前須完成的產品與驗收工作；P2 是範圍決策或後續改善。

| ID / 優先級 | 現況 | 缺口與影響 | 可驗收的完成標準 |
| --- | --- | --- | --- |
| CR-01 / P0 | **阻塞：發行權利證據未閉合** | 權利登錄文件狀態為 `PENDING_PRIVATE_DOCUMENT_LINK`，`shippingPermitted:false`。部分美術標成 LICENSED 並不等於正式商業授權已核驗；目前名稱、角色與參考音畫仍涉及原作內容。 | 確認走授權重製或 Owner 核准的原創產品路徑；核對名稱／角色／美術／音樂／文字、平台、地區、使用範圍與權利證據。不能把換皮或重新繪製當作授權證明。 |
| CR-02 / P0 | **阻塞：無可通過驗證的公開建置** | build 實際缺檔；tracked-only 選檔遺漏大量現有模組。私有 battle 依賴另有明確排除政策，不能靠解除排除通關。 | 經審查的完整發布輸入可由乾淨 checkout 重建；build、validator、正式輸出入口及所有必要動態資源通過；在不含本機研究檔的環境完成玩法驗收。 |
| CR-03 / P0 | **部分：自己養成的隊伍與大會循環** | 正常 Battle 建立沒有傳入 Home 個體；目前玩家側預設 `playerTeamIndex = 1` 作代用。玩家個體 ENTRY、資格、多輪大會、結果回寫／續玩尚未完整接通。養成成果還不能完整形成正式長期目標。 | 由正常新遊戲取得個體、育成、原條件組隊、入場、多輪勝敗、獎勵／階級／解鎖與保存續玩全程通過；同操作條件依原 evidence 驗證，無代用隊伍或測試 state。 |
| CR-04 / P0 | **阻塞：內容發行 gate 不完整** | 25 bundles 中 0 shippingReady。`publicArtIndex` 只排除明確禁止項目，留下 20 筆非 shippingReady，builder 的檔案複製又依路徑決定。修好缺檔不會自動取得商業安全包。 | 最終發布入口、索引與實際檔案均按明確核准清單驗證；所有依賴資產均具有來源、權利、人工視覺、執行與發布驗收；缺少批准時 build 必須拒絕，不能只隱藏索引。 |
| CR-05 / P1 | **部分：完整可操作教學** | 四張故事／命名不等於教學。原作 Raising → Gate → Hunt → Battle 的互動教學尚未接入 runtime；`tutorialStep` 欄位不能代替實際控制流程。 | 正常 New Game 能按原條件進入／略過教學，完成放食、清潔、治療、搬運訓練、捕獲及戰鬥教學；中斷／返回／續玩可依已驗證規則處理。 |
| CR-06 / P1 | **部分：剩餘遊戲內容與原作對照** | 大會分支、全部晨間劇情／健康／解鎖 trigger、所有進化形態配對、更多籠配置與個體／食物組合尚未完成驗收。Hunt 部分 AI 分支、工具音畫；戰鬥 KO timing、ending camera 及所有招式自然選出後的表現仍有未知。 | 建立按玩家可達條件排序的覆蓋矩陣；每個宣稱保留的功能都有正常路徑、失敗／取消／回復案例及對應證據。未知繼續 trace，不自創效果或刪功能。 |
| CR-07 / P1 | **部分：美術、音樂、音效與操作回饋** | 畫面混合現代 DOM、原像素參考與獨立繪製圖形；完整替代內容、動作配對、開場插畫、育成／狩獵音訊及整體風格驗收未閉合。當前本機畫面三個工具圖示未顯示。 | 每個正常畫面、角色動作、工具與戰鬥演出具可發行素材；辨識、縮放、錨點、動作時間與觸控回饋一致；完成音量／靜音與音訊中斷恢復等目標平台驗收。 |
| CR-08 / P1 | **部分：保存可靠性與玩家復原** | 已有 migration／retry；`exportRecovery()` 主要返回既有 storage 內容，正常產品未見完整玩家匯出／匯入修復流程。損毀或不相容存檔的入口引導開始新遊戲。活動中的 Hunt／Battle 不具有任意時點恢復承諾。 | 明定並驗證符合既有原作／Owner 方向的保存點；寫入失敗、關閉／終止、換版、配額／損毀、多分頁衝突的處理可重現。提供經核准的保全／復原方式；不默默擴增雲存檔或自動保存玩法。 |
| CR-09 / P1 | **部分：GPU 故障與執行恢復** | shared Pixi stage 在 `webglcontextlost` 停 ticker、隱藏 canvas、設 `contextLost=true`；此模組未提供 `webglcontextrestored` 恢復路徑，main 只 reset clock。 | 在可控測試中丟失／恢復 WebGL context，能恢復場景或提供保護進度的明確重啟流程；同時確認音訊、listener、ticker 與資源不重複。此次為靜態發現，未誘發現有存檔的 GPU 故障。 |
| CR-10 / P1 | **未知／未驗收：實體手機與性能** | 桌面手機尺寸證據已有；近期正式紀錄仍標記 physicalDeviceAcceptance=false。未找到完整量測低／中階手機、長時間玩法、記憶體峰值、耗電及背景回復的發行矩陣。 | 選定支援設備／OS／瀏覽器，量測載入、幀時間、記憶體、熱／耗電；實測圈繩、拖曳、邊緣手勢、背景／電話／音訊中斷、低記憶體及長局。數值預算先標 ENGINEERING_PROPOSAL，再由量測與產品標準決定。 |
| CR-11 / P1 | **部分：可持續 QA 與版本交付** | CI 有 npm test；browser E2E 未作 CI gate。既有 `test:browser` 的 openRaising 直接點開始／繼續，未走目前 LOGIN／故事／命名入口，存在腳本落後問題。實際本機 server MIME 又與檔案不同。 | 維護一套走正常入口的可靠 E2E；隔離測試存檔、固定版號／資產 hash／來源、驗證同一候選包、可重建、可回退。修正 source／running server／reviewed artifact 的版本差異。 |
| CR-12 / P1，依平台 | **未在 repo 找到：商店與發行營運交付** | 原生 Android／iOS 工程、簽章送審包、商店素材／年齡分級／支援網址／隱私揭露等未有完整交付證據。PWA manifest／service worker 亦未找到；它們只在選擇可安裝／離線 Web 產品時適用。商店帳戶與外部法務資料未存取，保持未知。 | 決定首發平台與地區；完成該平台簽章、相容性、商店頁、分級、隱私／資料安全、客服與更新回退。App Store 需證明完整 app 體驗；只包 WebView 不自動過審。 |
| CR-13 / P2 決策，若收費則發布前完成 | **未知：商業模式與售後** | 尚未確認買斷、付費下載、免費或其他模式；不把遊戲內 Shop／Bits 當作真實付款系統。尚無可核實的購買／恢復／退款／客服作業驗收。 | 先決定模式，再對所需購買權益、恢復、失敗、退款／客服做驗收；需要時按目標商店與地區規則實作。不要為了商業化自動加入抽卡、廣告、訂閱、帳號或即時多人。 |

## 關鍵程式與文件證據

- 權利文件待確認：[RIGHTS_EVIDENCE_REGISTRY.json](../../../legal/RIGHTS_EVIDENCE_REGISTRY.json)，`document.status`、`decisions.shippingPermitted`。
- 登錄包數與 shipping 狀態：[ART_PRODUCTION_INDEX.json](../../../../assets/production/ART_PRODUCTION_INDEX.json)。
- 原始碼與可發行包：[build-github-pages.mjs](../../../../scripts/build-github-pages.mjs)、[public-art-boundary.mjs](../../../../scripts/lib/public-art-boundary.mjs)、[validate-github-pages.mjs](../../../../scripts/validate-github-pages.mjs)。
- 代用隊伍與正常入場：[battleRuntime.js](../../../../src/championship/app/battleRuntime.js) 的 `residentIds`／`playerTeamIndex`、[main.js](../../../../src/championship/app/main.js) 的 `mountBattleSelect`。
- 教學／多輪／晨間訊息缺口：[LIFECYCLE_OPENING_TWO_STAGE_2026-09-09.md](../../../research/LIFECYCLE_OPENING_TWO_STAGE_2026-09-09.md)。
- 保存：[ChampionshipPersistentSavePort.js](../../../../src/championship/app/ChampionshipPersistentSavePort.js)、[championshipStandaloneSave.js](../../../../src/championship/app/championshipStandaloneSave.js)、main 的 `refreshContinue`。
- GPU 故障：[championshipPixiStage.js](../../../../src/championship/presentation/championshipPixiStage.js) 的 `handleContextLost` 與 main 的 listener。
- 執行版差異：[serve.mjs](../../../../scripts/serve.mjs) 已列 `.svg → image/svg+xml`；當日 8732 endpoint 仍回傳 octet-stream。推測需重新載入正確 server 程序，但本次未重啟共享服務，也未把推測視為已修復。
- QA：[ci.yml](../../../../.github/workflows/ci.yml)、[github-pages.yml](../../../../.github/workflows/github-pages.yml)、[championship-int-rh2-browser.cjs](../../../../tests/championship-int-rh2-browser.cjs)。此次未執行會覆寫既有 VS1 截圖的歷史 browser script。

## 對照商店官方政策

以下是 2026-09-09 查閱的官方要求，不代替實際送審或地區法律審查。

- Apple 要求交付完整、在裝置測過的版本，清除 placeholder、完善連結與送審資訊；4.2 要求超出單純重新包裝網站的完整 app 體驗，5.2 要求內容與第三方 IP 權利。這些要求直接對應 CR-01、03、05、07、10、12。[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Apple 的送審指引要求有效的客服與隱私政策連結，並提醒未完成內容及錯誤影響審核。[App Review](https://developer.apple.com/app-store/review/)
- Google Play 對遊戲及商店頁中的第三方 IP 要求具備必要許可。這次 repo 中缺少已核驗文件，不能反推 Owner 在外部一定沒有文件；只能判為尚未提供可發布證據。[Intellectual Property](https://support.google.com/googleplay/android-developer/answer/9888072?hl=en)
- Google Play 要求適用的已發布／封閉／公開測試 app 填寫資料安全資訊；即使沒有收集資料，也要提供適當表單與隱私政策。帳號刪除要求依是否提供 app 帳號建立等實際功能適用，不能因 LOGIN 標籤就推定已有網路帳號。[Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)、[User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en-GB)

## 下一個安全步驟與排程依據

1. **先列清發布輸入與 P0 依賴。** 將現有 source／catalog／asset 分清可發布、待核准及研究專用，建立完整建置清單與 release gate；保留舊成果及私有邊界。
2. **完成一個可從新遊戲走完的大會流程。** 沿用既有 Owner 授權，完成互動教學、自己培養隊伍、正式入場、多輪結果與保存續玩。以正常操作驗收，繼續原作 trace 以解決未知。
3. **在相同候選包完成音畫與可靠性。** 收齊核准素材，補齊 GPU／保存／音訊恢復與維護中的 browser E2E，修正本機與候選包版本不一致。
4. **用目標手機做 beta，之後完成對應上架交付。** 把完整流程、裝置性能及更新保存測完，再完成商店資訊、權利／隱私與適用的付費權益流程。

這份排序不授權改玩法、刪減原作 roster、搬移／重置工作樹或發行。技術、內容、權利及裝置完成度分開計算；目前不應用「測試全綠」推導「只差最後包裝」，也不宜提供沒有分母和驗收定義的整體完成百分比。
