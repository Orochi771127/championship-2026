# 核准 App 圖示替換（2026-10-18）

Owner 核准 Library `libfile_fdc9f26e8e5c81919da5b99c9da96219` 的火龍頭肩特寫圖示，並親自下載至下載資料夾。本批使用該本機檔案，不重新生成、不改角色構圖；延續授權 commit、push、發布 main 及安全同步 R main。

## 原稿與輸出

唯一符合原稿的檔案：`ChatGPT 圖像 2026年10月18日 下午01_20_31.png`，1254×1254、RGB、2,372,280 bytes。已目視確認藍色背景、頭肩特寫、金色火焰弧；尺寸與位元組數亦符合先前 Library metadata。SHA-256：`33f557a1549bbd82f97ff873f0be4b8370a16aa45138b0d55cc88602e34841c6`。原始下載檔保持不變，不隨網站上傳。

`tools/build-approved-app-icon.py` 在處理前後核對原稿雜湊，使用完整方形 Lanczos 下採樣輸出既有三個路徑：180×180 apple-touch-icon，以及 192×192、512×512 manifest PNG。全部不透明 RGB、無預切圓角、無額外 metadata。臉部不另裁切，保留核准構圖。180px 版本已目視檢查。[輸出與來源雜湊](ICON_BYTES.json)。圖示來源紀錄從舊 title delivery manifest 分離，避免繼續錯稱源自舊全身圖。

## 安裝設定

- HTML apple-touch-icon、manifest link 和 manifest 內 icons 加入共同的原稿雜湊版本參數 `icon-33f557a1549b`，新請求可辨識新版。
- 預設 HTML 為 zh-Hant，桌面短名採既有核准品牌 registry 的「網線拍檔」，manifest 完整名「網線拍檔：錦標賽」。未新增品牌，也未新增語系切換或多 manifest 系統。
- manifest id `./`、scope `./`、start_url `./championship.html`、origin、save key、既有 iPhone 高度及空提示列修正均不變。保持 PR56 與圖鑑工作獨立，發布前同步最新 main。

## 驗證與實機限制

針對檢查涵蓋三張圖的實際 PNG header（RGB、尺寸）、輸出雜湊、HTML/manifest 相互引用、版本參數、核准品牌與 manifest identity。沿用既有 portable CI、正式 playtest build/validate/payload 與 GitHub Pages 流程。發布後核對實際線上 icon bytes、manifest 與 HTML link，而非只確認 push。

iOS 既有主畫面圖示可能保留安裝時 metadata；版本參數不保證已安裝圖示立即刷新。本批不以模擬瀏覽器宣稱 iPhone launcher 驗收，不要求刪除 App；先檢查並匯出 standalone 環境存檔備份，再個別處理需要重裝的情況，Safari 與 standalone 儲存可能不同。

先前 Library 自動轉存受 Windows `os.setxattr` 不支援阻擋；Owner 親自下載並明確指定本機來源後，本批改走正常本機檔案流程，並非略過 Library metadata 要求來重試下載。
