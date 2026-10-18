# Podium Geometry 存檔與最小播放器補強

## 已完成：來源保存與量測

- Downloads 原檔：`C:\Users\User\Downloads\podium_geometry.mp3`，保留未刪除。
- R 槽原檔：`R:\Projects\Championship2026\new-game-fixes-20261010\music-intake\podium_geometry.mp3`。沿用既有私人來源目錄，原樣複製、不覆寫；兩邊 SHA-256 同為 `f149580019ec9fd123b52e7fc0824cd6612874a5571e5632995d77531edbeb12`，1,442,442 bytes。
- 遊戲候選：`assets/production/scene-music-r1/system/podium_geometry.mp3`，位元相同。
- FFmpeg／ffprobe 實測 59.846458 秒、44.1kHz 立體聲；-12.16 LUFS、+0.60 dBTP、LRA 6.6，解碼成功。逐曲 gain -11.9 dB，預估 -24.06 LUFS／-11.30 dBTP，並非來源失真已修復的證明。
- 沒有採用參考說明的 120 BPM、8 秒起點或 56 秒終點；BPM 未驗證。保守保留全曲，0.8 秒既有線性交叉淡化。原生立體聲硬接點樣本差約 -117.13 dBFS；交叉淡化數值模擬保存在 `SIGNAL_AUDIT.json`。這不是實際裝置錄音，也不是無縫聽感通過。

## 已完成：頁面接線

本批依「調整牧場設施位置」用途，將使用者說的「場地設置」對應到 `CAGE_EDIT`：`championshipToolbar.js` 的管理選單進入 `vs4Screens.js:createCageEditView`，畫面實際標題為「設施配置」。程式中未找到另一個字面叫「場地設置」的獨立頁面；先前回報的「設施設置」並非正式介面名稱。`main.js:syncMusic` 原本即把此畫面送入 raising 選曲類別，無需新增路由或播放器。

`selectOriginalMusic` 的 CAGE_EDIT cue 改為 `podium_geometry`；`resolveSceneMusic` 在「依場景預設」時保留此 cue，RAISING_HOME／育成教學仍為 `a_quiet_evening_training`。玩家明確 raisingMusic 選曲仍優先。新曲亦出現在既有 raising 選曲清單，沒有新增設定存檔欄位。

原九首交付是封閉的歷史 cohort，九首清冊與音檔雜湊保留；六場地及兩 Data Arena 指派不改。加上這首後，目前全庫為 24 cues／29 編碼檔；只追加新檔量測，沒有重新判定舊曲聽感。

## 已完成：沿用架構補強

仍是最多兩個 HTMLMediaElementSource、同一 AudioContext／audioBus，沒有整庫 AudioBuffer、純合成替代歌、分軌系統或第二遊戲 ticker。

1. 循環前最後三秒才預載第二個串流，保持 paused 與零 gain；接點重用已預載來源，不重新 load。保留實際 trimEnd 計算，沒有套用未證實的 8–56 區間。
2. Gain ramps 由 `AudioContext.currentTime` 排程；可用時以 cancelAndHoldAtTime 連續承接。JS timeout 僅喚醒檢查，根據真實媒體進度與音訊時鐘決定循環或尾音回收；clock suspended／interrupted 不可憑牆鐘開始新 loop 或提前移除 fade 尾音。緩衝／seek 後重新對齊媒體進度。
3. 世代編號與 request serial 持續管理 pending／current／prepared，所有仍在淡出的來源保持追蹤到實際 audio-clock fade 完成或生命週期明確取消。hidden、mute、dispose 取消預載與排程，舊 promise／timeout 不得使過期路由勝出。
4. 新曲載入失敗時保留仍有效的舊曲；保留 error／retryable 狀態並提供 `retry()`，既有真實使用者 gesture 亦可重試。不偷偷換另一首曲目。
5. 原生 context statechange 也會暫停並保留位置，running 後重新啟動一次排程。恢復保留 1x rate、pitch 與既有 20ms 淡入；移除 listener 後才 dispose。
6. 既有 medal／evolve／versus 是可用的重大事件入口，透過 bus output 小幅 duck BGM：-4 dB、25ms attack、300ms release，音訊時鐘排程，獨立於玩家 master／musicVolume。重疊 cue 以 lease 管理，停止其中一個不得清除另一個；不改戰鬥計算。普通 capture／reward 不濫用 ducking。

HTMLMediaElement.play 本身不提供 sample-accurate startAt。這份最小版本改善緩衝與時鐘控制，但沒有把串流切換誇稱為取樣級無縫；真正接縫、網路 stall、輸出路由與 iPhone 音訊策略仍需裝置驗收。

## 驗證與發布狀態

- 新曲／路由／時鐘／重試／原生 statechange／ducking 新增 9 項回歸，連同既有相關測試 **96 PASS，0 FAIL**。
- 舊九首原檔 SHA、育成首頁／教學預設、玩家選曲、切頁 source 上限、mute、hidden、dispose、delayed promises 均覆蓋。fake clock 測試明確讓 JS timer 先醒而 audio clock 不前進，驗證不提前截尾。
- 瀏覽器測試已加入十首原始 MP3 實際解碼、CAGE_EDIT 預設／返回靜夜、mute／pagehide-return、404 保留舊曲與重試恢復、正常 UI 管理選單進出；真實執行結果另行記錄，不把 self-test 或 fake transport 稱為瀏覽器通過。
- 本批以 main `fa09a6cf0` 為基底的獨立副本實作，不改其他任務未提交內容；發布 inputs／allowlist／來源 manifest pins 只按本批路徑更新。
- **目前是本機整合候選，尚未由本任務發布。** 由單一 main 整合者處理後續正式檢查／公開驗證，不能先稱線上完成。
- 尚未完成真人試聽、BPM／音樂風格判定、無縫聽感、實體 iPhone Safari／主畫面 PWA 音訊路由驗收。未加入未知來源軟體或付費服務。
