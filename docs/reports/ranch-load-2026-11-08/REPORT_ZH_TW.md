# 牧場與進化前「正在載入夥伴外觀…」：可重現診斷、根因與修正（2026-11-08）

狀態：第一批修正已提交於工作分支 `claude/inspiring-mayer-gyxhot`，**未合併、未發布**。Owner 已於 2026-11-08 核准三個原始檔的公開建置雜湊更新（[PUBLICATION_APPROVAL.json](PUBLICATION_APPROVAL.json)）；合併與部署不在該次核准範圍內。

## 1. 基準與環境

| 項目 | 值 |
|---|---|
| 開工基準 | `63776034`（2026-11-05）。期間 main 前進 22 個 commit（含 #188–#192 效能與角色素材外部交付），已改以最新 main 重新驗證 |
| 本次基準 | `bd7209aa7cfe9d9f52abfe84186330d3a63ebbda` |
| 手機實際版本 | 正式站 `pages-build.json`：commit `bd7209aa…`、buildId `3f2b4a6d28e8eafefe1c8e168e1c16e58b2065ceb3b43e303ff18673db902f12`；本機 `npm run build:playtest -- --external-characters` 產出相同 buildId → 量測對象與手機載入的程式位元組一致 |
| 角色素材 | 正式站自 `cyber-partner-runtime-assets/v/63776034…/` 載入（5434 檔）；63776034→bd7209aa 間角色素材無變動，抽驗 GR01 動畫與 atlas 位元組與 checkout 相同；正式站同樣只回 `cache-control: max-age=600` |
| 執行環境 | 雲端 Linux 容器、Node 22.23.4、Playwright 1.62.1、Chromium 1243（SwiftShader 軟體 WebGL）、Pixel 7 裝置模擬（觸控、DPR 2.625） |
| 單元測試基準 | `npm run test:ci`：457 模組／3504 項全過；另 50 個 local-reference 模組依 CI 規則排除 |
| 既有失敗（非本次造成） | local-reference：`championship-licensed-character-roster-cases`、`championship-reviewed107-animation-cases`、`championship-m201-density8-renderer-review`、`championship-ma05-renderer-review`、`character-batch-runtime-review-browser`、`m001-runtime-review-browser`（需本機私有參考資料；修改前即失敗） |

## 2. 重現方式（固定存檔、裝置、路徑）

```bash
npm run build:playtest -- --external-characters
```

```bash
npm run test:browser:ranch-load -- --label before --profile mobile-net --trace
```

- 存檔：`tests/fixtures/ranch-load-diagnostic-save.json`，由 `npm run qa:ranch-load-save:build` 以正式入口相同的 app 參數產生（產品經濟、好友試玩、真實時鐘），固定牆鐘與時區，`qa:ranch-load-save:validate` 驗證位元組穩定。主夥伴 species-034（GR01，reviewed，第 3 代，催化路線目標 species-096／MA34），另有 038、035（reviewed）、036（原生串流），背包 2 個 SR 催化碎片。只寫入隔離瀏覽器 context，從不觸碰玩家存檔。
- 伺服器：`tests/support/pages-like-static-server.cjs`（max-age=600、ETag/304、gzip），伺服器端記錄每個請求，包含 Pixi 解碼 worker 的 fetch。
- 時區：依執行當下 UTC 選 `Etc/GMT±N`，使牧場本地時間約 13 時（避開 22:00–07:00 睡眠）。
- 情境：A 冷快取進入；C 同頁牧場→圖鑑→牧場 ×3；B 保留 HTTP 快取重新整理；E 背包→催化進化（真實 UI）；E2 進化後往返；R 重新整理後讀回進化結果；`--scenario reentry`、`--scenario interrupt`。
- 節流設定：`unthrottled`；`mobile-net` = CDP 150 ms RTT、4 Mbps 下行、CPU 不降速（隔離請求鏈成本）。皆為合成條件，不是實體手機網路。

## 3. 讀取 data-resident-assets：誰在擋 isPlayable

催化進化後 `data-resident-assets` 中主夥伴為 `{"speciesId":"…species-034","loadKind":"evolution","state":"loading","hasVisibleSprite":true}`，期間 `createRaisingFieldPixiPresentation.isPlayable` 因 `evolutionAssetState==='loading'` 回傳 false → `championshipClockDriver` 的 `isSceneReady` 為 false → 模擬時間暫停；`residentAssetNotice` 對 `loadKind!=='animation'` 立即顯示「正在載入夥伴外觀…」。閘門與提示行為本身正確，問題在被等待的載入。

完成條件：`loadEvolutionTarget` → `characterBundle.ensureSpecies(target)` → `publicCharacterRoster.loadBundle` → `loadPixiCharacterRuntimeBundle` → `attachReviewedCharacterAnimation` → `createActor` → `ensureFrame(targetFrame)` → `evolutionAssetState='ready'`。

## 4. 已證實根因與修正

### R1（已修）牧場建立後才要求的物種，整包、逐頁序列載入

- 證據（伺服器紀錄，修改前 mobile-net）：進化目標 species-096 的原生 runtime `m330_geograymon…/ranch-streaming-v1` 10 頁（9 張不同圖），以「metadata JSON → webp」逐頁序列下載 20 個請求，之後才載入真正要畫的 reviewed MA34 動畫與 3 張圖；進化本身只需要第 0 頁（序列 0）與第 9 頁（序列 39）。
- 原因：`characterRosterCore` 只為 roster 建立時列名的居民建立 `initialSequenceIds`；之後 `ensureSpecies` 要求的物種得到 `null` → `pixiCharacterRuntimeBundle` 的 `streamed=false` → 走 eager 迴圈，逐頁 `await`。
- 影響範圍：實測為催化進化目標；依程式（共用同一 `ensureSpecies` 入口，未逐一實測）同樣適用於孵化後的新物種、覺醒形態預取、Continue／教學後新增居民。117 個 reviewed 中 113 個不載原生像素（較輕，仍有 runtime→動畫→圖片的序列），4 個保留原生頁（GR01、MA34 等）與約 108 個純原生串流物種受影響最重。
- 修正：串流型 roster（有 `initialSequences`，即牧場）對所有物種串流，從 idle 加上呼叫端需要的序列開始；`ensureSpecies(id,{sequenceIds})` 在載入尚未開始時合併序列；進化目標帶入其揭示序列（39），後加入居民帶入當前序列。Hunt／Battle（無 `initialSequences`）保持整包載入。

### R2（已修）同一物種的初始序列逐一等待

- 修改後中間版本的紀錄顯示序列 0 與 39 的頁面仍是一前一後；改為一起請求。全域 atlas 佇列仍限制同時 2 頁，未提高併發上限。

回歸測試：`tests/championship-ranch-late-species-streaming-cases.mjs`（修改前 2 項失敗：整包載入、序列化；修改後全過；另固定 eager 路徑不變），`tests/championship-evolution-texture-cases.mjs` 新增「進化目標以揭示序列要求」。

## 5. 修改前／後數據

見第 9 節；彙整檔 [`evidence/measurements.json`](evidence/measurements.json)，各輪原始紀錄在 `evidence/runs/`。

## 6. 已證實、未修（需 Owner 決策）

### S1 催化進化中重新整理或返回標題：道具已扣、進化遺失

- 重現（`--scenario interrupt`，修改前產物）：催化後存檔立即寫入碎片 2→1；進化狀態只存在 `championshipStandaloneApp` 的記憶體 `raisingActors`，`nativeHome` 存檔不含；重新整理後主夥伴仍是 species-034，20 秒內未重新開始進化。
- 與本次症狀的關係：修改前 20–28 秒的「正在載入夥伴外觀…」提示列上同時顯示「返回標題／重新載入」，玩家在等待時按下即觸發。自然進化依程式不會遺失：角色重建時 `evolutionChecked=false`，重新進入後條件重新判定、再次開始，並再次等待目標載入——與回報的「重新進入後可能再次等待，之後才開始進化演出」一致（此段為程式推論，本次只實測催化路徑）。
- **更正（2026-11-08）**：本節原稿寫「`normalizeCyberGacha` 會靜默丟棄未知欄位」，這是錯的。它是預設拒絕，遇到未知欄位會丟出 `UNKNOWN_CYBER_GACHA_KEY`，整份存檔會被判定為無法讀取。因此原本建議的方案 A（在存檔新增待完成記錄）有回退風險：回退到舊版，或玩家仍開著部署前的舊分頁時，含新欄位的存檔會無法讀取。
- 採用的修正（Owner 回覆「要修」後實作，不改存檔格式）：催化當下只在記憶體保留金屬，進化寫入新形態時才扣除，兩者進入同一次存檔；保留期間背包顯示與所有金屬消耗入口都扣除保留量。中途重新整理時，存檔仍是「原物種＋金屬在」，可以再催化一次。回歸測試：`tests/championship-catalyst-evolution-crash-consistency-cases.mjs`。

## 7. 靜態風險與未證實假說

| 項目 | 分類 | 結論 |
|---|---|---|
| reviewed 圖片「主執行緒 fetch 驗雜湊、Pixi worker 再 fetch 解碼」 | 靜態風險 | Chromium 實測伺服器 0 重複請求（第二次由 HTTP 快取供應）；但解碼的位元組不是驗證過的那份（完整性缺口），Safari worker 快取行為未驗證。建議下一批改為由已驗證 Blob 解碼，保留 SHA-256 |
| SHA-256 驗證成本 | 已排除為瓶頸 | 每次進場約 38–41 次、合計約 5 MB、總計約 10 ms（Chromium）；保留不動 |
| 同頁往返重建 roster | 已量測 | HTTP 快取下 0 請求，但每次重新驗證、解碼、上傳；本機 1.4–2.0 s。跨場景保留紋理會增加 iPhone 記憶體，需另訂預算，未改 |
| `ranchTitlePreload` 範圍 | 已證實差異 | 排除全部 117 個 reviewed 物種（註解稱其原生頁已退役，但 4 個仍載原生頁），也不預取 reviewed 圖。只影響冷進入，與「牧場顯示後的等待」無關；列後續候選 |
| `residentAssetNotice` 時機 | 已排除 | 純展示；時鐘閘門獨立於提示 |
| 長任務 | 環境因素 | trace 主執行緒以合成器 `Commit` 為主（修改前 42 s／後 25 s，SwiftShader），JS 約 4 s。是 CPU 軟體繪製，不是 GPU 實測 |
| 進化中工具列 | 觀察 | 進化演出期間無法經工具列離開（reentry 情境等到演出結束才離開）；唯一出口是提示列的返回標題／重新載入 → 觸發 S1 |
| 進化演出自身資源 | 觀察 | 目標就緒後才 lazy 載入 2 個 chunk、4 張 glyph、2 張圖鑑圖；本機約 1 個請求往返，未單獨計時 |

## 8. 系統責任與接線（本次範圍）

| 階段 | 擁有者／啟動 | 取消／釋放 | 去重／重試 | 過期保護 |
|---|---|---|---|---|
| 牧場掛載 | `main.js mountRaisingHome → mountField`，`createLoadAttempt` | `attempt.cancel()`；`owner.transfer` 把 roster／場景交給場景 dispose | 「重試」先 `scene.retryResidentAssets()`，否則重建 attempt | `active(owner)` |
| 角色 roster | `loadOptionalCharacterReview`（每次掛載一份，`createPixiAssetScope` 綁 signal） | signal abort → `roster.dispose()` 等待晚到 bundle 後釋放 | 每實體一個 pending promise；最多 2 個 bundle 同時 | `retainBundle` 在 disposed 後直接釋放 |
| 頁面串流 | `pixiCharacterRuntimeBundle.ensureSequence` | bundle dispose 等待 pending 頁 | `pagePending` 去重；全域 atlas 佇列 2 頁 | 失敗頁不覆蓋最後已驗證畫格 |
| 進化目標 | `drawEvolution → loadEvolutionTarget` | `evolutionLoadToken` 失效；未掛上的 sprite 銷毀 | `retryResidentAssets` | token＋`evolutionActive` |
| 時鐘 | `championshipClockDriver`（既有 ticker） | `dispose` 移除 tick | — | 未就緒時 reset，不補算 |

修正只改變「後加入物種」從整包變為串流，沒有新增 loader、狀態或 ticker；所有入口（`loadEvolutionTarget`、`loadActorTextures`、覺醒預取）都經同一個 `ensureSpecies`，舊的整包路徑只剩 Hunt／Battle 使用。

## 9. 修改前／後數據

修改前＝正式核准產物 `3f2b4a6d…`；修改後＝候選 `208f6824…`（Owner 核准雜湊後的正式 `--external-characters` 建置與它位元組相同）。同一存檔、同一裝置模擬、同一路徑、同一伺服器，各輪依序執行。與其他工作同時執行而有 CPU 爭用的輪次已排除（`after-unthrottled`、`after-r2-…-reentry`、`after-r3`；`after-r2-…-interrupt` 只採用存檔結果），排除原因寫在 `evidence/measurements.json`。樣本少，只判斷方向，不給百分位。

### 9.1 催化進化：「正在載入夥伴外觀…」持續時間（主要症狀）

| 條件 | 修改前 | 修改後 | 進化目標請求數 前→後 |
|---|---|---|---|
| 未節流（各 3 輪） | 19.7、23.7、20.7 s | 7.5、7.6、6.6 s | 35 → 22–25 |
| 網路塑形 150 ms／4 Mbps（CPU 不降速，各 1 輪） | 28.4 s | 10.4 s（只修 R1 的中間版本：10.9 s） | 35 → 25 |
| 等待中嘗試離開再返回（reentry，未節流） | 14.2、15.6 s | 5.2 s | — |

- 催化後到新物種就緒（含演出開頭）：未節流 26.6／30.9／28.1 s → 16.1／15.4／15.4 s；網路塑形 36.1 s → 19.5 s。
- 修改前目標原生頁 10 頁逐一下載；修改後只剩第 0、9 頁，且同時請求。
- reentry 情境中，進化演出期間工具列無法操作，實際上要等到演出結束後才離開；這個數字代表「進化開始後的那次等待」，不是中途離開再進入。
- 剩餘等待在此環境主要是每一步被 400–900 ms 的長幀（SwiftShader 繪製提交）拖慢；實體 iPhone 上每一步約等於一個網路往返，預期會更短，但**未實測**。

### 9.2 一般進入（確認無回歸）

| 情境 | 修改前（未節流） | 修改後（未節流） | 修改前（塑形） | 修改後（塑形） |
|---|---|---|---|---|
| A 冷快取進入至全部居民就緒 | 2.1、3.2、2.7 s | 3.1、2.4、2.9 s | 16.7 s | 16.5 s |
| C 同頁往返（每輪 3 次） | 1.4–1.8 s | 1.5–2.2 s | 1.8–2.9 s | 1.7–2.9 s |
| B 保留快取重新整理 | 2.8–3.1 s | 2.8–2.9 s | 2.1 s | 1.9 s |
| R 進化後重新整理 | 2.6–3.1 s | 2.6–2.9 s | 1.8 s | 2.0 s |

- A／B／C 不會經過「後加入物種」，前後差異都在此環境的雜訊範圍內。C 第 1 輪在塑形下有 25 個請求：經伺服器紀錄核對，全部是離開圖鑑後仍在下載的圖鑑縮圖（`database-*` 資料夾），不是角色素材重抓（離開圖鑑後不會取消縮圖下載，列為觀察）；第 2、3 輪為 0 請求。
- 每次進場約 38–41 次 SHA-256、約 5 MB、合計約 10 ms，修改前後相同（驗證全數保留）。
- 觸控點擊到下一幀：0.25–1.8 s，前後落在同一範圍；這反映的是 SwiftShader 的幀成本，不代表手機觸控延遲。

### 9.3 正確性

- 每輪 R（進化後重新整理）：主夥伴讀回 `species-096`、4 位居民就緒、`pageerror` 0。
- 修改後 E 情境的 `data-resident-assets` 依序出現 `evolution:loading` → `ready` → 新物種 `species-096` 的 `animation` 串流，演出結束後沒有殘留錯誤狀態。
- `interrupt`：修改前與修改後結果相同——碎片 2→1，重新載入後仍是 `species-034`，`pageerror` 0。S1 存在，與本次修正無關，本批未修。

## 10. Owner 核准（已核准雜湊更新）

Owner 回覆「我核准公開建置雜湊的更」（訊息截斷，依內容記為核准雜湊更新），紀錄於 [PUBLICATION_APPROVAL.json](PUBLICATION_APPROVAL.json)。兩張核准表（`WEB_BUILD_INPUTS.v1.json`、`PUBLIC_RUNTIME_ALLOWLIST.v1.json`）各只改以下三列，8190 列的路徑、順序與其他欄位不變：

| 檔案 | 核准中 SHA-256 | 候選 SHA-256 |
|---|---|---|
| `src/championship/presentation/characterRosterCore.js` | `9403eb42151ee86c07cf87174dbcb7df9282020a90cfb411c42985228b3a8de9` | `99be65ab95236f64cb2787b687bafcb30db201e43211813ebb717ab91d5ff3a2` |
| `src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js` | `704322c77c5cfa6f1bab59a831f49c8097ac575cad6e668d58bacfa28ed19272` | `54f8e693db1e52675b7e765f18169999a2dd23604d658ee564eeda5f0a0b9899` |
| `src/championship/presentation/pixiCharacterRuntimeBundle.js` | `8a28dfd284c0ed96f4137ef9d9561d094acd22a9030c452d54288e804c0ecc60` | `4c12bf5431b999c79b7b07f55102c7d23fc55ec68712d6cf28415eb430a874b9` |

更新後 `build:playtest`／`validate:playtest` 通過（buildId `164a8b53…`，7718 檔）；`--external-characters`（正式 Pages 流程）通過，buildId `208f68243e1ff4ef5a1a97420639326134d7ee9b5b744f52a35860f75da46f5b`，與第 9 節量測的修改後候選**完全相同**。讀取核准表的 21 個可攜測試模組 134 項全過。

**仍需 Owner 另行核准**：合併 PR 到 main 與部署正式站（本次回覆未涵蓋）。

## 11. 待 iPhone 驗證步驟（實體裝置）

修正尚未部署；以下步驟先在現行正式站量一次（修改前），部署後再量一次：

1. iPhone Safari 開啟正式站，使用一份第 1–3 代夥伴在牧場、背包有足量催化金屬的存檔（不要用正式玩家存檔；可先在設定匯出備份）。
2. Mac Safari「開發」選單連線 iPhone，開啟網頁檢閱器的「時間軸」與「網路」，勾選保留紀錄。
3. 牧場就緒後：背包 → 進化金屬 → 立即使用 → 選夥伴 → 催化進化 → 關閉背包。
4. 記錄：提示「正在載入夥伴外觀…」出現到消失的時間；網路面板中目標物種 `ranch-streaming-v1/main-*.json|webp` 的請求數與是否逐一排隊；進化演出開始時間。
5. 在等待期間點一次工具列，記錄是否有回應（預期進化期間鎖定）。
6. 修改後預期：目標原生頁只剩 2 頁（idle＋序列 39）同時請求；不應出現 10 頁逐一下載。
7. 另測 S1：催化後立刻重新整理，確認夥伴物種與金屬數量（修正前預期遺失，待 Owner 決定方案）。

外部服務：無。本修正不涉及後端、帳號或雲端存檔。

## 12. 風險與回退

- 取捨：後加入物種的其他序列改為首次使用時串流，首次播放新動作可能出現短暫「載入中」（可見角色延遲 900 ms 才顯示提示，與既有初始居民一致）；換來進化／孵化前不再等待整包。總下載量不增加（只載入用到的頁）。
- 未改：畫質、素材、雜湊驗證、玩法規則、存檔格式、Hunt／Battle 載入、單一 Pixi Application／ticker。
- 回退：`git revert` 修正 commit 即可；無存檔或資料遷移。

## 13. 下一步

1. 雜湊已核准；待 Owner 核准合併與部署 → 部署後 iPhone 實測（第 11 節）。
2. S1 已以「完成時才扣除」修正（不改存檔格式），待 Owner 核准雜湊後隨下一批發布。
3. 下一批候選：reviewed 圖片由已驗證 Blob 解碼（完整性＋Safari 風險）；標題預載對 reviewed 物種的範圍；同頁往返的保留策略（需記憶體預算）。
