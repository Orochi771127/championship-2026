# Hunt 核心玩法與全道具：實作、證據及未完成範圍

日期：2026-09-08。正式 repo `R:\Projects\Championship2026\championship-2026`，branch `main`，HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。修改保留在共享工作樹；沒有 commit、push、merge 或 deploy。

Owner 要求在最多兩階段內完成核心捕捉和每個道具。不新增第三階段。**正常捕獲保存已接通，46／46 裝備已接正常入口；四種散彈依 Owner 核准，以普通射擊物種反應初始化原作未初始化的 byte。完整手機觸控成功捕獲、原作逐道具視聽及實體手機驗收尚未完成，整套仍不能稱全部完成。**

## 第一階段：正常捕獲到返家保存

`championshipStandaloneApp.beginHunt` 的正常生成接到既有 `huntRuntime`，由 `nativeHuntFieldControls` 協調角色、工具與原生更新。沿用 app RNG、Shop inventory、Raising collection 及現有 save；没有新增 router/store/save/ticker。正常入口不注入 HP0、束縛狀態、動畫結束或成功結果。

已接入：原生圈線取樣與壽命、touch-up 閉合、空間查詢、束縛、反抗／逃脫、拉繩三段距離、耐久恢復／斷裂、HP0、AI10 落地、AI11 手掌條件、G 容量拒絕、手掌收取／隱藏／入卡、Result、既有 Home 交易及 Save/Continue。

`tests/championship-hunt-normal-capture-save-cases.mjs` 使用正常 New Game／Gate／裝備／生成和 pointer API，沒有覆寫角色或結果。從圈線、拉繩到一隻角色入卡返家，再確認重複 Result 不會增加第二份角色，Save/Continue 保持捕獲角色。

此為完整應用 API 整合通過。**不能等同於瀏覽器／實體手機的完整觸控捕獲驗收。** 原作受控觸控重播和數值證據仍見 [原作捕獲確認](HUNT_CAPTURE_CONFIRMATION_2026-09-08.md)。

## 第二階段：每個道具、插件及狩獵期限

完整清單：[79 品項 CSV](../../reports/hunt-core-two-stage-2026-09-08/item-coverage.csv)、[含驗收邊界的 JSON](../../reports/hunt-core-two-stage-2026-09-08/item-coverage.json)。產生器：`scripts/research/report-hunt-core-coverage.mjs`。可用與完整原作驗收是不同欄位。

| 家族 | 數量 | 目前接線 |
|---|---:|---|
| Rope | 12 | 參數與正常圈繩／拉力／耐久控制器；所有品項可選 |
| Shot | 12 | 全部可用；4 種散彈使用 Owner 核准的反應值修正，其餘原生流程保留 |
| Wire | 6 | 阻擋、磁力、電擊；拖線、裁切、拒絕短線、放開消耗及消失 |
| 誘引道具 | 8 | 4 肉餌、2 移動玩具、2 夜間誘引燈 |
| 傷害／捕捉陷阱 | 8 | 4 炸彈、2 地雷、2 捕捉陷阱 |
| Analyzer | 9 | 裝備後開啟指定欄位；最大 HP、個體性格、原生種族／屬性／世代／容量 |
| Checker | 5 | 對應四類道具數量；全數量版合併顯示 |
| Radar | 15 | 原生世代、屬性、種族遮罩篩選；手機雷達由 DOM 顯示 |
| Memory Checker | 1 | 只控制已用 G／最大 G 是否顯示 |
| Memory Card | 3 | 持有 32／64／96 G 的原作容量查詢；保持既有入卡拒絕條件 |

共 46 裝備、30 插件、3 記憶卡；46 裝備正常可選，全部 34 種消耗品有正常應用整合測試。捕捉陷阱的原生 controller kind 是 9，因此屬 DAMAGE_TRAP；早期 10 誘引／6 傷害的分類已修正為 8／8。

`nativeHuntConsumables`、`nativeHuntLures`、`nativeHuntWire`、`nativeHuntHazards` 控制有限物件池與消耗，`nativeWildActor` 處理角色狀態與原生動畫。肉餌的食用消耗綁定原生動畫第 1 幀及 latch；誘導玩具先預覽再發射；夜間燈只有夜晚發出吸引事件；炸彈／地雷使用原作共享 controller counter。異常、恢復及擊退數值讀既有 functional catalogs，不由圖形判定。

測試用自訂起始 inventory 原先只餵到 Hunt read model，Shop 仍使用預設起始量；已修正為用同一個起始 inventory 建立 Shop canonical quantities。正常購買、使用和保存持續以 Shop 為權威。這使自訂 owned-inventory 測試實際經過正常扣庫存，而非另一個 consume stub。

插件 masks 來自 OVL0 `02125ED8` 的四筆 inventory+A8C records。五筆裝備另外位於 inventory+A00。分析器 HUD `02126FD0` 的 HP 是個體+58 最大值；畫面容量是 species+1E，入卡成本仍為 species+1D。Radar predicate `02127884` 已與原始 ARM 比較。沒有裝備插件時，身份、數量、雷達與容量不洩漏到 HUD。

## 狩獵時計與結束

原始 ROM SHA-256：`8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`。

`scripts/research/trace-hunt-clock.py` 重新執行未修改的 `bound_after_release.dst`，240 幀不輸入、不寫 RAM。記錄到 session mode 6、divisor 400、每 25 幀增加 1 world minute，餘數保持 105。此節不把教學 mode 2 當作正常狩獵。

OVL0 `02116CCC..02116D28` 寫 session+18：`min(目前分鐘 + 8*60, 22*60)`。`02117150..02117184` 比較到期、stop、轉 state 5。`check-hunt-controls-cpu.py` 執行原始期限計算，288 個入場分鐘輸入一致。

正常 Hunt 使用既有 `championshipClockDriver`，每個 nominal native frame 餵 16 elapsed units、divisor 400；Raising 的 divisor 200 保留。入場／離場清掉次分鐘餘數。到期經既有 `exitHunt` 進入 Result 或空手返家；若收取動畫尚未完成，既有收取 guard 阻止提前提交，field tick 在完成後重查到期。

HUD 顯示剩餘遊戲小時／分鐘。工具選擇也會 publish screen channel，因此 driver 現在只在真正換 screen 時丟棄取樣，避免頻繁使用工具使時計變慢。背景／context lost 沿用既有暫停保護。

## 四種散彈的確定問題

`scripts/research/trace-hunt-spread-input.py` 只在隔離原作程序修改裝備 Shot index 8 與其數量，未寫 HP、AI、RNG、stack 或結果。18 組實際觸控產生 62 個命中事件。[原始語意紀錄](../../reports/hunt-core-two-stage-2026-09-08/spread-original-input.json)。

原生 `021224C4..02122704` 有最多 7 發、第一發中心、後續各軸偏移 −16 至 +15 像素、B2/B3 取亂數、共享 10 主物件槽的流程。它在 `021225D8/021225EC` 只寫事件前兩個 byte；接收者會讀第三個 byte。該 byte 本次實測為 23 或 51，會受到較早 stack push 留下的攝影機值或動畫物件位址影響。

- 23 的鏈：`02066724` 讀 camera+8C，經 `0206676C → 02047A08 → 0202FA48 → 0202E188` 的保存暫存器落到相同 stack。
- 51 的鏈：較晚 `0202F81C` push 留下動畫物件位址 `0x02338B34`；在相同攝影機座標下仍可出現另一個值。

因此只以 cameraY 或固定 23／51 補值都不忠於 ROM。`nativeHuntScatterPoints` 保留已知七發幾何與 RNG 順序。修正前正常 host 沒有 response provider，因此四種散彈不可選；此為歷史狀態，已由下列 Owner 核准修正取代。

Owner 在助理提出限定修正後回覆 **「好的請開始開工」**，已記錄於 [Owner Direction](../coordination/OWNER_DIRECTION.md)。`nativeHuntFieldControls` 的正常 host 現在提供明確的 `scatterResponse`，與普通 Shot 共用 `nativeShotSpeciesResponse`：`max(1, species.effectiveness[1])`。這是 **OWNER_APPROVED_ADAPTATION**，不把此 byte 的新值標成 ROM_VERIFIED。

修正只改 response 的來源：七發上限、中心第一發、−16..+15 偏移、B2/B3 取樣順序（含末發後的兩次）、十個主物件槽、60 次更新冷卻、一輪扣一份、普通／麻痺原作反應流程均保留。未提供明確 policy 的隔離 host 仍拒絕散彈，避免默默回退到任意常數。原有 62 筆 stack 事件證據保留。

正常應用測試擴至全部 34 種消耗品：只設定起始擁有數量，經正常 New Game → Gate → 選裝 → 場地生成 → pointer 射擊，四種散彈均產生七個主物件、進入 AI9 受擊、只消耗一份並可正常離場。另有四種散彈 × 228 物種資料的事件比較、普通／麻痺 payload 比較、容量幾何邊界、冷卻／空彈及八次更新主物件清理測試。這些不代表完整瀏覽器觸控或原作視聽驗收。

## 驗收與剩餘範圍

- 核准修正後回歸：[scatter-approved-regression.txt](../../reports/hunt-core-two-stage-2026-09-08/scatter-approved-regression.txt)，**206／206 通過**，涵蓋全消耗品、捕獲返家 Save/Continue、容量／重複提交保護、插件／時計／Shop 與既有 VS2／VS3 邊界。`git diff --check` 通過。
- 修正前歷史：[final-regression.txt](../../reports/hunt-core-two-stage-2026-09-08/final-regression.txt)，204／204 通過；當時散彈 provider 僅在隔離 fixture，已由上述正式入口驗證取代。
- [核心／道具／插件／時計／Shop 回歸](../../reports/hunt-core-two-stage-2026-09-08/regression.txt)：162 個測試通過。
- [Capture Result、容量、Save 與既有 VS2 seam 邊界回歸](../../reports/hunt-core-two-stage-2026-09-08/boundary-regression.txt)：41 個測試通過。
- CPU 證據：2736 Rope rate、540 Shot reaction、400 Wire intersections、240 explosion motion、3420 Radar comparisons、288 deadline calculations。這些是受控輸入對照，不冒稱每項正常原作遊玩。
- 全部 34 種消耗品的整合測試只控制起始擁有數量，角色、生成、RNG、輸入、AI、消耗及離場走正式 app。沒有將角色放到指定狀態。
- 瀏覽器 390×844：正常 New Game → Hunt → 裝備 → 場地、單指拖移、放餌、圈線畫面、倒數、自動返家均已操作；無插件時沒有額外數量／雷達／容量顯示；原有多餘 disabled 工具列已隱藏。肉餌 10→9，返家 Save→reload→Continue→Loadout 保持 9。
- **未完成**：瀏覽器完整觸控成功捕獲返家、實體手機與全品項視覺／音效 QA。圈線自動化操作有目標離開的嘗試，不算成功捕獲。
- **部分完成**：工具圖形目前有程式繪製的功能性暫時圖形。Shot 次級特效池／所有原作圖像及音效尚未全部還原。Radar 篩選已驗證；手機圖上投影不宣稱原生 renderer 座標完全一致。野生之間完整 AI7 戰鬥不在本輪已驗證核心捕捉鏈。
- 本輪沒有把 private ROM/decoded 圖片新增為 shipping runtime 素材，沒有提升 rights、human QA 或 shipping 狀態。

原作數值及每項未完成位置已集中在此。散彈決定及正常入口修正已完成；下一個安全步驟是同一第二階段內補齊視聽和正常觸控驗收，不重做已通過的生成、交易與數值移植。
