# 籠子格位與工具列時間修復發布回條

日期：2026-09-18

修復提交 [`4e847d4`](https://github.com/Orochi771127/championship-2026/commit/4e847d4fffd04a0c36da05a169e424852114baae) 已推送到 `main`。

## GitHub

- [Championship 2026 CI](https://github.com/Orochi771127/championship-2026/actions/runs/35335263867)：成功。
- [Deploy Championship to GitHub Pages](https://github.com/Orochi771127/championship-2026/actions/runs/35335263525)：成功。
- 正式網址：[https://orochi771127.github.io/championship-2026/](https://orochi771127.github.io/championship-2026/)
- 正式頁面回應：HTTP 200。
- `main.js`、`cageEditRuntime.js`、`raisingFieldViewport.js` 的線上 SHA-256 與 `main` 完全一致。

## 正式站瀏覽器驗收

- 390×844、820×1180、1024×1366 三種尺寸通過。
- 14 次畫面旅程、6 組操作通過。
- 管理選單開啟時，時鐘由 07:02 前進至 07:03。
- 系統選單開啟時，時鐘由 07:03 前進至 07:04。
- 籠子由第 8 格移至第 10 格，保存、離頁、重新載入及 Continue 後仍正確還原。
- 無頁面錯誤、無缺少資源。

第一次與第二次正式站自動檢查在等待全部遠端資源進入 `networkidle` 時碰到 30 秒載入門檻，尚未執行遊戲斷言。將同一檢查的遠端載入門檻延長到 120 秒後完整通過；正式測試檔仍保留原本 30 秒設定，本機工作區沒有留下這項暫時調整。

實體手機尚未納入本次驗收；本回條只確認 GitHub、正式站檔案、桌面瀏覽器尺寸與實際遊戲流程。
