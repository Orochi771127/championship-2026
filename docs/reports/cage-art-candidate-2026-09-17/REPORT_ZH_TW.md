# field_cm01_01 第一批原創 Cage 候選

初版日期：2026-09-17；藍色拼接邊與 responsive 畫面修正版：2026-09-18。狀態：`ART_PROPOSAL / LOCAL_PREVIEW_ONLY / OWNER_REVIEW_REQUIRED`。

本批只製作 `field_cm01_01`。沒有替換正式 production manifest、沒有部署、沒有 merge main，也沒有生成其他 Cage 或角色。

## 候選設計

名稱：**微風草坡育成棲地（Breeze Meadow Nursery）**。

- core：鼠尾草／薄荷色草地、平嵌暖白礦石與少量琥珀能量線，外圍改為原創鈷藍結構板、青色光帶與上／下／左／右四向接頭，四角為真透明；
- `obj-000`：低矮編織育成墊；
- `obj-001`：葉片風向標與種子燈；
- `obj-002`：葉帆幼體遮棚；
- `obj-003`：露水盆與幼芽座。

完整來源圖、prompt、生成方式、來源 SHA-256、候選狀態與輸出路徑見[候選 manifest](../../art/production/original-character-cage-r1/cage-field-cm01-breeze-meadow-v1/manifest.json)。初版地面與四物件由內建 imagegen 生成；修正版只把候選自己的原創地面送回 imagegen，新增原創四向藍色拼接邊與透明外圍。沒有把研究圖片送入生成工具，也沒有對研究圖改色、描摹或裁切成交付素材。工具沒有回傳模型 ID，因此保持 `UNKNOWN_TOOL_NOT_EXPOSED`；沒有新增付費 API 批次。

## 契約與工具

沿用 [field_cm01_01 v1 contract](../../art/contracts/cage/field_cm01_01.v1.json) 與原 Python/Pillow compositor。新增的 `--candidate` 入口只補齊完整候選包匯入：

- 必須同時有一張 96×112 core、四個固定 object canvas、manifest 與五份 prompt，並驗證五張生成來源的 SHA-256；
- object ID 必須完整且只允許 `obj-000` 至 `obj-003`；
- 少任何一張圖立即失敗，不會回退 faithful／研究素材；
- placements、pivots、source order、裁切、`placement - pivot` 與既有 geometry contract 不變；
- object source 只做透明裁切、premultiplied resize、safe-bounds contain、底部對齊與 1px 透明安全邊；
- core 依生成圖的 alpha bounds 裁切後，直接依固定契約縮至 96×112；不再強制成不透明矩形，也沒有手工 X/Y 修正；
- core 必須保留四角透明、四邊各有接頭像素，且縮圖後仍要有足量藍色邊；缺任一條件立即失敗。

候選重建命令：

```powershell
npm run art:cage:candidate:cm01
```

## 成品與預覽

- [新 core](../../art/production/original-character-cage-r1/cage-field-cm01-breeze-meadow-v1/core-native.png)
- [四物件透明邊緣檢視](../../art/production/original-character-cage-r1/cage-field-cm01-breeze-meadow-v1/previews/object-review.png)
- [合成圖 4×](../../art/production/original-character-cage-r1/cage-field-cm01-breeze-meadow-v1/previews/composite-hd4x.png)
- [2×3 相鄰接縫檢視](../../art/production/original-character-cage-r1/cage-field-cm01-breeze-meadow-v1/previews/adjacency-hd4x.png)
- [上排](../../art/production/original-character-cage-r1/cage-field-cm01-breeze-meadow-v1/previews/upper-row.png) · [下排](../../art/production/original-character-cage-r1/cage-field-cm01-breeze-meadow-v1/previews/lower-row.png) · [回捲](../../art/production/original-character-cage-r1/cage-field-cm01-breeze-meadow-v1/previews/wrap-edge.png) · [起始籠舍](../../art/production/original-character-cage-r1/cage-field-cm01-breeze-meadow-v1/previews/starting-ranch.png)

本機遊戲以 Playwright 攔截既有 `field_cm01_01/frame-00.png` request，將候選送進**同一套** production loader、Raising scene、camera 與唯一 Pixi canvas。正式 manifest 完全未修改。

- [390×844](browser/raising-candidate-390x844.png)
- [820×1180](browser/raising-candidate-820x1180.png)
- [1024×1366](browser/raising-candidate-1024x1366.png)
- [瀏覽器機器回條](browser/browser-qa.json)

角色先在 1024×1366 以遊戲既有的「手」長按、停在右緣讓原有 edge-scroll 捲動 7 秒、搬運、放開與飛行落地流程移到 cm01 開放草地；沒有寫入 runtime／camera 座標、改 save 或新增測試鉤子。[接地當下畫面](browser/raising-candidate-grounding-1024x1366.png)獨立保存。角色之後會依既有 AI 離開，因此三張尺寸圖只作場地比例與可見範圍證據，不冒充接地瞬間。

寬畫面的同一個 `raisingFieldViewport` 改為受可用高度限制的 responsive 原生像素倍率：約為 390 的 2.31×、820 的 4.06×、1024 的 4.5×。美術、角色、點擊、drop target 與 camera round-trip 仍共用同一轉換，沒有新增 renderer 或第二個場景。

## QA 結果與界線

| 檢查 | 結果 |
|---|---|
| 原素材重建 | 7/7 comparison 全為 0 changed pixels，manual corrections 0 |
| Python contract／候選負面測試 | 10/10 PASS；包含缺一 object、生成來源 hash 漂移都必須拒絕 |
| Node structural contract | 3/3 PASS |
| 候選完整性 | core 96×112；四 object 尺寸／safe alpha bounds PASS |
| 透明邊緣 | 四 object 的 canvas edge alpha pixel 都是 0 |
| core 藍色拼接邊 | alpha bounds 0,0–96,112；四角透明；上／下各 10、左／右各 11 個邊界接頭像素；藍色邊 2,166 px |
| core 透明外圍 | 1,873 個全透明像素；不再是硬切不透明矩形 |
| 上下排／回捲／起始籠舍 | 四張 deterministic preview 已生成；沒有改 placement、pivot 或裁切 |
| 同遊戲三尺寸 | PASS；同一 canvas，候選 request 1 次，page errors 0，missing resources 0 |
| 角色存在／既有接地 | 三尺寸皆有同一正常 resident，仍由現有地面與角色定位 authority 控制 |
| 角色腳底直接落在候選上 | PASS；正常「手」長按、edge-scroll、搬運／放開後落在 cm01，見獨立接地畫面。之後 AI 會移動，三尺寸圖不作接地證據 |
| 前景 actor-object ordering | **`UNKNOWN_REQUIRES_TRACE`**；目前 field 是 baked composite，不能由這批靜態圖宣稱遮擋正確 |
| 實體裝置 | 未驗收 |
| 人工造型核准 | `false`，等待 Owner |
| runtime／shipping | `false / false` |

## 請 Owner 具體審閱

1. 新 core 的鈷藍／青色四向拼接邊造型、粗細與亮度是否核准；
2. 草地／暖白礦石密度是否太高，與其他 Cage 並排時是否需要更簡化；
3. 育成墊、風向標、葉帆遮棚、露水盆四件造型是否符合想要的原創產品方向；
4. 固定 pivots 與上緣裁切後，遮棚／細柱只露出下段的效果是否接受；
5. 390／820／1024 responsive 放大後的場地占比與保留 headroom 是否接受；
6. 角色已透過正常搬運落在 cm01；請決定是否核准這個造型進入後續「前景遮擋 trace」審查。本報告沒有替 Owner 做造型或升級核准。

## STOP POINT

完成單一 `field_cm01_01` 原創候選、完整包工具入口、幾何／透明／接縫檢查與本機三尺寸預覽後停止。沒有開始第二個 Cage。
