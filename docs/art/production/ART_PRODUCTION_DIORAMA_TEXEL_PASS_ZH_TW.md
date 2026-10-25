# 3D 地圖微縮質感：貼圖光線寫入管線（2026-10-26 起適用）

本文件取代缺少的 `championship-art-production` 技能，作為這類工作的固定做法：牧場籠子、狩獵地圖等 Three.js GLB 場景要提升「微縮沙盤」質感時，照本文件做。第一次完整套用是 37 張籠子，見 [cage-diorama-2026-10-26](../../reports/cage-diorama-2026-10-26/README_ZH_TW.md)。

## 鐵律

1. **幾何資料不動。** Draco 幾何區塊（`KHR_draco_mesh_compression` 的 bufferView）必須逐位元組不變。打包腳本在輸出前會比對 SHA。
   - 這樣可走格、碰撞、支撐三角形、洞穴錨點和尋路資料都不會受影響。
   - 只會動到的東西：baseColor 影像、GLB 雜湊，以及釘住這些雜湊的檔案。
2. **只開一次 Blender 進程，不用 Cycles 烘焙。**
   - 一個 `blender -b -noaudio --factory-startup --disable-autoexec --python-exit-code 1` 迴圈跑完全部地圖。stdout 只導進 log 檔，對話只看一行 JSON 摘要。
   - AO 用 `mathutils.bvhtree.BVHTree.ray_cast` 算。
3. **從原始發布檔讀取。** 一律讀凍結在歸檔目錄 `originals/` 的發布版 GLB，絕不讀已經被覆寫的 bundle。
4. **只寫在唯一 UV 上。** 只有每個 texel 都對應到唯一世界位置時，才能把 AO 和重繪寫進貼圖。
   - 平鋪貼圖（UV 超出 0–1、或多個面共用同一塊貼圖區域）不可以寫入局部 AO，否則 AO 會在全圖重複出現。
   - 平鋪貼圖只能做整體色調調整；明暗層次改用場景光源或既有遮罩。
   - 退化成單點的 swatch UV（多個面縮在同一點）也一律跳過。
5. **保留 alpha。** 原圖如果有 alpha 鏤空（例如 cm21/cm35/cm37 的 10-21 圖集），輸出必須維持 RGBA。打包腳本會自動偵測。
6. **不碰全域設定。** 只調整該 3D 場景自己的光源；不加後處理、不加景深、不改正交相機，也不改全域色彩設定。

## 處理內容（`diorama_process.py`）

| 項目 | 做法 | 參數（籠子版） |
|---|---|---|
| 面分類 | 把解碼後的頂點以 KD-tree 對到母檔物件，分成地面、底座、邊條、植被、水體、道具 | 距離小於 2e-3 視為同一點 |
| 地面重繪 | 只動草色 texel：先用色相窗判斷是否為草（70–150°），再疊大尺度斑塊（約 4 單位）和中尺度團塊（約 0.8 單位）的 Perlin 雜訊，最後以三段色票混色 | 草原色票 `#2F5A22` / `#4A7F2E` / `#78A645` |
| 中性帶 | 外框附近的顏色調變逐漸淡出，讓相鄰地塊接縫一致 | 籠子用 12 native px；狩獵地圖不需要 |
| AO | 每隔 2 個 texel 取樣一次，每次 16 條餘弦加權射線，距離 1.2 單位；忽略 0.02 單位以內的共面薄板；忽略邊條 | 下限：地面 0.55、植被 0.42（另加底面暗化）、道具 0.6 |
| 法線 | 雙面薄片的法線一律翻到朝向固定相機那一側 | 牧場相機為 (cos52°/√2, sin52°, cos52°/√2) |
| 植被調色 | 保留明度，只把色相拉向葉綠 `#4F8A33` | 原野類 45%，設施類 30% |
| 室內／工業／特殊房間 | 不做草地重繪，只加 AO | 避免榻榻米之類的地面被畫成草 |
| 接縫補色 | 重繪過的 UV 島往外擴 8 px，填到沒有面覆蓋的空白處 | 避免 mipmap 混入舊顏色 |

## 打包與接入

1. `diorama_pack.py`：WebP 預設無損；只有在 GLB 大小超過原檔 1.15 倍時，才改用 q92。保留 RGBA。只保留仍被引用的 bufferView。輸出前斷言 Draco 區塊未變。
2. `diorama_install.py`：覆寫 bundle 內的 GLB，並更新 manifest 的 bytes 和 sha。
   - 支撐籠另外更新：`physical-ground-tops.r2.json` 的 `glbSha256` → `SUPPORT_METADATA_SHA`；cm18 還要更新 `logical-stair-bridges.r1.json` → `LOGICAL_BRIDGES_SHA`。
3. `refresh_pins.py`：從 origin/main 的版本重新推導測試釘值（friends runner、filmstrip `BASE`、remap fixture 的 currentGlbSha256）。
4. 依序執行：
   1. `node scripts/select-ranch-three-public.mjs`
   2. `refresh_contract_rows.py`（只重算本批改到的路徑）
   3. `node scripts/refresh-playtest-approval.mjs`
5. 驗證：
   - 聚焦測試要加 Node 22 locks shim。
   - 跑 `npm run build:playtest` 和 `npm run validate:playtest`。注意 worktree 的 `node_modules` 要用實體複製，junction 會被判成 `BUILD_INPUT_OUTSIDE_ROOT`。

## 光源參數（牧場，`ranchThreeScene.js`）

- 主光：`DirectionalLight(0xfff1d6, 2.7)`。
- 環境光：`HemisphereLight(0xc9ddf2, 0x5d6b45, 2)`。
- 陰影：`shadow.radius = 3`、`shadow.intensity = .82`。r185 的 PCF 支援 radius 和 intensity；`PCFSoftShadowMap` 已停用。
- 角色使用 `MeshBasicMaterial` 並設 `toneMapped:false`，所以光源不會影響角色本身；要檢查的是角色和地面背景的對比。

## 驗收

- 用正式渲染器跑前後對照（`capture_review.cjs` 搭配 `renderer-mixed.html`，port 8761）。
- 逐張比對：draw calls 和三角形不變、reduced-motion 下畫面穩定、每個 24 px 區塊的亮度變化、新增的黑色像素。
- 目視：只看先導圖、異常排名最高的幾張，以及總覽 contact sheet。
- 必須檢查：成對地塊的接縫、右緣循環、角色站在地面上的對比。
- 「美術完成」「本地已接入」「正式站已發布」三種狀態分開記錄。

腳本放在 R 槽 `cage-diorama-20261025\scripts\`（`diorama_common`、`diorama_inventory`、`diorama_process`、`diorama_pack`、`diorama_install`、`refresh_pins`、`refresh_contract_rows`、`capture_review.cjs`、`serve_review.py`、`board.py`）。這些素材只放在本地 R 槽，不進 repo。
