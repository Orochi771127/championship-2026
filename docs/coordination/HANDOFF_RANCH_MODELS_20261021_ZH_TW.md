# 育成籠子交接：旋轉已取消，後續精修固定方向模型

更新：2026-10-21。**本文件及新版 NEXT_TASK 指令取代先前「修復六方向旋轉」的任務要求。** Owner 已取消旋轉，隨後授權將已完成的育成功能獨立提交、整合 main 並 push。未完成的模型候選不包含在此發布批次。

## 現在的工作狀態

- 實作 worktree：`R:\Projects\Championship2026\element-reaction-prototype-20261021`。
- 起點 HEAD：`82a7113735d2f46c5f5760bca055af0cfbc06bd9`，detached HEAD；接手重新驗證，勿依賴歷史狀態。
- 正式 repo：`R:\Projects\Championship2026\championship-2026`。兩者狀態與未提交檔案要分開看。
- 同 worktree 還有前段元素反應、數據競技場、接路、探索產出、縮放等修改，不能整包 stage、reset 或 clean。
- 發布整合工作區：`R:\Projects\Championship2026\ranch-fixed-release-20261021`，分支 `codex/ranch-fixed-release-20261021`，以最新遠端 `300841a2`（已發布地圖精修）為基底。
- 原混合工作區保留；正式版不帶入較早戰鬥修改、Blender 候選或旋轉素材。發布結果與精確 commit／CI／Pages 證據記錄於外部證據根目錄的 `release-receipt.json`；不得以本文件的舊 HEAD 推定線上版本。
- 新美術任務從最新 main 建隔離工作區；舊混合 worktree 只作未提交歷史／模型工具參考，避免覆蓋 main 的地圖發布。

## 旋轉取消的實際處理

- 移除設施配置左右轉按鈕、方向／預覽、app intent 與 runtime rotation API。
- 地塊占格、地面行走與配置縮圖回到固定方向；保留取回、放置、確認、返回。
- 現行藝術選擇保留綠色 CM02／CM30 運動公園，保留先前接路、前景、縮放與探索工作。
- runtime 不再載入旋轉圖。三批被退回的 rotation 素材及相關實驗程式已移出產品 worktree，封存在外部 archived 目錄，未銷毀原始 .blend。
- 舊測試存檔的 rotation 只作輸入相容：先驗證原配置，然後移除方向。可原位放回則原位，衝突則選最近合法已解鎖空位，仍放不下就回待放庫存；其他未旋轉設施不挪動、不新增土地或金錢。
- 原有持有數量保留。受影響搭檔重新選擇安全出生點；回庫存的設施將搭檔與食物／廢棄物改置等待室，保留物品內容，避免失去持有設施或物品。新存檔不再寫 rotation。
- `productRanchGrid.js` 留下的 legacyRotationCells 僅驗證舊存檔，不是可以重新啟用的遊戲旋轉功能。

## 本輪驗證與限制

證據根目錄：`C:\Users\User\Documents\Codex\2026-10-21\ranch-connections\rotation-cancelled-20261021`

- `focused-tests.txt`：56/56，含新固定方向／舊存檔相容、重疊與無空間、庫存、食物、現有縮放／接邊等回歸。
- `fixed-audit/all-cages.json`：35 個可配置定義的固定方向；528 合法相鄰配置、616 開放邊、300 保留封閉邊；每個定義有接通範例，0 failures。這不表示任意兩圖、任意邊都能接。
- `fixed-audit/native-walking.json`：105/105（三種移速×35種），無穿過阻擋。
- `fixed-browser/fixed-browser.json`：正常 DOM 操作在 390×844、844×390、1280×720 完成進配置、取回、放置、確認、返回；存檔退出再繼續。0 page errors、0 failed assets、0 rotation requests；無轉向控制、無頁面橫向溢出。
- `zoom-browser/zoom-browser.json`：雙指、滾輪、70%／100%、搭檔選取及抓取返回實測通過；保留原功能。
- 瀏覽器為隔離的 loopback 8741，非實體手機；不得操作 Owner 的 8732 origin 或存檔。
- 以上驗證配置與行走功能，不代表目前籠子的商業美術品質已達標。挪動設備或更新模型後須重新測相關 ground／navigation／occlusion。

## 與最新 main 整合

保留 `300841a2` 新公開地圖、前景與動態載入。合併 `main.js` 時保留公開版的 literal imports 與 walkability，並加入接路判定。相同素材組只掛一次動態層，避免重複特效。公開版亦更新精確輸入 hash 與 CI 測試範圍。源檔與候選模型未公開。

合併後重新執行 `release-audit/`：35 種、528 組相鄰配置、616 開放邊、300 封閉邊與 105/105 行走檢查通過。`release-browser-final/fixed-browser.json` 使用正式打包檔案，在隔離瀏覽器驗證三尺寸的雙指／滾輪 70%／100% 切換、配置、返回、探索手帳領取與存檔重載；沒有改寫遊戲程式或注入測試控制器。這是本機打包驗證，實際網站結果另記 `release-receipt.json`。新增手帳及縮放文字接入既有五語系，翻譯覆蓋檢查通過，尚未母語編輯審校。

本機發布檢查：`release-ci-pass.txt` 的 2,745/2,745 測試通過；`build:playtest`、`validate:playtest` 和 `assert-public-payload.mjs` 通過，打包檔案共 8,144 個。後續遠端 CI／Pages 與線上讀回仍以 `release-receipt.json` 的精確 commit 為準。

## 下一個任務的原檔與參考

外部證據根目錄：`C:\Users\User\Documents\Codex\2026-10-21\ranch-connections`。

| 用途 | 路徑／說明 |
|---|---|
| 35 種原模型來源清單 | `rotation-build-v3/jobs.json`，僅取 source、sourceHash、fieldId 查原檔；勿執行其中的 rotation jobs |
| 常見原創 master | 正式 repo `docs/art/production/original-character-cage-r1/cage-base3d-v1/opm-opus-r5/seam-v3/fields/<field>/master.blend`；不是每張都同一來源，以清單及當前 manifest 為準 |
| 綠色運動公園 | `R:\Projects\Championship2026\map-polish-20261018\cage\park\cm02-park.blend`、`cm30-park.blend` |
| 全籠子候選 | 外部 `living-cages/masters/<field>/refined.blend`，35 個資料夾；來源在 `living-cages/refined-masters.json`；第一輪候選，未美術驗收 |
| 新健身房第一稿 | `living-cages/masters` 的 CM05／CM34 master；橘黑地板紅黑器材，地面細節及阻擋對齊未完成；CM05 原生占 4 格 |
| dot 參考入口 | `R:\Projects\Championship2026\map-reference-handoff-20261019-dot\START_HERE_ZH_TW.md` |
| 每主題設計方向 | 同目錄 `PER_THEME_DESIGN_DIRECTIONS_ZH_TW.md`，讀 cage 部分 |
| 運動公園參考 | 同目錄 `sports/cm02_cm30_connected_sportspark_reference_v1.png` |
| Owner 健身房參考 | `C:\Users\User\.codex\codex-remote-attachments\01a15858-1880-7c52-8d22-3583cfadc802\C9778FD2-F2E7-4882-A670-4A510D291F2C\1-照片-1.jpg` |

Blender：`C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`；現有 Blender Lab MCP add-on 1.0.3。先檢查可用狀態，不要關閉使用者 GUI 工作。前一輪專用 background MCP 9877 已停止，本輪沒有重新啟動或渲染模型。

## 美術接手時應知道的問題

- 先前旋轉把部分物件逐頂點扭曲；一些舊模型本身又使用配合固定相機的非正交基底。這兩者不同，不能全批套矩陣。
- CM30 新球場原本為直角；CM26 房屋、CM27 擂台候選有校正紀錄，但不可當成整張完成；擂台候選曾出格。
- 樹冠仍有球狀感、水面有規律白紋、場景空曠；機械手臂真實關節動畫未完成；新 motion mask 尚未整合。
- 商業品質需要逐場景的造型、材質、光影、主次、合理擺設及真實遊戲可讀性。不能只加噪點、灑裝飾或跑一批生成。
- 移動設備必須同步核對路線、clearance、阻擋和前景遮擋。原生占格與來源尺寸以現有資料／`cage-authoring-geometry.mjs --hex-footprints` 為準；不要重造一套幾何。
- 來源原檔保留，候選另存。ROM reference 僅研究，不可複製進產品。

## 歷史資料與封存

- 舊停工交接全文：外部 `handoff-20261021/HANDOFF_RANCH_MODELS_20261021_ZH_TW.md`，以及本輪 `rotation-cancelled-20261021/before/`。
- 舊文件中的「六方向修復」、「runtime 仍指向 v3」是取消前狀態，已失效；不要照舊任務指令恢復旋轉。
- 被退回素材與相關 scripts／src／tests：`rotation-cancelled-20261021/archived/`，保留原相對目錄。包含 rotation renderer、living renderer（依賴它）、repair scripts、math 與被取代測試；僅歷史研究，不是合格製作管線。
- 四個舊修模候選、render v4/v5 未完成點與源檔 hash 都留在歷史資料。下一任務只處理固定方向，不續跑六方向 jobs。

## 接手指令

請使用同目錄 `NEXT_TASK_RANCH_MODELS_PROMPT_20261021_ZH_TW.md`。範圍是固定方向模型、光影材質、設計豐富度、必要動態與本機資料對齊；先代表場景，再逐批精修全套。先不提交或部署。
