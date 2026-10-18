# 音樂修復與完整配樂盤點（2026-10-18）

育成的「依場景預設」統一為 `a_quiet_evening_training`（靜夜修練），涵蓋首頁、棲地編輯與互動教學。沿用既有 `raisingMusic` 偏好文件；有明確選曲的玩家保留原選擇，缺少／過期／default 值採新預設。不更動進度存檔。

## 戰鬥與新模式

| 實際場地／模式 | 預設 cue | 原檔 |
|---|---|---|
| 島嶼 BM04／arenaIndex 3 | titan_s_final_strike | scene-music-r1/battle/titan_s_final_strike.mp3 |
| 南極 BM05／4 | south_pole_siege | scene-music-r1/battle/south_pole_siege.mp3 |
| 沙漠 BM06／5 | mirage_of_the_arena | scene-music-r1/battle/mirage_of_the_arena.mp3 |
| 地獄 BM08／7 | inferno_overdrive | scene-music-r1/battle/inferno_overdrive.mp3 |
| 港灣生存 HARBOR | unison_under_fire（烽火同心） | scene-music-r1/battle/unison_under_fire.mp3 |
| 新模式錦標賽 TOURNAMENT | federation_siege（聯邦圍城） | scene-music-r1/battle/federation_siege.mp3 |
| 一般／草原／火山／電腦空間／競技場／體育場／巨蛋 | battle_normal | original-music-r1/championship_battle_normal_r1.ogg，Safari不支援時同曲 m4a |
| 傳統錦標賽最終輪（實際巨蛋場） | battle_final | original-music-r1/championship_battle_final_r1.ogg／m4a |
| 勝／敗／平手 | victory／defeat／draw | 同名 original-music-r1 短句，單次播放，非循環 |

一般場地映射由真正 `chosen.arenaIndex` 決定，涵蓋練習、自由、密碼與連線對戰。傳統錦標賽畫面強制巨蛋，音樂也按實際畫面處理。保留玩家主動設定的 `battleMusic` 覆寫；「依場景預設」恢復上述分配。教學使用實際 runtime 的 chosen match。模式選擇、說明、比賽、暫停、升級共用同一模式曲；港灣 GUARDIAN 和錦標賽 final 階段維持各自模式曲，不再跳回通用曲；結算仍用勝敗短句。

兩首新模式分配是 Owner 明確委派的可逆產品決策：港灣有同伴並肩生存，採 Unison；連續對手的錦標賽採 Federation。參考檔名／曲目名稱、玩法與量測（原曲分別 -12.35／-12.54 LUFS），沒有真人試聽，不能宣稱已核准節奏或氛圍。集中設定在 `DATA_ARENA_MUSIC`，可直接互換。

草原、火山沒有在目前 main、現有音樂目錄或場景設定找到先前專屬指定檔；保持舊有通用戰鬥曲，不以探索草原／熔爐曲冒充戰鬥指定曲，也不擅自生成替代。

## 音訊技術檢查

`MEASUREMENTS.json` 記錄全部 26 個編碼檔（21 cues）的 SHA-256、時長、取樣率、LUFS、真峰值、LRA、頻帶能量及播放增益。FFmpeg 9 為既有本機工具；原檔完全保留，無轉碼、變速、變調、濾波或付費服務。

舊曲原有 +6 dB 上限導致 mystic／lofi／forge／tidal 播放約 -27.36／-30.59／-25.62／-27.45 LUFS。本次逐曲改為 +9.3／+12／+7.6／+9.4 dB，播放約 -24.06／-24.59／-24.02／-24.05 LUFS，仍保留至少約 8 dB 的單曲峰值餘裕。新曲原始真峰值最高 +1.4 dBTP，以各自 -10.7 至 -11.7 dB GainNode 減量；不讓原始 MP3 峰值直接送到最終輸出。這些是單曲增益後的推算值，不是喇叭端量測，也不能證明來源沒有原生失真。

所有曲目已解碼量測，未見 FFmpeg 解碼失敗。高頻以頻帶相對能量篩查，沒有用高頻能量直接判定「刺耳」；沒有足夠聽感證據支持哪段應削減，所以未做一律低通或任意 EQ。原先 0.8 秒淡接與原有已量測的邊緣裁切保留；原生 OGG 循環保留。循環爆音、底噪、手機喇叭與耳機音色仍需匹配響度試聽。

## 前後台生命週期

現有 BGM 是兩個上限受控的 HTMLMediaElementSource，沒有重建 AudioBuffer、手動指定取樣率、BGM detune 或第二個 AudioContext。原匯流排只處理 suspended，會漏掉 iOS Safari 的 interrupted；現在兩者都恢復。同曲回前台即使 media 顯示仍在播放，也獨立恢復共享 graph。沿用原位置與來源，不重新解碼／重建 graph。來源建立、換曲與恢復時固定 defaultPlaybackRate／playbackRate 為 1，支援時啟用 preservesPitch。診斷增加 contextState、sampleRate、播放率。

受控回歸反覆 12 次 visibilitychange、pagehide/pageshow，交替 suspended／interrupted，核對一個 context、一個有效曲目、同位置、1x 速率、音量一致及無疊加。這是防護和可重現缺口的修復，不是已證實 iPhone 音高漂移的唯一根因。

參考：[MDN AudioContext state / iOS interrupted](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state#resuming_interrupted_play_states_in_ios_safari)、[HTMLMediaElement preservesPitch](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch)。

## 需補歌的短清單

完整目前路由見 `ROUTING.json`／`BGM_INVENTORY.csv`。既有頁面在預設路由均有共用／專屬曲或明確沿用；必要新增原創歌曲 **0 首**。四首已交付的場地曲屬「待接線」，已在本批接線，不應重新製作。設定是 overlay，沿用來源頁；商店／圖鑑已配置，不必一頁一首。

尚未配置「專屬」曲的戰鬥場地共有 7 個，仍有通用曲可播放。草原、火山為兩個歷史指定待核對項，先確認舊交付再決定是否重做；其餘 5 個場地可選擇沿用通用曲。這 7 個不等於 7 首必做曲。

若 Owner 想擴充特色，去重後建議最多先做 **3 首、均非阻擋項**：

| 用途 | 氛圍 | 循環需求 |
|---|---|---|
| 草原戰鬥（先查既有交付） | 開闊、有推進感，避免過尖金屬高頻 | 約 90–150 秒，無人聲，尾首可淡接 |
| 火山戰鬥（先查既有交付） | 厚重、熔岩壓迫與戰鬥節奏 | 約 90–150 秒，低頻留混音餘裕，尾首可淡接 |
| 電腦空間戰鬥 | 俐落電子脈衝、空間感 | 約 90–150 秒，無長停頓，尾首可淡接 |

商店、圖鑑、設定可繼續用現有 harbor／moon 或當前頁面曲。一般場地／競技場／體育場／巨蛋可共用既有 normal／final，無需再加四首。此清單未授權自動生成歌曲，也未開啟付費服務。

## 驗證與限制

音樂／偏好／路由／生命週期與逐曲增益 41 項通過，合併新模式後的受影響回歸共 92 項全過。完整 CI 初跑 2,599 項，2,593 過／6 失敗：4 個啟動失敗注入測試缺少新增匯入依賴，已補入真正選曲函式並在 92 項回歸通過；另 2 個為沙箱禁止 symlink 與 loopback，需在正式驗證環境重跑。公開建置與線上版本結果另附發布收據。沙箱網路無法連 GitHub，Playwright 的本機 Chromium 啟動也被環境拒絕（0xC0000022）；沒有要求額外權限。已與獲授權的 main 發布任務協調，由同一整合流程執行剩餘瀏覽器與公開部署檢查。

尚未完成：真人匹配響度試聽、真機 iPhone Safari／主畫面 PWA 背景返回與切換音訊輸出裝置驗收、來源本身刺耳／底噪的主觀判斷。不能把程式回歸或部署成功稱為上述聽感通過。
