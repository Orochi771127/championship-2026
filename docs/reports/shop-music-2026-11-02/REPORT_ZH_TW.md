# 商店頁 BGM：Lucky Draw Counter（2026-11-02）

## Owner 指示

> 這首是想要用在遊戲中的商店頁面裡面的BGM
> 請用適合網路網頁遊戲的格式跟音檔

Owner 另外轉貼了 Gemini 的製作提示：120 BPM，0–8 秒是只播一次的前奏，8–56 秒為循環主體。

## 變更

- 新 cue `lucky_draw_counter`，音檔為 `assets/production/original-music-r1/bgm_lucky_draw_counter.mp3`。
- 路由：`SHOP` 畫面原本播 `harbor`（南方港灣樞紐），現在改播新曲。轉蛋在商店畫面內，所以也一起換成新曲。`GATE_SELECT`、`HUNT_LOADOUT` 和海邊狩獵仍播 `harbor`，`harbor` 沒有刪除。
- 曲名：「幸運抽獎櫃檯 / Lucky Draw Counter」。中文譯名可再調整。分類為 `system`，不會出現在設定的養成／對戰曲目選單。
- 播放器（`musicPresentation.js`）：cue 可以指定 `loopStart`。第一次進入從 `trimStart` 播放，之後每次循環從 `loopStart` 接回。其他 cue 沒有 `loopStart`，行為不變。

## 循環點實測

Gemini 的數字經過實測確認，不是直接採用。

| 項目 | 結果 |
|---|---|
| 節拍 | 拍距 0.5004 s，即 120 BPM，121 拍 |
| 循環長度 | 8.0 s 起的波形與其後最相關的位置，時間差為 48.000 s，即 24 小節 |
| 56 秒前後 | 56.00–56.05 s 為 -46 dB 的 break，下一個重拍在 56.075 s |
| 8 秒前後 | 重拍在 8.075 s，與 56.075 s 對齊 |

- 設定：`trimEnd` 0.95、`crossfade` 0.05，所以在 56.00 s 換手到 8.00 s。0.05 s 的交叉淡化落在 break 的近無聲處，下一個重拍以全音量進來。
- 這個播放器用 HTMLMediaElement 換手，不是 sample-accurate。換手可能晚 0–25 ms，落在 break 裡，預期聽不出來，但還沒有人耳驗收。

## 網頁音質處理

| 項目 | 原檔（Downloads） | 遊戲用 |
|---|---|---|
| 格式 | MP3 192 kbps | MP3 128 kbps CBR（LAME），44.1 kHz 立體聲 |
| 長度 | 63.060 s | 57.000 s |
| 大小 | 1,519,556 B | 913,283 B |
| 整合響度 | — | -15.03 LUFS |
| 峰值 | +1.3 dBFS（已爆音） | -1.14 dBTP |

- 在 57.0 s 截斷。循環在 56.0 s 就會換手，所以 56–60 s 的重複段和 60.4 s 之後的 2.6 秒靜音都不需要。最後 0.5 s 加安全淡出，只在換手失敗時才聽得到。
- 編碼前降 2.5 dB，因為原檔峰值超過 0 dBFS。中繼資料已移除。
- 執行時增益 -9 dB，投射響度 -24.03 LUFS，投射 true peak -10.14 dBTP，與其他 BGM 的約 -24 LUFS 一致。

## 沒有做的部分

Gemini 提示中還有幾項沒有實作，需要 Owner 另外決定：

- 分頁濾波：依分頁切換濾波（籠子／育成柔化、狩獵加亮）。
- 轉蛋演出：抽轉蛋時切低頻，開獎時把低頻放回來。
- 跨頁節拍對齊。
- 連續購買時音高遞增。

這些都需要把播放器改成 Web Audio 濾波管線，屬於新的音訊功能，不是單純換曲。

## 驗證

- `MEASUREMENTS.json` 新增一列，共 29 列。
- 發佈合約 `WEB_BUILD_INPUTS`、`PUBLIC_RUNTIME_ALLOWLIST` 加入新檔，三個改動模組重新計算雜湊。`PUBLIC_METADATA_SOURCES` 也為 manifest 重新計算雜湊。
- 尚未做人耳試聽驗收。
