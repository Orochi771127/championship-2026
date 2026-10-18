# iPhone 主畫面修正（2026-10-18）

本批接續 e6b252b8：Owner 要求修正主畫面 App 標題下方空帶，將 Safari 安裝入口移至頂部，並授權測試後 commit、push、發布 main 及同步 R 槽。PR56 與平行圖鑑素材工作不屬本批。

## 修改與證據邊界

- 標題使用既有 portraitFrame 的 resize、visualViewport、pageshow 更新實測高度；standalone 無鍵盤且未縮放時取可用視窗高度，背景延伸到底部。保留操作按鈕的安全區距離；未改遊戲模擬、RNG、save key、路由或 Pixi ticker。
- 安裝入口和設定同列，44px 觸控高度，長文字截斷保留完整 title。重播入口限制寬度，避免三個頂部操作相撞。標題美術錨點不變。
- 後續 IMG_4146.jpeg 橫向回報的第三條空白列：source 確認 cm-title-note 有兩個持續存在的 span，原 `:empty` 不會匹配。改為沒有可見且有內容的 span 時隱藏容器；不清空有效訊息或刪除狀態元件。隔離瀏覽器從正常登入進入兩個選項後確認空列隱藏、注入有效狀態文字仍顯示，再切換橫直與 installed 狀態確認空列不回來。
- 只有真正 beforeinstallprompt 事件才顯示支援瀏覽器的原生安裝確認；只在點擊時呼叫 prompt，一次消耗、避免重複點擊，appinstalled 才表示已安裝。iPhone 維持分享選單教學，無靜默安裝、描述檔或安全設定變更。
- refreshContinue 仍只使用 app.inspectSave / app.canContinue。新舊安裝入口均不寫 storage。Safari 和主畫面呈現不同存檔，符合隔離儲存的可能情況，不能推論存檔已刪除。先在有進度的 Safari「設定 → 資料」下載備份；目前設定只有匯出，不能宣稱已有自動轉移或一般匯入 UI。不要為解決差異而清除網站資料或建立覆蓋原存檔。

## 平台資料（已查公開一手來源）

- [MDN：安裝提示](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable#triggering_the_install_prompt)：beforeinstallprompt 不支援 iOS。一般網頁不能保證一次點擊即新增桌面圖示。
- [LINE MINI App 官方加入主畫面流程](https://developers.line.biz/en/docs/line-mini-app/develop/add-to-home-screen/)：平台可提供捷徑流程，仍有系統操作；未驗證 Owner 所指特定 LINE Pay 版本的行為。
- [WebKit 儲存隔離說明](https://bugs.webkit.org/show_bug.cgi?id=181849)：主畫面 App 與瀏覽器的狀態隔離是已記錄的設計。這不能直接證明 Owner 手機此刻存檔內容。
- [WebKit 安全區指南](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)：背景可延伸至螢幕邊緣，重要操作保留 safe-area padding。

## 驗證與限制

針對視窗 / standalone / 鍵盤 / 縮放的純函式測試及安裝事件生命週期測試加入既有 portable suite。隔離 Chromium 使用 393×852、390×844、320×568、844×390，替換測試樣式中的安全區為指定數值，檢查背景到底、44px 入口、設定與標題不相撞；這是合成檢查，不能當作 iOS 實機驗收。

[四組受控版面結果](CONTROLLED_BROWSER.json)。每組均以正常首頁開啟安裝說明後關閉、登入、確認無存檔空提示不占位、確認有效文字可見、往返橫直旋轉，頁面錯誤為零。測試用文字與 standalone 屬性只存在隔離頁面，未寫入 save 或產品程式。

完整 portable CI：2,588 passed / 0 failed。首輪沙箱執行的兩項阻擋為測試目錄 symlink EPERM 與 loopback fetch EACCES；以所需執行權限重跑後全通過。正式 build：7,708 files，內容 buildId `d7998b0ef70fdad2f8a7441e1e042a5b48a0239fea715c8e28dc1efae77a6053`。後續若 main 納入獨立已授權素材提交，最終以發布收據的線上版本與雜湊為準。

Owner 截圖 metadata/OCR 已讀：IMG_4142.jpeg（709×1536）、IMG_4143.jpeg（945×2048）。原圖像素轉存未完成：Library skill 的 scripts/library_file_transfer.py 讀取回覆 `skill package is not available`，準備轉存回覆未提供本機檔案。未繞過此限制或宣稱完成逐像素比對。

實體 iPhone 待驗收：Safari 分享加入主畫面後，完全關閉重開；檢查手勢條上方無淺藍空帶、底部按鈕可點；Safari 安裝入口不遮標題；橫直切換與鍵盤收合正常；原 Safari 存檔仍可繼續。發布證據在工作區 IPHONE_PUBLICATION_RECEIPT.json，不以成功發布代表實機已通過。
