# 數碼寶貝冠軍賽 — 2026 現代化網頁重製版

這是獨立的遊戲產品倉庫。專案以網頁與手機為優先，採直向 9:16、觸控優先設計，同時支援桌面瀏覽器。

## 立即遊玩

- [開啟公開網頁試玩版](https://orochi771127.github.io/championship-2026/)
- [安裝完整進度 QA 存檔](https://orochi771127.github.io/championship-2026/full-qa-save.html)

公開試玩版的存檔保存在目前瀏覽器中，不會自動同步到其他裝置，也不會在本機網址與公開網址之間自動轉移。QA 存檔安裝器會先下載既有存檔備份，再寫入 schema v5 測試存檔並開啟遊戲。

目前已整合育成、狩獵、捕獲、商店、籠子編輯、資料庫與多種對戰流程；完整原作一致性、全套原創美術、實體手機驗收及商業發布驗收仍在進行中。最新籠子批次修復了火山熔岩第二幀、育成畫面過度放大、設施形狀多出格位，以及管理／系統工具列暫停時間的問題；36 種設施、20 個格位、1,102 組合法配置與三種畫面寬度均已驗證。

## 本機安裝與啟動

Windows 可以直接執行 `START_CHAMPIONSHIP.cmd`。遊玩期間請保持伺服器視窗開啟；不要直接雙擊 `championship.html`，因為瀏覽器會在 `file://` 模式下阻擋 JavaScript 模組。

也可以從 PowerShell 啟動：

```powershell
npm install
npm run serve
```

接著開啟 `http://127.0.0.1:8732/championship.html`。

## 測試與公開版建置

```powershell
npm test
npm run test:ci
npm run validate:preload
npm run build:playtest
npm run validate:playtest
```

GitHub Pages 工作流程會在 `main` 更新後執行 CI、建立公開試玩版、核對核准檔案與 SHA-256，再發布網站。公開版使用明確檔案清單；檔案進入清單不代表第三方權利、商業發布或實體裝置驗收已完成。

內部審查版可用以下指令建立：

```powershell
npm run audit:build
npm run build:internal
npm run validate:internal
$env:CHAMPIONSHIP_PORT = '8764'
npm run serve:internal
```

接著開啟 `http://127.0.0.1:8764/championship.html`。內部版僅供本機審查，不應上傳到公開靜態網站。

## 專案架構

| 層級 | 負責內容 |
|---|---|
| DOM | 畫面介面、選單、面板、工具列與文字 |
| PixiJS | 可遊玩的 2D 場景、角色、精靈與 2D 特效 |
| Three.js | 已驗證或明確核准的限定 3D 場景與效果 |

專案只保留一套應用程式、路由、狀態、存檔與 PixiJS Application／ticker。Nexus Link 是另一個獨立產品，本倉庫不依賴其應用程式、玩法、存檔或資產。

## 美術與研究資料界線

- `assets/production/`：遊戲執行時可以載入的產品美術。
- `research/original-evidence/`：原作證據政策與外部資料索引；不提供遊戲執行時載入。
- `docs/art/`：美術盤點、契約、製作狀態與驗收紀錄。
- `docs/coordination/`：Owner 指示與跨工作階段協調紀錄。

ROM 解碼素材屬於研究資料，不會由遊戲下載。公開試玩授權只涵蓋核准清單中的既有輸出，不會自動改變來源、權利或商業發布狀態。

## 文件入口

- [文件總覽](docs/README.md)
- [目前產品狀態](docs/CURRENT_PRODUCT_STATUS.md)
- [籠子火山動畫修復與驗收](docs/reports/cage-animation-2026-09-18/REPORT_ZH_TW.md)
- [可重用實作盤點](docs/REUSE_INVENTORY.md)
- [總製作計畫](docs/planning/CHAMPIONSHIP_2026_MASTER_GAME_PRODUCTION_PLAN.md)
- [技術債登記](docs/TECH_DEBT_REGISTER.md)
- [美術總盤點](docs/art/ART_MASTER_INVENTORY.md)

`docs/CURRENT_PRODUCT_STATUS.md` 會保留各日期的驗收回條；較舊段落描述的是當時狀態，遇到衝突時以檔案最上方的新紀錄、目前程式碼與最新部署結果為準。

## 目前範圍

| 階段 | 狀態 |
|---|---|
| 育成首頁、照護、搬移、保存與 Continue | 已有可玩基線，持續補齊原作細節 |
| Gate 選擇、裝備、狩獵、捕獲與返回 | 已整合主要流程，觸控與實機驗收仍持續 |
| 商店、籠子編輯與牧場顯示 | 已整合；火山動畫已修復，完整遮擋與美術核准仍開放 |
| 自由對戰、密碼對戰、連線流程模擬與冠軍賽 | 已有多個可玩流程，完整玩家隊伍與長期進度仍部分完成 |
| 全角色原創美術、音效與商業發布 | 製作中，尚未整體升格為完成 |

本專案的公開頁面是 Owner 核准的開發中試玩版，不代表整體遊戲、第三方權利或商業版本已完成驗收。
