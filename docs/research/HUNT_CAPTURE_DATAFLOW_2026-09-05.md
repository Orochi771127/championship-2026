# 原作捕獲 HP → Rope → 手掌 → 記憶卡 → 返家資料流

2026-09-05。專案 `R:\Projects\Championship2026\championship-2026`，branch `main`，HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`，在既有未提交工作樹上完成。Owner 的第三輪及本次追通要求已授權這個範圍。

**已閉合一個受控個體的原作資料流，並接通既有 app 的結果／ID／存檔／Continue。正常玩家入口的完整捕獲尚未通過。** 本次不是只比對自寫公式：使用 Unicorn 執行指定 ROM 的 ARM 指令，逐次比對 JavaScript。亂數結果、目标位置及動畫階段是顯式測試輸入；不把它說成實機遊玩或完整野生 AI。

## 身分與資料鏈

Owner ROM SHA-256：`8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`。腳本直接從 ROM 解壓 ARM9、OVL0、OVL14，驗證雜湊及 16 個關鍵連接指令。舊研究的 OVL4 美術名稱不能用來推定本次返家寫入所在 overlay。

| 邊界 | 原作直接證據 | 本次結論 |
|---|---|---|
| 野生紀錄池 | OVL0 `02119B7C–02119BC8` | context+108 分配 24 個 stride 1C8 紀錄，context+104 為同一池的指標陣列 |
| 個體建立 | OVL0 `0211A944` 呼叫 ARM9 `02062100`，`0211A95C` 複製到池 | species 資料進入個體；後續 `02062C28` 是其他狀態更新，不是 HP 來源 |
| 個體綁定 | OVL0 `0211AA5C` → ARM9 `02065EB0` → `0206489C` → OVL0 `0210B924` | `W+110=R`；沒有拿 battle preset 作野生個體 |
| HP 初始化 | ARM9 `020622EC–02062374`；OVL0 `0210BA00–0210BA24` | R+50、R+58 同值；W+4E8、W+4EC 分別複製兩者 |
| Rope 初始參數 | OVL0 `0211585C–0211597C`、`02115ACC–02115AF4` | species 世代、+70 分類、R.maxHp 與 Rope 表決定傷害及耐久 |
| Rope 扣血 | OVL0 `02114F54–02115284` → `0210C3C8` | 平方距離分段、Q12 累積與上下限寫入；沒有捕獲機率擲骰 |
| 倒下完成 | OVL0 `0210CB48–0210CBE4` | HP=0 先播倒下；完成後才寫 state=2、hand-ready flag=1 |
| 手掌及 G 檢查 | OVL0 `02113B74–02113B8C`、`0210CBF4–0210D0E4` | 手掌 event16；算卡上 G，不算 Home 名單；超過容量送39，允許送20 |
| 收取事件接收 | OVL0 `02116E50–02116E70` | 保存事件的野生 ID 並轉入結果動畫狀態 |
| 卡片插入 | OVL0 `02117458–021178A0` | 插入動畫子階段 counter >10，複製來源 R 到 card[count]，然後 count+1 |
| 返家插入 | OVL14 `0210C03C–0210C0D0` → ARM9 `02061BB4–02061FC8` | 找 16 格育成池的第一個空槽，設 occupied，複製 R，增加名單数、更新圖鑑旗標，最後清卡 |

`W` 是野生行為物件，`R` 是其來源個體紀錄。相同 offset 在 UI 物件中可能意義完全不同。例如 OVL0 `02118884` 一帶的 +4EC 是另一個 UI 動畫欄位，不能當作 W.maxHp 的修改。

## 原作數值及重播

HP 使用 species+30 的階級：讀該階 HP 與下一階（最高24），差值除2後再除10取整；把 B7 亂數結果對此除數取餘，再乘10加回基礎 HP。本次原作執行也驗證了最高階除數為0的情形：原作除法 helper 回傳餘數0，不額外加上亂數。

Rope 的兩個平方距離常數 `0x640000`、`0x1900000` 是 **40²、80² 的 Q12**；斷裂比較是嚴格大於 `0x6400000`，即160²。它們與另一個 proximity/shutter helper 的 40／80／256 半徑不同。+71 分類等於2會額外耗損耐久。

傷害 Q12 累積達4096時，原作先扣 `accumulator >> 12` 點 HP，再只從累積器扣 **4096**。不能擅自改成 `%4096`；大傷害率的多步重播確實保留較大的累積值。>=80 像素另送 event11／阻擋時13。event11 在 `021118C4` 這個 AI handler 會透過 `0210C2E8(mode=0)` 再扣1；不同野生狀態的派送及移動仍需完整繫結，故本次 flow 不把這項當作所有狀態的固定額外傷害。

受控樣本為 **species-008**，HP 階0：base200、next280、B7=37 → HP210。Rope index0、分類1、coefficient80、durability byte6 → 初始耐久360、傷害率3584 Q12。在 target anchor=(0,0)、觸控距離60像素的240次原作更新後：

| 狀態 | 原作 CPU 重播結果 |
|---|---:|
| 野外目前 HP | 0 |
| Rope 耐久 | 120 |
| Rope 累積器 | 0 |
| 原始個體目前／最大 HP | 210／210 |
| 手掌接受後、插入前卡片數 | 0 |
| 插入子階段完成後卡片數 | 1 |
| 卡片個體 HP | 210 |
| 返家育成池數量 | 1 |
| 返家育成個體 HP | 210 |
| 返家後卡片數 | 0 |

另有9組 HP 初始化向量，以及39／40／79／80／160／161像素和高傷害累積器的原作 CPU 向量。腳本列出所有被替換的圖形／事件／硬體除法 host adapter；沒有未列出的外部原作呼叫被自動略過。原作完整動畫、野生行為、場上亂數和硬體存檔格式不在 CPU 重播範圍。

可重播指令（Python 需 ndspy、capstone、unicorn）：

```powershell
python scripts/research/trace-hunt-capture-closure.py --rom R:/8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1.nds --out docs/research/HUNT_CAPTURE_NATIVE_REPLAY_2026-09-05.json
node --test tests/championship-hunt-capture-closure-cases.mjs
```

## 2026 接線與限制

既有 `huntRuntime` 持有捕獲狀態模組；顯式注入的一個 native replay record 才能走這條流程。資料來源與 world 的 species ID 必須一致。沒有預設亂數、沒有借用三個產品 Rope tier 的展示數字，也沒有把全地圖的六個 prototype wild 改成已驗證分布。

`exitHunt` 有卡片時走既有 `HUNT_RESULT`；命名改卡片暫存。返家確認先準備單一既有 ID 分配器和 Raising 名單，再由既有 persistent save port 同筆寫入。成功才發布名單並清卡；失敗保留結果頁與卡片，既有 retry facade 回到同一交易，不重複分配。普通 save 不可默默漏掉待提交的卡片。16格滿額時保留卡片，原作完整放生／替換選擇頁仍未實作。

存檔僅在既有 collection 個體上增加可選的 `capturedVitals {currentHp,maxHp,traceId}`，保留本次已知的來源 HP。這不是完整 profile；TP、成長階級、技能及其他個體數值不補造，既有 battle profile gate 不因此解除。外層存檔v3、ID高水位、單一storage key、歷史來源標記及既有router／ticker均沿用。

原作向量與 ROM 指令留在 research／tests，沒有 ROM 圖像、decoded resource 或原始個體 bytes 接入 shipping runtime。這次 CPU 資料流及 app Save／Continue 測試通過，不等於正常觸控入口可以完整捕獲。下一個安全工作是原生工具輸入與 cadence → 野生狀態事件11／移動 → 實際動畫完成通知；同時取得指定地圖實際產生的個體和完整 RNG state。已閉合的 HP、G 檢查、卡片寫入和 Home 插入不再列作未知。

驗證：新增 focused tests **14／14**，全專案 `node --test --test-concurrency=2 tests/*.mjs` **935／935**。最終接線與畫面初始狀態調整後，捕獲資料流、第三輪輸入、VS3 app、第二輪個體 ID 的擴大 focused regression **32／32**；`git diff --check` 通過。包括重複手掌／插入／確認、G容量等號和拒絕、育成16格滿額、存檔失敗及既有retry facade、重新載入，以及同種第二隻的獨立ID。此輪沒有宣稱瀏覽器或真實觸控裝置已完成捕獲。
