# 缺檔恢復檢查點

原 47 個精確缺檔全部恢復；凍結測試清單的 5,422 個檔案全部核對大小與 SHA256。另按受影響測試和 manifest 明確引用補齊來源，總計驗證 7,975 檔、1,153,447,857 bytes，缺檔與 hash 不符皆 0。

來源只使用本工作區的 Git／既有交接／相同 hash 候選，以及同一已授權 GitHub 專案的固定 adc36510 版本。先前 3 個已恢復檔案先核對，沒有重複下載。未讀取被拒工作樹，未下載 ROM 或整庫 archive，未上傳來源。為恢復本機 Git 一致性，已把精確原檔補入本機 object cache；沒有改動 HEAD／index 的來源內容。

受影響的 34 個模組聚焦驗證全數通過。完整 CI 留待後續產品／發布修改完成後跑一次；本檢查點不把先前完整 CI 的 47 個失敗改寫成完整通過。

三項測試介面修正保留原驗證要求：alternate-form 的移除 import harness 注入真實公開 contract 與 ranch selection；非分頁載入 diagnostics 明確要求 streaming 為 null；獎章公開顯示與私有生成／封存來源分別完整比對。沒有刪除或跳過測試。

本階段未修改遊戲 runtime、影片、圖像或發布清單。ART_PRODUCTION_INDEX.json 保持 SHA256 `3e7b7694a88c3b7d75e444b1e04bb769923480bfeecb2df19e68005c6b6eb87f`，未上傳。歷史拒絕均未重試。

使用者隨後已明確同意暫停首頁 TITLE 影片，其他工作與發布繼續。下一階段只從公開包排除影片並停用入口，保留作者原檔及恢復方式，驗證容量、完整測試與正常操作後才發布。此檢查點尚未 push／merge／deploy；沒有新增公開驗證 URL。

詳細恢復、hash、下載、Git cache 和三輪聚焦 log 保留於本工作區 `local-preparation/ci-source-recovery-20261017/`。本報告不是公開素材或來源 payload。
