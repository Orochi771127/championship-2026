# iPhone 底部空帶追蹤：底層背景與實機診斷（2026-10-18）

**實機仍未解決／未驗收。** Owner 在 c2ba5a3e 發布後重新開啟主畫面 App，仍回報底部空帶。親代目視 IMG_4154.jpeg（Library libfile_8f53b69904908191b46b5c927e70918a）：709×1536，背景約在 y1438 結束，下方約 98px 淡藍區包含黑色手勢條。這與橫向空提示列是不同問題；按鈕改為進入遊戲，也不能單靠此證明載入哪個 build。未斷言是快取問題。

## 已確認與未知

- HTML 已有 `viewport-fit=cover`、apple-mobile-web-app-capable=yes、black-translucent，未發現整個 body 的 safe-area padding；底部按鈕各自有安全距離。沒有為填縫再加第二層 body padding。
- styles.css 的 html/body 高度為 100%，html 用 `--c-void`；預設 arena 主題、theme-color 均是淡色。先前修正只對固定 title 子元素設實測高度，**沒有處理 WebKit 可能用來繪製手勢安全區的頁面 canvas 背景**。
- [WebKit 官方說明](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)指出，inset 區域會以 html/body background-color 繪製；viewport-fit=cover 後只對重要控制保留安全區。這支持修正底層 paint 的方向，不能證明 Owner 目前 iOS 的確切 viewport 或 compositor 行為。
- 沒有可用實體 iOS renderer；無法從 Chromium 重現或否定該實機問題，也沒有拿 screen.height 直接當作可操作視窗高度。

## 本次有界處理

僅在主畫面 standalone 且首頁可見時，html canvas 使用與 title 相同的已解碼背景 Blob，body 透明，根畫布至少為 100lvh；背景可延伸至瀏覽器允許的畫布區域。前景 art、控制、safe-area padding 和 measured viewport 規則保留。原 titleImageLifecycle 仍是唯一圖片 owner：背景只抓一次、title 隱藏／dispose 時先清除根背景引用再 revoke Blob，重返首頁使用既有快取，無第二個圖片 fetch/ticker/save。

設定的「資料與帳號」既有「技術診斷」區新增可展開的唯讀資訊：revision `PWA-20261018B`、實際 main bundle 檔名、standalone、inner/client/screen/visualViewport、safeBottom、html/body 色彩、title/panel 邊界、viewport/theme-color/status-bar metadata。不讀存檔、玩家名字、localStorage、網址參數，不上傳、不常駐計時。展開時取得當下資訊。

## 回報方式與驗證邊界

如空帶仍出現：請從 App 右上設定進入「資料與帳號 → 技術診斷」，展開診斷資料並回報截圖，其中 `revision` 必須為 `PWA-20261018B`，再比對 screen、inner、client、visual height、safeBottom 和 title.bottom。這可區分舊 bundle、DOM 高度不足、根畫布與系統安全區問題；不能要求刪除 App、清資料或覆寫存檔。

受控測試只確認背景 Blob 共用／釋放、installed selector、診斷資料、橫直幾何及有效提示不被隱藏。GitHub CI／Pages 成功與公開雜湊比對僅是發布接受，**不等於 iPhone 空帶消失**。圖示替換的輸出與發布結果另見 [圖示報告](../app-icon-2026-10-18/REPORT_ZH_TW.md)。
