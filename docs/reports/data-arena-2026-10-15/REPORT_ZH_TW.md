# Data Arena：潮汐資料港挑戰賽 — 批次報告（2026-10-15）

分類：`OWNER_APPROVED_ADAPTATION`（原創新模式）。契約：[DATA_ARENA_SLICE_2026-10-15.md](../../contracts/championship/DATA_ARENA_SLICE_2026-10-15.md)。資產來源：[ASSET_PROVENANCE.md](ASSET_PROVENANCE.md)。遊玩測試：[PLAYTEST_REPORT_ZH_TW.md](PLAYTEST_REPORT_ZH_TW.md)。機器可讀證據：[VALIDATION.json](VALIDATION.json)、[evidence/](evidence/)。

## 基準與整合

- 起始基準：`origin/main` `93bbdcb0`（開工時）。開發期間 main 前進到 `2e706013`（PR #18–#21）；已以一般 merge（未 rebase、未 force）併入本分支，衝突只在 `WEB_BUILD_INPUTS.v1.json` 與 `tests/ci-test-scope.v1.json`：先完整採用 main 版本，再只追加本批 14 個新檔與重算本批改動的 3 個既有檔雜湊。`main.js`、`championship.html` 自動合併，他人改動完整保留。
- 未碰：主選單美術／標題主圖、圖鑑、獎牌、陰影、角色型態、`portraitFrame.js`、存檔流程、路由／screen stack、Battle／Hunt／Raising 規則。

## 交付內容

| 類別 | 檔案 |
|---|---|
| 規則（純函式、固定 60 Hz） | `src/championship/modes/dataArena/`：`dataArenaConfig.js`（全部數值）、`dataArenaGrid.js`（火／水／冰／DDA 射線）、`dataArenaNav.js`（流場）、`dataArenaSimulation.js`、`dataArenaUpgrades.js`、`dataArenaSave.js` |
| Pixi 呈現 | `src/championship/presentation/dataArena/`：`dataArenaPixiScene.js`、`dataArenaCamera.js`（重用 `battleFxApproach`／`battleFxClampCentre`）、`dataArenaTextures.js`、`dataArenaAudio.js`、`dataArenaRoster.js`（唯讀角色 adapter） |
| DOM | `src/championship/app/dataArenaScreen.js`、`src/championship/app/dataArena.css`（只在進入模式時載入） |
| 文字 | `src/championship/text/dataArenaText.js` |
| 最小整合 | `championship.html` +1 顆按鈕；`main.js` +63 行（延遲載入、`ensureSharedPixiStage` 抽出、音樂讓渡、按鈕標籤）；`ChampionshipPersistentSavePort.js` +23 行（`createChampionshipDataArenaPort`） |
| 測試 | `tests/championship-data-arena-cases.mjs`（27 項，CI portable）、`tests/championship-data-arena-browser.cjs`（真實瀏覽器閘門，`npm run test:browser:data-arena`）、`tests/championship-data-arena-qa-bot.cjs`（只讀觀測的自動駕駛） |
| 發布 | `WEB_BUILD_INPUTS.v1.json`：新增 14 檔＋3 檔雜湊更新 |

## 既有能力盤點與重用

| 既有 | 處理 |
|---|---|
| 單一 Pixi Application／ticker（`championshipPixiStage`） | 重用；從 `ensurePixiStage` 抽出不建 clock driver 的 `ensureSharedPixiStage`，讓標題頁可在無存檔下使用。只加一個 ticker callback，關閉即移除；連續重開 5 次 callback 數不變（瀏覽器實測）。 |
| 戰鬥動態鏡頭（`battleFxCamera`） | 重用其指數趨近與邊界夾取；新增跟隨／前瞻／安全框／動態縮放／創傷震動（減少動態時關閉）。 |
| 戰鬥特效層（`battleFxLayer`） | 與戰鬥狀態緊耦合，不能直接套用；沿用 `mixColor` 與其物件池／材質生成模式寫成競技場粒子池。 |
| 角色渲染（`loadPixiCharacterRuntimeBundle`、資源範圍參考計數） | 直接重用；序列語意沿用戰鬥 CPU 核對的通知→序列（站 0／走 2／攻 7／受擊 6／倒 15／勝 33）。 |
| 音樂、音效匯流排、畫質偏好、減少動態 | 重用 `music.setScene`、`settings.audio`、`currentQuality`、`prefersReducedMotion`。 |
| 建置／發布 | 沿用 hash 核准清單、esbuild bundle、Pages workflow；arena 為延遲載入 chunk，未改 TITLE 啟動模組圖。 |

## 渲染架構（Pixi 單層，未使用 Three.js）

DOM：HUD、選單、觸控、文字。Pixi：world container（鏡頭變換）＝地面烘焙 chunk → 水面 TilingSprite → 格子特效池（火／冰／濕／灰）→ 中央橋 → 預告 Graphics → y 排序物件（角色、敵人、觀眾、艙、信標）→ 彈幕光暈／核心 → 光束 → 粒子 → 看台燈光；screen container＝畫面外威脅箭頭。座標：1 world 單位 = 縮放 1 時 1 CSS px；滑鼠以 `screenToWorld` 反算；觸控以搖桿方向推算瞄準點。

效能處理：靜態港口以向量繪製後一次烘焙為 1024² render-texture chunk 並剔除（低畫質半解析度；context restore 後重烘）——軟體渲染下 4.3 → 10.3 fps（同機實測）；彈幕／敵人／格子特效／粒子全物件池；粒子上限 高 380／低 120；敵人上限 高 38／低 30；彈幕上限 320；敵人分離用空間雜湊；流場 Dijkstra 以預算成本陣列約 0.9 ms／次，每 0.4 秒或格子變化（≥0.15 秒節流）重建；每幀最多追 8 個固定步，避免掉幀螺旋。

## 測試與證據

| 項目 | 結果 |
|---|---|
| 開工基準 `npm run test:ci` | 2097/2097 通過 |
| 合併後 `npm run test:ci` | **2205/2205 通過**（含本批 27 項；main 新增測試同時通過） |
| migration firewall（單一 Application、無第二 ticker、單一寫入者、禁止目錄） | 通過 |
| `npm run build:playtest` + `validate:playtest` | 通過（9688 檔） |
| `npm run validate:preload` | **失敗，但 `origin/main` 本身即同樣失敗**（既有過期，非本批造成；未在 CI 中）。本批沒有新增靜態 import，未重寫他人負責的 TITLE preload 區塊。 |
| 瀏覽器閘門（原始碼，1280×720＋390×844 觸控） | 4 次完整對局全部通過（32–33 項檢查），0 個 page error／console error／HTTP 錯誤／失敗請求 |
| 瀏覽器閘門（**建置產物**，根路徑與 `/championship-2026/` 子路徑） | 26/26 通過，0 錯誤；角色圖在子路徑正確載入 |

完整對局（真實鍵鼠事件；自動駕駛只讀觀測）：

| 種子／拍檔 | 結果 | 升級次數 | 備註 |
|---|---|---|---|
| 7／鎧焰蜥 | 敗（3:00） | 5 | 熄滅 3 核心、占 3 信標、搭乘 2 次 |
| 3／鎧焰蜥（合併前） | 敗（4:05，守衛戰） | 4 | 冰橋 2 座、落水回岸 5 次 |
| 19／曦冕幼獅（合併前） | 敗（4:21，守衛戰） | 4 | — |
| 3／鎧焰蜥（合併後最終） | 敗（3:15） | 4 | 漂亮閃避 17、抹除光球 24 |

截圖說明：`evidence/` 以合併後最終對局為主；`seed3-desktop-full-guardian.jpg`、`seed3-desktop-full-ice.jpg` 來自合併前的種子 3 對局，當時火彈仍誤用敵人貼圖（錯誤 #1，之後已修正），其餘畫面與現行版本一致。

平衡證據（同一自動駕駛直接跑純規則，12 局）：約 1/3 勝；勝場出現在鎧焰蜥與雪晶幼龍，敗局多在守衛剩 15–60% 時。瀏覽器自動駕駛以 10 Hz 粗粒度決策，5 次未擊敗守衛；這反映自動駕駛的瞄準／目標選擇限制，**不是真人勝率**。最終平衡已再下修一次（目標達成回血、守衛 1250 HP），尚需真人試玩確認。

## 效能（誠實標示）

- 測試硬體：雲端容器 4 vCPU（Intel Xeon 2.8 GHz）、**無 GPU**；Chromium 141.0.7390.37 headless；WebGL＝**SwiftShader 軟體渲染**。
- 1280×720 高畫質、解析度 1：規則＋場景更新 中位 3.4 ms／P95 7.9 ms；整幀約 10 fps（受軟體光柵化限制；空場景也只有 ~30 fps）。
- 390×844 手機模擬（低畫質、解析度 1）：更新 中位 1.0 ms；整幀約 30 fps（軟體渲染）。
- **未驗證**：實機 GPU 桌面 60 fps、中階觸控裝置低畫質 30 fps。解除方式：在實機 Chrome 開啟 `?arenaQa=1` 並於主控台讀 `__dataArenaQA.diagnostics()`（`arenaUpdateMs`、`scene.frameMsMedian`），或以 DevTools Performance 量測。

## 已知問題與限制

1. 日／泰／越文介面在本模式暫以英文顯示（繁中、英文完整）；未做機器翻譯。
2. 實機效能與真人上手時間尚未驗證；10 秒上手以簡報內容與自動化流程佐證，非真人計時。
3. 背景／前景切換在 headless 以 `visibilitychange` 事件模擬（headless 不會真的遮蔽分頁）。
4. 首次載入需下載 3 張 2048² 角色圖集（約 2.3 MB 壓縮、GPU 約 48 MB）；只在進入模式時載入，離開即釋放。
5. 模式只在 loopback 與核准公開網址使用既有角色圖；其他主機自動改用程序剪影（依既有授權閘門）。
6. `validate:preload` 為 main 既有失敗（見上）。
7. 未新增 `.claude/skills/`：該目錄在本 repo 被 `.gitignore` 視為本機設定；可重用流程已落在 npm script、瀏覽器閘門與契約中。

## 第二階段（僅規劃，切片驗收前不實作）

「潮汐接力泳賽」可直接重用：水道與搭乘狀態機（游速、上下乘）、流場（swimmer 成本）、事件時間軸、鏡頭、觀眾事件；新增計時、檢查點與水流向量場。「資料障礙賽」重用：冰橋生命週期與碎裂預告、衝刺無敵／漂亮閃避、預告系統、安全回落；新增機關（開關門、移動平台）作為格子狀態。兩者都以 `modes/dataArena` 的新設定檔延伸，不另建模擬核心。
