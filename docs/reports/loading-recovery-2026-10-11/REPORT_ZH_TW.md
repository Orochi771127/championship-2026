# 登入、開場與牧場載入恢復：公開試玩發布集

本紀錄對應基準 `91062c053c4dd460393b54fd99c817c49d96a8ff`。Owner透過parent独立審查R1的16檔與R2替換的6檔後，核准僅這組bytes及必要生成產物／發布紀錄進入既有Pages公開測試版；先完成release gates，再commit/push/Pages。權利、完整原作一致與商業上架不因此完成。

## 玩家可見變更

- LOGIN等待時顯示載入狀態；錯誤／長時間等待可重新載入。五語「進入遊戲」。
- 開場首卡先準備，圖片較慢時可先閱讀文字或返回；原故事順序、計時、命名、選蛋與教學保持。
- 牧場UI先掛載；HUD與可選反應／進化素材不阻塞核心場景。核心60秒期限、取消、同頁重試、保存返回與晚到資源釋放。
- Pixi底層請求可能永久未完成，因此錯誤介面另提供五語「保存並重新載入遊戲」。只有既有 `app.save().phase === SAVED` 才完整document reload；保存失敗留場並顯示既有恢復／匯出提示。不清存檔、不改遊戲數值、只有既有一個App／Pixi／ticker／save authority。

## 發布範圍與生成差異

[逐檔清單](RELEASE_FILES.json)列出16個已審檔及實際發布SHA。只更新既有 `WEB_BUILD_INPUTS.v1.json` 中14個產品檔的核准SHA，其餘9,218個核准項不變；不新增選入素材或變更公開目的地。

必要生成差異限 `championship.html` 的modulepreload區塊：由既有產生器重算257項，補既存進化文字／接觸陰影模組，JSON提示依現行產生器使用 `as="json"`。區塊外逐字元不變，且以同一bundle metadata證明生成前／後公開HTML逐字元相同。其餘15個已審檔與核准bytes相同。生成清單與發布紀錄不代表額外產品實作授權。

## 執行的驗證

- 完整既有 `test:ci`：1,628／1,628 PASS，0 skipped。初次沙箱只有內建臨時loopback測試遭EACCES；允許該連線後原套件全數通過，未放寬測試。
- `build:playtest`／`validate:playtest`：9,291檔；build ID `c86f64390b25ae885266ccfe2d58c728cd27798092ddc0fa3f4592c9e4d6c17d`。
- production bytes於隔離瀏覽器完整New Game → 四卡故事 → 信件 → 空名驗證／命名 → 八蛋／返回 → 命名 → 教學邀請，頁面錯誤及缺檔皆0。
- production bytes讀取先前自然流程的隔離存檔；僅受控攔住一個Pixi圖片，取消後保存並完整reload，經正常LOGIN→Continue重建可玩場景。舊請求未手動完成，新document確實重新請求；教學位置與全部遊戲保存欄位保持。只排除既有updatedAt及兩個revision記帳欄位。
- R2審查時另已驗真實60秒期限＋永不完成請求、保存失敗不reload、五語320px／44px控制，及30項相關回歸。R1的119項檢查與故事最後21項保留原證據，不相加成不重複測試數。
- `git diff --check`、預載清單檢查及精確hash檢查通過。當地只讀取既有相同版本esbuild／Playwright依賴，未覆寫現有node_modules；遠端CI仍依lockfile執行npm ci。

本檔是提交前驗證紀錄；遠端main、CI、Pages、公開build標記／檔案hash與線上正常流程，以同一發布SHA的最終回條為準，不在提交前預稱成功。

## 自然流程與未驗範圍

發布前實際公開自然教學已由玩家輸入完成第一次畫圈、拉扯、手掌觸碰與收入記憶卡，停在 `hunt-second-intro`／message0。原隔離存檔保留，發布後用它正常Continue驗版本升級，不使用fixture代替自然流程。

後半狩獵、Battle、教學結束恢復自己蛋及自由育成仍待後續QA；全物種、全地图、長時間、實體手機、讀屏、音訊聽感及母語者審校未由本批完成。
Gate輔助清單的雙點教學與實際按鈕不符列P2；第二目標「滾球獸」需按实际original species映射查核，不全域替換。兩者均未混入這個發布集。

room／values等工作區及既有untracked保持；未force、reset、clean或覆蓋玩家存檔，未啟動額外常駐遊戲伺服器。新的建置目錄保留既有成品。沒有使用額度重置、購點或自動儲值。
