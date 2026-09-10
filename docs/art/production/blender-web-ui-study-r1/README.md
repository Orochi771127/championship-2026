# Blender、Godot 與生成式 UI 的製作路線評估

日期：2026-09-06。狀態：**工具與架構評估完成；新增 UI 美術方向稿；正式引擎遷移未啟動。**

本次 Owner 希望使用美術包的角色與地圖作為參考，在 Blender／Godot 製作遊戲，並以 IMAGE2 製作 UI。詢問 Godot 用途後，Owner 回覆「我不知道怎麼做比較好」。因此本文件是依目前產品目標作出的工程建議，不是 Owner 已核准全面改用 Godot 的紀錄。

## 本次建議

延續既有 DOM UI＋PixiJS 2D 遊戲；Blender 作為離線美術製作工具；生成式圖像工具負責 UI 材質與視覺方向。Godot 留待有具體原生平台或 3D runtime 需求時，以獨立小場景評估。

Blender 與 Godot 分工不同：Blender 製作模型、材質、骨架與動畫；Godot 負責執行遊戲、場景、輸入、UI 與存檔。把參考圖匯入兩者，不會自動得到原作玩法、動作綁定或完整遊戲。對已有可執行 Web 架構的本專案，現在換引擎需要重新整合已存在的 JavaScript 系統、UI、輸入與存檔契約，因此先以美術產線改善畫面。

| 內容 | 建議製作方法 | 交付與原有接點 |
| --- | --- | --- |
| 角色 | 原作姿勢參考、既有身分設計、可編輯像素稿；Blender 只協助需要的體積／遮擋研究 | 原 Main/Sub key、frame、tick、mode、origin；既有 atlas 與角色動畫讀取器 |
| Raising／Hunt 地圖 | 保留原構圖、分層、模組與物件位置；必要時用 Blender 輔助離線構圖／光影 | 分層 PNG／WebP 與原有 map bundle；碰撞、放置、可走區仍讀原有資料契約 |
| 經驗證或 Owner 核准的 3D | Blender 原創／獲授權模型，檢查材質、軸向、pivot 與動畫 | GLB／glTF，進既有 bounded 3D 呈現接點 |
| UI | 生成一致的框線、底板、圖示方向，再個別製作元件 | DOM/CSS 繪製文字、數值、互動與響應式排版；圖像不持有狀態 |
| Godot | 暫無必要加入目前正式產品 | 若日後評估，先測單一場景的觸控、載入、效能、存檔與瀏覽器相容性，再決定是否遷移 |

Godot 官方支援 GLB/glTF，亦可透過本機 Blender 把 .blend 轉為 glTF 後匯入：[3D 格式文件](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/available_formats.html)。Godot 可以匯出 Web，但目前文件列出 WebAssembly／WebGL 2.0、Compatibility renderer 及手機效能等條件：[Web 匯出文件](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)。這些能力說明 Godot 是可行選項，不能證明它會讓這份既有產品更快完成；保留目前引擎是本次工程判斷。

## 已核對的現況

- cwd 是 R:/Projects/Championship2026；該父目錄不是 Git repository。
- 正式 Git root 是 R:/Projects/Championship2026/championship-2026；branch main；HEAD d0c48f340baac61cf399bf5bd5922ce58f3d38c7。
- 共享樹開工前已有大量修改；本次新增內容只在本資料夾。
- 實際參考包為 R:/Projects/Championship2026/YDIJ_PRIVATE_ROM_ART_PACK；Owner 訊息中的 YDIJ/_PRIVATE/_ROM/_ART/_PACK 不存在。
- Blender 已以 executable --version 實測為 4.5.13 LTS，位置 R:/Tools/Blender/4.5.13/blender-4.5.13-windows-x64/blender.exe。
- 在 PATH 及已檢查的 R:/Tools 第一層未找到 Godot；沒有作全機安裝盤點，不能聲稱全機不存在。
- 現有 Blender 研究檔見 ../tooling-pilot-r1/blender/m201-offline-pose-proxy.blend。既有報告明確拒絕通用 Dragon proxy 為 M201 替換稿，原因是嘴型、尾巴及 rig 不適配。本次沒有新增角色 model 或重跑舊 render。
- 角色最新計畫是原生像素與動作相容的 224 實體外觀製作；沒有從「用 Blender」推導出全角色改成 runtime 3D。
- 依本次使用者 AGENTS 指示，原作／decoded 素材在本次僅供研究參考。未將任何原作像素加入 shipping runtime。

## 新增的 UI 視覺提案

檔案：ui-component-direction-r1.png。提示詞：prompt.txt。來源與 QA：manifest.json、qa.json。

這是一張 1536×1024 不透明象牙色底的元件方向板，服務於後續 9:16 UI；方向板本身不是 9:16 遊戲畫面。內容包含四區空白資訊條、姓名／資訊面板、三種按鈕狀態與八個既有工具主題圖示。八個圖示以兩列排版只為展示素材，並非修改遊戲 toolbar 佈局或宣稱原作按鈕排序已驗證。

生成方式為內建 image_gen 工具；使用者指定的名稱為 IMAGE2，但工具未提供模型版本選擇或回傳模型 ID，因此 exact model verification 保留 UNKNOWN_TOOL_NOT_EXPOSED，不能聲稱已核驗特定模型版本。保留原始生成檔，沒有使用未經允許的替代 API。

模型可見檢視：金框、藍綠面板、象牙底和八個圖示的風格一致；無可見文字、地圖或角色；所有元件均在畫面內。左右尖角僅為框線裝飾，不能據此增加導航功能。三種狀態示意的灰色版本仍有金框，後續互動呈現需檢查辨識度與對比。

此圖未切片、未建立透明單元件、未做實際手機尺寸圖示辨識驗證，也未放入 assets/production 或 production index。完整方向板不應直接作為 UI 全螢幕背景或自動當成 atlas。進入程式前應分別製作元件、確認邊界與 alpha、必要的九宮格伸縮區及 normal/selected/disabled 狀態，再使用既有 manifest/index 登記方式。

## 檢查与邊界

本次檔案／圖片檢查與既有 focused／regression 命令的實際結果見 qa.json。沒有改 runtime，因此沒有把先前瀏覽器 QA 算作本次 UI 接入驗收。

- 已完成：資料位置與架構核對、Blender 版本確認、Godot 文件核對、UI 方向板與提示詞／來源記錄。
- 部分完成：UI 美術方向有新稿；仍待逐元件製作及實際畫面驗證。
- 未知：確切生成模型 ID、待追證的原作角色／地圖行為；維持 UNKNOWN，不由圖片補規則。
- 尚未開始：Godot 遷移、新角色或地圖模型、這張方向板的 runtime 整合、手機裝置 QA。
- 下一個安全步驟：從這張方向板選一組空白面板與既有工具圖示，依現有 Raising Home 的實際尺寸個別製作並驗證；沿用原有 DOM 元件、callback 與存檔。

## 本次查閱的產品依據

- AGENTS.md、README.md、docs/coordination/OWNER_DIRECTION.md
- docs/architecture/CHAMPIONSHIP_2026_ARCHITECTURE.md
- docs/coordination/CHAMPIONSHIP_RUNTIME_ARCHITECTURE.md
- docs/CURRENT_PRODUCT_STATUS.md、CHAMPIONSHIP_DEPENDENCY_MATRIX.csv、CHAMPIONSHIP_BLOCKER_LEDGER.csv
- docs/contracts/championship/CHAMPIONSHIP_PRESENTATION_PACK_CONTRACT.v1.json
- docs/contracts/championship/CHAMPIONSHIP_TOOLBAR_CONTRACT.v1.json
- docs/contracts/championship/CHAMPIONSHIP_STATUS_BAR_CONTRACT.v1.json
- ../tooling-pilot-r1/README.md、HUD_REVISION_R2.md、ui-candidate/source-map.md
- 實際 app source 中的既有 ChampionshipPersistentSavePort 與 championshipScreenStack 接入。
