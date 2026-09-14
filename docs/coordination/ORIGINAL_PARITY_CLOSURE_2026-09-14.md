# 原作還原缺口續作

Owner 於 2026-09-14 明確要求補齊原作還原缺口。基線 `8f270dc63f5735f4b67218c8047f5d020b6d8b7f`，開始時工作樹乾淨。

依序完成與驗證，每批完成後繼續下一批。不得以畫面替換、單元測試或受控場景代替完整原作／實機驗收。

| 批次 | 範圍 | 目前狀態 |
| --- | --- | --- |
| 1 | 六個原作對戰類別與現有四面入口、玩家隊伍、輪次、結算、存檔 | 六種模式已接線：冠軍大會、稱號賽、自由對戰、練習、密碼、通訊（網頁邀請碼傳輸，非原作無線）。完整 `npm test` 1548/1548。實機未驗 |
| 2 | 全籠子原生地形、貼圖原點、角色落腳點與循環搬移 | 地面與籠子圖對齊已閉合；靠邊捲動、循環回等待區 9/13 已完成。前方圍欄／牆遮擋：`UNKNOWN_REQUIRES_TRACE` |
| 3 | 捕獲入庫、回血、勝利／轉場的原作資源與播放呼叫 | 回血星芒已還原。捕獲光 `PARTIAL`（光已證實，飛入工具列未追查，保留現有呈現）。勝利／獎章光／轉場：未追查 |
| 4 | 依現有 contract 與 blocker ledger 核對其他完整原作流程 | 未開始 |
| 5 | 全流程回歸、手機直向及橫置直向框；實體 iPhone Safari | 完整回歸通過；本機瀏覽器因自動化窗隱藏、ticker 不動，搬運手勢未驅動；實體裝置尚無驗收證據 |

## 本批原作追查

- 先查 Championship Evidence MCP：`BATTLE_REVERSE_SPEC_v1.md`，既有六種模式與 OVL10 local-selection 對照；不足部分繼續讀經 SHA-256 驗證 ROM 的原始指令。
- 原作文字庫 `ui/txt/txt_list_txt.dat` 的 0x29B–0x2A0 依序說明：冠軍大會、稱號賽、自由對戰、通訊、密碼、育成個體分成兩隊練習。OVL10 `0210F88C..0210F898` 使用 `sessionMode + 0x29B` 取文字，形成模式值到名稱的直接對應。
- OVL10 `02111318..021113E0` 的六個本地選擇值依序寫入 session +0xC98 `[1,0,4,3,2,5]`。不能把畫面順序當模式值。
- 冠軍大會進场 OVL10 `021110FC..02111130` 設預設三名限制並固定場地 10。自由對戰 `02111138..021111AC` 另從場地 `[0,1,2,3,4,5,7]` 抽選。
- 實作檢出：冠軍大會目前 main 入口未傳玩家個體、未傳場地 10、畫面 render 與實際進場各抽一次對手，未交付輪間回血的 event/cursor/totalRounds。

## 批次 2 結果（2026-09-14，Claude Code 接手）

- 地面與籠子圖：`tests/championship-cage-ground-art-alignment-cases.mjs` 以實際 `createNativeRaisingGround` 與 `createRaisingCageArtPlan` 組合，比對 36 種籠子加等待區、上下兩排、14/16/18/20 格牧場；6,459 個可行走格沒有一格落在透明圖上。
- 大型角色頂到上方：Owner 照片為公開網站舊版；本機版地面上方留 64 原生像素，390×844 與完整 QA 存檔實際看過。
- 前方圍欄／牆遮擋：原作 ranch compositor 回放只涵蓋地面層，物件層未追查；現有籠子圖為整張，不自行做遮擋。

## 批次 3 結果（2026-09-14～15）

- 回血星芒：OVL18 `02110FB0..021110D4`，籠 15/18/28（ミニほけんしつ、おんせん、ほけんしつ），`common/e001_ikusei` sequence 32，播 63 tick、休 120 tick、被拿起即停；不讀 HP。原本「HP 上升時 420 ms 向量光」已移除。證據與回放：`docs/research/RAISING_RECOVERY_STARS_2026-09-14.md`、`RAISING_RECOVERY_STARS_CPU_2026-09-14.json`；測試含 901 次原作更新與實際 app 時鐘。
- 捕獲光：OVL0 state 25 在角色位置播 `common/e002_hunt` sequence 29（cells 132–135，約 20 tick），不是 digicach。飛入工具列的物件（vtable `0x02129E88`，`+0x3C4`）未追查，所以保留現有呈現。`docs/research/HUNT_CAPTURE_LIGHT_BINDING_2026-09-14.md`。
- 勝利／獎章光／轉場：本輪未追查。

## 發布前提醒

`docs/contracts/championship/WEB_BUILD_INPUTS.v1.json` 仍列已刪除的 `recoveryCageVfx.js`，也未含新的 `nativeRaisingRecoveryStars.js`、`nativeLinkBattle.js`、`nativePasswordBattle.js`、`nativeFreeBattle.js`。push 到 main 會觸發 Pages；在 Owner 核准更新發布清單前，部署驗證會失敗、網站維持原版。

這份工作紀錄不是完成證明；詳細 CPU 回放與測試收據在各批補入。
