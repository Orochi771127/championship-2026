# 《網線拍檔：錦標賽》全遊戲 VFX 特效實作真相與資產總盤點報告

- 日期：2026-11-01
- 性質：**只讀盤點**。沒有修改任何遊戲程式碼、資料、存檔或發布狀態。
- 盤點基準：`origin/main` **c6628c38**（2026-10-30，PR #136 合併，即目前線上版）。本機目前檢出的分支 `feat/database-original-stories-v3-1` 停在 10-22，不含之後的特效改動，所以改用 `git archive origin/main` 匯出唯讀副本來掃描。
- 方法：讀原始碼、manifest 和招式資料，並用腳本統計（招式 × 特效 bank、圖檔尺寸、幀數）。**沒有開瀏覽器實測**，凡是「畫面上看起來會怎樣」的推論都會標明。
- 對照組：《數碼寶貝 月光》拆包研究（`R:\NEXUS LINK\原作\research-only\MOONLIGHT_ROM_DECONSTRUCTION_2026-10-29`），以及 Pokémon Arena 2D（`C:\Users\User\Downloads\Pokemon-Arena-2D.7z`，SHA256 `4edab7c8…adcc2`，與前次研究相同）。兩者都只作研究參考，內容不進產品。

圖例：`[🖼️ 圖片序列幀]` 載入多格圖片依序播放｜`[📐 程式碼繪圖]` Canvas / PIXI.Graphics / CSS 漸層與多邊形｜`[✨ Three.js]` 3D 模型或粒子｜`[❌ 缺漏]` 沒有專屬表現、用預設光效

---

## 先講結論（5 點）

1. **你的直覺一半對。** 只有「AI 自動對戰」真的在播原作序列幀：它用原作的 151 組特效 bank（1,231 格），由原作的特效腳本逐格驅動，其中 39 組特效（72 段動畫、210 格）已換成 Owner 原創重製圖。其他場景——**Data Arena、圖鑑展演、進化、轉蛋、勝利 Highlight——的招式／演出特效都是程式碼畫的**。
2. **原作本身的序列幀其實很短。** 原作 484 段特效動畫，每段中位數只有 **2 格**（最多 12 格），單格多為 16×16 原生像素。動感主要來自特效腳本即時改位置、縮放、旋轉、透明度和色調，不是一張張畫完的長動畫。所以「重做成高品質序列幀」不只是換圖，還要決定保不保留這套腳本驅動。
3. **圖鑑的「橘色扇形」就是 CSS。** `烈鎧焰砲` 的展演風格是 `flame`，飛行段畫的是 `.cm-vfx--flame`：一個 `clip-path` 三角形加橘色漸層。招式自己的原作圖格只在命中瞬間疊一下，而且圖集是點按鈕後才開始下載，程式不等它載完，第一次預覽很可能完全沒有圖格（從原始碼推論，未實機驗證）。
4. **5 個新屬性（金、木、水、土、風）沒有任何專屬特效圖。** 特效程式根本不讀拍檔的十屬性分類，只看招式紀錄裡原作的元素欄（6 種）和特效 bank 名稱。金屬、木、土、風的顏色只會在 bank 名稱剛好對上規則時出現。
5. **能合法正式上架的招式序列幀，目前只有 Owner 重製的 210 格。** 原作圖集標記為 `ROM_COPYRIGHTED_REFERENCE`／`LOOPBACK_RESEARCH_ONLY`，只在本機和 Owner 授權的 Pages 試玩網址載入；換成任何其他網址，AI 對戰也只剩程式繪圖和 Three.js 命中特效。
6. **對照組 Pokémon Arena 2D 的招式特效 100% 是程式碼畫的。** 全包 9,047 張 PNG 沒有一張特效圖，`move-effects.mjs` 裡 `drawImage` 出現 0 次。它看起來好，靠的是 42 個招式家族的分層、每隻角色 7–14 種動作圖（含蓄力 Charge、發射 Shoot），以及 182 種招式音效。

---

## 第一部分：四大場景的特效渲染方式真相對比

### 1-0 總表

| 場景 | 主要檔案 | 招式本體 | 命中 | 加料層 | 和 AI 對戰共用序列幀？ |
|---|---|---|---|---|---|
| AI 自動對戰（一般錦標賽／VS5／教學戰） | `battleEffectArt.js`、`originalSharedVfxReview.js`、`battleEffectSprites.js`、`vs5/createBattleFieldPixiPresentation.js`、`battleFx/battleFxLayer.js`、`vs5/createBattleVfxThreeOverlay.js`、`juicy/skillCutIn.js` | 🖼️ 原作圖格＋Owner 重製圖格，由原作特效腳本逐格驅動 | 🖼️ 命中 bank＋✨ Three.js 命中模型（5 種）＋📐 閃光／塵土／碎屑／焦痕 | 📐 拖尾、地面衝擊環、頓幀、傷害數字；DOM 必殺字幕條 | —（本身就是來源） |
| Data Arena 即時手動對戰 | `dataArena/dataArenaPixiScene.js`、`dataArenaTextures.js`、`dataArenaRelayEffects.js`、`modes/dataArena/dataArenaRelay.js` | 📐 啟動時用 Canvas 畫好的白色向量紋理，再依屬性染色 | 📐 粒子爆散、圓環 | 📐 鏡頭震動、傷害數字；DOM 必殺字幕條 | **否**，連一張特效圖都不載入 |
| 圖鑑必殺技展演 | `juicy/codexShowcaseTheater.js`、`juicy/showcaseMoveVfx.js`、`juicy/showcaseBankCells.js`、`app/ui/juicyShowcase.css` | 📐 DOM 元素＋CSS 漸層／`clip-path`＋Web Animations（23 種風格、54 個 CSS 類別） | 📐 CSS 爆光＋⚠️ 可能疊上原作／重製圖格 | 📐 60 ms 頓幀、訓練假人擊退 | **部分**：同一張圖集，但只在授權網址、圖集已載完時才疊上 |
| 進化／牧場／轉蛋／勝利 Highlight | `juicy/cyberMorphEvolutionRunner.js`、`intRh2/createRaisingFieldPixiPresentation.js`、`raisingFeedbackArt.js`、`app/cyberGachaView.js`、`highlight/createHighlightBurstThree.js`、`app/ui/arcadeFx.js` | 見 1-4 | — | — | 牧場回饋用的是原作通用圖格的複本；其他都不共用 |

### 1-1 AI 自動對戰（一般錦標賽／VS5）

**是真・序列幀，而且是全遊戲唯一用到的地方。** 一招分 4 層疊出來：

1. **原作圖格層 `[🖼️]`**
   - `main.js` 呼叫 `loadRegisteredBattleEffectArt()`，載入 `internal-faithful-baseline/battle-effects-v1/effects.png`（1024×1024，151 組 bank，1,231 格）。
   - 接著 `loadOptionalOriginalVfxReview()` 用 Owner 重製包 `original-shared-review-210-seamfix-r1/effects.png`（1024×2048，210 格）**整段替換** 39 組特效。本機和授權試玩網址預設開啟，`?vfxOriginal=off` 可關掉。
   - `battleEffectSprites.js` 替每個存活中的原作特效角色建一個 `PIXI.Sprite`。每一格要顯示哪一格圖、位置、縮放、旋轉、透明度、色調，**全部由原作特效腳本（native effect VM）決定**，呈現層不自己發明時間軸。
2. **Three.js 命中層 `[✨]`**
   - `createBattleVfxThreeOverlay.js` 在 Pixi 戰場上疊一張透明 WebGL 畫布，載入 `licensed-runtime-v1` 的 GLB 模型（原作 Nitro 3D 特效轉檔，貼圖 32×32，帶材質動畫）。
   - 實際接上 7 個：`hypereffect`、`hypereffect_ring`（必殺前導）、`hitspark_small`／`hitspark_big`、`s_impact_s`／`s_impact_b`、`earth_hit`（`battle/battleImpactEffects.js`，18–30 格）。
3. **程式加料層 `[📐]`**（`battleFxLayer.js`，Owner 2026-10-12 授權的動態呈現）
   - 用 Canvas 生成的貼圖畫拖尾、地面衝擊環、塵土、會彈跳的碎屑、焦痕、接觸閃光、傷害數字、招式名稱。
   - 「juicy 命中四連」：140 ms 蓄力壓縮、60 ms 頓幀、依屬性染色的閃光加 8–12 px 擊退、拋物線傷害數字。
4. **DOM 字幕條 `[📐]`**：必殺技有 650 ms 斜向字幕條（施放者頭像＋招式名），一般技有 550 ms 小膠囊（`skillCutIn.js`）。

**限制：** 原作圖集和重製包只在 `localhost`／`127.0.0.1`／`[::1]` 或 `https://orochi771127.github.io/championship-2026/` 載入（`isLocalBattleEffectPreview`）。其他網址只剩第 2、3、4 層。`?battleFx=classic` 會關掉第 3 層。

### 1-2 Data Arena 即時手動對戰

**完全是程式碼繪圖，和 AI 對戰的序列幀零共用。**

- `dataArenaTextures.js` 開頭寫明：「No image files: every texture below is drawn to a canvas when the arena mounts」。它在進場時畫 30 種貼圖：光暈、火花、碎晶、光束核心／外暈、火彈、光球、浪、雷、火焰、冰、焦痕、木屑等。
- RELAY 模式另由 `dataArenaRelayEffects.js` 畫 16 種白色向量投射物頭：Flame、Lance、Crystal、Slash、Leaf、Seed、Thorn、Spore、Missile、Bullet、Drop、Bolt、Rock、Wind、Orb、Ring，再加港口模式的 wave。之後依屬性染色。
- **普通攻擊**：依體型 9 類（weapon／cannon／fist／wing／quadruped／jaw／tail／core／body）決定近戰或射擊，畫的是 `relaySlash` 或彈體紋理加火花爆散。`[📐]`
- **小招**：RELAY 的 `STYLE_LOOKS` 把 23 種招式風格對到這 16 張紋理，例如 `fireball`／`flame` 都是 `relayFlame`；`holy`／`beam`／`pierce` 都是 `relayLance`；`shell`、`ice` 共用 `relayCrystal`。命中時依 `impact`（star／leaf／ember／drop／rock／blast…）噴粒子。`[📐]`
- **80 TP 強力技**：同一套紋理放大，加上新星擴散環和鏡頭震動，再由 `dataArenaScreen.js` 的 `ultCutIn()` 播 DOM 字幕條。`[📐]`
- RELAY 從 10-28 起會帶入「角色自己的招式」（例如 `烈鎧焰砲`），但只借它的**風格名稱**換算成場上機制和紋理，**不讀它的原作特效 bank**。
- 唯一和 AI 對戰共用的是 `battleFxLayer.js` 裡一個混色小函式 `mixColor`。冰塊、掩體等互動圖片是場景道具，不是招式特效。

### 1-3 圖鑑必殺技模擬展演（`codexShowcaseTheater`）

**底層一律是 CSS 畫的，原作／重製序列幀只是「有機會」疊在上面。** 為什麼你看到的只是漸層扇形或圓圈，有 6 個原因：

1. **設計上就是 DOM＋CSS。** 10-28 的 commit 2cc434e6 明寫「Zero WebGL: the runner, cut-in and Dex sandbox are DOM + Web Animations」。`showcaseMoveVfx.js` 的 23 種風格全用 `juicyShowcase.css` 裡 54 個 `.cm-vfx--*` 類別畫出來，沒有任何 `url(...)` 圖片。
2. **風格來自另一張表，不是招式自己的 bank。** 展演讀 `move-vfx-themes.r1.json`：565 招 → 23 種風格。來源分成 BANK 286 招、招式名稱 243 招、家族規則 36 招。
   - `烈鎧焰砲`（#61）：原作 bank 是 `beam01`（光束段）＋`explo`（爆炸），但名稱有「焰」，所以被歸成 `flame` 風格。飛行段就是 `.cm-vfx--flame`：
     ```css
     clip-path: polygon(0 42%, 100% 0, 100% 100%, 0 58%);
     background: linear-gradient(90deg, #fff4c2, #ff8a1c 38%, #d8360f 82%, transparent);
     ```
     **這就是你看到的半透明橘色扇形。**
   - `焰角泡泡`（#34）：bank 是 `bubble00`，所以被歸成 `water` 風格、水色調色盤。畫的是 10 顆 CSS 水滴（`border-radius` 加漸層）和一條藍色條紋水柱，命中時是水滴和圓環。所以它看起來是**藍色圓點和圓圈**，跟名字裡的「焰」對不上。
   - `腐沼毒核`（#272）：bank 是 `unchi00`，風格 `spore`、毒色。CSS 孢子球加雲霧。
3. **圖格只跟著 9 種風格飛。** `SHOWCASE_CARRIER_STYLES` 只有 missile、gatling、shell、fireball、seed、ice、dark、leaf、spore。`flame`、`water`、`beam`、`thunder`、`holy`、`wind`、`quake`、`sound`、`vine`、`thorn` 和近戰類**飛行時不帶招式本體圖格**，本體圖格只在命中瞬間於假人身上播一次。
4. **圖集是按下按鈕才開始下載，程式不等它。** `specialButton` 點下去才 `createShowcaseBankCells()`。它要依序下載 280 KB 描述檔、1024² 原作圖集、92 KB 重製描述檔和 1024×2048 重製圖集。但 `playCell()` 只檢查 `cells.has()`，沒有等 `ready`。在圖集載完前播放的展演完全沒有圖格（原始碼推論；實際網速下前一兩次預覽多半落空，未實機量測）。
5. **網址限制。** 和 AI 對戰相同，只在本機和授權 Pages 網址才載入圖格，其他網址只有 CSS。
6. **圖格很小。** 原生 16–32 px，放大 2–4 倍後是 32–128 CSS px，疊在 74–150 px 的 CSS 爆光上很不顯眼。`烈鎧焰砲` 的 `beam01` 本體只有 1 格、2 tick；真正明顯的是 +90 ms 播放的 `explo` 爆炸（Owner 重製，6 格）。

### 1-4 進化／退化、牧場餵食、轉蛋、勝利 Highlight

| 演出 | 技術 | 說明 |
|---|---|---|
| 進化／退化（預設主題） | 📐 DOM＋Web Animations；角色本身 🖼️ | `cyberMorphEvolutionRunner.js`：2.6 秒，有六角隧道、黑白頻閃、能量環和數值面板，全部是 CSS／DOM。角色是遊戲內真的待機動作圖（`spriteMotionPlayer.js`）。進化字形是 4 張 128×128 靜態 PNG（`evolution-glyphs-v1`）。 |
| 進化（classic 主題） | 📐 PIXI.Graphics＋靜態字形 | 牧場場景裡的 `evolutionGlow`、`evolutionBackdrop`（Graphics），字形跟著原作進化計時器換。 |
| 牧場餵食／治療／恢復回饋 | 🖼️ 原作圖格（限授權網址） | `raisingFeedbackArt.js` 載入 `raising-feedback-v1` 的 182 格 PNG（8–32 px）。它們其實是原作 bank 1 通用圖格的複本（第 0 格雜湊和 `e003_battle` 相同），由原作牧場計時器驅動。 |
| 牧場心情／打招呼／撿到東西 | 📐 程式像素圖 | 愛心、音符、閃光、肉、zzz 等圖示寫成字元陣列，用 `PIXI.Graphics` 畫，不用 emoji 字型。 |
| 轉蛋 | 📐 DOM＋Web Animations；零件 🖼️ 靜態圖 | `cyberGachaView.js` 不用 canvas。機身、搖桿、四種稀有度膠囊上下殼、票券、合成爐共 12 張靜態 WebP（192 px 寬），翻滾和裂開都是 Web Animations，**沒有序列幀**。 |
| 勝利 Highlight | 📐 DOM／CSS＋✨ Three.js 方塊 | `createHighlightSequence.js` 分五段；`createHighlightBurstThree.js` 是數十個沒有貼圖的小方塊聚集後爆散。 |
| 介面按鈕／結算手感 | 📐 2D canvas 粒子 | `app/ui/arcadeFx.js`：像素粒子、跳字、震動、卡片 3D 傾斜。 |
| （附）狩獵 | 🖼️ 原作圖格＋📐 | `hunt-feedback-v1` 19 組 254 格（炸彈、子彈、陷阱、數碼牢籠、肉）；捕獲收納光點 `captureStorageVfx.js` 是程式畫的。 |

---

## 第二部分：專案內現有特效圖片／Bundle 全清單

狀態：✅ 已在遊戲中使用｜⚠️ 只在部分場景或條件下使用｜💤 閒置（檔案在、沒有程式呼叫）

### 2-1 主線上（origin/main）的 Bundle

| # | 資產 ID／路徑 | 圖片尺寸與幀數 | 內容 | 權利／範圍 | 狀態 |
|---|---|---|---|---|---|
| 1 | `art:vfx:battle-effects:local-reference:v1`<br>`assets/production/internal-faithful-baseline/battle-effects-v1/effects.png`＋`manifest.json`（公開描述檔：`public-runtime/battle-effects.render.v1.json`） | 1 張 1024×1024 圖集；151 組 bank、484 段動畫、1,231 格（1,132 格非空白）；單格 8×8 至 104×48 | 原作全部招式特效：火球、泡泡、光束段、飛彈、雷球、黑煙、爆炸、近戰命中印記、字卡…（分類見附錄 A） | ROM 版權參考；只限本機＋授權 Pages | ✅ AI 對戰；⚠️ 圖鑑（要授權網址＋已載完）；❌ Data Arena。151 組裡 144 組有招式指名，4 組是系統用（2–5），**3 組沒有任何招式指名**：`25 seed00`、`26 snowcrystal00`、`121 blacksmoke04` |
| 2 | `art:public:shared-vfx:v1`<br>`assets/production/vfx/original-shared-review-210-seamfix-r1/effects.png`＋`manifest.json` | 1024×2048；39 個特效項目、橫跨 26 組 bank、72 段、210 格（每原生 px 畫 4 px） | **Owner 原創重製**：稜光衝擊、三痕裂爪、鋼月斬、貫槍突刺、彗燼火球、翻騰爆炸、稜光／熾焰射線、雷暴球、怒濤巨浪、雙發飛彈、金月雙刃…（見附錄 B） | 原創，Owner 10-12 授權發布 | ✅ AI 對戰（整段替換）；⚠️ 圖鑑 |
| 3 | `assets/production/vfx/original-shared-review-v1/text-zh-Hant.png`、`text-ja.png`、`text-en.png` | 256×1024、1024×256、512×512；12 段字卡 | 戰鬥跳字（MISS、CRITICAL 等）三語版 | 原創 | ✅ AI 對戰，依遊戲語言設定只載一套 |
| 4 | `art:vfx:licensed-runtime:v1`<br>`assets/production/vfx/licensed-runtime-v1/`（26 個 GLB＋32 張 PNG 貼圖） | 26 個 3D 系統；貼圖 32×32（地圖效果 64×64、`spark` 32×128）；命中家族 18–30 格材質動畫 | 原作 Nitro 3D 特效轉檔：命中火花大小、衝擊環、地面命中、必殺前導光環、能力升降、天氣（雨、雪、霧、沙暴、風）、閃電等 | LICENSED（Owner 09-02），非上架完成 | ✅ 7 個：hypereffect、hypereffect_ring、hitspark_small／big、s_impact_s／b、earth_hit<br>💤 19 個：atkup、defup、critup、hitup、speedup、toleup、circle、circle_my、test_buff、test_eff、mist、rain、sandstome、snow、snowstome、wind、spark、lightup、time_pl（只能用 `?vfxArt=` 單獨預覽） |
| 5 | `art:vfx:faithful-original:internal-v1`<br>`assets/production/internal-faithful-baseline/v1/vfx/`（74 檔） | 同 #4 的 GLB／PNG 複本 | 同上 | 內部基準 | 💤 `faithfulVfxRuntimeBundle.js` 沒有任何檔案 import |
| 6 | `championship-vfx-original-rom-conversion-v1`<br>`assets/production/vfx/original-rom-conversion-v1/` | 5 個系統（gate_select 地圖 256²×3、hitspark_big、hypereffect、rain、spark） | 早期轉檔試驗 | `runtimeRegistryEnabled:false` | 💤 |
| 7 | `art:vfx:original-battle-2d:v1`<br>`assets/production/vfx/original-battle-2d-v1/effects.png` | 1254×1254；16 格，每格 313×313 | AI 生成的替代圖（bank 1、19、81） | `RETIRED_GENERATED_REPLACEMENT_OWNER_CORRECTION` | 💤 已被 Owner 退件 |
| 8 | `assets/production/internal-faithful-baseline/hunt-feedback-v1/`（19 個資料夾） | 254 格 PNG，8×8 至 64×72 | 炸彈（一般／閃光／睡眠／暈眩）、子彈三種、誘餌、數碼快取、數碼光、數碼牢籠、大小地雷、肉四種 | ROM 版權參考 | ✅ 狩獵（限授權網址） |
| 9 | `assets/production/internal-faithful-baseline/raising-feedback-v1/` | 182 格 PNG，8×8 至 32×24 | 牧場反應、治療、恢復星星（原作 bank 1 通用圖格複本） | ROM 版權參考 | ✅ 牧場（限授權網址） |
| 10 | `assets/production/evolution-glyphs-v1/CP-G01…G04-*-128.png` | 4 張 128×128 靜態圖 | 連結、記憶、成長、進化字形 | 原創（Owner 10-13 選定） | ✅ 進化（不是序列幀） |
| 11 | `assets/production/ui/cyber-gacha-r1/*.webp` | 12 張靜態圖，192 px 寬 | 轉蛋機零件、膠囊殼、票券、合成爐 | 原創 | ✅ 轉蛋（不是序列幀） |

### 2-2 只在本機、沒有進主線

| 路徑（`championship-2026/assets/production/vfx/`，未追蹤） | 內容 | 狀態 |
|---|---|---|
| `original-shared-review-v1/effects.png`＋`manifest.json` | 1024×2048，157 格／32 組，重製包第一版 | 💤 已被 210 格版取代 |
| `original-shared-review-157-seamfix-r1/` | 1024×2048，157 格，接縫修正版 | 💤 已取代 |
| `original-shared-beam-seamfix-r1/` | 1024×2048，157 格，光束接縫修正 | 💤 已取代（光束格已併入 210 版） |

工作區另有研究用資料夾：`VFX_共用特效_原作對照_研究用_20261006`、`VFX_共用特效_原創交付_20261006`（3 個交付 zip）、`VFX_ORIGINAL_MEGA_READONLY_20261005T043538Z`、`vfx-acceptance-20261007`。這些都不是執行期資產。

### 2-3 「看起來像特效、但沒有任何圖檔」的程式繪圖清單

| 模組 | 畫出的東西 | 數量 |
|---|---|---|
| `battleFx/battleFxLayer.js` | 閃光、塵土、火花、點、3 種碎屑、焦痕（Canvas 生成）＋ Graphics 環、拖尾、速度線 | 8 種貼圖＋多層 Graphics |
| `dataArena/dataArenaTextures.js` | Data Arena 全部特效與道具貼圖 | 30 種 |
| `dataArena/dataArenaRelayEffects.js` | RELAY 投射物頭 | 16 種（＋wave） |
| `juicy/showcaseMoveVfx.js`＋`juicyShowcase.css` | 圖鑑 23 種風格 | 54 個 CSS 類別 |
| `juicy/skillCutIn.js`、`cyberMorphEvolutionRunner.js` | 字幕條、進化演出 | DOM |
| `highlight/createHighlightBurstThree.js` | 無貼圖 3D 方塊 | Three.js |
| `app/ui/arcadeFx.js` | 像素粒子、跳字 | 2D canvas |
| `vfx/captureStorageVfx.js` | 捕獲光點 | 程式 |
| `vfx/battleWeatherVfxPresentation.js` | 天氣特效呈現 | 💤 沒有任何檔案 import |

---

## 第三部分：對戰招式「逐類實作解剖表」

### 3-0 招式資料底數

| 項目 | 數字 |
|---|---|
| 招式紀錄 | **596 筆**（#0–30 為 31 筆通用／系統紀錄；#31–595 為 **565 個具名招式**） |
| 擁有招式紀錄的物種 | 206 個。拍檔分類表有 232 隻；沒有自己招式紀錄的 28 隻是 12 隻幼年期（#8–19，原作不參戰）和 16 隻新角色（#229–244）。這是用同一編號空間比對的推論。 |
| 呈現層分級（`battleFxMoveTier`） | 普攻 205、一般技 157、**必殺技 204**（每物種最強的 kind-1 招）、輔助 30 |
| 招式指名的特效位置 | 蓄力 prepare 21 招、發射 launch 133、本體 body 413、命中 hit 413、追加 extra 157（以 565 具名招計） |
| 完全沒有指名任何特效 bank | 156 筆（143 筆普攻、5 一般技、4 必殺技、4 輔助） |
| 只指名泛用 bank（`battle`／`etc_hiteffect`／4 種近戰命中印記） | 202 筆 |
| 招式原作元素欄 `elementSelect` | 無 437、火 55、水 31、光 22、暗 32、雷 19（只有 6 種） |

### 3-1 AI 自動對戰的「三段式」怎麼做

| 段落 | 原作圖格 | Three.js | 程式加料 |
|---|---|---|---|
| ① 施放蓄力 Cast | `[🖼️]` 只有 21 招有 prepare bank | `[✨]` 必殺前導 `hypereffect`＋光環（有原作前導事件時） | `[📐]` 腳下衝擊環、揚塵、140 ms 蓄力壓縮；必殺 DOM 字幕條＋場地變暗 35 % |
| ② 飛行彈道 Projectile | `[🖼️]` launch／body bank，由原作腳本逐格移動、縮放、旋轉 | — | `[📐]` 拖尾：發光底線＋白芯 |
| ③ 命中爆炸 Hit | `[🖼️]` hit／extra bank（`explo` 被 42 個物種、47 筆招式紀錄共用） | `[✨]` 依體型與主副攻選 5 種命中模型之一 | `[📐]` 接觸閃光、火花、碎屑落地彈跳、焦痕、地面環、頓幀、傷害數字 |

### 3-2 逐類解剖（565 具名招，依展演風格分類）

欄位說明：
- 「有專屬原作 bank」＝至少指名一組非泛用 bank；「只有泛用」＝只用通用字卡或近戰命中印記；「無」＝沒有任何 bank。
- 「Owner 重製」＝至少一段動畫被 210 格重製包覆蓋。
- 「AI 對戰」欄指授權網址上；非授權網址一律只剩 ✨＋📐。

| 類別 | 招數（必殺） | 有專屬原作 bank／只有泛用／無 | Owner 重製 | AI 自動對戰 | 圖鑑展演 | Data Arena |
|---|---|---|---|---|---|---|
| **近戰：拳擊 strike** | 163（34） | 5／50／108 | 53 | 108 招無 2D 圖格：`[✨]` 命中火花＋`[📐]`；其餘 `[🖼️]` H_Knuckle 印記 | `[📐]` CSS 衝擊環＋放射線＋塵土 | `[📐]` relaySlash＋星爆 |
| **近戰：穿刺 pierce** | 52（11） | 5／22／25 | 22 | `[🖼️]` H_piercing（重製）或 `[✨]` | `[📐]` | `[📐]` relayLance |
| **近戰：爪擊 claw** | 50（9） | 0／48／2 | 48 | `[🖼️]` H_claw（重製「三痕裂爪」） | `[📐]` CSS 三道斜線 | `[📐]` relaySlash |
| **近戰：斬擊 slash** | 45（14） | 4／40／1 | 43 | `[🖼️]` H_Slashtop（重製「鋼月斬」）；另有 sword、oukuwamon、brakedramon、crescemon 專屬 | `[📐]` | `[📐]` relaySlash |
| 咬碎、衝撞 | 沒有獨立風格，歸在 strike／claw | — | 重製包有「碎牙咬合」1 格 | 同上 | 同上 | 同上 |
| **熱／火：火球 fireball** | 35（13） | 34／1／0 | 31 | `[🖼️]` fireball00（重製「彗燼火球」）、magmaball 系列、foxfire、kyubimonfire、leomonhed | `[📐]` CSS 圓形漸層火球，⚠️ 可帶本體圖格 | `[📐]` relayFlame |
| **熱／火：火焰 flame**（含烈鎧焰砲） | 28（16） | 28／0／0 | 26 | `[🖼️]` koenryu、firewing、firehurricane、beam01＋explo | `[📐]` **CSS 三角扇形**＋火苗；圖格只在命中時 | `[📐]` relayFlame |
| **冷／冰 ice** | 7（4） | 7／0／0 | 6 | `[🖼️]` icearrow、koorituno、icerock、yukigumo、snowstorm（重製「霜晶碎」等 bank 1 格） | `[📐]` CSS 冰錐，⚠️ 可帶圖格 | `[📐]` relayCrystal |
| **光／日 holy** | 27（11） | 25／2／0 | 16 | `[🖼️]` lightball 系列（重製「以太光球」）、holyarrow、heavensgate、各角色箭 | `[📐]` CSS 光柱＋光箭 | `[📐]` relayLance＋連線 |
| **暗／月 dark** | 13（11） | 13／0／0 | 5 | `[🖼️]` blacksmoke（重製「煤煙綻」）、darknesswave、genocideattack、bakemoncurse | `[📐]` CSS 暗球，⚠️ 可帶圖格 | `[📐]` relayOrb |
| 月牙（歸在 holy） | — | — | crescentmoon 已重製（「金月雙刃」） | `[🖼️]` | `[📐]` | `[📐]` |
| **雷 thunder** | 10（6） | 10／0／0 | 10 | `[🖼️]` thunderball（重製「雷暴球」）、raiun、thunderjavelin、myorunirusanda | `[📐]` CSS 雷雲＋閃電條 | `[📐]` relayBolt＋連線 |
| **水 water**（含焰角泡泡） | 16（11） | 16／0／0 | 10 | `[🖼️]` bubble、waterball、walaser、tsunami（重製「怒濤巨浪」） | `[📐]` CSS 水滴＋水柱 | `[📐]` relayDrop／wave |
| **木：藤 vine** | 21（5） | 2／6／13 | 8 | 13 招無 bank：`[✨]`＋`[📐]`；rose00 有 `[🖼️]` | `[📐]` CSS 藤鞭 | `[📐]` relayThorn |
| **木：刺／葉／種／孢** | thorn 9、leaf 5、seed 7、spore 10 | 大多有專屬 bank | 3–4 | `[🖼️]` toge、seed、banana、kinoko、unchi | `[📐]`；seed／leaf／spore 可帶圖格 | `[📐]` relayThorn／Leaf／Seed／Spore |
| **土 quake** | 7（5） | 7／0／0 | 3 | `[🖼️]` rock、bone、jiware、groundzero | `[📐]` CSS 地裂 | `[📐]` relayRock |
| **風 wind** | 9（3） | 7／2／0 | 4 | `[🖼️]` tatumaki、airneedle、jetarrow、kumo | `[📐]` CSS 風刃 | `[📐]` relayWind |
| **金：飛彈／機槍／砲彈** | missile 19、gatling 4、shell 6 | 全部有專屬 bank | 14／2／6 | `[🖼️]` missile 系列（重製「雙發飛彈」「黃銅砲彈」「連射彈幕」） | `[📐]` CSS 拋物線飛彈＋煙，可帶圖格 | `[📐]` relayMissile／Bullet／Crystal |
| 音波 sound | 11（6） | 11／0／0 | 8 | `[🖼️]` onpu、hart、catseye、crashsymphony | `[📐]` | `[📐]` relayRing |
| 能量光束 beam | 11（8） | 11／0／0 | 11 | `[🖼️]` beam00（重製「稜光射線」）、beam04、risingdestroyer（重製「電漿射束」） | `[📐]` CSS 光束 | `[📐]` relayLance＋連線 |

### 3-3 原作 5 元素與新增 5 屬性

**原作 5 元素（熱、冷、光、暗、雷）**：AI 對戰的顏色來自招式的 `elementSelect`（火、水、光、暗、雷 5 種加「無」）。圖格本身就是原作那組 bank 的樣子，顏色規則只影響程式加料層。

**新增 5 屬性（金、木、水、土、風）**：

| 屬性 | 拍檔數 | 有沒有專屬特效圖 | 實際借用什麼 |
|---|---|---|---|
| 金 METAL | 32 | ❌ 沒有 | 只有 bank 名稱對上 missile／kikanzyu／sword… 時，加料層才用金屬灰橘色；圖格是原作兵器 bank |
| 木 WOOD | 18 | ❌ 沒有 | bank 名稱對上 seed／rose／kinoko／banana 才用 nature 綠；只有 2 招的加料層會變綠 |
| 水 WATER | 21 | ⚠️ 沿用原作水系 bank | 原作 `elementSelect=2` 本來就是水 |
| 土 EARTH | 24 | ❌ 沒有 | rock／bone／groundzero／jiware／haguro；加料層只有 9 招會用 earth 色 |
| 風 WIND | 19 | ❌ 沒有 | tatumaki／airneedle／jetarrow／kumo；加料層只有 3 招會用 wind 色 |

**關鍵事實：特效程式完全不讀拍檔的十屬性分類**（`species-taxonomy.v1.json`）。`battleFx`、`juicy`、`dataArena` 的呈現檔都沒有 import 它。

目前遊戲裡同時存在 **4 套互不相通的「屬性」**：
1. 招式原作元素欄（6 種）——驅動 AI 對戰加料層顏色。
2. 圖鑑風格表的 13 種調色盤。
3. 拍檔十屬性（金木水火土＋日月冰風雷）——只用在相剋和介面。
4. Data Arena RELAY 的 9 種元素。

所以一隻「木」屬性拍檔放出的招式，會照它原作 bank 長成光束或火球。

### 3-4 專屬必殺技是獨立特效，還是共用？

204 個必殺技（呈現層定義：每物種最強的 kind-1 招）：

| 情況 | 招數 | 說明 |
|---|---|---|
| 用該物種**獨占**的原作 bank | 54 | 全遊戲有 100 組 bank 只被一個物種用到，例如 apollomonarrow、dianamonarrow、brakedramon、oukuwamon、gigaburasuta、heavensgate、myorunirusanda |
| 用**多物種共用**的專屬 bank | 82 | 依使用物種數：`explo` 42 個物種（47 筆紀錄）、`beam00` 19（38 筆）、`fireball00` 12（35 筆）、`unchi00` 6（12 筆）、`bubble00` 4（12 筆） |
| 只用泛用 bank | 64 | 看起來就是一般命中加字卡 |
| 沒有任何 bank | 4 | 只剩 Three.js 命中和程式加料 |

**沒有任何一個必殺技有「重製時新做的專屬演出」。** Owner 重製包的 39 項是「共用特效」，不是必殺技專屬。專案沒有逐招的必殺技演出表；必殺和一般技的差別只在呈現層多加的字幕條、場地變暗和蓄力環。

- `烈鎧焰砲`：`beam01`（4 筆招式紀錄使用）＋`explo`（共用，已重製）。
- `焰角泡泡`：`bubble00`（共用，未重製）。
- `腐沼毒核`：`unchi00`（共用，未重製）。

---

## 第四部分：對照原作拆包資料的差距分析

### 4-1 《數碼寶貝冠軍賽》原作（本專案的特效來源）

- 原作特效檔名是 `e003_*`（例如 `e003_fireball00`、`e003_H_claw`），不是 `ef_*`／`bt_*`。每組 bank 是 Nitro 2D 四件組：NCGR 圖塊、NCLR 調色盤、NCER 格子、NANR 動畫。專案已全部轉成 `battle-effects-v1` 圖集＋`battleEffectProfiles.json` 時間軸（`NUMERIC_BEHAVIOR_CONTRACT_NO_IMAGE_DATA`）。
- **原作動畫有多短：**

| 量測 | 數值 |
|---|---|
| 動畫段數 | 484 段（151 組 bank） |
| 每段幀數 | 最少 1、中位數 **2**、p90 4、最多 12 |
| 每段總長 | 中位數 12 tick（約 0.2 秒），p90 32 tick，最長 82 tick |
| 每格停留 | 最常見 4、9、6、3 tick（60 fps 下約 7–20 fps） |
| 播放模式 | 單次 356 段、循環 128 段 |
| 單格尺寸 | 多為 16×16、24×24、32×32；最大 104×48（bank 1）、72×64（explo） |

  幾個例子：`bubble00` 3 段（3 格／2 格循環／3 格）；`beam01` 4 段，每段都只有 1 格（光束靠腳本把同一段光束重複接長）；`explo` 2 段 × 6 格；`H_claw` 1 段 4 格。
- **組合方式：** 一招在招式紀錄的 +0x24／+0x30／+0x36／+0x38／+0x44 五個欄位，分別指名 prepare／launch／body／hit／extra 用哪一組 bank 的哪一段。原作特效腳本再生出特效角色，每 tick 改位置、高度、縮放、旋轉、透明度和色調。**動感主要來自腳本，不是來自長動畫。** 命中另外有 5 種 3D 模型特效（hitspark 等）。

### 4-2 《數碼寶貝 月光》拆包（研究用）

| 資源 | 數量 | 是什麼 |
|---|---|---|
| `dat/bgeff` 招式背景特效 | 217 組時間軸（4,262 檔：約 1,300 組圖塊＋2,500 畫面） | **整個 BG 圖層的逐格動畫**，例如爆光、光束、圓環、風暴、斬擊。時長中位數 0.53 秒（p10 0.38、p90 0.95、最長 1.88）；中位數 12 格，每格 2–4 tick（約 15–20 fps）；41 組用硬體混色權重 EVA／EVB 淡出，例如 (16,2)→(15,3)→(14,4)… |
| `SPR_*.PAK` 0–399 | 400 組、2,124 格（152 組多格，最多 136 格） | 戰鬥選單、狀態字卡（MISS／CRITICAL／UP／DOWN），以及約 200 組招式精靈特效：爆炸、冰、雷、光球、音符 |
| `dat/wz` 招式腳本 | 11 檔 × 100 項 | 決定一招用哪個 bgeff、哪些精靈特效、時機。**尚未解碼** |

月光同樣沒有 `ef_*`／`bt_*` 命名。它的大招靠的是「**全畫面背景圖層動畫＋硬體半透明淡出**」，這是冠軍賽和我們目前都沒有的層次。

### 4-3 離「全招式高品質序列幀」還差什麼

| # | 缺口 | 規模 |
|---|---|---|
| 1 | **能上架的圖不夠** | 原作 151 組／484 段／1,231 格都是 ROM 參考，只能在本機和授權試玩網址用。Owner 重製只覆蓋 26 組 bank、72 段（約 15 %）、210 格。還有 **125 組 bank、412 段**沒有原創圖。 |
| 2 | 必殺技沒有專屬演出 | 204 個必殺技裡 64 個只有泛用 bank、4 個沒有 bank、82 個共用 bank。如果要每隻角色有獨特必殺，等於要新做最多 204 組。 |
| 3 | 新 5 屬性沒有圖，也沒有串接 | 呈現層不讀十屬性。要先決定屬性怎麼影響特效（換色？換 bank？換風格？），再補圖。 |
| 4 | Data Arena 沒有圖片特效管線 | 目前只有 Canvas 程式紋理，沒有載入序列幀圖集、播格子的程式。要接，得新增一條「風格或 bank → 圖集格子 → Pixi 動畫」的路線，而且必須沿用唯一的 Pixi ticker。 |
| 5 | 圖鑑串接邏輯 | ① 播放前要等 `bankCells.ready`；② 不帶圖格的 14 種風格（flame／water／beam…）飛行時不顯示本體圖格；③ 風格表和招式本身 bank 可能衝突（焰角泡泡＝water）；④ 圖格放大倍率偏小。 |
| 6 | 原作「腳本驅動」怎麼處理 | 原作每段只有 2 格，靠腳本動。高解析重製有兩條路：(a) 保留原作腳本，只把每格畫細（目前 210 格就是這條，時間軸不變）；(b) 改成長序列幀（每招 12–24 格），但就要另寫時間軸，會偏離原作時機。這需要 Owner 決定。 |
| 7 | 沒有全畫面招式背景層 | 月光有 217 組 bgeff。我們只有 Three.js 小型命中模型和程式畫的場地變暗，沒有「整個畫面爆光、背景換掉」的層。 |
| 8 | 閒置資產 | 19 個授權 3D 特效沒接上，包括能力升降 6 種和天氣 6 種；`battleWeatherVfxPresentation.js` 和 `faithfulVfxRuntimeBundle.js` 都沒有 import。 |

---

## 第五部分：總結統計數字

| 項目 | 數字 |
|---|---|
| 專案內現有招式總數 | **596 筆招式紀錄**：565 個具名招式＋31 筆通用／系統紀錄。另有 Data Arena 自己的元素招式池 50 招。 |
| 呈現層分級 | 普攻 205／一般技 157／必殺技 204／輔助 30 |
| 現有「圖片序列幀 VFX」總組數（以 bank／特效組計） | **151 組原作 bank＋39 組 Owner 重製特效**（另有狩獵 19 組、牧場回饋 1 組） |
| └ 已接上 | 原作 148 組（144 組由招式指名＋4 組系統用，系統用 4 組推定由戰鬥流程呼叫、未逐一追蹤）；Owner 重製 39 組全部接上；字卡 3 套 |
| └ 閒置未用 | 原作 3 組沒有招式指名（seed00、snowcrystal00、blacksmoke04）；AI 生成圖 1 包退件；本機舊版重製 3 包 |
| 3D 模型特效（GLB，非序列幀） | 26 個系統：接上 7 個、閒置 19 個；另有一份 26 系統複本（閒置）和 5 系統早期轉檔（閒置） |
| 能正式上架的招式序列幀 | **只有 Owner 重製的 210 格**（約占原作 15 % 的動畫段） |
| 完全依賴程式碼繪圖、沒有圖片動畫的場景 | Data Arena 三模式全部招式；圖鑑展演底層（非授權網址或圖集未載完時則是全部）；必殺字幕條；進化演出（角色圖與 4 張字形除外）；勝利 Highlight；介面按鈕手感；轉蛋（只有靜態零件）；牧場心情圖示；捕獲光點 |
| AI 對戰中沒有 2D 招式圖格的招式 | 156 筆（143 筆普攻、13 筆非普攻），只靠 Three.js 命中和程式加料。在非授權網址，**596 筆全部**都沒有 2D 圖格。 |

---

## 第六部分：對照組 Pokémon Arena 2D 的招式特效

研究用途，專有授權，程式和圖都不能拿來用。這次只解出 APK 內的 `game.zip` 清單和 4 支客戶端特效腳本，沒有執行任何包內程式。

| 項目 | Pokémon Arena 2D | 我們 |
|---|---|---|
| 特效圖檔 | **0 張**。9,047 張 PNG 全是角色動作圖、6 張場地、2 張劇情圖 | 原作 1,231 格＋重製 210 格（只有 AI 對戰用） |
| 招式特效畫法 | `move-effects.mjs`（14 KB，壓縮過）：Canvas 2D 路徑、漸層、`lighter` 疊加，**drawImage 0 次** | AI 對戰用序列幀；其他場景用 Canvas／CSS |
| 招式種類 | 42 個招式家族、約 25 種投射物畫法；每招以 id 雜湊出 5 種變體和 0.9–1.11 倍縮放，所以同家族也不完全一樣 | AI 對戰沿用原作 bank；圖鑑 23 種風格；Data Arena 16 張紋理 |
| 三段式 | 蓄力：手前屬性光球＋4 顆繞行亮點；發射：槍口環＋7 顆粒子；命中：岩系碎塊、水／毒系水滴、其他 6–8 角星爆 | 見第三部分 |
| 附加層 | 9 種光束招的波動連線、地面印痕（焦痕、水漬、霜裂，存活 4 秒）、擊退刮痕、掩體碎片、狀態覆蓋（冰殼、火苗、電花、泡泡、zzz）、文字標籤 | AI 對戰有焦痕、碎屑、頓幀、數字；Data Arena 有部分；沒有狀態覆蓋 |
| 手感 | 頓幀 55 ms、震動分級、鏡頭 1.58 倍並偏向對手 | AI 對戰頓幀 60 ms；Data Arena 沒有頓幀 |
| **角色動作圖** | 983 隻、每隻 7–14 種：待機、行走、攻擊、**蓄力 Charge 1,191 隻**、**發射 Shoot 1,024 隻**、受擊、睡眠、倒下，部分還有特攻、仰身、電擊、放射 | 角色有待機、行走、攻擊、歡呼等；沒有獨立的蓄力和發射動作 |
| 招式音效 | 182 種（264 檔） | 合成音效為主 |
| 進化特效 | `evolution-effects.mjs`（976 bytes）程式繪圖 | DOM＋Web Animations |

**對照結論：** 你喜歡的那種「招式很有份量」，在 Pokémon Arena 2D 裡不是靠序列幀圖片。它靠的是：
1. 招式家族多、每招有變體；
2. 角色有蓄力和發射動作，能配合出招時機；
3. 命中後留在地上的痕跡和狀態覆蓋；
4. 每招都有音效；
5. 頓幀和震動分級。

我們的 AI 對戰在「圖」這一層其實比它多（有原作序列幀），弱點在 Data Arena 和圖鑑沒接上同一套，以及角色缺少蓄力和發射動作。

---

## 可以拿去討論的切入點（不是本輪要做的事）

1. 圖鑑先改「等圖集載完再播」，並讓 flame、water、beam 也帶本體圖格。這能最快讓圖鑑和 AI 對戰長得一樣。
2. Data Arena 要不要接序列幀：需要新的圖集播放路線，以及 Owner 決定要用原作 bank 還是重製圖（受網址授權限制）。
3. 重製包從 72 段往上擴，依使用物種數排序：`explo`（42 物種）、`beam00`（19）、`fireball00`（12）已重製；還沒重製的高使用 bank 是 `unchi00`（6 物種／12 筆）、`bubble00`（4／12）、`walaser00`（4／12）、`onpu00`（4／8）、`lightball02`（4／12）、`beam07`（5／10）。
4. 新 5 屬性要先定規則，例如「屬性決定加料層顏色和命中粒子，bank 仍照原作」，再決定要不要補圖。
5. 是否新增「全畫面招式背景層」，參考月光 bgeff 約 0.5 秒、12 格、半透明淡出的節奏。

---

## 證據來源

| 用途 | 路徑 |
|---|---|
| AI 對戰載入 | `src/championship/app/main.js`（`loadOptionalOriginalVfxReview`、`loadOptionalBattleVfxOverlay`、`BATTLE_DYNAMIC_FX`） |
| 原作圖格 | `src/championship/presentation/battleEffectArt.js`、`battleEffectSprites.js`、`originalSharedVfxReview.js` |
| 加料層 | `src/championship/presentation/battleFx/battleFxLayer.js`、`battleFxRecipes.js`、`battleFxPalettes.js` |
| Three.js | `src/championship/presentation/vs5/createBattleVfxThreeOverlay.js`、`src/championship/battle/battleImpactEffects.js` |
| Data Arena | `src/championship/presentation/dataArena/dataArenaPixiScene.js`、`dataArenaTextures.js`、`dataArenaRelayEffects.js`、`src/championship/modes/dataArena/dataArenaRelay.js`、`dataArenaRelayKits.js` |
| 圖鑑 | `src/championship/presentation/juicy/codexShowcaseTheater.js`、`showcaseMoveVfx.js`、`showcaseBankCells.js`、`src/championship/app/ui/juicyShowcase.css` |
| 風格表 | `src/data/championship/move-vfx-themes.r1.json`、`scripts/build-move-vfx-themes.mjs` |
| 招式資料 | `src/data/championship/catalogs/battle-moves.r1.json`、`battleEffectProfiles.json`、`src/championship/text/battleMoveNames.js` |
| 屬性 | `src/data/championship/species-taxonomy.v1.json`、`src/championship/contracts/speciesTaxonomy.js` |
| 授權網址 | `src/data/championship/public-playtest-runtime.v1.json` |
| 月光 | `R:\NEXUS LINK\原作\research-only\MOONLIGHT_ROM_DECONSTRUCTION_2026-10-29\REPORT_ZH_TW.md`、`design-brief/04_effects.md`、`analysis/spr_summary.json`、`analysis/bgeff_summary.json` |
| Pokémon Arena 2D | `R:\Projects\Championship2026\pokemon-arena-2d-deconstruction-20261028\REPORT_ZH_TW.md`；本次解出的清單與 `client/move-effects.mjs`、`combat.mjs`、`evolution-effects.mjs` 只放在 session 暫存區 |


---

## 附錄 A：原作 151 組特效 bank 分類清單（`battle-effects-v1`）

格式：`編號 名稱` 格數/段數·最大單格尺寸（原生 px）·被幾筆招式紀錄指名。★＝至少一段已由 Owner 重製包替換。「0招」＝沒有招式紀錄指名（系統用或閒置）。

| 類別 | 組數 | bank 清單 |
|---|---|---|
| 系統／共用字卡與泛用命中 | 6 | `1 battle`★ 143格/47段·104×48·267招；`2 battle_popup` 8格/1段·32×32·0招；`3 mind_eff`★ 6格/1段·32×24·0招；`4 suport_eff`★ 5格/1段·32×32·0招；`5 specialtime` 3格/3段·64×8·0招；`64 etc_hiteffect`★ 6格/1段·24×24·11招 |
| 近戰命中（爪／斬／拳／刺） | 6 | `79 H_claw`★ 4格/1段·32×32·40招；`80 H_Slashtop`★ 4格/1段·32×48·48招；`81 H_Knuckle`★ 4格/1段·32×48·102招；`82 H_piercing`★ 4格/1段·48×32·30招；`93 flamefist00` 3格/2段·32×24·2招；`38 rocketpunch00` 7格/3段·32×32·6招 |
| 火／熱（火球、火焰、熔岩、爆炸） | 24 | `7 fireball00`★ 7格/3段·16×16·35招；`36 fireball_w00` 7格/3段·16×16·3招；`34 toyfire00` 6格/3段·16×16·3招；`41 koenryu00` 12格/3段·32×24·3招；`145 koenryu01` 12格/3段·32×24·3招；`46 firewing00` 5格/3段·24×16·2招；`113 firewing01` 5格/3段·24×16·2招；`114 firewing02` 5格/3段·24×16·2招；`50 magmaball00` 9格/3段·32×16·3招；`51 magmaball01`★ 9格/3段·32×16·16招；`94 magmaball02` 9格/3段·32×16·3招；`107 magmaball03` 9格/3段·32×16·9招；`108 magmaball04` 9格/3段·32×16·3招；`116 magmaball06` 9格/3段·48×32·5招；`54 firehurricane00` 11格/3段·32×32·3招；`109 foxfire00` 9格/3段·48×32·9招；`122 kyubimonfire` 8格/3段·24×32·6招；`132 leomonhed00`★ 3格/2段·40×24·8招；`123 sun00` 6格/1段·32×32·1招；`149 explo`★ 12格/2段·72×64·47招；`57 cherrybomb00` 8格/3段·16×16·3招；`61 bigsmileybomber00` 7格/3段·32×32·3招；`62 bitbomb00` 8格/3段·32×32·3招；`72 smileybomb00` 5格/3段·32×32·3招 |
| 水（泡泡、水球、水雷射、海浪） | 10 | `6 bubble00` 8格/3段·16×16·12招；`35 bubble01` 8格/3段·16×16·6招；`31 waterball00` 13格/3段·16×16·3招；`112 waterball01` 13格/3段·24×24·6招；`32 walaser00` 8格/3段·16×16·12招；`106 walaser01` 8格/3段·16×16·3招；`14 fish00` 9格/3段·40×32·3招；`42 sumiburesu00` 13格/3段·16×16·3招；`98 casuburesu00` 10格/3段·16×16·3招；`91 tsunami`★ 9格/2段·64×32·6招 |
| 冰／冷（雪晶、冰箭、冰角、雪雲） | 6 | `26 snowcrystal00` 6格/3段·16×16·0招；`48 icearrow00` 7格/3段·16×16·3招；`49 koorituno00` 5格/3段·16×16·2招；`88 icerock00` 3格/3段·16×16·2招；`136 yukigumo00` 13格/3段·32×32·3招；`137 snowstorm` 5格/3段·48×48·3招 |
| 雷（雷球、雷雲、雷槍、雷神錘） | 6 | `28 thunderball00`★ 11格/3段·16×16·15招；`23 raiun00` 10格/3段·32×24·3招；`73 thunderjavelin00` 11格/3段·48×32·3招；`103 myorunirusanda00` 11格/3段·48×32·3招；`128 hammerspark` 4格/3段·24×16·3招；`68 colorfulspark00` 11格/3段·24×24·3招 |
| 光／日／月（光球、聖箭、星、月牙、天門） | 19 | `9 lightball00`★ 7格/3段·24×24·9招；`74 lightball01` 10格/3段·24×24·6招；`78 lightball02` 9格/3段·40×40·12招；`47 holyarrow` 4格/3段·32×32·3招；`52 star00` 5格/3段·16×16·3招；`144 star01` 6格/3段·24×32·2招；`142 starlight00` 8格/2段·48×48·2招；`70 heavensgate00` 15格/6段·16×48·3招；`102 heaven00` 4格/4段·16×32·4招；`124 moon00` 6格/1段·32×32·1招；`44 crescentmoon00`★ 11格/3段·32×32·9招；`56 crescent00` 11格/3段·32×32·3招；`77 infinitiarrow00` 5格/3段·32×16·3招；`84 apollomonarrow00` 4格/3段·40×16·3招；`85 crescemonarrow00` 4格/3段·40×16·3招；`119 crescemonarrow01` 4格/3段·40×16·3招；`87 dianamonarrow00` 4格/3段·48×16·3招；`89 lekismonarrow00` 4格/3段·24×16·5招；`139 crescemon`★ 3格/2段·48×48·2招 |
| 暗（黑煙、死亡符、暗波、詛咒） | 14 | `16 blacksmoke00`★ 10格/3段·16×16·3招；`65 blacksmoke01` 10格/3段·16×16·3招；`66 blacksmoke02` 10格/3段·16×16·3招；`111 blacksmoke03` 10格/3段·16×16·6招；`121 blacksmoke04` 10格/3段·16×16·0招；`129 blacksmoke05` 10格/3段·16×16·3招；`45 deathcharm00` 11格/3段·16×16·3招；`67 darknesswave00` 9格/3段·32×32·3招；`71 genocideattack00` 10格/3段·32×32·3招；`95 purple00` 6格/3段·32×32·2招；`100 dark01` 5格/3段·16×16·8招；`101 hartbreak00` 8格/3段·16×16·3招；`120 bakemoncurse00` 7格/3段·32×32·5招；`125 abduction00` 11格/3段·48×32·3招 |
| 能量光束（光束段、砲擊） | 14 | `12 beam00`★ 4格/4段·16×32·38招；`13 beam01` 4格/4段·16×32·4招；`126 beam02` 4格/4段·16×32·2招；`127 beam03` 4格/4段·16×32·6招；`138 beam04`★ 4格/4段·16×32·2招；`146 beam05` 4格/4段·16×32·2招；`147 beam06` 4格/4段·16×16·2招；`150 beam07` 12格/7段·24×40·10招；`151 beam08` 12格/7段·24×40·4招；`69 fraucanon00` 12格/3段·32×32·3招；`104 risingdestroyer00`★ 4格/4段·16×32·2招；`105 soloblue00` 8格/3段·16×16·3招；`115 gigaburasuta` 7格/3段·48×48·3招；`75 gigadestroyer00` 9格/3段·32×32·6招 |
| 機械／兵器（飛彈、機槍、齒輪、刀槍） | 20 | `21 missile00` 10格/3段·24×16·7招；`39 missile01`★ 7格/3段·32×16·12招；`133 missile02` 10格/3段·32×24·6招；`134 missile03`★ 10格/3段·32×24·3招；`141 missile04` 10格/3段·40×32·3招；`135 giantmissile00` 11格/3段·40×24·3招；`19 kikanzyu00`★ 4格/3段·16×16·3招；`15 cogwheel00` 5格/3段·16×16·2招；`76 haguro00` 5格/3段·16×16·3招；`27 syuriken00` 5格/3段·16×16·2招；`18 hasyuriken00` 3格/3段·16×16·2招；`22 pointer00` 4格/3段·16×16·3招；`118 clockmonclock` 4格/3段·32×32·1招；`92 oukuwamon`★ 4格/2段·64×40·2招；`148 brakedramon`★ 8格/3段·64×56·2招；`96 sword00` 6格/3段·32×32·3招；`59 trident00` 4格/3段·32×32·3招；`60 spear00` 4格/3段·32×32·3招；`30 tyusyaki00` 13格/3段·16×16·3招；`29 tuno00` 5格/3段·16×16·3招 |
| 土／岩／骨（岩石、骨、地裂、尖刺） | 6 | `24 rock00` 3格/3段·16×16·2招；`43 bone00` 3格/3段·16×16·2招；`140 spiralbone00` 3格/2段·40×40·2招；`58 groundzero00` 10格/3段·32×32·3招；`143 jiware` 7格/2段·64×32·2招；`53 toge00` 5格/3段·16×16·9招 |
| 風／雲（龍捲、氣針、噴射箭、雲） | 6 | `33 tatumaki00` 11格/3段·16×16·6招；`97 tatumaki01` 10格/3段·24×24·3招；`17 airneedle00` 9格/3段·16×16·3招；`63 jetarrow00` 13格/3段·32×32·3招；`130 kumo00` 10格/3段·48×48·3招；`131 kumo01` 10格/3段·48×48·3招 |
| 植物／孢子（種子、香蕉、蘑菇、薔薇） | 4 | `25 seed00` 4格/2段·16×16·0招；`11 banana00` 5格/2段·16×16·2招；`20 kinoko00` 8格/3段·16×16·3招；`83 rose00` 6格/3段·32×32·3招 |
| 毒／穢物 | 2 | `8 unchi00` 4格/2段·16×16·12招；`55 dirtysaucer00` 4格/3段·32×32·3招 |
| 音波／心／念（音符、愛心、貓眼、交響） | 8 | `10 onpu00` 5格/2段·16×16·8招；`37 hart00` 8格/3段·16×16·6招；`40 catseye00` 5格/3段·32×32·3招；`99 crashsymphony00` 8格/3段·16×16·3招；`110 kiwimonsmall00` 4格/3段·16×16·3招；`117 ropear01` 11格/3段·16×16·3招；`86 delumonegg00` 3格/3段·16×16·3招；`90 pinochimonarrow00` 4格/3段·32×32·3招 |

## 附錄 B：Owner 原創重製包 39 項（`original-shared-review-210-seamfix-r1`，210 格）

| bank | 特效 ID | 名稱 | 替換段 | 格數 |
|---|---|---|---|---|
| `81 H_Knuckle` | hit_knuckle_prism | 稜光衝擊（一般打擊命中） | 0 | 4 |
| `79 H_claw` | hit_claw_rend | 三痕裂爪（爪擊命中） | 0 | 4 |
| `80 H_Slashtop` | hit_slash_steel | 鋼月斬（斬擊命中） | 0 | 4 |
| `82 H_piercing` | hit_pierce_lance | 貫槍突刺（穿刺命中） | 0 | 4 |
| `1 battle` | fire_ember_bloom | 燼花燃燒（燃燒附加） | 30 | 6 |
| `1 battle` | fire_flame_swipe | 焰爪掠擊（火焰命中） | 36 | 1 |
| `149 explo` | fire_billow_blast | 翻騰爆炎（爆炸） | 0,1 | 12 |
| `7 fireball00` | proj_fire_comet | 彗燼火球（投射物） | 0,1,2 | 7 |
| `16 blacksmoke00` | smoke_soot_bloom | 煤煙綻（黑煙） | 0,1,2 | 10 |
| `64 etc_hiteffect` | smoke_dust_kick | 踏塵（落地沙塵命中） | 0 | 6 |
| `1 battle` | flash_prism_twinkle | 稜星閃（星芒閃光） | 33 | 6 |
| `1 battle` | flash_wisp_glimmer | 微光閃爍（光點） | 40 | 8 |
| `1 battle` | energy_arc_spark | 弧電迸裂（電擊） | 32 | 4 |
| `9 lightball00` | proj_aether_orb | 以太光球（能量投射物） | 0,1,2 | 7 |
| `1 battle` | energy_frost_rend | 霜裂斬（冰屬命中） | 37 | 1 |
| `1 battle` | proj_tracer_streak | 曳光彈（一般投射物） | 41 | 1 |
| `12 beam00` | beam_prism_lance | 稜光射線（能量光束） | 0,1,2,3 | 4 |
| `138 beam04` | beam_flare_lance | 熾焰射線（火焰光束） | 0,1,2,3 | 4 |
| `51 magmaball01` | proj_molten_comet | 熔岩彗核（熔岩投射物） | 0,1,2 | 9 |
| `28 thunderball00` | proj_storm_orb | 雷暴球（雷電投射物） | 0,1,2 | 11 |
| `1 battle` | ice_rime_shard | 霜晶碎（冰晶） | 31 | 5 |
| `1 battle` | hit_fang_crush | 碎牙咬合（咬擊命中） | 42 | 1 |
| `1 battle` | hit_thorn_lash | 棘藤鞭（藤蔓命中） | 44 | 1 |
| `139 crescemon` | char_crescemon_moonblade | 月鎌獸形象特效（重用原創 Main 圖格） | 0,1 | 3 |
| `92 oukuwamon` | char_oukuwamon_scissor | 巨鍬形蟲獸形象特效（重用原創 Main 圖格） | 0,1 | 4 |
| `148 brakedramon` | char_brakedramon_body | 剎車龍獸形象特效（重用原創候選 Main 圖格＋原創揮擊弧） | 0,1,2 | 8 |
| `1 battle` | impact_gold_large_r1 | 金稜命中閃（大型角色追加衝擊） | 35 | 1 |
| `1 battle` | impact_gold_small_r1 | 金芒命中閃（一般角色追加衝擊） | 43 | 1 |
| `1 battle` | impact_gold_result_r1 | 散環命中餘光（結果附加） | 45 | 5 |
| `4 suport_eff` | support_aura_ring | 援護光環（支援技能前導） | 0 | 5 |
| `132 leomonhed00` | lion_head_fireball | 炎獅頭彈（共用投射＋命中） | 0,1 | 3 |
| `39 missile01` | missile_twin_volley | 雙發飛彈（發射→飛行→爆炸） | 0,1,2 | 7 |
| `1 battle` | miasma_burst | 緋紅瘴爆（瘴氣命中） | 34 | 10 |
| `3 mind_eff` | mind_mist_prelude | 心念霧光（支援技能前導・無文字） | 0 | 6 |
| `91 tsunami` | tidal_wave | 怒濤巨浪（水波） | 0 | 8 |
| `104 risingdestroyer00` | plasma_beam_pieces | 電漿射束（光束本體／前端／槍口焰／命中） | 0,1,2,3 | 4 |
| `44 crescentmoon00` | golden_twin_crescents | 金月雙刃（發射／飛行／命中） | 0,1,2 | 11 |
| `134 missile03` | brass_cannon_shell | 黃銅砲彈（發射／飛行／爆炸） | 0,1,2 | 10 |
| `19 kikanzyu00` | rapid_fire_volley | 連射彈幕（槍口焰／彈幕／命中） | 0,1,2 | 4 |
