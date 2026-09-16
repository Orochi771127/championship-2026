# Nexus Link / Championship 2026 產品化收束索引

> **2026-09-16 收束校正：** 本輪执行範圍以 [Convergence Handoff](../coordination/CODEX_CONVERGENCE_HANDOFF_2026-09-16_ZH_TW.md) 為準：先 `field_cm01_01` 既有素材 proof，再三尺寸 responsive foundation；Creature 僅檢查 readiness。實測結果與唯一下一步清單見[收束報告](../reports/convergence-2026-09-16/REPORT_ZH_TW.md)。下文未完成的產品設計仍為 `DEFERRED`，不構成額外施工或批量生成授權。

日期：2026-09-16  
狀態：`PLANNING_ENTRYPOINT / READ_THIS_FIRST`

> 本文件是 2026-09-16 產品化討論的收束入口。目標不是增加更多平行方案，而是把已確認方向整理成 Codex 可逐項驗證、合併、落地的單一決策鏈。

---

## 1. 非談判原則

1. **不重新做一款遊戲。** Nexus Link / 原創商業版直接建立在現有 `championship-2026` 上。
2. 不建立第二個 app、第二套 router、第二套 save、第二個 Pixi application、第二套 Battle / Habitat simulation truth。
3. Championship parity / verified behavior 仍先保留；未來產品化以 `inspect → adapt/extend → preserve tests → replace presentation/content` 演進。
4. 1.0 功能必須收縮，不因研究到更多可能性就全部加入。
5. 美術量產目前是最大的產品化風險；先證明 production factory，再擴 roster。
6. Cage/Habitat 不是一張圖片問題，而是 modular scene asset + geometry + placement + object contract 問題。
7. iPad/Fold 支援採 responsive composition，不做裝置專屬 runtime 或專屬角色美術。

---

## 2. 必讀文件順序

### A. 產品與範圍

`docs/planning/NEXUS_LINK_IN_PLACE_PRODUCTIZATION_PLAN_2026-09-16_ZH_TW.md`

回答：

- Nexus Link 是什麼；
- 世界觀如何與既有 Championship 系統接合；
- `Raise → Explore → Battle → Evolve → Rebuild`；
- 哪些 1.0 要做、哪些延後；
- Gate roadmap；
- 禁止另起一套遊戲。

### B. 角色／一般美術量產

`docs/planning/NEXUS_LINK_ART_PRODUCTION_WORKFLOW_2026-09-16_ZH_TW.md`

回答：

- canonical anchor；
- whole-action strip；
- character consistency；
- cleanup / normalization / runtime QA；
- Blender prop master；
- 外部 GitHub art workflow 採用邊界。

### C. Cage / Habitat 美術替換契約

`docs/planning/CAGE_ART_REPLACEMENT_CONTRACT_2026-09-16_ZH_TW.md`

回答：

- Cage 為何不能只換一張大圖；
- core / object cells / object placement / animation / shape / tile composition；
- coordinate-space separation；
- immutable gameplay geometry vs replaceable presentation；
- `field_cm01_01` pilot contract。

### D. Cage / Habitat Authoring 工具鏈

`docs/planning/CAGE_AUTHORING_TOOLCHAIN_WORKFLOW_2026-09-16_ZH_TW.md`

回答：

- Tiled；
- NitroPaint；
- Aseprite；
- Sharp；
- Playwright / visual diff；
- optional `@pixi/tilemap`；
- Blender prop master；
- deterministic compositor / validator / template generator。

### E. iPad / Fold / 大螢幕

`docs/planning/NEXUS_LINK_ADAPTIVE_LAYOUT_STRATEGY_2026-09-16_ZH_TW.md`

回答：

- Compact / Medium / Expanded；
- Fold Tabletop progressive enhancement；
- same simulation / same assets；
- art cost control；
- responsive QA matrix。

---

## 3. Repo 現有 evidence / runtime 必須交叉確認

Codex 不得只讀 planning。至少交叉確認：

```text
AGENTS.md
docs/README.md
docs/planning/CHAMPIONSHIP_2026_MASTER_GAME_PRODUCTION_PLAN.md
docs/planning/CHAMPIONSHIP_POST_PARITY_MODERNIZATION_PLAN_ZH_TW.md
docs/planning/CHAMPIONSHIP_2026_MODULAR_CAGE_SYSTEM_SPEC_ZH_TW.md
src/championship/cage/ranchSlotGeometry.js
src/championship/cage/ranchTileComposition.js
src/championship/cage/nativeRanchLayout.js
docs/art/production/cage/faithful-hd40/
assets/production/cage/licensed-runtime-v1/manifest.json
```

如果 planning 與 runtime/current truth 衝突：

1. 先記錄衝突；
2. 以 latest Owner direction + current source/tests/evidence authority 判斷；
3. 修 planning，不要為了配合 planning 破壞現有正確 runtime。

---

## 4. 目前應收束成的產品方向

```text
Championship 2026 existing game
        ↓ in-place evolution
Nexus Link / original presentation
        ↓
Raise
Explore
Battle
Evolve
Rebuild
```

1.0 不以 async PvP、trade、LLM companion、大型 open world、500 forms、24h hardcore offline life simulation 為 blocker。

原創內容數量採 production evidence 決定，而不是先承諾 224/500。

---

## 5. 目前應收束成的美術方向

### Creature

```text
approved identity
 -> canonical anchor
 -> action blueprint
 -> whole action generation / pose control
 -> cleanup
 -> approved profile geometry (native per-frame origins preserved)
 -> runtime QA
```

### Cage / Habitat

```text
existing evidence
 -> replacement contract
 -> authoring template
 -> locked geometry
 -> editable presentation layers
 -> deterministic composite
 -> Pixi preview
 -> visual regression
```

### Environment responsive rule

不是每個裝置重新畫背景，而是 modular / layered / overscan scene，讓 Compact crop 中央、Expanded 顯示更多世界。

---

## 6. 下一個真正落地的最小工程 Gate

在規劃收束完成後，只批准以下最小 proof：

### Proof A — `field_cm01_01` Cage Art Pipeline

沿用 `scripts/lib/ydij_map_formats.py`，增加已解碼 cell export 入口，使用既有 core + 4 cells 重建。契約、模板、上下排／回捲／起始場地比較及測試由 `npm run art:cage:proof` 重建；不生成新圖、不升版 production manifest。詳細結果與限制見收束報告。

### Proof B — Responsive Composition foundation

同一個 `championship.html`、DOM UI、Pixi stage 與 Save，在 390×844、820×1180、1024×1366 及回縮手機尺寸驗證。量測既有能力；persistent inspector / nav rail 等重新排列仍屬 `DEFERRED`，不得把 viewport PASS 當作完整 Expanded UI 完成。

### Creature — Pipeline readiness only

只檢查未來單隻 approved creature 的 Idle / Move / Attack / Hit / Eat / Sleep 所需 identity、逐格資料、alpha、預覽及 promotion gate。這次生成數量為 0，不執行一隻或整批動畫生成。原生替換保留每格 source origin、offset、timing、flip 與 blank；新原創 profile 的共享設計比例不能覆寫 native contract。

本輪在 A、B 及 readiness 報告完成後停止。
---

## 7. 收束完成的定義

Codex 應把結果整理成：

```text
CONFIRMED
CORRECTED
DEFERRED
REJECTED
UNKNOWN_REQUIRES_TRACE
```

並最後只留下：

- 一套 canonical product roadmap；
- 一套 art production workflow；
- 一套 Cage replacement contract；
- 一套 adaptive layout rule；
- 三個最小 pilots；
- 清楚的 STOP point。

若找到重複或矛盾 planning，應更新既有 canonical 文件／索引，而不是再新增另一份競爭 roadmap。
