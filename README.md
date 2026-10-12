# Cyber Partner: Tournament / 網線拍檔：錦標賽

從第一顆蛋開始，照顧你的拍檔、見證牠成長與進化，探索野外並捕獲新夥伴，配置育成籠與照護設施，再帶著自己培育的隊伍挑戰自動對戰錦標賽。

A portrait-first browser game about raising creature companions, exploring hunting grounds, capturing new partners, managing habitats, and entering automated tournament battles. Currently available as a public development playtest.

遊戲以手機直向 9:16 與觸控操作為優先，也支援桌面瀏覽器。介面提供繁體中文、英文、日文、泰文與越南文。

## 立即遊玩

- [開啟公開網頁試玩版](https://orochi771127.github.io/championship-2026/)

公開試玩版的進度保存在目前瀏覽器，不會自動同步到其他裝置，也不會在本機網址與公開網址之間自動轉移。清除網站資料或更換瀏覽器前，請先備份存檔。

## 遊戲內容

- **相遇與成長**：八顆培育蛋選擇、命名、照護與進化，以及新遊戲互動教學。
- **野外探索**：選擇狩獵地圖與裝備，捕獲新夥伴並帶回牧場。
- **自己的牧場**：育成籠配置、夥伴搬移、照護設施與商店。
- **隊伍與錦標賽**：使用培育的隊伍參加自動對戰，搭配動態鏡頭、命中特效與戰況文字。
- **收藏與呈現**：圖鑑、徽章介面、原創角色美術、可略過的片頭影片與背景音樂。

上述功能已接入公開試玩版，仍持續修復與驗收。通訊碼隊伍交換屬於既有測試流程；房號即時多人 PvP、帳號綁定與跨裝置雲端存檔尚不列為已完成服務。擴充區的預覽不代表已開放付費購買。公開網站以成功部署的版本為準，工作區中的新素材不代表已上線。

## 五語遊戲名稱

遊戲名稱依已核准的 [品牌詞條](src/championship/text/brandTerms.js) 統一，使用以下短標：

| 介面語言 | 遊戲名稱 |
|---|---|
| 繁體中文 | 網線拍檔：錦標賽 |
| English | Cyber Partner: Tournament |
| 日本語 | サイバーパートナー：トーナメント |
| ไทย | ไซเบอร์พาร์ตเนอร์: ทัวร์นาเมนต์ |
| Tiếng Việt | Cyber Partner: Giải đấu |

五語支援指介面語言；部分角色名稱仍保留繁體中文，翻譯與母語校對持續改善。倉庫名稱及網址保留 `championship-2026`，作為既有工程識別與連結；它不是目前對外使用的遊戲標題。

## 本機安裝與啟動

Windows 可以直接執行 `START_CHAMPIONSHIP.cmd`。遊玩期間請保持伺服器視窗開啟；不要直接雙擊 `championship.html`，因為瀏覽器會在 `file://` 模式下阻擋 JavaScript 模組。

也可以從 PowerShell 啟動：

```powershell
npm install
npm run serve
```

接著開啟 `http://127.0.0.1:8732/championship.html`。

## 測試與公開版建置

[完整進度 QA 存檔工具](https://orochi771127.github.io/championship-2026/full-qa-save.html)僅供測試，會替換目前進度。請使用獨立測試瀏覽器環境，先確認備份成功，勿覆蓋日常遊玩的存檔。

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

專案只保留一套應用程式、路由、狀態、存檔與 PixiJS Application／ticker。未來原創產品化沿用既有程式、存檔與測試；目前不引入 Nexus Link 的程式、存檔或資產。

## 美術與研究資料界線

- `assets/production/`：遊戲執行時可以載入的產品美術。
- `research/original-evidence/`：原作證據政策與外部資料索引；不提供遊戲執行時載入。
- `docs/art/`：美術盤點、契約、製作狀態與驗收紀錄。
- `docs/coordination/`：Owner 指示與跨工作階段協調紀錄。

本專案保留早期 Championship 重建研究的來源與授權紀錄；原創美術與去品牌介紹不會改寫這段來源歷史，也不表示第三方權利已驗證。ROM 原始檔、原生載荷與解碼研究資料不作為遊戲下載資源。公開試玩授權只涵蓋核准清單中的既有輸出，不會自動改變來源、權利或商業發布狀態。

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
| 育成首頁、照護、搬移、保存與 Continue | 已有可玩基線，持續補齊驗收細節 |
| Gate 選擇、裝備、狩獵、捕獲與返回 | 已整合主要流程，觸控與實機驗收仍持續 |
| 商店、籠子編輯與牧場顯示 | 已整合；完整遮擋、角色接地與長時間遊玩驗收仍持續 |
| 自由對戰、密碼對戰、連線流程模擬與冠軍賽 | 已有多個可玩流程，完整玩家隊伍與長期進度仍部分完成 |
| 原創美術、片頭、音樂與特效 | 已接入核准的公開試玩批次；仍有素材替換與實機／視聽驗收待完成 |
| 商業發布 | 尚未完成整體品質與權利驗收，公開試玩不等於正式上市 |

本專案的公開頁面是 Owner 核准的開發中試玩版，不代表整體遊戲、第三方權利或商業版本已完成驗收。
