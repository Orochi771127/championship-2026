# 牧場場景製作計畫 — 2026-09-06

Owner 本輪指示：「下一步請幫我規劃該怎麼製作，然後開工」。沿用本串明亮 UI、原作多籠組合與原生角色／籠子比例方向。專案 root：`R:/Projects/Championship2026/championship-2026`；branch `main`；開工 HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。共享工作樹有既有修改，本輪不 commit、push 或部署。

## 製作順序

| 批次 | 要解決的問題 | 實作與交付 | 進入下一批的條件 |
|---|---|---|---|
| R1：配置到場地的完整組裝 | 載入前 `.filter(Boolean)` 會悄悄略過缺少素材的籠子；格位與模組身分未保留到合成結果；非同步載入可讀到變動中的配置 | 從既有 Cage Edit 投影完整場地計畫；保留 moduleId／slotIndex／definition／fieldId；載入前快照；整組拒絕缺圖；同組共用素材只載入與釋放一次；正常存檔流程驗證 | focused／regression／正常 Home → Cage Edit → Home → Save → Continue 通過。這批已開工 |
| R2：原作拼接與角色位置 | 暫用 shelf 排列不等於原作牧場；兩個 prototype habitat 與已放置的籠子尚無原作映射 | 追 OVL15 board index／hit test 與 Training 場地 compositor；建立座標、原點、順序、bounds 的來源契約；再替換既有 `ranchSlotGeometry.js` 的暫用座標，將角色和落點共用場地轉換 | ROM 指令／資料來源與 consumer 對得上，至少一組不同尺寸多籠的原作畫面或 live trace 交叉驗證；不得由背景六角形直接猜 slotIndex |
| R3：明亮場景與手機操作完成 | 場景與 UI 的層次及小螢幕辨識需細修 | 保留奶油白、青綠、金色 UI；整理角色遮擋、選取回饋與觸控；接入已通過既有 224 角色工作線的完整素材 | 原生比例不漂移；正常遊戲路徑可見；五種目標手機 viewport、桌面與實機分開記錄；新造型與完整動作分別驗收 |

第一個場景里程碑是「配置多籠 → 回牧場 → 看見與配置一致的場地及角色 → 操作 → Save／Continue 還原」。先完成這條流程的真實性，再擴張其他 Raising 功能。餵食、成長、訓練效果與跨籠移動規則各自需要原作控制流程，不由美術或本計畫創造。

Owner 本輪追加詢問畫面中的兩塊長方形框。查明為 Moonwell Pool／Quiet Hollow 原型操作區域的可見描邊後，已在 R1 提前移除正式籠子場地上的這層描邊。操作區域資料仍留在既有 authority 中，選取／拖曳需回歸；後續替換成原作場地映射仍屬 R2。

## 本輪已確認的材料與依賴

- 上一批 224 靜態 Main 身分圖的原生比例資料與 40 籠子 native 尺寸可沿用。[比例驗收](../art/production/tooling-pilot-r1/scale-review/README.md)。它不證明 live Raising camera／OBJ transforms。
- CageDefinition → 圖像的既有 binary crosswalk 可沿用；Waiting Room 的 moduleId 是 `championship:2026:cage:waiting-room`，不是數字 35 的字串 ID。角色 instanceId 不可拿來替代 Cage moduleId。
- 既有唯一 DOM／Pixi／app／save authority 不變。R1 不建立新的存檔、遊戲配置或第二套渲染器。
- 原作研究工具 `ndspy`、`capstone` 已可用，不需額外安裝軟體。
- 角色新造型繼續使用 `characters/appearance-refresh-v1/pixel-v2/PLAN.md`；本輪不覆寫其他角色製作中的檔案，也不重新啟動第二套角色管線。

## 原作查證已開工

先查 Championship Evidence MCP，再直接讀取 SHA-256 `8ad375ba…c5d1` 的 Owner ROM。本輪記錄了 15 個 `cage_edit_bg_main`／14／16／18／20 背景輸入的 file ID、大小和 hash，以及 OVL15 的一段 bounded ARM window。[可重現查證腳本與 receipt](../research/ranch-assembly-2026-09-06/rom-entry-receipt.json)。

舊契約提到 `OVL15 0x0210B36C` 是 cover switch；實際該指令為 `bl #0x02048678`，附近是一串建構／載入形狀的呼叫，不能直接拿它當作格位座標證據。線性反組譯 window 可能含 literal pool，沒有把整段都判定為可執行控制流程。MCP 另一份 OVL4 報告使用相同 RAM 位址而有不同指令，更說明必須保留 overlay 身分，不能只比位址。

美術包中也實際存在不同 rank 的 Cage Edit 背景；它們顯示六角格底圖，但不足以證明可互動格位編號或 Training 場地拼接。下一次 trace 應串起背景選擇、點選座標 reader、slot record 與場地貼圖 consumer，避免把視覺網格當成 gameplay 真值。

## 驗收狀態

### R2B 接續 — 2026-09-06

Owner「請接續 開始開工」後，已實作一般籠子、空格補圖與底牆三段 tile 合成流程：上排裁三列、右邊界接回同列、不同透明／屬性寫入條件、底牆重複覆蓋。582 組原始 ARM9 重播與 JavaScript 的四個輸出資料層完全一致，涵蓋 38 組來源與四種等級寬度；聚焦測試 38/38 通過。也直接執行了 Waiting Room 與三個起始籠子的定義／anchor 寫入段落。

後續不再把上述 tile-copy 邏輯列成未知；剩餘接入工作是分層 production 材料、物件與動畫座標、固定與 filler record 流程、舊存檔相容及角色／觸控映射。正式畫面仍未切換，既有存檔沒有重新排列。[R2B 實作報告](../art/production/ranch-assembly-r2b/README.md)。

### R2A 後續開工 — 2026-09-06

Owner 接續「好，請你幫我接著開工」後，已找到並重播原作的占格與座標鏈：16 種形狀遮罩、36 定義的 shape index、20 個編輯板 anchor，以及 Training 的目的 tile 座標。2,560 組原始 ARM 放置案例、320 組場地座標案例與 JavaScript 移植一致。已修正 `ranchBoardCell` 的錯誤交錯方式，並撤回每籠固定一格的 VERIFIED_BINARY 標記。

本頁前段「尚未找到座標」的歷史描述，現在由 [R2 原作座標契約](../contracts/championship/CHAMPIONSHIP_RANCH_NATIVE_GEOMETRY.v1.json) 細分取代：board origin 和 field destination tile origin 已驗證；完整來源裁列、跨邊界拼接、Waiting Room／空格補圖、角色 world transform 與舊存檔相容仍待完成。正常畫面尚未切到原作 compositor。[R2A 實作報告](../art/production/ranch-assembly-r2/README.md)。聚焦 33/33、完整回歸 1,118/1,118 通過。

R1 的實作、測試結果與正常流程截圖集中在 [ranch-assembly-r1](../art/production/ranch-assembly-r1/README.md)。R2 是已開始取得原始證據、尚未完成座標還原；R3 尚待其前置條件。不以本輪工程修正宣稱牧場拼接、角色站位或整款遊戲已完成。
