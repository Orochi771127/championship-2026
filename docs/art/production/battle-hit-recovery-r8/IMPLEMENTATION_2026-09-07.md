# R8：受擊結果、落地與復起

本輪已把原作受擊寫入與落地／復起處理接入現有正常對戰。角色由 AI 選招、原生腳本命中後，更新同一份角色 HP、狀態與動畫；成功復起後能再次由 AI 發動攻擊。這是完成一段正常流程，整場戰鬥的原作符合度仍為 **PARTIAL**。

工作位置：`R:\Projects\Championship2026\championship-2026`，branch `main`，HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7` 加現有未提交工作樹。原先已有大量共享修改，本輪不提交、推送或部署。

## 本輪改動與原作依據

| 行為 | 原作依據 | 現在的處理 |
| --- | --- | --- |
| 命中寫入 | OVL19 `021149A8`，結果寫入 `02114D20..02115670` | 更新 HP、反應型別、方向、計數與狀態；中斷既有一般攻擊物件 |
| 受擊與死亡區別 | state `0x17` 與 notification `15/18..21` 的讀取條件 | 存活的受擊角色保留正常顯示；HP／最終倒下旗標決定倒下顯示 |
| 普通攻擊造成 HP 0 | `02114FAC` | 當下就把 HP 固定為 0，仍完成反應與落地，才進倒下／復起判定 |
| 擊退、旋轉與落地 | `021130C8`，SDK `0204819C → 020482AC` | 依原始 Q12 更新順序推進，使用原始序列與完成訊號，落地歸零高度 |
| 異常狀態 | `0211452C/021145C0` | 接上單一負面狀態槽、期限、狀態入口、圖示欄位，以及 reaction12 落地處理 |
| 持續傷害 | `0210D700..0210D8B4` | 只有到期的扣血更新才檢查 HP < 0；清負面狀態、通知與高度，不套用普通攻擊的正面狀態清除 |
| 復起條件 | `021138C0/021139AC` | 使用原始隊伍計數、group7 可負擔候選、表格值與 RNG 216；保留搖晃／嘗試計數 |
| 復起動作 | `02113B4C` | raw sequence33，扣候選招式資源，恢復截斷後最大 HP 的 5%；move29 為 30% |
| 恢復行動／最終倒下 | `02113B4C/02113D10` | 等動畫完成才回 notification1；戰鬥結束會中止復起；最終倒下計數只加一次 |

修正的兩個底層細節：旋轉 SDK 使用 actor `+C/+10` 的有號 32 位欄位；狀態觸發判定使用尚未限制上界的攻防等級，傷害曲線仍依原作限制到 26。不得把前者誤寫成 16 位旋轉欄位，或把後者直接沿用傷害曲線的索引。

R8 使用現有 `battleSession`、`battleNativeActors`、角色 animator 與原生更新節拍。DOM 仍負責 UI，Pixi 仍負責角色與場地；原有 Three 命中特效層沿用。沒有新建 router、store、save、renderer 或 ticker，沒有把原始 ROM 美術加入 runtime。

## ROM 執行比對

原始 ROM SHA-256：`8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`。

OVL19 SHA-256：`d660e3e0bf243541c356c54dcbd1aec58e8df6c2dfaf4a5854d375a5f2d13715`。

研究腳本實際執行 ROM 的 ARM 指令，再將輸出與 JavaScript 寫入逐欄比對：

| 比對項目 | 數量 | 結果 |
| --- | ---: | --- |
| 命中結果、狀態觸發與等級上限邊界 | 251 組 | PASS |
| 14 種 reaction 的逐次更新 | 8,106 個更新幀 | PASS |
| 落地、重複受擊與狀態等待邊界 | 192 組 | PASS |
| notification18/19/20/21、計數、HP／資源寫入 | 1,254 組 | PASS |
| 持續傷害到期、剛好 HP0、低於 0 與非扣血分支 | 245 組 | PASS |

這些不是整場 ROM 對戰回放。命中 oracle 明示供入既有傷害核心的結果與等級索引；動畫完成、高度、復起候選、隊伍／結束旗標與部分場景服務是控制輸入。反應函式、落地、狀態寫入、垂直 SDK 與復起分支使用原始指令。機率表與 SinCos 數值直接從 ROM 地址讀取，沒有使用自行設計的復起率。

可重跑：

```powershell
python scripts/research/trace-battle-hit-recovery-cpu.py --rom R:\8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1.nds --out docs/research/BATTLE_HIT_RECOVERY_CPU_2026-09-07.json --tables src/data/championship/battleHitTables.json
node --test tests/championship-battle-hit-recovery-cpu-cases.mjs tests/championship-battle-hit-runtime-cases.mjs tests/championship-battle-frame-loop-cases.mjs tests/championship-battle-session-cases.mjs
node scripts/audit-battle-hit-recovery.mjs
node --test --test-concurrency=2 tests/*.mjs
node scripts/audit-battle-action-coverage.mjs --check
git diff --check
```

## 正常對戰與瀏覽器

以下從既有 AI 正常選招開始，明示測試場次與 RNG seed，沒有注入命中、HP 或復起結果；玩家仍為既有預設隊伍。

| 場次 | 正常流程結果 | 特效建立／釋放 | 結算剩餘攻擊物件 |
| --- | --- | ---: | ---: |
| match0，seed20 | 命中 → HP0 → 落地 → 最終倒下；時鐘 510 結算 | 10／10 | 0 |
| match1，seed1 | HP 0 → 54／1080 → 戰鬥結束中止復起；時鐘 1719 結算 | 55／55 | 0 |
| match1，seed8 | HP 0 → 54／1080 → 動畫完成 → 回到 AI 出招；時鐘 1611 結算 | 58／58 | 0 |

seed8 的復起 HP 寫入發生於時鐘 1280 後的視圖 1281；notification20→1 發生於時鐘 1348 後的視圖 1349。復起不會只因 HP 回復就立即解除等待。兩個正常復起案例沒有選到付費復起招式；move28/29 的扣款與 move29 的 30% HP 僅由受控 CPU 比對證明，未宣稱正常場次已覆蓋。

390×844 瀏覽器使用同一場次完成受擊、落地、復起、動畫完成及正常結算，測試錢包從 10,000 扣至 9,400，勝利結算後為 27,400。320×740 再檢查正常命中與角色動作，clientWidth／scrollWidth 均為 320；390 寬亦無水平溢出。兩個 canvas 是既有 Pixi 與 Three 在同一場地的重疊層，沒有新增第二個遊戲視窗。瀏覽器錯誤紀錄為空；這不代表 VM 中已知的缺失服務已補齊，也沒有宣稱實體手機驗收。

上方黃色區塊是測試頁控制列，不是產品 UI。

- [命中後的角色](phone-hit.png)、[落地](phone-landed.png)、[復起 HP 寫入](phone-revive.png)、[復起動作完成](phone-ready.png)、[正常結算](phone-settlement.png)。
- [390 寬 DOM／狀態紀錄](browser-receipt.json)、[320 寬紀錄](browser-320-receipt.json)。
- [正常 AI 事件、資源與來源檔案雜湊](normal-runtime.json)。

集中測試 **45／45**；完整回歸 **1,195／1,195**。招式靜態覆蓋仍為 67／67 個 native body、3,014／3,014 個呼叫點；`normalGameplayAcceptedRecords` 仍是 0，這個數字不能因 R8 通過而改成所有招式已驗收。初次全回歸抓到新增兩個模組尚未加入既有檔案白名單，已只增列本輪授權的檔名，再完整重跑通過。

## 仍為部分完成／未知

- 整套原始接近、轉向、目標偏好與 launch states4..16 尚未完整接入；目前原有一般攻擊接線以一個 committed action 表示原作三個一般攻擊槽。復起返回後使用這份既有接線恢復選招，不能據此宣稱整場節拍與 ROM 完全相同。
- 通知共同尾段接上本輪需要的邊界、方向及座標回寫；一般移動的其他速度／轉向欄位未全部移植。
- 狀態結果寫入、期限清除與 reaction12 已接上；其他狀態對應的完整 AI state body 尚未全部驗收。
- 正常特殊招式180/181 仍回報 `0211DF68` 所需的世界／2D 特效物件圖；180/181/255 的 `0203EA30` 音效服務仍未接入。沒有用空白成功回傳掩蓋這些記錄。
- 完整飛行特效資源、命中特寫／停頓／音效、全招式正常路徑、牧場自有組隊，以及養成／狩獵／捕獲／進化觸發不在本輪完成範圍。

下一個安全步驟是完成已知特殊招式的 2D 特效物件與世界參照，並逐招驗證正常施放；同時保持 R8 的受擊、落地、復起回歸不退步。原作已知數值與條件持續保留，未查明的行為維持 `UNKNOWN_REQUIRES_TRACE`。

[本輪 runtime contract](../../../contracts/championship/battle-hit-recovery.v1.json)；[CPU 比對資料](../../../research/BATTLE_HIT_RECOVERY_CPU_2026-09-07.json)。R8 只取代 R7 報告中「受擊／落地／復起尚未接入」的部分，其餘缺口與 shipping 限制仍保留。
