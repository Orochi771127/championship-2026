# VFX 五層複合架構升級報告（2026-11-01）

- 依據：Owner 2026-11-01 指令（`docs/coordination/OWNER_DIRECTION.md` 的 `VFX_FIVE_LAYER_20261101`），以及前一份盤點 `docs/VFX_FULL_AUDIT_REPORT_ZH_TW.md`。
- 工作樹：`R:\Projects\Championship2026\vfx-five-layer-20261101`，分支 `feat/vfx-five-layer-20261101`，從 `origin/main` c6628c38 切出。
- 狀態：**未 commit、未 push、未部署**（依指令）。
- 性質：全部是呈現層。招式數值、元素規則、時機、亂數、原作特效腳本、碰撞和存檔都沒有改。

## 架構抉擇（Phase 1）

採用「冠軍賽腳本驅動」的方案 A：原作特效腳本照舊逐 tick 驅動每格圖，重製只換圖格。外面再疊五層：
1. 出招部位的屬性聚氣光球＋4 顆繞行亮點；
2. 發射時的槍口氣浪環＋7 顆後座力火花；
3. 必殺技約 0.53 秒的全畫面背景風暴（15 fps 逐格、權重階梯淡出，取自月光 bgeff 的節奏）；
4. 存活 4 秒的地面元素印痕；
5. 受擊殘留與命中 1.22 倍鏡頭推進。

**單一特效屬性權威**：`src/championship/presentation/vfx/unifiedMoveVfxResolver.js`。AI 對戰、圖鑑、Data Arena 都改讀它。優先序：
1. 招式名稱明講的元素（`src/championship/text/moveNameElements.js`）；
2. 招式紀錄的元素欄；
3. 特效 bank 的家族色；
4. 施放拍檔的十屬性（`species-taxonomy.v1.json`）。

結果：565 個具名招式全部落在十屬性之一，沒有一招停在「無」。

## 各 Phase 結果

| Phase | 做了什麼 | 主要檔案 |
|---|---|---|
| 1 | 統一屬性解析器；名稱和 bank 顏色衝突時，圖格轉色相（焰角泡泡 −173°）；月屬性遇到亮色 bank 時乘上紫色 | `vfx/unifiedMoveVfxResolver.js`、`text/moveNameElements.js`、`battleEffectSprites.js`、`battleFxLookups.js` |
| 2 | 圖鑑在按鈕出現時就預載圖集，播放前等它就緒（最多 2.5 秒）；所有遠程風格都帶本體圖格，光束、火焰、雷、聖光、音波、藤、刺、地裂改成沿路徑鋪設圖格；拿掉 CSS 三角扇形；圖格放大到 3.2–4.2 倍 | `juicy/codexShowcaseTheater.js`、`showcaseMoveVfx.js`、`showcaseBankCells.js`、`app/ui/juicyShowcase.css` |
| 3 | 五層同時用在 AI 對戰（Pixi）、圖鑑（DOM）、Data Arena（Pixi）；AI 對戰的光束加上波動連線 | `vfx/elementVfxLayer.js`、`battleFx/battleFxLayer.js`、`battleFx/battleFxCamera.js` |
| 4 | Data Arena 只載入原創圖格（210 格重製包，本機另載 r2），不載原作 ROM 圖集；全模式重擊有 55 ms 繪圖頓幀；每次命中留 4 秒印痕；80 TP 強力技有背景風暴 | `dataArena/dataArenaElementFx.js`、`dataArenaPixiScene.js`、`app/dataArenaScreen.js`、`vfx/originalVfxCellArt.js` |
| 5 | 喚醒 3D 特效：輔助招 → atkup／defup／speedup／hitup／toleup／circle／circle_my／lightup；會心一擊 → critup；必殺天氣 → wind／sandstome／snowstome＋snow／rain＋mist／spark／lightup／mist。三組閒置 bank 和 151 筆無 bank 招式都配了保底圖格 | `vs5/createBattleVfxThreeOverlay.js`、`app/main.js`、resolver |
| 追加 | 重製 r2：11 組 bank、72 格（69 格有圖），純程式繪製、沒有任何圖片輸入 | `scripts/build-shared-vfx-remake-r2.py`、`assets/production/vfx/original-shared-remake-r2-20261101/` |

## 覆蓋率（實算）

| 項目 | 之前 | 之後 |
|---|---|---|
| 具名招式至少一段是原創圖 | 339／565（60.0%） | **508／565（89.9%）** |
| 具名招式全部段都是原創圖 | 243／565（43.0%） | 420／565（74.3%） |
| 必殺技有 2D 圖格 | 200／204（4 招沒有） | **204／204** |
| 必殺技至少一段是原創圖 | — | 173／204 |

單靠重製 9 組 bank 只能到 63.2%。真正的提升來自「151 筆無 bank 招式改播原創保底圖格」，再加上 r2 重製。

## 驗證

- `npm run test:ci`：**3,240／3,240 通過**（基準 3,230，加上新增的 `tests/championship-vfx-five-layer-cases.mjs` 共 10 項）。
- 瀏覽器閘門（獨立埠 8814，不碰 8732 存檔）：
  - `championship-codex-showcase-browser.cjs`：**PASS**（10 輪、沒有新增 WebGL context、存檔不變）。
  - `championship-data-arena-relay-browser.cjs`：「release drives recovery animation」失敗。我另開一份乾淨的 `origin/main` 基準跑同一閘門，**結果一樣失敗**，所以這是主線本來就有的紅燈，不是本批造成的。
- 實機截圖（手機直向 390×844，Playwright 腳本凍結動畫幀，見下方四張圖）。

## 截圖

- 圖 1 `fig1-dex-rex-flare.webp`：圖鑑「火甲龍・烈鎧焰砲」五個節拍——火焰漩渦風暴＋嘴部聚氣光球、必殺字幕、原創 `beam01` 光束段（r2）、1.22 倍推進＋Owner `explo` 爆炎圖格、焦痕＋燼花殘留。CSS 三角扇形已經不在。
- 圖 2 `fig2-dex-ember-bubble.webp`：「紅頭丸・焰角泡泡」——原創 `bubble00` 泡泡（r2）轉成火色、火焰風暴、火色水滴、焦痕。不再是藍色冷水滴。
- 圖 3 `fig3-ai-battle.webp`：AI 練習戰——黑鎧龍「闇鎧墨核」的必殺字幕（中間的白黃大圓是原作的 3D 必殺前導 hypereffect，本來就有）、闇鎧墨核（月屬性）喚醒的 3D 月霧天氣 `common-mist`（持續 1.5 秒，此時字幕已換成下一招；已改成柔和線性濾鏡）、戰暴龍「日冕聖陽彈」重擊、冰系點綴與 1.22 倍推進。這場一共產生 34 個印痕、4 次風暴、27 個槍口環、54 個原創保底／點綴圖格，零錯誤；名稱屬性轉色同時套用在最多 4 個原作圖格上（診斷 `effectSprites.recoloured`）。
- 圖 4 `fig4-data-arena.webp`：Data Arena 接力戰，木屬性「阿花仔」＋風屬性「針嘴鷹」——木綠聚氣、原創命中圖格、水系命中的水漬印痕、森域震波的 gale 風暴。
- 圖 0 `fig0-remake-r2-cells.webp`：重製 r2 全部 69 格。

## 沒做到或要注意的地方

1. **QA 存檔沒有木、土、風的成熟期夥伴**，所以 AI 對戰截圖只示範了金（鋼鐵加魯魯獸 #554／#556）、冰、日、月。木和風改在 Data Arena 示範；土由解析器測試覆蓋（例如 #272 腐沼毒核→EARTH）。
2. **這場 AI 練習戰沒有出現輔助招**，所以 atkup／defup 等 3D 特效只用單元測試驗證系統 ID 存在、對應正確，沒有實機截圖。輔助碼 24 對應的能力在原作還沒追蹤到（UNKNOWN_REQUIRES_TRACE），綁 hitup 是呈現層的選擇。
3. `test_buff`、`test_eff`、`time_pl` 三個 3D 系統維持閒置：它們是轉檔測試素材和計時器道具，不是招式特效。
4. **重製 r2 只在本機審查**（ART_PRODUCTION_INDEX：`humanApproved false`）。公開試玩網址仍然只用已核准的 210 格。要上線需要 Owner 審圖並另外授權發布。
5. **發布前要補的契約**：`WEB_BUILD_INPUTS` 和 `PUBLIC_RUNTIME_ALLOWLIST` 要加 6 個新模組，其中 `sharedVfxRemakeR2.js` 是動態 import，要加進 `moduleEntries`；改動檔案的雜湊要刷新。這屬於發布核准步驟，本批沒有做。
6. 原作的 AI 對戰圖格（ROM 參考）照舊只在本機和授權 Pages 網址載入。其他網址的對戰本來就無法開始（`BATTLE_CORE_ART_UNAVAILABLE`），這點跟盤點報告寫的「只剩 2–4 層」不同，在此更正。
7. `scripts/build-module-preload.mjs --check` 在主線本來就是 stale（缺的是 taxonomy、stage body size 等前批模組）。本批沒有動 `championship.html`。
