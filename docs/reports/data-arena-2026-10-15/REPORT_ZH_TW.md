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

## 第二輪參考與差異

**參考取得**：

- 第一次嘗試時 pokemonzarza.com 被代理拒絕（403），只能用二手報導。
- Owner 調整環境後，已直接讀取公開的 `play-guide.html` 與前端規則檔，做純文字研究：未執行、未使用其任何圖音，不進 repo。
- 研究資料只留本機暫存區；來源記錄於 [資產來源](ASSET_PROVENANCE.md) 與 `docs/research/product-reference/REFERENCE_MATRIX.v1.json`。

| 參考的設計原則 | 我方原先 | 本批處理 |
|---|---|---|
| 四招＋終極、能量回復、輕招便宜／重招長前搖 | 一道光束＋隊友指令 | 四招套組（光束＋三技能＋終極）；能量 100、回 16／秒；對手招式前搖 ≥0.3 秒、終極 ≥1 秒 |
| 點按自動瞄準最近、路徑無阻的對手；拖曳手動 | 只有手動瞄準 | 無滑鼠／點觸控招式鈕時自動瞄準；柱子擋住鎖定 |
| 閃避有明顯冷卻，是要計算的資源 | 衝刺冷卻 1.0 秒 | 錦標賽 1.8 秒（港口維持 1.0 秒） |
| 小場地，雙方隨時在射程內 | 無對戰場 | 24×16 格緊湊對戰場；雙人取景鏡頭 |
| 柱子擋直線攻擊；重擊打飛、撞牆受傷 | 掩體只擋射擊 | 突進／爆發／潮浪擊退；撞柱受傷、推下水道落水 |
| 錦標賽與波次生存分開，每輪有時限 | 單一港口時間軸 | 3 輪 90 秒錦標賽（預設）＋港口挑戰；六輪、無盡生存、連線未做、無假按鈕 |
| 前期對手教閃避，後期加重 | — | 第 1 輪傷害 ×1.0、反應 0.4 秒；決賽 ×1.85、反應 0.2 秒 |

不採用：

- 寶可夢名稱、角色、招式名、數值；
- 屬性相剋表；
- 換隊／六隻隊伍；
- 線上房間。

## 第二、三輪交付

| 類別 | 內容 |
|---|---|
| 規則 | `dataArenaConfig.js`：招式（25）、套組（6）、對手（3）、錦標賽、對戰場、能量／擊退。`dataArenaSimulation.js`：施放／前搖預告／自動瞄準／狀態、對手 AI（掩體、反應閃避、預判）、錦標賽流程、輸入緩衝、擊退與撞牆、冰滅火 |
| 呈現 | 對手角色、團隊色預告、區域圓、光盾、定身／緩速提示、畫面外箭頭、雙人取景鏡頭、撞牆特效 |
| DOM | 模式選擇＋招式預覽、招式 HUD（冷卻／能量／終極）、回合 VS 開場／KO 橫幅、對戰表＋三選一、錦標賽結算、觸控招式鈕 |
| 紀錄 | 同一鍵 `championshipModernSave:dataArena:v1`，新增分模式紀錄（`modes`、`lastMode`） |
| 未動 | `main.js`、`championship.html`、存檔埠、主選單、圖鑑、獎牌、牧場、養成存檔（本輪 diff 只在 Data Arena 檔案、文件與測試） |

### 修正的缺陷（本輪自行發現）

1. **從結算畫面換模式／換拍檔會讓對局卡在 0:00**（自第一輪即存在，換拍檔路徑同樣受影響）。
   - 原因：`loadCast` 先釋放角色材質，舊 scene 卻還在共享 ticker 上繪製。拋出的例外中止了整個共享 Pixi ticker 迴圈。
   - 修正：先銷毀舊 scene 再載入；arena 的 ticker callback 包 try/catch，永遠不會停掉產品共用的 ticker（`diagnostics().frameFault` 可觀測）。
   - 瀏覽器閘門新增此路徑檢查。
2. 衝刺、前搖中按下的招式會被吃掉 → 0.25 秒輸入緩衝。
3. 施放前搖把玩家減速到 35%，反而讓招式成為負收益：港口自動駕駛有招式 8/24、無招式 11/24。改為 70% 後為 14/24（加入擊退後 16/24）。
4. 雙人鏡頭讓上方對手被血條遮住 → 取景限制在頂部 HUD 與底部招式列之間。
5. 選單在 720 高時「出戰」被擠出畫面 → 動作列 sticky。結算標題與分數重疊 → 修正。

### 平衡（純規則自動駕駛，每組 9 局：3 拍檔 × 3 種子）

| 版本 | 技巧 0.6 | 技巧 0.35 | 備註 |
|---|---|---|---|
| 第二輪（30×20 場地） | 7/9、5/9 | 5/9、6/9 | 對局 33–73 秒 |
| 緊湊場地、未調整 | 9/9 | 9/9 | 過易 |
| 最終 | **6/9**（第 1 輪 0 敗） | **6/9** | 第 1 輪 ×1.0、決賽 ×1.85；整盃約 130–200 秒 |

港口（自動駕駛，24 局）：16/24 勝。以上是自動駕駛結果，**不是真人勝率**。
