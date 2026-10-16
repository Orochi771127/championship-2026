# 場景 BGM 選單與分類（2026-10-16，待整合候選）

本批依 Owner 要求，將三首原始 MP3 加入可選配樂，並在既有「設定 → 聲音」提供育成與對戰兩組選擇。中文語系只顯示中文歌名，英文、日文、泰文及越文語系只顯示英文歌名，不同時並排中英。曲目 ID 與顯示名分離；切換語言不重設選曲，也不重啟同一首歌。

## 不變的邊界

- 沿用單一 audioBus、最多兩個 streaming music 音源、原有滑桿、靜音、手勢解鎖與背景暫停。不新增音訊播放器或額外試聽音源。
- 「依場景預設」保留原先育成／教學、一般對戰／決賽的分配。既有 14 個 cue、19 個編碼檔案與它們的 runtime 路徑、音量及剪裁參數不改。
- Raising 選擇只作用於育成首頁與飼育場編輯，包括教學。Battle 選擇涵蓋一般對戰、決賽與同一 transport 的資料競技場。
- 標題、開場影片的刻意靜音、探索 biome、系統頁，以及勝／敗／平手短句不被選曲覆蓋。結果仍依每次 attemptId 去重，不變成循環歌曲。
- raisingMusic、battleMusic 是 account 範圍的 UI 偏好，仍存在既有本機 preferences 文件，並非遊戲進度。原存檔鍵、遊戲數值、RNG、模擬時鐘及玩家存檔均未改。
- 原生 radio／fieldset 沿用設定頁的鍵盤、焦點恢復與觸控設計。既有試聽按鈕明確標為「試聽音效」，不冒充 BGM 試聽；選擇目前場景的新曲即可經原 transport 淡接。

## 完整分類與名稱

名稱是可修改的產品顯示文案，不宣稱是作者標籤、檔案內嵌資訊或最終核定譯名。三首新增曲的中文暫用提議名稱，仍可由 Owner 改名。

| 穩定 ID | 中文顯示名 | 非中文語系顯示名 | 類別 |
|---|---|---|---|
| core | 中央輝光核心 | Central Radiant Core | 系統 |
| mystic | 東方秘境群山 | Eastern Mystic Mountains | 探索 |
| moon | 空靈月湖畔 | Ethereal Moon Lakefront | 育成、探索、系統 |
| lofi | 林卡拉慢拍 | Linkara Lo-fi | 育成、開場 |
| login | 啟程之頁 | Login Page | 標題 |
| plains | 北境翠綠平原 | Northern Verdant Plains | 探索 |
| forge | 東南熔爐丘陵 | Southeast Forge Hills | 探索 |
| harbor | 南方港灣樞紐 | Southern Harbor Nexus | 探索、系統 |
| tidal | 西南潮汐邊境 | Southwest Tidal Frontier | 探索 |
| battle_normal | 錦標賽對戰 | Championship Battle | 對戰 |
| battle_final | 錦標賽決戰 | Championship Final | 對戰 |
| victory | 勝利之聲 | Victory | 結果短句，不可選作循環 BGM |
| defeat | 敗北之聲 | Defeat | 結果短句，不可選作循環 BGM |
| draw | 平手之聲 | Draw | 結果短句，不可選作循環 BGM |
| a_quiet_evening_training | 靜夜修練 | A Quiet Evening Training | 育成 |
| unison_under_fire | 烽火同心 | Unison Under Fire | 對戰 |
| federation_siege | 聯邦圍城 | Federation Siege | 對戰 |

14 首原曲的音檔來源及既有量測沿用 `assets/production/original-music-r1/manifest.json`；新的 3 首逐檔 SHA-256、時長、44.1 kHz／雙聲道資訊及參數記於 `assets/production/scene-music-r1/manifest.json`。新增 runtime 路徑按 raising／battle 分類，不搬動既有檔案。

## 原檔保全與音量

三首新增 MP3 與 Owner 專案 music-intake 中原檔 SHA-256 相同，沒有轉碼、重輸出、標籤修改或音訊生成。FFmpeg 僅分析到 null 輸出；runtime GainNode 對應既有約 −24 LUFS 目標，依量測採 −11.7 dB／−11.7 dB／−11.5 dB。保留完整首尾，採 0.8 秒循環淡接。這是保守技術參數，不等同耳機或手機揚聲器的聽感驗收。

同時補強延遲 resume promise 的生命週期：若期間切到背景、靜音或換場景，晚到的續播結果不可重新發聲；重複續播也不疊加請求。

## 驗證界線

本地聚焦測試包括既有 original music、設定與新增 scene music。測試涵蓋 17-cue／19 舊編碼完整性、三首 MP3 逐位元雜湊、五語顯示、舊偏好及未知 ID 回退、偏好保存與 reset 不碰進度、手勢前零音訊載入、音量／靜音、同曲不重啟、背景與 pagehide／pageshow、延遲續播與快速切曲、最多兩音源及清除、選曲錯誤後恢復、資料競技場共用選曲與結果去重。實際結果由整合回條記錄，不將本文件代替 CI 或瀏覽器證據。

仍待整合後正常瀏覽器流程、五語小螢幕與鍵盤／觸控焦點、真正 MP3 解碼、淡接／循環聽感、實體 iOS／Android，以及正式中文名稱確認。不宣稱已部署或已完成商業權利驗收。

另發現既有資料競技場每次 openDataArena 都將 matchId 重設為 0，但同一 transport 的 playedResults 跨開關存在；重新進場可能重用 arena-result:1。這是本批前已存在的結果短句 ID 問題，獨立記錄，不併入選曲修改。
