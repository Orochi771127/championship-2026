# 2026-09-17 Cage 技術驗收與 Raising/Cage 排版

## CURRENT TRUTH

本批接續已完成的收束工作，只驗收 `field_cm01_01` 與改善現有 Raising/Cage 排版。前輪 [2026-09-16 報告](../convergence-2026-09-16/REPORT_ZH_TW.md) 原樣保留。

開始時重新確認 worktree、AGENTS、Git root、branch、HEAD、status、remote，執行 `git fetch --all --prune`，並讀取 GitHub PR #2。worktree 為 `R:/Projects/Championship2026/championship-2026-convergence-20260916`，branch 為 `planning/nexus-link-product-scope-2026-09-16`，HEAD 與遠端同為 `7f049dc58563d7e7dc5ccbc42b188d1cc429624d`，差異 0/0、工作樹乾淨。`origin/main` 為 `d7a7dcfd8f7cda41976f12329d99f50a77882371`，PR #2 是 open/Draft，前次 CI run `35104715404` 成功。正式 main 工作樹沒有由本批施工。

**Cage：技術驗收通過，原契約與 compositor 直接沿用。**

| 項目 | 本批確認 |
|---|---|
| 組裝 | 96×112 core → 四個 object cells，依來源順序；sequence/cell 為 1/1、2/2、0/0、3/3 |
| placement − pivot | 28,53；43,-39；27,-47；75,-22。負座標照原有 field bounds 裁切，沒有手工 X/Y 補正 |
| pivots / flips | 來源 locks 與 NCER bounds 對照；四種 flip/padding/pivot 組合保持像素；未改契約幾何 |
| 拒絕條件 | 缺項、重複、改序、錯 binding、改 pivot/placement/geometry/source、錯尺寸、unknown ID、空圖、越界 alpha、非整數座標均有適用負面測試 |
| template / guide | 沿原工具重新產生 SVG、ground guides 與上下排／回捲／起始場地比較，輸出 hashes 留在 `cage-proof.json` |
| 重建 | native/static/runtime、上排、下排、回捲與起始籠舍共 7 組，全部 0 changed pixels |
| runtime | loader 載入已合成 field。新增使用真實 production manifest 的 loader 測試，確認一張圖片、一個 field sprite，不把四個物件再疊一次 |

注意：export override 是局部替換入口，未指定的 ID 會沿用既有來源，並非缺漏；契約本身的缺漏與空物件仍被拒絕。安全 alpha bounds 證明幾何範圍，不能辨認畫在 core 裡的重複物件、錯誤接觸點或美術品質。前景遮擋／actor-object ordering 仍為 `UNKNOWN_REQUIRES_TRACE`。本批沒有把 `runtimeEligible:false / shippingReady:false` 的 proof 升版。

**排版：已在 planning 分支最小落地，尚未合併／發布。**

原本 410px field host 是 `intRh2Styles.css` 的 430px shell，扣除邊框與 field 邊距；同檔也把 Raising status bar／toolbar 限為 430px。Cage 的外框則來自 `vs2Styles.css`。這些是手機呈現上限，並非原作 Cage 座標。`raisingFieldViewport.js` 已有 native zoom cap、相機、裁切及正反座標轉換，無需更換。

本批只在既有最後一層 `daylightSkin.css` 加入 ≥600px 且未使用既有 landscape portrait frame 的限定規則：Raising/Cage shell 上限為 1080px；相同玻璃資訊卡改為兩組數值並排；原工具圖示／文字橫排；Cage 既有設施／持有清單並排。沒有新增側欄或 DOM 元件。

| 驗收尺寸 | 修改前 Raising host | 修改後 Raising host | Cage 配置板 |
|---|---:|---:|---|
| 390×844 | 370px | 370px | 維持原有水平捲動 |
| 820×1180 | 410px | 800px | 508×102px 原幾何完整顯示 |
| 1024×1366 | 410px | 1004px | 508×102px 原幾何完整顯示 |

Raising 在 native zoom cap 下顯示更多既有籠舍，角色沒有隨外框一起放大。390px 的規則保留；横向仍沿用既有 portrait frame，未改為全面橫向重設計。Shop／Database 仍維持原 390／430／430px shell。

## REUSED

原有 app、router、store、save key、DOM components、唯一 Pixi stage/ticker、Raising camera/ground/input、Cage 格位、production loader、Python/Pillow compositor、contract/template 與 Playwright 測試入口。沿用既有 `championship-art-production`、`engineering:code-review`、`engineering:testing-strategy`、`game-ui-ux` skills 和 GitHub 工具。沒有安裝新外掛或依賴。

## ADDED

- 一段只影響 Raising/Cage 的 CSS 排版。
- 兩項加入既有 CI 模組的程式測試：大螢幕 native scale／座標往返，以及 Cage runtime 不重複疊 object cells。
- `npm run test:browser:cage-layout`：三尺寸、重複 resize、實際操作、存檔續玩與鄰近畫面回歸。既有 convergence gate 改用新的寬度預期，其幾何與狀態檢查保留。
- 本批精簡驗收紀錄、機器回條、三尺寸前後截圖，以及既有收束入口更新。

## NOT ADDED

沒有新 Cage／角色圖片、其他 39 個 Cage 轉換、六動作生成、付費呼叫或完整 sprite factory。角色只沿用前輪 readiness；沒有重新宣稱已完成。沒有第二個 app/router/store/save/canvas/Pixi/ticker、Tablet-only 畫面、裝置型號偵測、Battle/Habitat 重寫、Nexus app、Async PvP、其他畫面重設計、merge main 或部署。

## TEST RESULTS

精確命令、log hashes、原始碼指紋與環境見 [validation.json](validation.json)。以下為本批最終工作樹的本機結果；GitHub CI 請核對 [Draft PR #2 的 checks](https://github.com/Orochi771127/championship-2026/pull/2/checks) 與最後交付的提交 SHA，不沿用舊 CI。

回條同時保存 Windows 實測檔案 bytes 與 Git staged blob 的 hashes。兩個未修改的既有 proof 檔有 CRLF／LF 換行差異，已核對只有換行不同；不重寫原 source locks。跨 checkout 重算時用 `gitBlobHashes` 對照提交內容。

| 檢查 | 結果 |
|---|---|
| `npm run art:cage:proof` | 7/7，0 changed pixels，manual corrections 0 |
| `npm run test:cage:proof` | Python 7/7 PASS |
| `node --test tests/championship-cage-authoring-contract-cases.mjs` | structural 3/3 PASS |
| Cage／native size／座標／編輯／loader focused | 38/38 PASS；完整命令見回條 |
| `npm test` | 1,560/1,560 PASS |
| `npm run test:ci` | 1,343/1,343 PASS；既有 portable 模組新增 2 案，無需另建 CI 清單 |
| `npm run validate:preload` | 184 startup modules PASS；無新 runtime module |
| `npm run test:browser:cage-layout` | 14 組同頁 resize、6 組角色／Cage 操作、6 組 Shop/Database 尺寸回歸、Save & Quit／reload／Continue PASS |
| `npm run test:browser:convergence` | 8/8 PASS；既有 preview 與 normal ranch 各載入重建 frame；同 canvas/root、save bytes 保留 |
| `npm run test:browser` | 6 種首頁 viewport、hatch／stroke／carry／Save-Continue／fallback PASS |
| `npm run test:browser:recent` | 直橫向、真實 pagehide 存檔與 roster Continue、三人密碼／第四人拒絕、貼入空白密碼至 Battle result PASS |
| `npm run test:browser:vs2-r1` | 既有 Gate 3D／2D fallback／Hunt Loadout 回歸 PASS |
| `git diff --check`／文件相對連結／staged scope | PASS |

本批瀏覽器操作使用隔離 Chrome profile；沒有修改使用者存檔。390→820→1024→820→390→1024→390 連續往返時，保留相同 Raising canvas／shell／資訊卡與選取居民；先經既有 page-hidden seam 產生非空存檔，再驗證 resize 不改保存 bytes。Cage 的所選物件、occupancy、格位座標保持不變；三尺寸均實際取回／放置。最終從 slot 8 搬到 10、確認、Save & Quit、重新載入 Continue，確認居民與新配置還在。餵食一次只扣一份庫存，未觀察到重複操作效果。瀏覽器 page errors／缺失資源皆為 0。

測試調整記錄：初稿重複點手掌會關掉工具，已改為讀取選取狀態；移動中的居民需要依既有 Home gate 重新取座標；餵食落在既有食物／不可放置位置會合法拒絕，改為鄰近地面取樣並嚴格驗證只接受一次；submenu 的 hidden div 也有 `data-menu-id`，已把點擊 selector 限定為 button。這些修正只在測試。初稿剛看到返回首頁的 canvas 就立即離頁，未得到首次存檔；本批 Save/Continue 採明確 Save & Quit，另外重跑原有 page-hidden／真實 pagehide gate。沒有以測試成功宣稱修復任何未定位的離頁時機問題。

自我審查：產品改動僅 CSS；新增規則限定指定畫面及可用寬度，保留 landscape guard、場景比例、格位與 input authority。沒有新的訂閱、事件或狀態寫入。loader 防重複測試與 viewport 正反轉換測試皆已納入 full／CI。未發現本批阻擋提交的問題。

原有 Home Save/Continue gate 曾把截圖前的座標 117,111 與離頁保存後的 116,113 比較而失敗；當時角色仍在走動。已改為從隔離 context 讀取真正的最後離頁存檔，再嚴格比對 Continue 的保存位置；保留拖曳前後位置必須改變、居民 identity／species 與重新選取名稱等驗證，沒有移除驗收條件或修改 Save runtime。

**實機未驗收。** Chrome 瀏覽器尺寸模擬不是實體手機、iPad、Fold 觸控或 Safari 驗收；Cage 美術品質／腳底接觸／前景遮擋、商業權利與 shipping 均未升格。橫向維持原版，不宣稱新的 Expanded 橫向設計完成。

三尺寸截圖：前後採同一操作流程的獨立測試存檔，時鐘、角色步伐、出生數值可能不同；這是排版比較，並非任意 gameplay 像素完全相同的主張。

| 尺寸 | Raising 前 | Raising 後 | Cage 前 | Cage 後 |
|---|---|---|---|---|
| 390×844 | [前](before/raising-390x844.png) | [後](after/raising-390x844.png) | [前](before/cage-390x844.png) | [後](after/cage-390x844.png) |
| 820×1180 | [前](before/raising-820x1180.png) | [後](after/raising-820x1180.png) | [前](before/cage-820x1180.png) | [後](after/cage-820x1180.png) |
| 1024×1366 | [前](before/raising-1024x1366.png) | [後](after/raising-1024x1366.png) | [前](before/cage-1024x1366.png) | [後](after/cage-1024x1366.png) |

## FILES CHANGED

| 檔案 | 用途 |
|---|---|
| `src/championship/app/daylightSkin.css` | 唯一產品修改；Raising/Cage 寬版及既有資訊／操作重排 |
| `package.json` | 登記新 browser gate，lockfile 與 dependencies 不變 |
| `tests/championship-cage-layout-browser.cjs` | 同頁狀態／操作／Save-Continue／Shop-Database 與截圖 |
| `tests/championship-convergence-browser.cjs` | 取代舊 410px 量測的寬度預期，保留原檢查 |
| `tests/championship-int-rh2-browser.cjs` | 對照真正離頁時的存檔位置，保留拖曳與 Continue 驗證 |
| `tests/championship-raising-field-viewport-cases.mjs` | 大螢幕 native scale 與 pointer round-trip 保護 |
| `tests/championship-runtime-map-art-bundle-cases.mjs` | 真實 Cage manifest 的單一 baked sprite 保護 |
| `tests/README.md` | 測試入口、baseline 用法與 acceptance 邊界 |
| `docs/coordination/OWNER_DIRECTION.md` | 記錄本批適用的施工／提交／推送授權與停止範圍 |
| `docs/README.md`、`docs/CURRENT_PRODUCT_STATUS.md` | 現有入口連到本批證據，明確是 planning 分支成果 |
| 既有 convergence index／adaptive strategy | 更新已落地部分，其餘規劃維持 deferred |
| `docs/reports/cage-layout-2026-09-17/` | 本紀錄、驗證／Cage／browser 回條、12 張前後截圖 |

## NEXT 3 ACTIONS ONLY

1. Owner 審閱 Draft PR #2 的三尺寸前後畫面與本批驗收紀錄。
2. 在實體手機／iPad／Fold 補選取、照護、Cage 操作、縮放／旋轉與 Save-Continue 驗收。
3. 另行決定下一個單 field 原創 authoring 或角色 readiness 授權批次；本批不啟動。

## STOP POINT

停在 **單一 Cage proof 技術驗收、Raising/Cage 最小排版與本機驗證完成**。依本次授權 commit、push 到指定 planning 分支並更新 Draft PR #2；最後交付核對遠端 SHA 與該提交 GitHub CI。到此停止，不 merge main、不 deploy、不擴展角色生產或更多畫面。
