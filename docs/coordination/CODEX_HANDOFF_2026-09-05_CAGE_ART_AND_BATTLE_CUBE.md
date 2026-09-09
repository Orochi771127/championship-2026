# Codex 接手指令 — 2026-09-05

> **2026-09-05 Codex ROM 複核更正（原交接內容保留如下）**：§0／§1 的索引結論已被原始 ROM 與全部 35 筆商店紀錄否證。
> `0x020C8CDC` 是名稱欄基址；正確名稱／說明偏移為 `+0／+4`，原建置器的 `+0x28／+0x2C` 多讀一筆。
> 正確身分為：0 空地（防禦／2）、1 運動場（HP／6）、15 小保健室、30 小健身房、35 等候室；蓋板不在 36 筆定義內。
> 既有美術綁定無需平移。詳見 [獨立 ROM 稽核與完整對照](../research/CAGE_IDENTITY_BINDING_ROM_TRACE_2026-09-05.md)。
> 下文仍是原始交接紀錄，不能再將其中已被否證的索引當作實作指令。

> **來源 lane**：Claude Code。此文件位於 `docs/coordination/**`（Codex 所有），
> 依跨 lane 規則標註來源。內容為交接，未修改 Codex 既有檔案。

---

## 0. 這一階段改了什麼（你的新基準）

在你開始之前要知道的事：**籠子資料先前整體錯開一格，現在已修正。**

`cageEffects.js` 原本是手工輸入的表，第 0 筆是「Defense up, best for 2」——
**那個籠子在 ROM 裡不存在** —— 把後面 34 筆全部往後推了一格。

現在改為從 ROM 直讀：

| 來源 | 值 |
|---|---|
| CageDefinition 表 | ARM9 `0x020C8CDC`，stride 40，36 筆 |
| 名稱欄 | `+0x28` → txt_list 索引 |
| 說明欄 | `+0x2C` → txt_list 索引（恆等於名稱索引 + 40） |
| 產出 | `src/data/championship/catalogs/cage-definitions.r1.json` |
| 建置器 | `scripts/build-cage-definitions.py` |

正確的前四筆：

| 籠 | 名稱 | 效果 | 容量 |
|---|---|---|---|
| 0 | うんどうじょう（運動場／跑道） | HP 上升 | 6 |
| 1 | きょうぎじょう（競技場） | 速度上升 | 10 |
| 2 | どうじょう（道場） | TP 上升 | 6 |
| 3 | ジム（健身房） | 攻擊上升 | 8 |

**獨立佐證**：Owner 拍攝實機商店畫面，ミニジム 顯示「こうげきアップ／しゅうようすう2」＝ 第 29 筆，
ミニほけんしつ 顯示「HP ストレス かいふく／しゅうようすう2」＝ 第 14 筆。與轉寫逐字相符。

---

## 1. 最高優先：籠子美術綁定疑似帶有同一個錯位

**這是本次交接最重要的一項，而且已有一個確證的錯配。**

### 已證實的事

`originalCageVisualBindings.js` 目前的對映：

```
籠 0（うんどうじょう＝跑道） -> field_cm01_01
```

但實際算圖：

| 檔案 | 內容 |
|---|---|
| `assets/production/cage/licensed-runtime-v1/fields/field_cm01_01/frame-00.png` | **空地**：泥地、水泥管、一棵樹 |
| `assets/production/cage/licensed-runtime-v1/fields/field_cm02_01/frame-00.png` | **跑道**：橢圓形跑道、白線、看台 |

**籠 0 是跑道，卻綁到了空地。跑道在 `cm02`。**

### 為什麼會這樣（有文件佐證）

`R:\NEXUS LINK\原作\SHOP_REVERSE_SPEC_v1.md` §12.3 寫著：

> `field_cm01_01` is referenced by a separate special structure **immediately before**
> the 36-record standard CageDefinition table, rather than a normal standard record.

也就是說 **`cm01` 屬於標準表「之前」的特殊紀錄**，不是 36 筆之一。
美術編號從 `cm02` 才開始對應標準表第 0 筆。

（順帶一提：舊測試裡那個變數名稱就叫 `vacantLot`（空地）—— 錯誤的來源大概就在這裡。）

### 但不要直接整體平移

現況更複雜，不是單純 +1：

- 美術有 **40 張**（`cm01`..`cm40`），籠子定義只有 **36 筆**
- 現行綁定表尾端本來就有跳號：籠 27→`cm30`、28→`cm31`、29→`cm32`、30→`cm34`、31→`cm35`、32→`cm37`、33→`cm39`、34→`cm40`、35→`cm28`

所以這是一張**需要逐筆重新核對的對照表**，不是一個偏移量。

### 建議做法（現在比以前容易很多）

以前沒有可靠的籠子名稱可以對照，現在有了：

1. 以 `cage-definitions.r1.json` 的 36 個**名稱與說明**為基準
2. 逐一檢視 40 張 `frame-00.png`
3. 用視覺內容配名稱 —— 大多數一看就知道（跑道／競技場／道場／健身房／火山／海灘／雪原／墓地／溫泉…）
4. 找出剩下 4 張不屬於 36 筆的美術，確認它們是什麼（`cm01` 已知是特殊紀錄）
5. 修正 `originalCageVisualBindings.js`，並把 `evidence` 標成實際等級

**注意**：`ミニ〜` 系列（小健身房、小火山、小海灘…）在說明文字裡明確寫著
「『X』のミニバージョン」，所以它們的美術應該是對應本體的縮小版 —— 這是很好的配對線索。

---

## 2. 戰鬥選單立方體：美術待重建

原作的戰鬥選單是**旋轉的立方體**，不是清單。ROM 模型 `battle_menu/launcher13.nsbmd`
的節點表證明了形狀與面的集合：

```
launcher13 / main / box / text
_00_edge  _01_edgelight              盒體邊框
_02_champ_bg / _l / _u               チャンピオンシップ
_03_title_bg / _l / _u               タイトルマッチ
_04_free_bg  / _l / _u               フリーバトル
_05_tushin_bg                        ツウシン（通訊對戰）
```

### 已完成（Claude lane）

`src/championship/presentation/vs5/createBattleSelectThreePresentation.js`
—— 程序生成的立方體，四面依 ROM 節點命名，**幾何為原創**，未載入任何 MDL0／TEX0。

做法完全比照 Gate 世界球（其 manifest 寫明「Procedural … original-created vertex colours」），
所以**不需要等美術就能運作**。

### 待 Codex 處理

`ART_REBUILD_BACKLOG.md` 裡的 `art:three-d:battle-menu-launcher13:nitro-reference`
仍為 `NEEDS_REBUILD` / `CLEAN_ROOM_ORIGINAL_REPLACEMENT_REQUIRED`。

目前立方體的面只有純色。需要的是：

- 四面的面板美術（背景 + 文字層，對應 `_bg` / `_l` / `_u` 三層結構）
- 產出到 `assets/production/battle/`，比照 `assets/production/gate/vs2-r1/manifest.json` 的形制
- 完成後 Claude lane 會把貼圖接上；介面已預留（面 id 為 `CHAMPIONSHIP` / `TITLE_MATCH` / `FREE_BATTLE` / `LINK_BATTLE`）

**同時請注意**：`Desktop_Launcher.nsbmd`（節點 `Launcher_00`..`Launcher_06`）也在 backlog 裡，
但目前**整個 ROM 沒有任何程式碼引用它**，所以它不是現役畫面，不要為它排優先序。

---

## 3. 中文文案層：DOM 視圖需要接上

新增 `src/championship/text/zhHant.js`（Claude lane），為 **PRODUCT_AUTHORED** 文案層。

### 設計原則（請務必遵守）

- **ROM 目錄保持日文不變**，`language: "ja"` 標記保留。翻譯是疊加，不是取代。
- **以紀錄索引為 key**，不以日文字串為 key —— 否則翻譯會默默跟著錯誤的轉寫跑。
- **查不到就退回卡帶原文**，不要空白、不要自創。

### 已涵蓋

模式（育成／對戰／狩獵／商店）、六項數值、十種族、五抗性、36 個籠子含效果、17 個關卡、立方體四面。

### 需要 Codex 做的

你的 DOM 視圖（`vs2Screens.js`、P1R views 等）目前仍顯示英文產品文案。
請改為透過 `zhHant.js` 取字，並保持同一套 fallback 行為。

**尚未翻譯**：216 個物種名稱、68 條說明文字。目前仍顯示日文，這是刻意的，不是遺漏。

---

## 4. 順帶提供的新資料（你可能用得到）

本階段從卡帶文字庫 `nitrofs/ui/txt/txt_list_txt.dat` 取出：

| 內容 | 位置 |
|---|---|
| 六項數值官方順序 | HP・TP・こうげき・ぼうぎょ・かしこさ・すばやさ（文字庫 35–40） |
| 十種族 / 五抗性 | 文字庫 20–29 / 30–34 |
| 216 個物種日文名 | `species-names.r1.json`（物種索引 + 33） |
| 17 個關卡名與入場費 | `gate-table.r1.json` |
| 68 條說明主題 | `help-text.r1.json` |

解析器：`scripts/lib/ydij_text_bank.py`。
**格式陷阱**：條目是 UTF-16LE，但結尾是**三個原始位元組** `3C 3E 0A`，長度為奇數 ——
整檔一次解碼會在第一筆之後錯位並產生看似合理的亂碼。請用該模組，不要自己重寫。

---

## 5. 紅線

- 不准為了讓畫面「看起來完整」而填入未經 ROM 驗證的數值
- 不准移除 `UNKNOWN_REQUIRES_TRACE` / `PRODUCT_AUTHORED` / `PENDING_WRITE_SITE` 等證據標記
- 不准把中文翻譯寫進 ROM 目錄（那會抹掉轉寫證據）
- 不准把英文版影片的標籤當作本日文 ROM 的證據

---

## 6. 現況

測試 **828/828 通過**。籠子效果、關卡費用與名稱、成長階梯、說明書、賽程表皆為 ROM 驗證。

**仍未追出**：籠子效果的強度（「練什麼」已知，「練多少」未知）、
四個消耗道具的效果、進化條件、`player+0xEB8` 免費旗標的觸發條件。
這些畫面上留白是刻意的。
