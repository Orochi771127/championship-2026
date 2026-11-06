# UIAudit 六項修復交付報告

日期：2026-11-06

產品：Cyber Partner: Tournament／網線拍檔：錦標賽

分支：`fix/ui-audit-recovery-accessibility-20261106`

比較基準：`7312a31c2723d315517d5f64efbef0c1b7a4d1ce`

## 交付狀態

**UIA-01 至 UIA-06 的修復已落入 [PR #191](https://github.com/Orochi771127/championship-2026/pull/191)；受控回歸、GitHub 乾淨環境的完整 3,494 項測試，以及 internal build／validate 已通過。Chromium 商店矩陣亦已全部通過，包含 54 組主題／尺寸／字級、15 組五語縮放與 3 組原生鍵盤流程。** 本報告依本批 diff 與執行結果整理，不沿用歷史版本的瀏覽器或發布驗收。

公開試玩建置目前被專案的核准門阻擋：11 個來源檔的內容已不同於原先核准的 hash，產生 `PUBLIC_PLAYTEST_NOT_APPROVED`／`PLAYTEST_APPROVED_BYTES_CHANGED`。這是本批內容尚未取得發布核准，**不是程式編譯失敗**。本批未刷新核准 hash；程式、回歸、截圖與回條已形成可審查的 Draft PR，合併及部署須取得這批變更的明確授權。

## 六項修復與證據

| 編號／優先級 | 原因與影響 | 本批修法 | 已有證據與尚未證明的部分 |
|---|---|---|---|
| **UIA-01／P1** Arena 載入無退路 | 必要資源的 Promise 若永久 pending，原本停在 `LOADING`，沒有取消、逾時或返回控制；退出清理也可能等待未完成的載入。 | 每次開始建立獨立載入 owner，接入既有 `LOAD_MAX_MS = 240000`；載入中提供取消、返回與 Escape。取消先撤銷舊 attempt，再回選擇畫面；逾時／失敗顯示可重試的友善訊息。清理不阻塞離開，舊結果晚到不得掛回場景。 | 受控測試涵蓋 stage、角色、環境、互動素材、VFX 永久 pending，以及取消後立即重試、晚到成功／失敗、unload 不完成。已證明受控生命週期可恢復；真實網路、GPU 解碼及裝置上的速度與記憶體表現仍 pending。 |
| **UIA-02／P1** 教學載入錯誤指向不存在的出口 | 教學刻意隱藏一般戰鬥退出鈕，錯誤文案卻要求返回牧場；教學中的 `app.leaveScreen()` 不會離開，直接退出教學又會改變教學狀態。 | 僅在教學載入失敗後顯示「保存並返回標題」。由 app 注入回呼，確認仍為同一教學 runtime；只有 `app.save().phase === 'SAVED'` 才呼叫既有 `returnToTitle('tutorial-battle-load-return')`。存檔失敗留在原畫面可重試，防雙點與離開後舊回呼；五語文案對齊此路徑。 | 實際 app domain、正式回呼與受控 DOM 測試確認 checkpoint／正常遊戲 baseline 保存後可 Continue，沒有被當成戰鬥判負；保存失敗不導航、不改既有存檔。正常戰鬥退出保留。完整標題畫面卸載／重入的瀏覽器流程仍 pending；本批沒有新增原地重新掛載。 |
| **UIA-03／P1** 夜間主題籠舍效果摘要對比不足 | 效果摘要固定深綠文字疊在半透明底色，沒有隨主題調整；原稽核紀錄對比約 **1.38:1**。 | 僅將 `.cm-vs2-shop__effect` 接到現有 `--c-text-1` 與 `--c-accent-soft`，保留 arcade 的既有專用底色。 | CSS 數值測試與實際 Chromium 的六主題矩陣皆達 **4.5:1**。瀏覽器 computed paint stack 的保守下界，夜間選取為 **4.944:1**、未選取為 **11.378:1**；詳見下表。這是背景合成模型的下界，並非抗鋸齒字形像素取樣。 |
| **UIA-04／P1** 商店詳情名稱與模態語意不一致 | 詳情 `role="dialog"` 缺 accessible name，卻宣告 `aria-modal="true"`，實際仍可 Tab 到背景返回；產品本意是可保留背景導覽的非模態詳情。 | 改為 `aria-modal="false"`，以唯一 heading ID 接上 `aria-labelledby`；當共用購買按鈕隱藏或停用時，把初始焦點移到可見的關閉按鈕。沿用既有 Escape 先關詳情、再返回，以及關閉後回到目前商品卡的行為。 | 受控 DOM 回歸通過；Chromium 在三種尺寸也實際通過 Tab／Shift+Tab、Escape 優先順序、重繪後焦點還原、動態名稱、可見關閉鈕初始焦點及購買／返回 intent。這沒有驗證實際讀屏器朗讀或完整購買交易。 |
| **UIA-05／P2** 同 species bundle 重複建立後被覆蓋 | 同一角色可能同時出現在拍檔、爆發型態及對手名單；並行載入後寫入同一 `Map` key，會覆蓋先前 bundle，遺失明確 dispose ownership。 | 在建立載入工作前依 `speciesId` 去重；新資源先由 attempt 擁有，確認未取消後才轉交畫面。既有 bundle／VFX 在正常重開保留，換拍檔只釋放不再需要的角色；共享 stage 不交給 attempt 銷毀。 | 測試涵蓋重複 species、連續重開、換角、取消後舊 continuation、late disposal 與單一 ticker。另以實際 owner／asset scope 做引用計數 smoke。已證明這些 ownership 分支；尚未完成真實 GPU 長時間記憶體觀察，不能宣稱所有資源洩漏已排除。 |
| **UIA-06／P2** 效果摘要不跟隨閱讀字級 | 效果摘要固定 `12px`，在 app 130% 設定下仍維持原尺寸；短橫向規則另固定 `11px`，且片段 `nowrap` 增加放大後溢位風險。 | 效果摘要改用 `--fs-label`，短橫向用 `--fs-caption`；允許片段換行，加入 `min-width: 0` 與長字串斷行。 | 受控 CSS 與 Chromium 矩陣通過；130% 的一般／桌機摘要為 **15.6px**，短橫向為 **14.3px**。arcade 主題的五語在三種尺寸亦通過文字 Range、捲動與按鈕可達性。本批範圍僅效果摘要，仍固定字級的 series／cells 不在本修復結論內。 |

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
| GitHub 完整 `npm run test:ci` | **3,494／3,494 PASS，0 fail** | [乾淨 checkout、Node.js 22 的執行回條](https://github.com/Orochi771127/championship-2026/actions/runs/42195461366/job/127817518089)，來源提交 `487c88a9243ab5582c6742754889b3f5dbdafa3d`。先前本機 sparse checkout 缺檔問題已排除；這是獨立完整執行，不以拆分重跑拼成全綠。整個 workflow 的公開建置步驟仍受下述核准門阻擋。 |
| 實際 Chromium 商店矩陣 | **54＋15＋3 組全部 PASS** | [CI job](https://github.com/Orochi771127/championship-2026/actions/runs/42195461363/job/127817517756)，Chrome 151.0.7922.34；原始 JSON 與兩張目視核對過的截圖已保存於下列 evidence。 |
| 公開試玩建置／發布 | **BLOCKED／未發布** | 11 個來源檔不符既有核准 hash；須完成本批核准程序。 |

Internal build ID：

```text
16d53d7396dff71c56d3a6bd8138f4ed8a49fe0fe36c6eab16685ff908373076
```

本機 artifact 回條為 `dist/internal-review/internal-build.json`；internal build／validate 證明內容可建置且 artifact 一致，不授予公開發布或商業權利。

## 實際瀏覽器結果與驗收邊界

[`championship-ui-audit-browser.cjs`](../../../tests/championship-ui-audit-browser.cjs) 已由 [PR 瀏覽器 workflow](../../../.github/workflows/ui-audit-browser.yml) 實際執行並全部通過：

- 375 × 667 直向、844 × 390 短橫向、1363 × 936 桌機三種視窗；六個主題 × 100／115／130 字級。
- 效果摘要在選取／未選取商品的實際 computed paint stack 對比、文字矩形裁切與水平溢位；包含透明底色、漸層及解碼後背景影像的保守計算。
- arcade 主題五語在 130% 字級的效果摘要、完整商品名稱、關閉／購買／返回按鈕可達性；另以 night 主題驗證三種尺寸的原生 Tab、Shift+Tab、Escape 與動態 accessible name。

這個矩陣掛載真實商店 presenter、runtime、入口樣式與 portrait frame，但使用隔離的元件入口和 intent 替身；**PASS 僅支持這個範圍**。完整正常 Login／Home／Shop 路徑、教學實瀏覽器保存返回及 Continue、Arena 真實素材故障注入與長時間重開、Safari／Firefox、實體手機與讀屏器驗收仍為 pending。對比演算法也不是逐字形抗鋸齒像素量測。

### 瀏覽器對比下界與回條

下列數值取三種尺寸、三段字級的最小值；保持完整 RGBA stop／像素的色彩與透明度相關性後合成，再取保守下界。所有組合都維持 4.5:1 門檻。

| 主題 | 已選取摘要 | 未選取摘要 |
|---|---:|---:|
| night | 4.944:1 | 11.378:1 |
| arcade | 18.267:1 | 16.599:1 |
| arena | 7.209:1 | 13.180:1 |
| clear | 6.695:1 | 13.401:1 |
| warm | 6.333:1 | 12.221:1 |
| classic | 6.829:1 | 6.829:1 |

- [原始瀏覽器回條](evidence/browser-result.json)：54／15／3 組，0 page errors、0 missing responses、0 blocked external requests；入口、ShopView、CSS 的 SHA-256 已核對與本機修復版本一致。
- [驗證摘要](evidence/validation-summary.json)：來源提交、CI run／job、artifact ID／ZIP SHA-256、內部 build ID 及發布門狀態。
- [夜間 375 × 667、130% 截圖](evidence/night-shop-375x667-130.png)。
- [泰文 844 × 390、130% 詳情截圖](evidence/thai-detail-844x390-130.png)。

兩張截圖均已目視核對。首兩輪瀏覽器 gate 曾揭露量測工具自身的兩個誤判：RGBA 通道與 alpha 被獨立配對，以及不可見的 arcade shimmer 被 `scrollHeight` 算成文字溢位。修正為完整 tuple 合成與實際文字 Range 後才重跑；沒有降低對比門檻或改動產品來迎合量測。

另有兩個不能由本批推導的邊界：

1. Arena 取消後可以立即發起新 attempt，但底層 Pixi 同 URL 的下載、解碼或 unload 若仍被舊 Promise 阻塞，無法保證新 attempt 立即取得素材。本批確保可取消／返回／逾時，不宣稱底層作業全部可中斷或載入速度提升。
2. Arena 新提示沿用既有繁中／英文兩份字典，其他語系使用英文 fallback；五語新增文案指的是教學恢復提示，沒有把 Arena 說成已完成五語翻譯。

## 發布門與後續順序

公開試玩使用[核准檢查](../../../scripts/lib/web-build-plan.mjs)對每個輸入檔比對核准 hash；[建置器](../../../scripts/lib/web-build-artifact.mjs)在核准失敗時回報 `PUBLIC_PLAYTEST_NOT_APPROVED`。本輪 11 個 `PLAYTEST_APPROVED_BYTES_CHANGED` 對應產品來源修改，是預期的核准阻擋。現有[公開試玩政策](../../../src/data/championship/public-playtest.r1.json)保持不動，沒有自行執行 refresh 把新內容偽裝成已核准版本。

六項修復、完整 deterministic 回歸與受控商店瀏覽器驗證已形成可審查的 PR。下一步須核准本批合併／部署及其 11 檔核准 hash 更新，再跑公開產物建置與既有正常流程瀏覽器關卡，成功後才合併發布。`main` 與現有發布目前保持原狀；既有快照的發布授權與這次 internal build 成功，均不替代本批核准。

### 重跑入口

下列三個檔案是本批新增的 focused gate；單獨執行它們的數量不等同上表各個關聯回歸群組：

```sh
node --test tests/championship-data-arena-loading-cases.mjs tests/championship-shop-accessibility-cases.mjs tests/championship-tutorial-battle-recovery-cases.mjs
npm run test:ci
npm run build:internal
npm run validate:internal
node tests/championship-ui-audit-browser.cjs
```

瀏覽器 gate 需要可用的 Playwright Chromium；已在 PR CI 安裝並執行，原輸出位於 `.tmp/browser-qa/ui-audit/`，通過的回條與截圖已原樣保存至本報告的 `evidence/`。本次 PASS 來自實際執行，不以語法檢查替代。
