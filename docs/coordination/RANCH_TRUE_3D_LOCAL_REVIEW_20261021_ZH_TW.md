# 固定視角 3D 籠子：本機候選與驗證紀錄

日期：2026-10-21。本文前半記錄本機整合階段；公開 playtest 候選的後續自檢見文末。Owner 尚未完成實體裝置與商業美術驗收。

## 本輪有效需求

依本對話較新的 Owner 指示，育成籠子改成真正 3D 地圖，角色保留原有 2D 圖集，固定相機，不安裝旋轉系統。這項明確授權取代早期交接文件只使用 2D 底圖的限制。本輪不改戰鬥、元素反應或探索經濟。

後續新增要求已納入：額外連接路徑不可見；保留通行資料，不在水面、草地或地板上畫膠囊／貼片；工廠輸送帶可以站立並帶動角色。低障礙自動小跳已討論其適用條件，**本輪尚未加入跳躍系統**，不把樹、牆或無落腳處的水域視為可跳過障礙。

## 工作區與來源

- 工作區：`R:\Projects\Championship2026\ranch-fixed-art-polish-20261021`
- 基底：detached HEAD `5a9ea1c4f8be0ad76e3149ebce9c355234d0dfcf`；從本任務開始時核對的 main 建立。
- 外部模型及證據：`R:\Projects\Championship2026\ranch-fixed-art-assets-20261021`
- 原始來源依 `sources.json`、既有綠色運動公園及 CM24 來源追溯。原始 masters 保留；修正版為外部 `masters/<field>/refined.blend`。
- 每項可編輯交付：外部 `three-masters/<field>/editable.blend`。合併靜態網格、烘焙材質的輸出場景另存 `export.blend`，不取代可編輯場景。
- 每項來源與 GLB SHA-256、可編輯檔案存在檢查：外部 `model-delivery-receipt.json` 及逐項 `three-masters/<field>/receipt.json`。
- 其他 worktree（包含舊混合 prototype）未 reset、clean 或整庫 add。

## 實作

1. 35 種可配置籠子、固定等待區及未配置格蓋，共 37 個 GLB，放在 `assets/production/cage/three-20261021/`。模型共有約 93 萬三角形、99,655,520 bytes；這是全部唯一模型合計，不是每次畫面的下載量。
2. `ranchThreeScene.js` 使用既有 Three.js，52 度正交固定相機，跟隨既有牧場拖動及 70%／100% 縮放。只由現有 Pixi ticker 呼叫；不建立第二套模擬、存檔、路由或 RAF。
3. 角色仍使用原來的 2D 圖格、翻面、動畫和互動容器，轉接為參與 3D 深度測試的 billboard。對照過原 Pixi 畫面，修正 ImageBitmap 的 UV 方向及 packed atlas 的 trim 邊界，避免錯幀／拉大。角色、食物與廢棄物依實際平台高度顯示；指標操作也由可站立面的投影反算地面座標，避免點在平台上卻選到後方平地。
4. 地塊只使用既有格位的平移，沒有六角變形矩陣、非等比例壓縮或裁切設備。保留 CM30 原本的直角建模；CM26／CM27／CM32 沿用逐項檢查過的修正版。
5. 草原、火山入口、部分樹冠、花壇／長椅及工廠設備調整採整組剛體平移。碰撞由 Blender 評估後的各物件接地幾何建立；不把多個獨立柱腳之間的空間填成實牆，小草與小花也不誤當整格障礙。
6. 連接路徑只存在於導航。3D 不建立路徑 mesh、不載入路徑 atlas；2D fallback 同樣不疊加路徑。原模型的橋與階梯保留。
7. 工廠輸送帶與作業機械臂一起平移 native `(0,-16)`，保留全部部件與動畫；4 個機械動畫 clip 載入既有 ticker。輸送帶的高度、範圍和方向從實際 Blender 帶面匯出到 `ranch-conveyor.r1.json`。
8. `stepRanchConveyor` 在既有育成模擬 tick 加入每 tick 0.14 native pixel 的帶面位移。自行行走仍有效，離開帶面即停止。抓取、拋起、進化、訓練與已預約餵食的控制流程優先；不消耗 RNG。位移檢查阻擋、格界及實際所屬籠子。
9. 工廠帶面超出舊 2D 行走導引的部分，依實際帶面與既有占格聯集補上可站立範圍，沒有增加土地或穿越凹形缺口。其他物件阻擋仍套用。
10. 模型材質保留原始色彩、透明水岸與粗糙度／金屬度；靜態部分合併材質與網格。只下載已配置的唯一模型，畫面外實例不繪製；GPU 紋理依省電／均衡／高品質使用 512／1024／2048，上游原始圖不降尺寸。減少動態設定停止機械動畫。

## 證據索引

以下路徑均相對外部證據根目錄 `ranch-fixed-art-assets-20261021`，不是線上發布證據。

| 證據 | 結果／用途 |
|---|---|
| `focused-tests-final.txt` | 60/60：3D 座標、平台點選、裁切圖格、輸送帶、占格、出生位置、固定方向、探索與縮放等相關測試 |
| `three-navigation/all-cages.json` | 35 種、528 個合法相鄰配置；493 個可接通邊、423 個保持封閉邊；沒有完全無連接的定義，沒有阻擋穿越 |
| `three-navigation/native-walking.json` | 105/105：35 種 × 正常／快速／慢速；含輸送帶的模擬位移 |
| `audit/model-bounds.json` | 評估後物件頂點與每個物件投影凸包對實際六角占格聯集檢查，包含凹形缺口；37 項均無出界或跨缺口紀錄 |
| `model-delivery-receipt.json` | 37 項 GLB／來源 hash 相符、可編輯 master 齊全 |
| `per-model-review.csv` | 逐模型檢查紀錄、對應遊戲截圖、已修內容與尚待藝術精修的差異；包含 CM09／CM39 水面紋理一致性待修項 |
| `three-all-cages-delivery/` | 最終逐籠 100%／70% 遊戲截圖與 report；每張需有實際 3D render frames，額外路徑 atlas 請求為零 |
| `three-representatives-final/` | 草地、火山、健身房、運動公園、水景、工廠六組代表場景；0 page errors／缺檔／碰撞警告 |
| `three-browser-delivery/fixed-browser.json` | 390×844、844×390、1280×720：正常 DOM 取回／放置／確認／返回、探索手帳領取、存檔重載；無旋轉控制與旋轉素材請求 |
| `three-zoom-delivery/zoom-browser.json` | 三尺寸雙指／滾輪、70%／100%、角色選取、正常指標抓取／釋放與攜帶捲動畫面 |
| `three-food-delivery/` | 神殿、工廠與廟宇的正常點選放食物、庫存扣除、3D 食物圖格及平台高度檢查 |
| `three-sprite-parity/` | 診斷用同場景 Pixi／3D 角色圖格對照；測試專用暫停與渲染切換，不是正常玩家流程證據 |
| `three-conveyor-transport-final/` | 控制存檔把原有蛋角色放在帶面，正常遊戲更新期間維持 state 26，30 次取樣中移動約 `(31.31,15.63)` native pixels；含短片、WebGL context loss／restore 成功 |
| `three-conveyor-transport-final/conveyor-preview.mp4` | 原始瀏覽器錄影第 4–9 秒片段；排除後續刻意觸發的 context loss 診斷，沒有生成或替換遊戲畫面 |
| `three-conveyor-pointer-r2/` | 正常滑鼠抓取及釋放成長角色的遊戲短片；不可把這段單獨當成站定輸送帶測速證據 |

代表場景在本機桌面 Chromium 的 RAF 中位數約 16.7ms；這是瀏覽器模擬與此桌面硬體的結果，**不是實體手機效能驗收**。畫面 draw calls 約 168–208（包含可見未配置格蓋與陰影），三角形約 43–63 萬；沒有把全部模型合計當成單幀數字。

## 本機檢視與重跑

本機預覽：`http://127.0.0.1:8745/championship.html`。使用獨立 origin；未操作 Owner 的 8732 存檔。服務啟動方式為設定 `CHAMPIONSHIP_PORT=8745` 後執行 `node scripts/serve.mjs`。

資料驗證：

```powershell
node scripts/audit-ranch-connections.mjs R:\Projects\Championship2026\ranch-fixed-art-assets-20261021\three-navigation
node scripts/audit-ranch-walking.mjs R:\Projects\Championship2026\ranch-fixed-art-assets-20261021\three-navigation
node --test tests/championship-ranch-three-cases.mjs tests/championship-ranch-conveyor-cases.mjs tests/championship-product-grid-ground-cases.mjs tests/championship-ranch-discoveries-cases.mjs
```

Blender scripts 透過既有已安裝 Blender Lab MCP addon 的專用背景連線 9877 執行；未關閉或改寫使用者 GUI 工作。重新匯出模型前需先核對 `three-jobs.json`，不能盲目重跑模型搬移腳本。

## 明確界線與後續

- 本輪是可本機檢視的 3D 系統及模型候選，不等於全部籠子已達商業美術終稿；部分既有造型、重複地面紋理與水面仍有後續精修空間。
- 沒有加入任意旋轉、六方向素材或跳躍控制。純 3D 模型的剛體轉動不會新增形變，但未承諾現有格位配置在任意方向都可放入。
- 現有 100 格產品牧場走 3D；舊版佈局及 3D 載入失敗仍保留既有 2D 相容路徑。配置介面的原有縮圖未改成另一套 3D 編輯器。
- 原有 2D 選取、接觸陰影和部分回饋特效仍由 Pixi 控制；主要角色身體及模型使用 3D 深度遮擋。大型特效、完整水面／植栽動態與實體手機的長時間壓力測試，尚不能標為完成。
- 沒有安裝新依賴、沒有執行對外 glTF 壓縮服務。現有環境未安裝 glTF Transform CLI；這批使用 Blender 靜態網格／材質合併、貼圖烘焙與執行期紋理預算，未完成 KTX2／Meshopt 發布壓縮。
- 公開 playtest 輸入 allowlist、精確發布 hashes 與部署包尚未更新；本輪只驗證本機 source server，不宣稱已通過公開打包或上線驗證。
- 原有來源與中間候選均保留；先前可見路徑的材質檔案仍留作製作紀錄，runtime 不引用。

## 後續公開 playtest 候選自檢

Owner 後續明確要求自我審查後 commit、push 與部署，因此上面「尚未更新公開 allowlist／不部署」是本機階段的歷史狀態。發佈候選保持同一套 37 個真正的 GLB 3D 模型，沒有烘成 2D 底圖。Blender 以 Draco 壓縮網格、WebP 壓縮材質貼圖；`three-masters/<field>/editable.blend`、`export.blend` 與未壓縮 GLB 均留在外部製作區，不覆寫原始 masters。公開 GLB 合計 8,453,760 bytes；較重要的工廠、籃球場、花壇使用 1024 貼圖，健身房、等候區、CM09／CM26／CM27 使用 512 貼圖，其餘使用 256 貼圖。WebGL 實際載入和渲染網格、材質、深度遮擋與 CM15 動畫。固定相機、2D 角色、隱形導航通路和工廠帶動位移不變。

公開模組與 37 個 GLB 都由同一 Pages origin 提供；manifest 記錄每項 bytes／SHA-256，載入前逐項驗證。Draco 解碼器一起收進精確選取清單。公開打包結果為 8,188 個檔、999,687,119 bytes，低於本專案 1,000,000,000-byte 契約；最後跨平台 LF 版的 build ID 為 `e3874d0dca913c68addf28492933ff440f7a5f8231149f7c48c48c993168ca0f`。打包器原本的 `keepNames` 會把漏帶輔助函式的程式碼放進 Draco Worker，造成 `T is not defined`；已關閉這個打包選項，以瀏覽器直接載入打包成品驗證修正。首次 GitHub 打包又指出三個 JS 來源的 Windows CRLF 工作區雜湊與 Linux LF 不同；已將來源工作區統一為 LF、重算公開選取雜湊，並在選取腳本加上防止重犯的檢查。

- `audit/ci-after-draco-fix.txt`：最終 `npm run test:ci` 2,759/2,759 通過；舊測試已依新授權改檢查 Pixi 不自行建立第二套渲染器。
- `audit/compressed-all35-final/`：壓縮候選的 35 種籠子逐張遊戲截圖與 report；每張有實際 3D 畫格，0 page errors／缺檔／警告；`contact-1.jpg`、`contact-2.jpg` 為逐張總覽。
- `audit/compressed-final-qa/`、`audit/compressed-gym-512/`：代表場景、健身房對照。低解析度棋盤和工廠地面的可見模糊已以較高解析度候選修正。
- `audit/build-lf-portable.txt`、`audit/validate-lf-portable.txt`：跨平台 LF 修正後的公開打包與選取驗證；`node scripts/assert-public-payload.mjs dist/github-playtest` 必須回報 `PUBLIC_PAYLOAD_VALIDATED`、8,188 個檔、同一 build ID，且未納入私有 authority index。
- `audit/public-dist-qa-draco-fixed/`：以模擬 Pages 網址直接載入打包成品，草地／工廠均成功，0 錯誤、0 缺檔、0 外站模型請求；CM26／CM27／CM30／CM32 四籠另見 `audit/public-dist-key-four/`。跨平台 LF 重算後的最終打包另以 `audit/public-dist-lf-portable/` 重驗草地場景正常載入。

這是授權的公開試玩版本，**不代表**全部 35 種美術已達商業終稿、實體手機長時間效能已驗收，或已啟用任意旋轉／跳躍。特別是部分水岸與植栽細節仍列於 `per-model-review.csv` 待後續美術精修。
