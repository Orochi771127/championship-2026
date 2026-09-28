# 頁面與流程整合發布回條

日期：2026-09-28

依 [Owner Direction](../../coordination/OWNER_DIRECTION.md) 的「請發佈到正式站」，發布核准提交 [`f16a84f`](https://github.com/Orochi771127/championship-2026/commit/f16a84f92434e970f796b2032832e3c227fd9d19) 已推送到 `main`。本批功能提交為 [`7646813`](https://github.com/Orochi771127/championship-2026/commit/76468133fa360357566e3222c186e657e24e359e)，合併提交為 [`fd6cb67`](https://github.com/Orochi771127/championship-2026/commit/fd6cb67504a4e620e5235ac6048e3955eed661c6)。

## 發布內容

- 公開建置清單 `WEB_BUILD_INPUTS.v1.json` 加入本批唯一的新模組 `src/championship/app/uiDialog.js`（`main.js`、`vs4Screens.js` 匯入，`championship.html` 預先載入），清單由 3,962 個檔案變為 3,963 個。
- 本批改動的 23 個已列檔案更新為目前的核准雜湊。雜湊由 `scripts/refresh-playtest-approval.mjs` 在 `main` 的乾淨 LF 匯出上計算，和 CI 的 Linux checkout 相同，沒有讀到工作樹裡其他代理的未提交修改；腳本更新的正好是這 23 個檔案。
- 沒有加入素材、發布目的地或權利主張。

## 發布前驗證（本機）

- 乾淨匯出：`npm run build:playtest`、`npm run validate:playtest` 通過，3,966 個檔案，build ID `3d10c93949c524dc99947b0c1c6d26648ef0eb6f87a3b4ec6190afaafb611d82`；`npm run test:ci` 1,346/1,346（關閉 Web Locks，同 CI 的 Node 22）。
- 以本機伺服器提供建置產物本身（`127.0.0.1:8763`），12 個瀏覽器閘門全部通過。`championship-owned-battle-browser` 與 `test:browser:battle-cube` 會開啟 `tests/fixtures/` 裡的測試頁，公開建置刻意不含這些頁面，所以這兩項只讓 `/tests/` 路徑改由匯出目錄提供，遊戲本身仍是建置產物。

## GitHub

- [Championship 2026 CI](https://github.com/Orochi771127/championship-2026/actions/runs/36433868359)：成功。
- [Deploy Championship to GitHub Pages](https://github.com/Orochi771127/championship-2026/actions/runs/36433868641)：build 與 deploy 成功。
- 正式網址：[https://orochi771127.github.io/championship-2026/](https://orochi771127.github.io/championship-2026/)，回應 HTTP 200，首頁內容與 `championship.html` 一致。
- 線上 `pages-build.json`：提交 `f16a84f`、build ID `3d10c939…`、3,966 個檔案，與發布前在本機驗證的建置產物相同。
- 本批 24 個檔案（23 個更新雜湊的檔案加 `uiDialog.js`）的線上 SHA-256 與 `main` 完全一致；一般網址與加上防快取參數的網址結果相同。

## 正式站瀏覽器驗收

網路等待改為 120 秒，只改在匯出目錄的臨時副本；遊戲斷言不變，正式測試檔仍是原本設定。

| 閘門 | 結果 |
|---|---|
| `test:browser`（INT-RH2） | 通過：6 種首頁尺寸與存檔重載（763 秒）。 |
| `test:browser:cage-layout` | 通過：14 次畫面旅程、6 組操作（133 秒）。 |
| `test:browser:ui-integration` | 未通過。新遊戲建立即存檔、首頁今日狀態、「第 1 日」、商店不足原因與按鈕位置都已在正式站通過；接著在狩獵場載入時遇到遊戲既有的 30 秒上限，畫面顯示「狩獵場載入時間過長，請返回牧場後再試一次。」，閘門停止。重跑一次結果相同。 |

`ui-integration` 停下的原因是這台電腦當時的網路速度。用 curl 實測，從 GitHub Pages 下載約 47–56 KB/s（同時從 jsDelivr 約 130 KB/s）；狩獵場的兩張地圖影格各約 0.93 MB、0.98 MB，各要 19–25 秒。另用探測腳本從正常入口進狩獵場三次，三次都在 30 秒上限停下，沒有 4xx 或失敗的請求。同一流程在 build ID 相同的建置產物上（本機伺服器）通過；狩獵場的載入程式與素材本批都沒有改。

這也表示網速約 0.5 Mbps 以下的玩家在公開站可能同樣進不了狩獵場。30 秒上限來自較早的提交 `3a4b52a`；是否調整（例如依下載進度延長、顯示進度或縮小地圖影格）需另行決定。

實體手機、Safari、權利與商業發布驗收不在本回條範圍。
