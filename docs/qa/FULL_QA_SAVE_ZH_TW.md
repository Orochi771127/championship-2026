# 全功能 QA 測試存檔

這個存檔用來自由巡覽目前已實作的功能、重複操作並尋找錯誤。它使用正式的 `championshipModernSave:v1` schema 與唯一存檔槽，不會建立第二套遊戲規則、角色資料庫或存檔 authority。

## 使用方式

1. 關閉其他正在執行 Championship 的分頁。
2. 手機開啟 `https://orochi771127.github.io/championship-2026/full-qa-save.html`。
3. 按「備份目前進度、安裝 QA 存檔並開啟遊戲」。如果手機原本有存檔，頁面會先下載備份 JSON。
4. 跳到正式遊戲後選「繼續遊戲」。

本機也能先執行 `npm run serve`，再開啟 `http://127.0.0.1:8732/full-qa-save.html`。

`localhost`、`127.0.0.1` 與公開網站是不同的瀏覽器存檔來源。手機必須從 GitHub Pages 的安裝頁進入，才能把存檔寫到正式網頁版使用的同一個來源。安裝仍需要明確按鈕操作，不會只因開啟網址便覆蓋進度。

## 內容

- 金錢 `9,999,999`。
- 118 項商店商品全部可見。
- 所有一份上限的狩獵裝備與外掛各持有一份；可堆疊物品各 90 個，保留購買測試空間。
- 35 個可購買籠子全部持有，最高階級對應的牧場格位全部開啟。
- 16 個狩獵 Gate 全部可進入。
- 62 個賽事／教學徽章旗標、冠軍大會與世界大會入口開啟。
- 216 個正式圖鑑物種全部登錄。
- 牧場收藏包含 5 隻有原作個體欄位的究極體：戰鬥暴龍獸、閃光暴龍獸、黑暗戰鬥暴龍獸、鋼鐵加魯魯獸、公爵獸。

這是 QA fixture，不代表玩家已經由正常流程取得這些進度。仍未實作的功能不會因存檔而偽裝成可用；例如介面中明列未完成的按鈕仍會保持原狀。

## 重新產生與驗證

```powershell
npm run qa:full-save:build
npm run qa:full-save:validate
node --test tests/championship-full-qa-save-cases.mjs
```

產物是 `qa/championship-full-qa-save.json`。產生器先用正式 app 建立一般新遊戲存檔，再加入 QA 資源，最後通過目前 schema 的完整反序列化驗證。
