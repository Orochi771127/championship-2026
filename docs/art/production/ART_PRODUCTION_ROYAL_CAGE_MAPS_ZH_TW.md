# 轉蛋皇家籠舍新地圖（2026-11-03）

Owner 2026-11-03 指示：全自動皇家牧場、全自動星際動物園改成各自獨立的新地圖，不再沿用牧場／動物園；拆掉穀倉、筒倉、水槽；改成等候室那樣的六角形排列；星際動物園要有星際元素；皇家牧場要比一般牧場奢華；以 Blender 製作 3D 地圖、加動態效果、適合網頁。

## 模組與規則

| 項目 | 全自動皇家牧場 | 全自動星際動物園 |
|---|---|---|
| 定義 | 36（`championship:2026:cage:royal-ranch`） | 37（`championship:2026:cage:stellar-zoo`） |
| 形狀 | 等候室的 shape 10（mask 15，四格） | 同左 |
| 模擬規則 | 牧場（25）的原始規則：容量、食物、大便、訓練 | 動物園（24）的原始規則 |
| 地圖 | `field_royal_ranch_01` | `field_stellar_zoo_01` |
| 系列 | 只和自己同類相連 | 只和自己同類相連 |

- 定義寫在 `src/championship/cage/productCageCatalog.js`，形狀在 `cageShapes.js`。`cageCatalog.js`、`ranchSlotGeometry.js` 等受籠舍製作契約雜湊鎖定，不修改；36 種原始定義維持不變。
- 內建自動餵食、自動清掃、睡眠加快 30%、獸系點數 +3 仍由轉蛋的 edition（依 instance id）提供；一般的餵食／清掃核心照舊可裝在任何籠舍。
- 舊存檔（11-02 以牧場／動物園模組放置的皇家籠舍）在讀檔時由 `royalCageMigration.js` 搬到新模組：保留 instance id，選最多重用舊格、再最近的空位；居民重新生成在新地圖上，食物和大便移到最近的安全地面。

## 製作管線（可重跑）

1. `python scripts/paint-royal-cage-ground.py ROYAL_RANCH|STELLAR_ZOO <out>/royal_ground.png`：地面貼圖，欄位原生座標每像素 4 texel（960×800）；星際另產 `_galaxy.png` 星系池貼圖。
2. `blender -b --factory-startup --python scripts/build-royal-cage-maps.py -- <EDITION> <ground.png> <out> --glb [--preview]`：Blender 5.2 建模、地面烘焙 AO、輸出 Draco GLB（一段 8 秒循環動畫）。
3. `python scripts/install-royal-cage-maps.py <out>`：裝入 `assets/production/cage/three-20261021/` 並寫入 manifest 的 sha256／bytes。
4. `python scripts/build-royal-cage-ground.py`：行走資料寫入 `ranch-three-ground.r1.json`（`--check` 驗證）。
5. 以 `ranchThreeScene` 在 52° 版面視角、每原生像素 4 px 渲染 960×800 透明圖，`python scripts/pack-royal-cage-ui.py <render dir>` 產生商店／配置圖並更新三份 UI 清單。
6. 更新 `PUBLIC_MAP_RENDER_SOURCES`、`WEB_BUILD_INPUTS`、`PUBLIC_RUNTIME_ALLOWLIST` 後執行 `node scripts/reconcile-public-runtime-selection.mjs`。

## 規則

- 走路範圍是資料：`scripts/lib/royal_cage_layout.py` 同時決定行走格與 Blender 擺放；高的建築只放在不可走的格子，建築後方被擋住的地面也不可走。
- 每條外緣的圍欄各是一個節點（`…-rim-joint-eN`），相連時由牧場場景隱藏。
- 網頁取向：材質為平塗 PBR、金屬度低（牧場沒有環境貼圖）、全部不透明（場景強制 alphaTest）、只有會發光的東西才有自發光；GLB 約 0.5 MB、皇家約 5.4 萬三角形、星際約 3.4 萬。
- 動態：GLB 內的循環動畫（風向標、旗、噴泉水珠、天鵝、蝴蝶、掃地機器人、天文台圓頂、衛星天線、行星、衛星與飛碟、星系池、膠囊、無人機、傳送台），加上 `ranchThreeScene.js` 的噴泉水花與星光粒子；省電畫質與「減少動態」照舊停止。
