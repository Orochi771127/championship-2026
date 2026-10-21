# 新模式接入介面（2026-10-21）

> 目的：讓 Data Arena 之後的新模式（或其分支）接進現有遊戲時，不必重做選單、HUD 與結算版型。呈現層契約，`OWNER_APPROVED_ADAPTATION`；不新增 app、router、存檔或 ticker。

## 1. 入口：`MODE_ENTRY_RECORD`（`src/championship/app/modeEntries.js`）

| 欄位 | 值 | 說明 |
|---|---|---|
| `id` | `^[a-z][A-Za-z0-9]{1,39}$` | 唯一 |
| `surface` | `MENU_GO`／`BATTLE_SELECT` | 工具列「選單 → 出發」群組，或對戰選擇頁頂部 |
| `state` | `OPEN`／`PREVIEW`／`HIDDEN` | 開放／「即將開放」單行預告（不可按）／完全不畫，不留空位 |
| `label`、`hint` | 繁中原文 | 經 `uiText` 翻譯；新字串需同時加入四語 |
| `screen` 或 `action` | 既有 screen id 或 app 動作 | `MENU_GO` 的 `OPEN` 必須有去處，否則自動降為 `PREVIEW` |

讀取：`src/championship/app/modeEntries.js`（`MODE_ENTRIES`、`modeEntryState(id)`、`modeMenuEntries()`）。不合法紀錄直接丟棄，不猜測。未列入的模式維持開放（現行行為不變）。

現況：只登錄 `dataArena`（`BATTLE_SELECT`、`OPEN`）。設為 `HIDDEN` 即移除對戰選單上的入口按鈕。

## 2. 模式選擇與比賽 HUD

- 版面沿用共用元件：頁首（`cm-vs2-header` 小標＋標題＋連結線）、主按鈕（`--btn-primary-bg`）、HUD 浮島（`--c-surface-hud`，場景上不做背景模糊）、底部列（返回在左、唯一主動作在右）。
- 顏色只取 `ui/tokens.css`；隊伍色 `--c-team-player`／`--c-team-opponent`；獎勵金色只給位元幣與獎勵。
- 新模式自帶的場景（Pixi／Three.js）必須掛在既有單一 Pixi Application／ticker 或既有有界 Three.js 疊層，離開時釋放。

## 3. 開場、獎勵與結算

- 開場：`playCeremony({ kind: 'versus', ... })` + `buildVersus`（`presentation/ceremony/`），位於上緣，不遮場地中央。
- 結算與獎勵：只讀 app 已結算的收據；重要獎勵用 `medal`（moment）或既有五段高光；一般結果用 `playReveal` 揭曉。
- 對戰畫面維持「只匯入顯示文字」：演出由 `main.js` 注入（參考 `battleCeremonies`）。
- 略過、減少動態、省電、背景分頁與釋放由執行器統一處理，新模式不需各自實作。
