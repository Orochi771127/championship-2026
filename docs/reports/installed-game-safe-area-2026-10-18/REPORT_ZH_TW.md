# 主畫面 App 遊戲內頁底部空帶（2026-10-18）

Owner 已實機確認首頁底部空帶修好，但回報「遊戲內每一頁都還是會有下面那一欄」（Sentinel_03f6c0af9e308191b3a763cd833092a2）。首頁接受不撤回、不要求重做；本批僅處理內頁共用容器與背景，iPhone 內頁仍由 Owner 實機確認。

## 原因與修改

先前根畫布的背景延伸規則限定 `#cm-title:not([hidden])`，離開首頁就回到原本 html 的 c-void 底色。內頁的共用 screen-height 仍 fallback 到 100dvh；原 portraitFrame 的實測高度只供首頁／部分橫向選單使用。這是 source 已確認的共用缺口，不代表僅靠 Chromium 能證明 iOS compositor 的每個行為。

本批修改兩個 runtime 檔案：

- portraitFrame 讓所有 installed 路由共用 `--cm-app-viewport-height`；沿用既有 resize、visualViewport、pageshow、焦點與路由 observer，不新增 ticker。輸入中採可見視窗，不使用 screen.height 硬造操作空間；縮放與原 390px 橫向邏輯框保持既有契約。
- styles.css 將內頁根畫布改為現有遊戲背景層，延伸到瀏覽器可繪製的安全區；原首頁 Blob 背景條件保留。一般內頁容器沿共用 screen-height 扣除已測得 HUD／工具列；育成與 Data Arena 保持全視窗畫布。只對 installed 且非縮放框的根容器套用高度，不拉伸舊框。Data Arena 根背景跟隨現有深色場地。
- 不移除 footer、toolbar、HUD 的 safe-area padding，不新增 body safe-area padding，因此不會為填縫重複扣兩次 inset。沒有更動遊戲規則、音樂、圖片、圖鑑 mapping、存檔 key／寫入或帳號流程。

設定中的唯讀診斷版本更新為 `PWA-20261018C`，新增目前路由、game root／toolbar 邊界與 appHeight；這次若需實機資訊只回報出問題的內頁，不請 Owner 重做已確認的首頁。

## 驗證範圍

控制器測試覆蓋 17 個遊戲狀態的直橫往返、鍵盤縮小後草稿保留與 dispose 清除。瀏覽器在獨立 context 透過既有 QA 存檔安裝頁與正常選單導覽，不注入 app/router 狀態、不使用 Owner 的瀏覽器 profile 或存檔。使用 393×852、852×393、393×852 與測試用 safe-top=47、safe-bottom=34，記錄各頁根畫布背景、實測高度、容器邊界與橫向溢出，並核對 QA 角色與 roster 身分保持。

這些是 Chromium 的 controlled 驗證，不是 iOS 真機接受。Hunt／Battle 的動態流程與其他實際走到的頁面範圍以本資料夾結果與最終發布收據為準；不因單元狀態列全覆蓋就宣稱所有戰鬥／探索情境均已實玩。

發布前 fetch main，保留 art 任務新增 218–221、223 與 music 任務的獨立更新；不 force push、不合併 PR56。原圖示與首頁已接受規則保持。公開 build/validate/payload、GitHub CI/Pages、線上版本與資產雜湊及 R main 同步，與實機視覺接受分別記錄。
