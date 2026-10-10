# 全幅首頁與14段原創音樂（2026-10-10）

首頁改用 Owner 交付的晨光競技場全幅場景、金色／青綠厚描邊 Logo，以及兩位完整拍檔；保留原 LOGIN、Continue、新遊戲確認、設定與五語流程。音樂涵蓋九首既有原創曲、一般戰鬥／決賽各一曲及勝敗平手各一短句。全部沿用現有應用、screen stack、設定與單一 audioBus，沒有第二個遊戲／音訊權威，也未改戰鬥數值、RNG 或玩家存檔。

## 來源與實作

適用授權、逐場景選曲及驗收界線見 [接入契約](../../contracts/championship/TITLE_AND_ORIGINAL_MUSIC_2026-10-10.md)。四張首頁圖的 lossless WebP 與原 PNG decoded RGBA 相等，來源／逐檔 SHA 見 `assets/production/title-morning-r1/manifest.json`。繁中 Logo 使用現有短版交付圖，其餘四語使用 Owner 最後核定的短標，集中由 `brandTerms.js` 管理並套用同色描邊與立體陰影。首頁主標、document.title 與 aria-label 隨語系同步；已移除舊長副標及年份，不改存檔鍵或專案路徑。英文為 `Cyber Partner: Tournament`。

一次 Logo 進場、拍檔錯開淡入、小光點及場景亮度變化；沒有整隻拍檔持續浮動。減少動態及省電模式關閉動畫。四圖分層保留身體、腳與透明邊界；既有開場漫畫、文字修復、觸控事件與無障礙語意保留。

音樂來源／SHA／暫定增益記於 `assets/production/original-music-r1/manifest.json`。`originalMusicCatalog.js` 只讀現有畫面、biome、chosen match 與 outcome；決賽精確限定 `championship===true && cursor===totalRounds-1`。結果依 winningTeam 與本次 attemptId 去重，短句不循環；退出或重繪不重播同場。

`musicPresentation.js` 以最多兩個延遲建立的 HTMLAudio 音源送入同一 Web Audio music category。手勢前沒有音訊抓取；同曲不重啟，切頁取消過期資源，背景／靜音暫停並保留位置。新 musicVolume 沿原偏好儲存且與 SFX 獨立。九首MP3採首尾低訊號的保守量測與0.8秒淡接；兩首戰鬥原生32秒循環。五個 OGG 各有同曲 AAC 編碼，僅在瀏覽器宣告不支援 Vorbis 時選用，沒有新增曲目。

## 參考影片的實際查看範圍

已從 Owner 指定的 5.448 秒螢幕錄影擷取並逐張查看10張關鍵影格。可見青綠徽章與放射線、厚描邊雙行標題、周邊圖案依序進場，以及白雲和斜向色塊轉場。這支持本批採用分層、錯開進場的方向；未證明逐字動畫或完整待機循環，沒有聽取影片音訊，亦未複製其素材。

## 實際驗證

- 聚焦音樂／設定／五語：49項通過；mandatory CI **1,585／1,585**。七項音樂測試包含手勢／靜音前零抓取、單一context、快速切頁過期取消、最多兩音源、背景續播、同曲保留位置、每attempt結果去重、舊偏好預設、決賽與biome選曲及AAC備援。
- 首頁8組：五語390×844、越文320×568與文字130%、844×390既有橫向框架、減少動態＋省電。圖片完整載入、版面無溢出；正常LOGIN／設定／關閉與無存檔Continue隱藏均通過。已實看繁中主畫面與越文小螢幕截圖。
- 最後短標修正：五語各390／320px共10組，加日文／泰文320px文字130%兩組及設定內即時切換語言，共13項通過；首頁主標與aria-label、document.title均對應核定短標，無舊副標、年份或溢出。已實看日文／泰文小螢幕截圖，沒有遮住角色／按鈕。受影響語系／設定42項重驗通過；先前1,585項完整結果沿用。
- 真實 Chrome 技術播放18個階段：14段逐曲解碼／播放、音量35%保存重載、MP3循環淡接、受控可見性暫停續播、正常LOGIN→開場→命名→選蛋→牧場。音源上限2，媒體volume=1、增益由GainNode承接，page errors／缺檔均0。
- 強制「不支援Vorbis」能力回報後，五個同曲AAC實際解碼播放通過；戰鬥曲32秒、結果短句不loop。這是Chrome控制條件測試，**不是實體iOS證據**。
- 沿既有 `championship-owned-party.html` 隔離測試存檔，正常Continue→工具列參賽→隊伍確認→實際ticker戰鬥→結果→牧場。實際結果為 `TEAM_ONE_AHEAD`／winningTeam1、attemptId=`battle:1`；播放 `battle_normal`→`defeat`一次，逐頁結算不重播，返回後恢復`moon`。未修改戰鬥狀態、傷害、RNG或時鐘。勝利／平手短句另以控制器及實際解碼驗證，不冒充自然流程已打出全部結果。

驗證摘要見 [VALIDATION.json](VALIDATION.json)。完整腳本／量測／截圖保存在 `R:/Projects/Championship2026/new-game-fixes-20261010/` 的 `title-browser/`、`music-browser/` 及CI日誌。

## 發布與保全

先前新遊戲／牧場修復的兩笔 CRLF／LF 核准雜湊問題，已於 `f8836b6f5f4cfd7ba17ac09001b035a4ce4e0943` 修正並公開；CI與Pages成功，線上buildId及六個修復來源檔SHA均已核對。這個首頁／音樂批次的實際提交與Pages成品另由發布回條記錄，不以本機測試代替線上發布成功。

所有工作在隔離副本 `championship-2026-publish-20261010`；原協作工作區不覆寫、不切分支。沒有啟動另一個伺服器，瀏覽器使用隔離context／測試存檔。公開範圍只有指定四圖、14曲及五個同曲相容編碼、manifest與必要程式；製作來源、ZIP、參考影片與備用Dawnward曲不公開。

**保留待驗**：曲目選擇、增益、循環接點及轉场聽感尚未由Owner以耳機／手機揚聲器確認；實體iOS亦未完成。既有橫向portrait-frame縮放予以保留，不將邏輯44px控制尺寸冒充所有實體裝置的觸控驗收。本批不宣稱全部音樂終驗或商業發行權利終驗。
