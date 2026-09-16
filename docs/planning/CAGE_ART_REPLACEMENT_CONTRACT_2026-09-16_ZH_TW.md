# Championship 2026 Cage / Habitat 美術替換契約

> **2026-09-16 收束校正：** 本輪执行範圍以 [Convergence Handoff](../coordination/CODEX_CONVERGENCE_HANDOFF_2026-09-16_ZH_TW.md) 為準：先 `field_cm01_01` 既有素材 proof，再三尺寸 responsive foundation；Creature 僅檢查 readiness。實測結果與唯一下一步清單見[收束報告](../reports/convergence-2026-09-16/REPORT_ZH_TW.md)。下文未完成的產品設計仍為 `DEFERRED`，不構成額外施工或批量生成授權。

日期：2026-09-16  
狀態：`PLANNING_ONLY / EVIDENCE-GROUNDED / NO_RUNTIME_REWRITE_AUTHORIZED`

> 核心判斷：**Cage 不是「一張大背景圖」，而是由 field core、tile composition、shape/slot geometry、object cells、object placements、animation、collision/attribute 與 runtime composite 共同組成的模組化場景。**  
> 因此任何新版美術若只交一張 full composite PNG，都不能視為完整 Cage 替換。

---

## 1. Repo 已確認的現有結構

以 `field_cm01_01` 為例，production evidence 包含：

```text
docs/art/production/cage/faithful-hd40/fields/field_cm01_01/
├ core-native.png
├ core-tilemap.json
├ native-original.png
├ faithful-hd4x.png
├ static-composite-native.png
├ object-cells/
│  ├ cell-000.png
│  ├ cell-001.png
│  ├ cell-002.png
│  └ cell-003.png
├ object-cell-bank.json
├ object-placement.json
├ object-animation-bank.json
├ attribute-raw-classes.json
└ collision-raw-classes.json
```

現有 runtime bundle 則另外輸出：

```text
assets/production/cage/licensed-runtime-v1/fields/<fieldId>/frame-00.png
assets/production/cage/licensed-runtime-v1/fields/<fieldId>/frame-01.png ...
```

**runtime frame 是 build output，不應反過來成為唯一 authoring master。**

---

## 2. 已確認的座標／組裝層級

Cage 至少包含四種不同語意的座標空間，禁止混用。

### A. Cage Edit Board Space

Authority：`src/championship/cage/ranchSlotGeometry.js`

- 原始 board 為 256×192 coordinate space；
- placement 是 column-major；
- lower row 有額外 X offset；
- unlock cover 與 slot arrangement 有自己的幾何規則。

### B. Gameplay Shape / Occupancy Space

Authority：

- `ORIGINAL_CAGE_SHAPE_MASKS`
- `ORIGINAL_CAGE_DEFINITION_SHAPES`
- `nativeRanchLayout.js`

Cage 是 multi-cell shape mask，不是一個 cage = 一格。

這些資料決定：

- occupied cells；
- overlap legality；
- locked/unlocked placement；
- save/reload placement；
- Waiting Room 等特殊限制。

### C. Field Destination Tile Space

Authority：

- `originalRanchFieldTileOrigin()`
- `composeOriginalRanchTilePlanes()`

此處的 X/Y 是 destination tile indices，**不是 sprite/world image origin**。

還涉及：

- source crop；
- row-specific source offset；
- horizontal wrapping；
- ordinary / filler / wall composition；
- attribute / collision / owner planes。

### D. Object Local / Placement Space

Authority：

- `object-placement.json`
- `object-animation-bank.json`
- `object-cell-bank.json`

每個 object 有：

- placement `sourceX/sourceY`；
- NANR sequence；
- NCER cell；
- cell bounds；
- local anchor；
- OAM composition；
- flip / animation information。

新版美術若改變物件在圖內的 visual origin 卻沒有同步 anchor，runtime 必然漂移。

---

## 3. `field_cm01_01` Pilot 的具體 contract

現有 evidence 顯示 4 個 object placement：

```text
ordinal 0 -> sequence 1 -> sourceX 68, sourceY 88
ordinal 1 -> sequence 2 -> sourceX 62, sourceY 17
ordinal 2 -> sequence 0 -> sourceX 50, sourceY 19
ordinal 3 -> sequence 3 -> sourceX 84, sourceY 22
```

4 個 rendered cells：

```text
cell-000: 48×80, anchor=(23,66)
cell-001: 64×48, anchor=(40,35)
cell-002: 32×64, anchor=(19,56)
cell-003: 32×64, anchor=(9,44)
```

第一個替換 POC 必須保留這些 placement semantics，除非建立明確、版本化的新 authored presentation contract；不能靠人工目測重新擺。

---

## 4. 不可由美術修改的資料

以下視為 gameplay / geometry contract，不是 Skin：

```text
moduleId
shapeMask
anchorCell / slotIndex
occupiedCells
orientation legality
collision semantics
capacity
TrainingEffectProfile
save placement
unlock rules
resident membership
```

原創 Habitat 可以更換外觀與 presentation，但若要改上述項目，必須是**玩法設計變更**，不能包裝成「只是重畫 Cage」。

---

## 5. 可由美術修改的 Presentation 層

每一 field 的可替換層建議統一成：

```text
CageVisualBundle
├ core / floor
├ edge / wall
├ connector
├ props-back
├ facility
├ props-front
├ ambient
├ animated-props
└ optional foreground mask
```

每一獨立 object asset 必須具有：

```text
assetKey
sourceImage
width / height
pivot / anchor
layerRole
placementBinding
animationBinding (optional)
visualBounds
safeOverflow
```

AI 或畫師可以改視覺，但 anchor / binding 必須被工具顯式保存。

---

## 6. 禁止的舊替換方式

### 禁止 A — 只重畫完整大圖

```text
old full image
 -> AI redraw
 -> replace frame-00.png
```

校正：目前 `runtimeMapArtBundle.js` 載入的是已合成 field frame，native ranch 再按模組裁切／回捲；沒有第二次疊加這四個 object cells。完整 PNG 可以是 build output；它不能是唯一 authoring master。只有未來誤加第二次 object pass 才會重複。

### 禁止 B — 目測重新擺 object

如果原始 object anchor / placement 有 evidence，就不得因新版圖「看起來差不多」而手動改座標。

### 禁止 C — 把 collision/shape 烤進圖片當真實 gameplay

圖片只能表達地形；合法 placement、collision、effect 仍由 data authority 決定。

### 禁止 D — 新 Cage 各自特例 JS

不得為每張美術建立 `if (fieldId === ...)` 位置修正。若 schema 表達不了需求，先擴充通用 presentation contract。

---

## 7. 正式替換流程

```text
Evidence Bundle
      ↓
Extract Geometry Contract
      ↓
Generate Authoring Template
      ↓
LOCK geometry / anchors / connectors
      ↓
Create replacement presentation layers
      ↓
Deterministic compositor
      ↓
Composite Preview
      ↓
Geometry / anchor overlay
      ↓
Adjacency / multi-cage preview
      ↓
Runtime output
      ↓
Pixi in-engine QA
      ↓
Visual regression
      ↓
Human approval
```

---

## 8. Authoring Template 要求

每個 field 應由 script 產生一份不容易畫錯的 template，至少包含：

- footprint outline；
- playable / visual safe area；
- object anchor crosses；
- object ID / sequence ID；
- connector edge；
- floor/core bounds；
- front/back layer guide；
- collision overlay（debug only）；
- source placement coordinates；
- scale reference。

AI / Artist 接到的工作不是「看原圖重畫」，而是：

> 在 template 的 geometry 不變條件下，重新設計 presentation。

---

## 9. 建議的資料契約

未來可生成一份 machine-readable contract，例如：

```json
{
  "fieldId": "field_cm01_01",
  "contractVersion": 1,
  "geometryAuthority": "verified-source",
  "core": {
    "nativeWidth": 96,
    "nativeHeight": 112
  },
  "objects": [
    {
      "objectId": "obj-000",
      "cellId": 1,
      "placement": { "x": 68, "y": 88 },
      "pivot": { "x": 40, "y": 35 },
      "layerRole": "props-front"
    }
  ],
  "rules": {
    "preservePlacement": true,
    "allowVisualOverflow": true,
    "allowGameplayGeometryChange": false
  }
}
```

注意：以上 JSON 為 proposed authoring schema，不宣稱原作就是這個格式。

---

## 10. Validator 必須檢查

### Geometry

- field native dimensions；
- shape mask；
- slot legality；
- no illegal overlap；
- connectors 不離開 expected edge；
- object placement IDs 完整。

### Asset

- 所有 referenced object 都存在；
- pivot/anchor 存在；
- transparent bounds 不截斷；
- animation frame count 與 binding 相容；
- 不允許 duplicate baked object + runtime object，除非明確標示 baked-only。

### Composite

- object root = placement - pivot；
- layer order deterministic；
- integer positioning unless explicitly allowed；
- adjacent module seam preview；
- upper/lower row preview；
- multi-shape preview。

### Runtime

- Pixi output 與 build preview 對得上；
- character walkable/collision 視覺不矛盾；
- save/reload 不改 placement；
- changing only presentation does not alter gameplay replay/hash。

---

## 11. POC Gate：只做 `field_cm01_01`

在碰 40 個 field 前，先完成一個端到端 pilot：

1. 自動讀取 `field_cm01_01` evidence；
2. 產生 authoring template；
3. 本輪沿用 4 個既有 object cells；原創 visual replacement 延後，不因 proof PASS 自動開始；
4. anchor/placement 不改；
5. 自動 composite；
6. 顯示 geometry overlay；
7. 在 Pixi scene 看結果；
8. Playwright 截圖；
9. visual regression PASS；
10. 再決定是否擴到其餘 39 個 field。

如果 pilot 仍需大量手工 X/Y 修正，代表 contract / compositor 尚未完成，**不得開始批次重畫**。

---

## 12. 與 Nexus Link Habitat 的關係

這套 contract 不是只為 faithful remake。

未來可將 presentation 替換成：

- glass habitat floor；
- botanical modules；
- water / pond modules；
- bed；
- food station；
- training device；
- toy；
- soft-tech facility；
- ambient plant / holographic décor。

但仍沿用既有：

```text
placement
shape
resident assignment
effect
save
simulation
```

因此 Nexus Link Habitat 是現有 Cage 的**原地產品化演進**，不是第二套基地系統。
