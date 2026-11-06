# UIAudit 六項修復交付報告

日期：2026-11-06  
產品：Cyber Partner: Tournament／網線拍檔：錦標賽  
分支：`fix/ui-audit-recovery-accessibility-20261106`  
比較基準：`7312a31c2723d315517d5f64efbef0c1b7a4d1ce`

## 交付狀態

**UIA-01 至 UIA-06 的修復已落入工作分支；受控回歸與 internal build／validate 已通過。本機完整回歸的唯一失敗已定位為 checkout 缺少既有 README，補齊後該組 9／9 通過；遠端完整 CI 與實際瀏覽器矩陣仍待回條。** 本報告依本批 diff 與執行結果整理，不沿用歷史版本的瀏覽器或發布驗收。

公開試玩建置目前被專案的核准門阻擋：11 個來源檔的內容已不同於原先核准的 hash，產生 `PUBLIC_PLAYTEST_NOT_APPROVED`／`PLAYTEST_APPROVED_BYTES_CHANGED`。這是本批內容尚未取得發布核准，**不是程式編譯失敗**。本批未刷新核准 hash；先形成可審查 PR，合併及部署須取得這批變更的明確授權。

## 六項修復與證據

| 編號／優先級 | 原因與影響 | 本批修法 | 已有證據與尚未證明的部分 |
|---|---|---|---|
| **UIA-01／P1** Arena 載入無退路 | 必要資源的 Promise 若永久 pending，原本停在 `LOADING`，沒有取消、逾時或返回控制；退出清理也可能等待未完成的載入。 | 每次開始建立獨立載入 owner，接入既有 `LOAD_MAX_MS = 240000`；載入中提供取消、返回與 Escape。取消先撤銷舊 attempt，再回選擇畫面；逾時／失敗顯示可重試的友善訊息。清理不阻塞離開，舊結果晚到不得掛回場景。 | 受控測試涵蓋 stage、角色、環境、互動素材、VFX 永久 pending，以及取消後立即重試、晚到成功／失敗、unload 不完成。已證明受控生命週期可恢復；真實網路、GPU 解碼及裝置上的速度與記憶體表現仍 pending。 |
| **UIA-02／P1** 教學載入錯誤指向不存在的出口 | 教學刻意隱藏一般戰鬥退出鈕，錯誤文案卻要求返回牧場；教學中的 `app.leaveScreen()` 不會離開，直接退出教學又會改變教學狀態。 | 僅在教學載入失敗後顯示「保存並返回標題」。由 app 注入回呼，確認仍為同一教學 runtime；只有 `app.save().phase === 'SAVED'` 才呼叫既有 `returnToTitle('tutorial-battle-load-return')`。存檔失敗留在原畫面可重試，防雙點與離開後舊回呼；五語文案對齊此路徑。 | 實際 app domain、正式回呼與受控 DOM 測試確認 checkpoint／正常遊戲 baseline 保存後可 Continue，沒有被當成戰鬥判負；保存失敗不導航、不改既有存檔。正常戰鬥退出保留。完整標題畫面卸載／重入的瀏覽器流程仍 pending；本批沒有新增原地重新掛載。 |
| **UIA-03／P1** 夜間主題籠舍效果摘要對比不足 | 效果摘要固定深綠文字疊在半透明底色，沒有隨主題調整；原稽核紀錄對比約 **1.38:1**。 | 僅將 `.cm-vs2-shop__effect` 接到現有 `--c-text-1` 與 `--c-accent-soft`，保留 arcade 的既有專用底色。 | CSS／色票數值測試在六個主題、選取與未選取及相關底色組合皆達 **4.5:1**。這是 authored CSS 與色彩合成的受控計算；實際完整 cascade、背景影像合成後的瀏覽器結果仍 pending，不把原稽核數值當作本輪重測。 |
| **UIA-04／P1** 商店詳情名稱與模態語意不一致 | 詳情 `role="dialog"` 缺 accessible name，卻宣告 `aria-modal="true"`，實際仍可 Tab 到背景返回；產品本意是可保留背景導覽的非模態詳情。 | 改為 `aria-modal="false"`，以唯一 heading ID 接上 `aria-labelledby`；當共用購買按鈕隱藏或停用時，把初始焦點移到可見的關閉按鈕。沿用既有 Escape 先關詳情、再返回，以及關閉後回到目前商品卡的行為。 | 五語動態名稱、隱藏／停用購買、重繪後焦點還原、Escape 優先順序及購買 intent 已有受控 DOM 回歸。真實 Tab 次序已寫入瀏覽器矩陣，但尚無執行 PASS；讀屏器朗讀結果仍 pending。 |
| **UIA-05／P2** 同 species bundle 重複建立後被覆蓋 | 同一角色可能同時出現在拍檔、爆發型態及對手名單；並行載入後寫入同一 `Map` key，會覆蓋先前 bundle，遺失明確 dispose ownership。 | 在建立載入工作前依 `speciesId` 去重；新資源先由 attempt 擁有，確認未取消後才轉交畫面。既有 bundle／VFX 在正常重開保留，換拍檔只釋放不再需要的角色；共享 stage 不交給 attempt 銷毀。 | 測試涵蓋重複 species、連續重開、換角、取消後舊 continuation、late disposal 與單一 ticker。另以實際 owner／asset scope 做引用計數 smoke。已證明這些 ownership 分支；尚未完成真實 GPU 長時間記憶體觀察，不能宣稱所有資源洩漏已排除。 |
| **UIA-06／P2** 效果摘要不跟隨閱讀字級 | 效果摘要固定 `12px`，在 app 130% 設定下仍維持原尺寸；短橫向規則另固定 `11px`，且片段 `nowrap` 增加放大後溢位風險。 | 效果摘要改用 `--fs-label`，短橫向用 `--fs-caption`；允許片段換行，加入 `min-width: 0` 與長字串斷行。 | 受控 CSS 測試確認 100／115／130 設定在直向、短橫向、桌機規則下依比例放大。實際五語裁切、捲動及按鈕可達性仍 pending；本批範圍僅效果摘要，沒有把仍固定字級的 series／cells 一併宣稱修復。 |

### 可核對的程式與回歸來源

- Arena：[`dataArenaScreen.js`](../../../src/championship/app/dataArenaScreen.js)、[`dataArenaText.js`](../../../src/championship/text/dataArenaText.js)、[載入生命週期回歸](../../../tests/championship-data-arena-loading-cases.mjs)。既有 [load watchdog](../../../src/championship/app/loadWatchdog.js) 與 [Pixi asset scope](../../../src/championship/presentation/pixiCharacterRuntimeBundle.js) 沿用原實作。
- 教學：[`main.js`](../../../src/championship/app/main.js)、[`vs5Screens.js`](../../../src/championship/app/vs5Screens.js)、[教學恢復回歸](../../../tests/championship-tutorial-battle-recovery-cases.mjs)。測試使用實際 app domain 與從正式 source 擷取的 owner 回呼；標題導航的外層卸載由測試替身執行，不能取代完整瀏覽器重入驗收。
- 商店：[`vs4Screens.js`](../../../src/championship/app/vs4Screens.js)、[`screenLayout.css`](../../../src/championship/app/ui/screenLayout.css)、[可及性回歸](../../../tests/championship-shop-accessibility-cases.mjs)。
- CI 登錄：三個新增 portable 測試已列入 [`ci-test-scope.v1.json`](../../../tests/ci-test-scope.v1.json)。

## 驗證狀態與證據層級

以下是本批執行回報的群組結果。**群組有重疊，不相加成一個總測試數。**

| 項目 | 狀態 | 可以支持的結論 |
|---|---|---|
| Arena 關聯回歸 | **66／66 PASS** | 受控非同步載入、取消、晚到清理、去重、cache 與既有相關行為。 |
| Shop 關聯回歸 | **83／83 PASS** | DOM 行為、商品語意、既有商店相關行為與 CSS 數值；不等同瀏覽器排版 PASS。 |
| Tutorial recovery | **13／13 PASS** | 錯誤專用出口、五語提示、防重入／舊回呼、實際存檔 domain 與 checkpoint 恢復。 |
| Battle 關聯回歸 | **54／54 PASS** | 受影響的戰鬥介面及既有相關合約；不代表全部遊戲模式驗收。 |
| 額外 owner／asset scope smoke | **PASS** | 使用實際 `createLoadAttempt` 與巢狀 `createPixiAssetScope`，底層 `Assets` 為受控替身；共享資源尚有持有者時不提早 unload，晚到資源只清理一次，最後引用釋放後可建立新世代。此為額外本機 smoke，不冒充已納入 CI 的瀏覽器測試。 |
| `npm run build:internal` | **PASS，exit 0** | 本批 internal artifact 成功產生，共 **8,345 檔**。 |
| `npm run validate:internal` | **PASS，exit 0** | 驗證同一 artifact，檔數與下列 build ID 一致。 |
| 本機完整 `npm run test:ci` | **3,493 PASS／1 環境失敗；該組重跑 9／9 PASS** | 唯一失敗因 sparse checkout 未展開既有 `research/original-evidence/README.md`，不是額外 payload 或產品回歸；補齊後 migration firewall 九項全部通過。先前缺少 QA 素材的 15 項亦已通過。完整乾淨 checkout 的 CI 結果仍以 PR 回條為準，不把拆分重跑當作一次全綠執行。 |
| 實際 Chromium 商店矩陣 | **pending** | 腳本與 PR workflow 已建立，尚無執行 PASS 或最終畫面回條。 |
| 公開試玩建置／發布 | **BLOCKED／未發布** | 11 個來源檔不符既有核准 hash；須完成本批核准程序。 |

Internal build ID：

```text
16d53d7396dff71c56d3a6bd8138f4ed8a49fe0fe36c6eab16685ff908373076
```

本機 artifact 回條為 `dist/internal-review/internal-build.json`；internal build／validate 證明內容可建置且 artifact 一致，不授予公開發布或商業權利。

## 尚待完成的驗收

[`championship-ui-audit-browser.cjs`](../../../tests/championship-ui-audit-browser.cjs) 已接到 [PR 瀏覽器 workflow](../../../.github/workflows/ui-audit-browser.yml)，預定檢查：

- 375 × 667 直向、844 × 390 短橫向、1363 × 936 桌機三種視窗；六個主題 × 100／115／130 字級。
- 效果摘要在選取／未選取商品的實際 computed paint stack 對比、文字矩形裁切與水平溢位；包含透明底色、漸層及解碼後背景影像的保守計算。
- 五語在 130% 字級的效果摘要、完整商品名稱、關閉／購買／返回按鈕可達性，以及真實 Tab、Shift+Tab、Escape 與動態 accessible name。

這個矩陣掛載真實商店 presenter、runtime、入口樣式與 portrait frame，但使用隔離的元件入口和 intent 替身；**即使未來 PASS，也只支持這個範圍**。完整正常 Login／Home／Shop 路徑、教學實瀏覽器保存返回及 Continue、Arena 真實素材故障注入與長時間重開、Safari／Firefox、實體手機與讀屏器驗收仍為 pending。對比演算法也不是逐字形抗鋸齒像素量測。

另有兩個不能由本批推導的邊界：

1. Arena 取消後可以立即發起新 attempt，但底層 Pixi 同 URL 的下載、解碼或 unload 若仍被舊 Promise 阻塞，無法保證新 attempt 立即取得素材。本批確保可取消／返回／逾時，不宣稱底層作業全部可中斷或載入速度提升。
2. Arena 新提示沿用既有繁中／英文兩份字典，其他語系使用英文 fallback；五語新增文案指的是教學恢復提示，沒有把 Arena 說成已完成五語翻譯。

## 發布門與後續順序

公開試玩使用[核准檢查](../../../scripts/lib/web-build-plan.mjs)對每個輸入檔比對核准 hash；[建置器](../../../scripts/lib/web-build-artifact.mjs)在核准失敗時回報 `PUBLIC_PLAYTEST_NOT_APPROVED`。本輪 11 個 `PLAYTEST_APPROVED_BYTES_CHANGED` 對應產品來源修改，是預期的核准阻擋。現有[公開試玩政策](../../../src/data/championship/public-playtest.r1.json)保持不動，沒有自行執行 refresh 把新內容偽裝成已核准版本。

下一步是完成完整 CI、取得實際瀏覽器回條、處理可重現失敗，再以這個明確批次提出可審查 PR。`main` 與現有發布保持原狀；合併／部署授權留到變更與證據都可審查時確認。既有快照的發布授權與這次 internal build 成功，均不替代本批核准。

### 重跑入口

下列三個檔案是本批新增的 focused gate；單獨執行它們的數量不等同上表各個關聯回歸群組：

```sh
node --test tests/championship-data-arena-loading-cases.mjs tests/championship-shop-accessibility-cases.mjs tests/championship-tutorial-battle-recovery-cases.mjs
npm run test:ci
npm run build:internal
npm run validate:internal
node tests/championship-ui-audit-browser.cjs
```

瀏覽器 gate 需要可用的 Playwright Chromium；預定在 PR CI 安裝並執行，結果與截圖輸出至 `.tmp/browser-qa/ui-audit/`。測試程式存在或語法檢查成功，均不記為瀏覽器 PASS。
