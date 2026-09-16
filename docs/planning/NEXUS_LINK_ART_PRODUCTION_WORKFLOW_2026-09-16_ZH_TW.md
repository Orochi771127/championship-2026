# Championship 2026 → Nexus Link：美術量產工作流

> **2026-09-16 收束校正：** 本輪执行範圍以 [Convergence Handoff](../coordination/CODEX_CONVERGENCE_HANDOFF_2026-09-16_ZH_TW.md) 為準：先 `field_cm01_01` 既有素材 proof，再三尺寸 responsive foundation；Creature 僅檢查 readiness。實測結果與唯一下一步清單見[收束報告](../reports/convergence-2026-09-16/REPORT_ZH_TW.md)。下文未完成的產品設計仍為 `DEFERRED`，不構成額外施工或批量生成授權。

日期：2026-09-16  
狀態：`OWNER_DIRECTION / PLANNING_ONLY / NO_RUNTIME_REWRITE_AUTHORIZED`

> **核心前提：美術是目前產品化最大的風險，但解法不是重新做一款遊戲。**  
> 本工作流直接服務現有 `championship-2026`，沿用既有 runtime、asset manifest、animation profile、PixiJS/DOM/Three 邊界、測試與 `championship-art-production` 流程。任何外部 GitHub 專案只作工具或流程參考，不得建立平行資產系統。

---

## 1. 問題定義

目前真正的瓶頸不是「能不能生出一張好看的圖」，而是能不能把圖片變成**可量產、可重現、可驗收、可進遊戲**的資產。

需要同時解決：

1. 同一角色跨姿勢／跨動畫的身分一致；
2. 角色比例、朝向、色彩、配件不漂移；
3. 透明背景與邊緣乾淨；
4. 依適用 AnimationProfile 保存座標：native 替換保留每格 origin/offset/scale/timing/flip/blank；新原創 profile 才可宣告共享設計比例與參考底線；
5. 動作在 64–128px gameplay 尺度仍可讀；
6. 不把每一 frame 都當成獨立 AI 圖重新生成；
7. 圖片產出後能自動整理成 frames / strip / atlas / manifest；
8. 每個 asset 有來源、模型、prompt、seed / reference、人工批准與 runtime QA 紀錄；
9. 角色數量擴大時，成本主要增加在 data + art，而不是新增角色特例程式。

因此正式流程必須把「AI 生成」視為其中一段，不是整個 pipeline。

---

## 2. GitHub 工作流研究結論

### 2.1 `chongdashu/ai-game-spritesheets` — **高優先採用流程原理**

Repository：`https://github.com/chongdashu/ai-game-spritesheets`  
License：MIT。

最值得吸收：

```text
concept
 -> canonical game anchor
 -> neutral anchor
 -> directional anchors when required
 -> walk via image-to-video when beneficial
 -> attack / idle as authored sheets
 -> background removal
 -> normalization
 -> runtime spritesheet
```

其最重要的觀念不是特定模型，而是：

- 一張 canonical anchor 控制角色身分；
- 先去掉魔法光、武器殘影等「烘焙效果」，留下 neutral production anchor；
- animation 完成後一定要做 height / foot-baseline normalization；
- 生成只占流程的一部分，後處理與 runtime QA 才決定是否可用。

**決策：`ADOPT_PATTERN`。**  
不照抄其固定 5×2 規格；frame count 必須由 Championship animation audit / morphology profile 決定。

---

### 2.2 `chongdashu/ai-pixel-snapped-game-sprites` — **像素輸出專用可選流程**

Repository：`https://github.com/chongdashu/ai-pixel-snapped-game-sprites`  
License：MIT。

解決三個實際問題：

- mixels / 假像素；
- frame bleeding；
- frame drift。

流程包含 native-grid recovery、pose-board frame recovery、foot anchoring、1–2px 最後校正。

**決策：`OPTIONAL_PIXEL_TRACK`。**

只在正式方向確定需要 native-pixel / pixel-snapped 輸出時使用。若 Nexus Link 最終採 HD hand-drawn sprite，不應為了流程方便強迫所有角色降成像素風。

---

### 2.3 OpenAI Game Studio `sprite-pipeline` — **預設角色動畫生產規則**

既有 Game Studio skill 已定義：

```text
approved seed frame
 -> build transparent edit canvas
 -> generate one whole action strip
 -> normalize with one shared scale
 -> bottom-center anchor
 -> optional frame-01 lockback
 -> preview
 -> in-engine QA
```

**決策：`DEFAULT`。**

尤其鎖定：

- 禁止逐 frame 獨立生成作為預設；
- 同一 action 一次處理完整 strip；
- approved seed 是 identity authority；
- 任何 strip 未通過 preview / in-engine QA 不得登錄 production manifest。

---

### 2.4 `AHEKOT/ComfyUI_VNCCS` — **角色身分一致性 POC**

Repository：`https://github.com/AHEKOT/ComfyUI_VNCCS`  
License：MIT。

它提供 Character Creator / Cloner、Pose Studio、透明 sprite、服裝與表情的一致性工作流。

對本專案最有價值的是：

- existing approved character → consistent pose set；
- pose import；
- body proportions control；
- background removal；
- outfit / expression variants。

限制：目前核心仍偏 Visual Novel / static sprite，README 中 animation 仍列為後續方向。

**決策：`POC_FOR_IDENTITY_AND_POSE`。**  
可拿一隻原創角色與 GPT Image whole-strip 方法做 A/B 測試；若本機 GPU / 安裝成本不划算，不升格成必要依賴。

---

### 2.5 `xl732236362/ComfyUI-GameAsset-Workflows` — **只研究 pose-controlled animation 方法**

Repository：`https://github.com/xl732236362/ComfyUI-GameAsset-Workflows`

值得研究：

- character reference conditioning；
- OpenPose / pose-controlled action；
- deterministic seed；
- validated frames → spritesheet → animation metadata；
- 先 smoke、再 production animation 的 gate。

但該 repo README 明確指出**沒有 LICENSE file，未授權重用其程式碼**；而且其 export path 偏 Godot，本產品不換引擎。

**決策：`RESEARCH_ONLY / DO_NOT_COPY_CODE`。**  
只吸收「pose controls + reference conditioning + staged validation」這個方法，自己在現有 Pixi asset pipeline 實作最小必要腳本。

---

### 2.6 `wy715464489/comfyui_workflow` — **只研究一致性生成架構**

Repository：`https://github.com/wy715464489/comfyui_workflow`

內容以 ComfyUI + IP-Adapter + LoRA + ControlNet 批量建立角色、背景、UI icon 的一致性為主。

目前未找到 LICENSE，因此：

**決策：`RESEARCH_ONLY / DO_NOT_VENDOR`。**

只借鏡：reference conditioning、pose control、style consistency、批量 job manifest；不複製其 workflow / code 進商業 repo。

---

### 2.7 Aseprite CLI — **正式 cleanup / tags / export 工具**

官方 Aseprite CLI 支援：

- batch export；
- frame sequence；
- layer split；
- sprite sheet；
- JSON data；
- texture atlas packing；
- scale / palette conversion。

**決策：`ADOPT_IF_LICENSED_LOCALLY`。**  
Aseprite 作為 art authoring / export tool，不是 runtime dependency。若 Owner 沒有 Aseprite 授權，可用現有 Python tooling / 其他合法工具替代，不因此阻塞遊戲。

---

### 2.8 `danielgatis/rembg` — **透明背景候選工具**

Repository：`https://github.com/danielgatis/rembg`  
License：MIT。

支援 CLI / Python library / batch folder processing，並有 alpha matting / decontamination 等邊緣處理。

**決策：`OPTIONAL_ADOPT`。**

只作自動初步去背；毛髮、翼、半透明 VFX 邊緣仍需 QA，不能把自動去背結果直接標成 `READY_FOR_RUNTIME`。

---

### 2.9 `pekkavaa/SpriteBatchRender` — **Blender 多角度 sprite 思路參考**

Repository：`https://github.com/pekkavaa/SpriteBatchRender`  
License：GPLv2；README 表示舊版測試環境為 Blender 2.81a。

可借鏡：

- orthographic camera；
- transparent render；
- 多方向批次輸出；
- animation frame range batch render。

**決策：`RESEARCH_ONLY_FOR_BLENDER_4.x`。**  
不要直接把舊 plugin 當 Blender 4.5 生產依賴。若 POC 證明有價值，優先寫小型自有 Blender Python batch-export script，或只在外部工具層使用並遵守 GPL 義務。

---

### 2.10 `LayrKits/Sprite-Pipeline` — **後處理流程參考，不直接 vendor**

Repository：`https://github.com/LayrKits/Sprite-Pipeline`

提供 video frames → FFmpeg extract → matte → 256×256 cell → strip → browser viewer → validation report 的完整思路。

目前 repo 未見 LICENSE。

**決策：`RESEARCH_ONLY / DO_NOT_COPY_CODE`。**

可吸收：

- raw / work / approved 三層 staging；
- 每個 animation 有 preview + validation report；
- 只 promote approved output。

---

## 3. Championship 2026 的正式美術工廠

所有新工作直接接入現有 Championship art authority，不建立第二套 registry。

### Stage A — `IDENTITY_APPROVED`

每個角色先完成 Character Bible：

```text
Family ID
Form ID
Core fantasy
Morphology
Silhouette
Palette
Materials / markings
Front / side / back
Canonical game-facing pose
Scale reference
Attack key pose
Happy / tired expression
```

**此 Gate 未通過，不生正式動畫。**

### Stage B — `CANONICAL_GAME_ANCHOR`

從 approved design 建立一張真正能進遊戲的 canonical anchor：

- transparent / flat removable background；
- 無 UI、無文字、無場景；
- 無不必要的 VFX；
- 正確 gameplay facing；
- 正確 palette / proportions / accessories；
- bottom-center ground anchor 可辨識；
- 在實際 gameplay 尺度仍清楚。

這張圖是後續所有動作的 identity authority。

### Stage C — `ACTION_BLUEPRINT`

先由 AnimationProfile 決定該 morphology 需要哪些 action，不由生成模型自行發明。

1.0 共用 vocabulary：

```text
Idle
Move
Attack
Skill
Hit
Down
Eat
Sleep
Interact
```

每一 action 先定：

- key poses；
- frame count range；
- loop / one-shot；
- contact frame；
- expected ground anchor；
- VFX 是否分離；
- 哪些 frame 可 reverse / hold / reuse / procedural。

### Stage D — `GENERATE_ACTION`

預設路徑：

```text
canonical anchor
 -> transparent edit canvas / pose guide
 -> one whole action strip
 -> human select / regenerate only failed action
```

替代路徑：

- Walk / Run 若 still-image strip 不自然，可用 image-to-video → 挑 8–12 關鍵 frame → 同一 normalization 流程；
- 困難姿勢可試 ComfyUI reference + pose-control；
- 禁止因一個 action 失敗而重生整隻角色全部動畫。

### Stage E — `CLEAN_AND_NORMALIZE`

**適用範圍校正：** 下列 shared scale / bottom-center 是新原創 profile 的 authoring 方法。既有 native 角色必須先經 `build-character-appearance-workflow.py` / `compile-pixel-character-bank.py` 的逐格證據與幾何驗證；禁止把 generic sprite-pipeline 的 normalization 直接套到 native frames。第 5 節兩個 production pilot 及 ComfyUI A/B 均為未來 `DEFERRED`，本輪只有 readiness。

自動化：

1. 去背 / alpha cleanup；
2. component / frame extraction；
3. 一套 shared scale；
4. bottom-center foot baseline；
5. fixed cell dimensions；
6. frame-order validation；
7. optional frame-01 lockback；
8. atlas / strip export；
9. animation JSON / manifest；
10. preview GIF / sheet。

### Stage F — `ART_QA`

每個 action 必須檢查：

- identity drift；
- accessory loss / mutation；
- palette drift；
- silhouette readability；
- foot / ground drift；
- frame clipping；
- alpha fringe；
- contact pose；
- timing；
- 64 / 96 / 128px 尺度；
- reduced VFX / motion variant when applicable。

### Stage G — `RUNTIME_QA`

必須在真正的 Championship scene 看，而不是只看 sprite sheet：

- Habitat / Cage；
- Hunt；
- Battle；
- 390×844 reference viewport；
- 多角色同時出現；
- selection / hit / visible bounds；
- memory / texture / draw-call 代表性測量。

只有 runtime QA 通過後，才能 promotion 至現有 production manifest。

---

## 4. 三條美術生產線，不混成一條

### Track A — Creature 2D（預設）

```text
Character Bible
 -> canonical anchor
 -> action strip / pose-controlled generation
 -> cleanup
 -> normalize
 -> preview
 -> Pixi runtime
```

### Track B — Habitat / Props（Blender 輔助）

適合重複量產的家具／建築：

```text
2D concept / style reference
 -> Blender editable master
 -> materials / variants
 -> fixed orthographic / approved camera
 -> transparent PNG batch render
 -> 2D runtime
```

只有真的需要視角變化、深度遮擋或動態 3D 的少數場景才輸出 GLB 到 bounded Three.js。

### Track C — UI / Icon

```text
design token / icon grammar
 -> vector / authored master where possible
 -> AI only for concept / decorative candidate
 -> cleanup
 -> SVG / PNG / WebP runtime
```

核心 UI icon 不應依賴每次 AI 重生成；一旦語言定稿就轉為可重現 master。

---

## 5. 第一個實驗：不要先做全 roster

### Creature Pilot

挑 1 隻已批准的原創 creature，完成：

```text
Idle
Move
Attack
Hit
Eat
Sleep
```

比較：

- Path A：GPT Image whole-strip；
- Path B：ComfyUI reference + pose control（只有本機條件允許才做）。

記錄：

- generation attempts；
- usable-frame ratio；
- manual cleanup minutes；
- identity drift；
- anchor correction；
- final file size；
- in-engine quality；
- money / GPU time。

### Habitat Prop Pilot

只做：

```text
1 furniture master
+ 3 material / colour variants
```

比較：

- pure 2D authored / generated；
- Blender master → transparent batch render。

只有 Blender 的總工時與一致性更好，才擴充到同類資產。

---

## 6. 自動 QA 建議

在現有 scripts 中逐步增加自有檢查，不引入第二套 asset system：

- alpha bounds；
- non-transparent pixel bounding box；
- bottom baseline variance；
- frame scale variance；
- sprite clipping；
- image dimensions / cell count；
- duplicate exact-RGBA detection；
- perceptual similarity warning；
- atlas page budget；
- preview generation。

可評估 `pixelmatch` 類工具做 deterministic visual diff，但 approval 仍需人看實際 animation；數值 diff 不能代替美術判斷。

---

## 7. 現在不要做的事

- 不要先生成 60 / 100 / 224 隻；
- 不要每隻角色重新發明 prompt；
- 不要逐 frame 獨立生成；
- 不要因 AI 能做 3D 就把 roster 全 3D；
- 不要把 concept art 直接縮小當 runtime sprite；
- 不要把背景去除成功當成 production complete；
- 不要直接 vendor 無 License 的 GitHub code / workflow；
- 不要讓美術工具決定 gameplay state；
- 不要建立與 `championship-art-production` 平行的資產登錄系統。

---

## 8. 採用優先序

```text
P0  現有 Game Studio sprite-pipeline + Championship art registry
P0  canonical anchor + whole-action-strip + normalization
P0  in-engine preview / QA
P1  Aseprite CLI 或現有 Python export automation
P1  rembg 作 optional batch alpha cleanup
P1  1 creature art-factory pilot
P1  1 Blender furniture pilot
P2  VNCCS identity / pose POC
P2  image-to-video walk-cycle POC
P3  pose-controlled local ComfyUI production only if measured benefit exists
```

**成功條件不是「AI 生成得漂亮」，而是：一個新 creature 能在可預測成本內，從 approved design 穩定轉成 Championship runtime asset。**
