# 全系統巡檢與第二批修正（2026-11-08）

狀態：工作分支 `claude/inspiring-mayer-gyxhot`，草稿 PR #194，**未合併、未發布**。S1–S5 的公開建置雜湊都已由 Owner 核准並套用（見第 8 節）；合併與部署不在核准範圍內。

## 1. 做法：用證據盤點，不靠逐檔閱讀

依網頁遊戲團隊常見的穩定性做法，本批分四層：

1. **崩潰一致性（crash consistency）**：在「花費／獲得」的交易點逐步存檔、中途重新載入，驗證存檔永遠處在一致狀態。S1、S2、S4 屬此類。
2. **自動化場景巡檢 bot**（`tests/championship-system-sweep-browser.cjs`）：在未修改的正式建置產物上，用完整 QA 存檔遍歷牧場能到達的每個入口並返回，多輪重複；每輪回到閒置牧場後量測生命週期不變量。
3. **記憶體鑑識**：看到成長趨勢時，不直接改程式。先用精確的 heap 量測畫曲線，再比對兩份 heap snapshot：找出兩次快照之間新增、而且還活著的物件，並追出是誰保留了它們。
4. **依證據分級修正**：只修「已重現」的問題；看起來可疑、但沒有證據的項目只記錄，不改。

所有數字都是雲端 Chromium 153（SwiftShader 軟體 WebGL）、Pixel 7 模擬下的量測，**不是 iPhone 實測**。樣本少，只判斷方向。

## 2. 巡檢範圍

| 類別 | 項目 |
|---|---|
| 快速入口 | 商店、圖鑑、狩獵（選場地）、對戰（選比賽） |
| 系統選單 | 背包、探索手帳、故事、徽章、好友、帳號（設定→資料）、說明、設定 |
| 管理選單 | 夥伴、設施配置、馴獸師、賽程 |
| 流程 | 儲存並離開→標題→繼續遊戲；背景／前景（合成的 `visibilitychange`）；連點快速入口；**進入狩獵場並返回** |
| 花費／獲得點（讀程式碼審查，約 25 項交易） | 轉蛋、覺醒、催化、商店、狩獵入場與結算、對戰報名與結算、錦標賽、換日、信件、發現與散步、設施、照護、綁定獎勵、轉生、牧場訓練 |

**未涵蓋（下一批）**：對戰場內打完一場到結算、捕捉、孵化的瀏覽器巡檢；Data Arena；iOS 真實的背景暫停。對戰與換形態的正確性已由 CI 的「Friends playtest」「Alternate forms」真實瀏覽器驗收涵蓋，但它們不量資源洩漏。

基準：`e7ea6bb9`（#193 合併後，buildId `208f6824…` 與正式站相同）。

## 3. 巡檢結果

### 3.1 全入口 4 輪（19 項 × 4 = 76 次往返）

全部能返回，`pageerror` 0、未處理 rejection 0。連點只發生一次轉換（SHOP→RAISING_HOME）。返回標題後繼續遊戲每輪皆正常。

| 指標（回到閒置牧場時） | 基準 | 第1輪 | 第2輪 | 第3輪 | 第4輪 | 判讀 |
|---|---|---|---|---|---|---|
| 全域監聽器（window/document） | 86 | 89 | 89 | 89 | 89 | 穩定（好友抽屜首次開啟時惰性加 3 個） |
| interval／Blob URL／已連接 DOM 節點 | 2／3／379 | 2／3／410 | 2／3／410 | 2／3／410 | 2／3／410 | 穩定 |
| 每幀 rAF 回呼 | 3 | 3 | 3 | 3 | 2 | 沒有重複的動畫迴圈 |
| Worker 建立／結束 | 9／1 | 57／49 | 105／97 | 153／145 | 201／193 | 每輪建立的都有結束 |
| WebGL context 建立／丟失／仍連在 DOM | 4／1／2 | 18／15／2 | 32／29／2 | 46／43／2 | 60／57／2 | 每輪建立的 context 都有丟失（GPU 端已釋放） |

### 3.2 常駐 context 的 GPU 物件（逐 context 記帳，3 輪）

只統計仍連在頁面上的 context：一個固定為紋理 25／緩衝 89／framebuffer 4，另一個為紋理 6／緩衝 2→4／framebuffer 3。**沒有 GPU 物件累積。**

### 3.3 狩獵場重複往返：先前的「heap 每趟 +2 MB」不成立

巡檢 bot 讀 `performance.memory`，6 趟從 42 MB 漲到 80 MB。這個 API 的數值經過量化，而且混進了巡檢插樁本身。改用 CDP `Runtime.getHeapUsage`（強制 GC 3 次後讀取），不加插樁，連跑 16 趟：

| 趟數 | 0 | 1 | 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|
| V8 heap（MB） | 27.3 | 45.2 | 47.4 | 49.1 | 48.9 | 48.2 | 49.9 | 49.8 | 49.8 | 51.6 |

第 2–16 趟的線性斜率是 **+0.22 MB／趟**，雜訊約 ±1 MB。比對第 4 趟與第 16 趟的 heap snapshot，12 趟共多 4.2 MB，拆開來是：

| 來源 | 12 趟增量 | 性質 |
|---|---|---|
| V8 編譯後的程式碼（code） | +1.67 MB | JIT 分層編譯，不是遊戲狀態 |
| `blink::NetworkResourcesData` | +0.68 MB | DevTools 網路面板記錄，只有量測時存在 |
| 照護圖 `<img>`：每趟 16 個不會被回收 | 192 個元素 | **洩漏，已修（第 4 節 S3）** |
| 舊的 Three.js renderer：每趟 2 個不會被回收 | 24 個 `WebGL2RenderingContext` | **洩漏，Three r185 的行為（第 6 節）** |
| 其餘（陣列、幾何緩衝、物件） | 約 +1.5 MB | 大部分是當下這次牧場掛載的資料，取代了舊的那份 |

結論：狩獵流程**沒有大的記憶體洩漏**。真正由遊戲累積的量約 0.1 MB／趟，來源已確定為兩個小洩漏。

### 3.4 有上限的滯留：Pixi 事件池抓住上一個畫面

整個產品共用一個 Pixi Application，啟用 `globalMove`，所以 document 上任何指標事件都會經過它的事件系統。Pixi 8.19 的 `EventBoundary.freeEvent` 把事件放回池子時，沒有清掉 `nativeEvent`、`srcElement`、`target`。結果是：最後一次指標事件的 DOM 目標（例如狩獵 HUD 的「離開」按鈕），連同它整棵已拆下的畫面，會被池子保留到下一次指標事件。

- 量測：保留量約 3.7 MB。第 2 趟後與第 6 趟後幾乎相同（3.68 → 3.76 MB），**不會累積**。
- 在觸控裝置上，玩家下一次觸碰就會釋放。
- 未修改：要修就得改 Pixi 函式庫，或從外部清它的內部池。風險高於效益。

## 4. 已證實並已修正

### S1 催化進化中重新整理會遺失道具（已在本 PR 前段完成）

- 催化當下就扣金屬並**立即存檔**，進行中的進化卻只存在記憶體；這時重新整理或返回標題，存檔就停在「物種沒變、金屬已扣」。
- 修正（不改存檔格式）：催化時只在記憶體保留金屬，進化寫入新形態時才扣，兩者進同一次存檔。保留期間，背包顯示與所有金屬消耗入口都只計算未保留的數量。
- 為何不在存檔新增「待完成」記錄：`normalizeCyberGacha` 預設拒絕未知欄位，一旦遇到，整份存檔都無法讀取；回退版本或舊分頁會讀不到存檔。
- 驗證：`tests/championship-catalyst-evolution-crash-consistency-cases.mjs`（修改前 3 項失敗，修改後全過）；真實 UI 的 `--scenario interrupt` 也通過。

### S2 轉生動畫途中存檔，轉生次數 +1 但仍是成熟期

- 原因：`rebirthRaisingPartner` 在動畫開始時就把轉生次數（`narrowFields['03c']`）+1 寫進夥伴資料，要等約 272 幀（4.5 秒）後的第 7 階段才變成蛋；動畫本身只存在記憶體（`raisingActors`）。
- 自動存檔與離開頁面的存檔在動畫期間會延後，所以單純重新整理不會出事。但只要這段時間有任何一次明確存檔，存檔就會寫下「成熟期＋次數 +1」。審查找到兩條路徑：動畫在夥伴列表背景繼續播放時，進行覺醒餵食或超越（`commitGacha`）；牧場載入失敗畫面的「離開／重新載入」。重新載入後動畫消失，夥伴還是成熟期，可以再轉生，次數一直往上加；轉生次數會解鎖進化與爆發形態。
- 重現：Node 中用正式 app 設定與固定存檔，催化到成熟期（096）後轉生，40 幀時存檔，存檔內容是 `096、次數 1`。
- 修正：與 S1 同一模式。轉生時只在記憶體保留新的次數（`rebirthReservation`），動畫的每一步都從「目前資料＋保留的次數」計算，第 7 階段把蛋與次數一起寫入。中途中斷等於沒有轉生；完整跑完的結果與修改前相同（`species-001`、次數 1）。不改存檔格式。
- 驗證：`tests/championship-rebirth-crash-consistency-cases.mjs`。每一步都存檔並檢查，存檔只會出現 `096＋次數 0` 或 `001＋次數 1` 兩種狀態；另外也測中途重新載入，以及動畫期間不能再次轉生。修改前 2 項都失敗，修改後全過。

### S3 照護圖每次回牧場洩漏 16 個 `<img>`

- 原因：`careImageTextureScope.js` 建立的照護圖從不插入文件，釋放時用 `removeAttribute('src')`。在 Chromium 153 上，**不在文件中的 `<img>` 被移除 src 屬性後，會被 `MediaQueryMatcher` 的 viewport 監聽器永久保留**，每張留下 6 個節點（含替代文字的 shadow DOM）。牧場每次重新掛載會建 16 張。
- 最小重現（各 50 張圖、強制 GC 後的 DOM 節點增量）：

| 釋放方式 | 增量 |
|---|---|
| 不在文件中 + `removeAttribute('src')`（原寫法） | +300 |
| 先插入文件、移除 src、再拆下 | 0 |
| 先拆下、再移除 src | +300 |
| 載入失敗後 `removeAttribute('src')` | +300 |
| `src = ''` 或 `setAttribute('src','')` | 0（也不會多發請求） |

- 修正：改用 `image.src = ''`，只改這一個檔案。
- 驗證：
  - `npm run test:browser:care-image-release` 用正式模組在真實 Chromium 跑 20 輪的載入、失敗、中止路徑。修改前留下 720 個節點，修改後 0；同一測試內的對照組（舊寫法）留下 120 個，證明這個瀏覽器確實有此行為，測試不是空轉。
  - Node 單元測試改成：一旦呼叫 `removeAttribute` 就失敗。舊程式 6 項失敗。
  - 整個遊戲：在隔離 worktree 中只換上候選雜湊，建置候選版（buildId `4d9ecfbd…`），跑同樣的狩獵往返並取 heap snapshot。heap 中殘留的照護圖：修改前第 4 趟 64 個、第 16 趟 256 個；修改後第 2 趟、第 6 趟都是 0。V8 heap 維持在 46.6–51.2 MB。WebGL context 物件仍然每趟多 2 個，符合第 6 節的 DFG_LUT（未修）。
- 同樣寫法還出現在 `systemBackgrounds.js`（換背景時仍在載入的圖）、`titleImageLifecycle.js`、`skillCutIn.js`、`cyberMorphEvolutionRunner.js`、`codexShowcaseTheater.js`、`vs4Screens.js`。這次巡檢沒有在 heap 中看到它們留下的元素，所以依規則不改，列為下一批。

## 5. S4 首次綁定獎勵補發（Owner 2026-11-08 要求；已修正，屬預防性）

**目前不影響正式站**：`src/data/championship/online-service.v1.json` 的 Supabase 設定是空的，正式站也沒有執行期注入（`__CHAMPIONSHIP_SUPABASE_CONFIG__`），所以線上功能都是本機模擬，綁定獎勵只會「預覽」，不會真的付款。這個修正等雲端啟用後才會起作用。

- 原本的缺口：伺服器先記帳（`claim_bind_reward` 寫入領取紀錄，並把帳號標成已領），本機再付 5000 Bits 並存檔。兩步之間如果分頁被關、網路斷，或本機那一步失敗（存檔失敗、另一個分頁先寫入、教學／對戰／狩獵進行中），帳號就顯示已領，本機卻沒有錢，之後也不會再問。
- **實作途中發現更根本的問題**：伺服器用 `save_ref` 判斷「同一份存檔才可重發」，但 `save_ref` 是 app 的 `sessionId` 的雜湊。正式版的 `sessionId` 是常數 `championship-modern-home`（`STANDALONE_SESSION_ID`），**所有玩家、所有存檔都一樣**。所以伺服器分不出存檔。
  - 原本提的方案（帳號已綁定、本機沒付款紀錄就去問）會讓同一帳號每開一份新遊戲都能再領 5000，等於重複發放，所以**沒有照原案做**。測試裡用兩份新存檔直接證明了這一點。
- 實際做法：用這台裝置的「待付款」標記當閘門，存檔格式不變。
  - 送出領取請求前，在線上 session 區（已核准的儲存鍵 `championshipModernSave:onlineSession:v1`）寫入 `championship-bind-reward-pending`，記下帳號 ID。
  - 本機付款成功，或這份存檔原本就已付過，就清掉標記。伺服器明確拒絕（被別的存檔領走、帳號未綁定）也清掉。
  - 每次開啟頁面、進入存檔後最多問一次，而且只在有標記、帳號就是當初送出的那個時才問。
  - 補發時不會登入任何人、不建立匿名帳號；沒有標記的裝置不會載入雲端函式庫，也不發任何請求。
  - 只有真的補付時才顯示獎勵視窗。
- 每個瀏覽器只有一個存檔欄位，所以「目前開著的存檔」就是要付款的那一份。開新遊戲覆蓋存檔之後，沒有標記就不會再付。
- 驗證：`tests/championship-bind-reward-recovery-cases.mjs` 共 6 項，涵蓋：
  - 沒有標記時完全不連線。
  - `save_ref` 共用的證明。
  - 伺服器已記帳、網路中斷後，下次繼續遊戲補付一次；之後的新遊戲不會再付。
  - 存檔寫入失敗時保留標記，下次補付。
  - 伺服器明確拒絕或換了帳號時清掉標記。
  - 本機模擬不留標記。
  - `main.js` 的接線。
- 其他驗證：
  - 既有的線上、綁定獎勵、儲存防護測試 46 項全過。
  - `test:ci` 3521 項全過。
  - 隔離 worktree 中只在副本裡換上候選雜湊，建置候選版（buildId `6bb2cc83…`），在真實瀏覽器跑完牧場全流程，錯誤 0。
- **還沒對真實 Supabase 驗證**（這裡沒有雲端）。用的假伺服器照 `supabase/migrations/001_championship_online.sql` 的 `claim_bind_reward` 規則寫成。
- **既有漏洞（已由 S5 根治）**：因為 `save_ref` 共用，原本的「綁定另一個登入方式」流程（`onProviderBound` → `runBindReward`）在同一帳號的另一份未付款存檔上，伺服器會回 `repeat`，於是再付一次，每種登入方式最多一次。Owner 同意改存檔格式之後，由 S5 讓每份存檔有自己固定的 ID，見下一節。
- 證據：
  - `src/championship/app/main.js`（`runBindReward`、`recoverBindReward`、`takeOnlineAuthReturn`、`handleOnlineAuthReturn`）
  - `src/championship/online/championshipCloudService.js`（`claimBindReward`、`recoverBindReward`、`settleBindReward`）
  - `championshipStandaloneApp.js`：`STANDALONE_SESSION_ID`、`getSaveReference`

## 5b. S5 每份存檔有自己固定的 ID（Owner 2026-11-08 核准改存檔格式；已修正）

- 欄位與做法：
  - 新欄位是 `flags.saveId`，格式為 `sv1-` 加 32 個小寫十六進位字元（`crypto.getRandomValues` 產生的 128 位元亂數），其他格式一律以 `INVALID_SAVE_ID` 拒絕。
  - 伺服器只收到它的 SHA-256，當作 `claim_bind_reward` 的 `save_ref`；ID 本身不會離開裝置。
- 生命週期：
  - 新遊戲時產生一次。
  - 舊存檔打開時先在記憶體裡配一個。**繼續遊戲仍然是唯讀**，既有測試「打開舊存檔不改存檔內容」照樣通過。之後每一次寫入都帶著同一個 ID。
  - 送出領獎請求前，`ensureSaveReference()` 會先把 ID 寫進存檔，寫入成功才交出 ID，所以請求裡的 ID 不會因為重新載入而變掉。對戰、狩獵、教學進行中，或寫入失敗時，不交出 ID。
  - 每次開新 session 都清空記憶體裡的 ID，避免把上一份存檔的 ID 寫進別份存檔。
- 相容性：
  - 放在 `flags` 而不是存檔頂層。頂層是嚴格白名單，未知欄位會讓舊版完全讀不到存檔。`flags` 的未知欄位只會被舊版丟掉，所以舊版本或舊分頁仍打得開存檔，只是寫回時會少了 ID；新版下次打開會再配一個新的。
  - 存檔 key 與 `schemaVersion` 都不變。
- 依 repo 慣例新增合約 `docs/contracts/championship/SAVE_ID_20261108.json`，取代 `ROYAL_NEW_MAPS_20261103` 對存檔模組的雜湊鎖定，舊的鎖定移到歷史紀錄。`docs/coordination/OWNER_DIRECTION.md` 也補了這筆 Owner 指示。
- 驗證：
  - `tests/championship-save-id-cases.mjs` 5 項：格式；新遊戲各有不同 ID 且每次寫入都保留；舊存檔唯讀打開後，領獎前寫入一次、重開仍是同一個；寫入失敗時不交出 ID；格式錯誤會拒絕，未知 flag 會被丟棄。
  - 綁定獎勵測試改為證明漏洞已封住：兩份新遊戲的 `save_ref` 不同，同帳號的第二份存檔會被伺服器拒絕。
  - `test:ci` 3526 項全過。
  - 在隔離 worktree 中只換上候選雜湊，建置候選版（buildId `c1563db3…`）並跑完牧場全流程（用無 ID 的舊格式存檔、途中有存檔與重新載入），錯誤 0。

## 5c. Friends playtest 偶發失敗：拍照判定（Owner 2026-11-08 選方案一；已修正）

- 現象：`groups (source-wrap-desktop)` 偶發失敗，重跑一次就通過。CI 診斷檔顯示，拍照前一刻 `species-097`（`m331_seadramon`）的狀態是 `loading`／`loadKind: animation`／`hasVisibleSprite: true`，也就是它在串流載入下一段動作，圖一直留在畫面上。6 幀後全部 ready。
- 原因：#193 之後，動作片段在需要時才載入。測試要求拍照前後的瞬間每位夥伴都是 ready，夥伴剛好在這段時間換動作就會失敗。
- 修正（只改測試 `tests/championship-friends-playtest-browser.cjs`）：
  - 只放寬「拍照那一刻」的判定。夥伴圖還在畫面上、只是在串流下一段動作時，視為可拍照，並把這些夥伴記錄在證據的 `streamingAtCapture`。
  - 等待場景就緒的條件維持原本的嚴格標準。
  - 備援畫面、重複的 canvas、任何錯誤、沒有可見圖的夥伴，以及其他任何載入狀態，仍然判定失敗。
- 驗證：用 CI 當時失敗的快照，新判定會接受；另做反例（沒有圖、載入進化資源、場景還沒就緒、畫面被隱藏、錯誤、備援畫面、重複 canvas），全部仍然被拒。

## 5d. 進化串流閘門「拖曳無反應」：失敗與否取決於 CI 執行的時刻（已修正，只改測試）

- 現象：合併 main 之後，`Evolution streaming freeze actual browser gate` 在 a640d7b4、ef0047a7 兩次、chromium 與 webkit 兩種引擎都失敗在 `Recovered world responds to drag`（相機 2760→2760）。d273c2ee 與 main 各分支的同一閘門先前都通過。
- 原因：牧場用裝置本地時間，22:00–07:00 夥伴會原地睡覺（`src/championship/time/realtimeClock.js`）。CI 機器是 UTC：通過的 5 次都在 UTC 09:22–13:29，失敗的 2 次在 UTC 23:10、23:13。睡覺的夥伴是躺姿，點擊範圍變寬，剛好蓋住測試寫死的拖曳起點（畫面高度 0.65）。從夥伴身上開始滑是「抱起夥伴」，不會移動相機（`attachActorInput`），這是正確的產品行為，所以錯的是測試的起點。之前本機在每個版本都重現失敗，也是因為本機同樣是 UTC 夜間。
- 對照實驗（同一份程式碼 ef0047a7，只換瀏覽器時區）：白天時區通過，相機 2760→3048；夜間時區失敗，躺姿夥伴的可見範圍 31.8×11.2，與 CI 失敗時的數字完全相同。
- 修正（只改 `tests/championship-evolution-streaming-browser.cjs`，產品檔案一個位元組都沒動，沒有模擬時鐘）：拖曳前用畫面元件自己提供的夥伴點擊範圍（`actorScreenRect`）與覺醒徽記位置，從 0.65 開始找第一條所有手勢點都落在輸入 canvas 上、且離每隻夥伴至少 16 px 的水平線。拖曳、滾輪縮放、雙指縮放都改用這條線，手勢本身不變。選到的線和量到的範圍記在證據的 `gestureLane`。
- 驗證（本機 chromium）：夜間時區自動改用 0.7，通過；白天時區仍用 0.65，通過；不指定時區（本機目前是夜間）通過；baseline 模式仍重現歷史例外。webkit 由 CI 驗證。數字見 `evidence/evolution-gate-time-of-day.json`。

## 6. 已量測、未修改（附理由）

| 項目 | 數據 | 為何不改 |
|---|---|---|
| Three.js r185 的 `DFG_LUT` 是模組層級共用貼圖。每個 renderer 上傳它時，會在上面掛一個 `dispose` 監聽器；`renderer.dispose()` 不會移除這個監聽器，所以每個舊 renderer 的 WebGL context 物件與 canvas 都會被永久保留 | 第 4 趟時監聽器 9 個；12 趟多 24 個 context 物件；JS 端每個約 30 KB。context 都已丟失，所以 GPU 端已釋放 | 屬於函式庫的行為，量很小。要在外部修，就得透過 `renderer.properties` 摸 Three 的內部，或改 vendor。建議向上游回報，下一批再評估 |
| 每次回牧場都重建 Three 場景：新的 WebGL context＋4 個 Draco worker | 每輪約 10 次牧場重掛載，即 40–48 個 worker 建立／結束 | 都有正確釋放，不是洩漏。共用 DRACOLoader 前，先量 Draco 初始化佔重入時間的比例 |
| `runtimeDiagnostics` 每筆紀錄都同步讀、合併、寫回約 8 KB | 4 輪約 500 次寫入 | 刻意設計（當機也要留下證據） |
| 第一次開啟背包／手帳／故事較慢 | 第 1 輪 30–65 秒，之後 10–30 秒（SwiftShader） | 首次惰性載入模組與圖片，要在實機上量才有意義 |
| 牧場訓練（即時時鐘模式）：狩獵或對戰結算後的訓練加成只存在記憶體 | 讀程式碼 | 返回標題或重新載入會少一次免費加成，沒有花費，影響很小 |

另：`championshipStandaloneApp.js` 狩獵中斷繩子那段的註解寫著「立即存檔」，實際上是跟狩獵結算一起存檔。行為是一致的，只是註解寫錯了。

## 7. 已排除的假說（避免誤修）

| 假說 | 證據 | 結論 |
|---|---|---|
| 狩獵每趟 heap +2 MB | 精確量測 16 趟，斜率 +0.22 MB，主要是 JIT 程式碼與 DevTools 記錄 | 不成立（3.3 節） |
| 每輪多 12 個無法回收的 canvas | 不插樁、往返 8 次後的 heap snapshot：canvas 約 7 個，detached 的 1 個 | 不成立；先前是插樁的量測偏差 |
| 背包／好友的「關閉」被對話框擋住 | 在按鈕中心用 `elementFromPoint` 命中的就是按鈕 | 不成立；是 Playwright 對 top-layer `<dialog>` 的誤判 |
| 「帳號」頁按 Escape 關不掉 | 第一次回到設定分類，第二次關閉 | 這是分層返回的設計 |
| Worker／WebGL context 洩漏（GPU 端） | 建立數等於結束／丟失數 | 不成立（JS 端的殘留見第 6 節 DFG_LUT） |
| 約 25 項花費／獲得交易 | 轉蛋、覺醒、商店、狩獵、對戰、錦標賽、換日、信件、設施、照護等，花費與結果都在同一次狀態更新、同一次存檔 | 一致，不需修改 |

## 8. 需要 Owner 核准的公開建置雜湊

`build:playtest` 會比對 `docs/contracts/championship/WEB_BUILD_INPUTS.v1.json` 與 `PUBLIC_RUNTIME_ALLOWLIST.v1.json` 裡的核准雜湊。我沒有修改這兩份表。

| 檔案 | 目前核准 | 本分支 |
|---|---|---|
| `src/championship/app/championshipStandaloneApp.js`（S1＋S2） | `6045de73bfe0cca817e31f7eb3519b3a5f33df40c7ab23a06d5cec03947ad971` | `66ea864ee9df77d14cc7922f787bcc331e1a36c4a8ad12d4587919453b86c3a9` |
| `src/championship/presentation/intRh2/careImageTextureScope.js`（S3） | `1482b7f01717f979f432921b16abb4e24d1dc440a061b3f2b44dcfaa0c1cf268` | `2e208776f4bfa4d250a0f6314b2c2ee3ca2d09f94637b392c157245d0c54168a` |

S1 時提出的 `b30e2cd0…` 已被 `66ea864e…` 取代。

**上面兩列 Owner 已於 2026-11-08 核准並套用**（[PUBLICATION_APPROVAL.json](PUBLICATION_APPROVAL.json)）。S4 的兩列也已核准並套用（[PUBLICATION_APPROVAL_S4.json](PUBLICATION_APPROVAL_S4.json)）：

| 檔案 | 目前核准 | 本分支 |
|---|---|---|
| `src/championship/app/main.js`（S4） | `991f8c32291b3d540a0a62074855d35636477efe8d9739da641e1ec759a823ad` | `d65efb6be5366a5902984804ab081b3af9983dad7f10b69fc7c194607d1e6068` |
| `src/championship/online/championshipCloudService.js`（S4） | `11150dff66913de99ab736bc78831c2cc7bf771bb6f6a69c08624a627c0fdb83` | `c025b8b316153598915eb3e85cdb0cc7389b62df3a9d713581274b3ab48928fd` |

**S5 的四列也已核准並套用**（[PUBLICATION_APPROVAL_S5.json](PUBLICATION_APPROVAL_S5.json)）：

| 檔案 | 目前核准 | 本分支 |
|---|---|---|
| `src/championship/app/championshipStandaloneSave.js` | `16ddc21be1570c51e87fb592635d5a5437ed25b9a8aeb660993f07494598b8c1` | `5c2ea82fa0d8af9192325fe88ec9c40a437ed3ead2044aed1de04b1ebbb82430` |
| `src/championship/app/ChampionshipPersistentSavePort.js` | `d5a5f21f245608e9a4f77e953feccc6fbc97ccb005d302a01e08dda120793dfa` | `1c9254662b1f9294937ee5154abb4efe78bc26c8d5b5abecb5c6d9b9ba600f75` |
| `src/championship/app/championshipStandaloneApp.js` | `66ea864ee9df77d14cc7922f787bcc331e1a36c4a8ad12d4587919453b86c3a9` | `124115f3b091b9500450a0dacebbc47e9869dd0b4fa8cc95a89b3c70f9a8afc5` |
| `src/championship/app/main.js` | `d65efb6be5366a5902984804ab081b3af9983dad7f10b69fc7c194607d1e6068` | `1340305d02178cd1875a76ec8b173979ca0557669fb24d74145e3715e01f46e4` |

## 9. 下一批建議（依使用者影響 × 證據強度 × 修改風險排序）

1. **巡檢補上對戰場內與捕捉流程**：打完一場到結算再返回，量相同的不變量；並把「精確 heap 曲線＋snapshot 比對」納入巡檢報告。
2. 其餘 `removeAttribute('src')` 呼叫點：逐一確認圖是否不在文件中，有證據再改。
3. 量測牧場重入成本的組成（Draco worker、GLB 解析、角色解碼）後，再決定是否共用 DRACOLoader；DFG_LUT 向 Three.js 上游回報。
4. 啟用 Supabase 之後，用真實專案驗證綁定獎勵的補發（S4）與存檔 ID（S5）。
5. iPhone 實機：用 Safari 網頁檢閱器跑 #193 報告第 11 節的步驟，以及本報告的背包、狩獵場往返。

## 10. 重現方式

```bash
npm run build:playtest -- --external-characters
```

```bash
node tests/championship-system-sweep-browser.cjs --label sweep --cycles 4
```

```bash
node tests/championship-system-sweep-browser.cjs --label hunt --cycles 6 --only flow:hunt
```

```bash
npm run test:browser:care-image-release
```

```bash
node --test tests/championship-rebirth-crash-consistency-cases.mjs tests/championship-catalyst-evolution-crash-consistency-cases.mjs tests/championship-bind-reward-recovery-cases.mjs tests/championship-save-id-cases.mjs
```

證據：`evidence/` 內為各次巡檢的 `summary.json` 與狩獵 16 趟的 heap 曲線（`hunt-heap-curve.json`）。heap snapshot 每份約 130 MB，沒有放進 repo。
