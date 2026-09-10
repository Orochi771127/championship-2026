# R9 正常選招、接近、發動與收招接線

狀態：**NORMAL_FLOW_SLICE_IMPLEMENTED_AND_TESTED；完整原作對戰仍為 PARTIAL。** Owner「開工」後，已修改既有遊戲對戰模組，完成預設場次的正常攻擊循環。R9 原計畫要求的整場原作執行紀錄比較仍未完成，不把這輪的函式 CPU 比對升級為整場 ROM 相同。

位置：`R:\Projects\Championship2026\championship-2026`；branch `main`；HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7` 加共享未提交工作樹。開工已有 638 筆 dirty entries；保留其內容。本輪沒有建立第二套 renderer、ticker、store、save 或 RNG。

## 本輪實際改變

- 初始站位由原作 `0210FD40` 表接到現有 native world，依每隊 1／2／3 隻配置；兩隻隊伍使用表中第二、第三個位置。戰場的 416×272 原始座標繼續投影至同一 Pixi 場景。本輪採用進場完畢的站位，沒有宣稱完整入場鏡頭已還原。
- 原作 `02111F20` 目標選擇、`02115F38/021161F0/02116314` 位置／接近、等待與 14／15／16 發動分支接進原本 battleSession。正常選招先移動、檢查距離及方向，再配置攻擊物件；原本「選到招就立刻配置」的 adapter 不再控制正常場次。
- 每隻角色使用原作三個一般攻擊槽 `+78/+7C/+80`，共用原本 12 個攻擊物件池，依池索引順序推進。`committedAction` 只保留為相容查閱，不另成為攻擊清單。
- 接回 `C144` 的 owner lock、全域演出鎖、物件占用、目標 HP 與資源拒絕順序。成功發動只扣一次資源；原作允許資源恰好等於消耗。
- 修正實際造成第一招後卡住的錯譯：`0211CEC4` 取得鎖，`0211CEFC` 在 owner 值相符時解除鎖。原先兩者都被翻成取得鎖。取消／釋放也依 `021156BC` 清除第一個相符攻擊槽，僅解除同一物件的 owner lock，保留其他在途物件。
- 普通通知 0–12 的已測正常入口、原始 sequence 0／2／3／7–10／35、方向速度、衰減衝量與六角色距離矩陣接回同一 native animator／world。受擊後沿用 R8 落地、復起與倒下流程。
- 原作每個 populated slot 的兩次 `021140CC` 初始化都消耗共享 RNG，每次函式各讀兩次。修正後 RNG 歷史及接觸時機改變，因此重新找可重現場次；沒有沿用舊種子的結果。
- 支援 kind2/3 由前置 VM 完成後的 `C714` 分支呼叫一次，接我方目標、回復／解除／正向狀態與輔助 VM。這部分已驗證數值／接線；下表三場沒有自然選到 state16，不列為完整支援招式正常玩法驗收。

## ROM 證據與可重現驗證

ROM SHA-256：`8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`；OVL19 SHA-256：`d660e3e0bf243541c356c54dcbd1aec58e8df6c2dfaf4a5854d375a5f2d13715`。

原始 ARM 指令由 `scripts/research/trace-battle-normal-flow-cpu.py` 執行；輸出為 [CPU receipt](../../../research/BATTLE_NORMAL_FLOW_CPU_2026-09-07.json)，產品只增加數值表，沒有複製圖片／模型。動畫完成、配置成功／失敗、RNG 輸入與少數 scene/status service 是明示控制點；並非模擬器整場錄製。

| 比較項目 | 原始 CPU 案例數 |
| --- | ---: |
| 目標 selector 0–12（10／11 本批為空快取） | 1,040 |
| states 3／4／5 距離、角度、邊界及動作選擇 | 1,350 |
| C144 拒絕及扣款順序 | 128 |
| 1／2／3 隻站位 | 3 |
| 移動倍率與 RNG 消耗 | 103 |
| 普通通知入口／長時間跑動衰減 | 91 |
| 共通位移及衝量 | 400 |
| 六角色距離、角度、分離矩陣 | 70 |
| states 14／15／16 配置、拒絕、通知及收招計數 | 900 |
| 攻擊鎖取得／解除／owner cleanup | 72 |
| 我方隊伍支援選擇累積值 | 300 |
| kind2／3 回復／狀態寫入（status service 為控制點） | 310 |

Focused checks **17/17**（16 個 CPU／受擊 runtime 測試，加 1 個正常場次整合測試，分次執行）；完整 `node --test tests/*.mjs` **1208/1208**，無 skip/todo。見 [focused log](focused.tap)、[normal flow test](normal-test.tap)、[完整回歸](regression.tap)。原有 R8 CPU 受擊／落地／復起測試仍通過。

正常測試僅指定原始場次／schedule／seed，不直接呼叫攻擊或寫 HP。指令：

```powershell
node scripts/audit-battle-normal-flow.mjs --seed=9 --seed=25 --out=docs/art/production/battle-normal-flow-r9/normal-runtime.json
```

| 場次／seed | 正常發動次數 | 觀察到的招式 ID | 戰鬥 clock | 復起及清除 |
| --- | ---: | --- | ---: | --- |
| match0／20 | 15 | 179、98、254 | 582 | 全員倒下判定後結算；impact 11/11 釋放 |
| match1／9 | 34 | 179、254、180、255 | 1637 | 槽3 於 clock1380 復起為54 HP，回到 AI 並再出招；impact 53/53 釋放 |
| match1／25 | 45 | 179、254、180、255、181 | 1832 | 槽0 於 clock1496 復起為54 HP，回到 AI 並再出招；impact 52/52 釋放 |

三場結算後皆無 active launches／owner locks／一般槽或 active impacts。記錄含原始輸入、每次選招／狀態／發動與扣款、落地／復起及 source hashes：[normal-runtime.json](normal-runtime.json)。match0 本輪未記錄未接服務；match1 仍記錄既知音效 `0203EA30` 及特殊招式的 `0211DF68` graph 缺口。

舊 R8 seeds1/8 在正確初始化／接近流程下不再觸發舊復起結果。新的正常回歸用 seeds9/25 驗證敵我兩方復起後再出招；結束取消 pending notification20 的條件由原始 CPU 及有明示初始狀態的 runtime 測試保留，**沒有宣稱本輪三場正常場次看到了該取消分支**。舊 R8 receipt 不覆寫。

## 手機尺寸瀏覽器

既有 fixture 使用相同 app/runtime/Pixi 模組、獨立記憶體存檔與明示 schedule／seed。黃色區域是測試工具，不是新增遊戲介面。

- 390×844、seed9：初始站位 → 接近 → 命中 → 落地 → clock1380 的 54/1080 HP／sequence33 → clock1448 復起完成 → 正常結算，報名後 9400、結算後 27400 bit。
- 320×740、seed9：關閉減少動態效果後正常命中，戰場與按鈕可見，無橫向捲動。
- [初始站位](01-ready-390.png)、[接近](02-approach-390.png)、[命中](03-hit-390.png)、[復起數值](05-revival-hp-390.png)、[結算](07-result-390.png)、[窄手機命中](08-hit-320.png)。DOM／角色／native 診斷保存在同目錄的 JSON。

這是瀏覽器尺寸驗證，沒有實體手機驗收。本輪保留既有 bright UI、素材與呈現，未做新的 UI 視覺設計。

## 尚未完成與下一個安全步驟

1. **整場 ROM 相同仍未知**：原始進場前完整 RNG 歷史、profileIndex 的 roster 來源及全部模式尚未接齊。本輪正常 fixture 仍使用既有 profile0、明示 seed、preset player team；不能稱牧場角色出戰完成。selectors10/11 非空快取、notification0 的零 HP 入場等分支也未列入本批正常驗收。
2. **R9 部分分支未收尾**：state16 action1 的 `02116FD8` 後續候選／負向狀態鏈仍明示缺口；負向 AI state bodies 接續 R11。states6/7 使用既有已驗證等待模組。launch 的 global `+5EA8==2` 中止輸入已做受控 CPU 比較，但正常 runtime 尚未接原始全域欄位（保留 false）；不可宣稱所有全域拒絕分支已閉合。初始站位已接通，但完整 entry／mode 變體未驗收。
3. **R10 演出依賴仍在**：`0211DF68` 的 2D pool／世界參照、所有投射物旋轉碰撞／命中偏移／次級與落地特效，以及 `0203EA30` 音效資源及時序。這輪六筆曾出現的 move ID 不代表六招完整 VFX 通過。
4. 下一輪先以 match0 move179 近身流程保留回歸，再處理 match1 move180/181 實際回報的 `0211DF68` 資源池與參照，建立一個完整投射物生成→移動→接觸→命中／落地→清除案例；同步保留 R9 未驗收分支清單。
5. Home-owned 三人組隊、養成數值／招式來源及結算寫回，養成／狩獵／捕獲／進化完整動作觸發、全角色逐招與實體裝置驗收繼續依 R12–R14 推進。

`normalGameplayAcceptedRecords` 保持 **0**；67 native bodies／3014 static call sites 是程式覆蓋，不是完整招式品質驗收。素材／rights／shipping 狀態皆未升級。
