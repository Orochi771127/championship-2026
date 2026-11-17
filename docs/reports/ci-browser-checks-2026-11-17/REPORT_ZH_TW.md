# 三項瀏覽器驗證紅燈修復報告（2026-11-17）

範圍：`Scene music actual browser evidence`、`Verify external character delivery`、`Dex portrait mounted browser evidence`。
三項只在 PR 觸發，從 2026-11-12 之後每個 PR 都紅，仍被合併（含當天的 #264、#265）。

## 1. 版本與重現步驟

- 主線：`6e5301dc`（Merge PR #265）。失敗紀錄：PR #265 head `4b9457f6` 的 run `44088435965`（音樂）、`44088435659`（外部角色）、`44088435543`（Dex）。
- 本機：Windows 11、Node v24.18.0、Playwright 1.62.1 Chromium（headless）。CI 為 ubuntu-22.04、Node 22。
- 重現（在主線的檔案上）：

```bash
# 場景音樂
node tests/championship-scene-music-browser.mjs --serve 8765 . &
node tests/championship-scene-music-browser.mjs http://127.0.0.1:8765/ .tmp/browser-qa/scene-music
# 外部角色交付
npm run build:playtest -- --external-characters dist/character-bridge-external
node tests/championship-external-character-browser.cjs
# Dex 立繪
npm run build:playtest && npm run validate:playtest
CHAMPIONSHIP_QA_ARTIFACT=dist/github-playtest CHAMPIONSHIP_QA_OUTPUT_ROOT=.tmp/browser-qa node tests/championship-dex-portrait-browser.cjs
```

## 2. 根因與證據

| 檢查 | 類別 | 根因 | 證據 |
|---|---|---|---|
| 場景音樂 | **產品程式** | `main.js` 的 `ensureSessionHistoryGuard` 在設定面板開著時也會 `pushState`，而且把目前的 state 整個展開複製。設定面板自己的紀錄是 `{cmSettings:true}`；切換語言會重掛畫面並呼叫守衛，於是多出一筆 `{cmSettings:true, championshipSessionGuard:true}`。面板關閉時 `history.back()` 只退一筆，停在面板原本那筆，`history.state.cmSettings` 永遠是 true。原程式想排除設定面板，但檢查的是不存在的 `championshipOverlay==="settings"`。 | 測試停在 `closeGameSettings` 的 `waitForFunction(()=>!history.state?.cmSettings)`（CI 與本機同一行 395）。把 `main.js` 換回 `origin/main`：失敗；換回修正版：通過。 |
| 外部角色交付 | **測試邏輯過時**（兩處） | (a) 2026-11-17 的狩獵結束傳送門（PR #259/#260）：沒抓到拍檔時，關閉的門上顯示結算並等玩家按「返回牧場」，測試離開狩獵後沒有按。(b) 2026-11-12 Owner 指示圖鑑以外顯示動作動畫：對戰 HUD 小頭像改成 action portrait，測試仍等 `.cm-vs5-fighter__mini img`。 | (a) CI log：`.cm-hunt-gate[data-phase="result"]` 攔截點擊 90 秒。(b) 修掉 (a) 後本機在 `checkBattle` 第 170 行逾時，截圖是對戰已結束的結算畫面；`vs5Screens.js` 的 mini 內是 `.cm-action-portrait`。 |
| Dex 立繪 | **測試邏輯**（量測單位） | 2026-11-11 三套版面：比參考視窗窄或矮的視窗整體縮小（`<html>` 的 CSS `zoom`，`portraitFrame.js`）。320×740 時 zoom 0.8。`getBoundingClientRect` 回傳視窗像素，padding、border、`--dex-floor` 是頁面像素，測試把兩種單位混在公式裡。產品排版在頁面像素下完全符合公式（holder 150×210、圖 139.805 = 0.1618×864）。 | CI 在 229 張之後、320×740 的第一張失敗（`scopedGRCaptures` 為 0）。本機瀏覽器量到 `html.zoom=0.8`、`data-ui-zoom`。 |

順帶發現並修正的產品問題：同一個返回鍵守衛把「設定面板關閉時自己退回的那筆紀錄」當成玩家按返回。在馴獸師資料頁點「帳號與雲端同步」開設定、再關掉，會被丟回牧場。瀏覽器重現：關閉後畫面 `TAMER_INFO → RAISING_HOME`；修正後留在 `TAMER_INFO`，真正按返回仍回牧場。

## 3. 修改

- `src/championship/app/main.js`
  - `ensureSessionHistoryGuard`：設定面板開著時不推紀錄；推的時候不複製 `cmSettings`。
  - `handleSessionPopState`：退回後仍落在守衛紀錄上（表示被用掉的是上層紀錄）就不當成返回鍵。
- `tests/championship-external-character-browser.cjs`：離開狩獵後按「返回牧場」並等門消失（多一條驗收）；HUD 改等 action portrait `data-state="ready"` 且 sprite 有底圖。沒有刪除驗收條件。
- `tests/championship-dex-portrait-browser.cjs`：量到的矩形除以 `data-ui-zoom` 換回頁面像素；視窗範圍檢查用同一單位。公式與容許誤差不變。
- 新增 `tests/championship-session-history-guard-cases.mjs`（6 項）。
- `WEB_BUILD_INPUTS` / `PUBLIC_RUNTIME_ALLOWLIST`：`main.js` 雜湊；`ci-test-scope`：登記新測試。

## 4. 修改前後

| 檢查 | 修改前 | 修改後（本機） |
|---|---|---|
| 場景音樂 | CI 失敗；本機用 `origin/main` 的 `main.js`：`TimeoutError`，216 秒 | `PASS_REAL_CHROMIUM_HARNESS_AND_CONTROLLED_NORMAL_GAME`，20 版面、11 首 MP3，184 秒 |
| 外部角色交付 | CI 失敗（狩獵門攔截點擊） | `PASS_CONTROLLED_UI_WITH_LIVE_CHARACTER_HOST`，3 視窗、201 個線上角色資源雜湊相符 |
| Dex 立繪 | CI 失敗（`Drawn box fills the stage`，229 張後） | `CAPTURE_PASS_VISUAL_REVIEW_PENDING`，237 筆量測 |

## 5. 回歸

- `node scripts/test-ci.mjs`（移除 `navigator.locks` 以對齊 CI 的 Node 22）：3,781 / 3,781。
- `build:playtest`、`validate:playtest`：通過，8,263 檔。
- 瀏覽器（獨立埠 8764，QA 存檔）：牧場 → 管理 → 馴獸師 → 帳號與雲端同步 → 關閉，留在馴獸師頁；`history.back()` 回牧場，守衛紀錄仍在。

## 6. 未驗證

- **實機**：沒有 iPhone / Android 實機。返回鍵守衛是為 iOS 主畫面 App 的返回手勢加的，只在桌面 Chromium 驗過。
- **Safari / WebKit**：三項檢查只跑 Chromium。
- **場景音樂的一次偶發失敗**：緊接在完整測試之後跑的那一次，在測試前段 `Playback clock advances`（`currentTime > 0.12`）失敗，位置在設定面板的測試夾具，和這次修改無關。單獨重跑兩次都通過。判斷是機器負載下的時間敏感，CI 上是否會出現要看實際結果。
- Dex 檢查的結論是「擷取通過、人工看圖待審」，這是該檢查原本的設計，不是視覺驗收。
