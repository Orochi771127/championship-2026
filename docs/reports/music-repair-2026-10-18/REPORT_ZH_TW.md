# 音樂修復與實際路由（2026-10-18）

育成「依場景預設」統一為 `a_quiet_evening_training`（靜夜修練），涵蓋首頁、棲地編輯及教學。玩家自行選曲保留；缺少、無效或 default 使用新預設，不遷移遊戲進度。

## 確切九首交付

六首場地曲、兩首共用／新模式曲、一首育成曲，共九首。其中靜夜修練、Unison、Federation 在基底 `19c91ac8` 已有 manifest、cue 與音檔，已逐一比對歷史 Git blob SHA-256，不能稱為九首新增。NS33 不屬於這九首，不再搜尋第九首，也不要求新增創作。

`NINE_TRACK_LEDGER.json`／`.csv` 記錄用途、歷史證據、原檔雜湊、runtime 路徑、R 槽核對與公開驗證狀態。準備本批時 R 已有七首且雜湊全符；草原、火山兩首由發布者正常同步 R 後補驗。

| 場地／模式 | 預設 cue |
|---|---|
| 草原 BM02（1） | clash_at_the_emerald_edge |
| 火山 BM03（2） | magma_breach |
| 島嶼 BM04（3） | titan_s_final_strike |
| 南極 BM05（4） | south_pole_siege |
| 沙漠 BM06（5） | mirage_of_the_arena |
| 地獄 BM08（7） | inferno_overdrive |
| 港灣生存 HARBOR | unison_under_fire |
| 新模式淘汰賽 TOURNAMENT | federation_siege |
| 育成首頁／編輯／教學 | a_quiet_evening_training |

草原／火山映射依 Owner 2026-10-16「第一個是草原，第二個是火山」及連續兩個原檔路徑的可信歷史證據。兩首經授權 Drive connector 下載，來源保留，複製位元完全一致。其餘四場地保留已確認指派。兩首新模式分配由 Owner 委託產品決策，依名稱／玩法／量測選擇，未宣稱真人試聽。模式選擇、簡報、遊戲、暫停、升級一致；結果仍使用勝敗短句。

一般戰鬥讀取實際 `chosen.arenaIndex`，涵蓋練習、自由、密碼及連線。傳統冠軍賽畫面為巨蛋（10），音樂與畫面一致，最終戰保留 `battle_final`。玩家指定 `battleMusic` 仍覆蓋循環曲。

## Owner 更正：查漏接線，不能推論缺少創作

先前「七場地沒有專屬曲」與新作曲建議已撤回。程式目前共用只代表尚未證實原定路由，不能代表 Owner 沒交歌。

本批補齊草原、火山後，一般 BM01、電腦空間 BM07、競技場 BM09、體育場 BM10、巨蛋 BM11 共五場地目前仍使用既有 `battle_normal`（傳統最終戰 `battle_final`）。路由帳標為「專屬映射待查（現有共用曲不是完成配置）」。未經可信證據不猜配、不新增替代歌曲，也不把可播放等同原定配置完成。

## 已完成的技術修復及其限制

`MEASUREMENTS.json` 涵蓋全部 28 個編碼檔、23 cues：19 個既有音樂／短句編碼與這九首 scene MP3。全部 FFmpeg 解碼成功，記錄雜湊、LUFS、true peak、LRA、頻帶比例、邊緣峰值。FFT 僅作篩查，不能由能量比例判斷刺耳或底噪。

四首舊曲原 +6 dB 上限使 mystic、lofi、forge、tidal 偏小，分別調為 +9.3、+12、+7.6、+9.4 dB，使循環曲預估響度集中於約 -24 LUFS。草原原 -11.55 LUFS／+0.74 dBTP，播放增益 -12.5 dB；火山原 -11.66 LUFS／+0.58 dBTP，增益 -12.4 dB，預估 -24.05／-24.06 LUFS、-11.76／-11.82 dBTP。其他曲也有逐曲增益與餘裕。

這是播放音量一致性及峰值餘裕修復，不能修復已存在於來源的削波，也不能宣稱已消除刺耳、雜音或所有爆音。原檔全部保留，未改速度／音高，未轉碼、全面低通或激進降噪。既有 MP3 trim 與 0.8 秒交叉淡化保留，OGG 原生循環保留；聽感接縫仍待匹配響度試聽。更細的逐曲削波／高頻／接點客觀檢查及比較材料另行補交。

前後台恢復涵蓋 Safari `interrupted` 與 `suspended`，保持同一原生採樣率 context、來源及位置。建立、開始與恢復時固定 playbackRate／defaultPlaybackRate 為 1，啟用可用的 preservesPitch。可重現測試含 12 輪 visibilitychange、pagehide/pageshow，不新增 AudioBuffer、第二 context 或手動重採樣。這不等同已證實 iPhone 變調唯一根因。

## 驗證與公開狀態

main `929f07cd71c6eb931275155e804ec4ae23977c45` 的 Pages `39103802631` 已成功。發布者實際 Chromium 20 layouts、七首 MP3 解碼、30 transport 與正常 Raising／Practice／DataArena 流程通過；獨立 CI 一項舊音效 async 等待時序 flaky，發布者已補事件等待並跑 12 focused PASS，待併本批。

本批草原／火山待發布者完整門檻、實際九首解碼、公開位元／路由及 R 槽兩首雜湊驗證。發布及 R 寫入由同一已授權整合者執行，保留圖鑑、圖示、內頁修正。

仍未完成：真人匹配響度聽感驗收、實體 iPhone Safari／主畫面 PWA 切前後台與音訊輸出路由驗收。不可把技術測試、解碼或部署成功稱為聽感通過。

來源：[音樂資料夾](https://drive.google.com/drive/folders/19nGKhPLO1vZtwaMxRq2rnD6-fXLrlUnW)、[Clash](https://drive.google.com/file/d/1Y1vihOitFGFg7FhIWzkAHRIBoogY4iEb/view)、[Magma](https://drive.google.com/file/d/1lUxavv_4XWZGOtspImvZ1ferQPWcxO1I/view)。未寫入 Drive，原檔保留。
