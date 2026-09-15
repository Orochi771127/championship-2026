# Digimon 系列玩法優點整合研究 — Championship 2026

日期：2026-09-14  
狀態：`RESEARCH_ONLY / OWNER_REVIEW_REQUIRED`  
用途：供 `championship-2026` 後續產品規劃、Habitat、Creature Life History、Story、Battle、Evolution 與現代化方向使用。  

> 本文件是外部產品研究，不是 runtime 實作授權，也不覆蓋 parity baseline、`CURRENT_PRODUCT_STATUS.md` 或任何既有 contract。

---

## 0. 執行摘要

這次研究最重要的結論不是「再加很多系統」，而是：

> **你目前想做的主要玩法，其實已經分散存在於歷代 Digimon 遊戲中；真正有價值的是把它們抽象成同一套底層，而不是把每款遊戲各做一套。**

最值得吸收的來源可以縮成：

| 作品 / 系列 | 最值得借的設計原理 | 不應直接搬的東西 |
|---|---|---|
| Digimon World | 夥伴人生、照顧、生命週期、招募會永久改變 File City | 隱晦到需要攻略的條件、過度懲罰 |
| Re:Digitize / Decode | V-Pet 養成與故事、Coliseum、城市服務的現代化結合 | 另一套獨立遊戲模式 |
| World Championship | Cage、Training、Hunt、Capture、Calendar、Auto Battle、Title / Championship | 原作美術、品牌、專有表達 |
| World DS / Dawn / Dusk | DigiFarm、Terrain、BGM、Farm Goods、Talk、Training、Live Event、日報 | 單純被動數值 farm |
| Lost Evolution | Dig-Farm Jobs、探索派遣、裝備產出 | timer -> loot 的純放置化 |
| Cyber Sleuth / Hacker’s Memory | 大 roster、DigiFarm、Train / Develop / Investigate、Personality 影響結果 | 另一套完整回合制 battle |
| Next Order | 雙夥伴、Bond 影響 Battle、AI battle、招募與 Floatia 成長 | 大型 3D 世界規模 |
| Survive | Choice / Affinity / Story 對 Evolution 與結局產生長期後果 | 另做大型 VN / SRPG 模式 |
| Digimon Links | Farm 作為 base、設施直接影響訓練 / Battle、3v3 | 手遊營運 / gacha 結構 |
| Digimon ReArise | DigiTown 可見居民、Care、Mood、Bond、request、角色互動 | gacha、EOS 依賴 |
| Time Stranger | 450+ roster、Personality、Bond、DigiFarm、自主訓練、非線性進化 | 不需要照搬回合制 RPG |
| DIGIMON UP | 手機餵養、訓練、進化、Battle 的產品語言 | idle-heavy、loot box / paid random item 核心化 |

### 最終不應做成 12 個系統

建議收斂成 5 個共同底層：

```text
CreatureDefinition
      +
CreatureInstance
      ↓
Habitat / Affordance / Utility AI
      ↓
LifeEvent / Memory / Relationship
      ↓
Evolution Resolver
      ↓
Battle Build / Story Consequence / Expedition
```

同一份 `CreatureInstance` 同時服務 Raising、Habitat、Expedition、Story、Evolution、Battle。

---

# 1. 研究方法

不是把所有 Digimon 遊戲逐款完整考古；而是針對 Championship 2026 現在真正需要的產品問題，找最成熟的歷代解法：

1. 怪獸怎麼看起來真的在生活？
2. 棲地怎麼不只是 Box？
3. Personality / Bond / 照顧怎麼影響長期成長？
4. 分支進化怎麼有「人生」感，而不是單純 skill tree？
5. 探索、工作、派遣怎麼跟養成互相回饋？
6. Auto Battle 怎麼保留玩家策略？
7. 故事怎麼影響夥伴與世界，而不是獨立 VN？
8. 大 roster 與手機長期玩法怎麼控制內容成本？

證據優先級：

- `A`：Bandai Namco 官方網站、官方 patch notes、官方 manual。
- `B`：可交叉驗證的遊戲 guide / archived store description。
- `C`：社群 / Reddit，僅用於玩家感受、抱怨與需求訊號，不拿來當公式證據。

---

# 2. 逐作品優點拆解

## 2.1 Digimon World（PS1）

### 已驗證重點

- File City 透過招募 Digimon 累積 Prosperity。
- 不同招募角色會實際新增或改善城市功能，例如 Arena、商店、倉庫、道路與其他服務。
- 玩家不是只把「收集」轉成圖鑑數字，而是探索與招募會讓 home space 變得更完整。

### 可抽象的設計原理

> `COLLECTION_CHANGES_HOME`

**收集行為應改變玩家每天看得到、用得到的生活空間。**

### 對 Championship 2026 的轉化

Capture / Contract 新幻獸後，不一定只增加 roster；可以：

- 解鎖 Habitat affordance；
- 新增工作 / 服務；
- 觸發居民事件；
- 改變場景裝飾與生活密度；
- 讓玩家「回家就看得到進展」。

### 不建議照搬

- 極度隱晦、只能查攻略的 evolution / recruitment gate；
- 玩家無法理解的高懲罰照顧錯誤。

來源：
- https://gamefaqs.gamespot.com/ps/913684-digimon-world/faqs/73895

---

## 2.2 Digimon World Re:Digitize / Decode

### 最值得借的

這一系延續 Digimon World 的 V-Pet / lifecycle，並把城市服務、Training、Coliseum、事件與 story 包在較現代的 RPG flow 裡。

### 可抽象的設計原理

> `BATTLE_VALIDATES_RAISING`

**競技終局是養成成果的出口，不是另外一款遊戲。**

### 對 Championship 2026 的轉化

Arena / Championship 不應持有第二套角色：

```text
CreatureInstance
  -> BattleBuildAdapter
  -> BattleCreatureSnapshot
```

Battle snapshot 只是一場比賽的不可變投影，真正 owner 仍是 CreatureInstance。

---

## 2.3 Digimon World Championship

這是現有 repo 已投入最多 evidence / implementation 的骨架，不需要因研究其他作品而重做。

### 最值得保留的 spine

- Raising / Care / Training
- Cage
- Calendar
- Gate / Hunt / Loadout
- Capture / Result
- 3-creature team
- Auto Battle
- Title / Rank / Championship
- Shop / Database
- Save / Continue

### 本研究的判斷

> **World Championship 應繼續當 Game Spine / Reference Implementation；其他作品的優點加到 spine 上，而不是另做 Next Order mode、Survive mode 或 Cyber Sleuth mode。**

---

## 2.4 Digimon World DS / Dawn / Dusk

這組作品對 Habitat 特別重要，因為 Farm Island 已經包含「住人、時間、物件、訓練、環境影響」的雛形。

### Farm Island 已有的成熟要素

Dawn / Dusk guide 可確認：

- 多隻 Digimon 可居住在 Farm Island；
- Farm 以 day 推進；
- 有 report，包含 growth、Live Event、食物消耗與 fullness；
- 可 Talk；
- 可使用 Training Pen；
- Terrain Board 影響每日 species EXP；
- BGM Board 影響不同 species 的成長率；
- Farm Goods 可放在島上，Digimon 可與其互動；
- Farm Goods 本身有 rank、effect、capacity cost；
- Farm 可擴 DPU（居民容量）與 memory（goods 容量）。

### 可抽象的設計原理

> `HABITAT_OBJECT_HAS_FUNCTION`

家具 / 地形不是裝飾；每個物件至少應有：

```text
visual
+ affordance
+ capacity
+ growth / mood / skill consequence
```

例如：

```text
Pond
  affords: DRINK, PLAY_WATER, COOL_DOWN
  tags: WATER, SOCIAL
```

### 對我們的升級

舊 Farm 主要是 stat/growth 系統；新版 Habitat 應再加入：

- needs
- preference
- relationship
- memory
- routine
- actual navigation

來源：
- https://gamefaqs.gamespot.com/ds/937345-digimon-world-dawn/faqs/80295

---

## 2.5 Digimon Story: Lost Evolution

這次研究最值得注意的發現之一：**「出去工作 / 探索，回來帶東西」其實 Digimon Story 已經做過。**

### Dig-Farm Jobs

Guide 可確認：

- 特定 Farm Goods 可讓 Farm Digimon 去工作；
- 工作可製作 Equipment；
- 工作本身也會增加某些 stats。

### Dig-Farm Explorations

Guide 可確認：

- 最多多隻 Digimon 可送出探索；
- 一個 Farm day 後返回；
- 有機率帶回 item；
- 結果受 Evolution Stage 與 level 影響。

### 可抽象的設計原理

> `OFFLINE_PROGRESS_IS_CHARACTER_ACTION`

離線進展不是帳號自己加資源，而是**某一隻個體做了某件事**。

### 對我們的升級

```text
Personality
+ Skill
+ Affinity
+ Relationship
+ Habitat History
+ Destination
      ↓
Expedition
      ↓
Resource + LifeEvent + Memory
```

不要退化成：

```text
3 hours -> 500 gold
```

來源：
- https://gamefaqs.gamespot.com/ds/980253/digimon-story-lost-evolution/faqs/78408/jobs
- https://gamefaqs.gamespot.com/ds/980253/digimon-story-lost-evolution/faqs/78408/explorations

---

## 2.6 Cyber Sleuth / Hacker’s Memory

### 最值得借的

Cyber Sleuth 系列證明大型 roster 可以透過 data-driven 系統參與，而不需要每一隻都有獨立 story arc。

DigiFarm 的主要價值在於：

- Train
- Develop
- Investigate
- Leader / Personality 對結果有影響
- Farm Goods 改善 farm outcome

### 可抽象的設計原理

> `PERSONALITY_HAS_MECHANICAL_EFFECT`

Personality 不能只改一句台詞。

建議同一套 personality vector 影響：

```text
Habitat action score
Expedition outcome
Battle AI preference
stat growth bias
Evolution weight
```

### 對大型 roster 的啟示

- 主線只需要核心 cast；
- 其餘 creature 透過 systemic participation 加入；
- 不必為 200–500 forms 各寫一條劇情。

來源：
- https://www.bandainamcoent.com/games/digimon-story-cyber-sleuth-complete-edition
- https://www.bandainamcoent.com/games/digimon-story-cyber-sleuth-hackers-memory

---

## 2.7 Digimon World: Next Order

Bandai Namco 官方明確列出：

- 超過 200 Digimon；
- 兩隻夥伴同時探索；
- Feed / Train / Discipline / Digivolve；
- 玩家與夥伴、兩隻夥伴之間的 Bond 影響 Battle；
- 招募 Digimon；
- Floatia 擴張 / 建築升級；
- AI battle，玩家以 commands / cheering 介入。

### 可抽象的兩個原理

> `RELATIONSHIP_AFFECTS_OUTCOME`

Bond 必須回饋到戰鬥或其他真正結果。

> `RECRUITMENT_CHANGES_WORLD`

玩家帶回來的居民要改變 home/world，而不是只加 roster。

### 對 Championship 2026 的轉化

```text
Habitat Life
   ↓
Bond / Trust / Relationship
   ↓
Battle AI / Cooperation
   ↓
Battle Result
   ↓
Memory
   ↓
Future Habitat Behavior / Evolution
```

來源：
- https://www.bandainamcoent.com/games/digimon-world-next-order

---

## 2.8 Digimon Survive

Bandai Namco 官方確認：

- 玩家 choices 會影響夥伴 evolution；
- choices 會影響 final ending；
- story / friendship / survival 是主體；
- Battle 為 2D SRPG。

### 可抽象的設計原理

> `STORY_DECISION_BECOMES_LIFE_EVENT`

不要只做 branching dialogue。

例如：

```text
LifeEvent {
  type: PLAYER_PROTECTED_CREATURE,
  actorId,
  targetId,
  valence,
  importance,
  timestamp,
  tags
}
```

同一事件可同時影響：

- Trust
- future reaction
- Story branch
- Evolution weight
- Battle behavior

### 不建議照搬

不要另開一個大型 Visual Novel runtime 或 SRPG mode。

來源：
- https://en.bandainamcoent.eu/digimon/digimon-survive

---

## 2.9 Digimon Links

當年官方商店描述（由 Gematsu 保存）將 Farm 定義為：

- Digimon 居住的地方；
- 可建多種 facilities；
- 有 training facilities；
- 有會提供 Battle advantage 的 buildings；
- Farm 是玩家處理 Digital World 異變時的 base；
- 另有 3v3 battle 與 online co-op。

### 可抽象的設計原理

> `HOME_IS_OPERATIONAL_BASE`

Habitat 不是裝飾 lobby，而是玩家所有長期活動的 home base。

來源：
- https://www.gematsu.com/2017/09/digimon-links-first-english-trailer

---

## 2.10 Digimon ReArise

商店描述與保存資料可確認：

- 自訂 DigiTown；
- Digimon 會 interact / play together；
- 可以照顧與 train；
- Digimon 有 request；
- Care 會改善 Mood / Bond；
- Bond 影響 Digivolution；
- Mood 影響 Battle / reward；
- DigiTown / Playground 會讓多隻 Digimon 在 home screen 走動。

### 可抽象的設計原理

> `OWNED_CREATURES_SHOULD_BE_VISIBLE`

玩家擁有的角色要真的出現在生活空間裡，而不是只存在 roster menu。

### 我們必須做得比 ReArise 深的地方

不要只用 random roaming + speech bubble。

應使用：

```text
Need
+ Preference
+ Relationship
+ Habitat Affordance
        ↓
Utility Score
        ↓
Action
```

來源：
- https://www.gematsu.com/2019/08/digimon-rearise-coming-west-in-2019
- https://digimonrearise.fandom.com/wiki/Basic_Information
- https://digimonrearise.fandom.com/wiki/Care_Items

---

## 2.11 Digimon Story Time Stranger

這是目前最值得作為「現代大型 roster」benchmark 的官方 Digimon RPG。

Bandai Namco 官方目前確認：

- 450+ Digimon；
- Personality 會改變 level-up stat growth；
- Personality 也會影響 Digivolution path；
- DigiFarm 中 Digimon 可自行 train / grow；
- 餵食可提高 Bond；
- Bond 在 2025 patch 中被進一步提高 Battle 影響，包括 Extra Strike、Critical Rate、Drop Rate；
- 2026 patch 新增在 DigiFarm 直接查看 Digivolution Conditions；
- 遊戲在原 PS5 / Xbox / PC 版本超過 1M units sold，再於 2026 登上 Switch / Switch 2。

### 可抽象的設計原理

> `PERSONALITY_IS_PROGRESSION_INPUT`

Personality 應真的進入成長與進化。

> `BOND_IS_CROSS_SYSTEM_STAT`

Bond 不應只是一條 affection bar，而應跨系統有可感知影響。

> `LARGE_ROSTER_NEEDS_DATA_DRIVEN_GROWTH`

450+ roster 能成立，不代表每一隻都有昂貴獨立內容；必須靠共享規則與 data-driven progression。

來源：
- https://www.bandainamcoent.com/news/digimon-story-time-stranger-what-you-need-to-know
- https://www.bandainamcoent.com/news/digimon-story-time-stranger-patch-notes-october-10-2025
- https://www.bandainamcoent.com/news/digimon-story-time-stranger-free-update-patch-notes-july-2026
- https://www.bandainamcoent.com/news/digimon-story-time-stranger-puts-the-fate-of-two-worlds-in-nintendo-switch-players-hands-on-july-10

---

## 2.12 DIGIMON UP

官方目前定位：

- Digimon Idle Raising RPG；
- Feed；
- Train；
- Digivolve；
- Raise and Battle；
- Free-to-play，含 paid items 與 loot boxes。

### 可抽象的設計原理

> 手機短 session 中，「看狀態 -> 照顧 -> 成長 -> Battle」仍是清楚易懂的產品語言。

### 不建議採用

- 核心進度依賴 gacha / loot box；
- 把所有互動壓成 idle；
- 把「夥伴生活」退化為數值領取。

來源：
- https://dgup.bn-ent.net/en/

---

# 3. Feature Reference Matrix

| 產品問題 | World / Re:Digitize | Championship | Dawn / Dusk / Lost Evolution | Cyber Sleuth | Next Order | Survive | Links / ReArise | Time Stranger | UP | Championship 2026 建議 |
|---|---|---|---|---|---|---|---|---|---|---|
| 日常養成 | 強 | 強 | 中 | 中 | 強 | 弱 | 中 | 中 | 強 | 保留 Raising，擴 Habitat |
| 多居民棲地 | 弱 | Cage | 強 | Farm | 城鎮型 | 無 | 強 | Farm | 弱 | Habitat 成為中心 |
| 自主生活 | V-Pet 狀態 | 基礎 AI | Live Events / Farm | Farm | 夥伴跟隨 | 無 | roaming / interaction | auto train | idle | Utility AI |
| Bond / Relationship | 強 | 弱 | Friendship | 中 | 強 | Affinity | 強 | 強 | 基礎 | Bond + Trust + Relation |
| Personality | 隱性 | 原數值 | 種族 / farm bias | Leader personality | 個體差異 | narrative | 個體 / mood | 明確機制 | 弱 | 一套 personality vector |
| 分支進化 | 強 | 原作 evolution | Digivolution | 強 | 強 | Choice-driven | 多為固定線 | 非線性 + personality | 有 | Life History resolver |
| 工作 | 無 | Training | 有 | Develop | 城市居民 | 無 | 設施 | Farm training | idle | Work affordance |
| 派遣探索 | 外出探索本人 | Hunt | Lost Evolution 有 | Investigate | world explore | story explore | mobile stage | world RPG | idle | Expedition + LifeEvent |
| Capture / Recruit | 招募 | 強 | scan / recruit | scan | recruit | battle recruit | gacha-heavy | tame | collect | Championship Capture |
| Auto / AI Battle | semi-auto | 強 | turn-based | turn-based | 強 | SRPG | mixed | turn-based | auto | Championship core |
| Story | 中 | 弱 | quests | 強 | 中 | 強 | ReArise 強 | 強 | 輕 | 用 LifeEvent 接系統 |
| Home 成長 | File City | Cage | Farm upgrade | Farm goods | Floatia | 無 | Farm / DigiTown | Farm | 弱 | Habitat progression |
| 手機短 session | 否 | 適合改 | DS 可借 | 否 | 否 | 否 | 強 | 否 | 強 | Web/mobile 30s–10m |

---

# 4. 真正應該整合成什麼

## 4.1 三根產品支柱

### LIVE — 牠真的在生活

- Needs
- Habitat
- Affordances
- Routine
- Social relationship
- Memory / LifeEvent
- Offline / expedition

### GROW — 牠真的因為你的養法變得不同

- Personality
- Bond / Trust
- Training
- Skill history
- Story consequence
- Branch Evolution

### PROVE — 養成成果有地方被驗證

- Hunt
- Capture
- Story challenge
- Auto Battle
- Championship
- 後期 Async PvP

任何新 feature 如果不強化至少一根支柱，預設不進主線 scope。

---

# 5. Habitat 應如何整合歷代 Farm / Cage 優點

## 5.1 Habitat 不是美術場景，而是可查詢的生活空間

每個物件應有：

```text
HabitatObjectDefinition {
  objectId,
  tags,
  footprint,
  capacity,
  affordances[],
  modifiers[],
  interactionPoints[],
  animationHooks[]
}
```

例如：

```text
Bed
  SLEEP
  REST

Pond
  DRINK
  PLAY_WATER
  COOL_DOWN

Tree
  FORAGE
  SHADE
  CLIMB

TrainingRig
  TRAIN

Workbench
  RESEARCH
  CRAFT
```

這同時吸收：

- Championship Cage functional terrain；
- Dawn / Dusk Farm Goods；
- Links facilities；
- ReArise visible DigiTown residents。

---

## 5.2 生活 AI 應先用 Utility AI，不先用 LLM

每隻 creature 維護：

```text
Needs
Personality
Preferences
Relationships
Memories
Skills
CurrentGoal
```

每次 decision tick 對 Habitat affordance 評分：

```text
Eat food       0.88
Play with A    0.62
Sleep          0.31
Train          0.22
Observe pond   0.19
```

選擇高分行為，但保留小量 personality / novelty noise，避免所有角色像機器。

### 第一版生活行為只需 12 個

- Wander
- Idle / Observe
- Eat
- Drink
- Rest
- Sleep
- Play
- Player Interaction
- Creature Interaction
- Train
- Work
- Inspect / Explore

重點不是 100 種動畫，而是「為什麼現在做這件事」。

---

# 6. CreatureInstance：整個整合的核心

建議正式區分：

```text
CreatureDefinition
```

與：

```text
CreatureInstance
```

### Definition

```text
formId
familyId
stage
baseStats
movePool
morphology
animationProfile
workAffinities
habitatAffinities
evolutionGraph
```

### Instance

```text
instanceId
formId
bornAt
age
condition
personality
bond
trust
mood
preferences
relationships
memories
evolutionHistory
battleHistory
workHistory
explorationHistory
```

這一刀可以同時吸收 Next Order、ReArise、Time Stranger、Survive 的優點，而不用新增四套角色狀態。

---

# 7. Evolution 應變成 Life History Resolver

不只：

```text
Level 20 -> Form B
```

而是：

```text
Genetic / family possibility
+ Personality
+ Habitat history
+ Training
+ Battle history
+ Bond / Trust
+ Story LifeEvents
+ Exploration / Work history
      ↓
Evolution weights
```

例如：

```text
Forest memories high
+ Curious
+ Exploration high
+ Bond high
    -> Forest Guardian weight +
```

```text
Arena history high
+ Aggressive
+ Strength training high
+ defeat/recovery life event
    -> War Beast weight +
```

這是 Championship 原本 evolution + Survive choice + Time Stranger personality + Nexus-style memory 的單一整合點。

---

# 8. Battle 應保留 Championship，而不是重做

現有 repo 已投入大量 Battle reverse / runtime 工作，因此：

### 保留

- battle simulation
- 3-member party
- action selection
- damage / status / TP
- AI battle
- move vocabulary
- result / title / championship progression

### 新增的不是「另一套 Battle」

只要：

```text
CreatureInstance
   ↓
BattleBuildAdapter
   ↓
BattleCreatureSnapshot
```

Personality / Bond / condition / history 可以有限度影響：

- AI preference
- cooperation
- risk tolerance
- support tendency
- combo / extra reaction

但不要讓 Battle 直接讀 Habitat object 或 story UI。

---

# 9. Story 應避免成為另一款遊戲

Story 只要產生標準 LifeEvent：

```text
PLAYER_HELPED_WHEN_SICK
PLAYER_ABANDONED_REQUEST
CREATURE_WON_FIRST_TITLE
CREATURE_LOST_CLOSE_FIGHT
FOUND_RARE_SIGNAL
TRAVELED_WITH_FRIEND
```

LifeEvent 再由不同 system 消費：

```text
Relationship
Evolution
Dialogue / reaction
Battle AI
Habitat behavior
World state
```

如此可以借 Survive 的「選擇有後果」，又不增加一個獨立 VN simulation。

---

# 10. Long-term / Online 的正確順序

研究 Digimon Links / ReArise / UP 的 EOS 與 live-service依賴後，建議保持現行 repo 的 offline-first 方向。

```text
Reliable local Save
  -> PWA
  -> optional account / cloud save
  -> friend profile / habitat visit
  -> async battle
  -> leaderboard / season
  -> trade
  -> live PvP only if later justified
```

核心 campaign、Habitat、Raising、Battle 不應依賴 server 才能存在。

---

# 11. 首個原創 Vertical Slice

不要先做 200–500 forms。

第一個真正產品化驗證：

```text
3 base families
15–20 total forms
1 Habitat
6–8 Habitat object types
12 core life behaviors
2 Hunt regions
1 complete Capture flow
20–30 original move definitions
3v3 Auto Battle
3 tournament tiers
1 small story arc with 3 meaningful LifeEvents
Branch Evolution
Save / close / Continue
```

驗收問題：

> 玩家能不能在不知道數值表的情況下，說出三隻同種 / 相近幻獸的個性與生活差異？

如果只能說「A 攻擊 31、B 攻擊 28」，Creature Life 系統沒有成立。

---

# 12. 三個互相矛盾但都成立的觀點

### A. 應該盡量借歷代 Digimon 成功設計

因為這能避免單人開發者重新發明 25 年已驗證的怪獸養成語法。

### B. 不應該做「歷代 Digimon 大全遊戲」

因為每多搬一個完整 system，就會把 scope 推向 AAA / live-service 規模。

### C. 最適合的是「抽出設計原理，再重新組成一套共同模型」

這是本報告採用的立場。

---

# 13. 最大盲點與最壞情況

最大盲點不是 IP，而是 **Feature Soup**。

最壞情況：

- World 的 V-Pet；
- Next Order 的城鎮；
- Survive 的 story；
- Cyber Sleuth 的 RPG；
- ReArise 的 DigiTown；
- Championship 的 Battle；
- Palworld 的 work；

全部各自實作，最後變成七款各完成 50% 的遊戲。

因此任何新研究結論都必須先問：

> **能不能由既有 CreatureInstance / Habitat / LifeEvent / Evolution / Battle 其中一個 owner 吸收？**

若不能，預設不進 P0/P1。

---

# 14. 建議產品一句話

> **一款讓大量幻獸真正住在玩家棲地中生活，與玩家及彼此建立關係、經歷故事、探索世界，並因自己的生活歷史形成不同進化與戰鬥方式的長期夥伴養成遊戲。**

Championship 提供最重要的 Raise / Hunt / Capture / Battle / Progression spine；歷代 Digimon 作品提供的是「如何把這根 spine 變成有生命的完整產品」。

---

# 15. Sources

## 官方 / primary

- Digimon World: Next Order — Bandai Namco  
  https://www.bandainamcoent.com/games/digimon-world-next-order
- Digimon Survive — Bandai Namco  
  https://en.bandainamcoent.eu/digimon/digimon-survive
- Digimon Story Cyber Sleuth Complete Edition — Bandai Namco  
  https://www.bandainamcoent.com/games/digimon-story-cyber-sleuth-complete-edition
- Digimon Story Cyber Sleuth Hacker’s Memory — Bandai Namco  
  https://www.bandainamcoent.com/games/digimon-story-cyber-sleuth-hackers-memory
- Digimon Story Time Stranger — Bandai Namco  
  https://www.bandainamcoent.com/games/digimon-story-time-stranger
- Time Stranger — What You Need to Know  
  https://www.bandainamcoent.com/news/digimon-story-time-stranger-what-you-need-to-know
- Time Stranger Bond patch 2025-10-10  
  https://www.bandainamcoent.com/news/digimon-story-time-stranger-patch-notes-october-10-2025
- Time Stranger July 2026 update  
  https://www.bandainamcoent.com/news/digimon-story-time-stranger-free-update-patch-notes-july-2026
- Time Stranger Switch release / 450+ / 1M units  
  https://www.bandainamcoent.com/news/digimon-story-time-stranger-puts-the-fate-of-two-worlds-in-nintendo-switch-players-hands-on-july-10
- DIGIMON UP official  
  https://dgup.bn-ent.net/en/

## Secondary / preserved system evidence

- Digimon World recruitment / File City  
  https://gamefaqs.gamespot.com/ps/913684-digimon-world/faqs/73895
- Digimon World Dawn Farm Island  
  https://gamefaqs.gamespot.com/ds/937345-digimon-world-dawn/faqs/80295
- Lost Evolution Jobs  
  https://gamefaqs.gamespot.com/ds/980253/digimon-story-lost-evolution/faqs/78408/jobs
- Lost Evolution Explorations  
  https://gamefaqs.gamespot.com/ds/980253/digimon-story-lost-evolution/faqs/78408/explorations
- Digimon Links archived product description  
  https://www.gematsu.com/2017/09/digimon-links-first-english-trailer
- Digimon ReArise archived product description  
  https://www.gematsu.com/2019/08/digimon-rearise-coming-west-in-2019
- ReArise Care / DigiTown preserved docs  
  https://digimonrearise.fandom.com/wiki/Basic_Information  
  https://digimonrearise.fandom.com/wiki/Care_Items
