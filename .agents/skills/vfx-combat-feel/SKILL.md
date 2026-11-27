---
name: vfx-combat-feel
description: Combat skill animation and VFX craft standard for Cyber Partner: Tournament. Enforces the 5-beat combat rhythm (anticipation, non-linear release/trail, impact point with 40-70ms hit-stop/flash/micro-shake, dual-layer impact particles, afterimage dissipation), bans pure linear constant-velocity motion, and sets per-move particle caps and mobile 60fps memory-safe budgets. Use whenever creating, tuning, or reviewing battle skill VFX, projectiles, melee swings, hit reactions, or sandbox previews.
---

# VFX Combat Feel — 技能打擊感與演出憲法

本 Skill 規範 **Cyber Partner: Tournament / 網線拍檔：錦標賽** 所有戰鬥技能動畫與 PixiJS VFX 演出品質，避免產出僵硬、線性、廉價或會造成行動端掉幀／洩漏的特效。

## 專案 VFX 掛載點與圖層基準

- **單一渲染器與時鐘**：所有 2D VFX 必須掛載在單一 `createChampionshipPixiStage`（`src/championship/presentation/championshipPixiStage.js`）的 `app.ticker`，透過傳入的 `dtMs`（clamp 至 `<= 100ms`）步進；**嚴禁**在 VFX 腳本中新建 `PIXI.Application`、`requestAnimationFrame` 或使用 `setTimeout` / `setInterval` 編排招式時間軸。
- **既有核心模組與單一職責對齊（嚴禁重複造輪子／雙重頓幀）**：
  - 招式視覺指紋總表：`src/data/championship/move-vfx-signatures.r1.json`（由 `scripts/build-move-vfx-signatures.mjs` 生成，經 `src/championship/presentation/vfx/moveVfxSignatures.js` 的 `moveVfxSignature(key)` 讀取 10 欄元組：`[key, tier, archetype, paletteKey, volley|combo, path|swing, scale, trail, burst, sigil]`）。新增或調整招式視覺特徵必須沿用此表，不得私建平行招式對照表。
  - 套件與翻頁貼圖：`src/championship/presentation/vfx/moveVfxKit.js`（自帶 `pending` ticker 排程器 `later(fn, ms)`，零 `setTimeout`）。
  - 招式專屬編排：`src/championship/presentation/vfx/moveVfxChoreography.js`（宣告每招的 `release`、`contact`、`hitStopMs`、`shake`、`knockPx`、`impactFrame`）。
  - 烘焙像素片段：`src/championship/presentation/vfx/moveVfxSetPieces.js`（物件池化、支援 `at: 'contact'` 從命中幀起播以配合頓幀）。
  - **視覺頓幀單一主權**：`src/championship/presentation/battleFx/battleFxLayer.js` 是 `hitStop`、`holdFor(slot)` 與 `hitStopActive()` 的**唯一主權者**（優先吃 `choreo.hitStopMs`，否則退回 `BATTLE_FX_JUICY.hitStopByTier = { light: 0, medium: 45, heavy: 65, ultimate: 95 }`）。頓幀期間 `battleFxLayer` 會主動傳 `0` 給 `kit.update(0)`、`pixelHits.update(0)`、`motes.update(0)`、`setPieces.update(0)`，且場景以 `!fxLayer.hitStopActive()` 凍結角色與 `effectSprites`。**嚴禁**在 `moveVfxKit.js`、`moveVfxSetPieces.js` 或個別招式腳本內另開頓幀計時器，避免疊加雙重頓幀。
  - **鏡頭後處理濾鏡單一主權**：`src/championship/presentation/battleFx/battleHitFeel.js` **不管控頓幀**，僅負責 3 種螢幕級 WebGL 濾鏡：`shock(x, y)`（重擊衝擊波 320ms）、`split({ px })`（暴擊 RGB 色散 140ms）、`rush(x, y)`（必殺發動徑向模糊 220ms），由 `battleFxLayer.js` 在事件點統一呼叫並自動鎖定攝影機本地 `screenArea()`。
  - 雙層像素爆破與屬性碎屑：`src/championship/presentation/vfx/pixelHitBursts.js`、`src/championship/presentation/vfx/pixelMotes.js`。
- **圖層順序（`world` 內由底至頂）**：
  1. `productionArtLayer`（場地背景）
  2. `fxBack`（地面焦痕 `scorchLayer`、地面衝擊環 `groundGfx`、法陣 `move-vfx-decals`、衝刺殘影 `ghostLayer`）
  3. `shadowLayer`（腳底陰影）
  4. `actorLayer`（`sortableChildren = true`，依腳底 Y 排序的角色本體與狀態特效）
  5. `fxFront`（光暈/煙霧/拖尾 `trailGfx`、粒子 `particleLayer`、命中閃光 `flashLayer`、`move-vfx-smoke`、`move-vfx-light`）
  6. `fxScreen`（全畫面微閃白、速度線、招式膠囊與時停邊框；位於 `world` 之外）

---

## 一、五段式打擊節奏（強制必備）

每一招攻擊型技能演出（含近戰、投射物、光束、落下型）都必須完整呈現以下五個段落，禁止「直接瞬移出特效然後消失」：

| 段落 | 建議時長 | 必要視覺構成 |
|---|---|---|
| **1. 前搖蓄力（Anticipation）** | `120–320ms`（必殺可至 `520ms`） | 施法者擠壓蓄勢（`squashX ~1.12, squashY ~0.88`）、聚能核心／收縮環（`charge`）與技能階級以上之地面法陣（`sigil` 在 `fxBack` 層，不遮臉）。 |
| **2. 釋放拖尾（Release & Trail）** | `160–420ms` | 槍口／手部爆發（`launch` / `muzzle`）、有方向性的主體頭與連續拖尾（`trail`、速度線或衝刺殘影 `ghost`），**嚴禁勻速直線漂移**。 |
| **3. 命中爆點（Impact Point）** | 頓幀 `40–70ms`（重擊／必殺 `65–95ms`） | 視覺頓幀（凍結受擊與特效幀，但真實時間持續跑微震屏 `3–10px` 與受擊擊退 `14–30px`）、白熱核心閃白（`impact-frame` + 目標受擊閃白 tint）、重擊/暴擊可疊加螢幕級 `battleHitFeel` 衝擊波或色散。 |
| **4. 雙層衝擊粒子（Dual-Layer Burst）** | `240–520ms` | **主層**：烘焙像素爆破／斬擊主體（白熱核心 → 屬性主色 → 暗邊收口，無卡通黑粗描邊物件）。<br>**次層**：受重力／阻力與地面反彈影響的屬性碎屑、火星、揚塵或地面衝擊環（`pixelMotes` + `debris` + `ring`）。 |
| **5. 殘影消散（Dissipation & Cleanup）** | `220–650ms` | 煙霧上飄、餘燼衰減、殘影與地面焦痕漸隱，結束時**立即歸還物件池或銷毀**，並確保舞台活體計數歸零。 |

---

## 二、運動曲線鐵律（嚴禁純線性勻速位移）

- **禁止**：`x += vx * dt` 的單調等速點對點平移、無加速的直線縮放、或生硬開關式 `alpha = 1 → 0`。
- **必須採用至少一種非線性動態曲線**：
  - **投射物飛行**：起手加速推力（`easeInQuad` / `easeOutCubic` 衝刺）或帶路徑偏移的 `arc`（拋物線）、`wave`（正弦蛇行）、`spiral`（螺旋收束），搭配隨速度向量對齊的 `rotation = Math.atan2(vy, vx)` 與微拉伸 `stretch`。
  - **近戰揮擊與衝刺**：前搖回拉 → 爆發快切（`easeOutExpo` / `easeOutCubic`）→ 頓幀卡點 → 緩慢收招回位。
  - **粒子與碎屑**：具備指數阻力（`Math.exp(-drag * sec)`）、重力加速度（`vy += gravity * sec`）、落地彈跳或旋轉角速度（`spin`）。
  - **受擊反饋**：擊退採快速推開後阻尼回彈（`easeOut` + 衰減微抖），並遵守 `prefers-reduced-motion`（降為短閃爍與低振幅，不劇烈位移）。

---

## 三、粒子上限與手機 60fps 預算

為確保行動裝置（含 iPhone Safari / PWA）穩定 60fps 且不觸發 WebGL OOM：

1. **單招同屏粒子上限**：
   - 普攻（`basic`）：單招新增活體粒子／精靈 **≤ 18** 個。
   - 技能（`skill`）：單招新增活體粒子／精靈 **≤ 32** 個。
   - 必殺（`ultimate`）：單招新增活體粒子／精靈 **≤ 48** 個。
2. **全域品質分級硬上限（沿用專案現有常數）**：
   - `BATTLE_FX_PARTICLE_CAP`：`saver: 90`、`balanced: 240`、`high: 380`。
   - `moveVfxKit` 總粒子池：`saver: 110`、`balanced: 260`。
   - `PIXEL_MOTE_CAP`：`saver: 30`、`balanced: 80`、`high: 110`。
   - `PIXEL_HIT_BURST_CAP`：`saver: 4`、`balanced: 10`、`high: 14`。
   - 超額時必須淘汰最舊粒子並回收至池中，不得無上限增長。
3. **GPU 與濾鏡紀律**：
   - 行動端渲染解析度上限 `<= 1.75x`（由 `championshipPixiStage` 管控）。
   - 任何螢幕後處理濾鏡（如 `battleHitFeel`）必須設定為「僅螢幕可視區（`screenArea()`）」且僅於效果存活期間掛載，結束立即設 `filters = null; filterArea = null`，嚴禁套用於整張大圖。
   - 像素風貼圖一律設定 `scaleMode = 'nearest'`，光暈（`glow` / `flare` / `streak` / `ring`）才使用 `blendMode = 'add'`；暗屬性（`dark`）不使用全加法混合以免發白消失。
4. **零洩漏生命週期檢查**：
   - 所有動態建立的 `Sprite` / `Graphics` / 烘焙 `Texture` / 暫存 `<canvas>` 必須在效果結束回池，並於模組 `dispose()` 徹底 `destroy()` 與清空陣列／`Map`。
   - 在試車場（`/vfx-sandbox.html`）連續觸發 10 次以上並靜置 2 秒後，所有 VFX 層 `live` 計數必須完全歸 `0`。

---

## 四、驗證方式

所有技能 VFX 改動必須先在獨立試車場 `http://127.0.0.1:8732/vfx-sandbox.html` 切換 **實戰草地 / 暗色背景** 與 **`1.0x / 0.25x` 慢動作** 檢查五段節奏與可讀性，再交由 `visual-qa-loop` 以 `/browser` 鎖定 `375x812` 錄影截圖驗收。
