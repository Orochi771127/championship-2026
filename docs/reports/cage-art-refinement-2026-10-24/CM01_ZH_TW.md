# CM01 空地精修與局部微風

本批沿用既有 CM01 Blender 母檔，以原作空地構圖作研究參考。修正地面匯出只選到草色材質而失去土面、管口粗多角與草葉穿管，保留後側樹和木柵、前側三管、石塊及既有固定鏡頭。原作像素未進入成品。

CM07 r3 保留。2026-10-24 起點公開版為 `c67ca6adac37196d40f54bdceee2a37d97179ced`，37 張 manifest 與本地相符；重新下載 CM07 公開 bytes，SHA256 與既有 r3 相符。

## 本批內容

- 土面改為單一可烘焙的土色／後側草帶材質；原地表頂點、三角面與高度保持。
- 使用原三管中心線與半徑重建中空管壁、內壁和圓滑管口；處理管內穿草。
- 柔化現有樹冠六個分塊，細化草尖、木材與混凝土材質。
- 公開 GLB 分為靜態地形、樹冠、草葉三組，共用兩張 1024² 貼圖。只對精確命名的樹冠／草葉施加微風；樹幹、根部、柵欄、水泥管和地面固定。仍由既有 ticker 驅動，沒有新光源、粒子或依賴。
- 未修改角色動畫、存檔、玩法、狩獵地圖、相機或空間換算。

## 美術與空間自審

已目視原作研究圖、舊公開 GLB、r1/r2/r3 母檔輸出與 r3 解碼後實際牧場 renderer。r1 發現粗管口與穿草，r2 修管口，r3 移除穿管草葉。實際 renderer 的 before/after 使用相同固定鏡頭。相鄰驗證使用 `productFieldTileOrigin` 的真實 slot16、slot18，接點為 native `x=864, y=0..64`；另檢查 `+960` 水平循環。未見幾何裂縫、缺貼圖、管內穿草或整張地圖晃動。保留既有土面圖案的局部色差，不宣稱所有籠子接縫已驗收。

Blender 逐頂點核對31個既有地表、地基、邊界、柵欄與石塊物件完全一致，世界頂點資料 SHA256 `a9cbbde26fd14a044a1c430059d67e9619d041e28d264690606e8471f2ab46ae`。草葉與管口的外型修改不更動玩法碰撞資料。角色腳底及地面陰影使用既有空間關係，本批沒有改成角色永遠置頂。

## 成本

| 指標 | 修改前 | CM01 r3 |
|---|---:|---:|
| GLB bytes | 238,860 | 746,348 |
| 模型三角形 | 7,228 | 10,220 |
| GLB primitives | 1 | 3 |
| 單張 renderer draw calls（含陰影 pass） | 2 | 6 |
| 單張 renderer triangles（含陰影 pass） | 14,456 | 20,440 |
| 公開貼圖 | 2 × 1024² | 2 × 1024² |
| 理論 RGBA8＋mips | 11,184,808 B | 11,184,808 B |

GLB 增加約 496 KiB，換得圓管、可分離的植被動態與細緻烘焙；貼圖解碼容量未增加。母檔保留 2048²。Draw calls 為 Chromium SwiftShader 的隔離實際 renderer 計數；兩張相鄰為12 calls。貼圖容量是算術估計，非手機實機記憶體，且不含 shadow map、暫存或 driver overhead。沿用現有 Draco/WebP；壓縮後逐角落驗證位置誤差不超過 `1.44e-6` 世界單位。

## 本地歸檔與驗證範圍

`R:/Projects/Championship2026/cage-art-refinement-20261024/`：

- `inventory.csv` / `inventory.json`：37張來源與基線盤點；37份歷史editable/source均存在，source雜湊符合歷史紀錄。歷史來源存在不等於每張已完成本輪精修。
- `CM01/baseline/`：舊公開GLB、舊renderer、母檔物件盤點。
- `CM01/r1/`、`r2/`、`r3/`：各版獨立母檔、匯出與成圖，可回復。
- `CM01/r3/preview/reference-before-after.png`：私有原作／修改前／修改後並排，不進公開包。
- `CM01/r3/preview/CM01-wind-4.8s.mp4`：短動態預覽。
- `CM01/r3/preview/candidate-adjacent.png`、`candidate-adjacent-right-wrap.png`：桌面真實最右側座標與循環。
- `spatial-receipt.json`、`delivery-metrics.json`、`texture-receipt.json`：空間、載入與成本證據。

隔離 renderer 無 JavaScript 錯誤、GLB載入錯誤或context loss；reduced motion畫面穩定。未執行全遊戲功能套件；人工玩法、真角色遮擋與實體手機驗收交Owner。本地build/validate與公開部署終態另記，不以本報告冒充上線。

本輪餘項：CM02–CM06、CM08–CM32、CM34、CM35、CM37、CM39、CM40，共35張；CM29為結構蓋板，按其實際用途保留。CM33、CM36、CM38不在37張公開manifest。
