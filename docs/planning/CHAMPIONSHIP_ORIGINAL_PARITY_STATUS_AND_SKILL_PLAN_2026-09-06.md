# 原作符合度：已完成／未完成盤點與 SKILL 執行計畫

日期：2026-09-06。性質：**目前工作樹盤點與規劃，不是新增 gameplay 實作或原作完整驗收。**

## 1. 專案、範圍與判定方式

- 啟動目錄：`R:/Projects/Championship2026`，不是 Git repo。
- 正式 Git root：`R:/Projects/Championship2026/championship-2026`；branch `main`；HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。
- 本輪開始448筆 dirty entries；現有未提交成果屬於盤點的一部分，不能將 HEAD 本身當成全部成果。
- 指定 ROM：`R:/8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1.nds`，本輪確認檔案存在、67,108,864 bytes；SHA取自既有同-ROM驗證紀錄，本輪沒有重新雜湊整包。
- 實際美術包目錄為 `R:/Projects/Championship2026/YDIJ_PRIVATE_ROM_ART_PACK`。聊天中帶反斜線的 `YDIJ\_PRIVATE\_ROM\_ART\_PACK` 不應被當成四層資料夾。
- 僅使用本專案來源與指定原作；不讀取或混用另一專案的產品真值。

最新 Owner 要求優先：9:16、Web/mobile/touch first；ROM_VERIFIED 預設保留，PARTIAL 保留已知結構，UNKNOWN_REQUIRES_TRACE 不猜測，刻意玩法改動才是 OWNER_APPROVED_ADAPTATION。ROM／decoded assets 依目前明確要求維持 RESEARCH_ONLY，不直接進 shipping runtime。

**符合原作的判定是：相同有效操作、前置條件和選擇，在相同遊戲狀態及對應 RNG／更新時序下，產生相同的狀態變更、限制、結果與回饋。** 資源數量、畫面相似、測試總數或可開啟某個選單，不能單獨證明此條件。

每項工作分開標示四件事：

1. **證據**：影片／原作文字／靜態資料／控制流／實際執行，各自能證明什麼。
2. **實作**：純函式、domain、交易與 renderer 是否已存在。
3. **一般入口**：從正式啟動與正常選單是否真正使用它。
4. **驗收**：局部比較、受控 fixture、正常完整流程分開計算。

## 2. 目前成果與缺口

「已完成」以下均附範圍，不等於全遊戲完成。來源索引在第8節。

| 項目 | 已完成／可沿用 | 尚未完成／限制 | 判定 |
|---|---|---|---|
| 獨立架構 | 現有 app、screen stack、單一持久化 writer/key、共享 Pixi stage/ticker；DOM UI；bounded Three 場景 | 各新增流程仍須接入這些 authority；架構成立不能證明 gameplay parity | 基礎已接入、可沿用 [S1] |
| New Game／Save／Continue | 正常啟動、讀檔、版本／digest檢查、失敗重試與恢復；外層v4、nested Raising v5 | 原作完整 New Game 個體生成、DS battery-save 行為及所有跨場景保存規則未全部閉合 | Web保存基礎已完成；原作保存部分 [S2] |
| 個體身分與居民集合 | 穩定 instance ID、同物種個體分開、命名／籠位／care紀錄、配置高水位與舊檔遷移；放掉初始居民後Continue不復活 | 個體完整TP、能力、招式、成長／壽命等profile尚未完成 | 身分已完成；養成profile部分 [S2][S3] |
| 戰鬥金錢交易 | 現有單場的入場扣款、結果入錢包、去重、上限、失敗重試、手動存檔／重載；MATCH00修正為150入場費、7,000表列獎金，實收依結算條件 | 原作全部模式／獎金門檻及New Game合法初期收入循環尚未完整驗收；以前browser使用明確資金fixture | 此交易範圍已完成，整體經濟循環部分 [S4] |
| 時鐘／日曆 | 原作時計換算、自然推進、End Day、22:00停止、共同賽程日期、精度保存、既有ticker接線；有browser紀錄 | 時鐘尚未完整驅動飢餓、進食、訓練、疾病、壽命、進化；全部場景時序仍有缺口 | 時計已接入；生命模擬未完成 [S5] |
| 手機版面 | 五組目標viewport已有遮擋修正／操作紀錄；共用工具列量測；390×844的HP/TP及save狀態改善 | 實體裝置、安全區、完整正常捕獲觸控、所有選單／動作仍未全驗收 | 已有局部browser驗收 [S4][S5] |
| Gate／Loadout／探索 | 選圖、裝備／plugin、持有量檢查、卡片容量顯示、大型地圖／相機、正常進出與返家架構 | 原作Gate時空／晝夜變體選擇、完整裝備效果、正常生成與碰撞來源未完整接入 | 可操作框架已接入；原作部分 [S1][S6] |
| RNG | 原作217-channel算法；實際10,584次原作RNG對照；RTC初始化CPU比較；app保存／Continue延續 | 一般 `beginHunt()` **尚未消耗app RNG**；原作入口前的相關抽樣、完整生成消耗、DS讀檔reseeding未全部閉合 | app/save已接入，正常生成未接入 [S6][S7] |
| 野生生成／地形 | 原作實際15個個體與位置觀察、ATR/ESC來源／觀察期間生命週期、位置／修正函式；多組CPU比較 | 正常入口仍前三種非蛋物種、六隻prototype、固定gate seed及自訂阻擋；普通個體建構／AI初始化／同種配置現已整段比較；正式來源／持久歷史／帶入actor與正常接線仍缺 | 證據與局部port完成；一般入口未完成 [S6] |
| Hunt自行走動 | 正常原作AI1/2/3與目標指標寫入觀察；部分移動函式 | 正常runtime仍product-authored wander；感知、跟隨、取消、地形反應尚未完整接入 | 部分拆解，未完整接入 [S6][S8] |
| Rope／逃跑／掙扎 | 真實原作觸控捕獲紀錄；HP／繩索傷害／耐久、事件11/13、AI8反應、部分移位等已對照 | 工具選取、座標／採樣、slot壽命、normal AI／controller順序与所有可達分支未整合；不能圈閉合直接成功 | 局部port／研究流程部分完成 [S3][S8] |
| 倒地／手掌／插卡 | 已移植觀察到的native狀態與計數流程、容量條件、重複操作防護、source HP保留 | 正常工具與畫面未完整驅動；不是每一阶段都由sprite動畫結束控制 | domain階段存在；一般入口未完成 [S3] |
| Result／滿額放生／返家 | 卡片命名、取消／確認放生、滿16替換、Home/卡片/ID原子提交；失敗重試及Continue；有受控browser測試 | 入口来自研究fixture，尚無正常Gate01捕獲接通此交易；完整個體profile仍缺 | 交易已完成；正常整條流程未完成 [S3] |
| 地面投食／自主進食 | 已確認原作操作是選食物→點空地→角色接近並吃；工具列及視圖接點存在 | 地上食物物件、個體選擇／接近／吃掉、消耗與能力寫入／保存未完成；點角色不是餵食驗收 | 未完成 [S9] |
| Cage／育成／進化 | Cage定義、買入／擁有、配置／合成、confirm/revert/save；文字已知訓練方向與建議隻數 | 實際訓練寫入、超額壓力倍率、飢餓／健康／傷病／壽命／進化完整循環尚未證實接入 | 框架／資料部分完成 [S10] |
| 自動戰鬥 | 選招、VM、動作／目標、傷害／HP、死亡／勝負有實作；battleRuntime推動自動戰鬥 | 預設ROM隊伍，自己的個體／編隊／策略未接；四個模式及合法賽事／進度尚未完整 | 自動戰鬥已接入，玩家循環部分 [S11] |
| Shop／Database／說明 | catalog、購買與Bits／inventory、Cage ownership、224槽圖鑑與個體投影、相關DOM畫面 | 商品消耗／解鎖writer、完整登錄／篩選、全部名稱與中文顯示、全套原作模式仍待驗證 | 部分已接入 [S1][S10][S12] |
| 美術／動畫／VFX／聲音 | 私有包、角色／UI工作區、場地／特效manifests；部分場地正常載入；角色/VFX review載入器 | 正常species→外觀／動作與技能→特效綁定不完整；全角色、UI、音訊及完整畫面parity未驗收；shipping狀態不能由研究數量推得 | 研究／管線多，完整產品呈現未完成 [S12] |

### 資料數量與整合狀態分開

本輪直接讀取的數量：17份runtime catalog JSON；production index 19筆，其中5筆明示 `runtimeEligible:true`、0筆 `shippingReady:true`；Hunt/Cage/Battle manifests 分別列30/40/11個field，VFX列26個system。

私有pack manifest記載6,317份原始美術檔案、1,705個family；既有角色workspace驗證記載224 entities、17,235 cells、11,480 sequences，UI workspace為96 scenes、1,369 nodes。這些是manifest／既有驗證紀錄，不是本輪重跑全包decode或所有素材逐一目視的結果。

「美術都未使用」已不符合目前程式碼：部分Hunt/Cage/Battle場地有正常loader。但「30/40/11個field全部在正確情境完成原作驗收」也不成立。角色與UI的完整工作區、review query可載入，以及一般入口的真實綁定，是不同狀態。

較舊 Owner Direction／production index 還帶有 licensed-pixel runtime 規則；目前聊天明確要求ROM／decoded資產RESEARCH_ONLY。此盤點記錄現有loader事實，**不把舊flag當成新的shipping許可**。後續要檢查既有包的實際來源與打包邊界，依最新指示處理；不自行刪除現有成果或重寫Owner Direction。

## 3. SKILL 選擇與使用界線

本輪已讀下列SKILL。architecture/testing-strategy用於本計畫，其餘依工作包到位時使用，不是同時啟用七套架構。

| SKILL | 要用它完成什麼 | 具體產物 | 必須限制 |
|---|---|---|---|
| `engineering:architecture` | 固定既有app／domain／presentation／save責任，評估接線 | 本計畫ADR、caller→consumer與資料所有權圖、contract差異 | 不換引擎、不建第二個router/store/save/ticker |
| `engineering:debug` | 重現原作、隔離首個分歧、追writer／reader與RNG | 輸入串、前後狀態、PC／overlay、RNG順序、首個分歧報告 | SKILL不是ROM解碼器；仍用現有DeSmuME／Unicorn研究driver |
| `input-systems` | 工具語意、按下／持續／放開／取消、相機→世界→native座標 | 既有input contract及touch事件測試 | 不套用其通用buffer、coyote time、容錯／平滑數值或另加原作沒有的操作UI |
| `pixijs-ticker` | 既有ticker下的原作更新節奏與順序、卸載清理 | native更新／呈現分離、30/60/120 rendering schedules比較 | 不套用範例新建ticker/RAF；不把一次browser frame當一次原作update，不用動畫速度改玩法 |
| `engineering:testing-strategy` | 將原作對照、單元、整合、正常完整流程分層 | 下節測試矩陣、正反案例、回歸範圍與退出條件 | 不以967個測試代表967項原作玩法；不為trivial getter增加鏡像測試 |
| `game-studio:game-playtest` | 用玩家的正式入口驗收touch／canvas／HUD／保存 | screenshot、實際操作紀錄、狀態／console／save前後、裝置表 | canvas/WebGL必須看畫面；fixture和query preview不替代normal入口 |
| `championship-art-production` | 原作參照／production分類、單隻角色與動作對應、atlas/anchor/圖層／QA | 最小流程的asset binding表與視覺驗收，再逐批擴充 | 只用本專案當前條款與美術方法；其歷史Nexus／舊批次條款不覆盖最新Owner要求；美術不寫HP／成功／存檔 |

SKILL實際位置：

- [architecture](C:/Users/USER/.codex/plugins/cache/claude-cowork/engineering/1.2.0/skills/architecture/SKILL.md)
- [debug](C:/Users/USER/.codex/plugins/cache/claude-cowork/engineering/1.2.0/skills/debug/SKILL.md)
- [testing-strategy](C:/Users/USER/.codex/plugins/cache/claude-cowork/engineering/1.2.0/skills/testing-strategy/SKILL.md)
- [input-systems](C:/Users/USER/.agents/skills/input-systems/SKILL.md)
- [pixijs-ticker](C:/Users/USER/.agents/skills/pixijs-ticker/SKILL.md)
- [game-playtest](C:/Users/USER/.codex/plugins/cache/openai-curated-remote/game-studio/0.1.2/skills/game-playtest/SKILL.md)
- [championship-art-production](C:/Users/USER/.agents/skills/championship-art-production/SKILL.md)

本輪不用imagegen製造一套新玩法／角色、不另外建立Unity/Phaser/React專案，也不因有某個SKILL便擴大範圍。沒有可用SKILL能取代原作控制流逆向工程。

## 4. 執行順序與完成條件

### A：一般入口完整生成與RNG（現在第一優先）

**A1 原作入口／環境／RNG來源**

- 保留現有RNG核心和v4保存成果。追Gate狀態的producer，包括原作遊戲時間、選定區域位置／變體、field identity及ATR/ESC的載入／釋放。
- 查明同一正常入口前相關RNG消耗，不能只有在研究工具注入某一份entry state才正確。新建、重入、Continue各自列明來源；原作 `0206AD6C` 載入reseeding與目前Web恢復完整channel state的差異須有原作證據／明確adaptation紀錄，不能自動視為已符合。
- 功能地形／方向資料與美術資產分開；先有讀取／碰撞／移動語意contract，再製作符合邊界的2026資料供應，不讓art loader帶入raw碰撞表或直接在runtime讀私有包。

**A2 整批生成**

- 再後續：原作遭遇修正與放生history的返程／存讀檔已完成80選擇、22返程、3codec CPU比較及受控原作Save/Continue；性格讀檔還原8已保留。Web遷移與交易接線仍缺，A未通過。見[生命週期實作](../research/HUNT_HISTORY_LIFECYCLE_2026-09-06.md)。
- 最新後續：普通個體池→AI／位置→場景機率→同種配置的整段492次RNG已與正常原作入口相等；Gate節點／小時判定、帶入個體池copy及歷史寫入輸出也已比較。仍缺持久生命週期、帶入actor、正式功能來源與app接線；A尚未通過。見[整段生成及剩餘來源](../research/HUNT_GENERATION_SOURCE_PROGRESS_2026-09-06.md)。

- 2026-09-06後續實作：候選權重運算、個體池選取及constructor／post-update已通過原CPU比較；[本輪實作報告](../research/HUNT_INDIVIDUAL_POOL_IMPLEMENTATION_2026-09-06.md)列出228種個體、4組個體池及剩餘來源／AI／配置接線。這仍是A子項進度，不是一般入口交付。

- 完成 `0211A568` 選種／季節／去重／重試／特殊路徑、`02062100`完整所需個體資料、`02062C28`後續處理、actor／AI初始化、已完成位置函式及 `0211B1AC..0211B2AC` 同種配置。
- 為一批資料記錄每階段的RNG消耗、個體身分／species／能力、位置／面向與AI起始狀態；候選權重、未顯示欄位和被覆寫抽樣不能因看似無用就刪除。

**A3 一般入口接線與驗收**

- 修改既有 `championshipStandaloneApp.beginHunt`、`huntWorld` 與 `huntRuntime` 的交接，由正式app-owned RNG建立個體，取代目前六隻prototype、固定gate seed及自訂阻擋。
- 實際Hunt的field identity必須同時供給碰撞與presentation，避免玩法選了night變體、美術卻固定dayFieldId。
- 驗收：同一entry狀態／輸入在ROM與JS的**整批輸出及所有channel結束狀態一致**；至少涵蓋兩組不同的合法RNG／入口條件、場景重入與Continue。不同seed不必保證每次物種不同，應比較原作對應結果。
- 正常New Game或合法Continue進Gate01能看見／操作所生成個體。測試不得靠 `captureReplay`、固定15隻紀錄、改HP／RNG RAM或query開關完成。

**A的完工點：正常入口確實使用完整生成。** RTC／位置／range單獨通過只記為A子項進度。

### B：原作正常AI、工具、倒地／手掌／卡片

- 接通選定field／species在正常操作下可達的AI1/2/3狀態；追感知／目標選取→writer→移動消費→目標取消。不能把非零follow target清成0來避開分支。
- 將工具選擇、pointer edge/held/release/cancel、邊緣捲動、canonical座標、繩線取樣／slot expiry和查詢按原作順序掛入既有更新owner。
- 接通AI8及11/13在目前可達狀態中的處理、Rope斷裂／逃脫、HP0、AI10／後續手掌可收取與card insertion；重用已通過比較的數值與phase模組。
- 初次只驗Gate01／一種合法Rope裝備，但要涵蓋這個範圍實際可達的分支。未部署trap的空controller必須有證據；不能以「先做Rope」之名忽略會被同一狀態呼叫的trap/follow邏輯。其他未涉及工具保留backlog，避免要求全世界完成才驗第一隻。
- 將足以驗收此流程的一隻角色、繩線、倒地、手掌、卡片呈現接入正式presentation。計數控制的階段沿用native計數；真正等待動畫／slot expiry的地方才接對應通知。**`0210C034` 的 `W+11C > 0` 不能改成任意animation-end callback。**
- 驗收：同樣輸入下，位置、HP／繩耐久、AI state、card容量／插入時點、移除／可點擊狀態與原作相同；觸控取消、目標移動、斷繩、不能收取亦有負向案例。render慢一幀不得提早成功或多扣一次HP。

### C：正常Gate01捕獲返家完整流程

- 以合法的New Game／Continue、實際持有裝備與卡片進入，不靠測試資金／結果fixture提供捕獲來源。
- 正常選Gate→生成→自行走動→Rope／拉扯→倒地→手掌→卡片→Result／命名→Home→Save→重載Continue。
- 直接沿用現有卡片／Home／ID交易與滿16放生替換，不重建一套Store或清空舊居民。
- 驗收：同一個體身份與已證實能力保留、僅新增一次；source能力與被消耗的wild HP按原作分工；容量不足、取消放生、滿16替換、存檔失敗／重試、重複確認後無丟失／複製。
- Browser需記錄實際touch/pointer、畫面、狀態／console和同一save key前後。至少390×844與一組較小viewport，之後擴到全部已定義mobile尺寸與實體touch裝置。DOM自動化不能替代canvas目視。

**C通過才能稱「正常Gate01捕獲返家完成」。** 既有滿額／Result fixture通過不代替此證明。

### D：地面投食與自主進食

- 一種已證實食物、一隻具有實際個體資料的角色、一個合法籠區：選FEED→點空地→產生落地物件→原作條件選擇／接近→進食→物件／庫存／個體寫入→保存／Continue。
- 追物件owner、目標保留／失效、被其他個體吃、取消／剩餘食物等原作分支；不要用「點角色立即加飽食度」替代。
- 原作baseline與投食後作狀態差分，找實際writer後才命名／更新飽食、體重或其他欄位；不因影片作者解說推導數值。
- 完工點：相同条件下會接近／不接近、吃／不吃，消耗和能力結果均符合，且重載後保留正確結果。

### E：育成池、環境訓練、生命與進化

- 延續同一個體profile及已接時鐘；逐一追訓練、壓力、清潔、疾病／傷勢、休息／恢復、壽命與進化的條件→狀態writer→日／場景更新→保存。
- Cage文字方向不能代替效果數值。**籠區建議隻數的soft cap、Home pool的16個slot、記憶卡的G容量是三個不同限制**；不可互相套用，也不可將已證實允許超額的籠區改成硬鎖。
- 進化以一條有原作條件證據的路徑起步，保留前後instance identity與能力變換，再擴充其他條件／分支。尚無實作／驗收證據的生命系統，不因catalog存在算完成。

### F：自己的個體自動戰鬥與完整賽事

- 先把已完成profile接到既有 `battleRosterSource`／`battleRuntime`／VM，不重寫既有原作選招與傷害core，也不以species基礎值冒充玩家養成值。
- 完成原作編隊／策略／可參賽條件；由真正持有個體進一場合法賽事，結果進既有wallet／rank／record／save流程。
- 驗收：同一個體養成差異確實改變讀入戰鬥的profile；操作選擇／AI行為符合；入場不足／落敗／勝利／重複結果／save失敗符合對應門檻。
- 再逐個閉合四個模式、賽程／稱號／解鎖、獎金和Championship長期循環；不能單純把四個disabled按鈕打開或都導到同一場。
- New Game初期收入／持有物及可報名條件也須走通，不能靠150 Bits fixture宣告完整經濟成立。

### G：全遊戲內容與呈現覆蓋

- 逐地圖／物種／工具／plugin／商品／Cage／賽事擴展已驗收slice；建立已驗／未知分支清單，原作已驗證功能不因modernization被刪除。
- 角色採species＋動作／狀態綁定，UI採原作上下文／命令綁定，VFX／聲音採實際事件綁定。單隻角色的idle不能算全部動作；review query不能算一般入口。
- 完整中文化只改顯示文字，保留穩定species／instance／save／contract識別；圖鑑、help、音訊、告警與失敗回饋各有覆蓋表。
- 美術參照、符合當前政策的production材料、runtime binding、視覺QA、shipping分開列狀態。完成玩法flow時同步做必要的最小呈現，不等待224角色全數製作；大批美術在對應玩法contract穩定後擴充。

## 5. 原作對照與測試策略

| 層級 | 測什麼 | 通過標準 | 不能替代什麼 |
|---|---|---|---|
| 原作來源 | ROM SHA／overlay、合法存檔來源、影片ID／時間段、control-flow | 同一版本來源可定位，排除作者圖表／遮蔽／錯誤seek | 不能光靠manifest推導玩法 |
| 原CPU對照 | 算術、RNG消耗、phase、位移、writer先後 | 原CPU與JS在相同輸入下逐步／輸出一致，首個差異可定位 | 不代替正常app接入 |
| 正常原作記錄 | 自然生成／移動／捕獲，無RAM資料修改 | 合法UI輸入及狀態變化可重現；實際觀察與受控probe分開 | 不把一個success trace當全部分支 |
| domain／contract整合 | app RNG→world→actor/AI；card→Home→ID→save | consumer真正讀取上游結果、所有權唯一、失敗保持一致 | 不以靜態import圖代替實際調用 |
| Web一般入口 | New Game/Continue→完整選單／touch流程 | 無fixture／debug開關；身份、數值、畫面、保存一致 | 不以直接呼叫完成API代替操作 |
| 裝置／時序 | 30/60/120顯示更新、縮放、safe area、觸控取消、重入 | 相同native輸入序列產生相同simulation結果；UI可看／可點且無重複訂閱 | 截圖正確不代表互動和時序正確 |
| 回歸／範圍 | 交易、身份、migration、時計、battle、firewall | focused先跑，相關integration加完整既有regression；`git diff --check` | 不把總pass數換成parity百分比 |

重要負向案例：target被其他行為占用／消失、RNG cursor wrap、空候選／特殊條件按原作處理、沒有卡片容量、Home滿額取消／替換、pointercancel／第二手指、重複確認、存檔失敗、讀取損壞／舊版本、暫停／背景／重入；是否與原作相同逐項標示，平台特有取消／暫停行為不得混成ROM_VERIFIED。

每個工作包交付：來源與scope → 讀寫／RNG／更新順序 → contract → 正式consumer接線 → focused結果 → 正常流程證據 → 尚未涵蓋分支。**不能用新報告數、函式數或測試數作為整包完成條件。**

## 6. ADR：沿用既有架構完成原作流程

**Status:** Proposed execution plan；既有單一authority／原作保留方向已由Owner確立。
**Date:** 2026-09-06。
**Deciders:** Owner決定刻意玩法改動；工程接線沿用已有授權，不增加逐函式確認門檻。

**Context:** 已有大量ROM研究、純函式、交易及部分正常runtime；目前主要問題是正常producer／consumer和更新順序未連通。文件含多個歷史階段，容易重做已完成模組或誤報完整。

| 選項 | 評估／取捨 |
|---|---|
| 在既有app／domain／presentation／save內閉合A→B→C | 採用。保留已通過交易／身份／時鐘／battle；須補完整資料流和integration測試，工程複雜度可定位到既有邊界 |
| 另建Hunt store／RNG／save或另一個game engine | 排除。造成authority分叉，違反Owner架構要求並增加保存／狀態漂移 |
| 直接用成功錄製個體／動畫觸發成功來完成展示 | 排除。不能證明正常生成／可變條件／可達AI分支，違反原作符合度要求 |

**Decision:** 將證據支持的producer接到正式consumer；現有純函式与交易重用，只修實際分歧。研究工具讀取／記錄原作、受控CPUprobe產生比較向量，均不成為shipping runtime依賴。

**Consequences:** 可沿用已有功能並得到正常入口證據；完整capture之前仍必須追正常AI／生成，無法用純接線估作「幾個callback」。A/B/C驗收後才能擴張，不要求先做全部地圖／全224角色才完成第一條流程。

**Action items:** A1/A2/A3 → B → C → D → E → F → G。功能擴充保留未知／未驗清單；既有Owner授權不因本文件而被撤回。這份盤點本身也不把尚未授權的新美術重設計或公開發佈變成已核准。

## 7. 這輪規劃完成、驗證與文件漂移

- 本輪完成repo／主要source／最新contracts／receipt盤點、實際資料目錄確認、SKILL閱讀與工作包／驗收規劃；沒有改gameplay、存檔格式或美術內容。
- 最近一次已保存的全量結果是 **967/967**，來自上一輪RNG實作；本輪沒有重新跑gameplay regression、瀏覽器或模擬器，也沒有重新逐段播放兩段影片。
- 本輪MCP literal查詢 `0210D8B4` 無結果；這只表示該索引未命中，不表示原作沒有該函式。後續依本repo現有native trace／receipt。
- README、architecture摘要、REUSE_INVENTORY及CURRENT_PRODUCT_STATUS較下方历史表有「Battle planned」「Capture not started」「circle結果」等舊敘述。最新source／contracts與本表優先；本輪新增導航至本表，後續校正文檔應保留歷史receipt，不覆寫Owner Direction或舊驗收證據。
- 不報全遊戲完成百分比。A/B/C仍未驗收；當前最先交付的可玩里程碑是**正常Gate01的一隻完整捕獲返家**。

## 8. 查核來源

- **S1**：[Architecture](../architecture/CHAMPIONSHIP_2026_ARCHITECTURE.md)、[最新Product Status](../CURRENT_PRODUCT_STATUS.md)、[app source](../../src/championship/app/championshipStandaloneApp.js)、[screen stack](../../src/championship/app/championshipScreenStack.js)。舊文字與source有差異時按本文件第7節處理。
- **S2**：[v4 Save](../contracts/championship/championship-save-envelope.v4.json)、[identity contract](../contracts/championship/raising-instance-identity.v1.json)、[persistence](../../src/championship/raising/raisingHomePersistenceR2.js)。
- **S3**：[Hunt dataflow contract](../contracts/championship/HUNT_CAPTURE_DATAFLOW.v1.json)、[phase與居民遷移](../research/HUNT_PHASE_PORT_AND_RESIDENT_MIGRATION_2026-09-05.md)、[capture input boundary](../contracts/championship/VS3_HUNT_INPUT_CAPTURE_BOUNDARY.v1.json)。
- **S4**：[battle economy](../contracts/championship/battle-economy-runtime.v1.json)、[費用與獎金檢查](../reports/parity-audit/2026-09-05/battle-fee-payout-rom-check.json)、[Round1狀態](../CURRENT_PRODUCT_STATUS.md)。
- **S5**：[world clock](../contracts/championship/world-clock-runtime.v1.json)、[clock driver](../../src/championship/app/championshipClockDriver.js)、[目前時計／版面紀錄](../CURRENT_PRODUCT_STATUS.md)。
- **S6**：[正常原作入口](../research/HUNT_ENTRY_ENVIRONMENT_AND_COMPLETION_2026-09-06.md)、[entry receipt](../research/HUNT_ENTRY_ENVIRONMENT_REPLAY_2026-09-06.json)、[目前生成器](../../src/championship/hunt/huntWorld.js)。
- **S7**：[RNG與自主行為盤點](../research/HUNT_RNG_LIFECYCLE_AND_AUTONOMY_2026-09-06.md)、[最近967測試receipt](../reports/parity-audit/2026-09-06/gameplay-rng-lifecycle-validation.json)。
- **S8**：[移動閉合報告](../research/HUNT_MOVEMENT_CLOSURE_2026-09-06.md)、[normal Hunt](../../src/championship/hunt/huntRuntime.js)。
- **S9**：[兩段指定影片／ROM對照](../reports/parity-audit/2026-09-06/TWO_VIDEO_GAMEPLAY_AND_CURRENT_PARITY_RECHECK.md)、[原作投食教學](../reports/parity-audit/2026-09-05/original-feeding-tutorial.json)。
- **S10**：[Cage文字效果與未知數值](../../src/championship/cage/cageEffects.js)、[Cage runtime](../../src/championship/cage/cageEditRuntime.js)、[Shop runtime](../../src/championship/shop/shopRuntime.js)。
- **S11**：[Battle runtime](../../src/championship/app/battleRuntime.js)、[Roster source](../../src/championship/app/battleRosterSource.js)。舊 `battle-player-roster.v1.json` 的三隻自訂profile不是目前預設玩家養成資料。
- **S12**：[實際美術使用稽核](../reports/parity-audit/2026-09-05/ART_RUNTIME_USAGE_ZH_TW.md)、[Production index](../../assets/production/ART_PRODUCTION_INDEX.json)、[main loaders](../../src/championship/app/main.js)、[species動畫投影](../../src/championship/app/raisingPresentationSource.js)、[文字層](../../src/championship/text/uiText.js)。
