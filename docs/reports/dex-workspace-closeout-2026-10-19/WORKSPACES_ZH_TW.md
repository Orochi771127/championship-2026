# 全部已登錄工作樹盤點與收尾

共 36 個工作樹。逐個讀取 HEAD、分支、tracked/cached 差異、untracked 數量及相對遠端 main 的提交數。此盤點不刪除或覆寫其他工作區。

| 工作區 | 未提交 tracked | untracked | ahead | 本輪處置 |
|---|---:|---:|---:|---|
| `R:\Projects\Championship2026\championship-2026` | 19 | 121676 | 5 | 5 筆地圖提交已有 map-int 對應版本；19 個未提交戰術/補給/地形等改動依整合審查保留，未混入發布 |
| `C:\Users\User\Documents\Codex\2026-10-17\task-2\original-seven-database` | 0 | 0 | 0 | 已在遠端 main；乾淨，無待整合修改，保留可重開工作區 |
| `C:\Users\User\Documents\Codex\2026-10-17\task-5\ma50-ma62-display` | 0 | 0 | 0 | 已在遠端 main；乾淨，無待整合修改，保留可重開工作區 |
| `C:\Users\User\Documents\Codex\2026-10-19\task\cage100-worktree` | 0 | 0 | 0 | 已在遠端 main；乾淨，無待整合修改，保留可重開工作區 |
| `C:\Users\User\Documents\Codex\2026-10-19\task-4\hm02-worktree` | 12 | 10 | 0 | 未完成候選保留；公開選取腳本中途失敗、完整正常流程及美術驗收未完成，不合入 |
| `R:\Projects\Championship2026\.tmp\map-int` | 0 | 11 | 30 | 本輪整合其 30 筆提交；本機審核 gate 保留，未追蹤 HM01 素材仍保留原處 |
| `R:\Projects\Championship2026\capture-raising-recovery-20261013` | 26 | 49 | 0 | 歷史未提交差異保留；基底已在遠端 main，但未證實殘留改動可替換較新實作，不盲目套回 |
| `R:\Projects\Championship2026\championship-2026\.claude\worktrees\battle-corner-stall` | 3 | 1 | 0 | 歷史未提交差異保留；基底已在遠端 main，但未證實殘留改動可替換較新實作，不盲目套回 |
| `R:\Projects\Championship2026\championship-2026\.claude\worktrees\battle-dynamic-fx` | 0 | 2 | 0 | HEAD 已在遠端 main；僅有未追蹤研究/驗證輸出，無可合入產品差異；原檔保留 |
| `R:\Projects\Championship2026\championship-2026\.claude\worktrees\cage-opus-runtime` | 7 | 1 | 0 | 歷史未提交差異保留；基底已在遠端 main，但未證實殘留改動可替換較新實作，不盲目套回 |
| `R:\Projects\Championship2026\championship-2026\.claude\worktrees\elegant-booth-c244e8` | 2 | 1 | 0 | 歷史未提交差異保留；基底已在遠端 main，但未證實殘留改動可替換較新實作，不盲目套回 |
| `R:\Projects\Championship2026\championship-2026\.claude\worktrees\elegant-booth-c244e8-lfbuild` | 2 | 1 | 0 | 歷史未提交差異保留；基底已在遠端 main，但未證實殘留改動可替換較新實作，不盲目套回 |
| `R:\Projects\Championship2026\championship-2026\.claude\worktrees\frosty-morse-77b99e` | 0 | 0 | 0 | 已在遠端 main；乾淨，無待整合修改，保留可重開工作區 |
| `R:\Projects\Championship2026\championship-2026\.claude\worktrees\highlight-burst-playtest` | 0 | 0 | 0 | 已在遠端 main；乾淨，無待整合修改，保留可重開工作區 |
| `R:\Projects\Championship2026\championship-2026\.claude\worktrees\legacy-gates-tutorial` | 0 | 0 | 0 | 已在遠端 main；乾淨，無待整合修改，保留可重開工作區 |
| `R:\Projects\Championship2026\championship-2026\.claude\worktrees\maps-opus` | 5 | 150 | 0 | 歷史未提交差異保留；基底已在遠端 main，但未證實殘留改動可替換較新實作，不盲目套回 |
| `R:\Projects\Championship2026\championship-2026\.claude\worktrees\nervous-hermann-db80dd` | 0 | 0 | 0 | 已在遠端 main；乾淨，無待整合修改，保留可重開工作區 |
| `R:\Projects\Championship2026\championship-2026\.claude\worktrees\nifty-bell-fc81d6` | 0 | 0 | 0 | 已在遠端 main；乾淨，無待整合修改，保留可重開工作區 |
| `R:\Projects\Championship2026\championship-2026\.claude\worktrees\publish-ranch-personality` | 0 | 0 | 0 | 已在遠端 main；乾淨，無待整合修改，保留可重開工作區 |
| `R:\Projects\Championship2026\championship-2026\.claude\worktrees\ranch-personality` | 0 | 0 | 0 | 已在遠端 main；乾淨，無待整合修改，保留可重開工作區 |
| `R:\Projects\Championship2026\championship-2026\.claude\worktrees\shared-vfx-original` | 6 | 11 | 2 | 舊研究/原創VFX接線候選保留；公開版已有較新210格seamfix選取，不能覆回歷史候選或發布私人索引 |
| `R:\Projects\Championship2026\championship-2026\.claude\worktrees\suspicious-cannon-eb652b` | 0 | 0 | 0 | 已在遠端 main；乾淨，無待整合修改，保留可重開工作區 |
| `R:\Projects\Championship2026\championship-2026\.claude\worktrees\ui-expansion-polish` | 0 | 0 | 0 | 已在遠端 main；乾淨，無待整合修改，保留可重開工作區 |
| `R:\Projects\Championship2026\championship-2026\.claude\worktrees\values-trace` | 5 | 0 | 0 | 遊玩時間及地圖完成度候選仍缺本輪接線/保存及正常瀏覽器驗收；保留原處，不以歷史追蹤紀錄視為完成 |
| `R:\Projects\Championship2026\championship-2026-convergence-20260916` | 0 | 0 | 0 | 已在遠端 main；乾淨，無待整合修改，保留可重開工作區 |
| `R:\Projects\Championship2026\championship-2026-m301-worktree` | 2 | 101 | 2 | 舊 m301 局部接線候選保留；目前 main 已有正式角色選取/圖鑑與完整 public catalog，避免覆回舊 loader |
| `R:\Projects\Championship2026\championship-2026-publish-20261010` | 0 | 238 | 0 | HEAD 已在遠端 main；僅有未追蹤研究/驗證輸出，無可合入產品差異；原檔保留 |
| `R:\Projects\Championship2026\championship-2026-room-p1-20261010` | 9 | 216 | 0 | 歷史未提交差異保留；基底已在遠端 main，但未證實殘留改動可替換較新實作，不盲目套回 |
| `R:\Projects\Championship2026\dex-workspace-closeout-20261019` | 0 | 1 | 0 | 本輪隔離整合工作區；角色圖鑑、合併修正、相關驗證與文件 |
| `R:\Projects\Championship2026\egg-native-sizing-20261012` | 3 | 0 | 0 | 歷史未提交差異保留；基底已在遠端 main，但未證實殘留改動可替換較新實作，不盲目套回 |
| `R:\Projects\Championship2026\fixes-candidate-20261014` | 7 | 15222 | 0 | 歷史未提交差異保留；基底已在遠端 main，但未證實殘留改動可替換較新實作，不盲目套回 |
| `R:\Projects\Championship2026\integrated-candidate-20261014` | 36 | 167 | 0 | 歷史未提交差異保留；基底已在遠端 main，但未證實殘留改動可替換較新實作，不盲目套回 |
| `R:\Projects\Championship2026\ns33-opening-20261012` | 0 | 0 | 0 | 已在遠端 main；乾淨，無待整合修改，保留可重開工作區 |
| `R:\Projects\Championship2026\opening-film-58s-20261012` | 3 | 3 | 0 | 歷史未提交差異保留；基底已在遠端 main，但未證實殘留改動可替換較新實作，不盲目套回 |
| `R:\Projects\Championship2026\reconcile-main-20261011\candidate` | 0 | 0 | 0 | 已在遠端 main；乾淨，無待整合修改，保留可重開工作區 |
| `R:\Projects\Championship2026\tutorial-hunt-meat-20261012` | 0 | 0 | 0 | 已在遠端 main；乾淨，無待整合修改，保留可重開工作區 |
