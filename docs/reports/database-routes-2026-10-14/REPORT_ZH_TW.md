# 圖鑑一階候選路線與缺圖盤點 — 2026-10-14

接續已發布 `636e9efa680566380858f37193bef2972c04ee67`，在既有隔離 worktree／`fix/capture-raising-recovery-20261013` 完成小批次。開工無他人未提交修改；Owner checkout main `94207e6ee4927bb5357646a4319d90e4d7e3ceea` 保持原位。發布採正常非強制 `HEAD:main`，最後以該提交的 CI／Pages 及公開 bytes 核對；精確結果交付在任務發布回執。

## 結果與邊界

已登錄普通種的詳情顯示「來源 → 下一階段候選」，最多五個目標。沿用原有477條候選順序、固定碼、舊分支 offset；完成歷史與登錄分開。target20已登錄而旗標為 `[]`／`[5]`，仍不能揭露 source8→20(offset0)；正常QA使用 `[5]` 時 source9→26(offset5) 才揭露。未確認路線使用黑色剪影／`????` 和「尚無完成紀錄」，不宣稱從未進化；未知來源及蛋沒有路線。無候選有空狀態。已揭露目標走既有圖鑑選取／篩選與返回焦點。

圖像只取現有接受清單的 original HUD，214個可用普通種逐一驗證對應像素檔 SHA；96→226、97→227既有 alias 保留。每次僅取當前來源加最多五張目標；換選、關閉、離開會取消 metadata 請求並解除舊圖事件／src，遲到回呼不能更新新詳情。沒有改 resolver、writer、候選順序、圖鑑登錄、編號、故事、價格、經濟、RNG、save、Battle、引擎或 ticker，也沒有新增 runtime 美術。

**仍缺圖：species222（UL02天穹帝龍）、species211（UL33黃銅王猿）**。已登錄詳情是「圖像暫缺」，和未知種遮蔽不同。Owner 最新指定美術由dot整批整理驗收、存私人Library，整批完成後再決定Codex是否下載，不逐隻接入（Sentinel_a6f7084b3ed48191af0bdb89f92b1f93／Sentinel_29402c895b3c81919d2d152ff4f2a9f0）。先前R1／R3及舊著色候選暫停，R2已被取代，本批未下載／整合／發布任何候選。這份結果只關閉路線功能，不能宣稱圖鑑全部美術完成；本批交付後不啟下一批美術或額外本機工作。

## 證據與驗證

契約：[DATABASE_EVOLUTION_ROUTES_2026-10-14](../../contracts/championship/DATABASE_EVOLUTION_ROUTES_2026-10-14.md)。來源使用現有 lifecycle catalog、原提交 writer、生命週期研究／契約、Database runtime／固定碼、原公開接受清單／HUD manifests；沒有新商業參考研究或ROM追查。

- 局部29/29：477條 source／branch／target identity、179組／178非空、最多五條、同目標不同來源的歷史、異常旗標、空組／最終階段／蛋／未知來源、214圖SHA與alias、拒絕research／錯誤identity／provenance。既有存檔回歸覆蓋 `[]`／`[5]`／`[0]`，登錄但零持有個體，瀏覽後 save bytes、dirty status、育成狀態／RNG不變。
- 一次 portable aggregate：1775/1776先通過；唯一失敗是 sandbox `EACCES 127.0.0.1` 阻擋既有 internal-server測試。只重跑該項、允許loopback後1/1通過；沒有改原斷言。完整1776項的發布CI另以精確提交查核。
- [來源版正常瀏覽器](source-browser.json)：100配置、20原有操作、10階段／蛋操作、150路線配置、10路線操作；兩HUD×五語，1366×768、1366×480、1024×420、390×844及resize往返。source8、9各三候選，source21五候選。長字不溢出、44px操作、詳情捲動、route→stage／標題焦點、關閉返回、未知aria／alt／title遮蔽、零持有／缺圖／alias均通過。遲到source8 manifest後仍保留source9。fresh Chromium及攔截public形狀URL只讀此worktree，未連Owner8732或覆寫玩家存檔，頁面錯誤與缺失請求均0。
- [改前證據](before-browser.json)：從精確父提交以唯讀git blobs還原本批受影響來源檔，兩HUD的原圖鑑無肖像／路線；資產延用相同現存bytes。
- 公開 `build:playtest`／`validate:playtest`：9401 files，buildId `2625d238e113ccd3fbe3a3b5a3643b5c72c34ee68c462e1c1e197b7a8097ee92`，inputSha256 `b91dbf01641354d27eab0e12418ae48d76ed8239858071791dbc25f52e9a7884`。現有 preload generator為233項（新增一個純投影module）；沒有改入口載入順序或新增引擎。[編譯產物正常瀏覽器](compiled-browser.json) 同樣通過100配置／20操作／10篩選／150路線配置／10路線操作，errors及missing皆0。

這是受控Chromium驗證；沒有physical phone/Safari、原作完整UI、權利或商業發布驗收。沿用現有Pages部署；容量警告不能作為刪圖／降畫質的理由。

## 有限本地美術盤點

[local-art-audit.json](local-art-audit.json) 記錄 CSV第11、26、246、255、258行、五個本地PNG的存在／bytes／SHA，以及七個指定 inventory-supplement 檔案的hash／相關片段。名稱表證實species9/m002與20/m101皆「鐵鈴芽」，保持原名。

本地OC-223天穹帝龍、OC-220黃銅王猿及OC-211王銅獼王母圖皆存在；後兩者雖共用m528 entityId，正式OC、英文／中文名與檔案不同。限定production記錄也明示兩種m528設計各自保留，不能自動合併。Inventory記錄存在不等於可用HUD／新公開許可；目前接受清單沒有211／222。Cloud母圖與新候選審查由parent處理，本輪不重複生圖或上傳，也不宣稱已窮盡所有本地／cloud路徑。

## 改前／改後畫面

| 證據 | 圖像 |
|---|---|
| 改前暖色桌機 | [原圖鑑](images/before-warm-zh-Hant-database-1366x768.png) |
| 改前經典桌機 | [原圖鑑](images/before-classic-zh-Hant-database-1366x768.png) |
| 390px未確認分支 | [source8剪影](images/warm-zh-Hant-routes-8-390x844.png) |
| 桌機完成分支 | [source9](images/warm-zh-Hant-routes-9-1366x768.png) |
| 經典HUD泰語五候選 | [桌機](images/classic-th-routes-21-1366x768.png)／[手機](images/classic-th-routes-21-390x844.png) |
