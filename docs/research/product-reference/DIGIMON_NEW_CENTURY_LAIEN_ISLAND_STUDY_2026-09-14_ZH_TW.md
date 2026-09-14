# 《數碼寶貝：新世紀》萊恩島 Habitat 研究

日期：2026-09-14  
狀態：`RESEARCH_ONLY / HIGH_PRIORITY_HABITAT_REFERENCE`  
用途：補充 `championship-2026` 的 Habitat、Resident AI、派遣、建築、生活互動與長期家園循環研究。

> 本文件研究的是設計原理，不是 runtime 實作授權。不得直接複製《數碼寶貝：新世紀》的美術、文字、UI、品牌或商業化結構。

---

## 1. 為什麼這款比預期重要

《數碼寶貝：新世紀》是中國大陸官方授權商業產品，其中「萊恩島」已經把我們目前正在討論的多個 Habitat 概念放在同一個可玩的家園裡：

- 玩家擁有自己的島嶼 / 家園；
- 可自由放置功能建築與裝飾物；
- 有一定數量的數碼寶貝在島上活動；
- 數碼寶貝有場景行動 AI，會在玩家布置的島上行走；
- 數碼寶貝可與建築產生互動；
- 玩家可與數碼寶貝對話 / 交談；
- 可派遣數碼寶貝出港，經過時間後帶回資源；
- 有食材生產與料理；
- 料理可提升親密度，並回饋屬性 / 天賦；
- 有孵化室；
- 可保存多套布局；
- 有繁榮度，家園建設會改變資源效率；
- 遊戲本身另有原創主線、資料館劇情、探索與分支進化。

因此它不是單一「家園 UI」，而是已經驗證過的：

> `Home + Resident AI + Buildings + Dispatch + Care + Progression`

這對我們的 Habitat 設計比只看 ReArise / DigiFarm 更直接。

---

## 2. 已驗證功能

### 2.1 家園與居民

官方 / 官方論壇資料明確描述：

- 萊恩島是玩家專屬數碼小島；
- 玩家逐步修建功能建築與裝飾物；
- 數碼寶貝會在島上活動；
- 玩家可與其互動。

在較早測試版本的開發資料中，還明確提到新增「場景內行動 AI」：數碼寶貝會在玩家自己裝扮的島嶼上行走、與建築產生互動，玩家也可以和牠們交談。

### 2.2 派遣

港口可派遣數碼寶貝出去；經過一定時間後取得金幣與數碼晶片。港口升級會提高隊列數、產量與最長派遣時間。

這證明「角色出去工作 / 探索後帶東西回來」在官方 Digimon 商業產品中已有成熟 precedent。

### 2.3 生產 → 料理 → 關係

家園可建食材生產建築；食材送到不同料理工坊製作點心。不同數碼寶貝有不同食物偏好，點心用來提高親密度；親密度還會回饋屬性 / 天賦。

這是一個完整的：

```text
Habitat production
  -> Food
  -> Care interaction
  -> Intimacy
  -> Character growth
```

### 2.4 孵化

孵化室可使用友情點等資源孵化數碼獸，並透過升級降低消耗或提高每日上限。

### 2.5 佈局與繁榮度

公測後加入：

- 地表編輯；
- 多布局模式；
- 可在現有布局上修改；
- 可保存多套方案並切換；
- 放置建築 / 裝飾會提高繁榮度；
- 繁榮度提高家園資源產出與部分 cooldown 效率。

這證明「玩家個人化佈置」不只是 cosmetic，也可以和 progression 相連。

### 2.6 Story / Adventure / Evolution

官方產品描述另確認：

- 原創世界觀與原創主線；
- 資料館重溫經典動畫劇情；
- 網域探索；
- 分支進化；
- 小隊戰鬥。

因此《新世紀》本身已經是一個「家園 + 故事 + 探索 + 養成 + 戰鬥」的商業案例。

---

## 3. 對 Championship 2026 最值得抽象的 6 個 Pattern

### P-NC-01 `HABITAT_IS_HOME_AND_PRODUCTION_LOOP`

家園不是角色展示櫃；它同時是：

```text
生活空間
+ 生產空間
+ 養成空間
+ 個人化空間
```

### P-NC-02 `RESIDENT_AI_USES_PLACED_BUILDINGS`

角色不是在背景隨機走，而是應該能把玩家放置的物件視為 affordance：

```text
Bed -> SLEEP
Kitchen -> EAT / COOK
Pond -> DRINK / PLAY
Training -> TRAIN
Workbench -> WORK
```

### P-NC-03 `LAYOUT_IS_PERSISTENT_PLAYER_EXPRESSION`

玩家應能逐步修改 Habitat，甚至保存多個 layout；但我們不應讓 layout 只追求加成最大化。

### P-NC-04 `OFFLINE_PROGRESS_IS_CHARACTER_ACTION`

派遣應由具體 CreatureInstance 執行，而不是帳號自動產錢。

我們的版本應記錄：

```text
who went
where
why this resident was suited
what happened
what came back
what memory was created
```

### P-NC-05 `CARE_HAS_CROSS_SYSTEM_EFFECT`

餵食 / 料理 / 喜好應影響關係與成長，而不是只有一次數值回復。

### P-NC-06 `HOME_IS_OPERATIONAL_BASE`

Habitat 可以串起：

```text
Hatch
Care
Food
Training
Dispatch
Social
Preparation
Return from adventure
```

---

## 4. 我們不應照搬的地方

《新世紀》對我們最有價值的是系統整合，不是它的營運設計。

不建議照搬：

- gacha / 稀有度驅動角色取得；
- 每日資源收菜變成主要 retention；
- 建築只為提高產量 / 戰力；
- 繁榮度等於堆越多家具越好；
- 派遣只是 timer -> currency；
- intimacy 只等於屬性成長；
- 高度 live-service / EOS 依賴。

我們應把同樣骨架往「個體生命」方向推：

```text
Resident AI
+ Personality
+ Preferences
+ Relationships
+ Memory
+ Life History
+ Branch Evolution
```

---

## 5. 直接影響目前 Habitat Experiment 的決策

### 原本 Prototype

```text
Needs
+ Personality
+ Affordances
+ Utility AI
```

### 更新後 Prototype

應新增兩項：

1. `placed-object affordance ownership`
   - 角色要知道自己正在使用哪個實際 Habitat object，而不是只選抽象 action。
2. `action -> persistent consequence`
   - interaction 至少要能寫回一項：Need、Relationship、Skill、Memory、Resource、Evolution History。

第一版仍不需要完整建築模擬。

建議 6 個 POC 物件：

```text
Bed
Food Station
Pond
Toy
Training Device
Workbench
```

三隻 resident 使用同一套 AI，但不同 Personality / Preference 應導致不同物件使用分布。

---

## 6. 對產品定位的修正

在這次研究前，可以說「官方沒有完整做過 Habitat」。

研究《新世紀》後，這句應修正為：

> **官方已經做過相當完整的 Home / Island / Resident AI / Dispatch / Production / Interaction 組合；我們的差異化不能只是『也讓怪獸住在基地』。**

真正仍有空間的地方是：

```text
Habitat life
  + Individual personality
  + Inter-creature relationship
  + Persistent memory
  + Story consequence
  + Life-history evolution
  + Auto-battle personality
```

也就是把《新世紀》的「家園經營」從 operational base 再推進成「個體生命模擬」。

---

## 7. 證據來源

- TapTap 官方 / 精華：萊恩島玩法詳解  
  https://www.taptap.cn/moment/187656649169701891
- TapTap 官方：究極進化測試新版本內容（場景行動 AI、建築互動、對話）  
  https://www.taptap.cn/moment/169166704604089799
- TapTap 官方：公測萊恩島多布局、繁榮度、彩蛋互動  
  https://www.taptap.cn/moment/210331657759098218
- 小米遊戲中心：萊恩島建造指南（孵化室、料理、港口派遣、食材建築）  
  https://game.xiaomi.com/viewpoint/1345365192_1635058185451_13
- 奇俠互娛產品頁：分支進化、策略戰鬥、專屬島嶼、世界冒險  
  https://www.qixia.com/product-dm.html

### 來源歸屬修正（2026-09-14）

使用者提供的 Bilibili 影片 `BV16Zt36gEga` **不是《數碼寶貝：新世紀》的萊恩島證據**；使用者辨識後確認影片內容是《Digital Tamers 2》（中文社群常稱《數碼馴獸師重生2》）相關內容。該影片因此自本研究的《新世紀》證據鏈中移除。

《數碼寶貝：新世紀》的上述結論仍由本節列出的官方 / 官方論壇資料獨立支持。
