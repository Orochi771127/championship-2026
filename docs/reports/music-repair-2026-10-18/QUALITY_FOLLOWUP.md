# 全曲訊號檢查與恢復接點修正候選

這份結果區分「可證實的程式／訊號行為」與「真人聽感」。全部 23 cues、28 編碼檔已逐檔檢查，所有九首交付及先前遊戲 BGM／結果短句均包含。沒有真人試聽，因此所有曲目的刺耳、高頻疲勞、底噪、意圖內失真與音樂接縫聽感均未核准。

## 已量測

`SIGNAL_AUDIT.json` 以原生採樣率、立體聲 float PCM 解碼，補充逐檔 sample peak、DC、數位滿幅平頂連續樣本、相鄰樣本差、20ms RMS 分布、原生 FFT 頻帶、突出頻率候選與實際 trim／fade 接點數值模擬。`SIGNAL_AUDIT.csv` 為逐檔摘要，`MEASUREMENTS.json` 保留 LUFS、FFmpeg oversampled true peak 與雜湊。

- 28 檔均成功解碼；未測到滿幅附近連續且完全平坦的樣本。這不能證明來源從未削波：有損編碼可改變已被削波的波形。
- 九首 scene MP3 的 float 解碼含部分超過 0 dBFS 的樣本；既有逐曲播放增益使最大預估 sample peak 約 -6.43 dBFS，所有 true peak 也通過至少 -3 dBTP 餘裕門檻。這處理輸出餘裕，沒有修復來源內烙入的失真。
- 九首 scene MP3 量到約 -42 至 -46 dBFS 的平均 DC；調整播放增益後更低。沒有因這個數值就加高通或去噪；對目前已有淡化的接點，未證明需改動低頻音色。
- 2–5k、5–10k、10–20k 能量與突出 bin 已逐曲記錄。草原／火山及 forge／harbor 等較有高頻成分，僅列為優先聽感候選，不把打擊樂、泛音或刻意音色誤判為雜音，沒有盲目 notch、EQ 或一刀低通。
- combat OGG/AAC 的原生循環 join 在播放增益後量到約 -44 至 -49 dBFS 的一樣本變化；這可能是正常相位步進，也可能是接點候選，單靠數字不足以更改既有精確 32 秒循環。已提供前後接點片段供聽感檢查，未宣稱無 click。
- MP3 既有 trim／0.8s 線性交叉淡化以 exact sample 模擬，結果有逐曲數據。HTMLMediaElement timeupdate 的排程抖動、網路 buffer 與裝置路由不在此數值模擬中，仍需實際瀏覽器／實體手機驗收。

## 獨立候選：恢復時 20ms 淡入

程式發現一個具體風險：前後台／靜音返回時，媒體直接從保留的位置以完整 cue 增益 `play()`，首樣本可能不為零。修正將該來源設為零，在播放恢復後用 20ms 線性 ramp 回原 cue 增益；media 仍報 playing 而 graph interrupted 時亦使用此 ramp。正常持續播放不重做淡入。

這是 click 風險的程式修復候選，保留同一 context、來源、位置、速度、音高及原檔，不是聲稱真人已聽出或消除所有爆音。42 focused 回歸通過（包含恢復瞬間為零、20ms ramp、位置保留、running media 不重啟、前後台／靜音／延遲 promise）。依發布協調，此候選保留在獨立後續分支，不擴入正在修 iPhone 命名鍵盤的發布批次；需發布者另行真瀏覽器檢查／安全整合。

## 程式合成與疊加檢查

產品的循環 BGM 僅經 `musicPresentation.js` 的兩個 streaming media slots 送入共同 `audioBus` music 分類。未發現另一組 runtime oscillator 背景音樂；既有 combat/result 的 OGG/AAC 已包含在 28 檔量測。

仍會播放的程式合成音全部走 sfx 分類，不能漏記成「沒有合成音」：

| 來源 | 音色／增益與防疊加 |
|---|---|
| audioBus preview | 1046／1568Hz 正弦測試聲、peak 0.28、包絡、單聲部替換 |
| Data Arena | 20 種一次音效及雙振盪 laser；mix 0.8；依類別節流與 14 voice cap；大部分 noise 已有濾波，laser Q=4。noise 為設計元素，不能直接當底噪移除 |
| highlight | 正弦／三角／square／saw 加濾波 noise；預設 gain 0.16，既有 threshold -12／ratio 6 compressor；skip 15ms fade |
| ceremony | 六類短句、分音符包絡、master gain 0.5；bandpass noise 為刻意特效；stop 15ms fade |
| battle samples | 原生 54 短樣本，sfx、master 0.5、最多兩 sequence 加一 stream；不是第二組場地 BGM 選曲器 |

來源檢查不等同全音效實際混音 render。sfx 與 music 可同時經共同 master 相加，尚未取得最密集場景的實際輸出錄音，因此不宣稱所有疊加峰值／音色已通過。未為假設加入全曲 compressor 或 limiter。

## 前後比較與重現

`scripts/audit-music-signals.py` 重跑訊號檢查；`scripts/build-music-listening-review.py` 產生本機 `reports/music-listening-review/index.html`、23 cue 原生 stereo WAV 摘錄及循環模擬（約 73 MB，非公開遊戲 payload）。使用現有 FFmpeg／Python／NumPy，不安裝軟體、不連付費服務。

比較頁 A 為 `19c91ac8` 的實際先前增益；當時未登記的六首場地曲，以原檔安全峰值參考取代，不冒稱那時已在遊戲播放。B 為目前增益。匹配增益直接寫入 WAV，不依賴 HTMLMediaElement.volume；預設匹配兩邊到較小音量，避免「比較小聲所以比較順耳」的偏差；只調過增益的 A/B 音色本來應該相同。短摘錄兩端 10ms fade 僅避免產生取樣切割假 click，並非修改原曲。所有 WAV 均檢查不削波。

這些比較檔是技術／聽感交接材料，尚無真人完成逐曲評分。需要針對可辨識時間點再決定是否逐曲窄幅 EQ、去噪、declip／limiter 或循環修整。尚未確認的缺陷不能藉降低音量改寫成已完成音質修復。
