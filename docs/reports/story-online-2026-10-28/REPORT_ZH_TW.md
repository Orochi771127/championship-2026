# 雜訊裂縫故事劇場 × Supabase 線上系統 交付報告（2026-10-28）

> 分支 `feat/story-rift-online-20261028`（基底 `origin/main` 1fc403c9），初版只有本機 commit；Owner 隨後授權 push、經 PR 合併至 main 並由既有 Pages 流程發布（雲端設定檔 `online-service.v1.json` 仍為空，線上功能維持本地模擬直到 Owner 填入 Supabase URL 與 key）。
> 分類：OWNER_APPROVED_ADAPTATION（呈現層與產品功能）。遊戲邏輯、存檔格式、戰鬥核心、獎勵結算全部不變。
> 分工：Phase 3（新手教學 Bug、開場／取名／選蛋重構）由另一個 session 以 PR #103 完成並已上 main；本批次在它之上。

## 一、故事劇場（Phase 2 ＋ 第一章垂直切片）

- **劇本**：`src/championship/data/storyRiftChapters.js`，由 Fable 5.1 依 beat schema 起草後人工校對；三章（`prologue`、`first-resonance`、`chapter1-first-rift`）、27+ 句、五語系。保留「每四年舉辦一次的拍檔錦標賽」「取得參賽資格」；殘響碎片含「只要贏過別人就好了吧…」「為什麼沒有人看見我…」。名稱全部原創（大會導覽 NAVI、雜訊殘響）。
- **引擎**：`src/championship/presentation/story/`
  - `HybridStoryDirector.js`：beat 執行器，一個 AbortController，setTimeout 計時（無 rAF、無第二 ticker），頁面隱藏時暫停，跳過即清理。
  - `storyStagePuppeteer.js`：八方旅人實機層。聚光暗角、紫紅次元裂縫（conic/radial 漸層＋鋸齒 clip-path＋亂碼粒子）、留言殘響漂浮、像素情緒氣泡（`!` `?` `...` 💢 🎵 ⚡，停 300 ms 再接台詞）、拍檔本體 sprite 走位／轉向／威嚇／受驚／跳躍。
  - `portraitVnOverlay.js`：立繪對話匣。`idle-breathe`、`talk-bounce`（6 px）、`shock-shake`、`nod`、`silhouette`、`noise-glitch`；非發話方 65% 亮度、scale .96；打字機、點擊補齊、【⏭ 跳過劇情】【自動】、選項分支；底部避開 safe-area。
  - 舞台掛鉤：`createRaisingFieldPixiPresentation.js` 新增 `setStoryPuppet / clearStoryPuppet`（只覆寫繪製序列、朝向與位移；模擬狀態不動）。演出期間 `clockDriver.setActive(false)`。
- **入口**：牧場右上 📖 裂縫觀測 徽章（探索手帳下方，看過前有紅點，教學中隱藏）與系統選單「故事章節」。看過與否只寫入裝置偏好 `storyRiftChapter1Seen`。
- **決定**：不在「前往狩獵場」前自動播放，以免既有瀏覽器閘門（它們不會按跳過）卡在劇情；徽章與選單隨時可看。

## 二、線上系統（Phase 4，Supabase Ready）

### 後端一鍵建置
- `supabase/migrations/001_championship_online.sql`：4 張表（`tamer_profiles`、`tamer_cloud_saves`、`friendships`、`pvp_matches`），每張表 RLS 只允許 `auth.uid()` 本人改自己的列；24 個 SECURITY DEFINER RPC（`search_path=''`，從 public/anon 收回，只給 authenticated）；雲端存檔 If-Match 修訂號＋ sha256 校驗；房號唯一索引；跨裝置引繼碼一次性雜湊；Realtime 私有頻道 `pvp:<matchId>` 政策。
- `docs/SUPABASE_3MIN_SETUP_ZH_TW.md`：**URL 貼在 `src/data/championship/online-service.v1.json` 第 3 行，publishable/anon key 貼在第 4 行**。`sb_secret_` / service_role 前端直接拒絕。

### 前端雙模服務 `src/championship/online/`
- `onlineServiceConfig.js`（讀 json 或 `window.__CHAMPIONSHIP_SUPABASE_CONFIG__`，驗證 host 與金鑰形狀）、`localSimulationMode.js`（記憶體內的鏡像好友／房間／備份，永不寫儲存）、`supabaseMode.js`（signInAnonymously → `updateUser` Email OTP／`linkIdentity` Google 升級、RPC、Broadcast＋輪詢）、`cloudSaveEnvelope.js`、`pvpRoomSession.js`（房間狀態機，只搬運既有 link invite/reply 碼）、`championshipCloudService.js`（唯一門面；未設定或離線 → 本地模擬）。
- 第二個本機鍵 `championshipModernSave:onlineSession:v1`（`createChampionshipOnlineSessionPort`，仍只由 `ChampionshipPersistentSavePort.js` 寫入；離線遊玩不會出現）。雲端／引繼碼還原走 `adoptExternalText`（同一反序列化驗證）後重新整理。
- 供應商：`@supabase/supabase-js@2.117.3` 以 UMD 複製到 `assets/production/public-runtime/vendor-supabase.js`（PUBLIC_PROGRAM_SOURCES 列），只在雲端已設定且連線時才載入。

### UI
- `onlineAccountPanel.js`【☁️ 帳號與雲端同步】：設定→資料與帳號、系統選單「帳號與雲端」、馴獸師資料。遊客通行證＋ TM 碼（沿用 main 的 `futureSystemsPort` 代碼）、綁定 Email／Google、立即雲端備份、從雲端還原、跨裝置引繼碼；六種同步狀態，「已同步」只在伺服器回同雜湊後出現；衝突不自動合併。
- `friendsDrawer.js`【👥 好友與馴獸師名片】：我的代碼一鍵複製、➕ 新增好友、申請列表、好友卡片（階級、王牌、最後上線）、【⚔️ 友誼切磋】載入對方 `defense_team_json` 的隊伍碼打一場既有密碼對戰。
- `onlineBattleLobby.js`：**密碼對戰** 面板頂部＝房號連線大廳（建立房間 → 4 位房號 → 挑戰者加入 → 交換碼 → 3 秒倒數 → 兩邊各自開打同一場 LINK_BATTLE）；**通訊對戰** 面板頂部＝⚡ 快速配對／🏆 天梯鏡像（對手防守隊伍碼 vs 自己隊伍碼的 PASSWORD_BATTLE）。原本的手動交換碼 UI 保留在下方。

## 三、驗證

- `npm run test:ci`：3034 項，初跑 2 失敗（arcade sheet 需最後載入、PUBLIC_PROGRAM_SOURCES 筆數 45→46）皆已修正；受影響套件重跑 0 失敗。
- `build:playtest` ＋ `validate:playtest` ＋ `validate:preload` 通過（buildId 見 commit）。
- 隔離埠 127.0.0.1:8763（Playwright iPhone 13 視窗）：故事章節完整播放與跳過；帳號面板備份／引繼碼；好友抽屜接受申請→友誼切磋進入 BATTLE_FIELD；密碼對戰房號 4348 倒數後進入 BATTLE_FIELD；通訊對戰天梯鏡像挑戰進入 BATTLE_FIELD；零 page error；離線全程只有既有儲存鍵（無 onlineSession 鍵）。
- 已知：`championship-loading-optimization-cases` 的 esbuild 暫存目錄案例在 Windows 本機對任何乾淨 worktree 都失敗（路徑問題，CI Linux 通過），與本批次無關。
- 未驗證：真實 Supabase 專案（需 Owner 申請並填入 json）、實機 iPhone。

## 四、截圖（`screens/`）
- `story-01..04`：裂縫＋殘響、`!` 氣泡與威嚇、立繪對話、分支選項。
- `online-04a..e`：帳號與雲端同步面板、引繼碼、好友抽屜、友誼切磋進入對戰。
- `online-05a..f`：密碼對戰房號大廳、房號等待、倒數、開戰；通訊對戰天梯鏡像、開戰。

## 五、後續（需 Owner 決定）
- 新手教學「初入飼育籠共鳴」實機演出（`first-resonance` 章已就緒，等 PR #103 的教學流程穩定後接在邀請接受之後）。
- `futureSystemsPort` 的本機 guestIdentity 鍵與本批次 onlineSession 鍵並存；若 Owner 核准「精簡」，可合併為一個。
- 填入 Supabase 後的真機端到端驗證、CAPTCHA、匿名使用者清理排程。

## 六、檔案清單
```
 assets/production/public-runtime/vendor-supabase.js                         |  11 +
 championship.html                                                           |  21 +
 docs/CURRENT_PRODUCT_STATUS.md                                              |   3 +
 docs/SUPABASE_3MIN_SETUP_ZH_TW.md                                           |  75 ++++
 docs/contracts/championship/PUBLIC_PROGRAM_SOURCES.v1.json                  |   6 +
 docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json                | 120 +++++-
 docs/contracts/championship/WEB_BUILD_INPUTS.v1.json                        | 148 ++++++-
 docs/coordination/OWNER_DIRECTION.md                                        |   5 +
 docs/reports/story-online-2026-10-28/REPORT_ZH_TW.md                        |  53 +++
 .../story-online-2026-10-28/screens/online-04a-account-cloud-panel.png      | Bin 0 -> 274165 bytes
 docs/reports/story-online-2026-10-28/screens/online-04b-transfer-code.png   | Bin 0 -> 286151 bytes
 docs/reports/story-online-2026-10-28/screens/online-04c-friends-drawer.png  | Bin 0 -> 393460 bytes
 .../story-online-2026-10-28/screens/online-04d-friend-spar-start.png        | Bin 0 -> 587996 bytes
 .../story-online-2026-10-28/screens/online-04e-friend-spar-battle.png       | Bin 0 -> 1215198 bytes
 .../story-online-2026-10-28/screens/online-05a-password-room-lobby.png      | Bin 0 -> 435651 bytes
 .../story-online-2026-10-28/screens/online-05b-room-code-waiting.png        | Bin 0 -> 352856 bytes
 docs/reports/story-online-2026-10-28/screens/online-05c-room-countdown.png  | Bin 0 -> 352050 bytes
 .../story-online-2026-10-28/screens/online-05d-room-battle-started.png      | Bin 0 -> 1198135 bytes
 .../story-online-2026-10-28/screens/online-05e-link-ladder-mirror.png       | Bin 0 -> 412657 bytes
 docs/reports/story-online-2026-10-28/screens/online-05f-ladder-battle.png   | Bin 0 -> 1207109 bytes
 docs/reports/story-online-2026-10-28/screens/story-01-rift-echoes.png       | Bin 0 -> 1689763 bytes
 docs/reports/story-online-2026-10-28/screens/story-02-emote-attack.png      | Bin 0 -> 1809694 bytes
 docs/reports/story-online-2026-10-28/screens/story-03-partner-portrait.png  | Bin 0 -> 1842278 bytes
 docs/reports/story-online-2026-10-28/screens/story-04-choice.png            | Bin 0 -> 1660251 bytes
 package-lock.json                                                           | 117 ++++++
 package.json                                                                |   1 +
 scripts/check-locale-coverage.mjs                                           |   4 +
 src/championship/app/ChampionshipPersistentSavePort.js                      |  47 +++
 src/championship/app/championshipStorageGuard.js                            |   7 +
 src/championship/app/championshipToolbar.js                                 |   9 +-
 src/championship/app/friendsDrawer.js                                       | 107 +++++
 src/championship/app/main.js                                                | 170 +++++++-
 src/championship/app/onlineAccountPanel.js                                  | 145 +++++++
 src/championship/app/onlineBattleLobby.js                                   | 138 +++++++
 src/championship/app/raisingHomeP1RView.js                                  |   9 +-
 src/championship/app/ranchStoryBadge.js                                     |  30 ++
 src/championship/app/settings/preferenceSchema.js                           |   2 +
 src/championship/app/settings/settingsPanel.js                              |   5 +-
 src/championship/app/tamerInfoScreen.js                                     |   4 +-
 src/championship/app/ui/online.css                                          |  66 +++
 src/championship/app/ui/storyTheater.css                                    | 163 ++++++++
 src/championship/app/vs5Screens.js                                          |  45 ++-
 src/championship/data/storyRiftChapters.js                                  | 315 +++++++++++++++
 src/championship/online/championshipCloudService.js                         | 133 ++++++
 src/championship/online/cloudSaveEnvelope.js                                |  54 +++
 src/championship/online/localSimulationMode.js                              | 153 +++++++
 src/championship/online/onlineServiceConfig.js                              |  68 ++++
 src/championship/online/pvpRoomSession.js                                   |  80 ++++
 src/championship/online/supabaseLoader.js                                   |  27 ++
 src/championship/online/supabaseMode.js                                     | 145 +++++++
 src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js  |  85 +++-
 src/championship/presentation/story/HybridStoryDirector.js                  | 142 +++++++
 src/championship/presentation/story/portraitVnOverlay.js                    | 152 +++++++
 src/championship/presentation/story/storyStagePuppeteer.js                  | 151 +++++++
 src/championship/text/onlineText.js                                         | 192 +++++++++
 src/championship/text/uiText.en.js                                          |  12 +
 src/championship/text/uiText.ja.js                                          |  12 +
 src/championship/text/uiText.js                                             |  12 +
 src/championship/text/uiText.th.js                                          |  12 +
 src/championship/text/uiText.vi.js                                          |  12 +
 src/data/championship/online-service.v1.json                                |   8 +
 supabase/migrations/001_championship_online.sql                             | 785 ++++++++++++++++++++++++++++++++++++
 tests/championship-ceremony-cases.mjs                                       |   3 +-
 tests/championship-migration-firewall-cases.mjs                             |  19 +-
 tests/championship-online-cloud-service-cases.mjs                           | 198 +++++++++
 tests/championship-online-migration-sql-cases.mjs                           |  65 +++
 tests/championship-public-runtime-boundary-cases.mjs                        |   3 +-
 tests/championship-raising-floating-card-cases.mjs                          |   3 +-
 tests/championship-raising-hint-cases.mjs                                   |   3 +-
 tests/championship-story-rift-cases.mjs                                     | 251 ++++++++++++
 tests/ci-test-scope.v1.json                                                 |   5 +-
 71 files changed, 4552 insertions(+), 59 deletions(-)
```
