# R5 返回同步順序修正

基線 `1e531846a989b17bd9471897bf5244022ec34f99`。本批在既有 R5 維護授權內，只修已重現的返回重複請求；保留離開時取消、不改素材 bytes／画質、存檔、RNG、遊戲或音樂內容。

## 判因

舊公開 trace 返回第一次 arena 在約 8ms 被 abort，約 41 秒後第二次開始並收到 200，直到整輪 180s 上限仍無 CDP body。trace 沒有完整的返回音樂事件，不能單憑它斷言原因。

補漏的本地正常流程（原曲開啟、初始 arena 尚未完成、原素材經隔離 route 供應）重現 2 個返回請求。觀測順序：第一個 fetch 的 music cue 還是 moon、initialBuffering=false；接著 cue=login／initialBuffering=true 時 abort；緩衝結束 cue=login／initialBuffering=false 再發 fetch，完整原圖可還原。這證明是有限的音樂同步順序競爭，不是無限 lifecycle 循環，也不是無法 restore。

原驗證缺口：未完成模式為靜音；有聲模式已先完成原圖、返回使用 Blob 快取，因此沒有覆蓋「未完成＋有聲」。新增 normal browser regression 同時覆蓋三種組合。

## 最小修正與驗證

既有 overlay MutationObserver 先 syncMusic，再 syncTitleArt，讓新 cue 的 buffering 狀態在圖片 owner 決定是否 fetch 前同步。不新增 owner、timer、retry、素材或持久狀態，不任意撤回已有效的退出取消。

- 紅燈：舊成品未完成＋有聲返回 2 次，完整原圖 hash 仍可成功還原。
- 綠燈：正式候選正常 title→ranch→Save & Quit→title 三種情境全過；未完成靜音 1 次、未完成有聲 1 次、已完成有聲 0 次；有聲新 fetch 使用 login、initialBuffering=false，之後無 abort；全數原圖 SHA256 相同。
- 33/33 affected tests 通過。
- 守衛 build/validate：9290 files，buildId `befb6983340e0cce7fd82eeef9c62363761ac1f8d2c6e027610ae2b59948a4e0`。
- 原圖 2057534 bytes，SHA256 `a7c8f01413abe0b8448bfeb33266753f35f96bbb2e3d106169ec3eba3564eca1`。

執行新 browser regression 時明確指定 CHAMPIONSHIP_QA_ARTIFACT（成品根目錄）、CHAMPIONSHIP_QA_OUTPUT（證據目录）、CHAMPIONSHIP_QA_STORAGE（隔離 fixture），再執行 `node tests/championship-title-return-browser.cjs`。不使用 Owner profile 或存檔，不啟動 server。

## 證據界線與後續

公開第二次 HTTP 200 後無 body 仍是獨立的傳輸觀測；排序修正消除無效起跑，沒有證明修好該 body 等待。parent 回報 cloud 自然 GET 可完整取得相同 arena（9.127s、相同 hash）、index（10.019s）與 login MP3（7.877s）；這是另一環境經 proxy 的來源資料，不是 desktop/iOS 或本輪同條件效能證據，也不能據此確定 CDN/proxy 根因。

本輪不原封重跑 180s，不轉 room，不宣稱整體冷載改善。發布後以實際 commit/build/hash 核對成品；desktop 自然網路完整返回仍需另有界驗證，不能以 HTTP200、本地成功或 cloud GET 代替。下一個最小自然網路驗證應只觀測有聲且未快取的返回，記錄新 cue/buffering、fetch/abort、第一個 body 與完整 decode，並沿用總時限停止；不重新跑全遊戲或整批 CDN。
