# Supabase 三分鐘開通指南（遊客／帳號、雲端備份、好友、連線對戰）

> 對象：不熟後端的 Owner。照著做，不需要寫任何程式。
> 遊戲永遠「離線優先」：這份設定沒填之前、或玩家斷網時，所有線上面板都以 **本地模擬模式** 運作，遊戲本體與存檔完全不受影響。

## 要貼在哪一行（最重要）

打開 [`src/data/championship/online-service.v1.json`](../src/data/championship/online-service.v1.json)：

```json
{
  "schemaVersion": 1,
  "supabaseUrl": "",          ← 第 3 行：貼 Project URL（https://xxxxxxxxxxxxxxxxxxxx.supabase.co）
  "supabaseAnonKey": "",      ← 第 4 行：貼 publishable key（sb_publishable_…）或舊版 anon key（eyJ…）
  "googleSignIn": false,
  "roomCodeLength": 4
}
```

兩個值都填好、存檔、重新整理遊戲，右上角「☁️ 帳號與雲端同步」面板就會從「本地模擬」變成「雲端已連線」。

**絕對不要貼** `sb_secret_…` 或 `service_role` 開頭是 `eyJ…` 但標示 service_role 的金鑰。遊戲前端會直接拒絕這種金鑰並維持離線（它能繞過所有安全鎖，只能放在伺服器）。

## 步驟

### 1. 建立免費專案（約 1 分鐘）
1. 到 supabase.com → **New project**。
2. Region 選 **Northeast Asia (Tokyo)** 或 **Southeast Asia (Singapore)**。
3. 記下資料庫密碼（之後不太會用到）。等專案狀態變成 Active。

### 2. 貼 SQL（約 30 秒）
1. 左側 **SQL Editor** → **New query**。
2. 把整份 [`supabase/migrations/001_championship_online.sql`](../supabase/migrations/001_championship_online.sql) 複製貼上 → **Run**。
3. 看到 `Success. No rows returned` 就完成。可以重複執行，不會壞。

它建立了 4 張表（`tamer_profiles`、`tamer_cloud_saves`、`friendships`、`pvp_matches`）、每張表的 RLS 安全鎖（只有本人能改自己的列），以及遊戲會呼叫的 RPC 函式。

### 3. 開啟登入方式（約 30 秒）
左側 **Authentication → Sign In / Providers**：
- **Anonymous sign-ins**：開啟（遊客通行證需要）。
- **Email**：開啟。建議同時開 **Confirm email**。遊戲用「6 位數驗證碼」綁定 Email，不需要密碼。
- **Google**（選用）：需要先在 Google Cloud 建 OAuth client；沒做就把 json 的 `googleSignIn` 留 `false`，按鈕會自動隱藏。
- **Allow manual linking**（在 Authentication → Settings 底下）：開啟，遊客才能「無痛升級」成正式帳號而不洗掉進度。

建議（防濫用）：Authentication → **Attack Protection** 開啟 Captcha（Turnstile）後，遊戲會在 json 多一個 `captcha` 欄位時使用；沒開也能玩。

### 4. 設定允許的網址（約 30 秒）
**Authentication → URL Configuration**：
- Site URL：`https://orochi771127.github.io/championship-2026/`
- Redirect URLs 加入：`https://orochi771127.github.io/championship-2026/**` 與 `http://127.0.0.1:8732/**`（本機測試）。

### 5. 複製兩個值
**Project Settings → API Keys**：
- **Project URL** → 貼到 json 第 3 行 `supabaseUrl`。
- **Publishable key**（`sb_publishable_…`；舊專案叫 anon public）→ 貼到第 4 行 `supabaseAnonKey`。

### 6. 驗證
1. 本機開遊戲 → 選單 → **☁️ 帳號與雲端同步**：應顯示「🟢 遊客通行證（ID: TM-XXXX-XXXX）· 雲端已連線」。
2. 按 **立即雲端備份**：Supabase → Table Editor → `tamer_cloud_saves` 會多一列。
3. 第二支手機／瀏覽器：**跨裝置引繼碼** 貼上第一台產生的 8 碼，存檔就複製過去。
4. **👥 好友**：互相輸入 TM 碼 → 對方在申請列表按接受 → 卡片右側出現 **⚔️ 友誼切磋**。
5. **對戰 → 密碼對戰**：一台「建立房間」拿到 4 位房號，另一台「輸入房號加入」，倒數後兩邊各自開打同一場。

## 常見問題

- **免費方案會不會被停？** 免費專案 7 天沒有任何請求會自動暫停；玩家一打開遊戲（有連線）就算請求。暫停時遊戲自動退回本地模擬，不會壞。到 Dashboard 按 Restore 即可。
- **匿名遊客會累積嗎？** 會。SQL 最後一段附了清理 30 天以上匿名使用者的建議；或在 Dashboard 的 Authentication → Users 手動清。
- **可以防作弊嗎？** RLS 只保證玩家改不了「別人的」資料。遊戲本體仍在玩家裝置上計算，密碼／通訊對戰勝負由雙方各自回報，不一致會標成 `disputed`。這不是反作弊系統。
- **想換 Firebase？** 只要替換 `src/championship/online/supabaseMode.js` 這一個轉接頭；介面、本地模擬與存檔規則都不用動。
- **把 key 推上 GitHub 安全嗎？** publishable/anon key 本來就是給瀏覽器用的公開金鑰，安全靠 RLS。`sb_secret_` 永遠不能進 repo。

## 這份設定會改動遊戲的什麼

- 新增一個本機儲存鍵 `championshipModernSave:onlineSession:v1`（只在雲端連線後、玩家開啟線上功能時才會出現），存 Supabase 的登入工作階段；離線遊玩時完全不存在。
- 遊戲存檔鍵、存檔格式、戰鬥規則、獎勵結算都沒有變。
