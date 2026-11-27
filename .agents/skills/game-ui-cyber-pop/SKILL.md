---
name: game-ui-cyber-pop
description: De-tabularized Cyber Pop handheld arcade UI/HUD design constitution for Cyber Partner: Tournament. Enforces thick ink borders + 3D hard drop shadows ONLY on clickable controls, borderless non-interactive labels, break-out enlarged character card framing, zero text overflow at 375px narrow portrait width, and strict preservation of existing DOM hooks, event bindings, and #cm-title zero-diff. Use whenever redesigning or polishing in-game HUD, cards, sheets, drawers, shop, codex, roster, or battle overlays.
---

# Game UI Cyber Pop — 去表格化潮玩賽博掌機介面憲法

本 Skill 專門根治代理在無約束下產出的「後台表單／Excel 表格感」介面，為 **Cyber Partner: Tournament / 網線拍檔：錦標賽** 建立高辨識度的潮玩賽博掌機（Cyber Pop Arcade）視覺語言，並與既有 `.agents/skills/juicy-monster-ui/SKILL.md` 及 `src/championship/app/ui/tokens.css`、`arcade.css` 協同運作。

## 適用邊界與零破壞鐵律

- **僅適用於遊戲內 HUD 與功能頁**（牧場控制列、夥伴檢視器、戰鬥 HUD、商店、圖鑑、背包、設定與彈窗抽屜）。
- **嚴禁觸碰標題與開場畫面**：`#cm-title` 及其子樹維持 live main 原樣（Title Zero-Diff）。
- **嚴禁破壞事件與狀態邏輯**：修改樣式或 DOM 層級時，**絕對不可**改名、移除既有 `id`、`data-*` 屬性、`aria-*` 標籤、表單值或事件監聽綁定；所有顯示覆寫一律加上 `:not([hidden])` 守衛。
- **複用並收斂現有 `tokens.css` 設計變數（禁止另創重複變數）**：
  - 所有色票、邊框、立體陰影、間距與字階一律直連 `src/championship/app/ui/tokens.css`（預設主題 `<html data-theme="arcade">`，相容三色調 `data-theme-tone="arcade" | "cyber" | "breeze"`）：
    - **墨線與面紙**：`--ax-ink`、`--ax-ink-2`、`--ax-paper`、`--ax-paper-2`、`--ax-dots`、`--ax-dots-light`、`--ax-stage`
    - **按鍵主色與立體陰影成對變數**：`--ax-white / --ax-white-sh`、`--ax-yellow / --ax-yellow-sh`（主操作）、`--ax-red / --ax-red-sh`（危險／攻擊）、`--ax-cyan / --ax-cyan-sh`、`--ax-green / --ax-green-sh`、`--ax-orange / --ax-orange-sh`、`--ax-blue / --ax-blue-sh`、`--ax-purple / --ax-purple-sh`、`--ax-pink / --ax-pink-sh`
    - **實體按鍵物理參數**：`--ax-border`（`3px solid var(--ax-ink)`）、`--ax-hl`、`--ax-depth`（`6px`）、`--ax-hard`、`--ax-t-press`（`45ms`）、`--ax-t-hover`（`220ms`）、`--ax-spring`、`--ax-snap`
    - **共用比例與層級**：`--font-ui`（`"Cyber Partner Rounded"`）、`--fs-*`、`--fw-regular / --fw-strong / --fw-heavy`、`--text-scale`、`--r-tag (8px) / --r-control (14px) / --r-card (16px) / --r-sheet (22px)`、`--sp-1..10`、`--target (44px)`、`--z-scene..--z-settings`
  - **關於 `ui-skin-review.html`**：該頁為舊版原作 DS 風格（`nativeUiSkin.css`、`300×225` 4:3）皮層審查頁，保留為歷史參考、**不可直接覆寫或混入 `arcade` 樣式**；若需獨立元件試車場，應新建 `ui-sandbox.html`（只引入 `tokens.css` + `arcade.css` + `screenLayout.css`）或直接在 `championship.html` 以 `375×812` 實頁驗收。

---

## 一、「去表格化」四大介面憲法

### 1. 粗黑框與立體底陰影專屬於「可點擊按鈕」
- **互動元件白名單**：只有玩家真的能點擊觸發動作的按鈕、頁籤、可點卡片（`<button>`、`.cm-arcade-key`、`.cm-screen-primary` 等）才能使用：
  - 粗墨線邊框：`border: var(--ax-border)`（`2.5px–3px solid var(--ax-ink)`）
  - 硬質立體底陰影：`box-shadow: var(--ax-hl), 0 4~6px 0 var(--key-shade)`（嚴禁柔和擴散陰影）
  - 實體按壓物理：`:active:not(:disabled)` 時在 `45ms` 內下壓 `translateY(3px–4px)` 並將底陰影壓縮至 `1px–2px`；`:disabled` 呈灰階壓低態且不彈跳。
- **禁止偽互動視覺**：不可點擊的裝飾容器、標題列、說明文字區塊**禁止**套用 3D 底陰影或粗黑框，避免玩家誤以為可點擊。

### 2. 非互動標籤與數值「全面去框」
- **禁止格線與套娃邊框**：屬性數值（ATK/DEF/SPD/HP）、等級、金幣副標、狀態詞條、分類說明、鍵值對資訊**全面移除外框與表格分隔線**。
- **替代視覺層級**：
  - 用字重（`--fw-heavy: 800` vs `--fw-regular: 500`）與字級落差建立資訊主從。
  - 數值一律使用 `font-variant-numeric: tabular-nums` 對齊，重要數字採高對比色或膠囊色塊（無粗邊框、低飽和底色或純色微膠囊）。
  - 資訊組之間以留白（`--sp-2` / `--sp-3`）與視覺群組區隔，而非畫 1px 灰色框線把每個欄位包成表格。

### 3. 角色卡片「破框放大構圖（Break-Out Framing）」
- **打破方框拘束**：夥伴列表、圖鑑、編隊與商店精選卡片的角色立繪／動態像素本體，**禁止**被死板地塞在置中小方格裡留一大圈空邊。
- **破框技法**：
  - 卡片底板負責背景漸層、點陣紋理（`--ax-dots`）與圓角；角色視覺層以 `overflow: visible` 或較高 `z-index` 適度放大（例如 `1.12x–1.25x`）並向上突破底板上緣 `6px–14px`（搭配頂部預留 `padding-top` 避免被父容器裁切）。
  - 卡片底部疊加俐落的漸層腳條或無框粗體名牌，讓角色剪影成為絕對視覺主角。
  - 須與動態 `actionPortrait` 像素本體及 `image-rendering: pixelated` 相容，不裁切到角色頭部或造成相鄰列互相遮擋點擊區域（破框裝飾層設 `pointer-events: none`）。

### 4. `375px` 窄屏零文字溢位與掌機人體工學
- **硬基準視口**：所有介面必須以 **`375×812`（iPhone 直屏）** 為首要基準通過檢查，並同時相容 `--text-scale`（`100% / 115% / 130%`）與五語系（繁中、英、日、泰、越）。
- **防爆框必備 CSS 守則**：
  - 所有 Grid / Flex 子項必加 `min-width: 0`。
  - 標題與按鈕文字使用 `clamp()` 彈性字級，禁止在窄屏硬寫大固定像素導致換行炸開或撐出水平捲軸。
  - 頁面與容器嚴格滿足 `document.documentElement.scrollWidth <= window.innerWidth`（零水平捲軸）。
  - 長數值（如位元幣、傷害、經驗值）採千分位縮寫（`9.9M+`、`12.4K`）或彈性縮字，絕不與右側膠囊重疊。
- **掌機互動規範**：
  - 所有可點擊按鈕觸控區 **≥ 44×44px**（`min-height: var(--target)`），主要操作優先置於下半部拇指區。
  - 尊重安全區域 `env(safe-area-inset-top / bottom / left / right)`，左右保底留白 `12px–16px`。
  - **嚴禁 `backdrop-filter`**（`arcade.css` 已全域關閉以保護即時 PixiJS Canvas 幀率）。
  - **禁止對驗收按鈕施加無限循環的 `transform` 動畫**（會干擾 Playwright 穩定框判定；改用 `filter` 或 `box-shadow` 脈動）。
  - 支援 `prefers-reduced-motion` 與 `[data-motion="reduced"]`。

---

## 二、視覺層級與 CSS 變更自檢清單

修改 UI/HUD 後、提交驗收前，逐項核對：
1. 畫面上有粗黑框 + 立體底陰影的元素，是否 **100% 皆為可點擊互動控制項**？
2. 非互動資訊（數值、狀態、描述）是否已徹底去框、無表格線感？
3. 角色卡片是否呈現清晰的主角放大／破框構圖，且不遮擋上方按鈕或被父容器截頭？
4. 在 `375×812` 視口下，是否 **0 水平捲軸、0 文字裁切、0 按鈕重疊、0 Console 錯誤**？
5. 所有原本的點擊、切換頁籤、開關抽屜、進戰／返回功能是否完好無損？
