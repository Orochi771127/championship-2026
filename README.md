# Championship（暫名）

一款以夥伴育成、探索捕獲、進化與隊伍自動戰鬥為核心，逐步發展原創世界觀的網頁遊戲。專案以網頁與手機為優先，採直向 9:16、觸控優先設計，同時支援桌面瀏覽器。

目前沿用既有遊戲程式與已完成的玩法基礎，持續製作原創角色、棲地與產品內容。`Championship` 是暫定工作名稱；正式遊戲名、世界名與夥伴種族名仍待定案，遊戲名稱不綁定上市年份。倉庫網址與既有技術識別暫時保留，以維持連結與存檔相容。

世界／土地名候選為「響諾亞（HIBINOA／ヒビノア）」；生物總稱比較「伊諾獸（INOJU／イノジュ）」與「響諾獸（HIBIJU／ヒビジュ）」，均未定案。

## 遊戲方向

- 照護與培養夥伴，探索場域、捕獲新夥伴，經歷成長與進化，再組隊參加自動戰鬥與賽事。
- 即時玩家對戰（PvP）是後續產品核心目標；目前的 Link Battle 仍是手動交換邀請碼／回覆碼後，各自在本機運行的確定性對戰模擬，尚未具備即時連線同步。
- 原創世界觀提案：人們留在網路中的情緒與記憶痕跡，逐漸累積成世界與生命。這是敘事與美術的設計方向，尚未代表已實作的玩家資料蒐集、AI 記憶或線上世界系統。

## 立即遊玩

- [開啟公開網頁試玩版](https://orochi771127.github.io/championship-2026/)
- [安裝完整進度 QA 存檔](https://orochi771127.github.io/championship-2026/full-qa-save.html)

公開試玩版的存檔保存在目前瀏覽器中，不會自動同步到其他裝置，也不會在本機網址與公開網址之間自動轉移。QA 存檔安裝器會先下載既有存檔備份，再寫入 schema v5 測試存檔並開啟遊戲。

目前已整合育成、狩獵、捕獲、商店、籠子編輯、資料庫與多種對戰流程；全套原創美術、實體手機驗收及商業發布驗收仍在進行中。2026-09-28 的頁面與操作流程整合已發布：在商店、圖鑑、設施配置等選單畫面關閉或離開網頁也會存檔，已有存檔時開始新遊戲會先確認；返回與主要按鈕位置一致，詳細內容以面板顯示，平板直向改用多欄；當批 16 個畫面已從正常入口在四種畫面寬度下驗證。

2026-09-29 的全遊戲 UI／HUD 重設計、狩獵場慢速網路處理、本機自動保存與玩家設定已提交至 `main`（`bfb1f28`），但尚未發布到公開試玩版。公開建置仍受 `WEB_BUILD_INPUTS` 核准清單與雜湊檢查限制；程式已提交、測試通過與網站已更新是分開的狀態。帳號與雲端存檔目前只有規劃及開發預覽，尚未提供玩家使用。

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

GitHub CI 會在 `main` 推送或 PR 建立／更新時執行。GitHub Pages 工作流程則在 `main` 推送或手動執行時嘗試跑測試與公開版建置；只有核准檔案清單、SHA-256 與各項檢查均通過時，才會發布網站。一般分支推送不會自動發布。未核准的新檔或變更會使建置停止，`main` 更新不等於公開網站已更新。公開版使用明確檔案清單；檔案進入清單不代表第三方權利、商業發布或實體裝置驗收已完成。

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

本專案早期以《數碼寶貝冠軍賽》（Digimon Championship）的行為研究與網頁重建為基礎；既有 ROM／逆向研究、來源標示、對照契約與歷史驗收紀錄持續保留。原創產品方向不會改寫這些來源，也不代表現有試玩內容已全部替換為原創素材。

ROM、原生資料與解碼參考素材預設限研究用途，不得直接作為公開執行時內容；目前部分來源重建輸出另有 Owner 核准的限定公開試玩例外，僅適用於[指定網址與範圍](src/data/championship/public-playtest.r1.json)及核准清單。Owner 的部署許可不等於第三方權利人的授權，不會改變既有來源標記，也不代表商業發布或第三方權利驗收已完成。

## 文件入口

- [文件總覽](docs/README.md)
- [目前產品狀態](docs/CURRENT_PRODUCT_STATUS.md)
- [接續開發交接與本機素材界線](docs/handoff/dot-continuation.md)
- [籠子火山動畫修復與驗收](docs/reports/cage-animation-2026-09-18/REPORT_ZH_TW.md)
- [可重用實作盤點](docs/REUSE_INVENTORY.md)
- [總製作計畫](docs/planning/CHAMPIONSHIP_2026_MASTER_GAME_PRODUCTION_PLAN.md)
- [技術債登記](docs/TECH_DEBT_REGISTER.md)
- [美術總盤點](docs/art/ART_MASTER_INVENTORY.md)

`docs/CURRENT_PRODUCT_STATUS.md` 會保留各日期的驗收回條；較舊段落描述的是當時狀態，遇到衝突時以檔案最上方的新紀錄、目前程式碼與最新部署結果為準。

## 目前範圍

| 階段 | 狀態 |
|---|---|
| 育成首頁、照護、搬移、保存與 Continue | 既有可玩基線保留，持續驗證與完善 |
| Gate 選擇、裝備、狩獵、捕獲與返回 | 已整合主要流程，觸控與實機驗收仍持續 |
| 商店、籠子編輯與牧場顯示 | 已整合；火山動畫已修復，完整遮擋與美術核准仍開放 |
| 自由對戰、密碼對戰、練習對戰與冠軍賽 | 已有可玩流程，玩家隊伍與完整長期進度仍需依各模式驗收 |
| Link Battle 手動交換碼 | 已有邀請碼／回覆碼與本機對戰模擬；尚非即時多人連線 |
| 即時玩家 PvP、帳號與雲端存檔 | 產品目標／規劃中，尚未完成 |
| 全角色原創美術、音效與商業發布 | 製作中，尚未整體升格為完成 |

本專案的公開頁面是 Owner 核准的開發中試玩版，不代表整體遊戲、第三方權利或商業版本已完成驗收。
