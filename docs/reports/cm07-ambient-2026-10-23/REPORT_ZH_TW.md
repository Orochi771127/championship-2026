# CM07 R 專案工程候選

已完成獨立分支上的 CM07 動態接入與 CPU 驗證；美術精修及實際遊戲畫面驗收未完成，不能合併發布。

本 task 的 writable roots 明確包含 `R:/Projects/Championship2026`，一次新建工作檔／讀回驗證成功。原產品 checkout 是 `feat/database-original-stories-v3-1`、`e15a5d1bfe0d2b2b89d2f69e105ad570e43f5cd7`，含既有 `.serena/project.yml` 修改與大量未追蹤資料，均未動。本候選在獨立 `feat/cm07-ranch-polish-20261023` worktree，基準為官方 GitHub 唯讀工具確認的 main `945a95a0470c8b430f28182e4305a17a68b4ae7e`。

## 實際工程變更

- `cm07Ambient.js` 接既有 ranch render/dispose，限定 CM07 roots、精確煙霧與熔岩材質；停用 CM07 舊 lava shader／smoke updater，避免雙重更新。
- 煙霧 alpha 0.24，維持 depth test、停用 depth write 和實心投影；4 秒小幅升降／縮放／擺動，wrap copies 同相。
- 熔岩僅既有 emissive mask 內 ±6% 明滅；不移動 UV 或貼圖。離屏／covered 停非必要更新，reduced motion 回靜態，dispose 還原 owned state。
- 未動 actor、ground support、shadow coordinate、fixed camera、pan、shared boundary、玩法或存檔。圖鑑 swipe 檔案未改。
- 精確更新兩份 build/public hash 契約，以及新測試的 CI portable 分類；沒有新增美術 payload。

## 驗證與資產

六項新增 CPU 測試通過，涵蓋 alpha／shadow flags、wrap 同相／數值界限、offscreen／covered、reduced motion／重進、dispose／異常輸入、單一接點。既有固定方向、八向 pan、native coordinate、CM07 相鄰邊界數值檢查一併共 29 項通過；同次的 shadow-depth 模組因缺少 Three.js 依賴無法載入，**總測試命令退出 1，不能稱全通過**。數值邊界檢查含 750 組合法相鄰配置、18000 次分類、三個 wrap copies；不等同 browser。

| 指標 | Before | 本工程候選 |
|---|---:|---:|
| GLB bytes | 337740 | 337740 |
| primitives | 32 | 32 |
| triangles | 18036 | 18036 |
| 4 張 1024² RGBA8 含 mip 估算 | 22369616 B | 22369616 B |
| saver 512² 含 mip 估算 | 5592400 B | 5592400 B |
| actual draw calls／GPU memory／frame time | 未量測 | 未量測 |

texture memory 是解碼 RGBA8/mip 算術估計，不含其他角色、shadow map、解碼暫存或 driver overhead，不是 GPU 實測。無手機實機／60 FPS／效能提升結論。

## 美術與來源限制

已實際看原作 CM07、C 的 before 重建與 after 煙霧候選；沒有把重建當獨立 Owner 核稿。前緣高差／熔岩下落／尖柱分布／粗網紋缺口依然存在。本輪沒有為了宣稱完成而移動碰撞、抬高可走地表或任意增添幾何。

私人工作副本在 `R:/Projects/Championship2026/cm07-art-sample-20261023/private/CM07_working.blend`。官方 Blender 5.2 以 `--factory-startup --disable-autoexec`、`use_scripts=False` 成功開啟；只執行本輪撰寫的 inspect script。副本 SHA `b8ab586f12f1f44625668674e1542009d8404077b0cd869c25318c8d12c1230e`，原 refined SHA `6c6343b699c20e91edac2c2a7adabb168322350fff6d52c0834f3ac06db76cfa`。母檔未改；不是找回最終 PBR 母檔，沒有重盤37張。

## 精確阻礙

| 動作／目標 | 狀態與原因 | 處置 |
|---|---|---|
| `git fetch origin main` → 既有 GitHub repo | FAILED；`getaddrinfo() thread failed to start` | 未重試、未改網路、安全或 credentials；官方工具唯讀確認 main |
| 在獨立 R worktree 建立 `node_modules` junction，指向既有 R 產品 dependencies | DENIED；Windows `New-Item: 存取被拒` | `Test-Path` 確認沒有目標，停止該操作；未另換路徑、提權或改 ACL |
| candidate local browser／shadow-depth module | PENDING；獨立 worktree dependencies 不存在 | Chrome 正式工具 inventory 與現行遊戲頁唯讀可用，但不代表候選已執行；未重試舊 Chromium 0xC0000022 路徑 |
| 前緣構成與熔岩紋理精修／actual before-after／物件遮擋／手機／發布 | PENDING | 本提交只作工程候選，保留完整品質門檻；root 協調後續 |

舊 C session 的完整遠端源檔保存拒絕未重試。新 R 工作以本 task 明示 writable roots、成功 write/read probe 及正常 Git worktree 為證據；它沒有取消任何現行安全拒絕。本輪沒有申請安全變更，沒有 force、bypass、merge 或 deployment。
