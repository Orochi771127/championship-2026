# 社群連結、帳號綁定與多人連線：零基礎 5 分鐘開通指南

> 對象：沒碰過後端的 Owner。照著做，不用寫程式。
> 這份指南取代並延伸 [`SUPABASE_3MIN_SETUP_ZH_TW.md`](SUPABASE_3MIN_SETUP_ZH_TW.md)（舊指南仍有效）。
>
> 遊戲永遠「離線優先」：下面的設定還沒填、或玩家斷網時，所有線上畫面（數碼通行證、好友、房號連線、首次綁定禮包）都會以 **本地模擬模式** 運作，可以先點點看介面；遊戲本體與存檔完全不受影響。填好之後，帳號綁定、雲端存檔、好友與多人連線房間會共用同一個 Supabase 專案與同一個連線，不需要第二台伺服器。

---

## 0. 先看這裡：只要改兩個檔案

### A. 雲端（Supabase）：`src/data/championship/online-service.v1.json`

```json
{
  "schemaVersion": 1,
  "supabaseUrl": "",          ← 第 3 行：貼 Project URL（https://xxxxxxxxxxxxxxxxxxxx.supabase.co）
  "supabaseAnonKey": "",      ← 第 4 行：貼 publishable key（sb_publishable_…）或舊版 anon key（eyJ…）
  "googleSignIn": false,
  "oauthProviders": [],       ← 第 6 行：列出你在 Supabase 開啟的登入方式，例如 ["google", "facebook", "discord"]
  "roomCodeLength": 4,
  "note": "…"
}
```

第 3、4 行都填好、存檔、重新整理遊戲，「🪪 數碼通行證」就會從「本地模擬（尚未設定雲端）」變成「雲端已連線」。
第 6 行沒列到的登入方式，按鈕仍會顯示，但按下去會提示「尚未開通」，不會把玩家送去一個會失敗的登入頁。

**絕對不要貼** `sb_secret_…`，也不要貼標示 `service_role` 的 `eyJ…` 金鑰。遊戲前端會直接拒絕這兩種金鑰並維持離線（它們能繞過所有安全鎖，只能放在伺服器）。

### B. 社群連結：`src/championship/config/socialLinksConfig.js`

第 17～20 行，把連結貼進每一行 `url: ""` 的引號中間：

| 行 | 按鈕 | 允許的網址開頭 |
|---|---|---|
| 17 | 🎮 Discord 官方社群 | `https://discord.gg/…`、`https://discord.com/…` |
| 18 | 📘 Facebook 粉絲專頁／社團 | `https://www.facebook.com/…`、`https://facebook.com/…`、`https://m.facebook.com/…` |
| 19 | 🐦 X / Threads 官方動態 | `https://x.com/…`、`https://twitter.com/…`、`https://www.threads.net/…`、`https://www.threads.com/…` |
| 20 | 🔥 巴哈姆特討論區 | `https://forum.gamer.com.tw/…`、`https://home.gamer.com.tw/…` |

- 留空的按鈕會顯示「即將開放」，按下去只會出現「敬請期待」，不會開任何網頁。
- 只接受 `https` 加上表格裡的網域；貼錯網域時遊戲會當成留空，自動測試（`championship-migration-firewall-cases.mjs`）也會擋下來，避免連結被換成釣魚網站。
- 每個連結都用新分頁開啟（`target="_blank" rel="noopener noreferrer"`），iPhone「加入主畫面」的 App 點了也不會把遊戲蓋掉。

---

## 1. 建立免費 Supabase 專案（約 3 分鐘）

1. 到 supabase.com 註冊／登入 → **New project**。
2. Region 選 **Northeast Asia (Tokyo)** 或 **Southeast Asia (Singapore)**（離台灣近）。
3. 設一組資料庫密碼（記起來就好，之後幾乎用不到），按 Create，等狀態變成 **Active**。

## 2. 一鍵建好帳號庫、好友庫與多人對戰伺服器（約 30 秒）

1. 左側 **SQL Editor** → **New query**。
2. 打開 [`supabase/migrations/001_championship_online.sql`](../supabase/migrations/001_championship_online.sql)，**整份複製**貼上 → 按 **Run**。
3. 看到 `Success. No rows returned` 就完成。這份 SQL 可以重複執行；以前跑過 10-28 版的專案，直接再跑一次就會升級。

它一次建立：

| 用途 | 資料表／功能 |
|---|---|
| 馴獸師名片：好友碼 `TM-XXXX-XXXX`、名字、階級、王牌、AI 防守隊伍、`bind_reward_claimed` | `tamer_profiles` |
| 雲端存檔備份（只有本人能讀寫；6 碼引繼碼也在這） | `tamer_cloud_saves` |
| 好友申請與好友名單 | `friendships` |
| 通訊對戰配對、密碼對戰 4～6 碼房間、戰鬥亂數種子、雙方回報 | `pvp_matches` |
| 首次綁定禮包帳本（前端完全碰不到） | `bind_reward_claims` |
| 房間即時推播（Broadcast）＋「對手在線」（Presence） | `realtime.messages` 的私有頻道政策 `pvp:<房間 id>` |

另外還有：每張表的 **RLS 安全鎖**（只有本人能改自己的資料）、一組遊戲專用的 RPC 函式（遊戲只透過它們改資料，F12 也繞不過）。

> 和最初需求的名稱對照：需求裡的 `pvp_rooms` 就是這裡的 `pvp_matches`（10-28 版已上線，房間＝對戰）；需求裡的 `cloud_save_json` 放在 `tamer_cloud_saves.payload`。**刻意不放在名片表**：好友可以讀你的名片，存檔若放在同一列就會被好友讀走。

## 3. 開啟登入方式（約 1 分鐘）

左側 **Authentication → Sign In / Providers**：

1. **Allow anonymous sign-ins**：開啟（遊客通行證要用）。
2. **Email**：開啟。遊戲用「6 位數驗證碼」綁定或登入 Email，不用密碼（主畫面 App 也能在 App 內完成）。
3. **Allow manual linking**：開啟。沒有它，遊客就無法「無損升級」成 Google／Facebook／Discord 帳號。
4. Google、Facebook、Discord 要先在各自的開發者網站拿到 **Client ID** 與 **Secret**，見下面第 4～6 步。

> 每一個登入方式的設定頁上都會顯示一行 **Callback URL (for OAuth)**，長得像
> `https://你的專案代號.supabase.co/auth/v1/callback`。等一下三個開發者網站都要貼這一行，先把它複製起來。

## 4. Google：Google Cloud Console（約 3 分鐘）

1. 到 console.cloud.google.com → 上方選擇（或新增）一個專案。
2. **API 和服務 → OAuth 同意畫面**：使用者類型選 **外部**，填應用程式名稱「網線拍檔：錦標賽」與支援信箱，存檔。
3. **API 和服務 → 憑證 → 建立憑證 → OAuth 用戶端 ID**：
   - 應用程式類型：**網頁應用程式**。
   - 已授權的重新導向 URI：貼上第 3 步複製的 Supabase **Callback URL**。
4. 建立後會跳出 **用戶端 ID** 與 **用戶端密鑰** → 回到 Supabase 的 **Google** 設定，分別貼到 Client ID 與 Client Secret → 開啟 → **Save**。
5. 回遊戲專案，把 `"google"` 加進 json 第 6 行的 `oauthProviders`。

## 5. Facebook：Meta for Developers（約 4 分鐘）

1. 到 developers.facebook.com → **我的應用程式 → 建立應用程式**，用途選「使用 Facebook 登入驗證並要求用戶資料」。
2. 建好後到 **使用案例 → Facebook 登入 → 設定**：在 **有效的 OAuth 重新導向 URI** 貼上 Supabase **Callback URL**，儲存。
3. **應用程式設定 → 基本資料**：複製 **應用程式編號** 與 **應用程式密鑰**（按「顯示」）；同一頁要填 **隱私政策網址**。
4. 回到 Supabase 的 **Facebook** 設定：應用程式編號貼到 Client ID、密鑰貼到 Secret → 開啟 → **Save**。
5. 把應用程式切換成 **上線（Live）** 模式；開發模式下只有你自己的測試帳號能登入。
6. 回遊戲專案，把 `"facebook"` 加進 json 第 6 行。

## 6. Discord：Discord Developer Portal（約 2 分鐘）

1. 到 discord.com/developers/applications → **New Application**，取名後建立。
2. 左側 **OAuth2**：在 **Redirects** 按 Add Redirect，貼上 Supabase **Callback URL** → **Save Changes**。
3. 同一頁複製 **Client ID**；按 **Reset Secret** 產生並複製 **Client Secret**（只會顯示一次）。
4. 回到 Supabase 的 **Discord** 設定，貼上兩個值 → 開啟 → **Save**。
5. 回遊戲專案，把 `"discord"` 加進 json 第 6 行。

## 7. 允許的網址（約 30 秒）

**Authentication → URL Configuration**：

- **Site URL**：`https://orochi771127.github.io/championship-2026/`
- **Redirect URLs** 加入：
  - `https://orochi771127.github.io/championship-2026/**`（結尾的 `**` 一定要有：遊戲會帶著 `?cm_link=google` 這種參數回來，用來知道是哪個登入方式）
  - 本機測試再加：`http://127.0.0.1:8732/**`

## 8. 把兩個值貼回遊戲（約 30 秒）

**Project Settings → API Keys**：

- **Project URL** → 貼到 json **第 3 行** `supabaseUrl`。
- **Publishable key**（`sb_publishable_…`；舊專案叫 anon public）→ 貼到 json **第 4 行** `supabaseAnonKey`。

存檔、重新整理遊戲，整套「Google／Facebook／Discord 登入 ＋ 雲端存檔 ＋ 好友系統 ＋ 多人連線對戰」就正式通電。

## 9. 驗證清單

1. 牧場 →【選單】：最下面的通行證條應顯示「🟢 遊客通行證」與你的 `TM-XXXX-XXXX`；社群連結塢有四顆按鈕。
2. 按【G Google】→ 跳到 Google 同意頁 → 回到遊戲按「繼續遊戲」→ 跳出「🎁 首次綁定大禮包！+5,000 位元幣」。再按一次不會重領（每個帳號一次，每份存檔也只領一次）。
3. 【馴獸師資料】→ 數碼通行證 →【立即雲端備份】：Supabase → Table Editor → `tamer_cloud_saves` 多一列。
4. 在另一台裝置（或 iPhone 主畫面 App）登入同一個帳號：如果雲端存檔和本機不一樣，會跳出「📱 本機進度 vs. ☁️ 雲端進度」並排卡片，由你選擇；不會自動覆蓋。
5. 【產生 6 碼引繼碼】→ 在新裝置【輸入引繼碼】：15 分鐘內、一次有效。
6. 【對戰】→【密碼對戰】→【建立房間】拿到 4 位房號 → 另一台【輸入房號加入】→ 兩邊都看到「🟢 對手在線」，倒數後各自開打同一場。等待時按【📸 生成炫耀名片】，名片會印上「⚔️ 對戰房號」。
7. 【通訊對戰】→【⚡ 快速配對】或【🏆 天梯鏡像】：抽其他玩家的防守隊伍來一場 AI 鏡像戰。

## iPhone「加入主畫面」須知

- 主畫面 App 和 Safari 的存檔是**分開**的。從 Safari 改用主畫面 App 時，先在 Safari 的通行證按【產生 6 碼引繼碼】，再到主畫面 App 輸入。
- 主畫面 App 裡按 Google／Facebook／Discord 會被 iOS 送到 Safari 登入，回來時登入狀態可能留在 Safari。遊戲偵測到主畫面 App 時，會把「🔑 6 碼引繼碼／✉️ Email 驗證碼」放在最上面：這兩種方式都在 App 內完成，不用跳出去。
- 炫耀名片在 iPhone 上請**長按圖片 →「加入照片」**存到相簿；主畫面 App 不支援一般的下載按鈕。

## 常見問題

- **免費方案會不會被停？** 免費專案 7 天沒有任何請求會自動暫停；暫停時遊戲自動退回本地模擬，不會壞。到 Dashboard 按 Restore 即可。
- **首次綁定禮包會被洗嗎？** 不會。伺服器帳本 `bind_reward_claims` 每個帳號只有一列，前端沒有權限改；存檔本身也記錄「已領」，同一份存檔換帳號也不會再發。模擬模式只顯示預覽，不入帳。想改金額：SQL 裡 `claim_bind_reward` 的 `v_reward` 和 `src/championship/app/onlineBindRewardPolicy.js` 的 `ONLINE_BIND_REWARD_BITS` 要一起改（遊戲會取兩者較小值）。
- **6 碼引繼碼安全嗎？** 6 碼約 10 億種組合，所以只有 15 分鐘有效、用過即失效，而且每個帳號 10 分鐘內猜錯 5 次就會暫停。引繼碼複製的是「存檔內容」，不是把帳號交出去。
- **可以防作弊嗎？** RLS 只保證玩家改不了「別人的」資料。遊戲仍在玩家裝置上計算，對戰勝負由雙方各自回報，不一致會標成 `disputed`。這不是反作弊系統。
- **把 key 推上 GitHub 安全嗎？** publishable／anon key 本來就是給瀏覽器用的公開金鑰，安全靠 RLS。`sb_secret_` 永遠不能進 repo。
- **匿名遊客會累積嗎？** 會。可在 Dashboard 的 Authentication → Users 清理；SQL 最後一段附了開 pg_cron 時自動清過期房間的排程。

## 這份設定會改動遊戲的什麼

- 雲端連線後，玩家開啟線上功能時才會出現一個本機儲存鍵 `championshipModernSave:onlineSession:v1`（存 Supabase 登入工作階段）；離線遊玩完全不存在。
- 首次綁定禮包入帳時，存檔的 `flags` 會多一個 `onlineBindReward`（何時、哪種方式、多少位元幣）；沒領過的存檔格式完全不變。
- 戰鬥規則、獎勵結算、首頁都沒有變。
