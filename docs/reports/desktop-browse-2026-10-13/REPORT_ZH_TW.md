# 桌機商店／圖鑑橫向配置（2026-10-13）

起點：乾淨隔離工作樹 `fix/capture-raising-recovery-20261013`、`892c6d26a63e3c9a94678ad6e8931ad97cd225fc`；遠端 main 同 SHA。Owner 主資料夾本機 main 是另一個 `94207e6e` 快照，未切換、reset、stash 或移動。既有桌面牧場／片頭／覺醒體不重做。

改前兩種風格的 1366×768 畫面被共享直向外框縮為約432px；商店已有雙欄CSS但無法啟用，圖鑑選條目後隱藏列表。見 [改前量測](before/browser-summary.json)、[現代商店](before/warm-shop-1366.png)、[現代圖鑑](before/warm-database-1366.png)。

- 共享 `portraitFrame.js` 僅開放可見 SHOP／DATABASE 的 ≥1024×420 桌機配置，使用現有畫面標記與 observer。其他畫面、手機和牧場既有門檻保留。
- 商店沿用既有雙欄，整體上限1200px。詳情、商品列表各自可捲動；桌機品名可換行、短高畫面縮減標頭／預覽空白，購買／返回固定可達。手機維持原有橫向貨架與箭頭。
- 圖鑑並排現有列表與所選詳情；修正桌機條目誤套商店150px最小高度。穩定列表DOM保留焦點與捲動；關閉後顯示並聚焦原條目，欄數變動時讓該條目仍在可視區。resize保留選擇及既有姓名輸入框；手機維持先列表、後詳情。
- Escape沿用同一返回意圖；牧場掛載完成後回到原 System 選單按鈕。監聽在現有 view dispose 清除。沒有第二 app／router／store／save／Pixi／ticker，沒有素材與遊戲資料變更。

依據依序為現有共享外框與 DOM 實作／改前瀏覽器量測 → 本輪 Owner 配置與驗收要求 → 最小呈現調整。沒有以當前UI推論原作；圖鑑註冊／編號／內容、價格／經濟、存檔及對戰規則未修改。來源：`portraitFrame.js`、`vs4Screens.js`、`vs2Styles.css`、`main.js` 既有掛載流程、architecture、Owner direction、WEB_BUILD_INPUTS；只更新5筆既有產品核准hash，沒有新增發布素材選擇。

已完成的驗證：

- 聚焦43/43：既有外框與牧場門檻／observer回收、商店118筆身份及價格／庫存不變、圖鑑登錄／編號／存檔及五語呈現相關回歸。
- 正式 `test:ci` 1761/1761、0 failed／skipped。首次sandbox執行是1760 pass／1 fail，原因為測試內部伺服器的loopback連線遭 `EACCES`；允許loopback的必要重跑全部通過，沒有放寬測試。
- 正式 `build:playtest`／`validate:playtest` 9374檔；build ID `3892e19fae0ebcb3fb7fe0ae1067446fbbb380c7da01097a0f6df6e818227e42`。`validate:preload` 272 startup modules通過。原有esbuild自動產生共用chunk，沒有加入runtime套件或另一個模擬authority。
- 正式artifact的100個配置情境：現代／復古 × 繁中／英／日／泰／越 × SHOP／DATABASE × 1366×768／1366×480／1024×420／390×844／回1366×768；20組操作驗證商品選擇／鍵盤、貨架與列表捲動、關閉／Escape／返回System焦點、手機detail焦點、姓名輸入框resize與值保留。沒有pageerror、缺檔或水平overflow；返回控制均可達。見 [完整量測](after/browser-summary.json)。
- 自審 `git diff --check`、核准hash僅5筆變更、DOM監聽回收及正常入口；人工開圖核對 [現代圖鑑](after/warm-zh-Hant-database-1366x768.png)、[復古泰文短高商店](after/classic-th-shop-1366x480.png) 與前後配置。沒有以這些結果宣稱圖鑑資料擴充或新原作接受。

此報告是提交前的驗收快照；發布以本輪最終回報及本機 `.tmp/desktop-browse-publication.json` 的精確SHA／CI／Pages／公開bytes紀錄為準。本機成功不代表發布成功；不為容量警告刪素材、降畫質或遷移部署。

QA使用全新 Chromium contexts、獨立暫存 storage，所有請求攔截並由本工作樹／正式artifact提供。URL採既有公開路徑形狀以選中正式核准素材，實際不連線公開站、不使用Owner 8732、不讀寫Owner瀏覽器存檔。已有全QA fixture由正常 LOGIN／Continue及工具列進入兩畫面；沒有直接寫入應用程式模型。真實硬體／Safari驗收不在此受控瀏覽器結果內。
