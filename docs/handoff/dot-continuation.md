# Dot continuation handoff

建立日期：2026-10-01（Asia/Taipei）

這份文件是從本機 R 槽交接給 GitHub 上 `Orochi771127/championship-2026` 的可重跑基準。它只記錄既有成果與驗證狀態；本輪沒有新增玩法、沒有重生成動畫、沒有改名，也沒有把任何不明權利或 review-only 素材升級成產品資產。

## Git 基準與本輪範圍

- 產品 Git 根目錄：`R:\Projects\Championship2026\championship-2026`
- workspace 根目錄：`R:\Projects\Championship2026`（不是產品 Git 根目錄）
- remote：`origin https://github.com/Orochi771127/championship-2026.git`
- 基準 commit：`bfb1f28d53e8a1bbca19bb0aa6b0c9c6f21146e0`（`main` 與 `origin/main` 起點相同）
- 交接分支：`handoff/dot-continuation-20261001`
- Pages 只在 `main` push 觸發；本分支 push 不觸發 GitHub Pages deploy。CI 對 push/PR 仍可能執行 deterministic tests。

開始盤點時工作區有 20 個已修改檔案。Git 狀態以目錄折疊顯示 594 個未追蹤路徑，逐檔展開後是 101,195 個未追蹤檔案；未把這些路徑當成可公開成果整批加入。未提交的角色生成、審核、provider ledger、cage library 與其他 agent 內容仍留在工作區。

## 本分支可接續的程式與驗證

本輪 allowlist 只包含下列類型：

- 現有 UI／runtime 修正：`championship.html`、`scripts/build-module-preload.mjs`、`scripts/serve.mjs`、`src/championship/presentation/vs2/createHuntFieldPixiPresentation.js`。
- 角色產製與 review 工具：現有 `scripts/character-batch-job.py`、`scripts/character-donor-review.py`、`scripts/export-character-batch-review.py`、`scripts/m001-full-sheet.py`，以及工作區新增的 selected-character／morphology／environment review scripts。
- 既有測試修正與新增的 character／environment focused tests。測試不會替代正常瀏覽器遊戲驗收。
- 本文件本身。

沒有 stage `git add .`，沒有更改 ignore 規則，沒有加入 `node_modules`、快取、ROM、研究用原作圖、私人 session、真實 `.env`、密碼、API key、token 或憑證。`package.json` 與既有 lockfile 沒有被改寫；依賴仍由 `npm ci` 鎖定安裝。

## 啟動與驗證

在 dot 的 checkout 內執行：

```powershell
npm ci
npm run validate:preload
npm run test:ci
npm run serve
```

`npm run serve` 是產品 loopback server。`scripts/serve.mjs` 的 cage preview 參數只接受產品 repo 下、manifest/proof 明確標為 review-only 的 cage workpack，且只綁 loopback；它不修改產品 manifest、renderer、gameplay 或 save。不要用它把 review-only character bundle 當成預設 runtime。

程式內的角色接續入口仍是既有的 `src/championship/presentation/characterAnimationTimeline.js`、`src/championship/presentation/pixiCharacterAnimationController.js`、`src/championship/presentation/pixiCharacterRuntimeBundle.js` 與 `src/championship/presentation/licensedCharacterRoster.js`。可選的本機 character review 由 `src/championship/app/main.js` 的 `loadOptionalCharacterReview` 讀取 developer query；預設路由與 production index 沒有被提升。

建議的 deterministic scope：

```powershell
node --test tests/championship-character-animation-timeline-cases.mjs
python -m unittest tests/test_character_morphology_gate.py tests/test_character_native_frame_packing.py
node scripts/build-module-preload.mjs --check
```

Python tests 需用與專案相容的 Python 3 環境；需要 R 槽的來源 bank 或私有研究 archive 時，dot 只能在取得相同本機輸入後執行，不能把缺少的輸入猜成已存在。

本輪實際檢查結果：

- `node scripts/build-module-preload.mjs --check`：PASS，204 startup modules；先以既有 builder 更新了 `championship.html` 的 preload 清單。
- `npm run test:ci`：PASS，1407 tests、0 fail、0 cancelled、0 skipped。
- 角色／產製 focused Python tests（排除環境 pilot）：PASS，39 tests。
- `python -m py_compile`：PASS，allowlist 內 Python scripts/tests 可編譯。
- `tests/test_environment_pilot.py`：BLOCKED，匯入 `scripts/build-environment-pilot.py` 時缺少本機 `scipy`；沒有安裝依賴，也沒有把它宣稱為通過。
- `git diff --cached --check`：PASS；staged allowlist 只有下方列出的 43 個程式、測試與文件檔案。

## 完全體動畫接續範例（本機存在，未公開）

R 槽已存在完整的 50 隻交付包：

`R:\Projects\Championship2026\自創腳色\完全體_已完成交付_50隻_20260928`

可用 `m402_anomalocarimon` 作為接續範例。其本機 package 具備：

- 母圖／原始生成與提示詞仍在 `R:\Projects\Championship2026\自創腳色\完全體_全階段生產_20260927\m402_anomalocarimon`；package 的 `source-links.json` 保存來源與 hash，沒有搬走或重寫來源。
- `characters/m402_anomalocarimon/animation/` 的 `bank.json`、Main/Sub atlas、每格 RGBA cell 與 `packing-proof/`。
- `bank.json` 的原始 entity ID、origin、64 logical / 256 raster、density 4、53 sequences、83 timeline frame entries 與既有 ticks／playback mode。
- 組裝／整理入口：package 根目錄 `build_delivery.py`；每隻角色的 `README.md` 和 `cells.html`。
- 預覽入口：package 根目錄 `START_PREVIEW.cmd`、`animations.html`、`index.html`；既有回條曾在 `http://127.0.0.1:8811/` 做 preview UI smoke check。
- 驗收回條：`collection-validation.json`、`timeline-verification.json`、`browser-preview-check.json`，以及角色的 `evidence/acceptance.json`、`evidence/renderer-and-adapter-r01.json`、`evidence/normal-game-r01.json`。

狀態要分開讀：

| 項目 | m402 本機回條 | 本輪結論 |
|---|---|---|
| 檔案存在 | bank、Main/Sub atlas、cells、metadata、evidence 存在 | PASS（存在性與 hash 由既有回條記錄） |
| 預覽可播 | preview server／renderer 回條為 PASS | PASS（沿用既有回條；本輪未重跑生成） |
| 遊戲內整合 | 隔離 developer fixture 的 Raising → Save → Reload 回條為 PASS | 只證明該本機 review route；不是預設 production route |
| 完整正常流程 | 正常 Hunt → rope → capture → settlement 未逐隻執行 | NOT VERIFIED |
| 發布／shipping | `runtimeEligible=false`、`shippingAccepted=false`、`defaultRuntimePromotion=false` | NOT APPROVED |

repo 內的 `assets/production/internal-character-review/m001-stardrip-pixel-r04` 與 `m002-ironchime-pixel-r03` 也各有 Main/Sub atlas、cell、`runtime.review.json` 與 `manifest.json`；它們的 manifest 明確是 `reviewOnly=true`、`humanApproved=false`、`normalGameQa=PENDING`、`runtimeEligible=false`、`shippingReady=false`、`publicReleasePermitted=false`。它們不是本次公開上傳的動畫範例。

動畫流程保持既有規格：先使用原始 bank／motion contract，再由既有 assembler 建立 Main/Sub atlas 與 frame metadata；renderer 透過既有 Pixi timeline，以 contract 的 ticks、playback mode、origin 與 cell ID 播放。不可在接續時新增 action 語意、改 timing、重置 origin、用 per-cell autofit 或把 review route 改成預設 production route。

## 大檔與未上傳清單

本輪沒有啟用 Git LFS、付費儲存或外部服務。以下都是本機既有成果，因權利、狀態、用途或大小而留在 R/C 槽：

| 位置 | 檔案數 | 大小 | 原因／缺少它會阻擋的工作 |
|---|---:|---:|---|
| `assets/production/internal-character-review` | 10,519 | 273,919,496 bytes | review-only candidate PNG/JSON；manifest 禁止公開，缺少它只會阻擋本機角色預覽，不阻擋核心程式測試 |
| `docs/art/production/characters/appearance-refresh-v1/selected-concept-jobs` | 82,211 | 2,507,398,827 bytes | 生成中間檔、provider job、raw/repair/compiled candidates；不是 shipping input，缺少它會阻擋在同一台 R 槽重做候選審核 |
| `docs/art/production/original-character-cage-r1/cage-base3d-v1` | 7,064 | 1,111,927,776 bytes | 完整 cage Blender/generated library；既有策略刻意不放 Git，缺少它會阻擋本機 Blender/cage 重建 |
| `docs/art/production/original-character-cage-r1/m001-pipeline-v1` | 1,404 | 14,245,029 bytes | cage m001 review 工作包；目前是 art review，不是 runtime acceptance |
| `docs/art/production/characters/appearance-refresh-v1/donor-review-v1` | 389 | 16,760,325 bytes | donor inventory／review metadata；含研究輸入邊界，未確認公開權利 |
| `R:\Projects\Championship2026\自創腳色\完全體_已完成交付_50隻_20260928` | 8,515 | 306,434,858 bytes | 完整 50 隻本機交付與 preview；所有角色仍 `defaultRuntimePromotion=false`，且 full normal hunt/capture/battle 未逐隻驗收 |
| `C:\Users\User\.codex\generated_images\01a0b944-6e69-7eb2-ad49-156936040796` | 259 | 389,573,141 bytes | 生成圖參考／工具輸出，不是 repo source；指定的少反斜線路徑 `C:\Users\User.codex\...` 不存在 |

本 repo 的 untracked art 中沒有單一檔案超過 100 MiB；最大的 candidate 約 5.48 MiB。`.git/objects/pack` 的既有 pack 約 440 MiB 與 412 MiB 是 Git 本地資料，不是本次上傳 allowlist。

未上傳的還包括 provider credit ledger、selected batch state、raw prompt／job records、私人 upload session／receipt、完整角色包的原始來源，以及所有研究／ROM-derived 輸入。它們留在本機以供有權限的人核對；不要複製到 GitHub，也不要把 provider job ID 當成權利或發布許可。

## 已知問題與下一步邊界

- 本交接不宣稱商品已改名；repo、路徑與技術 ID 仍保留 `championship-2026`。
- `WEB_BUILD_INPUTS.v1.json` 的公開輸入沒有因本輪而刷新；不要把 handoff branch 當成 Pages 發布批准。
- 角色包可展示 renderer／adapter／Raising save-reload 證據，但不等於正常 Hunt capture settlement、Battle 全動作或 shipping acceptance。
- m001/m002 review candidate 的 semantic action labels 仍以原始 slot／UNKNOWN_REQUIRES_TRACE 為界；不能自行替換成新的 action 名稱。
- 若要公開任何角色 PNG／atlas，先取得逐項權利與 publication approval，更新對應 manifest 的 rights／runtime gate，再另開明確範圍的 publication change；本 handoff 不包含該授權。
