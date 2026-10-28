# 社群連結塢 × 數碼通行證 × 首次綁定禮包 × 炫耀名片 交付報告（2026-10-29）

> 分支 `feat/social-brag-online-20261029`（基底 `origin/main` 7442e126）。依 Owner 指令 **未 commit、未 push、未部署**。
> 分類：OWNER_APPROVED_ADAPTATION（呈現層與產品功能）。戰鬥、育成、商店價格與首頁不變。
> 做法：在 2026-10-28 已上線的線上系統上「原地升級」（同一個 `championshipCloudService`、同一個面板、同一份存檔），沒有第二套服務或第二個 Supabase client。

## 一、Phase 1：技能

- `supabase`、`supabase-postgres-best-practices`（supabase/agent-skills）、`emil-design-eng`（emilkowalski/skills）、`game-ui-design` 本機都已安裝，直接載入，沒有再用 `npx` 從網路下載。
- 依 supabase 技能查了現行文件與 changelog：Presence 授權要 `extension in ('broadcast','presence')`；2026-04-28 起新表要明確 grant；2026-07-14 起 realtime schema 禁止 DDL（政策仍可建）。SQL 都照這些寫。
- repo 內 `.claude/skills/juicy-monster-ui/SKILL.md` 已存在（按鍵物理、輸入隔離、真實事件），本批照它做，沒有改寫。

## 二、Phase 2：🌐 拍檔社群連結塢

- 設定檔 `src/championship/config/socialLinksConfig.js`（第 17～20 行貼網址）。只接受 https＋各頻道自己的網域；留空＝「即將開放」。新資料夾 `config` 已加入防火牆白名單，測試會檢查貼進來的網址。
- `socialLinkDock.js`：Discord `#5865F2`、Facebook `#1877F2`、X / Threads `#14171A`、巴哈姆特 `#00B4D8`。沿用遊戲既有的街機按鍵物理（3px 深色框、頂部內高光、5px 硬底、`cubic-bezier(0.34, 1.56, 0.64, 1)` 彈簧上浮傾斜、斜向流光），按下 40ms 下沉；沒有連結的鍵不會動、改播 denied 音效。
- 外連用 `target="_blank" rel="noopener noreferrer"`，主畫面 App 點了不會蓋掉遊戲。
- 出現在：牧場【選單】最下方（通行證條＋2×2 連結塢）、【馴獸師資料】最下方。

## 三、Phase 3：帳號綁定、好友、多人對戰底座

### SQL（`supabase/migrations/001_championship_online.sql`，可重複執行，舊專案再跑一次即升級）
- 名片 `tamer_profiles` 新增 `bind_reward_claimed`、引繼碼猜錯次數欄位；**名片列改為只能透過 RPC 改寫**（F12 改不到領獎旗標）。
- 第 5 張表 `bind_reward_claims`：首次綁定帳本，RLS 開啟、刻意不建政策也不給權限，只有 RPC 讀寫；刪除線上資料不會清掉它。
- `claim_bind_reward(p_save_ref)`：以 `auth.users.is_anonymous` 與 `auth.identities` 判斷是否已綁 Google／Facebook／Discord／Email；每帳號一次，同一份存檔重問（入帳前當機）會拿到同樣答案。
- 引繼碼改 6 碼（`gen_random_bytes`）、15 分鐘、一次有效，每帳號 10 分鐘內猜錯 5 次即暫停。
- 房間頻道 `pvp:<id>`：Broadcast（狀態推播）＋ Presence（對手在線），只有房主與挑戰者能收發。
- 名稱對照：需求的 `pvp_rooms` 沿用已上線的 `pvp_matches`；`cloud_save_json` 放在只有本人能讀的 `tamer_cloud_saves.payload`（放名片表會被好友讀到）。

### 🪪 數碼通行證（`onlineAccountPanel.js` 原地升級）
- 狀態徽章 🟢 遊客通行證／🏆 已綁定正式帳號，三顆大鍵【G 綁定 / 登入 Google 帳號】【f …Facebook…】【🎮 …Discord…】。雲端模式走 `linkIdentity`（遊客 uid 不變、進度不洗），該帳號已屬別人時提示改用它登入。
- 本地模擬：按鍵會先跳「🧪 本地模擬授權」說明，同意後在此頁面內變成已綁定，接著顯示禮包**預覽**（不入帳）。
- iPhone 主畫面 App（`navigator.standalone`）：自動把「🔑 6 碼引繼碼／✉️ Email 驗證碼」移到最上面並說明原因。
- 選單只放精簡條（徽章、代碼、三顆鍵、▸ 開完整面板）；只是打開選單或馴獸師資料**不會**登入雲端，按下按鈕才會。

### 🎁 首次綁定大禮包
- 5,000 位元幣（遊戲唯一的真實貨幣；鑽石只存在於好友試玩模式的測試錢包，所以沒有發鑽石）。
- 入帳：`claimOnlineBindReward` 把位元幣與存檔 `flags.onlineBindReward` 一次寫入；存檔失敗兩者都不變。沒領過的存檔格式完全不變、schemaVersion 不變。存檔檔案的雜湊釘改由新合約 `docs/contracts/championship/ONLINE_BIND_REWARD_20261029.json` 記錄。

### 📱 vs ☁️ 存檔衝突仲裁器（`saveConflictArbiter.js`）
- 並排卡片：馴獸師、階級、天數、位元幣、拍檔數量、最後更新、裝置；較多／較新會標籤。
- 觸發：備份遇到較新的雲端、從雲端還原、Email 登入或 OAuth 回來、輸入引繼碼。選項：稍後再決定（預設焦點）／使用雲端／保留本機；另有「💾 先下載本機備份」。永遠不自動覆蓋。

### 對戰大廳（實際檔案是 `vs5Screens.js`，需求寫的 `vs2Screens.js` 沒有這兩個面板）
- 【密碼對戰】：同一帳號身分條、建立 4 碼房間／輸入房號加入、🟢 對手在線（Presence）、複製房號、等待時可直接【📸 生成炫耀名片】（印上房號）、挑戰好友的 AI 防守隊伍清單。
- 【通訊對戰】：同一帳號身分條＋⚡ 快速配對／🏆 天梯鏡像。

## 四、Phase 4：📸 炫耀名片（`tamerBragCardGenerator.js` ＋ `bragCardPreview.js`）

- 入口：【馴獸師資料】頂部大鍵、對戰勝利結算（我方獲勝時）、密碼對戰房間等待中。
- 按下：120ms 白色閃光＋新的 `shutter` 快門音（arcadeFx 合成音），離屏 Canvas 2x 合成：橫式 2400×1350、直式 1440×2560。
- 內容：賽博網點與蜂巢暗紋、斜切金框、官方標題燙金徽章、王牌（或勝利）拍檔的圖鑑立繪＋屬性光環底座（疫苗藍、病毒紫紅、資料綠、自由金）、馴獸師名、階級勳章、育成執照、勝率、對戰次數、圖鑑完成度、位元幣、【👥 好友邀請碼】、開房中的【⚔️ 對戰房號】、遊戲網址與裝飾條碼。全部程序繪製，唯一圖片是同源公開立繪。
- 跨域保護：非同源圖片以 CORS 載入；合成後若畫布仍被汙染就**不畫立繪重畫一次**，所以 `toDataURL`／`toBlob` 不會拋 `SecurityError`。
- 預覽視窗：`<img>` 直接顯示（iPhone 長按 ➔ 加入照片；已解除對話框對長按的封鎖）、橫式／直式切換、【📤 呼叫系統分享】（`navigator.share` 帶 PNG 檔）、【💾 下載名片 PNG】、【📋 複製邀請文案＋好友碼】（不支援剪貼簿時改顯示文字讓玩家長按複製）。

## 五、Phase 5：指南

- 新增 `docs/SOCIAL_AND_MULTIPLAYER_SETUP_ZH_TW.md`：要改的兩個檔案與行號、一鍵 SQL、Google Cloud Console／Meta for Developers／Discord Developer Portal 步驟、Redirect URLs（結尾 `**`）、驗證清單、iPhone 主畫面須知與常見問題。舊的三分鐘指南已加上指向新版的說明並更新 6 碼、5 張表。

## 六、驗證

- `npm run test:ci`：**3,109 / 3,109 通過**（409 個 portable 模組，0 失敗）。第一次跑出 9 項失敗，都已處理：8 項是 `championship-battle-navigation-loading-cases.mjs` 在 VM 沙盒裡執行 `mountBattleResult`，新加的勝利名片鉤子需要在沙盒補一個 stub；1 項是 `championship-lion-display-correction-cases.mjs` 釘住存檔模組的雜湊，改由本批新合約記錄（沿用 10-26、10-28 批次的做法）。
- 瀏覽器閘門 `tests/championship-social-brag-browser.cjs`（拒絕 8732，需 `CHAMPIONSHIP_QA_URL` 指向隔離伺服器）：15 項全過。
- 本批新增或更新的測試：`championship-social-brag-cases.mjs`（17 項：連結白名單、連結塢、五語系文案、名片資料邊界、兩種版型都畫出關鍵文字、2x 匯出非空 PNG、汙染時改無立繪重畫、匯出被擋時的錯誤、預覽的分享／下載／複製、仲裁器、禮包一次性與存檔標記、模擬只預覽、雲端轉接頭的 linkIdentity／RPC／Presence、6 碼引繼碼、房間 Presence、只顯示不登入）；`championship-storage-guard-cases.mjs` 新增 2 項（離線社群流程與入帳都只碰產品存檔鍵）；SQL 靜態檢查新增 4 項；防火牆加入 `config` 與連結檢查。
- `build:playtest`＋`validate:playtest` 通過（8,304 檔，buildId `20ad5c2ae4551db3064a22f2e43ccd6e5367b17ba543f7d8fe234f72bc0c44d9`）；新模組已登錄 `WEB_BUILD_INPUTS` 與 `PUBLIC_RUNTIME_ALLOWLIST`，但沒有部署。
- 手機直向實機流程（Playwright，iPhone 390×844@3x，模擬主畫面 App，隔離埠 127.0.0.1:8802）15 項全過：選單通行證條＋連結塢、Google 模擬綁定＋禮包預覽、主畫面 App 版通行證＋6 碼引繼碼、綁定後馴獸師資料不再顯示遊客、無水平溢出、橫直式名片 PNG（簽章正確、2400×1350／1440×2560）、邀請文案、本機 vs 雲端仲裁器（第 2 天 vs 第 1 天，稍後再決定不改任何東西）、通訊對戰同一身分、建立 4 碼房間、對手在線、倒數後開打、儲存鍵只有既有產品鍵、零 page error。

## 七、與需求不同的地方（請 Owner 確認）

1. 資料表名稱沿用已上線的 `pvp_matches`、`tamer_cloud_saves.payload`（理由見第三節）；多了一張帳本表 `bind_reward_claims`。
2. 禮包只發位元幣，金額 5,000（可在 SQL 與 `onlineBindRewardPolicy.js` 一起改）。
3. 本地模擬不入帳，只預覽，避免模擬領過後正式上線就不能再領。
4. 6 碼引繼碼為安全起見只有 15 分鐘有效並限制猜測次數（原本 8 碼 24 小時）。
5. 四個社群連結目前都是「即將開放」，等 Owner 提供網址。
6. 名片 PNG 約 4.4 MB（橫）／4.9 MB（直），來源是高解析立繪與漸層；分享到 LINE／FB 會被平台再壓縮。

## 八、尚未驗證

- 真實 Supabase 專案、Google／Facebook／Discord 真正的 OAuth 往返（需要 Owner 建專案與開發者帳號；Facebook 還需切換上線模式）。
- 真實 iPhone：主畫面 App、系統分享抽屜、長按存相簿（Playwright 的 Chromium 沒有檔案分享，所以分享鍵顯示「不支援」的路徑）。

## 九、截圖（`screens/`）

| 圖 | 檔案 |
|---|---|
| 圖 1 社群連結塢＋數碼通行證 | `fig1a-menu-passport-dock.png`（選單）、`fig1b-tamer-passport-ios-6code.png`（主畫面 App：6 碼引繼碼）、`fig1c-tamer-passport-dock.png`（馴獸師資料）、`fig1d-provider-sim-consent.png`、`fig1e-first-bind-gift.png` |
| 圖 2 本機 vs 雲端仲裁器 | `fig2-save-chooser.png` |
| 圖 3 炫耀名片預覽 | `fig3a-brag-preview-landscape.png`、`fig3b-brag-preview-portrait.png` |
| 圖 4 多人配對房間 | `fig4a-password-room-waiting.png`、`fig4b-room-opponent-online.png`、`fig4c-link-quick-lobby.png` |

## 十、檔案清單

新增：

```
docs/SOCIAL_AND_MULTIPLAYER_SETUP_ZH_TW.md
docs/contracts/championship/ONLINE_BIND_REWARD_20261029.json
docs/reports/social-brag-2026-10-29/REPORT_ZH_TW.md（＋ screens/ 11 張）
src/championship/config/socialLinksConfig.js
src/championship/app/socialLinkDock.js
src/championship/app/saveConflictArbiter.js
src/championship/app/bindRewardPopup.js
src/championship/app/bragCardPreview.js
src/championship/app/onlineBindRewardPolicy.js
src/championship/app/ui/social.css
src/championship/presentation/tamerBragCardGenerator.js
src/championship/text/socialText.js
tests/championship-social-brag-cases.mjs
tests/championship-social-brag-browser.cjs
```

修改：

```
championship.html（載入 social.css）
docs/CURRENT_PRODUCT_STATUS.md、docs/coordination/OWNER_DIRECTION.md、docs/SUPABASE_3MIN_SETUP_ZH_TW.md
docs/contracts/championship/WEB_BUILD_INPUTS.v1.json、PUBLIC_RUNTIME_ALLOWLIST.v1.json
scripts/check-locale-coverage.mjs（登錄 socialText）
src/championship/app/main.js、onlineAccountPanel.js、onlineBattleLobby.js、championshipToolbar.js、tamerInfoScreen.js、vs5Screens.js
src/championship/app/championshipStandaloneApp.js、championshipStandaloneSave.js、ChampionshipPersistentSavePort.js、ui/arcadeFx.js
src/championship/online/championshipCloudService.js、cloudSaveEnvelope.js、localSimulationMode.js、onlineServiceConfig.js、pvpRoomSession.js、supabaseMode.js
src/championship/text/onlineText.js、src/data/championship/online-service.v1.json
supabase/migrations/001_championship_online.sql
tests/championship-online-cloud-service-cases.mjs、championship-online-migration-sql-cases.mjs、championship-migration-firewall-cases.mjs、
tests/championship-storage-guard-cases.mjs、championship-battle-navigation-loading-cases.mjs、championship-lion-display-correction-cases.mjs、ci-test-scope.v1.json
```
