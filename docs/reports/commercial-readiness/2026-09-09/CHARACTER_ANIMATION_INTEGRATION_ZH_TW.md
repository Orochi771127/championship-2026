# 狩獵、牧場、對戰角色動畫整合

本次工作基準：`main`，`952d05c312e43745114f178a70b6c6c6c857f068`。

## 實際修正

1. 狩獵場已移除 M003 單一試驗角色限制。所有已登錄角色現在透過明確的 `presentation: hunt` 使用自己的原作 Main 序列與影格，直接讀取正常 Hunt owner 的 `nativeAnimation`。
2. 狩獵、牧場改用每張 cell 已驗證的原點與放大倍率。先前狩獵固定使用 0.18、牧場沿用第一張 cell 的倍率，會使部分姿勢的比例或位置錯誤。現沿用對戰已驗證的全量幾何資料，核對 manifest 檔案雜湊後才使用；不把基準幾何套到不同的換裝圖片。
3. 保留原作空白 cell；不替原作的空白過場補圖。牧場進化目標的影格也沿用相同原點／倍率處理。
4. 更新角色登錄狀態與重建腳本，避免診斷繼續把正常角色動畫描述為「全部靜態第一張」。

對戰原有的 native actor／VM 與全量 Main 動作入口保留，這次驗證它與另外兩個場景都能呈現完整 Main 影格。沒有增加第二套時鐘、路由、存檔、玩法狀態或隨機數。

## 使用 Owner 指定的素材

已比對 `R:/Projects/Championship2026/YDIJ_PRIVATE_ROM_ART_PACK/02_CHARACTERS/use-ready-pixi-hd4x-224` 與遊戲既有 `assets/production/internal-faithful-baseline/characters-v1`：

| 項目 | 結果 |
| --- | --- |
| 角色／蛋資源 | 224／224 筆都有對應 |
| 圖集圖片 | 503／503 張內容一致 |
| 現有 manifest 檔案雜湊 | 全部一致，無缺檔 |
| Main 序列／影格引用 | 8,656／14,283 |
| Sub 序列／影格引用 | 2,824／3,992，完整保留 |

這次不需要重複複製圖片。三個 gameplay 場景目前使用 Main；Sub 的特定原作 UI 使用情境，不因本次要求就被任意映射到 Main 動作。

## 驗證與範圍

新增測試經過實際 loader、roster 與各場景使用的 presenter，對 224 筆資源逐一投影每個 Main 序列的每個影格：

- 狩獵：14,283／14,283。
- 牧場：14,283／14,283。
- 對戰：14,283／14,283。
- 狩獵／牧場所有非空白影格的換算後邊界，逐項對上已驗證的原生幾何；空白影格維持不可見。
- 播放投影不改動傳入的 gameplay frame。

上述 42,849 筆是受控全量綁定檢查：圖片由帶 key 的測試 texture 代表，沒有把它冒充成 42,849 次 GPU 或原作情境驗收。

實際瀏覽器另外使用 `tests/fixtures/championship-character-scenes.html` 建立受控成年角色、日期與資金存檔，然後從正式 `championship.html` 登入／繼續遊戲操作：

- 牧場：確認角色活動、位置變化與換圖後比例；430px 產品寬度的桌面視窗。
- 狩獵：正常工具列 → 戴納草原 → 裝備頁 → 開始狩獵 → 返回牧場；確認非 M003 野生角色出現不同姿勢與位置。
- 對戰：390×844 viewport，選擇自有角色參加存取突擊兵賽事；對戰執行至對手獲勝。不是全招式逐招錄影驗收。
- 讀取瀏覽器 warning/error 紀錄兩次，均為空；沒有把無錯誤視為完整原作還原。

畫面紀錄存於本機 `R:/Projects/Championship2026/_archive/character-animation-2026-09-09/integration/`。測試來源為可辨識的受控存檔；未把它說成全新遊戲自然養成過程。

測試：完整 Node 回歸 1,398／1,398；最後相關測試 62／62；最後牧場倍率修正後再驗證 viewport／全量角色 10／10。建置技術相依檢查通過，268 個模組無缺漏；`git diff --check` 通過。

## 仍需追蹤的項目

**所有 Main 圖片與序列能被三個場景呈現已驗證；所有原作情境的動作觸發時機尚未全數驗證。** 例如完整持握／拋擲反應、每種訓練與治療條件、各個戰鬥技能及全部狩獵工具組合，需要各自的正常操作與原作 trace，不能只把 40 個序列輪播一次就宣告完成。

下一個安全步驟是沿現有 gameplay owner 補齊上述逐情境對照，對有證據的缺漏繼續修正。缺少證據的動作語意維持 `UNKNOWN_REQUIRES_TRACE`。本次沒有把整個第一階段或全遊戲原作 parity 標記為完成。

授權驗證仍在最後公開發布關卡；本次屬本機研究版整合，沒有公開部署。

## 證據

- `docs/research/CHARACTER_ANIMATION_USAGE_ROM_2026-09-09.md`：直接 ROM 資源與飼育場原作執行紀錄。
- `docs/research/HUNT_CHARACTER_ANIMATION_TRACE_2026-09-06.json`、`CHARACTER_ANIMATION_CPU_CHECK_2026-09-06.json`：原作狩獵請求／綁縛重映射與動畫播放器。
- `docs/research/BATTLE_CHARACTER_REQUESTS_CPU_2026-09-07.json`：對戰通知入口對照。
- `docs/art/production/tooling-pilot-r1/scale-review/character-evidence.md`：全量 source cell 原點、倍率、空白與像素對照。
- `tests/championship-battle-character-animation-cases.mjs`：13,246 個 Main cell 幾何、224 個實體及檔案雜湊檢查。
- `tests/championship-licensed-character-roster-cases.mjs`：本次 42,849 筆三場景綁定及原點／倍率檢查。
