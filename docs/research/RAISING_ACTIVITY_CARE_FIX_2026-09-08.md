# 育成自主活動、肉／維他命與清潔圖像修正

日期：2026-09-08。正式 repo `R:\Projects\Championship2026\championship-2026`，branch `main`，HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。保留既有 shared dirty tree；沒有 commit、push 或部署。

## 問題與這次結果

Owner 指出數碼獸不會持續活動、肉與維他命畫錯，以及清潔沒有圖像。

- 舊 actor 有 idle 隨機門檻，卻沒有推進門檻後的選擇；只有追食物才會走。現在接入原作 idle counter、Cage／性格反應、自由走動、相鄰角色反應／跟隨，以及反應完成後回 idle。使用既有 native Main bank 的數字 sequence、ticks、鏡射與 Q12 位置；跳躍高度與地面陰影分開。
- 舊畫面在 22:00 停鐘時永久停留。原作 `0210D610` 讀 day-end flag 後進 state 10；`0210FAFC` 送入日切換分鐘。既有 ticker 現在於 active Home 呼叫同一個既有 `endDay` calendar command，一次切到下一日 07:00。隱藏、modal、暫停、其他畫面與 context-lost 仍不推進。
- 舊 food 是 Pixi 圓角方塊。現在是獨立繪製的帶骨肉、紅藍膠囊，工具列與場上統一辨識，保留四段剩餘量、落下高度、腐敗色與既有判定框。
- 清潔工具列顯示清潔對象；場上操作顯示掃把與畚箕。滑動與取消不觸發清除，成功清除仍由原來 app intent 處理，沒有退款或額外物品規則。
- 開發伺服器補上 SVG 的 `image/svg+xml`，修正 CSS 背景圖空白。

## 原作證據與可重跑資料

ROM SHA-256：`8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`。

本輪回查 evidence MCP、既有 clock/feeding reports、private OVL18/ARM9 disassembly 與受控 DeSmuME checkpoint。Bilibili 原連結本輪無法由 web 工具開啟，因此本輪新增的結論以 ROM 指令與本機原作執行為準，不宣稱重新逐幀看完影片。

| 範圍 | 原作依據 | 驗證 |
|---|---|---|
| Idle 門檻與分流 | `02117C4C`、`02117B90..02117C34` | 原指令流程；八種性格無食物活動測試 |
| Cage／性格反應 | `02115B8C`、`02115CD8`；channels `46+slot` / `56+slot` | 480 組原 CPU selector 完整比較，包括額外 RNG 消耗 |
| 隨機走動目標 | `02113AF4`、`02111A0C`；channel `26+slot` | 96 組 Q12 目標與 RNG 呼叫完整比較 |
| Peer 分流 | `02115D34`、`02116600`、`021166FC`、`021169C4` | 64 組原 CPU 反應／跟隨／走動選擇 |
| 反應參數 | `021156B4` | 31 組原 CPU 寫入參數；220 個 adult source rows 的 Main sequence/frame coverage |
| 跳躍與落地翻滾 | state 13 `0211B498`；state 15 `0211B79C` | 112 個 handler frame 的位置與完成條件逐一比較 |
| 清潔圖像身分與節拍 | private `common/i000_item` cells 14/15、sequence 11 | 原作兩張工具姿態，各 18 ticks；runtime 使用獨立向量設計 |
| 自動日末 | `0210D610` → state 10、`0210FAFC` | private observer 12,000 cycles 後進日曆／07:00；既有 calendar command 的 guard 與一次性換日測試 |

可重跑：

```powershell
python scripts/research/check-raising-activity-cpu.py --rom <private-ROM> --ram <private-trace02/latest.ram> --out docs/research/RAISING_ACTIVITY_CPU_CHECK_2026-09-08.json --catalog src/data/championship/catalogs/raising-activity.r1.json
node scripts/build-raising-care-art.mjs
node --test --test-concurrency=1 tests/*.mjs
git diff --check
```

Oracle 只把聲音／特效呼叫做 presentation stub。selector 個案在 reaction dispatcher 邊界取出 reaction ID，另有 31 組實際執行 dispatcher 的參數個案。沒有把 stub 結果描述為完整音效／特效 QA。private ROM、RAM、截圖仍放 parent `_archive/raising-activity-2026-09-08`；runtime 只載入消費到的數值欄位與正式 production art。

## 美術與正常路徑驗收

`scripts/build-raising-care-art.mjs` 不讀取 ROM 或原作圖片；產出 10 個 SVG 到 `assets/production/raising-care-r1`。來源是獨立撰寫的向量圖形，已登錄既有 production index。這次沒有修改角色原圖、動畫 bank 或道具數值。

360 × 640 的正常 Continue 路徑確認：先前 22:00 存檔進入下一日；放肉 `49 → 48`，放膠囊 `8 → 7`；可看見膠囊與已啃食的肉；Clean 顯示掃把／畚箕並移除膠囊，庫存維持 7；清空食物後角色仍移動。截圖與實測收據在 `docs/reports/parity-audit/2026-09-08/activity-*`。沒有透過 browser 修改 hidden app state、注入存檔或直接呼叫 gameplay 方法。

## 仍然部分完成的邊界

本修正完成上述可見缺陷，不等於整個 Raising 系統全部重建。完整 idle 前置的生命／進化／環境／訓練條件、完整情绪特效和音效、睡眠與隔夜 food/growth/lifetime writer，以及原作完整日曆過場仍是 PARTIAL。這次自動日末沿用既有 calendar command，沒有宣稱補完隔夜效果；也沒有憑空生成排泄物來填補清潔圖。實體手機驗收與 shipping acceptance 尚未完成。

目前檢查結果以 [validation receipt](../reports/parity-audit/2026-09-08/activity-care-validation.json) 為準。
