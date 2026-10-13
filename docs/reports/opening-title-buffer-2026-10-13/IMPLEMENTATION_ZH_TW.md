# 58 秒片頭與 TITLE 銜接 — 2026-10-13

本批為 Owner 授權的 `OWNER_APPROVED_ADAPTATION`。沿用 7d7bf071 的同一 app、save、router、Pixi/ticker；未改畫面布局、剪輯、美術品質、遊戲規則或存檔格式。使用獨立工作樹；使用者 main 與其他未提交成果不動。

## 來源與確定缺口

- 原播放器只選已核准 720p／540p；原 TITLE 生命周期整段片頭均暫停裝飾載入。這是本批改善的確定程式路徑，並非原捕捉事故／OOM 根因判定。
- 現有製片交付 `opening_58s_1080x1920_textless.mp4`：73,388,752 bytes，SHA256 `30b173920b3ad776aa9fc85949c720715f2d0b6fad6bca2a443ae30686a770ce`；H264/AAC、1080×1920、24fps、1392 幀、58.000 秒；moov 位於 mdat 前。原位元組複製，沒有重製或重壓。
- 同一 deliver 的 720p 交付 SHA256 為 `ef50993b1856da8f7fb4ec62ca6d6ab50489f5e81e4b7b799469a4b154b8831d`，與已公開版本完全一致。沒有使用舊 48 秒或燒字版本。
- 來源：既有播放器 `openingFilm.js`、TITLE 快取管理器 `titleImageLifecycle.js`、`main.js` 的音樂／影片／首頁銜接、NS33 production manifest、NS33 bounded presentation contract；前批設計章 `DESKTOP_LANDSCAPE_AND_OPENING_SPEC_20261013_ZH_TW.md` 與既有製片 integration handoff。公開只新增 hash 選定的最終 1080p；私有製片檔未加入 build。

## 實作與自審

- 首次播放前只選一個 src：手機 720p、桌面 1080p；保留 saveData／2g 的 540p。選擇固定到這個播放器生命週期；resize／重播不換解析度。
- 真正播放、非 paused/seeking、readyState≥3，且目前 buffered 區段至少涵蓋 6 秒（尾段須涵蓋全部剩餘時間）後，才以 low priority 逐個載入原背景與三張 TITLE 圖。一次一個；waiting/stalled/hidden 不新增 warm request；沒有預抓地圖／角色，也沒有新 runtime／ticker／cache authority。
- 同一 TITLE 管理器負責 fetch/body/decode 的 60 秒上限、進度、單圖重試、decoded Blob 快取、AbortController、晚到回應判斷與 URL 回收。略過加入未完成請求，已完成資源沿用快取；未完成載入保留狀態且不阻擋開始／繼續。
- 受控同步 pause 順序曾測出 7 個 TITLE 請求：結束事件先啟動圖片，隨後初次音樂緩衝取消，再重新啟動。改為 inactive media 事件不觸發預載回呼，統一經既有 onActiveChange 按音樂→圖片順序銜接；該受控案例現在只有 4 個請求。這是受控競態回歸，未宣稱原手機事故由此造成。
- 保留靜音／開聲、背景／前景、reduced motion、15 秒 idle、8 秒首次等待／3 秒停滯、skip 350ms 消耗；未新增品質切換或改 TITLE/育成布局。

## 驗證

- 聚焦 unit：25／25，含 exact media hash、buffer gate、序列去重、HTTP 200 body timeout、decode timeout、晚到 completion、重試、進度與 URL/listener 回收。
- 正式 `test:ci`：1757／1757、0 fail、0 skip；source preload 271；`build:playtest`／`validate:playtest` 成功（9372 files）。
- 最終正式產物 browser：8／8，見 `browser-summary.json`。桌面真 media 選 1080p；iPhone 模擬真 media 選 720p，原生 ended 以 4×播放速率驗證；resize／重播均維持一個 media URL。正常預載、立即略過及停滯後略過各 4 個 TITLE 請求；故障單圖含一次重試為 5 個。受控背景／離 TITLE：取消未完成請求，2 個已建立 URL 全數回收。
- 同批先前正式產物：原生 58 秒完整播放／可信點擊開聲關聲／無 save write 通過。最終修改後補跑既有播放器 10／10 情境：skip/idle/menu/dialog/background、rejection/404/network/slow、warm reuse、4.2 秒冷載入、3 秒停滯及兩種 reduced motion。
- QA Continue 使用既有 fixture、隔離 profile，正常按 LOGIN→Continue 到既有 Raising，維持單一 canvas，影片 src 已移除。這是 seeded QA 加正常 UI；沒有使用個人存檔或 8732。
- 手機是桌面 Chromium 的 iPhone 瀏覽器模擬。實機、主觀完整聽感與商業權利未升格為 PASS；本批無技術阻礙。

正式產物 buildId：`c3bb4ad082a8ce5ba2005ff8d237a34ca78e11eb8651bfb5160aeae3506e550e`。發佈 exact SHA、CI／Pages 與 live hash 回條由本次任務回報。
