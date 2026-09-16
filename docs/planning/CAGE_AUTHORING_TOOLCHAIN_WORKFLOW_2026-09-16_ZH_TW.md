# Championship 2026 Cage / Habitat Authoring Toolchain

日期：2026-09-16  
狀態：`PLANNING_ONLY / TOOLCHAIN_PROPOSAL / NO_RUNTIME_ENGINE_CHANGE`

> 目的：把 Cage 從「手工重畫整張圖」改成「可驗證、可批次、可視化編輯、可自動組裝」的 production workflow。所有工具只服務現有 Championship 2026；不得因此建立第二套 runtime 或更換 PixiJS。

---

## 1. 推薦工具角色

### A. Tiled Map Editor — `AUTHORING_UI_CANDIDATE`

用途：

- 視覺化 field / object placement；
- locked geometry guide；
- object layer；
- image / tile layer；
- custom properties；
- scene template；
- project-specific JS extension / exporter。

適合用來建立一個 `Championship Cage Authoring` 工作區：

```text
LOCKED_EVIDENCE
├ footprint
├ shape mask
├ collision
├ connectors
├ object anchors
└ placement guides

EDITABLE_PRESENTATION
├ core
├ props-back
├ facilities
├ props-front
├ ambient
└ animation

DEBUG
├ ids
├ pivots
├ bounds
└ collision overlay
```

原則：Tiled 是 authoring tool，不是 gameplay authority。輸出必須經自訂 converter / validator 轉成現有 presentation contract。

Repository：`mapeditor/tiled`  
官方 extensions 可另參考：`mapeditor/tiled-extensions`

在 vendoring extension / third-party code 前由 Codex 再核對最新 license；若只把 Tiled 當外部編輯器，不能讓其工具選擇綁死 runtime。

---

### B. NitroPaint — `NDS_EVIDENCE_INSPECTOR`

用途：

- 交叉檢查 NCLR / NCGR / NCBR / NSCR；
- 檢查 NCER cells；
- 檢查 NANR animations；
- 人工確認 object anchor / composition 是否與我們的 decoded evidence 一致。

Repository：`Garhoogin/NitroPaint`

定位：**研究與 evidence inspection**，不是新版 Habitat 編輯器，也不是 runtime dependency。

---

### C. Aseprite — `PROP_AND_SPRITE_AUTHORING_OPTION`

用途：

- 獨立 prop cleanup；
- pivot / slice；
- animation tags；
- sprite-sheet / JSON export；
- atlas packing；
- alpha cleanup。

原則：

- 只在 Owner 本機具有合法工具授權時採用；
- tool 不進 runtime；
- exported pivot / slice data 應轉成我們自己的 stable schema；
- 不依賴 Aseprite private/proprietary format 作為唯一 source of truth。

---

### D. Sharp — `DEFAULT_DETERMINISTIC_COMPOSITOR_CANDIDATE`

Repository：`lovell/sharp`

Node.js 圖像處理適合接進現有 Web / JS 工具鏈，用來：

- read PNG；
- composite；
- resize；
- crop / extract；
- alpha；
- debug overlay；
- output PNG/WebP preview。

建議未來命令：

```text
npm run cage:contract
npm run cage:template -- field_cm01_01
npm run cage:build -- field_cm01_01
npm run cage:validate -- field_cm01_01
npm run cage:preview -- field_cm01_01
```

正式實作前先確認 repo 是否已有等價 Python/Node compositor，避免重複工具。

---

### E. `@pixi/tilemap` — `OPTIONAL_RUNTIME_OPTIMIZATION`

用途：大量 modular floor / terrain tiles 時降低 sprite 管理成本。

**不是現在必須導入。**

現有 Cage 若以 precomposed texture 已能滿足效能，先保留現況。只有在 Original Habitat 真正需要大量獨立 tile、重排、animated tiles 且 profiling 顯示必要時，才做小型 POC。

禁止因為找到 tilemap library 就重寫現有 Cage renderer。

---

### F. Playwright Screenshot — `DEFAULT_VISUAL_QA`

用途：

- render field；
- screenshot；
- viewport matrix；
- compare golden image；
- CI regression。

至少建立：

```text
field standalone
adjacent pair
upper/lower row
starting ranch
mobile viewport
expanded viewport
```

若 screenshot diff 發生，報告必須指出是 intentional art update 還是 geometry regression。

---

### G. Pixelmatch / equivalent — `OPTIONAL_LOW_LEVEL_DIFF`

若 Playwright 的 screenshot assertion 報告不夠精細，可用 pixel diff 工具產生：

- changed pixel count；
- diff PNG；
- threshold report。

使用前由 Codex 檢查現有 dependency，避免引進同功能重複套件。

---

### H. Blender — `OPTIONAL_PROP_MASTER`

只適合重複利用的 Habitat asset：

```text
concept
 -> editable 3D master
 -> fixed orthographic / approved camera
 -> material variants
 -> transparent PNG render
 -> same Cage visual contract
```

用途：床、訓練器、欄杆、植栽盆、水池構件等需要大量一致 perspective 的物件。

這不代表 Habitat 轉為 3D runtime。

---

## 2. 推薦最終工具鏈

```text
       Existing ROM / decoded evidence
                   │
         NitroPaint cross-check
                   │
                   ▼
        Cage Replacement Contract
                   │
          Contract / Template Gen
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
     Tiled                 Aseprite
scene / placement        props / pivots
       │                       │
       └───────────┬───────────┘
                   ▼
               Sharp build
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
Debug composite           Runtime asset
                                   │
                             existing Pixi
                                   │
                                   ▼
                         Playwright visual QA
                                   │
                            PASS / REJECT
```

Blender 只從旁產生可重用 prop master，不改變主線。

---

## 3. Source / Build / Runtime 分層

禁止再把所有東西放在同一層。

### Source

```text
art-source/cage/<fieldId>/
```

可包含：

- Tiled map/project references；
- PSD / Aseprite / Blender external source references（是否 commit 視檔案策略）；
- original generated PNG candidates；
- human-approved prop masters。

### Contract

```text
docs/art/contracts/cage/<fieldId>.json
```

內容：

- geometry refs；
- object placement；
- pivot；
- layer role；
- expected outputs；
- version。

### Build / Preview

```text
artifacts/cage-preview/<fieldId>/
```

CI / local generated；不必全部 commit。

### Runtime

繼續由既有：

```text
assets/production/cage/...
```

作 runtime authority。

確切路徑與 commit policy 由 Codex 先盤點現有 repo conventions 後再定，禁止平行建立重複 registry。

---

## 4. 自動化 Script 最小集合

### `extract-cage-contract`

讀取既有：

- shape definition；
- slot geometry；
- tile composition evidence；
- object placement；
- cell bank；
- animation bank。

輸出 machine-readable proposed art contract。

### `generate-cage-template`

輸出：

- transparent guide PNG；
- pivot crosses；
- bounds；
- field safe area；
- connector guides；
- debug labels。

### `build-cage-composite`

公式必須 deterministic：

```text
objectRootX = placementX - pivotX
objectRootY = placementY - pivotY
```

再依明確 layer order composite。

### `validate-cage-art`

檢查：

- missing asset；
- pivot missing；
- mismatched dimensions；
- clipping；
- illegal geometry change；
- duplicate binding；
- animation mismatch；
- nondeterministic output。

### `preview-ranch-layout`

至少輸出：

- standalone；
- adjacency；
- starting ranch；
- mobile crop；
- expanded crop。

---

## 5. `field_cm01_01` First Pilot

第一階段禁止一次轉 40 個 field。

只做：

```text
field_cm01_01
4 object cells
4 placements
1 core
```

### Pilot A — 不改 art

先用現有 evidence 重新走一次新 compositor。

目標：

> 新 compositor 輸出與既有 native/static composite 在可解釋範圍內一致。

若這一步失敗，不准開始新美術。

### Pilot B — 替換 4 個 object visual

- placement 不改；
- pivot contract 不改或以版本化 explicit pivot 替代；
- 產生 debug overlay；
- Pixi runtime preview。

### Pilot C — 替換 core visual

確保：

- playable geometry 視覺合理；
- objects 不重複；
- foreground/back layer 正確；
- seam 正確。

### Pilot D — Visual Regression

通過後才允許：

```text
field_cm02_01 ... field_cm40_xx
```

批量化。

---

## 6. Acceptance Gate

工具鏈只有在以下條件達成才可升格：

1. 無手工 magic X/Y correction；
2. artist 不需要讀 JS 才知道 anchor；
3. same source + same contract 可重建 byte-stable 或 visually deterministic output；
4. Pixi preview 與 build preview 一致；
5. art-only replace 不改 gameplay geometry / save / replay；
6. Tiled/Aseprite/Blender 任一外部工具移除後，runtime 仍可從 committed contract + approved exports 正常建置；
7. 第 2 個 field 的導入成本明顯低於第 1 個；
8. 通過一個 pilot 後才擴大 production。

---

## 7. 工具採用原則

Codex 在真正導入任何第三方工具前必須：

- 檢查最新 upstream repository；
- 核對 license；
- 確認是否 active / archived；
- 確認目前 Node / Pixi / Blender 版本相容性；
- 搜尋 repo 是否已經有等價能力；
- 優先 tool-only integration，避免 runtime dependency；
- 不 copy 無 license repo 的 code/workflow；
- 所有新增 dependency 必須能說明替代方案與移除成本。

此文件定義的是**工作流方向**，不是授權 Codex 無條件安裝全部工具。
