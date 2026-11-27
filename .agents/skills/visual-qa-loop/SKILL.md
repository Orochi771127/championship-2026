---
name: visual-qa-loop
description: Standardized mobile-first (375x812) visual QA closed-loop workflow for Cyber Partner: Tournament. Covers starting the local dev server, locking /browser to 375x812 portrait, capturing key-state screenshots and 0.25x slow-mo action captures as Artifacts, auditing Console errors, layout overflow, 5-beat VFX rhythm, and particle/memory leaks, outputting an objective defect list before fixing, and enforcing a strict maximum of 3 automatic iteration rounds. Use after any VFX, animation, or UI/HUD visual change.
---

# Visual QA Loop — 375×812 視覺閉環驗收流程

本 Skill 定義所有視覺類改動（技能 VFX、受擊反饋、UI/HUD 改造）的強制驗收閉環，杜絕「只看程式碼就宣稱修好」的盲改行為。

## 硬性紀律

- **未經 `/browser` 實測截圖或錄影，不得宣告視覺任務完成。**
- **單一任務自動視覺修訂上限為 3 輪（Round 1 → Round 2 → Round 3）**。第 3 輪驗收結束後無論是否仍有次要瑕疵，必須立即停止自動修改，向使用者呈報完整前後對比與待拍板項目。
- **先寫客觀缺陷清單，再改程式碼**：每輪修訂前必須以「元件／時間點、實測現象、預期標準、嚴重度」列出缺陷，禁止無根據亂調數值。

---

## 標準五步驟驗收流程

### Step 1：啟動本機開發環境
- 在產品目錄 `R:\Projects\Championship2026\championship-2026` 啟動靜態開發伺服器：
  - 互動／日常預覽：`npm run serve`（預設監聽 `http://127.0.0.1:8732`）。
  - 隔離自動化驗收（避免佔用 8732）：設 `CHAMPIONSHIP_PORT=8742`（或空閒埠）執行 `node scripts/serve.mjs`。
- 目標入口：
  - **VFX 試車場**：`http://127.0.0.1:<port>/vfx-sandbox.html`
  - **正式遊戲頁面**：`http://127.0.0.1:<port>/championship.html`

### Step 2：鎖定 `/browser` 至 `375×812` 手機直屏視口
- 透過瀏覽器子代理（`/browser`）設定視口為 **`375 × 812`**（直屏手機基準，portrait、觸控優先）。
- 若驗證文字縮放或極端語系，額外抽測 `data-text-scale="115"` 或長字語系（如英文／泰文）。

### Step 3：擷取關鍵狀態截圖與動作錄影（保存為 Artifact）
依改動類型擷取對應視覺證據並存至對話 Artifact 目錄：

- **A. 技能 VFX 驗收（於 `/vfx-sandbox.html`）**
  1. 切換 **實戰草地** 與 **暗色對比** 兩種背景各測一次。
  2. 切換 **`0.25x` 慢動作** 並觸發目標招式，錄製動作片段或依序擷取 4 個關鍵相位截圖：
     - `T1_anticipation`（前搖蓄力與地面法陣）
     - `T2_release_trail`（釋放與非線性拖尾）
     - `T3_impact_peak`（命中爆點、頓幀閃白與雙層粒子）
     - `T4_settled`（消散結束後 1.5s，驗證殘留計數歸 0）
  3. 切回 **`1.0x`** 執行一次「連發洩漏壓測（日常 `runLeakStress(10)`，黃金樣板／上線前跑 `runLeakStress(100)`）」，記錄壓測前後活體粒子數與記憶體讀數。
- **B. UI / HUD 改版驗收（於 `/championship.html`）**
  - 注意：根目錄既有的 `ui-skin-review.html` 屬於舊版原作 DS 皮層（`nativeUiSkin.css` 300×225 4:3）參考頁，**不可改壞**；Cyber Pop 375×812 驗收一律直接測正式遊戲對應畫面（如數據競技場、牧場、圖鑑、商店），或另建獨立 `ui-sandbox.html`。
  1. 擷取目標畫面的 **預設靜止態**（整頁首屏）。
  2. 擷取 **互動展開態**（按鈕按下態、抽屜／詳情頁開啟、頁籤切換）。
  3. 擷取 **極限窄屏／長字態**（375px 下長數字與多字標籤）。
  4. 確認 `#cm-title` 標題畫面未受污染（無樣式外溢）。

### Step 4：執行客觀自動化與視覺核查
在瀏覽器中同時核查以下 4 類硬指標：

1. **Console 零錯誤**：`console.error` = 0、`pageerror` = 0、無未捕獲 Promise rejection、無 404 資源缺失。
2. **版面零爆框（UI）**：
   - `document.documentElement.scrollWidth <= window.innerWidth`
   - 目標文字元素無意外裁切（檢查 `scrollWidth > clientWidth` / 垂直遮擋）
   - 相鄰按鈕／膠囊 BoundingBox 零重疊，可點擊按鈕高度均 `>= 44px`
   - 檢查「只有可點擊按鈕有粗黑框＋底陰影」，非互動標籤已去框。
3. **打擊節奏與可讀性（VFX）**：
   - 慢動作下肉眼可清楚分辨五段式節奏，無純直線等速僵硬位移。
   - 在草地背景上核心夠亮不發灰、在暗色背景上無髒邊鋸齒或過曝白塊。
   - 單招同屏活體粒子未突破品質上限，FPS 維持目標預算。
4. **零記憶體與物件洩漏**：
   - 招式結束冷卻後：`kit.live === 0`、`pieces.live === 0`、`pixelHits.live === 0`、`motes.live === 0`。
   - 連發壓測後舞台子節點數未無限攀升，若支援 `performance.memory` 則記錄 JS Heap 增量。

### Step 5：輸出缺陷清單並執行（至多 3 輪）修訂閉環
每輪驗收產出以下精簡表單：

```markdown
### Visual QA Round <1|2|3>
- Viewport: 375x812 | Target: <URL> | Artifacts: <截圖/錄影路徑>
- Console Errors: 0 | Overflow: PASS/FAIL | Leak Check (live=0): PASS/FAIL

| # | 嚴重度 (P0/P1/P2) | 區域 / 時間點 | 實測現象 | 預期標準 | 修正動作 |
|---|---|---|---|---|---|
| 1 | P0 | ... | ... | ... | ... |
```

- **終止條件**：
  - 若 **P0 = 0 且 P1 = 0** → 通過驗收，產出最終前後對比彙報並結束。
  - 若尚有 P0/P1 且輪數 `< 3` → 依缺陷清單精準修訂後進入下一輪。
  - 若已達 **Round 3** → **強制停止自動修改**，呈現 Round 1 → Round 3 前後對比表、Artifact 連結與剩餘問題，交由使用者裁決下一步。
