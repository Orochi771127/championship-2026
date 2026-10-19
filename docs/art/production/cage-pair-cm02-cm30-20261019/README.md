# 大小運動場互補（CM02 跑道＋CM30 籃球場）與同主題共享邊：本機審查

狀態：`LOCAL_REVIEW_ONLY`。只在 loopback 加 `?cageReview=polish-20261019` 時生效，正式／公開籠子美術不變。未發布、未合併 main。

## CM30 小運動場 → 籃球訓練場

- 以已審 CM30 master（opm-opus-r15）為底，以下全部不變：
  - 地基、地面、外露藍色側壁（厚度）、瓷縫邊、邊緣光、相機、燈光與外尺寸；
  - footprint、mask 與可走區（walkability 仍由 raising-ground 資料決定）。
- 移除迷你跑道、內場、跑道線、起跑線與跨欄。
- 新增：
  - 綠松色球場、赤陶色禁區、奶油色場線（邊線、中線、中圈、罰球圈、三分線）；
  - 兩座籃架：立柱、籃板、橘色籃框，籃網為分件；
  - 場邊木長椅、球車。
- 球場長軸斜 24°：兩面籃板都朝向鏡頭，兩座籃架都在六角形內。
- 籃網列為 wind 分件，在 ambient 層真實擺動。立柱與籃板有前景遮擋，角色走到後方時會被遮住。
- CM02 保留已審跑道與球門（含球門前景遮擋），沒有重畫。兩者一大一小互補，不重複同一運動。

## 同主題共享邊

- 預設每個籠子保留完整瓷縫邊、外露側壁與厚度。
- 只有被列為大小配對的兩個籠子，各自的六角邊在世界座標中落在同一線段時，才在該邊兩側蓋上「去邊縫」小貼片，讓兩塊地面連成一片。
  - 比對方式：線段中點距離 ≤ 8 px、長度相近、方向平行。
- 拆開、移位或重新進場時，會依實際擺放重新判定，邊縫自動恢復。非配對相鄰（如 CM02 旁的 CM16）不處理。
- 下方側壁（藍色 fascia）在下方鄰格存在時，原本就被後畫的鄰格地面蓋住，不會出現重複的牆。
- 貼片取自同一 master、同一打光：關閉瓷縫、地基、側壁與邊緣光後重新渲染，邊緣像素以地面色向外延伸。每片只限該籠子自己的 alpha。
- 配對表依 `CAGE_PAIRING_AND_EDGES.json` 列入七組（CM02/30、05/34、07/35、10/37、09/39、18/32、31/16）。目前只有 CM02/30 產生了貼片，其餘六組待各自重做後補上。
- 旋轉維持關閉，放置規則不變。

## 來源與重建

工作目錄：`R:\Projects\Championship2026\map-polish-20261018\cage`（cm30/、edges/、ids-cm30bb/、qa/）。

1. `blender -b --factory-startup --python source/build_cm30_basketball.py -- <CM30 r15 master.blend> cm30/master-basketball.blend`
2. `blender -b --factory-startup --python source/polish_cage.py -- cm30/master-basketball.blend polish/batch/field_cm30_01-00.png --pad 0`，再執行 `tools/pack_polish.py`。
3. 前景遮擋與 ambient：`build_ids.py` → `build_amb_ids.py`（籃網列入 wind）→ `build_ambient.py` → `build_foreground.py`，環境變數 `CAGE_MANIFEST` 指向 polish 審查清單，`CAGE_REVIEW=polish-20261019`。
4. 共享邊：`polish_cage.py ... --segments`（完整版）及 `--hide "^flush-porcelain-joint|-foundation$|^shallow-blue-fascia|^continuous-rim-light"`（無邊縫版），再執行 `python source/build_edge_patches.py edges <repo> polish-20261019 field_cm02_01,field_cm30_01`。
5. 原 CM30 polish 跑道圖保留在 `polish/batch/field_cm30_01-00.track-polish.png`，git 歷史中也有。

## 已驗證

- `tests/championship-cage-shared-edges-cases.mjs`（2/2）：貼片對應正確的 polish 畫格；配對相接時兩側都上貼片；拆開或非配對時不上。
- cage polish、前景、ambient 三組審查測試共 8/8。
- 正常牧場流程（QA 存檔；只在測試瀏覽器內把 CM30 放在 CM02 旁的合法格），1280×720：
  - 相接時兩張貼片圖都載入，邊縫消失（`shared-edge-before-after.png`）；
  - 拆開時只讀 index、不載貼片，CM30 單獨完整（`separated-state.jpg`）；
  - 桌機 p95 16.8 ms。
- 受控遮擋渲染（`cm30-hoop-occlusion.png`）：立柱在角色身後時遮住角色，在角色前方時被角色蓋過。

## 未完成

- 其餘六組大小籠子的互補重做與貼片。
- 直向、拉遠、低畫質、reduced motion 的完整錄製。
- 角色沿共享邊行走的時間序列。
- 實體手機驗收。
- 使用者美術驗收。

## 精修階段（2026-10-19 第二輪：材質、灌木、可走範圍）

使用者回饋：籃球場保留；地形材質與樹不能只是一顆球，要像小灌木叢；周圍不要雜草（大小籠相拼時邊緣草會產生邊界感，除非兩塊用同樣處理）；最下角缺角；每張圖要設定好可走範圍；角色遮擋要保留。

粗糙原因與修正：

| 原因 | 修正 |
|---|---|
| 地面一整片平塗米色，沒有顆粒、土塊、磨損或卵石 | 土地材質加入顆粒、土塊、較深的磨損區、卵石與凹凸 |
| 灌木是光滑綠球（像玩具） | 每叢改為 3–5 個大小不同、低而外擴的葉團，由數百片葉片組成，底部有伸出的細枝；葉色由深綠漸亮 |
| 球場是平塗顏料 | 壓克力細紋與淡淡磨損 |
| 邊緣雜草造成拼接邊界 | 邊界帶不放草；只在內部少量草叢及灌木底部放草；大小兩塊用同一規則與同一土地材質 |
| 最下角被 448 px 畫格切掉 | 改用與 CM02 相同的 8 native px 外擴（448×512），完整顯示最下角與側壁 |
| CM30 的可走資料仍是舊跑道 | 審查用 walkability：籃架立柱、長椅、球車所在格不可走；clearance 依原資料同一規則重算 |

- CM02 同步精修：內場改為細密短草，灌木改為灌木叢，土地材質與 CM30 相同；跑道、球門、欄架與可走範圍不變。
- 球門前景遮擋已依新畫格重建（`cageForeground.js` 的 sourceHash 已更新），受控檢查六個位置都正確（`cm02-refine-goal-occlusion.png`）。CM30 籃架遮擋見 `cm30-refine-occlusion.png`。灌木屬 wind 動態，由 ambient 層依地面深度與角色一起排序。
- 共享邊貼片已由新畫格重切。正常牧場流程相接時，兩張貼片圖都會載入。
- 建置：`source/refine/cage_refine_one.sh <fieldId> <master.blend> 32 <repo>`，接著執行 `pack_refine.py <repo> <fieldId>:32,...`，再執行 `build_edge_patches.py`。
