# 原創開場漫畫 R2 本機接入

Owner 經 parent 確認已下載 R2 並授權接入。實際來源 `C:\Users\User\Downloads\OPENING_ORIGINAL_COMIC_R2_20261010.zip`，11,891,842 bytes，SHA256 `da5f15fe529d98f88b307d70b8215b8275ee91f0a65109184f71a84cf78f17f6`；Library ID `libfile_2eff4aeb18c081919a4f4a84fe1f4102`。整包 CRC、所有安全相對路徑及五張 PNG 的 SHA／尺寸／bytes 均通過。未重試 Library 拒絕或使用 R1。

## 實際引用與容量

Runtime 只載入 `assets/production/opening/original-comic-r2-20261010/` 下的五張 WebP，manifest 同目錄。母 PNG／原始 manifest／README 保留在 repo 外 `R:\Projects\Championship2026\opening-comic-r2-20261010\source`，來源 ZIP 亦保留。

| 圖 | WebP px | bytes |
|---|---:|---:|
| 01_arena | 640×640 | 133,966 |
| 02_blaze_action | 560×640 | 106,768 |
| 03_cloud_action | 640×480 | 75,224 |
| 04_partnership | 549×768 | 142,718 |
| 05_invitation | 768×768 | 97,420 |

五張 runtime 圖總計 **556,096 bytes（543.1 KiB）**，原 PNG 合計 **12,120,304 bytes**。使用完整畫面等比 Lanczos 縮小、WebP quality 86；沒有裁切、重畫或拉伸。編碼後與正常手機截圖已目視比對，保留原圖內容，這不是無損 RGB 宣稱。

01／02／03 接第一卡三格，04 第二卡，05 第三卡，第四卡仍只有收信文字。移除幾何占位的可見內容，第一卡改不重疊的三格，以免下格蓋住前格腳部。所有圖片 `object-fit: contain`；image-rendering 的 auto 只套此漫畫元素，未改底欄或像素素材的全域取樣。五語文字、brandTerms、原有分段顯示／捲動／点按／Enter 行為留在 DOM；卡片狀態機與帧序未改。

圖中角色及訓練員是敘事示意，未當成玩家固定 avatar，未加入蛋到 OC035／OC049 的孵化 mapping。母 PNG 的第一張 hash 為 `06f7915a029f750ebcb9c0a2c9d7ef46676048a6d1b46e5117b26c7969b4fe6f`，確為修正腰胯／站姿的 R2。其他四張依 R2 manifest 核對；未藉此宣稱另行驗證過 R1 包。

## 有界驗證

19 項相關測試通過：原作自動／點按故事 frame 序、開場命名、八蛋選擇／教程基底隔離、五語待定品牌。Chrome 正常 URL、全新隔離 context，繁中、泰文、越文分別檢查 390／360×844、DPR2，共 24 個卡片版面；五圖均 HTTP 200 且只有 WebP 請求，沒有缺圖、幾何占位、圖框互相遮住、文字水平溢出或圖片擠出卡片。

點按及 Enter 可跳過當段剩餘等待並繼續；原流程沒有新增一個「跳過全故事」功能。三語皆走到第四卡→郵件→訓練員命名。繁中另完成八蛋選7→蛋命名→蛋時教程邀請→拒絕→育成，確認原有順序保留。首次 QA 用超過原有五字限制的名字导致測試斷言失敗，已只修正測試資料為 `Egg`；未修改產品姓名規則。

已目視 PNG 原圖及手機內五張轉碼圖，包括 360 泰文長段／390 越文；沒有新增裁掉耳朵、腳或拉伸角色的處理。保留來源圖本來的構圖邊界。沒有宣稱實體手機、母語者審稿、全遊戲或正式發布驗收。

詳細截图／三語 RESULT 位於 `R:\Projects\Championship2026\opening-comic-r2-20261010\browser`，機器回條 [VALIDATION.json](VALIDATION.json)。此前 CM03/CM24 成果見 [同批前景報告](../cm03-foreground-2026-10-09/REPORT_ZH_TW.md)。

## 安全

同一分支／HEAD，沿用既有8766伺服器，不開新服務。未 commit、push、merge、checkout、reset、部署或刪除；未碰玩家存檔、底欄文字修復、可走網格或角色／地圖母檔。Library 交接走 Owner 已完成的本機下載，沒有權限繞過。母圖及 runtime metadata 的 publication / shippingReady 仍為 false，接圖不等於發布授權。
