# 發布候選：本機驗收

最終完整 CI 2,574 項全數通過，零跳過；build、逐檔驗證與公開 payload 邊界通過。產物 7,565 檔、999,249,150 bytes，距既有 1 GB 上限剩 750,850 bytes。公開產物不包含私有權威索引。原 ART_PRODUCTION_INDEX 與 main 使用同一 Git blob，沒有重試先前遭拒的上傳或 Drive 傳輸。

本次新增可公開主圖為 species125 / MA62 日焰獅 v5，1448×1086、透明無損 WebP。另 58 張沿用 main 相同 hash；完整角色、hash、尺寸與預期讀回 URL 見 SELECTED_HEROES.csv。原 39 張交接中的 040/189 為相同 hash；其餘 37 份仍保留在作者資料與本地檔案，未提升到公開選取，見 HELD_HEROES.csv。容量問題已解除，裝備／發布審查仍未完成；179–183 新圖維持 HOLD。116 雪印零偶、121 MA50 聖焰獅皇、125 MA62 日焰獅名稱修正保留，角色 ID、數值、graph、存檔與原動作契約未改。主圖核准不代表動作完成。

依 Owner 指示暫停 TITLE 影片，原三個影片版本及海報均保留，回復開關與精確原始 hash 保留。封裝去除已編譯程式的重複原檔，仍保留 URL 動態載入程式與依賴；只排除未用的 UI 尺寸副本。六隻 Battle 角色改用已選取主頁的相同像素，原獨立 atlas 與回復清單保留。4,622 張選取圖片均與前一候選 hash 相同，沒有重編碼、降低畫質或刪原圖。

六角色 370 幀逐像素 RGBA／原生動作與幾何契約相等。一次受控 Chrome 390×844、10 Mbps／80 ms／CPU4 A/B：冷載 28.06→30.56 秒，暖載 0.561→0.680 秒，網路 33,271,546→33,132,560 bytes；共用頁面有更多請求，估計 texture RGBA 125,843,456→142,880,768 bytes。這是容量取捨及單次微測試，不是全遊戲效能改善或實機 GPU 量測。

Chrome 155 正常 TITLE→Continue→Home→System→Database→125，在 390×844 及 1440×1000 通過。沒有影片請求、缺檔、私有描述請求或 page error。證據與截圖保存在工作區 output/playwright/title-capacity-final；完整 CI、build、payload、逐像素與 A/B 紀錄保存在 local-preparation/title-capacity-release-20261017。

此報告記錄本機候選。實際 pushed／merged／deployed 與公開讀回需以後續遠端結果為準；此處不宣稱已上線。

LF 修正後 build ID 為 585c6c2ad59c0953db639268bc4182f48f08600e6e0e5bf9d3d6cc194965e073，容量仍為 999,249,150 bytes。GitHub Linux 的 2,574 項測試、build、validate 已通過。兩個 Windows CRLF 核准 hash 已對齊原有 Git LF blob，程式 Git blob 未變。M201 測試改正公開分頁路徑預期，83 格／53 組動作、真實 Hunt 與正常育成→雙方戰鬥→返回育成均通過；本機沿用現有 Chrome。該測試的原始 83 格／53 組動作證明與私有 atlas 的本機隔離檢查仍保留，公開正常流程另要求不請求私有 atlas。
