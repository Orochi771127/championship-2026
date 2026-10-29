# 進化演出、必殺技斜條、圖鑑實機動作與招式發射位置修正（2026-10-29）

分支 `feat/evo-cutin-dex-motion-20261029`（worktree `R:\Projects\Championship2026\evo-cutin-dex-motion-20261029`，自 `origin/main` 8768259d）。未 commit、未 push、未部署。

## 找到的「專屬進化數位文字」

- `assets/production/evolution-glyphs-v1/CP-G01-link-128.png`、`CP-G02-memory`、`CP-G03-growth`、`CP-G04-evolution`：Owner 2026-10-13 選定的四個原創進化符號（連結／記憶／成長／進化），清單在 `assets/production/public-runtime/evolution-glyphs.v1.json`。
- 原本只用在育成畫面的 Pixi 進化寫字列：`src/championship/presentation/evolutionGlyphArt.js`，與多語寫字列 `src/championship/text/evolutionPresentationText.js`（EVOLUTION／進化／進化（しんか）／TIẾN HÓA／วิวัฒนาการ）。
- 紀錄：`docs/reports/evolution-glyphs-2026-10-13/IMPLEMENTATION_ZH_TW.md`，commit `9c378db3`。

## 根因

| 問題 | 根因 | 修正 |
|---|---|---|
| 四隻紅頭丸排成一條 | 動作圖集的格子是「裁切後」的小矩形，舊播放器卻用 256 px 原始畫布大小開窗，窗內露出相鄰格子 | `spriteMotionPlayer.js` 每幀只顯示該格的打包矩形（逐幀寬高與位移），元素大小 = 實際繪製範圍 |
| 角色浮在光圈上 | 以原始畫布底邊對齊，腳下有大片透明 | 以幾何資料的腳底原點站在光圈中心（`.cm-sprite--footed`、`--foot-y`） |
| 斜條切半臉、只拍到爪子 | `object-fit: cover` + 置中 + 固定放大 1.7 倍 | 每張圖鑑立繪的頭部方框（`database-hero-faces.v1.json`，含人工複核修正），斜條用容器單位把整顆頭放進可見中段；對戰與數據競技場共用同一個斜條元件 |
| 從肚子放招 | 發射點用身體 45%～62% 高度 | 攻擊動作「出招幀」（最前伸的一格）頭部前緣的口部點，在該幀開始時才發射 |
| `🏃.,` 亂碼 | 彩色表情字型回退 | 改為 CSS 繪製圖示，按鈕無 emoji |
| 進化平面、16 進位亂碼、靜態剪影 | 舊版設計 | 見下節 |

## 進化畫面（真實育成進化與圖鑑模擬共用）

- 角色是真實待機動畫（公開角色 runtime），不是立繪：第一段彩色待機；第二段白 `brightness(0) invert(1)` ↔ 深黑（約 #080A12，青色邊光）交替，越來越快，在進化前／後形態的待機動畫間切換；第三段爆發後新形態彩色落地，播放歡呼再攻擊。
- 3D 能量陣：每個光環拆成後半弧（角色後方，細、暗光）與前半弧（角色前方，5 px 白芯、旋轉刻度塊），加上光柱、沿光柱上升的環、前後穿梭的光點（z-index 隨角度切換）。
- 背景：遠／中／近三層，水平、垂直、斜向的多國「進化」字與四個 Owner 進化符號交錯；16 進位字串已刪除。
- 未放入 `DIGIVOLUTION`：它是另一款商業遊戲的註冊用語，本作原創產品不使用。若 Owner 仍要，請明示後再加。
- 詞表放在文字層 `evolutionPresentationText.js`（`EVOLUTION_STREAM_WORDS`），通過多語覆蓋檢查。

## 218 隻校準

- `scripts/calibrate-218-visual-anchors.mjs`：沿用 runtime 自己的載入器讀格子資料；用 Playwright 內建的無頭 Chromium 解碼圖集與立繪、掃描 alpha 像素（不新增影像套件）。約 20 秒。支援 `--check`。
- 輸出 `src/championship/data/monsterVisualAnchors218.js`（約 44 KB），詳細報告 `visual-anchors-218.report.json`。
- 結果：218/218 都有動作規格、腳底、口部點與斜條頭框；動作格最大寬高比 2.51（單隻身體，無橫條）；218/218 的口部點位於身體 50%～92% 高度；腳底姿態：貼地 137、尾巴垂到腳下 77、懸浮 4（腳底一律用遊戲幾何原點，與牧場、對戰一致）；215/218 頭框中心落在不透明像素上，218/218 頭框內不透明比例 ≥ 25%。
- 立繪頭框來自 `scripts/measure-dex-hero-faces.py`（眼睛高光 → 上半身 → 人工複核 72 筆修正）。
- 例外：species-222 的 runtime 只有歡呼動作，播放器會退回第一個可用動作。
- 有些持武器的拍檔，口部點落在武器或伸出的前肢尖端。這符合「口部或武器尖端」的規格。

## 驗證

- `npm run test:ci`：通過（數字見最終回報）。新增 `tests/championship-218-visual-anchors-cases.mjs`，並擴充 `tests/championship-juicy-showcase-cases.mjs`。
- 瀏覽器（隔離 QA 埠 8811，手機 390×844 @2x）：
  - `championship-codex-showcase-browser.cjs` 新增斷言：單格、腳在光圈中心 ±3 px、無 emoji、斜條 `data-framing="face"`、發射點 `spawnY < footY − bodyH×0.5`、四個符號、前後半環、真實待機動畫。
  - `championship-evolution-streaming-browser.cjs`（真實育成進化）通過。
- 截圖：`fig1-evolution.png`、`fig2-special-021.png`、`fig3-special-034.png`、`fig4-motion-viewer.png`。

## 尚未處理

- 「轉向」：角色美術只有左右兩向（沒有八方向格子），轉向是左右翻轉。
- 對戰場上的 Pixi 招式發射點未改；本批修正的是斜條（對戰共用）與圖鑑展演。
- 發布：新增的 `monsterVisualAnchors218.js`、`database-hero-faces.v1.json` 尚未登記到 `WEB_BUILD_INPUTS` 與 `PUBLIC_RUNTIME_ALLOWLIST`。部署前要補登記並刷新雜湊。
- 實體手機驗收尚未進行。
