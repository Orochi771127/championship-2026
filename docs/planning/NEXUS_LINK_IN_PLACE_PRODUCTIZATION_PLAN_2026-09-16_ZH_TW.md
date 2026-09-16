# Championship 2026 → Nexus Link 原創商業版：原地演進產品化計畫

> **2026-09-16 收束校正：** 500+ 是未驗證的未來容量目標，不是 current runtime PASS；目前既有角色目錄與 Save 容量需分開看。文內簡化 poses、procedural 動作及 Habitat AI 狀態是未來設計，不得取代既有 native 動畫、Battle 或 Cage simulation。

> **2026-09-16 收束校正：** 本輪执行範圍以 [Convergence Handoff](../coordination/CODEX_CONVERGENCE_HANDOFF_2026-09-16_ZH_TW.md) 為準：先 `field_cm01_01` 既有素材 proof，再三尺寸 responsive foundation；Creature 僅檢查 readiness。實測結果與唯一下一步清單見[收束報告](../reports/convergence-2026-09-16/REPORT_ZH_TW.md)。下文未完成的產品設計仍為 `DEFERRED`，不構成額外施工或批量生成授權。

日期：2026-09-16  
狀態：`OWNER_DIRECTION / PLANNING_ONLY / NO_RUNTIME_REWRITE_AUTHORIZED`

> **非談判原則：不重新做一款遊戲。**  
> Nexus Link／原創商業版必須直接建立在 `championship-2026` 現有可用架構、系統、資料流、測試、資產流程與遊戲循環之上，採「逐步替換內容 + 擴充既有 subsystem」的方式演進。除非日後有可量化證據證明現有架構無法承載需求，否則禁止另開第二個遊戲專案、第二套 runtime、第二套 save、第二套 router、第二個 Pixi application、第二套 battle 或平行 gameplay core。

---

## 1. 產品核心

原創版暫以 **Nexus Link** 為品牌／世界觀方向，玩法不另起爐灶，而是把已完成的 Championship 骨架重新表達為原創產品。

核心循環收斂為：

```text
Raise → Explore → Battle → Evolve → Rebuild
```

對應既有 Championship 架構：

| 原創產品層 | 直接承接 Championship 現有能力 |
|---|---|
| Raise | Raising / Care / Training / Calendar / Save |
| Explore | Gate / Hunt / Loadout / Field / Result |
| Battle | Team / Battle simulation / Result / Rank |
| Evolve | Evolution resolver / creature progression |
| Rebuild | Cage / modular habitat / unlock / shop / database / progression |

**任何新功能若無法強化這五個核心動詞，預設不進 1.0。**

---

## 2. 世界觀：不是「另一個數碼世界」

Nexus Link 的原創世界不是由單純資料形成的怪獸世界，而是由人類在網路中留下的：

- 情緒；
- 記憶；
- 關係；
- 夢境；
- 恐懼；
- 數位痕跡；
- AI／社群互動殘響；

逐步形成的 **Resonance Layer（共鳴層／心靈網域，暫名）**。

原創生命暫稱 `Resonant`（正式命名待品牌階段），不是既有 IP 生物的改名版本。

核心敘事概念：

```text
人類現實世界
  ↕
Network Layer
  ↕
Resonance Layer
```

玩家與夥伴透過 `Nexus Link` 建立聯繫。探索、照護、戰鬥與進化全部是同一段共同經歷的不同面向。

---

## 3. 1.0 必須收縮，而不是累加所有研究功能

### 1.0 核心保留

- Hatch / starter；
- Care / Feed / Clean / Rest；
- Training；
- Branch Evolution；
- 分區探索；
- Semi-auto / command-assisted battle；
- Synchronize / recruit（由既有 Capture 流程轉化）；
- Habitat-lite；
- Hub recruitment / unlock；
- Database；
- Tournament / Championship-like progression；
- Save / Continue；
- 短而完整的主線。

### 明確延後，不是 1.0 blocker

- Async PvP；
- real-time PvP；
- trade；
- raid；
- cloud save；
- friends；
- habitat visit；
- LLM companion；
- 大型多居民關係圖；
- 24h full offline simulation；
- step counter / health integration；
- widget；
- 大型自由城市建設；
- breeding；
- 多 Habitat；
- seamless open world；
- 500 forms；
- 224 forms 首發硬需求。

---

## 4. Habitat-lite：直接由 Cage 演進

不新做一套基地遊戲。

第一個產品化 Habitat 直接延伸現有 Cage / modular field / resident assignment / raising effects。

### 第一版只需要

```text
1 Habitat
3 test residents
6 functional objects
~12 reusable actions
```

首批物件：

- Bed → Sleep / Rest
- Food Station → Eat
- Toy → Play
- Training Device → Train
- Pond → Drink / Play
- Interaction Point → Inspect / Player Interaction

角色狀態第一版只鎖：

```text
Hunger
Energy
Mood
Bond
```

Personality 只鎖三軸：

```text
Active ↔ Calm
Social ↔ Independent
Curious ↔ Cautious
```

使用 shared Utility AI / affordance scoring，禁止每隻角色各寫一套 AI。

---

## 5. Battle：保留現有核心，只加有限介入層

禁止另做 ARPG Battle system。

以現有 deterministic / auto-battle simulation 為 authority，未來產品化可增加有限玩家指令：

- Attack focus；
- Guard / evade preference；
- Skill trigger；
- Item / support action。

角色仍有自主性；玩家是「指揮／支援」而不是直接控制每一步移動。

這個方向吸收 `Digital Tamers 2` 的參與感，但不能複製其具體 UI、數值、角色或演出。

---

## 6. Explore：由 Gate / Hunt 直接演進成小而密的區域

不做 seamless open world。

現有 Gate → Hunt 結構直接轉成區域式 Resonance World：

```text
Hub
 ├ Forest Region
 ├ Ruins Region
 ├ Memory Lake
 ├ Deep Network
 └ Corrupted Zone
```

每區支援：

- encounter；
- resource；
- NPC / recruit；
- secret；
- mini-event；
- boss / gate condition。

目標是「密度」而不是地圖面積。

---

## 7. Capture → Synchronize：保留技術骨架，重做表達

現有 Hunt / capture 幾何、輸入與結果流程可重用；原創產品不應沿用既有 IP 的繩索／捕捉語意與視覺。

產品化方向：

```text
Encounter
 → destabilize / understand
 → synchronization opportunity
 → gesture / timing interaction
 → Resonance Link
 → join / unlock
```

可保留「畫圈／手勢」作為 mechanic primitive，但必須重做：

- 名稱；
- VFX；
- 敘事；
- UI；
- sound；
- success/failure feedback。

---

## 8. Evolution：從數值門檻演進成可理解的 Life History

第一階段仍保留現有 Evolution resolver 與資料驅動條件。

產品化時逐步加入：

- training history；
- bond；
- personality；
- exploration history；
- key story event。

但所有條件必須 data-defined、可追蹤、可測試，不允許 renderer 或文案暗中決定進化。

Evolution Hint 與真正 resolver 必須讀同一份 condition source；提示本身不得改 RNG 或角色狀態。

---

## 9. Hub 重建：用招募解鎖功能，不做大型城市建設

吸收 `Digital Tamers 2` 的低成本高回饋做法：

```text
Explore
 → meet / help NPC
 → invite to Hub
 → unlock function
```

例如：

- Researcher → Evolution Archive；
- Merchant → Shop；
- Trainer → Advanced Training；
- Medic → Recovery；
- Arena NPC → Tournament / Challenge。

這直接掛在既有 Shop / Database / Training / Progression 上，不另做城市模擬器。

---

## 10. 原創 roster 與動畫規模

架構可維持 224+ / 500+ capacity，但內容生產分段：

```text
Pipeline validation: 3 forms
Vertical slice:      15–20 forms
First public build:  30–50 forms
1.0 candidate:       60–100 forms
Expansion:           100–200+
Architecture:        500+
```

不可把「支援 500」誤寫成「首發必須 500」。

### 核心 AnimationProfile

第一版角色只要求共用動作語彙：

- Idle
- Move
- Attack
- Skill
- Hit
- Down
- Eat
- Sleep
- Interact

每組依 morphology 使用 2–6 個 unique poses + timing / reverse / translation / squash-stretch / VFX / procedural motion 補足。

不得要求每隻角色固定 58 張全新獨立圖，也不得逐 frame 獨立 AI 生成。

---

## 11. 視覺方向：明亮生態未來感，不另建 UI 系統

目標氣質：

> **Bright ecological future × companion habitat × restrained soft-tech UI.**

借用的是「明亮、高透光、自然 × 科技、世界優先」的設計原理，不複製任何參考作品的角色、Logo、圖示、文案、版面細節或特有裝飾。

### Environment

- bright botanical habitat；
- glass / water / greenery；
- soft future architecture；
- diorama readability；
- ambient motion > excessive texture detail。

### UI

沿用現有 DOM screen stack，逐步 token 化：

- warm white / pale cyan surfaces；
- navy hierarchy；
- cyan information / interaction；
- gold only for prestige / milestone；
- fewer heavy frames；
- 44px+ touch targets；
- world first, UI second。

禁止為原創版另做第二套 router 或第二套 UI runtime。

---

## 12. 既有架構的原地轉化對照

| Championship 現有 subsystem | Nexus Link 產品化方向 | 做法 |
|---|---|---|
| Raising | Partner Care | 擴充，不替換 |
| Training | Growth | 擴充，不替換 |
| Cage | Habitat-lite | 原地升級 |
| Gate | Region Select | 換 presentation / content |
| Hunt | Exploration | 擴充 encounter / event |
| Capture | Synchronize | 保留 input/sim primitive，重做表達 |
| Team | Active Party | 保留 |
| Battle | Semi-auto Command Battle | 保留 simulation，加 command layer |
| Title / Rank | Arena / Progression | 重新品牌化 |
| Championship | Major Tournament / Story Goal | 重新品牌化 |
| Shop | Hub Merchant | 保留 transaction core |
| Database | Archive | 保留 collection core |
| Save | Canonical Save | 絕不另建 |

---

## 13. 分階段 Gate

### Gate 0 — Current Truth / Baseline Freeze

完成 Championship 現有成果、測試、技術債與 evidence 的確認。禁止因新世界觀打亂 current parity。

### Gate 1 — Championship 2026 Complete

先把現有遊戲真正做完：

```text
New Game
 → Raising
 → Training
 → Evolution
 → Hunt
 → Capture
 → Team
 → Battle
 → Rank / Championship
 → Save
 → Reload / Continue
```

### Gate 1.5 — Productization Seams

只建立：

- content manifest seam；
- theme / design tokens；
- CreatureDefinition / CreatureInstance seam；
- optional locked future nav slot；
- animation profiles；
- original naming/content namespaces。

不得開始第二款遊戲。

### Gate 2 — Original Vertical Slice IN THE SAME APP

使用現有 runtime：

- 3 families / 15–20 forms；
- 1 Habitat-lite；
- 2 regions；
- Synchronize；
- semi-auto command battle；
- short story；
- Hub unlock；
- branch evolution；
- save/reload。

### Gate 3 — Content Factory

證明新增 creature 主要是 data + assets，而非 JS special-case。

### Gate 4 — 1.0 Content Scale / Packaging

逐步擴充到實測可承受的 60–100 forms，完成 desktop packaging / device / performance / save QA。

### Gate 5 — Expansion Only After 1.0 Core Is Stable

候選：cloud、profile、async PvP、friends、more regions、larger roster。

---

## 14. Agent 禁止事項

任何 Codex / Claude / agent 讀到 Nexus Link 或 original product planning 時：

### 禁止

- 建立第二個 app；
- 建立第二個 src tree 作為新遊戲；
- 重寫 Raising / Hunt / Battle，只因命名或美術不同；
- 建立第二套 router；
- 建立第二套 save；
- 建立第二個 Pixi Application；
- 為 Habitat 新建平行 simulation truth；
- 在現有功能可擴充時另造 replacement subsystem；
- 因未來原創產品而破壞 Championship parity tests；
- 把 reference game 的具體表達複製進 shipping content。

### 正確順序

```text
inspect current subsystem
 → identify reusable authority
 → add adapter / data seam only if required
 → extend existing tests
 → preserve baseline
 → replace content/presentation progressively
```

若 agent 認為「必須重寫」，必須先提出：

1. 現有 subsystem 無法承載的具體證據；
2. 最小 migration path；
3. 對 save / tests / content 的成本；
4. 為什麼 adapter / refactor 不足；
5. Owner approval gate。

沒有以上證據，不得以「更乾淨」為理由重做。

---

## 15. 最終產品設計判斷

Nexus Link 不是另一款從零開始的專案，而是：

> **Championship 2026 已驗證遊戲骨架的原創產品化演進。**

保留已花大量時間完成的：

- simulation；
- state；
- save；
- UI shell；
- renderer；
- input；
- raising；
- hunt；
- capture primitive；
- battle；
- progression；
- asset pipeline；
- tests。

真正需要重新創作的是：

- IP／世界觀；
- 名稱；
-角色；
- 美術；
- 音樂／音效；
- 故事；
- UI theme／visual identity；
- 特定產品化功能與平衡。

工程策略是 **evolve in place, not rebuild from scratch**。
