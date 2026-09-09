# 正常 Hunt 入口：方向／地形來源、RNG、位置初始化與完成條件

日期：2026-09-06。狀態：**PARTIAL；正常 Gate01 捕獲返家尚未完成。**

正式專案／Git root：`R:/Projects/Championship2026/championship-2026`。Branch `main`，HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。本輪開始時已有439筆工作樹變更；保留既有成果。Owner 已授權本輪追通與實作，不需要另一個開工許可。未 commit、push、部署或新增應用／存檔／ticker authority。

## 本輪已交付的結果

| 項目 | 原作證據 | 程式／驗收狀態 |
| --- | --- | --- |
| 方向格來源 | ARM9 `02087E40` 實際載入 `.esc`，資料位於5-byte header之後 | 檔案、載入返回值及觀察期間雜湊一致；未將原始格資料放進 runtime |
| 地形格來源 | ARM9 `0207C858` 實際載入 `.atr`，DATR/version2/width/height header共16 bytes | 與載入後128×128格逐位元組比對；runtime 資料供應尚未接通 |
| 正常入場 RNG | 原作選圖確認後，原 CPU 建立15隻個體並繼續更新 | 10,584次實際函式返回值、每次呼叫前游標與最後217組狀態全部吻合 |
| 個體初始位置 | `0210B924` 的位置 RNG → `0210C408` 地形修正 → actor寫入 | 新 JS port 比對全部15隻位置及地形查詢順序通過；後續同種聚集配置另列未完成 |
| 非零目標指標 | 原作正常運行時 AI1 在 `0210FA70` 寫入 AI+1E4 | 寫入／清除位置已取得，選擇條件與後續 AI2 使用仍待移植及比對 |
| 正常瀏覽器捕獲返家 | 本輪未進行此驗收 | `normalEntryCapturePlayable=false`；`movementRuntimeBound=false` |

這些是原作入口觀察、可執行算法及對照測試。一般玩家正常進 Hunt 所用的生成／AI／工具還沒有因此自動完成接線。

## 原作入口及資料生命週期

研究使用既有 py-desmume 的 DeSmuME 0.9.12 library；不是操作可見的0.9.13 GUI。從 Owner 的 `.ds3` 育成場景開始，透過原作選單到 Gate，再觸控選圖確認。中途曾開啟賽事選單後返回，沒有進行賽事。私有 checkpoint 的 SHA 與動作串接保存在 receipt 的 `sourceChain`。這是從真實場景存檔繼續的正常 UI 路徑，不是全新開機的 RNG／battery-save 驗證。

ROM SHA256：`8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`。

原始 `.ds3` SHA256：`8bbff6d16e4ec9a1334ae3244429b8bab2eaff92e4f85d8127b55267dcd46072`；原始 `.ds4` SHA256：`3b1a13a0e517722f094d0a6454f773a3b2f55b6f0b0994d4788447b5650940ae`。工作結束前重新讀取，兩者未變。

本次實際載入 `field_hm01_02.atr` 與 `field_hm01_02.esc`。畫面時間為13:00，Gate Select OVL12 的 `0210E888` 在tick107將 player+10 寫成 native Hunt index1。OVL0再以此索引讀取每筆0x58的 Hunt record，取得 field檔名。Gate01是2026 Gate的名稱，不等於 native index0；原作 Grass 的0／1是成對的兩筆記錄。

舊成功捕獲 `.ds4` 的 native index0 對應 `field_hm01_01`。兩者 ATR相同，ESC不同：

| 檔案資料區 | SHA256 |
| --- | --- |
| hm01_01/02 ATR | `c8d9a279ee7e0905442d30f20c90e7d546a4a48590523a36228f411408824da2` |
| hm01_01 ESC（舊捕獲場景） | `83e018fbb68c050ec02ea608f44103562cef0d910bfd21f28cd392b8e755aab3` |
| hm01_02 ESC（本次正常入口） | `919f71e621f7b1e30187b00443cabc1349729091a54a2d9ef56095292a82477b` |

既有 `HUNT_GRASS_NIGHT` 等名稱來自原作資料，不因13:00的畫面而改名。但不能把育成時鐘直接當成 Gate 的晝夜選擇公式。OVL12 `0210E808` 查詢 Gate的選取索引及狀態後，在兩筆表項間選擇；其狀態的產生仍須閉合。現有 `main.js` 預設讀 `dayFieldId`，尚未實作這個選擇。

本次loader返回後到tick876，方向／地形資料區的write watch沒有記錄寫入，結束雜湊等於剛載入及ROM檔案資料區。這支持「本次入場建立後保持不變」；不是所有地图／工具／場景切換都永不寫入的證明。靜態反組譯亦確認 `02088004` 是釋放清除，不是每幀方向生成器；OVL0 teardown `0211C478/0211C480` 分別清除兩個grid object。出口候選的載入掃描、釋放重入等完整 runtime 生命週期仍需接到既有 Hunt owner。

## RNG與正常生成的實作範圍

`battleRngChannel.js` 現有共用算法新增 `snapshot()` 與 `restoreChannelRng()`，延續217個channel的seeds/cursors。它沒有載入固定未來roll清單，也沒有推測boot master seed，或另開存檔key。原有 `createChannelRng(masterSeed)` 行為保留。

`nativeHuntSpawn.js` 新增：

- `rollNativeHuntRange`：原作先取channel0，再依奇偶取B2或B3，結果為 `trunc((range-1)*roll/102)`。不以 `%range` 替換。
- `repairNativeHuntSpawnTile`：半徑0..50、固定八個射線方向、保留負方向必須大於0的邊界。原格開放或找不到都返回0，後者不改座標。這不是廣度搜尋或完整環形搜尋。
- `initializeNativeHuntPosition`：保留面向、Y軸與X軸的抽樣順序，也保留兩次看似未影響結果、卻會推進RNG的取樣。地形修正成功才移到修正格中心。

全部15隻初始位置與原作一致，其中7隻經非零半徑地形修正。CPU額外比較1,030組range結果與11組地形邊界／無解案例。本輪的位置port停止於每隻 `0210B924` 完成；稍後 `0211B1AC..0211B2AC` 對同種個體的配置仍未實作。物種候選、個體其他能力與AI初始化消耗的RNG順序，仍須由完整生成owner接上，不能只呼叫位置函式便宣稱整批野生生成完成。

研究driver只送觸控／release並推進原 CPU；未写入 emulated RAM、注入HP／species／RNG或跳過動畫。read/exec/write watch 的目的都是觀察。受控Unicorn probes另外標記為 `CONTROLLED_CPU_PROBES_NOT_LIVE_GAMEPLAY`。增加觀察點前後，原作RNG呼叫、最終野生狀態及grid hash完全一致。

## 正常 AI 與跟隨／陷阱如何閉合

正常入場之後已觀察到 AI1／AI2／AI3。舊 AI8 位移比較只覆盖套繩後的路徑，無法替代這些狀態。

本次額外追到134次 AI+1E4寫入；其中3次在tick382／529／812由 `0210FA70` 將同一個目標指標寫入wild5。當時AI state=1、AI+1A0=0；不能把它描述為已證明正在跟隨。清除點包含 `0210FF2C`、`021102B8`、`0210E9A4`。原生callback報出的PC是目前ARM pipeline PC，對這些STR點採PC-8核對實際指令。

閉合方式：以這隻正常生成的wild5，補上目標候選查詢／選取條件→目標寫入→狀態轉換→移動消費→取消／目標失效的同一條資料流，並驗證其對RNG的影響。不能將非零指標改成0以套用舊port。陷阱則需從裝備／部署入口取得controller建立、碰撞、效果寫入、到期清除的證據。此次Rope流程只有在證明所選裝備下控制器的空狀態與原作回傳一致時，才能使用該空狀態；未驗證陷阱保留為獨立未完成路徑。

## 完成條件、工作順序與時間判斷

目前没有可負責任承諾的日曆完工日。正常生成及前置AI仍欠原作分支和host實作，不能把工作量估成幾条事件接線。先前僅以「把位移函式接回去」描述下一步不夠完整；本次正常入口觀察補出了這些依賴。

| 工作包 | 必須交付的可驗收結果 | 目前尚缺 |
| --- | --- | --- |
| A：正常入口／生成 | Gate確認後，按实际場景變體與延續RNG建立wild；同樣初始狀態一致，不同狀態能产生對應不同結果；一般啟動可見 | Gate狀態產生、完整生成/同種配置、正常資料供應、既有app中的RNG延續與保存 |
| B：正常Hunt／捕獲 | 既有ticker推動原作正常AI及工具順序；Rope→拉扯11/13→HP0→倒地→手掌→卡片 | AI1/2/3及目標路徑；AI8/10/11接線；工具採樣生命週期與命中查詢；controller／動作完成回報 |
| C：手機端到端驗收 | 正常New Game/Continue→Gate01→捕獲一隻→Result→Home→Save→重載Continue，確認同一身份與能力；满16與失敗重試亦通過 | 一般入口瀏覽器觸控驗收與已完成交易的真實來源接線 |

A、B的入口／分支清單完整並通過原作對照後，才有足夠依據估算餘下整合與驗收的時間。這不是另一個Owner許可門檻；授權已存在。未達C以前，所有報告維持「正常捕獲返家未完成」。現有狀態交易測試與原作重播各自保留，不代替C。

## 驗證與可重現證據

- [正常入口receipt](HUNT_ENTRY_ENVIRONMENT_REPLAY_2026-09-06.json)：實際loader、來源鏈、10,584個原CPU RNG返回值、15隻初始化、目標指標寫入。
- [受控CPU receipt](HUNT_SPAWN_CPU_CHECK_2026-09-06.json)：1,030組range、11組repair案例。
- `tests/championship-hunt-spawn-cases.mjs`：6/6；與既有movement合跑11/11。
- 全量serial regression：**962/962**，49.564秒，無fail/skip/todo。命令 `node --v8-pool-size=1 --test --test-concurrency=1 tests/*.mjs`。
- `git diff --check`通過。研究生成物為UTF-8/LF。
- 私有原作ROM副本、checkpoint、截圖、完整observer輸出与test log：`R:/Projects/Championship2026/_archive/hunt-environment-2026-09-06`；未進runtime。

研究工具：`trace-hunt-entry-environment.py`（JSON-line觸控及觀察）、`verify-hunt-entry-environment.py`（跨次重播／ROM資料雜湊核對）、`check-hunt-spawn-cpu.py`（隔離CPU probes）。MCP literal搜尋本輪未提供適用的OVL0來源鏈；同位址但不同overlay的結果沒有被當作此函式證據。實作依据來自本專案指定ROM的原CPU執行與反組譯。
