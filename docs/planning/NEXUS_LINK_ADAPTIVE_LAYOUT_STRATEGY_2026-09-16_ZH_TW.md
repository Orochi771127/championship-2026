# Nexus Link / Championship 2026 自適應畫面策略：iPad、Foldable、Desktop

> **2026-09-16 收束校正：** 本輪执行範圍以 [Convergence Handoff](../coordination/CODEX_CONVERGENCE_HANDOFF_2026-09-16_ZH_TW.md) 為準：先 `field_cm01_01` 既有素材 proof，再三尺寸 responsive foundation；Creature 僅檢查 readiness。實測結果與唯一下一步清單見[收束報告](../reports/convergence-2026-09-16/REPORT_ZH_TW.md)。下文未完成的產品設計仍為 `DEFERRED`，不構成額外施工或批量生成授權。

日期：2026-09-16  
狀態：`PLANNING_ONLY / SAME_RUNTIME_ONLY / NO_SECOND_UI_SYSTEM`

> 核心原則：**不為 iPad、折疊機或 Desktop 重新做一套遊戲。**  
> 所有裝置共用同一套 Championship 2026 simulation、save、router、Pixi application、DOM components、assets 與 gameplay state；差異只存在於 layout composition、camera framing 與可見資訊密度。

---

## 1. 產品決策

支援大螢幕的目的不是「把 9:16 手機畫面放大」，而是讓相同元件在更多空間中重新排列：

```text
same simulation
same save
same router
same Pixi app
same DOM components
same art assets
        ↓
responsive composition
```

禁止：

- `if (device === "iPad Pro")` 類型裝置型號特判；
- iPhone / iPad / Fold 各自一套 screen tree；
- 為大螢幕建立第二個 Pixi renderer；
- 為 Fold 建立平行 Battle / Habitat runtime；
- 每個 aspect ratio 重新畫一套完整背景。

---

## 2. Layout Profile

以「可用視窗寬度」為主要判斷，裝置名稱只作 QA 樣本。

### `COMPACT` — < 600 CSS px / dp 等價寬度

目標：一般手機、Fold 外螢幕、窄視窗。

- 9:16 為主要設計基準；
- bottom navigation；
- context panel 使用 bottom sheet / modal；
- Habitat / Hunt / Battle 優先把世界畫面留在中央；
- UI 必須單手可操作。

### `MEDIUM` — 600–839

目標：Fold 展開直向、iPad mini / 部分分割視窗。

- 世界 + 一個 secondary panel；
- bottom nav 或 compact rail；
- Creature Inspector 可 persistent；
- 不再要求所有資訊都透過 page push / modal 顯示。

### `EXPANDED` — >= 840

目標：iPad 11/13、Fold 橫向、大型視窗、Desktop。

推薦：

```text
┌──────────┬────────────────────────┬──────────────┐
│ Nav Rail │       Game World       │ Context Pane │
│          │                        │              │
│ Habitat  │                        │ Creature     │
│ Explore  │                        │ Status       │
│ Battle   │                        │ Actions      │
│ Archive  │                        │ Detail       │
└──────────┴────────────────────────┴──────────────┘
```

世界仍是最大區域；左右 pane 不能把遊戲壓縮成 dashboard。

---

## 3. Foldable Progressive Enhancement

Fold 專屬能力只作 progressive enhancement；偵測不到 hinge / posture 時仍必須完全可玩。

### `TABLETOP`

半折桌面姿態候選：

```text
upper segment  = Habitat / Battle / Explore
hinge          = safe gap
lower segment  = commands / care / items / shortcuts
```

最適合 Semi-auto Battle：上半部看戰場，下半部當 command deck。

### `BOOK / DUAL SEGMENT`

若平台可可靠取得雙 segment：

```text
left  = world / list
right = inspector / commands / archive detail
```

不得把關鍵玩法綁死在 fold API；Web fold API 可用時才啟用。

---

## 4. 各模式的大螢幕差異

### Habitat

- Compact：Habitat + bottom sheet；
- Medium/Expanded：Habitat + persistent Creature Inspector；
- 不新增 Habitat simulation；只讓同一居民資訊同時可見。

### Cage / Habitat Edit

- Compact：場地 + 下方家具抽屜；
- Expanded：`Palette | Habitat | Properties`；
- drag/drop、rotate、confirm 的 semantic action 保持相同。

### Explore / Hunt

- Compact：世界全螢幕，HUD 最小化；
- Expanded：可 persistent 顯示 Mini Map / Objective / Party；
- 不建立另一套地圖資料。

### Battle

- Compact：戰場 + 底部 command bar；
- Expanded：戰場 + party/skill/target context；
- Tabletop：上半戰場，下半 command deck；
- battle simulation authority 不變。

### Archive / Database

- Compact：List → Detail；
- Expanded：Family/List/Detail 多欄；
- evolution graph 可使用較大的 viewport，但仍讀同一份 evolution data。

---

## 5. 美術成本控制規則

### 角色

**不得新增裝置專屬角色動畫。**

同一份 sprite / animation profile 在所有 viewport 共用，只調整：

- camera framing；
- runtime scale；
- visible world area。

### Environment

禁止只生產一張死的 9:16 full-screen painting 作為唯一來源。

Habitat / scene asset 優先拆成：

```text
background / sky
floor / terrain
architecture
water
vegetation
props
foreground
ambient FX
```

此段是未來 composition 目標。現況使用同一個 Raising camera / portraitFrame，實際可见寬度由 host 與相機決定；不得保證 iPad 一定顯示更多世界。先量測三尺寸，side inspector、rail、背景延伸與 fold APIs 均留 `DEFERRED`，不增加裝置專屬素材。

### UI

- icon / SVG 共用；
- component 共用；
- size / dock / order 由 responsive token 控制；
- 不建立 Tablet-only icon set。

---

## 6. 工程成本分級

### Level 1 — 現在就保留架構能力

低成本，應納入基礎：

- responsive DOM layout；
- viewport resize；
- safe area；
- Pixi camera / resize 不依賴固定 390×844；
- Compact / Medium / Expanded token；
- screenshot QA viewports。

### Level 2 — 核心遊戲穩定後

- persistent side inspector；
- nav rail；
- Archive multi-column；
- Habitat Edit side palette。

### Level 3 — 非 1.0 blocker

- Fold Tabletop；
- Book Mode；
- tri-fold 三欄特化；
- Apple Pencil 專屬操作；
- platform-specific micro-interactions。

---

## 7. QA 最小矩陣

至少自動驗證：

```text
390×844   compact reference
430×932   large phone
744×1133  small tablet class
820×1180  tablet class
1024×1366 large tablet class
1366×1024 landscape tablet / desktop-like
```

另測：

- portrait ↔ landscape；
- resize during runtime；
- safe-area inset；
- narrow split window；
- expanded-to-compact state transition；
- modal / bottom-sheet 不遺失 gameplay state；
- scene 不因 resize 重建 simulation。

Playwright screenshot regression 優先於大量人工逐裝置檢查。

---

## 8. 驗收條件

此策略只有在下列條件成立時可升格實作：

1. 任何 viewport 切換都不建立第二份 simulation state；
2. Save hash / gameplay replay 不因 layout profile 改變；
3. 角色美術不需要額外 tablet variant；
4. Environment 至少能透過 crop / modular extension 支援 Compact 與 Expanded；
5. UI component 不複製成 `PhoneFoo` / `TabletFoo` 兩套平行版本；
6. Fold-specific behavior 可以完全關閉而不影響玩法；
7. 大螢幕改善屬 presentation enhancement，不得變成 Championship parity blocker。
