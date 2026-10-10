# 全幅首頁與原創音樂接入契約（2026-10-10）

本批為 Owner 授權的 **OWNER_APPROVED_ADAPTATION**，僅改展示與音樂，不改原作戰鬥數值、RNG、存檔、可走網格或原生流程。Owner 明確要求精緻動態首頁，交付四張原創首頁素材，並以「對啊，用在新專案吧」核准九首既有原創曲。當日補交五首原創競技／結果曲，指示一起接入及公開。發布依同日重申「做好請commit 跟push並整合至公開發佈版」「可以公開」；不擴張至未指定素材。最新明確授權為「請你更正以後就可以commit並push公開了」，隨後以「好」核定五語短標取代長副標，適用完整首頁／14曲批次與本次命名修正。

## 來源與界線

- 首頁 ZIP SHA256：`621e960559f9cd912c4924c504692ac0f36174f212b9d780b383339cd3dffe1d`。晨光競技場、繁中 Logo、焰龍 R2、雲兔 R1 四張已逐檔驗證；無損 WebP 與原 PNG 的 decoded RGBA 完全相等。只公開四個 WebP 與來源 manifest。
- 九首原創 MP3 固定取自 Owner 指定來源 commit `bde3f2bf82380445a738222c5ef00cad01600204`；逐檔 SHA 記於 `assets/production/original-music-r1/manifest.json`。只入庫音樂檔，不匯入來源專案的程式、存檔或遊戲系統。
- 競技 ZIP SHA256：`505f985a39fe55403adec64611ab3b29523188db945ba0f74a554b35e4292648`；973,472 bytes、CRC 及五個 OGG SHA 全通過。OGG 為主要編碼；五個同曲 AAC LC 衍生檔只供瀏覽器宣告不支援 Vorbis 時使用，不增加曲目。
- 公開檔案沿既有 `WEB_BUILD_INPUTS.v1.json` 明列路徑與 bytes hash；不公開 ZIP、製作程式、WAV母帶、參考影片、Dawnward 備用曲或其他來源檔。
- Owner 2026-10-10 最後核定五語短標，集中於 `brandTerms.js`：繁中「網線拍檔：錦標賽」、英文「Cyber Partner: Tournament」、日文「サイバーパートナー：トーナメント」、泰文「ไซเบอร์พาร์ตเนอร์: ทัวร์นาเมนต์」、越文「Cyber Partner: Giải đấu」。首頁主標、document.title 與 aria-label 隨 locale 同步；刪除旧副標與年份。繁中沿用現有短 Logo，外語為各自文字，不重生圖片；其他待定物種／蛋術語不在本次核定內。首頁角色是裝飾，不決定玩家初始蛋／夥伴。

## 首頁要求

全幅競技場背景；Logo、拍檔及小光點為分層 DOM。拍檔完整身體與腳保留，沒有整隻持續浮動。一次 Logo 進場、拍檔錯開淡入、低幅度光點；減少動態與省電設定關閉動畫。維持原 LOGIN、新遊戲覆寫確認、Continue、設定、五語、文字大小與原 canonical save。沒有第二個 Pixi 或遊戲 ticker。

## 音樂要求

同一 audioBus 新增 music category 與裝置偏好 musicVolume，沿現有偏好儲存；舊偏好文件預設100。手勢前不建立音樂音源或抓音訊。最多兩個串流媒體音源與 GainNode，避免首次載入解碼整批歌曲；同曲切頁不重啟、過期資源取消、背景與靜音暫停，回前景從原位置續播。音樂與 SFX 音量獨立，總音量／靜音共同生效。

| 場景 | 曲目 |
|---|---|
| 首頁 | login |
| 開場故事／命名／選蛋、育成教學 | lofi |
| 牧場／籠具／名冊／資料庫／說明／馴獸師、Ice | moon |
| Grass／Savanna／Forest／Jungle、狩獵教學 | plains |
| Factory／Mine／Sewer／Volcano | forge |
| 商店／Gate／裝備準備、Seaside | harbor |
| 對戰選單／賽程／獎章／大會選單 | core |
| Damp／Oasis | tidal |
| Canyon／Crag／Desert／Ruins | mystic |
| 一般／練習／自由／其他對戰 | battle_normal |
| chosen.championship===true 且 cursor===totalRounds-1 | battle_final |
| 本次 outcome.ended 與 attemptId | winningTeam 0 勝利、1 失敗、其餘平手；每個 attempt 最多一次 |

結果短句不 loop，重繪或離開後返回不可重播同一 attempt；新 attempt 可播放。對戰 loop 為32秒。九首MP3使用保守首尾低訊號量測及0.8秒淡接，不把 loop=true 當無縫聽感證明。曲目增益候選以約−24 LUFS 為參考，正增益上限6dB；GainNode承接正增益，HTMLAudio.volume維持1，保留來源峰值餘量。

## 驗收層級

以 transport／選曲單元測試、真實瀏覽器解碼、正常 UI 開場與參賽結算、隔離測試存檔、mandatory CI、成品與線上雜湊核對逐層驗證。可報技術播放成功，不得報全部音樂聽感終驗；實體iOS、耳機／手機揚聲器音量與循環接點仍待 Owner 實聽。靜態參考影片只支持分層進場觀察，不證明逐字動畫或長時間idle週期。
