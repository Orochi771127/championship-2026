# 作戰方針（さくせん）ROM 追蹤紀錄（2026-10-28）

> **用途：** 作為 AI 自動對戰「作戰方針」選單的證據依據，對應 Owner 2026-10-28「要做 AI 戰術方針請你從 ROM 確認」。
> **分類：** VERIFIED_BINARY_ROM_TRACE_2026_10_28（ARM9 直接反組譯，加上 ROM 文字與圖像資源對照）。
> **本文件記錄證據；依據這份證據完成的產品實作，記在文末「產品實作」一節。**
> **來源：** `R:\NEXUS LINK\原作\research-only\YDIJ_FULL_ROM_DECONSTRUCTION_2026-08-29\`（RESEARCH_ONLY，不隨產品發佈）。

## 結論

隊伍設定畫面上，每隻參戰拍檔各有一個三選一清單。選到的「列號」會直接存成該拍檔的 policy：

| policy | 選單列 | ROM 標籤（圖格） | 原作說明（help_text #159） | 產品譯名 |
|---|---|---|---|---|
| 0 | 第 1 列 | スペシャルアタック（cell 1） | ひっさつ技をよくつかう | 必殺技優先 |
| 1 | 第 2 列 | ノーマルアタック（cell 2） | りょうほうをバランスよくつかう | 普通攻擊（均衡） |
| 2 | 第 3 列 | サポート（cell 4） | SPをよくつかう | 支援優先 |
| 3 | 不在選單 | — | — | 依性格決定 profile（表 `0x0212FF0C`） |
| 4 | 不在選單 | — | — | 只用於自由對戰的預設對手 |

- **預設值：** 隊伍初始化時寫入 1，也就是「ノーマルアタック」。產品目前所有自有拍檔固定使用 1，與原作的預設一致。
- **重設：** 把拍檔放進隊伍時，`0x020523A0` 會再寫一次 1。換人之後，這個位置的方針會回到預設的ノーマルアタック。

## 證據鏈

### 1. 文字（`analysis/text/`）

- `help_text_txt.csv` 第 77 行：`help_text_txt.dat` #75 是說明標題「さくせん」。
- `help_text_txt.csv` 第 161 行：`help_text_txt.dat` #159 是說明內文：「バトルにさんかするデジモンにゆうせんするこうどうをしていする。「スペシャルアタック」はひっさつ技をよくつかい「サポート」はSPをよくつかう。「ノーマルアタック」はりょうほうをバランスよくつかう。」
- `txt_list_txt.csv` 第 1466 行：`txt_list_txt.dat` #1464 說明在隊伍設定畫面可以更改「チーム名・さくせん」。
- `txt_list_txt.csv` 第 1562–1563 行：#1560–1561 說明可以為每隻數碼獸指示「スペシャルアタック」等作戰。

### 2. 程式（`unpacked/system/arm9.bin`，base `0x02000000`）

- **setter `0x02092568`：** `team[+0x24 + member*4] = r2`。
- **getter `0x020925DC`：** 讀取同一個欄位。
- **隊伍初始化 `0x020924A0`：** 三個成員都寫入 `str r1(=1), [r2,#0x24]`。
- **清單建構 `0x0205096C`–`0x02050A24`：**
  - 每個成員一條清單，位置在 `self+0x2FC+0x5800 + member*0xE18`。
  - 先呼叫 `0x0205A434` 初始化。
  - 再依序呼叫 `0x0205A514(list, -1, 1)`、`(…, 2)`、`(…, 4)`，加入三列。每列的第三個參數存到該列的 `+0x1B4`。
- **清單選取欄位 `+0xDF8`：**
  - 設定由 `0x0205A568` 負責，讀取由 `0x0205A570` 負責。
  - 這個欄位是列的索引：`0x0205A62C` 用 `+0xDF8 × 0x1B8 + 0x34` 定位到該列。
- **開啟選單：** 在 `0x020515E4`／`0x020516DC`／`0x02051A30`／`0x02051B04`，先用 getter 讀出 policy，再交給 `0x0205A568` 設成游標位置。
- **確定選擇：** 在 `0x020525A0`／`0x020525CC`，用 `0x0205A570` 讀出游標列號，再交給 setter 寫回。
- **以上兩點合起來證明：** 存檔裡的 policy 等於選單的列號 0／1／2。
- **列的繪製 `0x0205A180`：** 每列有兩個 sprite。`+8` 播放 `+0x1B0` 指定的動畫（清單共用，這裡是 0，也就是底板），`+0xDC` 播放 `+0x1B4` 指定的動畫（標籤 1／2／4）。

### 3. 圖像（`unpacked/nitrofs/battle_menu/`）

- `battle_setting_obj_main.nanr`：17 組動畫，第 k 組只有一格，就是 cell k。13、14 是例外，各有 4 格。這一點已用 `nanr` 解析確認。
- `battle_setting_obj_main`（參考圖 `YDIJ_ART_PACK_ASSEMBLED/01_介面/battle_menu/battle_setting_obj_main/sheet.png`）的格子內容：
  - cell 0：灰色選項底板。
  - cell 1：「スペシャルアタック」。
  - cell 2：「ノーマルアタック」。
  - cell 3：「TPセーブ」。
  - cell 4：「サポート」。
  - cell 5：「ガード」。
  - cell 6：「フリーファイト」。
  - cell 8–11：「リーダー／サポーター／アタッカー／フリー」。
- **排除另外兩組圖：**
  - `battle_setting_obj_sub` 只有 3 格，沒有第 4 格。
  - `battle_setting_window` 的 11 格都是場地預覽圖。
  - 所以標籤只能來自 `obj_main`。

## 仍未確認的部分

- **policy 0／2 實際影響哪些 AI 數值：** 「必殺技更常用／SP 更常用」是 ROM 說明文字的描述。AI 表 `0x02115B64` 等依 profile 選擇哪一列，已記錄在 `battle-normal-flow.v1.json` 的 personalityWiring，但沒有逐項量測各方針的出招比例。
- **未使用的標籤：** cell 3、5、6、8–11 的用途沒有追蹤。在本選單中沒有被加入，可能是開發中刪除的內容，屬 UNKNOWN_REQUIRES_TRACE，不得自行啟用。
- **只在 ORIGINAL 模式生效：** 產品目前只有自由對戰與練習對戰走 ORIGINAL 接線，其他模式仍是 BASELINE，不讀 policy。開放選單之前，需要 Owner 決定哪些模式要讀取 policy。

## 追蹤方式

- 使用 capstone 5.0.7 唯讀反組譯 `arm9.bin`，用 Python 解析 NANR。
- 腳本都放在 session scratchpad，不進產品 repo：`dis.py`、`scan.py`、`callers.py`、`nanr.py`。

## 產品實作（同日，Owner 授權）

- **選單：**
  - 自由對戰：參賽面板中，每選一隻拍檔，下方就多一列方針。
  - 練習對戰：每一列可參賽的拍檔都有一個下拉選單。
  - 選項依 ROM 列序排列：必殺技優先、普通攻擊、支援優先，預設是普通攻擊。
  - 頭銜賽的參賽面板不顯示方針，因為頭銜賽不讀取它。
- **存檔：**
  - 欄位是 `progression.battleTactics`，格式是「instance id → 0 或 2」；沒有記錄的就是預設值 1，所以舊存檔不需要遷移。
  - 正規化由 `normalizeBattleTactics` 負責。
  - 合約記錄在 `docs/contracts/championship/BATTLE_TACTICS_20261028.json`，存檔模組的 source lock 由這份合約接續。
- **接線：**
  - 自由對戰和練習對戰在準備隊伍時，替每隻拍檔附上 `tactic`，再交給 `buildOwnedBattleCreature`。
  - ORIGINAL 性格接線（`originalPersonalityFields`）把 policy 0／1／2 原樣當作 profile。
  - 其他模式維持 BASELINE，不讀取 policy。
- **驗證：**
  - `tests/championship-battle-tactics-cases.mjs`：正規化、存檔往返、只有兩個模式讀取、選單依 ROM 列序。
  - 瀏覽器 developer 讀數：練習對戰 A 隊拍檔 `tactic 0 → profile 0`，B 隊拍檔 `tactic 2 → profile 2`，policy ORIGINAL。
