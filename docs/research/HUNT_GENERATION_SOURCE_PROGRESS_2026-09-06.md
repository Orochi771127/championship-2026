# Hunt A：整段生成、Gate 變體與帶入個體

日期：2026-09-06。**狀態：A 的生成核心已有整段原作對照；A 一般入口仍未通過，B／C 未驗收。**

正式專案／Git root：`R:/Projects/Championship2026/championship-2026`；branch `main`；HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。初始 cwd 是上層非 Git 工作區；本輪開始454筆 dirty entries，既有成果保留。使用已讀的 engineering:debug，沿原作輸入、writer、consumer 與第一個分歧查證。先查 championship-evidence MCP 的 `020CC4C0`，限定搜尋無結果沒有當成原作不存在此流程的證明。

本輪沒有改接 `beginHunt`、沒有變更 Save schema，也沒有新增 router／store／save key／ticker／renderer。沒有 commit、push、deploy。原作 ROM、模型、RAM、ATR／ESC 與截圖保留私有研究用途；沒有將研究 fixture 或資產搬進正常遊戲。

## 已完成的程式及證據

| 子項 | 實作／對照結果 | 明確界線 |
|---|---|---|
| AI 建構 | `nativeHuntActorInitialization.js`：B3 壽命抽樣、兩次 B2 方向抽樣；721 組原 CPU 邊界案例 | 初始化不等於後續 AI1／2／3 狀態更新 |
| 初始速度 | 同一模組：原 float32 基值、性格 selector、原 double 運算及取整；228 species × 9 traits = 2,052 組相等 | 速度資料仍由呼叫者供應，未加入新 runtime 資料表 |
| 同種配置 | 同種配對、30% 條件、四次 B3 位移抽樣、地形查詢、64次上限、前面結果影響後面配對 | 正常位置、跳過帶入第一格、全部阻擋三組原 CPU 比對；受控案例不宣稱正常遊戲已走到 |
| 整段生成 | `nativeHuntGeneration.js`：候選 → 個體池 → 每隻 AI／位置 → 場景機率 → 同種配置 | 正常原作觸控入口的15隻資料、HP、位置、AI初始化、速度、全部492次 RNG 及217-channel終點相等；JS自己要求抽樣，沒有按receipt排程消耗 |
| 帶入個體池 | `nativeHuntIndividualPool.js`：複製既有個體到第0格、tag1、清+004、回傳第3號歷史槽的寫入 | 受控原CPU案例：14筆、236次RNG；保留既有能力／名字，不執行該筆constructor/post-update。帶入 actor 的另外註冊分支仍未閉合 |
| Gate 日夜判定 | `nativeHuntGateVariant.js`：節點方向、小時、Q12除法、角度、正規化與內積 | 原CPU執行模型節點解析器取得17個節點，再跑408組hour案例；374組非負trig索引與JS的角度／內積／結果完全相等 |

完整生成的本次普通野生分支消耗順序為：個體池270次；15隻各AI3次＋位置10次，共195次；場景機率1次；同種配置26次，合計492次。原作場景資源是指標，不能稱為 runtime effect ID；程式只接收主／次資源是否存在的功能輸入，實際素材綁定另屬presentation責任。

修正了一個由原CPU比較發現的少見分歧：第一次方向B2為0、第二次為正時，原作走「減0.5再轉整數」，會比原先簡化式少一個Q12單位。721案例中306例命中此差異，已修正；不能因位置肉眼近似便省略。

Gate 不是統一在某個鐘點切日夜。`0210F02C → 0210C9D8` 解析原模型節點，`0210CFD8` 寫入位置，`0210D1A4` 以小時旋轉方向並比較內積。本次Grass原作13:00為night1，與正常觸控觀察相等。此資料不能以目前browser的Fibonacci球面位置或alphabetic Gate順序替代。CPU受控00／01小時讀到trig table之前的位址；可玩日已知為07..22，這兩個越界分支維持明確拒絕，未自行wrap。

## A 還沒完成的來源及接線

後續更新：原作modifier／history的writer、選擇、存讀檔與trait8還原已完成CPU及受控原作Continue驗證，見[生命週期實作](HUNT_HISTORY_LIFECYCLE_2026-09-06.md)。以下第1點的「原作欄位／條件未知」已被該證據取代；Web Save遷移／app交易仍未接線。

1. **遭遇率修正／放生歷史的持久生命週期。** 已找到ARM9 `02072958`的save編碼、`0207AD30`解碼，確認兩個4-bit值包成一byte；這兩处不是自然時計更新器。修正陣列位於ARM9 BSS。OVL0返程 `02119598` 的byte加一／上限8及 `02119730` 的減二／最低0已定位，但仍需把前置tag／帶入與返程選擇、New Game／Continue／舊Web存檔來源完整串起。不能把所有未知歷史默認全0。
2. **帶入 actor 註冊。** 個體池copy與第4個歷史槽覆寫已證實，不表示角色註冊與初始位置和普通野生分支相同。整段生成器對非null carried 明確拒絕；不會使用未比較的普通野生路徑取代。
3. **正式功能資料供應。** 季節遭遇表、Gate節點功能輸入、場景效果條件、地形／方向讀取需經runtime contract供給；研究數字receipt及原ATR／ESC不能直接成為shipping依賴。這次新模組沒有import研究資料，也没有偷偷改成固定15隻或固定RNG。
4. **正常 app 交易與驗收。** `championshipStandaloneApp.beginHunt → createHuntWorld → createHuntRuntime`仍是prototype生成。須用既有app的日曆、歷史與可回滾的RNG候選完成建場後再發布，接到同一Save writer；兩組合法入口、重入與Save／Continue都要驗證。正常入口仍未消耗app RNG。

以上是尚未完成的工程／證據依賴，**不是等待Owner再授權**。既有授權明確覆蓋 A → B → C；A通過後才接正常AI／工具／捕獲階段，最後做Gate01返家存檔重載。局部比較不能提前將任何一個工作包標為完成。

## 研究方式與重跑

正常來源仍是原作checkpoint到Gate確認的真實stylus/cycle路徑，使用私有研究DeSmuME library，沒有改遊戲RAM或注入生成結果；不宣稱操作可見的DeSmuME0.9.13 GUI。原CPU oracle另用隔離Unicorn記憶體，受控輸入、模型／RAM載入、allocator或DS硬體算術adapter均分別標記。Gate CPU oracle執行原模型resolver、matrix、normalize與dot，沒有使用現有browser位置反推原作。

私有工作目錄：`R:/Projects/Championship2026/_archive/hunt-environment-2026-09-06/entry-source/`。`live7/entry-environment.json`是最終觀察；早期live5在額外讀取stack時遇到DeSmuME native access violation，沒有採用該不完整紀錄。觀察器改為在實際機率callee讀取已知register輸入，live6／live7完整通過，hookErrors為空。原ROM／使用者存檔未修改。

可重跑入口：

- `scripts/research/check-hunt-actor-entry-cpu.py --rom <private-rom> --field <entry5/normal-field.dst> --live <entry-source/live7/entry-environment.json> --out <receipt>`
- `scripts/research/check-hunt-entry-sources-cpu.py --rom <private-rom> --gate-state <entry2/gate-before-confirm.dst> --out <receipt>`
- `scripts/research/check-hunt-individual-pool-cpu.py --rom <private-rom> --field <entry5/normal-field.dst> --carried-only --out <receipt>`

研究receipts：`HUNT_ACTOR_ENTRY_CPU_CHECK_2026-09-06.json`、`HUNT_GATE_SOURCE_CPU_CHECK_2026-09-06.json`、`HUNT_CARRIED_POOL_CPU_CHECK_2026-09-06.json`。均 `runtimeEligible:false`。原有個體池receipt保留原SHA。

Focused／regression、重建SHA與檔案檢查結果見 [validation receipt](../reports/parity-audit/2026-09-06/hunt-generation-source-validation.json)。此輪未執行正常browser捕獲驗收；`normalSpawnRuntimeBound`、`huntGenerationConsumesGameplayRng`、`normalEntryCapturePlayable`均保持false。
