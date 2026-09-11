> **來源 lane**：Claude Code。本檔位於 `docs/coordination/**`（Codex 所有），依跨 lane 規則標註來源。
> 本次**沒有修改任何 runtime、樣式、資產或狀態旗標**，只新增這份紀錄。
> 基準 commit：`6862c6e`（工作區乾淨）。

# 原作落差與 UI 一致性調查 — 2026-09-11

Owner 指示：核對原作影片找出未還原處，並處理「每個介面 UI 風格不一致」。

## 方法與邊界

- 證據來源：`docs/research/video-BV13u411B7BK/VIDEO_OBSERVATIONS.json` 的 52 條觀察、
  `_archive/video-research/BV13u411B7BK/frames/` 的 75 張影格（t001–t792，覆蓋全片 13:17）、
  以及 `YDIJ_PRIVATE_ROM_ART_PACK` 的解碼美術。
- **每一條「缺少」都是實際 grep 過程式碼的結果**，不是看畫面推測。查無命中者標為零命中。
- **未涵蓋**：影片動態（動作快慢、動畫長度、音效）、75 張影格之間的過程、實機驗收。
  本次無法用 in-app 瀏覽器面板驅動遊戲（LOGIN 可按下但畫面不前進），
  與既有「QA gate 需系統 Chrome」一致，未另行判定為新缺陷。
- 對照時已排除遊戲進度差異：我方截圖為第 1 天新遊戲，影片為春季第 5 天既有存檔。

---

## A. 回饋層缺口（建議最優先）

原作靠這四樣讓玩家知道剛才發生什麼事；四樣同時缺，育成畫面等於靜音。
**不需要新的 ROM 研究，影片已拍到全部四種。**

| 原作 | 影片 | 現況 |
|---|---|---|
| 場上浮出 `HP UP` / `TP DOWN 4` / `HP at limit` | t030、t660 | 零命中（`cageEffects.js` 的 "HP up" 是場地效果標籤，非場上浮字） |
| 角色頭上食物氣泡 | t660 | 零命中 |
| 每隻角色各自的狀態條 | t038 | `src/championship/presentation/` 零命中 |
| 訊息區同時顯示三行歷史 | t030「81 Food remaining / 80 Food remaining / Nya」 | 單行 + 信件對話框，前一則被覆蓋 |

## B. 玩法功能缺口

| 項目 | 影片 | 現況 |
|---|---|---|
| 切換檢視對象（上方 `Change Status` 上下箭頭） | t023 | `src/` 與 `docs/contracts/` 均零命中。多隻個體時玩家只能在場地逐一點選 |
| 出發前選擇帶進地圖的個體 | t739 | 零命中。目前直接進場，原作的一個玩家決策被略過 |
| 場地容納上限（Playground 6 / Empty Lot 2） | t120、t554 | `championshipRaisingProduction.js:22` 註明 occupancy 尚未套用；目前編輯場地無任何容納限制 |
| 捕捉結果的隨機命名（`Rndm Name`） | t072 | 零命中 |

## C. 戰鬥演出缺口

| 項目 | 影片 | 現況 |
|---|---|---|
| 場下播報文字（「Team 234567 勝利」） | t180、t240 | 零命中 |
| 數字倒數 120 → 099 → 087 | t180、t210、t480 | `vs5Screens.js:215` 為 7200 幀進度條 + 分段圓點。**數值正確（7200 幀 = 120 秒），僅未以數字呈現** |
| 開場 `READY!` / 結束 `WIN!!` 大字 | t480、t510 | 零命中 |
| 隊名編輯、戰鬥策略選擇 | t162、t172 | 無隊名編輯；`battleActionSelection.js:6` 自述策略標籤未驗證 |
| `Password Battle` / `Wi-Fi Matching` | t142 | 零命中。判定為刻意不在範圍內，列出供 Owner 確認 |

## D. 照料道具動畫 — 原作有 9 組，我們使用 0 組真實影格

來源：`YDIJ_PRIVATE_ROM_ART_PACK/08_FULL_FAMILY_CONVERSION/common/i000_item/animations.json`
（原始資源 `07_RAW_NITRO_ART_BY_ROM_DIRECTORY/common/i000_item.nanr`）。
30 組序列中 9 組為多幀。`timingSemantics` = `RAW_TICKS_PRESERVED`。

| 序列 | cell | ticks | 內容 | 現況 |
|---|---|---|---|---|
| seq9 | 10 → 11 | 18 / 18 | **腐壞（發綠）的肉，專用美術且會動** | `createRaisingFieldPixiPresentation.js:708` 僅把新鮮貼圖染成 `0x8ca273`，單階段、不動 |
| seq10 | 12 → 13 | 18 / 18 | **排泄物，粉紅，兩姿勢** | 同檔 `:627` 為 `PIXI.Graphics` 向量繪製，**完全靜止** |
| seq11 | 14 → 15 | 18 / 18 | **掃把／畚箕，兩個掃地姿勢** | 同檔 `:729` 以單張自製圖旋轉 ±0.12 弧度模擬該節奏 |
| seq14 | 16 → 18 → 16 | 2 / 2 / 2 | 手掌 | 未使用真實影格 |
| seq4 / seq15–18 | 4-5 / 19-26 | 18 或 15 | 其他道具、藥水 | 未使用真實影格 |

**重點：肉會腐壞的規則已經做好了** — `championshipStandaloneApp.js` 的 `freshness` 會遞減，
歸零會寫入 `dirtySignals` 並計入 `rottenFoodCount`。缺的是畫面：
原作有專屬腐壞美術且會動，我方只有一次性染色。四階段 `foodVisualQuarter` 是**進食**階段，與腐壞無關。

> ROM 美術為 `RESEARCH_ONLY / NOT_SHIPPING_READY`，不得直接進 runtime。
> 上表提供的是**規格**（幾幀、哪些姿勢、幾個 tick），供獨立授權美術依原作節奏重繪。
> 現有掃把程式已有「依原作節奏、獨立繪製」的先例可循。

## E. UI 風格不一致 — 根因

Owner 觀察正確。根因不是個別畫面沒調好，而是**三套各自獨立的亮色覆蓋**，依畫面分管：

| 檔案 | 適用畫面 | 底色 | gold | 字型 |
|---|---|---|---|---|
| `huntMobile.css:3` | GATE_SELECT / HUNT_LOADOUT / HUNT_FIELD | `#e1f4f6` | `#dca62c` | Segoe UI |
| `raisingHomeHud.css:3` | `.int-rh2-root` | `#e5eee8` | — | Bahnschrift |
| `facilityBattleMobile.css:3` | SHOP / CAGE_EDIT / `.cm-vs5-root` | `#e7f5f1` | `#d5a232` | Segoe UI |

三個不同底色、兩種字型、兩種金色，且三者都以**覆寫同名變數**的方式實作，
底下還有 `vs2Styles.css` / `intRh2Styles.css` 的深色主題。等於兩套設計語言並存。

量化：
- 9 份樣式表、**635 個不重複色碼**，其中 **96% 只出現在單一檔案**。
- 同一米黃色在 7 個檔案有 **26 種寫法**；同一深底色在 5 個檔案有 21 種寫法。
- `vs2-*` 與 `rh2-*` 是互相複製後漂移：`gold`、`gold-bright`、`cyan`、`display`、字型**完全相同**，
  其餘每個色僅差 1–3 個數值（視覺無差異，但保證持續分岔）。

### 原作的做法（可作為統一的依據，非個人品味）

`01_UI/native-decoded-reference/ui_backgrounds/` 中，
`desktop_top.png`（`0f0a098a…`）與 `desktop_under.png`（`3b4f5438…`）
在 **battle_menu_net / battle_result / cage_edit / ending / hunt_result 五個畫面位元組完全相同**，
另有直接命名為 `common_bg_top` / `common_bg_bottom` 的資產。
**原作本來就是一套框架重複使用。**
共用底圖實測色域：`#0039de` → `#005aee` → `#007bff` → `#08b4ff` → `#20e6ff`（黑底）。

### 建議做法（未執行）

1. 於最先載入的 `styles.css` `:root` 建立單一權威 token 組；
   `vs2-*` / `rh2-*` 現有名稱改為指向它。**選擇器與 class 完全不動**，風險最低。
2. 三套亮色覆蓋合併為同一組淺色 token（底色、ink、muted、cyan、gold、字型）。
3. **不要新增 CSS 檔**：`WEB_BUILD_INPUTS.v1.json` 的 `publicPlaytest.files`
   帶 6,239 筆 SHA-256 且綁 Owner 公開試玩授權紀錄，不應為此變動。
4. 需以系統 Chrome 跑既有瀏覽器 QA gate 驗證後才可提交。

### 一個待查的隱患（尚未證實為活躍缺陷）

`--vs2-gold-bright` 同時擔任「深底上的文字色」與「亮色填充」兩種角色。
淺色主題下，`facilityBattleMobile`（`#805819`，5.63:1）與 `intRh2` 亮色（`#805011`，6.55:1）
都改成深色以維持可讀；**`huntMobile` 設為 `#ffe39a`，在 `#e1f4f6` 上僅 1.11:1**。

已查證：`vs2Styles.css:165` 的 `.cm-vs2-preview__state` **是死 CSS**（全 repo 無任何地方產生該元素），
故該處不構成活躍缺陷。但同檔另有 18 處 `color: var(--vs2-gold-bright)`，
其中落在狩獵淺底、且自身無深色背景者尚未逐條核對。
`:409` 的被選中 Gate 卡片自帶深色背景（`#13252e`），該處正常。
**建議以系統 Chrome 開啟狩獵三畫面逐條確認，不要僅憑 CSS 推論。**

---

## F. 已確認完成，請勿重複回報

存檔中「Saving…」提示、信件通知、場地效果各 `○○上升` 通道、狩獵設定按鈕、
記憶卡超額阻擋（含原作事件 `0x39`）、雷達需購得道具才顯示（符合原作情報分層）、
階級與升階畫面、稱號賽進度、攻防智速四圍（資料層）、狩獵倒數狀態、
商店分類（Training Goods / Hunt Item）與數量購買。

另：捕捉結果畫面的 `NATIVE_NORMAL_HUNT_CONTROLLER` 字串受
`VS2_PRESENTATION_MODES.DEVELOPER` 包覆（`vs3Screens.js:75`），玩家不可見，非缺陷。
季節色亦已核對：影片 t030 的 `Spring` 本身即為綠色，我方綠色春季正確
（`today_window__*_col` sprite 表的色相與季節標籤無對應關係，勿據以修改）。
