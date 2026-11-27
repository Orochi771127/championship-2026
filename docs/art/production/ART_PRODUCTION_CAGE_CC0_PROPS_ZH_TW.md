# 籠舍 CC0 物件升級

## 規則

- **素材來源**：只用官方頁面標示為 CC0 1.0 的套件，例如 Quaternius、Kenney、KayKit 免費版。不用 ROM 或研究素材。
- **配色**：物件改用該籠舍母檔自己的色票材質（例如沙漠的 `ds-*`）。
- **程序紋理材質**：遇到程序紋理材質（例如 `ds-rock*` 的 noise ramp），匯出時要換成同色的純色材質。glTF 帶不出程序紋理，不換的話遊戲裡會變成白色。
- **擺放（依可走資料 `raising-ground.r1.json`，不依畫面）**：
  - **高物件**：距可走格中心至少 0.5。
  - **深度規則**：高物件畫面上方（遠離鏡頭方向）的 1.3 倍高度內不能有可走格，因為角色永遠畫在物件上層。
  - **灌木**：距可走格中心至少 0.3。
  - **可走區**：只放高度 ≤ 0.12 的貼地小物。
  - **其他**：不與原有地形物件重疊，底部貼地。
- **GLB 處理方式**：物件依材質合併成一個網格，用 Draco 壓縮後附加到籠舍 GLB。原本的地板 primitive、貼圖和 BIN 位元組逐位保留，所以支撐面、可走面和地面圖都不受影響。
- **換 GLB 後要更新的指紋**：
  - `three-20261021/manifest.json`
  - `ranchWaterfalls.js` 的 `RANCH_CAGE_FALLS`：地板沒變時只換指紋，邊界值保留。
  - 商店與編輯器圖片：用 `cage-ui-render.html` 只重渲該籠舍，再打包、更新 `cage-ui-three.v1.json` 那一行。
  - `cage-ui.map.v1.json`、`ui-three-20261102/manifest.json`、`PUBLIC_MAP_RENDER_SOURCES`
  - 兩份發布合約

## CM20 沙漠（2026-11-27）

- **GLB**：`assets/production/cage/three-20261021/field_cm20_01.glb`
  - 新：`ba8cefdab1a50b4f354cc77a7a84fedde2e25c9bb49af5789beb7513ab4c9d27`，508,920 bytes
  - 舊：`42075662…`，453,544 bytes。舊檔的 BIN 原封保留在新檔開頭。
- **新增物件**：節點 `field_cm20_01-cc0-props`，6 個材質 primitive，共 6,020 三角面、4,615 頂點，Draco 壓縮後約 56 KB。
- **物件與來源**（皆為 CC0 1.0）：

| 物件 | 套件／模型 | 來源 |
|---|---|---|
| 仙人掌 ×5 | Quaternius Ultimate Nature Pack：`Cactus_1`、`Cactus_2`、`Cactus_5`、`CactusFlowers_4` ×2 | https://quaternius.com/packs/ultimatenature.html |
| 沙岩 ×1 | Quaternius Ultimate Nature Pack：`Rock_3` | 同上 |
| 小仙人掌 ×3 | Kenney Nature Kit 2.1：`cactus_tall`、`cactus_short` ×2 | https://kenney.nl/assets/nature-kit |
| 乾灌木 ×5 | Kenney Nature Kit 2.1：`plant_bushDetailed` | 同上 |
| 貼地扁石 ×4 | Kenney Nature Kit 2.1：`rock_smallFlatA/B/C`、`stone_smallFlatA` | 同上 |

- **編輯母檔**（未進 git）：`R:\Projects\Championship2026\cm20-desert-upgrade-20261127\out\CM20_master_r5_cc0_v5.blend`
  - 來源母檔：`cage-art-refinement-20261024\CM20\r5\CM20_master_r5.blend`，未改。
  - 擺放與匯出腳本在同資料夾的 `scripts\`。授權檔與 SHA256 在 `sources\`。
- **10-24 精修的取捨**：當時曾因原作參考圖沒有仙人掌，把早期手刻的仙人掌、頭骨、灌木設為不渲染。2026-11-27 Owner 要求用免費素材升級籠舍物件，所以加回仙人掌類物件。
- **已知取捨**：
  - 最高的仙人掌在 52° 商店圖框裡頂端略微超出。
  - 右下六角幾乎全是可走格，只放得下外緣小物。

## 替換舊物件（第二批起）

舊物件和地板烤在同一個 Draco 網格裡，所以「替換」要先移除舊物件的三角面再重新壓縮：

- **哪些三角面算舊物件**：三個頂點都落在現行母檔舊物件的頂點上（容差 0.004）。其他三角面保留。
- **重新壓縮**：沿用原本的量化位數（位置 18、法線 12、UV 14、通用 10）。完成後解碼比對每個保留三角面，最大位移約 0.0015 單位（約 0.03 像素）。這是外框改變造成量化格點不同，不是資料遺失。
- **地面圖貼圖要補回**：glTF 往返會丟掉只被材質 extras（`cageGroundMap.texture`）參照的貼圖，要把 texture 項目補回並重新指好索引。驗收時用 `cage-ui-render.html` 的 `groundMapsHooked` 確認等於 1。
- **新物件位置**：放在舊物件原位，高度相近，佔地不超過舊物件，所以可走格不受影響。`ranch-three-ground.r1.json`（落地判定用的物件外框格）沿用舊值，沒有重算。
- **搖曳**：樹冠加上 `_WIND_WEIGHT`（依高度 1.5 次方，樹幹 × 0.25），由同一個 rooted-wind shader 驅動，搖曳動作保留。
- **不適用的籠舍**：有支撐面校驗的籠舍（`physical-ground-tops`：CM02、09、18、19、21、34、35、39）要求「只有一個網格、幾何雜湊完全相同」，加或移除物件都會失敗，要先重建支撐面資料，不能直接套這個流程。

## 第二批（2026-11-28）：CM11 森林、CM12 叢林、CM26 牧場

| 地圖 | 換掉的舊物件 | 新物件（CC0 1.0） | GLB sha256／bytes |
|---|---|---|---|
| CM11 森林 | 6 棵程序樹（樹幹、球形樹冠、根） | Quaternius Ultimate Nature：`CommonTree_1/2/3`、`PineTree_1` ×2、`BirchTree_1`，改用 `pa-leaf*`／`pa-bark` 色票，樹冠平滑著色 | `b68723ab…` ／ 840,776 |
| CM12 叢林 | 6 棵程序椰子樹 | Quaternius Ultimate Nature：`PalmTree_1–4`，改用 `jg-frond*`／`jg-trunk` 色票 | `33b3b1e3…` ／ 1,148,692 |
| CM26 牧場 | 方盒小屋、圓柱筒倉、後圍欄（Owner 2026-11-28 同意移除） | Quaternius Farm Buildings：`SmallBarn`、`Silo`，改用 `pa-roof`／`pa-wall`／`pa-timber` 色票 | `3d9a2dfc…` ／ 618,832 |

- **保留的物件**：森林的 119 叢圓形灌木和蕨，叢林的懸崖、地面植物、大王花，牧場的水槽、乾草、前排圍欄和花。
- **來源與腳本**：編輯母檔與腳本在 `R:\Projects\Championship2026\cc0-cage-batch2-20261128\`（`plans\`、`scripts\`、`out\<field>\`）。素材授權與 SHA256 在 `sources\quaternius\`。
- **移除與重新壓縮的工具**：`R:\Projects\Championship2026\cc0-cage-tools\`（gltf-transform 4.5.1、draco3dgltf 1.5.9，只在本機使用）。
