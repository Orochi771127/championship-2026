# UI 缺件補齊候選：正常瀏覽器查看受阻

日期：2026-10-24。狀態：`BLOCKED_BEFORE_IMPLEMENTATION`，不是完成候選，也未取得視覺或聽覺驗收。

## 工作區與授權

- 獨立工作樹：`R:/Projects/Championship2026/ui-completion-candidate-20261024`。
- 分支：`feat/ui-completion-candidate-20261024`；起點 `105fafbd4d6a736476a414825e0dcfcf8ef8611c`，依本次委派指定快照，不含首頁 `07cad19b`。
- 原工作區為 `feat/database-original-stories-v3-1`、`e15a5d1bfe0d2b2b89d2f69e105ad570e43f5cd7`，有既存修改與大量未追蹤素材；沒有覆寫或清除。讀取時 main 為 `125abeb773fe953958eef0ac61a34c9c4bb82949`，與委派指定快照不同。
- 本次僅允許本地 commit；未 push、merge、deploy、rebase、reset 或刪除。
- 已讀 AGENTS.md、docs/README.md、OWNER_DIRECTION.md 中相關 2026-10-15 UI/ceremony 與 2026-10-18 保留聲庫方向、架構與共享檔案協定。使用 Playwright、game-ui-design 技能。工作樹/原工作區/專案父目錄未找到 `.agents/skills`；使用者 `.agents/skills` 存在，但其中未找到 championship-art-production，`.codex/skills` 同名技能亦不存在。

## 已確認的來源缺口與建議映射

來源：`src/championship/app/championshipToolbar.js` 的 `entryButton` 目前只呼叫 `originalDatabaseIcon(entry.screen)`；`src/championship/presentation/completedOriginalUi20261007.js` 查詢 `src/data/championship/public-ui-selection.v1.json` 的 database 集合。該集合只有 DATABASE 與 MEDALS。

| 實存 entry.id | screen / action | 目前專用圖 | 待製作候選符號（尚未實作） |
|---|---|---|---|
| tamer | TAMER_INFO | 缺 | 身分證／徽章 |
| schedule | SCHEDULE | 缺 | 日曆 |
| cageEdit | CAGE_EDIT | 缺 | 方格與編輯筆 |
| digimon | DIGIMON_LIST | 缺 | 夥伴名冊 |
| endDay | END_DAY action | 缺 | 月亮與日界線 |
| help | HELP | 缺 | 說明書／問號 |
| saveQuit | SAVE_AND_QUIT action | 缺 | 儲存與離開箭頭 |
| database | DATABASE | 已有 | 保留現有圖 |
| hunt | GATE_SELECT | 缺 | 探索羅盤 |
| battle | BATTLE_SELECT | 缺 | 交叉對戰符號 |
| shop | SHOP | 缺 | 商店袋 |
| medals | MEDALS | 已有 | 保留現有圖 |
| settings | OPEN_SETTINGS action | 缺 | 齒輪 |

後續應以 entry.id 補查找，保留 Database／Medals 的既有圖片與八格工具圖。以上為程式盤點，沒有將未查看的正常畫面宣告為視覺缺件驗收；候選 SVG 尚未製作。文字、點擊區、工具圖、GR01–GR09、相鄰籠子擺放、狩獵／戰鬥／存檔規則均未修改。

## 音效盤點與待實作邊界

來源：`presentation/audioBus.js`、`battleAudioPresentation.js`、`ceremony/ceremonyAudio.js`、`highlight/highlightAudio.js`、`dataArena/dataArenaAudio.js`，以及 `app/main.js` 的 settings.audio.output('sfx') 連接。未找到 select/open/back/reject 四類共用 UI cue；既有 preview 是設定試聽，ceremony/Arena/highlight 是不同語意聲庫，不能作為缺件補齊而替換。

四類提示音尚未新增。後續應注入單一共用 player，沿用 settings.audio.output('sfx')；在明確玩家 click handler 判定本次結果後播放，跨 cue 共用約 80ms 節流，同次互動只一聲。closeMenu/selectTool 的程式清理與教學呼叫保持靜默；disabled 不發 reject；reject 只對明確 domain false/ok:false。保留所有 Battle WAV、Arena、ceremony 與 BGM。Mute、master/sfx 音量、資源釋放及正常返回需驗證。未做任何 AudioContext 事件或聽覺驗收。

## 阻礙：精確動作、目標、原因與結果

1. 動作：以 PowerShell `New-Item -ItemType Junction` 建立本機依賴目錄連結。目標：工作樹 `node_modules` 指向既有原工作區 node_modules。結果：`DENIED`，系統訊息「存取被拒」，沒有建立連結，沒有重試或提權。已以一般複製準備本機依賴；沒有安裝新套件或改鎖檔。
2. 動作：正常 Chrome/Chromium 頁面導向，透過 repository Playwright 同樣的 Chrome channel、乾淨隔離 context（390×844 touch），先開既有 QA installer，再預定 Login→Continue→管理/系統選單。目標：`http://127.0.0.1:8746/full-qa-save.html`。結果：`DENIED`，Playwright 回傳 `page.goto: net::ERR_NETWORK_ACCESS_DENIED`，在任何 installer click 或遊戲 UI 操作之前失敗。這不能證明桌面離線。未重試此導向、換代理、停用限制或改走其他工具繞過。

因此「先實際查看正常 UI 再改」前置條件未達成，產品實作停在修改前。手機／桌面截圖、重複點擊、返回、靜音、鍵盤焦點尚無驗收證據。沒有截圖可以提供，沒有宣告 PASS。若取得允許該 loopback 正常瀏覽的執行環境或針對此拒絕的有效新證據，再續跑原本的正常 UI 查看。

## 交付與驗證

R 槽歸檔目錄：`R:/Projects/Championship2026/ui-completion-archive-20261024/`，包含報告、盤點、失敗執行紀錄、檢視腳本、diff 與 Git 狀態。檢視腳本原始位置為未追蹤的 `output/playwright/ui-completion/inspect.cjs`，沒有把失敗操作混入產品碼。

本批只有此報告與盤點交付；產品 diff 為空。僅檢查文件內容、引用路徑與 scoped diff，不跑不相關全套。現有來源/hash gate、公用 render projection 與內部 metadata 未更動。
