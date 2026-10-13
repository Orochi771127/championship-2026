# 2026-10-13 捕捉退出資源、首屏與復古 UI 修復

基底 `origin/main = 2971a18a24dd4f32958a7a0c1ce1e2e73d8f0cbf`。Owner 本批明確授權完成自審後 commit、一般 push main 與既有 Pages 發布。使用獨立工作樹，未移動使用者 main、未讀個人瀏覽器存檔或 8732 origin；保留 AI／必殺技修復與其他工作樹。

## 已確定的缺陷

正常繩索與手掌捕捉後，返回按鈕先 `load.abort()`，再呼叫原生退出。卡片收入動畫尚未結束時，`exitHunt()` 拒絕退出；畫面仍是 HUNT_FIELD，AbortSignal 已釋放 roster 貼圖。下一個 ticker 拋出 `NATIVE_CHARACTER_TEXTURE_MISSING:m214_kunemon:2:1:m214_kunemon/main/cell_005`，卡片動畫無法完成。沒有缺檔 HTTP URL。這是已重現的 Hunt 卡死；不能直接認定為 Owner 未知物種、返育成跳 TITLE 且無法再進遊戲的全部原因。

修正：先請唯一遊戲／screen stack authority 退出，確認 screen 已離開 HUNT_FIELD 才取消資源。拒絕退出保留動畫與貼圖；載入中的合法退出仍釋放 mount queue，晚到 scene 只 dispose 一次。未修改捕捉數值、動畫、物種 ID、進化條件或存檔 schema。貼圖錯誤補上 entity／sequence／frame／texture，明確保存返回與整頁 reload 各有來源紀錄。

證據順序：`championshipStandaloneApp.exitHunt/confirmHuntResult` → `vs2Screens` 返回與資源生命週期 → `licensedCharacterRoster.dispose`／`pixiCharacterRuntimeBundle` → ticker stack。失敗測試先紅，再完成最小修正。

## 驗證

| 檢查 | 結果與界線 |
|---|---|
| 最終 `test:ci` | 1728／1728 PASS；首次沙箱 loopback EACCES 保留，允許既有暫時測試連線後全套通過 |
| 正式 build／validate | 9335 檔，build ID `14ecc85322b79dc344ca596b3b4531d4244129bcf8b11bb15aa998f7197fe913` |
| 大型正常捕捉 | 既有 full-QA fixture，species-139（第 5 世代、HP 2650）及 species-165（第 5 世代、HP 3030），正常畫圈→拉繩→手掌→返家→保存退出→重新 Continue |
| 保存／重讀 | 同一個體與其餘個體欄位保留；排除原生 Home hydration 指派的 `1c0/1c4` 角色座標。先前比較未保存快照時的自然時計變化保留為測試診斷，未當作資料遺失 |
| 正式版瀏覽器 | 捕捉案例無 pageerror、unhandledrejection、contextlost 或缺檔；TITLE 僅由明確 Save & Quit 返回。隔離 context 與公開選擇相同的 production bytes；QA seeded，輸入 cadence 使用 Playwright virtual time，並非實體手機 |
| 復古 UI | 390px、100／115／130% 字級，四工具 centered／44px 命中區、pressed 與 hint 同步；詳細與場地不重疊、HP/TP 數字不裁切、Bits 改亮金色。肉餌原尺寸／座標不變，與角色共用腳底 Y 排序，繩索與游標維持上層 |
| 去品牌文字 | 19 個精確 authored-label alias，繁中沿用拍檔；其他四語保留既有中性字典，英文未知 fallback 改 Unknown partner。五語選隊／對戰／圖鑑／錯誤／unknown 與暱稱保護回歸通過；舊 key、ID、研究與玩家名字保留 |
| 片頭／TITLE | 即時略過、圖片恢復、system/on 減少動態四個既有聚焦 browser 案例通過；另驗啟動片頭期間零 TITLE 圖片請求，略過後同一原圖恢復 |

首次正式版冷／熱測量（隔離桌面 Chrome、390×844）：ready 3804.5／114.2 ms，冷 TTFB 1294 ms、FCP 2144 ms、JS long task 最長 93 ms，正式啟動 30 個 bundle module、傳輸 883880 bytes。主要耗時是網路。修改只延後三張 TITLE 圖至實際 TITLE 顯示，並避免在啟動片頭前啟動背景下載；原圖與影片 bytes、即時略過及同步 ready 不變。不以原始 HTML 的 268 preload link 當正式站請求數，也不引用歷史 103.7 秒作本次數據；沒有跨網路速度保證。

## Owner MP4：另一條未解流程

讀取 Owner 指定原檔 `C:/Users/User/Downloads/c9351954-348c-4acf-a1c1-ba8bf1a2b1ef.mp4`，未修改。64.466667 秒、288×640，SHA-256 `ba488730c868e013235c8b76fbb8317c0430b5da938256d9b5281bd1521b48e4`。約 38 秒，教學对戰載入切入片頭／TITLE；約 43 秒 Continue 後恢復同一教學對戰，之後戰鬥正常呈現。未見保存返回操作或可讀錯誤文字。這符合重新啟動／恢復的畫面特徵，但沒有 document lifecycle／Safari process 證據可定因，不能宣稱 OOM 或本批已修好。

Owner 第一個未知物種舊存檔已可能被新遊戲覆蓋，沒有用目前新進度重現或覆寫。實體 Safari 重新啟動、原始永久讀檔阻斷、長時間與全物種驗收仍未確認。保留最小診斷與上述限制。

本報告為提交前紀錄。公開發佈與 CI／Pages 的 exact SHA、live build/hash 以同 SHA 的最終發布回條為準。
