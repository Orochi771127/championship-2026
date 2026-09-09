# 原作核對後的兩階段實作

> 本階段續作已新增原作 starter、時間／短按孵化、同一個體保存、216 格永久圖鑑，以及 CPU 驗證的照護／成長函式。整體仍為 PARTIAL，不能把純函式驗證算成完整照護玩法。以下原驗收數字為前一輪基準；最新交付與缺口以 [Raising 續作報告](../../../research/RAISING_NATIVE_CONTINUATION_2026-09-08.md) 與 `raising-phase-validation.json` 為準。

Owner 於 2026-09-08 要求依前一輪核對結果開始實作，以兩個階段完成。此授權涵蓋追查證據、修改、整合與驗證；兩階段是工作安排，不是額外批准關卡。

起始 Git root：`R:/Projects/Championship2026/championship-2026`；branch `main`；HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。共享工作樹已有大量修改，保留原狀，不提交、推送或部署。

## 第一階段：原作規則與核心流程

目標：Gate → Hunt → 捕獲返家 → 持久個體 → 照護／養成 → 自有個體參賽。沿用現有 app、wallet、save、clock、router 與 renderer。

| 工作 | 起始狀態 | 完成條件 |
| --- | --- | --- |
| Gate 費用與資格 | 顯示費用但沒有交易；rank 未接 | 原作 caller／條件證據、單一 wallet、拒絕／取消／重入／失敗及保存測試 |
| Hunt 收尾 | 原生捕獲與全消耗品已接；手機成功收取、攜帶個體／AI7仍缺 | 正常觸控捕獲保存及逐缺口驗證 |
| 持久個體 | 只有身份與部分捕獲 vitals；profile 為 null | 保留原作明確寫入欄位、嚴格存檔驗證、個體隔離及正常捕獲接線 |
| 照護與養成 | toolbar 有選擇，無完整照護／成長 writer | 先讀寫鏈／CPU 對照，再接食用、訓練、健康、進化等已查明分支 |
| 自有個體參賽 | 正常入口仍使用預設隊伍 | 個體 profile、ENTRY／編隊／資格、結果回寫及保存；不以原型 profile 代替 |

## 第二階段：內容、美術與整體驗收

| 工作 | 起始狀態 | 完成條件 |
| --- | --- | --- |
| 長期進度 | rank setter、賽程／獎金子系統存在；自然進程未全接 | rank／牌照／空間、賽事種類與輪次、圖鑑、日期事件使用原作 writer |
| 美術整合 | 原作參考包完整度已有核對；新外觀 12/224 草稿、0 預設置換 | 隨已完成事件接視聽；角色整套原動作及正常場景驗收後才置換 |
| 測試與 contract | 2 個舊 regex 測試失敗；production validator 固定 21 而 index 24；文件過期 | 修正實際約束，完整 regression、production 檢查、Pages input、文件同步 |
| 手機／可靠性 | 已有390尺寸入口與保存抽查 | 5 種視窗、完整正常路徑、背景恢復／長時間／WebGL；實體裝置另外記錄實測範圍 |

## 目前交付與驗收

上方兩張表保留開工時的完整目標；下表才是此次實作後的狀態。**第一、第二階段均有交付，但整體仍為 PARTIAL，不能宣稱兩階段全部做完。**

| 階段 | 已完成部分 | 驗證與剩餘邊界 |
| --- | --- | --- |
| 1：Gate 入場 | 17 筆原作 Gate 規則；正常 16 場的 rank／勝場解鎖；不足額拒絕、取消不扣款、成功入場單次扣款 | 158 費用 + 95 解鎖 + 17 初始旗標 CPU 對照；正常初始只有草原可進；rank 自然升級、原作費用豁免取得途徑仍未知 |
| 1：勝場保存 | 正常 mode 0／battleType 0 勝場記錄接到既有 progression、Shop 及 Gate | 第 7／45／46 號勝場解鎖與重複結算／Continue 測試；舊檔不推造以前勝場 |
| 1：捕獲返家 | 正常卡片執行原作 return writer，更新當區 modifier、released history、channel 1 RNG 及返家欄位 | 正常 API 輸入圈選→拉繩→倒地→手掌→卡片→Result→Home→Save→Continue 通過；重複 exit／confirm 不重複寫入；瀏覽器觸控成功捕獲尚未通過 |
| 1：持久個體 | 保存原作已知 108 個 word、5 個窄欄位及原生名稱欄，投影該個體 HP／TP／已知 stats | 228 種 × 3 個 Home 槽位，共 684 次原作 CPU 複製；同種不同數值保持分離；既有無 profile 個體不猜補 |
| 1：活動計數 | 修正原生個體 `00c` 被誤讀成 `00C` 的 undefined／NaN 問題 | 保留 32-bit 欄位；constructor、活動與返家重置測試 |
| 1：仍待實作 | 照護、成長、健康、進化、壽命；ENTRY、編隊資格、自有個體戰後回寫；攜帶個體與 AI7 | 缺 writer／caller 閉合證據，維持 UNKNOWN_REQUIRES_TRACE；不能以既有 battle preset 冒充自有隊伍 |
| 2：測試與美術索引 | 修正 2 個過期 regex；validator 與 builder 對齊現有 24 個 bundle；保留 2 個精確本機研究例外 | 1248 crosswalk／24 bundle／9 runtimeEligible（含2 local-only）／95 ready／0 shippingReady；沒有更改美術核准、預設替換或公開權限 |
| 2：文件與手機 | README、Status、Owner Direction、Architecture、相關 contracts、dependency／blocker 同步；五種 Home 寬度驗收 | 360×800、375×812、390×844、412×915、430×932，均 1 Canvas／無橫向溢出；Hunt 手勢只在390×844驗證 |
| 2：仍待完成 | 自然進度、完整角色／事件美術、全部正常場景驗收、公開 Pages、背景／長時／WebGL 與實體裝置 | 公開 builder 仍有已刪除 tracked input 與被排除的入口依賴；不能以完整單元測試代替部署或手機捕獲驗收 |

最終完整回歸 **1296／1296**、focused **16／16**，無失敗／略過／todo；完整16隻 Home 存檔仍在64 KB內，損壞的 nativeProfile／battleBadges 會被拒絕。公開建置輸入唯讀檢查發現1個已刪除 tracked 檔，以及從入口可達的137個目標被 tracked-only／private 排除規則漏掉；沒有執行建置或替換 dist。

驗證來源：`two-stage-focused.log`、`two-stage-regression.log`、`production-validator-updated.log`、`two-stage-browser/receipt.json`、`two-stage-validation.json`。原作研究：`docs/research/GATE_ADMISSION_AND_INDIVIDUAL_RETURN_2026-09-08.md`。

## 接續的安全實作順序

仍沿用以上兩階段，不另加批准關卡：先由同一原作存檔做一次地面餵食，追 OVL18 食物物件→接近／食用→庫存及個體寫入；再追 ENTRY→隊伍記錄→資格 reader→戰後回寫。持久個體基礎已具備，但禁止直接接預設隊伍或 R2 原型照護數值。之後補自然 rank／license、已證實事件的視聽與完整正常路徑。未完成項目不是等待 Owner 再授權，仍是工程與證據缺口。
