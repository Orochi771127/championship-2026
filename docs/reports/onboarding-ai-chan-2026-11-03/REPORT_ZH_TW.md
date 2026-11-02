# 2026-11-03 新遊戲開場故事與愛醬導覽（Owner 核准 layered v3，本機首版）

狀態：本機實作與本機 Chromium 驗證完成，經 Owner 授權以 PR #160 合併發布（實際上線結果見發布紀錄）。實體裝置、iOS Safari、人工聆聽與美術最終驗收仍待完成。

## 授權與範圍

- Owner 於 2026-11-02T16:14:44Z 核准 `AI_CHAN_FULL_STORY_LAYERED_CANDIDATE_v3.zip`（SHA256 `73aab2e2…cd50`），並授權完善分頁與互動。包內的 candidate／pending 字樣早於這次核准。Owner 也核准 Hexagon Cradles 用於故事與新手教學。
- 本次只替換「按新遊戲之後」的故事（`openingStoryPresentation`）和互動教學的導覽外觀。標題畫面、logo、NS33 標題影片、取名、八蛋、孵化、教學 step／checkpoint、存檔、router、ticker 都沒有改。
- 分類：`OWNER_APPROVED_ADAPTATION`（產品呈現），不影響任何原作行為證據。

## 四個分離圖層

| 層 | 來源 | 處理 |
|---|---|---|
| 背景影片 | `assets/production/opening/ai-chan-layered-v3-20261103/background.mp4`：1280×720、80 秒、24fps、H.264，無音軌，畫面裡沒有愛醬也沒有字 | 與包內位元組相同。橫向與桌機用 `contain` 顯示完整 16:9；直向手機用同一支影片中央取景（`cover`）。每頁只播自己那一段，播完停在最後一格；減少動態時只顯示該段的靜止畫格 |
| 愛醬 | `cat_idle.webp`（716×768）、`catgirl_idle.webp`（631×768），帶透明、閉嘴的待機圖，每張不到 80KB | 與包內位元組相同。固定半身視窗（寬：高 = 1：0.815），貓娘上移 14%，視窗下緣到原圖第 584／586 列，不露貓腳。只在影片 38–50 秒的導覽區段出現。沒有嘴型、眨眼、漂浮或姿勢輪播 |
| 文字 | 沿用既有 `storyCutsceneStage`（DOM） | 每段原文一頁，玩家自己控制閱讀節奏 |
| 音樂 | `assets/production/scene-music-r1/opening/hexagon_cradles.mp3`：128 kb/s、127.45 秒、-18.50 LUFS | 沿用既有 `musicPresentation` 和 `audioBus`；增益 -5.5 dB，約 -24 LUFS，與其他場景音樂一致；循環時用 0.8 秒 crossfade（不是無縫循環） |

## 互動

- **翻頁與重看**：點擊會先補完正在打字的行，再到下一頁。另有「上一頁」「從頭播放」。
- **返回標題**：「⌂ 返回標題」每一頁都有，含外觀選擇頁。返回後頁碼書籤與外觀偏好都保留，不開始存檔；再按新遊戲會從同一頁繼續。
- **跳過**：還沒選外觀時，跳過會停在愛醬的問候；已在問候之後則停在外觀選擇。選過外觀後，跳過直接結束故事。所以跳過或重播都不會永久拿走這個選擇。
- **選擇外觀**：順序是小貓問候 →「貓……貓居然會說話？！」→ 小貓提議換個樣子 → 變成貓娘 → 玩家在小貓與貓娘之間選擇。選擇寫入偏好 `guideAppearance`（account 範圍，預設 `""`，未選時顯示小貓），之後可在「設定 → 外觀與顯示 → 導覽員外觀」切換。兩種外觀的台詞與教學完全相同。
- **中斷恢復**：每換一頁就把頁碼寫入偏好 `openingStoryResume`（device 範圍）。返回標題、重新整理或關閉分頁後，再按新遊戲會從該頁繼續，並顯示「已從上次中斷的段落繼續」；「從頭播放」才是主動重播。真正開始新遊戲（`onStart` 成功）後才清除這個頁碼。它不是遊戲存檔，也不會提前改動養成存檔。教學中途中斷則沿用既有的教學 checkpoint 與「繼續遊戲」。
- **其他狀況**：頁面隱藏時影片和音樂都暫停。背景影片載不到時，畫面改成深色舞台並顯示可讀的狀態列；立繪載不到時改顯示名字牌。轉向時影片不重新開始。

## 教學導覽

- 教學橫條與教學對話框的頭像，從原本的 AI 機器人徽章換成愛醬臉部特寫，跟著目前選的外觀即時切換。
- 各語系 `guideName`：愛醬／Ai-chan／アイちゃん／ไอจัง／Ai-chan。BRIEFING 不再重複顯示名字。
- step、actions、spotlight、checkpoint 都沒有改。

## 音樂路由

- **新遊戲故事**：Hexagon Cradles（取代原本的 lofi）。
- **教學期間**：除了戰鬥結果畫面，所有畫面都用 Hexagon Cradles。育成音樂偏好在教學期間不覆蓋它。戰鬥結果仍播原本的勝／敗／平短曲。
- **故事接教學**：同一首曲子同一個 key，不會重新開始；瀏覽器中實測 `starts` 前後相同。
- **一般育成與戰鬥**：選曲和玩家偏好都不變。

## 多語系

zh-Hant 的 16 段敘事與 4 句愛醬台詞逐字取自核准包。選擇提示、按鈕、狀態列等文字，以及 en／ja／th／vi 全文，都是 PRODUCT_AUTHORED（Claude 撰寫，2026-11-03），待 Owner 或母語者審閱，不代表 Owner 逐字核准。三方勢力的名稱沿用既有的 `taxonomyText` 用詞。

## 開發工具

`scripts/serve.mjs` 增加 HTTP byte range 支援和 mp4／mp3 的 MIME，讓本機影片能像 GitHub Pages 一樣跳轉播放位置。沒有其他行為改動。

## 驗證（本機）

- **`npm run test:ci`**：基底 3298/3298；本次 3307/3307。本次新增 `tests/championship-ai-chan-onboarding-cases.mjs`，並按 Owner 新指示更新音樂、prologue 與 pin 相關斷言。
- **build:playtest／validate:playtest**：基底與本次都通過，在工作樹外的硬連結 staging 執行，原因見下一節。
- **`tests/championship-onboarding-cinematic-browser.cjs`**：改寫為本功能的 gate，分別在原始碼伺服器與 playtest 建置產物上執行，兩者都通過。涵蓋：
  - 390×844（含 safe area）、844×390、1366×768，以及橫直切換
  - 兩種外觀
  - 上一頁、從頭播放、跳過
  - 重新整理後恢復故事進度；教學中途重新整理後「繼續遊戲」恢復
  - 減少動態、頁面隱藏
  - 靜音與音量
  - 影片和立繪載入失敗
  - 英文語系
  - 閱讀中返回標題後恢復同一頁與外觀；設定預覽的可見幾何（第二輪新增）
  - console 沒有新錯誤
- **共用 helper**：`tests/championship-browser-opening.cjs` 的 `playStory` 只透過玩家看得到的跳過鍵或逐頁點擊，加上選擇按鈕，不寫入 storage。

## 基底既有問題（不是本次造成）

- **八蛋圖片 404**：`openingEggChoices.js` 指向的八張 `internal-character-review/e00*_digitama…png` 不在 Git 裡。gate 把它們列為 `baselineIssues` 回報，不隱藏。
- **build:playtest 一開始無法在工作樹執行**：當時工作樹的 `node_modules` 是指向其他 checkout 的 Junction，會觸發 `BUILD_INPUT_OUTSIDE_ROOT`。第一輪改在 staging 驗證。之後已換成經驗證的實體副本，第二輪直接在工作樹 build 並通過。
- **以下 gate 在基底就以相同方式失敗**：
  - `championship-tutorial-recovery-browser`
  - `championship-desktop-raising-browser`
  - `championship-evolution-glyph-browser`
  - `championship-gate-world-normal-browser` 第 22 行（savanna 鎖定斷言）
  - `validate-art-production-a0` 與 `championship-art-local-manifests-cases`（本機缺 `vfx/original-shared-review-v1/manifest.json`）

## 尚未提供或尚未驗收

- 獨立的 9:16 背景、34 張表情 WebP、PNG 原圖都沒有收到，也沒有被引用。直向畫面用同一支 16:9 影片中央取景。
- 尚未驗收：實體手機（iOS／Android）、iOS Safari 的自動播放與記憶體、人工聆聽音樂接縫、美術最終驗收、Owner／母語者審閱新增翻譯。
- 頁面隱藏的測試是以覆寫 `document.hidden` 模擬，不是真機切換 App。
