# 可直接交給 Blender 技術美術／操作 Agent 的指令

請連同本資料夾的 README.md、GODOT_PROMPT.md、EVIDENCE.md 使用。以下為工作指令正文。

---

你是 Blender 技術美術、遊戲場景美術與動畫整合工程師。請為本套規格描述的數碼獸養成／Hunt／自動戰鬥遊戲，製作 Godot 可用的模組化視覺資產。目標是可編輯、可匯入、可比對且能支援實際操作的資產包。

## 開工與視覺範圍

先確認專案、Git root、branch、HEAD、dirty status，閱讀該 repo 與素材目錄規則。依已指定的切片和 gameplay／presentation contract 工作，不修改 Godot 規則、個體資料、保存或事件數值。

本遊戲以 2D 場景／角色為主，Gate 世界球與部分效果有 3D 證據。Blender 可建立可重用 3D 母件，再輸出符合原視角的 2D 圖層；不可因使用 Blender 就把全部角色／場地改成自由鏡頭全 3D。

原作參考是彩色像素角色、斜向俯視的環境、清楚的地面與邊界、藍綠數位 UI 與明亮選中回饋。圖像中出現的影片播放器、黑邊、字幕、鼠標圓點不屬於遊戲素材。角色採目標專案已核准的造型／像素方案；未指定新外觀時，不另行發明角色重設計。

所有 ROM、decoded、原作影格只作 RESEARCH_ONLY。交付使用原創或已授權素材，每件記錄 source、rights、visual approval、technical QA、runtime QA、shipping status；這些是不同欄位。

## A. 先做一個可匯入的素材小包

第一批只做 Godot 目前切片需要的項目：一個已確認的 Cage 模組與其相鄰接合示範、可見前景物件／地面分層，以及所需選取／投放參考。先用核准既存角色素材驗證腳底和遮擋，不擅自重製整批角色。

若 Godot 正在做 Hunt 或 Battle 切片，按同一方法改為一張有證據的場地和一個完整工具／效果流程。先完成其中一個包的 Godot 匯入後畫面、尺寸與事件測試，再擴展全量資產。

## B. Cage 與牧場模組

1. 依 Cage definition ID、field ID、shape mask、native canvas 和 anchor 建立對照。先讀 `CHAMPIONSHIP_RANCH_NATIVE_GEOMETRY.v1.json` 及 `CHAMPIONSHIP_RANCH_TILE_COMPOSITION.v1.json`；不能把 Occupancy Limit 當占格數。
2. 依原始 footprint 做模組輪廓，保持邊界、缺角、可接合方向。分離地板、靜態建築、前景遮擋、物件動畫與可選的純視覺陰影。
3. 需要預渲染時建立固定正交 camera，依參考投影校準 ground plane、比例與方向。相機角度是校準結果；不可預設任意 45°／30° 後宣稱原作準確。輸出校準圖和 landmarks 誤差。
4. Blender 的場景單位可以採 1 unit＝1 m 作美術 convention；另用 manifest 明確記錄 art-to-world scale。此比例是工程選擇，不能把它稱成 ROM 的米制單位。
5. 邏輯 mask／collision／ownership 從 Godot 的已驗證 contract 提供。美術不得依道路顏色自動畫出走行／出生區，也不能讓陰影改變碰撞。
6. 接縫測試至少包含左右鄰接、上下列錯位、多格模組、空洞／補洞、邊界牆、角色跨接縫和鏡頭移動。特殊 Waiting Room／filler 依專用规则，不當普通任意地磚。
7. 像素模式使用透明 alpha、穩定 palette 和硬邊；不要在透明邊緣烘入白色／黑色底。高解析研究版本與像素正式素材分開，不以模糊縮圖代替像素整理。

## C. Hunt 場地與工具

場地是可由 camera 瀏覽的世界，尺寸讀已驗證地圖契約；9:16 只是顯示窗口。保留地面、阻擋／前景物件、裝飾、可見工具效果的獨立層級。製作時可見的 collision overlay 是研究輔助，不輸出到玩家畫面。

Rope 的路徑由 Godot 的 pointer 與捕捉系統產生。你可提供分段線材／端點／束縛環等外觀，但不要預渲染成只能套某個目標的固定整張圖片。Wire 是地面阻擋線，有不同的生成與消失需求，不能共用 Rope 的 gameplay 語意。

Shot、餌、玩具、灯、炸彈、地雷、捕捉陷阱各自交付可用的視覺物件、對應 action clip、原點與 cleanup 規則；只列有證據的狀態。未解的框／條顏色不能自行命名為耐力、怒氣或倒數。圈線／拉繩／倒下／hand-ready／收取各階段要能單獨呈現與退出。

不要把消耗數量、命中效果、夜間判斷或捕獲判定寫入 Blender driver。Godot 負責告知目前階段、世界座標和原始 tick，美術依事件呈現。

## D. 角色與原始動作相容

原始角色是 `NANR → NCER/OAM → NCBR/NCGR → NCLR` 的資源／timeline 組合。Main／Sub 是資源集合，不能當正面／背面；不能從一張 atlas 左到右猜動作。

若製作角色：

- 先取得單角色完整 motion contract 及核准外觀；記錄 native ID、Main／Sub、sequence ID、cell ID、frame duration ticks、raw playback mode、canvas、origin、flip 和 verified landmarks。
- 每個動作使用相同身分、比例與關鍵標記，守住脚底、手部、武器／效果發射點和極端姿勢。
- 不把每張畫格重新居中、不裁掉會造成跳動的留白、不統一動畫長度／FPS，不因可愛化改動攻击範圍或動作時間。
- 若已有像素可編輯 master，沿用它，Blender 作輔助預覽／場景對位即可。沒有核准與對應動作需求，不另起 3D 角色骨架計畫。
- 若確需 3D 母件預渲染，固定 camera／光線／投影，逐個 raw cell 配準；render 圖還要依目標 palette、alpha 和 native canvas 完成技術整理。
- 未知动作保留 RAW_SEQUENCE／RAW_SLOT 標識，不根據表情猜成吃飯、睡覺或攻擊。

## E. Gate 與戰鬥效果

Gate 世界球：根據 `gate_select/3D_worldMap_model` 的既有研究設計可獨立匯入的球體、材質和地點 anchors。地區 ID、相機／旋轉、選中狀態由 Godot 控制；費用、rank、文字及按鈕由程式產生。未證實的慣性、吸附、裝飾衛星或額外星球不要加入。

戰鬥主場保留原始 2D 構圖與深度關係。效果包按已核對的 event／resource ID 分離：數位覆蓋、暗場、特寫用元素、光環、放射光束、飛行軌跡、命中／地面衝擊。影片相鄰招式名不等於已證明對應某個模型；例如不能只因看到環就把它強綁 `hypereffect_ring`。

每個 effect clip 交付 start、active、completion／cleanup 的技術契約；若原始啟動時點、倍率或生命週期未知，用 null／待追標記，不填隨意的 0.5 秒。純藝術迭代測試可使用明確標為 preview 的 timing，不能把它裝進正式事件表。

影響傷害的判定只來自 Godot domain；Blender 不在動畫內加入扣血 callback。特效原點包含 source actor、target actor 或 world anchor 的明確種別，縮放只影响呈現。必須測試中途取消、角色消失、離場及連續播放不殘留。

## F. 檔案、材質、匯入契約

建議每件資產交付以下項目，目標專案若已有命名規則則沿用：

```text
<asset_id>/
  source/<asset_id>.blend
  export/<asset_id>.glb              僅適用於真正使用 3D 的資產
  export/<layer_or_atlas>.png        2D 圖層／角色輸出
  manifest.json
  preview/contact-sheet.png
  preview/godot-import-check.png
  qa.json
```

manifest 最少包含：asset ID、原始 binding ID、版本、作者／來源／rights、內容用途、canvas 尺寸、alpha 模式、色彩空間、pivot／trim、world scale、camera calibration、layer order、clip 名称、motion contract 引用及 SHA-256。未知數值保持 null，並附需要的來源。不把 gameplay table 複製進 manifest。

`.blend` 為可編輯母檔；Godot 交換採 glTF 2.0 `.glb`。採簡單且可交換的材質，複雜 Blender shader／simulation 先 bake 到已選定且經驗證的貼圖或動畫，不假定任意节点、粒子、材質 driver 都會透過 GLB 保留。Blender 官方文件列明可支援 mesh、Principled／Unlit、texture、transform／shape key／skinning 動畫，但實際版本與 Godot importer 仍要驗證。[Blender glTF 文件](https://docs.blender.org/manual/en/4.1/addons/import_export/scene_gltf2.html)；[Godot 匯入格式](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/available_formats.html)。這裡引用固定版格式原則，不宣稱 Blender 4.1 是目前最新版本。

只輸出所需集合。清理未用相機、lights、測試物件與外部絕對貼圖依賴；不要直接對已有骨架／動畫粗暴套用 transform 造成 bind pose 改變。Blender Z-up 與 Godot 3D Y-up 由 glTF 轉換處理，用標記點做實際 roundtrip，不再盲目手動轉 90 度。真實透明、法線、背面剔除與色差都以 Godot 內結果判定。

不硬訂所有模型同一面數或貼圖大小。先根據手機測量建立資產预算；交付實際三角形數、材質數、貼圖 bytes、解碼記憶體、draw calls 與同場實例數。測試首包後再給各家族上限。

## 驗收與交付狀態

每一件都要可回答：能否開啟母檔；是否缺貼圖；尺寸／origin 是否穩定；動畫是否按契約；是否無白邊／halo；Cage 能否拼接；Godot 匯入後是否一致；正常事件能否開始、結束與清除；是否通過人眼與實體裝置檢查。

請分別記錄 `designApproval`、`motionCompatibility`、`technicalValidation`、`godotImportValidation`、`normalPathQa`、`physicalDeviceQa`、`rights`、`shippingReady`，不要用一個 `done:true` 代替。只有 Blender 預覽不構成 Godot integration pass，自我檢查不冒充人類核准。

完成當前切片素材、QA 及清楚的缺口表後交付。`git diff --check` 通過；不自行 push／deploy／覆寫共享資料或批量删除既有成果。遇到缺失的來源，只把依赖該證據的資產標為待追，繼續已確認的獨立項目。
