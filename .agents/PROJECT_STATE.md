# Championship 2026 — Project State Snapshot
> 更新：2026-11-27 23:46｜最新乾淨整合分支：`feat/pb-battle-base-20261127`（基於 `origin/main @ e67e6e541`）｜舊主目錄髒樹差異已備份於 `d:\Championship2026-backups\main-dirty-backup-20261127-2328\`

## 當前首要目標
- **收斂合併 PB 對戰底座升級（`feat/pb-battle-base-20261127`）**：將本輪完成的 PB 對戰公共底座 4 件套、14 套像素模板引擎、`.agents/` Harness 與 `vfx-sandbox.html` 合回 `main`。
- **高標準續跑 PB-324 剩餘 273 招**：讓已安全停機在 Batch 5A（51/324 招）的 `405d12d9` 按 `交接_v2_底座升級後規格_20261127.md` 改採「宣告式模板＋像素筆刷＋375×812 實戰驗收」高速量產。

## 已落地完成模組
- **核心迴圈與系統（`origin/main @ e67e6e541`）**：牧場育成＋10 格擴充預覽、狩獵場 8-way 尋路／著地修正（#311）／全寬底欄、自動對戰（性格／方針／馴獸師 20 張技能手牌 R4）、視覺血統進化與爆裂覺醒、故事 1–3 部、三套版面＋源泉圓體、技能拓印卷、天賦樹圖標化、Supabase 離線模擬層。
- **PB 對戰底座升級（`feat/pb-battle-base-20261127`）**：
  - 真實擊退保底（`pb-127` 106px／`pb-256` 104px）、接觸分離 `>= 75px`、grounded 防重疊 `>= 56px`、舉盾彈反近戰 `270 px/s`；
  - AI 敵方衝刺（`LUNGE`）預警閃避／舉盾＋收招立回拉扯（實戰均距 `262 px`）；
  - 分離剪影衝擊格＋延後傷害數字零遮擋＋PB 白色半六角蜂巢護罩；
  - `dataArenaPbMoveTemplates.js` 像素階梯筆刷庫＋14 套宣告式招式模板引擎＋`scripts/qa/film-duel-375.cjs` 直屏實戰驗收器＋`.agents/` 全套 Harness 納入版控。

## 目前待解決核心痛點
1. **待 Owner 授權合併與主目錄同步（P0）**：`feat/pb-battle-base-20261127` 已就緒待合入 `main`；舊 `championship-2026` 工作目錄（落後 338 commits）待核准切換至乾淨 `main` 並清點封存 124 個歷史 worktree。
2. **招式剩餘 273 招量產與既有 51 招體驗收尾（P1）**：岩石剩餘 5 招起改走宣告式模板（≤15 行/招），既有 51 招其餘少數向量圓塵雲可按需替換為 `px.puff`/`px.ring`。
3. **商業試玩發佈門檻未閉環（P1）**：`ART_PRODUCTION_INDEX.json` 仍為 `shippingReadyBundles: 0`（已註冊 809）；AW/UL 動畫與 75 隻圖鑑缺口、Supabase 真實專案連線與實機 iPhone 長局回歸待收尾。

## 已否決或避開的路線
- **另起爐灶重寫（Nexus Link 獨立實作）**：已否決；堅持原地演進、單一 PixiJS Application/Ticker 與單一 Save Authority。
- **無上限手寫 2 萬行向量腳本**：已否決；剩餘 273 招全面改走 14 套宣告式像素模板引擎，嚴禁平塗向量圓與細線多邊形環。
- **文字表格型系統介面與渲染紅線**：禁止文字化系統頁、禁止即時 Pixi 上疊 `backdrop-filter`、禁止 VFX 用 `setTimeout`/`rAF`、禁止動 `#cm-title`（Title Zero-Diff）、故事 4–5 部未雙部完工不上線。
