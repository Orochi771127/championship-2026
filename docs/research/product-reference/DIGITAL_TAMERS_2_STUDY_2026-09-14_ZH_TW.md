# 《Digital Tamers 2》／《數碼馴獸師重生2》研究

日期：2026-09-14  
狀態：`RESEARCH_ONLY / HIGH_VALUE_FANGAME_REFERENCE`  
用途：補充 `championship-2026` 的單人／小型團隊可完成性、V-Pet 養成、探索、城市招募、故事、重生、戰鬥介入與大型 roster 工作流研究。

> 本作是同人遊戲，不是 Bandai Namco 官方商業作品。研究價值主要來自「小型開發如何把大量 Digimon 系統整合成一款可完整遊玩的作品」，不能把其 IP 使用方式當成我們未來商業原創版的法律 precedent。

---

## 1. 身分確認

官方 itch.io 頁面名稱是 **Digital Tamers 2**，作者 / 發行頁為 `dragonrod342`。

官方介紹明確寫它是先前同人遊戲 **Digital Tamers: ReBorn** 的續作，並標示：

- Windows / Android；
- GameMaker；
- 2D / Pixel Art / Singleplayer / Virtual Pet；
- Raise / Battle / Evolve；
- 可探索 Digital World；
- 大量 challenges / quests / collectible Digimon；
- 免費下載、可自願付費支持；
- Digimon 相關 IP 屬原權利人，本作為娛樂用途同人遊戲。

中文社群常稱《數碼馴獸師重生2》或「DTRB2」，但官方英文名稱不是 `Digital Tamers: ReBorn 2`，而是 `Digital Tamers 2`。

2026-09 官方頁顯示目前版本已到 v2.0.1。頁面上方文案寫 `600+` 可收集 Digimon，但舊 feature bullet 仍寫 `400+`，代表 exact roster count 有版本 / 頁面更新不同步，不應把單一數字當固定規格。

---

## 2. 為什麼這款對我們特別重要

官方大型商業作品適合研究「成熟產品怎麼做」。

Digital Tamers 2 的價值不同：

> **它更接近我們的現實限制：2D、手機 + PC、GameMaker、小型開發、巨大 roster，卻仍然把養成、探索、故事、城市、招募、戰鬥、重生與長期收集整合在同一款遊戲裡。**

因此它應被視為：

`SOLO_SCALE_INTEGRATION_REFERENCE`

而不是 Habitat 的唯一最佳參考。

---

## 3. 已確認的系統

### 3.1 Raise / Hatch / Evolution

玩家由蛋開始，經孵化、戰鬥、等級、Training 與不同進化條件培養 Digimon。

遊戲甚至提供 Tamer Skill 顯示 evolution requirement，降低完全靠外部攻略的負擔。

**可抽象原理：**

`COMPLEX_EVOLUTION_NEEDS_IN_GAME_EXPLANATION`

分支進化可以複雜，但玩家必須能在遊戲內逐步理解條件，不能把複雜度全部丟給 Wiki。

---

### 3.2 Optional Reborn / lifecycle

玩家開局可以選擇啟用 Reborn 機制；啟用後 Digimon 會有老化 / 死亡 / 重生循環。

社群攻略可確認：

- Reborn Point（RP）；
- 重生時等級與 friendship / hearts 會影響 RP bonus；
- 重生後可用累積成果強化後續養成；
- 城市 NPC 會提供重生相關功能 / 資訊。

**可抽象原理：**

`REBIRTH_CONVERTS_LOSS_INTO_LONG_TERM_PROGRESSION`

若未來原創版保留生命週期，死亡 / 重生不應只是懲罰，而是把一部分人生履歷轉成新世代資產。

---

### 3.3 Hybrid AI / command combat

Digital Tamers 2 不是 Championship 那種完全準備型 auto battle，也不是傳統 turn-based。

實際玩法是：

- Digimon 會自行戰鬥；
- 玩家可下達 melee、ranged、jump/dodge、block、special 等直接命令。

這是一個重要中間解：

```text
AI autonomy
+
limited high-value intervention
```

**可抽象原理：**

`AUTO_BATTLE_CAN_ALLOW_SPARSE_PLAYER_INTERVENTION`

對我們而言，不代表要把 Championship battle 改成 action game；而是可以考慮後期 modern mode 中，玩家只在少數高價值時機介入，而不是每秒操作。

---

### 3.4 Exploration + map progression

官方介紹明確把 richer map exploration 當核心賣點；攻略顯示世界由多張區域地圖逐步解鎖，包括 Village of Beginnings、Log-in Village、Server City、各 biome、Dark Area、D-Dungeon 等。

這不是無縫 open world，而是：

`many compact authored zones + progression gates`

**可抽象原理：**

`SMALL_ZONES_CAN_CREATE_A_LARGE_WORLD`

這對單人開發非常重要：不需要做 Palworld 規模的大地圖，也可以透過大量小區域、路線、事件與回訪建立世界感。

---

### 3.5 Story + quests

本作不是只有戰鬥沙盒。

官方更新紀錄確認：

- 多段 Main Story；
- 2025 v1.0.5 加入 Main Story Part 2；
- 2026 v1.1.4 加入 Main Story Part 3 / final chapter；
- v2.0 增加 Quest Log；
- 大量 NPC、支線、地城與 unlock quest。

**可抽象原理：**

`STORY_CAN_BE_BUILT_AS_PROGRESSIVE_QUEST_LAYERS`

不需要先製作一條電影級大型主線；可以先用 world event + recruitment quest + city progression 組成故事骨架，再逐章擴寫。

---

### 3.6 Recruitment changes Village / Server City

這部分對我們非常有價值。

攻略可確認：

- 玩家先解鎖 Log-in Village；
- 招募不同 NPC 進村，會開店或提供功能；
- 主線後解鎖被破壞的 Server City；
- 後續需要繼續尋找 Digimon NPC 回城；
- 部分 NPC 會開商店、製作 Mod、提供升級、解鎖地城 / 服務；
- 城市居民數量本身也是某些系統的 unlock 條件；
- 建築 / 店舖可用材料與費用升級，影響商品或服務速度。

這和 Digimon World / Next Order 的城市重建精神一致，但以更省成本的 2D 形式實作。

**可抽象原理：**

`RECRUITMENT_EXPANDS_FUNCTIONAL_HOME`

對我們的 Habitat：新居民不一定只是多一隻可養 creature，也可以改變：

- 可用設施；
- 任務；
- Expedition；
- crafting；
- world access；
- story state。

---

### 3.7 Gathering / services / expeditions

公開攻略與更新紀錄可確認存在：

- gathering spots；
- fishing / water search；
- lumber / quarry 等資源服務；
- expedition；
- 商店 / 生產服務升級後可縮短某些工作時間；
- Snimon expedition 曾在 patch note 中有 bug fix，證明 expedition 是實際系統，而非純社群構想。

**可抽象原理：**

`WORLD_ACTIVITIES_FEED_HOME_PROGRESSION`

探索取得材料 -> 修復 / 升級 home -> home 反過來改善探索 / 養成。

這是一個完整閉環，但我們應避免把它變成高 grind 材料牆。

---

### 3.8 Day / Night accessibility

v2.0 新增可招募 Clockmon，讓玩家主動把 day 切 night、night 切 day；官方明確說這是為了讓無法在特定現實時段遊玩的玩家也能體驗全部內容。

**可抽象原理：**

`REAL_TIME_FLAVOR_NEEDS_PLAYER_ESCAPE_HATCH`

如果 Championship modern mode 使用真實日期 / 時段，不應讓夜班、時區或生活作息成為內容鎖。要保留世界節奏，也要提供合理的玩家控制 / 補救。

---

### 3.9 Adventure Mode（v2.0）

2026 v2.0 加入 Roguelike Adventure Mode：

- 使用 Rental Partners；
- 連續挑戰大量敵人；
- 最終可保留 rental Digimon 的部分 training 成果，或取得 Leader Cartridges；
- unlock 綁定主線與 Server City 居民進度。

這證明既有 raising / combat engine 可以後期重組成額外 mode，而不需要第二套核心戰鬥系統。

**可抽象原理：**

`NEW_MODES_SHOULD_RECOMBINE_EXISTING_SYSTEMS`

未來 Championship 2026 若增加 roguelike / event mode，應重用 Creature / Battle / Reward primitive，而不是另寫一款遊戲。

---

## 4. 最值得我們學的不是功能，而是「成本控制」

Digital Tamers 2 對我們最有價值的地方之一是：它證明**不需要 3D AAA 規模也能提供巨大內容量**。

它採：

- 2D pixel sprites；
- compact maps；
- reusable systems；
- NPC recruitment；
- data-driven evolution / roster；
- 系統式 battle / challenge；
- story / quest 逐更新擴展。

對 200–500+ forms 的原創產品，比「每一隻都有高成本獨立動畫與故事」更接近可持續方案。

建議新增 pattern：

`CONTENT_SCALE_COMES_FROM_SYSTEM_REUSE`

---

## 5. 它的明顯缺點也要研究

社群回饋反覆提到：

- 後期 grind 偏重；
- 部分 unlock / quest 條件不透明；
- material requirements 可能拖慢城市建設；
- evolution progression 早期容易依賴攻略；
- 小型作品可透過大量系統得到深度，但也容易累積「知道怎麼玩的人才順」的 onboarding 問題。

因此我們不應照搬：

```text
large roster
+ many conditions
+ many materials
= depth
```

我們應做：

```text
large systemic space
+ readable goals
+ transparent progress
+ optional depth
```

---

## 6. 對 Championship 2026 的直接整合建議

Digital Tamers 2 不應新增一套獨立 subsystem。

其優點映射到既有產品底層：

```text
DT2 hatch / raise / reborn
  -> CreatureInstance + LifeHistory

DT2 map exploration
  -> Hunt / Story Region

DT2 recruitment / village / city
  -> Habitat / Home progression

DT2 shops / building upgrades
  -> Habitat facility affordances

DT2 player commands during AI battle
  -> future Battle intervention layer

DT2 quests / story chapters
  -> LifeEvent / WorldState

DT2 expedition / gathering
  -> Expedition + Resource + Memory

DT2 day/night toggle
  -> Calendar accessibility policy
```

---

## 7. 與目前參考作品的定位

| 來源 | 最適合研究的問題 |
|---|---|
| Championship | Game spine / Hunt / Capture / Auto Battle / Calendar |
| Dawn / Dusk | Farm objects / terrain / resident capacity |
| New Century | Home layout / resident-building interaction / production loop |
| Next Order | Bond / AI battle / recruitment changes city |
| ReArise | visible residents / care / mood |
| **Digital Tamers 2** | **小型開發如何把 raising + world + story + city + huge roster + battle 做完整** |

Digital Tamers 2 因此不是「官方產品成功證據」，而是更接近我們開發現實的**完成性參考**。

---

## 8. 對目前 Experiment Pack 的新影響

### Experiment 1 — Animation Cost Audit

新增一個研究問題：

> Digital Tamers 2 如何在大 roster 下控制 2D animation / move presentation 成本？

這值得後續以影片 / 實玩觀察其 sprite action vocabulary，但目前不需要逆向其程式或資產。

### Experiment 2 — Habitat Life Simulation

DT2 的核心 home 優勢不是 resident free-life，而是 recruitment 讓 home 擴張。因此 Habitat prototype 應預留：

```text
resident life
+
service NPC / facility progression
```

但兩者應共享同一個 Habitat，而不是兩個基地畫面。

### Experiment 3 — Original Family Factory

DT2 強化「2D 可以支撐巨大 roster」這條假設，因此全 roster 預設仍以 2D / hybrid 為優先，而不是全面 full 3D。

### Experiment 4 — Cage 3D Spike

不因發現 DT2 就改成全 3D；反而應比較：

- 2D 高品質場景；
- 2.5D；
- bounded 3D Habitat。

選擇應看「生活感 / 編輯性 / 製作成本」，不是單純哪個最立體。

---

## 9. 來源

A / 作者來源：

- Digital Tamers 2 itch.io 官方頁  
  https://dragonrod342.itch.io/digital-tamers-2
- v2.0.0 Anniversary Update  
  https://dragonrod342.itch.io/digital-tamers-2/devlog/1649260/anniversary-update-v200-is-now-available
- v1.0.5 Main Story Part 2  
  https://dragonrod342.itch.io/digital-tamers-2/devlog/900474/huge-update-v105-is-now-available
- v1.1.4 Main Story Part 3  
  https://dragonrod342.itch.io/digital-tamers-2/devlog/1386012/part-3-of-the-story-a-good-friend-is-now-available-update-v114
- v1.0.9 patch（Snimon expedition bug fix）  
  https://dragonrod342.itch.io/digital-tamers-2/devlog/974942/mini-update-109-is-now-available

B / 社群攻略交叉驗證：

- 巴哈姆特 Digital Tamers 2 完整攻略  
  https://forum.gamer.com.tw/C.php?bsn=7255&snA=9749
- 巴哈姆特攻略精華  
  https://forum.gamer.com.tw/G2.php?bsn=7255&sn=710

使用者提供線索：

- Bilibili `BV16Zt36gEga` — 使用者辨識為《數碼馴獸師重生2》相關影片；目前 web retrieval 無法可靠讀取該 BV metadata，因此本研究不以該影片本身支撐功能主張。
