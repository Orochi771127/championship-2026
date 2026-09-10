# 全角色、招式與動作接入 R5

本輪已把所有既有內部角色素材接入對戰的原始影格播放器，並擴充條件入口、招式 VM、特殊技前置與資源回收。**完整原作玩法仍為 PARTIAL：全部素材／動作序列可用，不等於所有情境與招式完整演出都已重建。**

工作位置 `R:\Projects\Championship2026\championship-2026`，branch `main`，HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。保留既有共享修改；未 commit、push、merge、deploy。沿用 DOM／Pixi／bounded Three、session、存檔與場景權責。

## 已完成的範圍

| 項目 | 驗證結果 | 不能延伸的結論 |
|---|---|---|
| 角色身分 | 228 個 species 綁定，224 組素材，包含 216 組角色與 8 組數碼蛋；4 個來源別名共用既定身分 | 不代表牧場自有個體已能全數選入隊伍 |
| 主畫面動作 | 8,656 組原始 Main 序列、13,246 個 cells，全部檢查影格存在、原始 tick、播放模式、迴圈終止與尺寸 | 不是 8,656 組不同招式，也不是所有 Raising／Hunt 情境皆已接通 |
| 尺寸 | 每張圖按原有 12／8／4 倍包裝還原原生比例與 origin；不再只開放三隻角色 | 場地站位與原作世界座標仍未完全一致 |
| 動作條件入口 | 原有 117 選擇器案例、49 個 SetIfChanged 案例之外，新增 232 個受擊／倒下／復起／ending 條件 CPU 案例 | 僅驗證原始通知入口；後續擊退、落地、復起機率和 HP writer 未全部移植 |
| 特殊技前置 | 325 筆招式、190 個 species 使用各自 raw 33 與還原動作時序，接入既有前置 dispatcher | 不等於 325 種發射／命中特效都完成 |
| VM | 49／67 原生函式本體，涵蓋 2,678／3,014 靜態呼叫點；本輪新增 15 個本體 | host 的角色、子特效、輔助 VM 生命週期仍不完整 |
| 移動速度 | 228 species 的 walk/run Q12 值執行原始 ARM9 soft-float helper 取得；現有招式 VM 可沿 owner 邊讀取 | 沒有因此宣稱原作移動路徑或碰撞已完成 |
| 更新頻率 | 同一 Pixi ticker 依原始 `33513982/560190` Hz 累積；30、60、120 Hz 在兩秒均前進 119 個原始對戰幀 | 不另建 timer；不代表實體手機效能驗收 |

## 修正的問題與依據

- `battleSpriteCellBox` 的 NCER cell index 原先少一次 pointer dereference。執行原始 ARM9 `02047E70..02047E78` 驗證後改為 `obj+70 -> pointer -> pointer -> u16`，並以真正 CPU 記憶體圖比對。
- `0211E2C4` 平方根應為 Q12，原有整數平方根會影響演出和腳本計算。14 組實際 CPU 輸入包含極小值與 signed 最大值。
- `0211C194` 的 field0C=2 反向 pointer28 改寫缺漏，補齊後 64 組原始 CPU 指標組合一致。
- pointer1C frame 的第一個參數是 prelude effect actor，與 in-flight action object 不同；現在保留正確欄位與未綁定界線。
- 跨幀續跑的 VM 原先閉包保留初次 host 和診斷集合，現在每次 resume 更新 callback；VM、堆疊和 PC 保留同一份。
- 延遲 GPU 首次繪圖現在使用 session 已記錄的動作起始幀。特殊技還原時亦保留其還原幀，避免把前面特寫時間算入一般攻擊的播放進度。
- 既有 runtime 的 `0211C35C` owner -> inFlight+E4 邊與 `02114320/0211436C` 速度讀取接通。其他物件和座標不以零值假裝已驗證。
- 連續換角 QA 在載入 species 186–191 的批次時曾導致 browser tab crash；此前 186 個 bindings 成功。檢查已安裝 Pixi 原始碼後，修正 decoded bitmap 關閉與 await 場景貼圖卸載。修正後同一頁連續載入全部 228 bindings，沒有重現崩潰。

原始 ROM SHA-256：`8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`。OVL19 SHA-256：`d660e3e0bf243541c356c54dcbd1aec58e8df6c2dfaf4a5854d375a5f2d13715`。

## 全量招式清單與待完成項目

`docs/research/BATTLE_ALL_ACTIONS_COVERAGE_2026-09-07.json` 逐筆列出全部 596 records 的三個 script columns、條件改寫後指標、reachable native dependencies、特效 selector、角色動作綁定及 runtime 狀態。包含一筆零 sentinel，其他 595 筆不能一概視為一般物種攻擊；1–30 沒有 primary script，應由實際 caller 流程解讀，不能拿保留 species 值去要求數碼蛋的攻擊圖。

以下是尚未完成的實作，**沒有把資料可載入標為正常玩法全數 PASS**：

1. 18 個尚未翻譯的 native 本體與其 engine helper。
2. 接近目標、launch 狀態 4–16、完整 return／recovery 時序和實際世界座標。
3. 子角色／特效物件池、四個輔助 VM，以及每招 2D／3D 發射、飛行、命中、移除的資源綁定。
4. 受擊入口之後的擊退／落地／異常狀態、原作復起判定及對應數值寫入。
5. 牧場自有個體的完整隊伍選擇、養成數值及合法進度進入所有場次；目前戰鬥仍使用既定 ROM 預設隊伍的過渡接法。
6. Raising、Hunt、捕獲與進化各自的動作條件；全 Main 動作素材可用沒有自動完成這些獨立 gameplay 流程。

## 驗證

- 全套 serial regression：`docs/research/battle-all-actions-full-regression-2026-09-07.tap`，**1170／1170**，無 skip／todo。最後補入的 prelude 起始幀檢查另外 **4／4**：`battle-all-actions-final-prelude-2026-09-07.tap`。
- 本輪角色／VM focused suite 59／59；對戰回歸 521／521；移動連接 25／25；貼圖生命週期 20／20。較早數字是本輪增補前的有界記錄，最終 full regression 為準。
- 最後合併角色、CPU native、特寫、場景驗證 **29／29**：`docs/research/battle-all-actions-final-focused-2026-09-07.tap`。
- `build-battle-character-geometry.mjs --check`、`audit-battle-action-coverage.mjs --check`、`git diff --check` 通過。
- `CODEX_IN_APP_BROWSER_QA`：390×844 代表體型、四種攻擊族、受擊、倒下、復起、減少動態效果；320×740 大型角色及全 228 bindings 連續載入。全量重跑涵蓋 224 unique entities，無缺圖、一個 canvas、無橫向溢出、console error 空清單。
- 全量影格的逐格 timing／loop／geometry 由程式驗證；browser 全角色巡檢驗證 idle 實際貼圖載入和釋放，並未逐隻播放所有動作。
- QA receipts：`qa/browser-progress-before-crash.json` 保留首次中斷；`qa/browser-all-species-after-fix.json` 記錄修正後完整重跑。畫面參考 `qa/representative-final-390.png`。
- 正常 AI 測試：獨立記憶體 fixture 指定原作 match 1 與既定 ROM 隊伍；進入特殊技特寫後正常推進至全員倒下、對手獲勝與獎金頁，報名後及敗戰結算後均為 9,400 Bits，獎金 0。390×844 無橫向溢出、console error 空清單；`qa/browser-normal-ai-final.json`、`qa/special-final-390.png`、`qa/settlement-final-390.png`。這是指定場次的現有 AI 路徑，非 595 筆招式逐筆正常對局驗收。
- 動作驗證台：`tests/fixtures/championship-all-character-actions.html`。只能視為實際遊戲載入器與播放器的 pose 測試，不是完整 gameplay acceptance。

沒有新增 ROM 圖像至 runtime、重畫素材、修改 production 授權或放行 shipping。所有本輪生成的 runtime 資料都是既有核對素材的數值 timing／geometry 或 ROM 執行所得數值。實體手機 QA、public build 和全遊戲原作符合度仍未完成。
