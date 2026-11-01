# 一般場地對戰 BGM 更換：Clash at the Concrete Edge（2026-11-02）

## Owner 指示

> 這一首請用在對戰中的一般場地，然後請用適合網頁遊戲的音樂品質，目前一般場地中使用的那個BGM就不要再使用了那首剔除

## 變更

- 新曲 `assets/production/scene-music-r1/battle/clash_at_the_concrete_edge.mp3` 成為 `battle_normal` cue 的音檔。cue ID 不變，所以存檔中的 `battleMusic` 偏好、`selectOriginalMusic` 路由與資料競技場的預設 cue 都不用遷移。
- 舊的 32 秒 `original-music-r1/championship_battle_normal_r1.ogg` 與 `.m4a` 已刪除，並從 `original-music-r1/manifest.json` 的 `files`、`cues`、`compatibleEncodings` 移除，改記在 `retired`。
- 設定畫面的曲名由「錦標賽對戰 / Championship Battle」改為「石緣交鋒 / Clash at the Concrete Edge」。中文譯名可再調整。
- 播放路由：一般場地（arena 0）會播新曲。arena 6、8、9、10、錦標賽非決賽回合、練習賽和未知的資料競技場模式原本都用同一個 `battle_normal`，所以同樣改播新曲，舊曲不會再出現在任何地方。

## 網頁音質處理

| 項目 | 原檔（Downloads） | 遊戲用 |
|---|---|---|
| 格式 | MP3 192 kbps | MP3 128 kbps CBR（LAME），44.1 kHz 立體聲 |
| 長度 | 182.857 s | 180.011 s |
| 大小 | 4,394,697 B | 2,881,453 B |
| 整合響度 | -11.4 LUFS | -12.88 LUFS（loudnorm） |
| True peak | +0.5 dBTP | -0.86 dBTP |

- 去掉開頭 0.1 秒與結尾 2.75 秒的靜音。原曲在 180.1 秒以全音量結束，之後才是靜音，去掉後循環接縫不會有空白。
- 編碼前先降 1 dB，避免有損編碼溢位。中繼資料已移除。
- 執行時增益 -11.2 dB，投射響度 -24.08 LUFS，投射 true peak -12.06 dBTP，與其他循環 BGM 的約 -24 LUFS 一致。
- 循環方式與其他場景 MP3 相同：0.8 秒交叉淡入。舊 OGG 用的是原生 loop，crossfade 為 0。
- 選 MP3 而不是 OGG + M4A 雙檔：所有瀏覽器都能播，只需要一個檔案。

## 量測與驗證

- `docs/reports/music-repair-2026-10-18/MEASUREMENTS.json`：刪除舊 OGG/M4A 兩列，新增量測遊戲用編碼的一列（29 → 28 列）。頻譜欄位由本批次腳本計算，使用 22,050 Hz 單聲道、4096 點 Hann 視窗；頻帶劃分為 low 20–250、mid 250–2000、presence 2000–5000、high 5000–11025 Hz。這些數值只供參考。
- 發佈合約 `WEB_BUILD_INPUTS.v1.json` 和 `PUBLIC_RUNTIME_ALLOWLIST.v1.json`：換掉舊檔列並加入新檔，兩個 catalog 模組的雜湊也已更新。
- 尚未做人耳試聽驗收。
