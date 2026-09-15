# Championship 2026 — 遊戲完成、角色設計與動畫生產工作流

日期：2026-09-14  
狀態：`PLANNED / OWNER_REVIEW_REQUIRED`  
適用：單人 Owner + AI Agents、Web-first / Mobile-first、現有 PixiJS + bounded Three.js 架構。  

> 本文件不是要求立刻全面改造 runtime；它定義「怎麼把現在的研究 / rebuild 最後收斂成可完成的產品」以及「200–500 forms 如何有可持續的角色 / 動畫生產線」。

---

# 0. 核心決策

## 0.1 不換引擎

維持現有 repo 的基本責任：

```text
DOM / CSS   -> UI / menu / text / accessibility
PixiJS v8   -> 2D field / creature sprite / 2D VFX
Three.js    -> bounded 3D environment / selected visual scenes
Simulation  -> renderer-neutral gameplay truth
Save        -> one canonical versioned state
```

不因想做 Habitat 3D 就把整款遊戲重寫成 Unity / Unreal / React / 第二套 Three runtime。

## 0.2 完成產品的順序不是「先把所有內容做好」

而是：

```text
Game Spine
 -> One Original Vertical Slice
 -> Content Factory
 -> Roster Expansion
 -> Device / Packaging QA
 -> Release
```

## 0.3 角色生產採 Hybrid，不押單一技術

預設：

- 大多數 creature：2D sprite / sprite-strip + Pixi procedural motion；
- 結構適合切片的角色：可評估 Spine 2D skeletal；
- Habitat / architecture / selected hero asset：3D / GLB；
- 全 roster 直接全 3D：不是第一階段預設。

---

# 1. 遊戲完成工作流（Production Gates）

## Gate 0 — Research Freeze：把研究變成決策，不再無限考古

### 目標

每個 subsystem 必須有一個「足夠開始產品化」的 freeze point。

例如 Battle：

- action vocabulary 已足夠；
- damage / selection / effect / party / result 可跑；
- 仍未還原的原作 camera / VFX / edge behavior 可繼續列 debt；
- 但不因最後 5–10% parity 阻止 original product adapter。

### 交付

每個 subsystem 只能是：

```text
REFERENCE_BASELINE_READY
PRODUCT_ADAPTER_READY
OPEN_BLOCKER
```

避免「研究永遠沒有完成」。

---

## Gate 1 — GAME_SPINE_FUNCTIONAL

### 必須完整跑通

```text
New Game
 -> starter / hatch
 -> Raising
 -> Evolution
 -> Gate / Hunt
 -> Capture
 -> return to Habitat/Home
 -> Team Build
 -> Auto Battle
 -> Result / Reward / Rank
 -> Save
 -> real reload
 -> Continue
```

### Definition of Done

- 使用同一個 save authority；
- 無第二套 store / router / ticker；
- gameplay truth 不在 renderer；
- 360–430px portrait contract 基本可玩；
- regression tests 維持通過；
- 原作 reference asset 不可誤成 shipping asset。

**這一 Gate 可以仍用少量中性 / placeholder content。**

---

## Gate 2 — ORIGINAL_VERTICAL_SLICE

### 只做少量原創內容，但每一層都是真的

建議：

```text
3 base families
15–20 forms
1 Habitat
6–8 functional Habitat objects
12 core life behaviours
2 Hunt regions
1 complete Capture flow
20–30 original moves
3v3 battle
3 tournament tiers
1 short story arc
Branch Evolution
```

### 必須證明的不是 roster 數量

而是：

> 同一隻 CreatureInstance 從出生、生活、探索、Battle、Story、Evolution、Save/Continue 都保持同一個體身份。

### 玩家驗收問題

- 能不能說出三隻 creature 的性格差異？
- Habitat 無操作 10 分鐘是否仍有可讀生活？
- Battle 是否反映前面的培養？
- Story event 是否留下後果？

---

## Gate 3 — CONTENT_FACTORY_READY

只有 Vertical Slice 成立後，才開始擴 roster。

### 必須具備

- CreatureDefinition schema；
- CreatureInstance schema；
- Evolution graph schema；
- AnimationProfile；
- MoveDefinition；
- Habitat affinity / work affinity；
- asset manifest；
- automated validation；
- in-engine preview；
- art / animation review report。

### 原則

新增第 50 隻 creature 不應新增新程式碼；大多數情況應只新增 data + assets。

---

## Gate 4 — CONTENT_SCALE

推薦分段，而不是 500 一次做完：

```text
Launch target: 60–100 forms
Expansion:   150–200 forms
Long-term:   architecture supports 500+ forms
```

「支援 500」是 architecture target，不是首發 content requirement。

---

## Gate 5 — MOBILE / BROWSER HARDENING

現有 repo 已使用 Playwright；正式產品化時擴成：

- Chromium；
- WebKit / Mobile Safari behavior；
- Firefox（至少 smoke）；
- 既有主要 portrait viewports；
- touch；
- orientation change；
- context loss / resume；
- save corruption / recovery；
- timezone / clock tests；
- offline / service-worker upgrade；
- memory / GPU lifecycle。

Playwright 官方支援 Chromium / WebKit / Firefox，亦可模擬 mobile viewport、touch、locale、timezone 等，適合現有 web-first 架構。

---

## Gate 6 — PWA FIRST, NATIVE WRAPPER LATER

推薦順序：

```text
Browser release-quality
 -> Web App Manifest
 -> Service Worker / offline asset strategy
 -> Installable PWA
 -> Device QA
 -> Capacitor only if store/native APIs are justified
```

理由：

- web.dev 明確將 Web App Manifest 作為 PWA installability 核心資料；
- Capacitor 官方定位就是把既有 web app 包成 iOS / Android native runtime，而不是要求另寫一個 mobile app。

---

# 2. 角色設計工作流（Creature Design Pipeline）

## 2.1 先設計「家族」，不是一隻一隻散畫

每個 creature family 先建立：

```text
Family ID
Core fantasy
Shape language
Silhouette rule
Material language
Color logic
Personality tendencies
Habitat affinity
Battle role
Evolution themes
Morphology profile
```

### 原因

若未來有 200–500 forms，沒有 family grammar 就會：

- 每隻造型像不同 IP；
- Evolution 沒血緣感；
- AI image generation 越做越 drift；
- 動畫不能共用；
- art review 無標準。

---

## 2.2 每隻 Form 的最低 Character Bible

先不要生 animation。

至少先批准：

1. 正面 hero image；
2. 側面；
3. 背面；
4. silhouette；
5. palette；
6. scale relative to human / Habitat object；
7. neutral pose；
8. attack key pose；
9. happy / tired expression；
10. morphology / rig / animation profile。

### 狀態

```text
CONCEPT
 -> IDENTITY_APPROVED
 -> PRODUCTION_READY
```

只有 `IDENTITY_APPROVED` 才允許量產 animation。

---

# 3. 2D Sprite 生產線（目前最適合大量 roster 的預設）

## 3.1 核心流程

```text
Approved Character Bible
 -> Approved in-game seed frame
 -> whole action strip generation
 -> frame normalization
 -> shared anchor / shared scale
 -> in-engine preview
 -> human review
 -> manifest registration
```

### 重要：不要每格分開生成

逐 frame 生圖最容易產生：

- 身體比例 drift；
- 配色 drift；
- 臉型 drift；
- 配件消失；
- 尺寸跳動。

更穩定的方法是：

> 以一張已批准的 seed frame 為 anchor，一次生成完整 strip，再做 normalization。

### Normalization 必須自動化

- transparent background；
- fixed frame dimensions；
- bottom-center / species-specific anchor；
- one shared scale per strip；
- optional frame-01 lockback；
- preview sheet；
- runtime smoke test。

---

## 3.2 Animation Contract 不要先假設每個 action 3 張

先做 `Championship Creature Animation Cost Audit`：

```text
53 original sequences
 -> timeline frames
 -> unique cells
 -> unique visual poses
 -> mirrored / transformed poses
 -> procedural candidates
 -> morphology grammar
```

然後才決定新作需要幾個真正 art poses。

### 第一版暫定核心動作集合

不是正式 frame count，只是 category：

- Idle
- Move
- Eat
- Sleep
- Happy
- Tired / Unhappy
- Player Interaction
- Creature Interaction
- Work / Train
- Attack
- Hurt
- Victory / Special Reaction

### Pixi procedural 可取代的動作

- breathing
- bob / float
- shake
- bounce
- squash / stretch
- knockback
- flash
- recoil
- tiny head turn / look target（視素材結構）

Procedural motion 不應影響 save / gameplay truth。

---

# 4. Spine 2D Skeletal：不是全角色預設，但值得做 POC

Spine 現在有官方 `spine-pixi-v8` runtime，支援 PixiJS 8，因此技術上跟本 repo 相容。

## 適合

- 二足 / 四足、身體可拆 parts；
- 肢體比例在同一家族內接近；
- 需要大量 idle / work / interaction；
- 想透過同一 skeleton + skins 共用 animation。

Spine 官方建議重複角色若使用相同 skeleton，可透過 skins 共用 animation；但 skeleton structure 差異大時，不能期待自由 retarget。

## 不適合

- 形狀每次極端變化；
- 黏液、蛇、雲狀、巨大翅膀等 topology 差異極高；
- 追求強烈逐格 smear / deform 的像素動畫；
- 為了共用 rig 反而限制 creature design。

## 建議

只做 1 個 POC：

```text
同一家族 3 forms
同一 morphology
Idle + Move + Eat + Work + Attack
```

若製作時間 / file size / visual quality 明顯優於 sprite strip，再擴大使用。

---

# 5. 3D 角色生產線（Selected / Future Track）

現在 2D image -> 3D 已比早期 Nexus Link 成熟很多，但仍應視為 production assistant，不是「一鍵就能 shipping」。

## 5.1 建議流程

```text
Character Bible
 -> front / side / back / 3/4 references
 -> Multi-view Image-to-3D
 -> mesh / part separation
 -> retopology / cleanup
 -> texture cleanup
 -> rig
 -> animation
 -> GLB
 -> optimize
 -> Three.js runtime test
```

### 可用工具類型

#### Meshy
官方 2026 game-asset workflow已包含：

```text
Generate
 -> Remesh
 -> AI Texturing
 -> Rigging
 -> Export FBX / GLB
```

Multi-view 可用多角度圖降低側面 / 背面亂猜。

#### Tripo
官方目前支援：

- single / multi-view image-to-3D；
- quad / smart mesh；
- part separation；
- texturing；
- retopology；
- humanoid / animal / stylized auto rig；
- GLB / FBX export。

### 重要限制

AI 生成後仍需：

- silhouette review；
- joint topology review；
- feet / hand / tail / wing cleanup；
- material count control；
- texture budget；
- mobile poly budget；
- collision proxy；
- animation deformation QA。

---

# 6. 3D Animation 工作流

## 6.1 Morphology Rig Families

不要 500 隻各自從零做 animation。

先分類：

```text
BIPED_SMALL
BIPED_HEAVY
QUADRUPED
FLYING
FLOATING
SERPENTINE
BLOB
SPECIAL
```

每類有 AnimationProfile。

## 6.2 Cascadeur

Cascadeur 2026 現在可：

- AI AutoPosing；
- AI inbetweening；
- AutoPhysics；
- humanoid / quadruped quick rig；
- retargeting；
- GLB / GLTF / FBX workflow。

官方特別確認 quadruped AutoPosing / quick rig，因此比只支援 human skeleton 的工具更適合部分獸型角色。

## 6.3 Mixamo

Mixamo 仍適合：

- humanoid；
- 快速 auto-rig；
- 大量 mocap animation library。

但 Adobe 官方 auto-rig 是 full human skeleton，因此**不應把 Mixamo 當所有幻獸的通用方案**。

## 6.4 Blender 作為最後 authority

所有 3D shipping asset 最後經 Blender：

- topology；
- weight；
- material；
- pivots；
- scale；
- actions / NLA；
- export。

Blender glTF exporter 支援：

- armature / skinning；
- keyframe animation；
- shape keys；
- multiple actions / NLA tracks；
- GLB / glTF。

每個動作要用穩定命名：

```text
idle
move
sleep
work
attack_basic
hurt
victory
```

而不是依 DCC 臨時命名。

---

# 7. Habitat 2D 圖 -> 3D / 2.5D 世界工作流

這是目前最適合你拿 Championship Cage / 其他成功產品做「內部設計 reference」的地方。

## 7.1 研究層

```text
Original / commercial reference image
 -> spatial analysis
 -> functional zones
 -> blockout / AI world test
```

Reference 圖只作 research / blockout；shipping world 最後必須走原創 / 已授權 asset gate。

## 7.2 兩條可測技術

### A. Modular Mesh Habitat（較可控）

```text
reference / concept
 -> scene decomposition
 -> Ground / Wall / Pond / Bed / Tree / Facility
 -> Meshy / Tripo / Blender
 -> individual GLB props
 -> Three.js composition
```

優點：

- 玩家可編輯；
- 可搬家具；
- collider 清楚；
- affordance 綁定清楚；
- 容易重用。

### B. Image-to-World（快速視覺 POC）

World Labs Marble 現在可從 image / multi-image / text 生成可探索 3D world，並可輸出：

- Gaussian splat；
- collider mesh GLB；
- high-quality mesh GLB。

Spark 可把 splat 放入 Three.js。

但官方資料也顯示 high-quality mesh 常是 600k–1M triangles、100–200MB 左右，因此：

> **適合快速證明空間與視覺，不等於可以原封不動丟進 mobile shipping build。**

最終仍需 retopo / segmentation / texture budget / collider cleanup。

---

# 8. 3D Runtime Asset Contract

正式 web 3D shipping 格式統一：

```text
GLB / glTF 2.0
```

不要把 FBX / OBJ / Blender 檔當 runtime API。

Three.js `GLTFLoader` 官方支援 glTF 2.0，並支援 Draco、Meshopt、KTX2 / Basis 等常用 web 壓縮擴充。

## Optimize 階段

用 glTF Transform 類工具處理：

- prune；
- dedup；
- meshopt / Draco；
- texture resize；
- WebP / KTX2；
- material reduction。

所有 3D asset 在進 repo 前要有：

```text
poly / triangle count
texture count / resolution
material count
file size
pivot
scale
collision status
LOD status
source / license / provenance
```

---

# 9. 200–500 forms 的動畫成本控制

## 9.1 不把 500 視為首發數量

```text
Architecture capacity: 500+
Launch content:        60–100
```

## 9.2 三層動畫成本

### Core
所有角色必備。

### Procedural
由 runtime 做，不新增繪圖。

### Signature
只有重要角色 / 高階 form / hero form 有。

```text
Core:
  idle / move / eat / sleep / work / attack / hurt

Procedural:
  breathing / bob / shake / recoil / knockback

Signature:
  unique idle / affection / signature attack / rare habitat action
```

## 9.3 不同 morphology 可以有不同 frame budget

不要硬規定所有角色：

```text
12 actions × 3 poses
```

應由 Animation Cost Audit 決定：

```text
animationProfileId
morphology
requiredActions
optionalActions
proceduralCapabilities
anchorPolicy
frameBudget
```

---

# 10. AI 工具應放在哪裡

## AI 適合

- concept exploration；
- front / side / back reference；
- approved seed frame -> strip draft；
- image-to-3D base mesh；
- PBR texture draft；
- motion draft / inbetween；
- environment concept；
- QA 差異檢查輔助。

## AI 不應直接當 authority

- identity approval；
- final topology；
- rig quality；
- animation timing；
- gameplay collider；
- legal / provenance state；
- final in-engine readability。

### Seedance / Kling 類 video model

推薦用途：

- motion ideation；
- previs；
- signature attack reference；
- trailer concept。

不建議直接把輸出影片當 runtime animation source，除非另有穩定 extraction / normalization pipeline。

---

# 11. Content Factory 的 Repo 結構建議

概念上：

```text
src/data/original-product/
  creatures/
  evolution/
  moves/
  habitat/
  story/

assets/production/
  creatures/
  habitat/
  vfx/
  audio/

scripts/
  validate-creature-definition
  validate-animation-contract
  build-character-preview
  validate-asset-budget
```

不要求現在立即搬目錄；真正改路徑前應先稽核 current manifest / build contract。

---

# 12. 每一隻角色的 Production Checklist

```text
[ ] Family approved
[ ] Form identity approved
[ ] Front / side / back coherent
[ ] Palette approved
[ ] Morphology assigned
[ ] AnimationProfile assigned
[ ] Seed frame approved
[ ] Core animations produced
[ ] Anchors normalized
[ ] Runtime preview passed
[ ] Habitat scale passed
[ ] Battle readability passed
[ ] Mobile 390px viewport passed
[ ] Asset budget passed
[ ] Provenance recorded
[ ] Manifest registered
```

只有全部通過才標記：

```text
CONTENT_PRODUCTION_READY
```

---

# 13. 不要讓 AI Agent 無限工作

每個工作包必須有：

```text
INPUT
OUTPUT
OWNER
DO NOT CHANGE
ACCEPTANCE
STOP CONDITION
```

例如「做第一隻原創 creature」不是合法 task。

應是：

```text
Input:
  approved character bible
  animation contract v1

Output:
  7 core action strips
  normalized frames
  preview report

Do not change:
  simulation
  battle formula
  save schema

Acceptance:
  no identity drift
  no anchor drift
  passes 390x844 runtime preview

Stop:
  after report; do not start second creature
```

---

# 14. Definition of Done：遊戲何時叫「完成」

不是 parity 100%，也不是 roster 500。

Launch v1 必須：

- 一條完整 New Game -> long-term loop；
- Raising / Habitat / Hunt / Capture / Evolution / Battle / Progression 可互相回饋；
- 沒有必須連 server 才能玩的 core campaign；
- Save / recovery / migration 可驗證；
- 主要 mobile viewport 可用；
- public build 不含 reference-only asset；
- 原創 roster 達 launch target；
- 沒有 P0 progression blocker；
- browser / PWA acceptance；
- store/native 包裝若要做，必須是同一 web codebase 的後續 envelope。

---

# 15. 建議立即做的 4 個 Spike

## Spike A — Animation Cost Audit

完整算 216 regular creatures × Main/Sub：

```text
sequence frames
unique cells
unique visual poses
mirrorable
procedural candidate
shared grammar
```

## Spike B — Habitat Life Simulation

3 隻 creature、6 個 affordance、10 分鐘無操作。

## Spike C — 2D Character Factory

1 個原創 family、3 forms：

```text
Bible -> seed -> full strips -> normalize -> Pixi runtime
```

量時間、file size、返工率。

## Spike D — 3D Habitat Reference Conversion

用一張 internal reference Cage / Habitat concept：

```text
image / multi-view
 -> Marble / Tripo / Meshy test
 -> Blender cleanup estimate
 -> GLB
 -> Three.js mobile test
```

目的不是 shipping，而是回答：

- 現在 AI 3D 品質到底夠不夠；
- 清理成本多少；
- mobile runtime 負擔多少；
- modular mesh 與 generated-world 哪條比較適合。

四個 Spike 完成後，再決定最終大量生產工具，不要在證據前買大量點數。

---

# 16. 來源 / 工具證據

## Browser game architecture / QA

- Playwright mobile / browser emulation  
  https://playwright.dev/docs/emulation
- Playwright browsers / projects  
  https://playwright.dev/docs/browsers
- PWA Web App Manifest  
  https://web.dev/learn/pwa/web-app-manifest
- PWA installation  
  https://web.dev/learn/pwa/installation
- Capacitor  
  https://capacitorjs.com/docs

## 2D skeletal

- Spine PixiJS v8 runtime  
  https://en.esotericsoftware.com/spine-pixi
- Spine animation reuse / skins discussion  
  https://en.esotericsoftware.com/forum/d/18011-animation-reuse

## 3D generation / environment

- Meshy game asset workflow  
  https://docs.meshy.ai/en/webapp/guides/use-cases/game-assets
- Meshy multi-view Image-to-3D  
  https://www.meshy.ai/tutorials/multi-view-image-to-3d
- Tripo Image-to-3D  
  https://www.tripo3d.ai/features/image-to-3d-model/
- Tripo feature pipeline / rigging  
  https://www.tripo3d.ai/help/getting-started/what-features-does-tripo-have
- World Labs Marble  
  https://docs.worldlabs.ai/
- Marble mesh / collider export  
  https://docs.worldlabs.ai/marble/export/mesh
- Marble / Three.js splat export  
  https://www.worldlabs.ai/blog/marble-world-model

## 3D animation / runtime

- Cascadeur 2026 docs  
  https://cascadeur.com/help
- Cascadeur AutoPosing  
  https://cascadeur.com/help/tools/animation_tools/autoposing
- Mixamo rigging  
  https://helpx.adobe.com/creative-cloud/help/mixamo-rigging-animation.html
- Blender glTF exporter / animation  
  https://docs.blender.org/manual/en/3.6/addons/import_export/scene_gltf2.html
- Three.js GLTFLoader  
  https://threejs.org/docs/pages/GLTFLoader.html
- glTF Transform  
  https://gltf-transform.dev/
