# 地圖精修與場景互動：BM04 潟湖樣板（2026-10-18）

狀態：**本機完成、聚焦測試與正常流程驗證通過；未提交、未推送、未部署。** 依 Owner 2026-10-18 指示與 dot 交接包 `map-polish-20261018/dot-art-direction-v1`（START_HERE、LATEST_SCOPE_V2、DYNAMIC_TERRAIN_ADDENDUM v2、BM04 `selected-layout-v2.json`）。BM04 採中央潟湖 R1；舊沙地橢圓只作歷史參考。

## 1. 這次真的完成了什麼

| 項目 | 狀態 | 證據 |
|---|---|---|
| Blender MCP 連線 | 已修復：Blender 5.2 未裝 MCP 外掛 → 安裝官方 `mcp-1.0.3`、開啟 Allow Online Access 後 `127.0.0.1:9876` 監聽；唯讀場景／物件查詢成功 | 本次工作階段 |
| BM04 精修源檔 | `bm04-island-polish-r2.blend`（由 R1 `master.blend` sha `14fbe8…` 衍生，與 dot 選定來源相同）；可重建腳本 `polish_bm04_r2.py` | `map-polish-20261018/bm04/r2/` |
| 材質／光影 | 透明 Z0 水面＋水下海床（淺灘棚、左中深潭、礁岩斑塊、焦散網）、濕沙、草地植被與小花、岩石頂苔、Khronos PBR Neutral 色彩管理；相機、太陽方向、Z0 平面、六足點、圍欄位置不變 | `qa/bm04-before-after-same-camera.png` |
| 分層輸出 | 底圖（樹冠移除、保留影子）、5 株棕櫚樹冠＋樹幹頂轉軸、水域遮罩、8 格岸浪迴圈（3 岸段裁切）、無縫焦散貼圖、共用邊界光軌 | `layers/`、`export_layers_r2.py`、`pack_runtime_r2.py` |
| 遊戲內環境動態 | 焦散兩層流動、陽光閃點、岸浪交疊循環、偶發湧浪（11–20 秒）、棕櫚隨風、邊界光軌微閃、角色涉水／落地漣漪；全部在既有 ticker、既有 field art 生命週期內 | `battleFieldAmbient.js`、錄影 |
| 招式導電（真正玩法狀態） | 雷系招式命中站在水中的目標 → 連通水域帶電 3 秒（半徑 7 格）→ 對施放方的敵隊每 0.5 秒造成最大 HP 2%（依 THUNDER 能力遞減，≥234 免疫），**HP 下限 1，不致死**；乾地、離地、同隊不受影響；結冰絕緣 | `battleArenaHazards.js`、`dataArenaGrid.js` |
| 測試 | 新增 12 項（導電規則 7、Battle 接入 5）通過；Data Arena 既有 89 項通過；battle 相關套件與乾淨 HEAD 對照**無新增失敗** | 見 §5 |
| 正常流程 | QA 存檔 → 系統 → 對戰 → 練習賽 → 島嶼場；錄影、截圖、進出再進、減少動態 | `qa/` |

## 2. 權責與邊界

- **沿用 Data Arena 格網**：在 `dataArenaGrid.js` 新增 `SHALLOW`（可步行、可導電、不落水）與 `applyShock／chargeAt`／`SHOCK_*` 事件；既有港口／錦標賽地圖不含 SHALLOW，規則不變。沒有第二套地形引擎。
- **一般 Battle 接入**：`battleArenaHazards.js` 以同一格網實例化 BM04 地形資料 `src/data/championship/battle-arena-terrain/field_bm04_01.r2.json`（由鎖定相機逐格射線投到 Z0 判定水／乾地，非由圖片顏色推定）。只在 `battleRuntime` 的既有傷害迴圈與 `stepMatch` 之後讀位置、寫 `currentHp`；**不選招、不移動角色、不碰 RNG、不改原 ROM AI**。
- **預設關閉**：`createBattleRuntime({arenaHazards:true})` 才啟用；目前只在本機 `?arenaHazards=1` 的自由／練習賽開啟。關閉時與原規則逐位元相同（有測試）。
- **元素來源**：沿用畫面已用的 `describeBattleFxMove().palette`，看起來是雷的招式才導電；THUNDER 能力取個體 `fields['080']`（`stats.field80`）。兩者皆屬 OWNER_APPROVED_ADAPTATION，不是原作規則。
- **表現層唯讀**：`battleFieldAmbient.js` 只讀發佈的 view（位置、`arenaHazards` 快照）；環境漣漪與湧浪不推人、不扣血。
- 原作共用邊界 BM00：R1 的 GUIDES 圍欄保留為獨立集合，光軌另成可動層；**依 dot 註記不推定電擊傷害**。BM00 私人 cell 的語意／模型重建尚未完成。

## 3. 地圖／材質 → 招式 → 反應 對照表（首版）

招式以 `battle-moves.r1.json` 的 recordIndex 與 VFX 調色盤分組（攻擊類 kind≤1 且 power>0）：雷 20（66,86,97,143,163,178,210,315,317,320,352,364…）、火 75（50,54,60,61,76,77,84,90…）、水 32（32,34,46,48,52,68,92,110…）、冰 5（219,257,302,303,310）、土 9、風 3、毒 7、草 2。

| 地圖／材質 | 觸發招式 | 場景反應 | 耐性判定 | 持續與恢復 | 視覺提示 | 狀態／測試 |
|---|---|---|---|---|---|---|
| BM04 潟湖水 × 電 | 雷系 20 招命中站在水中的目標 | 連通 SHALLOW 帶電，乾地截斷；施放方敵隊在電域內受傷 | THUNDER ≥234 免疫，以下線性遞減；離地 >6 native px 不受；HP 下限 1 | 3 秒，最後 0.8 秒閃爍；同格新電擊重設擁有者 | 青色電域＋黃色邊界、電弧、命中火花／抵抗藍光 | **已實作＋測試＋遊戲內錄影** |
| BM04 水 × 冷 | 冰系 5 招（待接） | 水面暫時結冰、結冰格絕緣 | — | 沿用 Data Arena 冰壽命／裂冰警告 | 沿用 interactions-v1 冰素材 | 格網規則已有；Battle 端未接 |
| BM04 環境 | 無 | 漣漪、偶發湧浪、焦散、閃點、樹冠擺動 | 不影響玩法 | 循環 | — | **已實作**（減少動態時停用擺動／湧浪，電域仍可讀） |
| BM05 南極冰 × 熱 | 火 75 招、熱雷射（待定義） | 天然冰：受熱→薄冰→裂冰警告→水；失去支撐→落水→回岸 | HEAT／能力；游泳者不落水 | 再結冰時效待定 | 裂紋、水光、警告音 | **待實作**：需天然冰狀態、Battle 落水狀態（native 位置寫入）與回岸規則 |
| BM03 熔岩 × 水 | 水 32 招 | 局部熔岩→冷卻岩面（可走、無熔岩傷害）→回熱警告→熔岩 | 熔岩傷害依 HEAT（`fields['070']`）門檻 | 冷卻時效、回熱警告待定 | 黑岩、變紅裂縫、蒸氣 | **待實作**：需 BM03 熔岩作者標記地形資料與 LAVA／COOLED_ROCK 狀態 |
| BM02 草 × 火／水 | 火 75／水 32 | 燃燒、熄滅、焦痕（沿用 Data Arena flammable） | — | 燃燒秒數、灰燼 | 火焰、焦痕 | 待實作（格網規則已有） |
| BM01／09／10／11 地坪 | 物理衝擊、水 | 短時表面狀態／指定掩體 | — | 短時 | 裂痕、水跡 | 設計候選，須先標記可互動物件 |
| BM06 沙漠 | 水、風 | 濕砂／局部沙塵（非流沙即死） | — | 短時 | — | 設計候選 |
| BM07 電腦空間 | 雷、能量 | 明定能量節點反應，不全場導電 | — | 短時 | — | 設計候選 |
| BM08 地獄 | 水 | 滅火源；確有熔岩才共用冷卻規則 | HEAT | — | — | 設計候選，待地圖材質核對 |
| Data Arena 港口 | 雷（kit 尚無雷招） | 水道導電：格網規則已可用 | 模式內能力 adapter | 同上 | 同上 | 規則已有，需雷系 kit 或新招接入 |
| Data Arena 錦標賽 | 同上 | 同上，保留回合重置 | — | `resetDynamic` 已清電荷 | — | 同上 |

未自行加入：落水即死、永久地圖破壞、Cage／Hunt 破壞地形。數值（3 秒、半徑 7、2%／0.5 秒、THUNDER 234）是首版可調設定，集中在 `BATTLE_ARENA_HAZARD_RULES`，不是 Owner 指定值。

## 4. 效能與資源（桌面 Chrome，非手機驗收）

- BM04 R2 下載 33 檔 805 KB（現行沙地 WebP 302 KB；R1 PNG 3.27 MB）；解碼約 20 MiB（現行 6.9 MiB），主要是 24 張岸浪格。可再提供低畫質只載 4 格。
- 390×844 正常流程：進場 0.9–1.4 秒；rAF 幀時間 p50 16.7 ms、p95 16.8 ms（含電域與漣漪）；進出再進後 p50 不變、無重複 ticker。
- 實體手機、iPhone 尚未驗證。

## 5. 驗證紀錄

- `tests/championship-arena-conduction-cases.mjs` 7／7、`tests/championship-battle-arena-hazards-cases.mjs` 5／5（含 BM04 真實練習戰：關閉時結果與原規則相同；開啟時決定性重現、只電擊電荷擁有方的敵隊、HP≥1）。已登錄 `tests/ci-test-scope.v1.json`。
- Data Arena 既有聚焦套件 89／89。
- 84 個 battle／Data Arena 套件：與乾淨 HEAD worktree 對照，失敗集合相同或更少（既有失敗為本機參考／素材相關，例如 support helpers、licensed runtime、public playtest URL），沒有因本批新增。
- 正常瀏覽器流程（headless Chrome D3D11）：BM04 R2 資產與 5 類層載入；電域峰值 243 格；漣漪、湧浪出現；減少動態下湧浪／擺動關閉、電域仍顯示；離開→結果→重新進入正常。測試用瀏覽器內把兩隻 QA 夥伴改為雷系物種（207、135）以觸發導電，**未修改 repo 內 QA 存檔**。
- 角色 404：牧場角色串流檔在此工作區缺檔，與本批無關。
- 同時段另一代理把對戰鏡頭改為「完整場地、不複製地形」（`createBattleFxCamera({fullArena:true})`，移除鏡像延伸），並讓前景層跟隨場地圖層的位置／縮放。兩者已在同一檔案共存；`r2-final-*` 為合併後的最終實錄（電域峰值 243 格、湧浪、漣漪、p50 16.7 ms），較早的 `r2-thunder*` 截圖仍是舊鏡頭。

## 6. 檔案

repo（未提交）：`src/championship/modes/dataArena/dataArenaConfig.js`、`dataArenaGrid.js`、`src/championship/battle/battleArenaHazards.js`、`src/championship/app/battleRuntime.js`、`battlePresentationSource.js`、`main.js`、`src/championship/presentation/battleFieldAmbient.js`、`vs5/createBattleFieldPixiPresentation.js`、`bm03GroundShadows.js`、`src/data/championship/battle-arena-terrain/field_bm04_01.r2.json`、`assets/production/battle/bm04-island-polish-r2/`（33 檔＋manifest）、兩個測試檔與 CI scope。

repo 外（製作資料，不進首載）：`R:\Projects\Championship2026\map-polish-20261018\bm04\`：`source-r1-copy/`（未改動的 R1 副本）、`r2/bm04-island-polish-r2.blend`、`r2/scripts/`（polish／export／pack）、`r2/layers/`（全解析度 PNG）、`r2/qa/`（對照、截圖、MP4）；`session-backup/`（開檔前保存的 Blender 未命名場景）；`blender-mcp-addon/mcp-1.0.3.zip`。

本機檢視：`championship.html?battleReview=bm04-lagoon-r2&arenaHazards=1`（練習賽選「ISLAND」）。

## 7. 待完成（依序）

1. Owner 確認 BM04 R2 美術與導電數值後，再決定是否移出本機 review、預設啟用哪些模式。
2. BM05 南極：天然冰狀態＋Battle 落水／回岸（需在 Battle 加入有界的「落水」狀態並寫入 native 位置，屬新增，需先寫契約）。
3. BM03 火山：熔岩作者標記、LAVA／COOLED_ROCK、HEAT 免傷。
4. BM00 共用邊界依私人 cell 完成語意與獨立模型；其他 10 張 Battle、Cage、Hunt、Data Arena 依 dot 清單分批精修與環境動畫。
5. 實體手機效能與觸控驗收。

## 8. 第二批：BM05 南極、BM03 火山（2026-10-18 晚）

依 Owner：場景版型照 R1（BM05）／Owner 選定 R2（BM03），精細度、光影、材質照 dot candidate；不要圓圈場地，保留場地邊緣裝置。BM04 導電數值維持「可調測試版」。

| 項目 | BM05 南極（`?battleReview=bm05-polar-r2`） | BM03 火山（`?battleReview=bm03-volcano-r3`） |
|---|---|---|
| Blender | `map-polish-20261018/bm05/r2/`：亮雪、藍色陰影、閃點、鮮豔海水、青色冰壁；邊界柱內淡藍薄冰紋 | `map-polish-20261018/bm03/r3/`：熔岩橘黃帶殼、近熔岩玄武岩發光裂紋、暖光 |
| 分層 | 底圖、破冰後海水、裂冰、海面遮罩、浮冰間浮冰泡沫 8 格、海浪閃光、邊界光軌 | 底圖、冷卻岩殼、回熱紅裂紋、熔岩遮罩、流動熱光、邊界光軌、火星來源點 |
| 地形資料 | `field_bm05_01.r1.json`：邊界柱凸包內縮一格＝天然冰（897 格），外圈雪地為岸 | `field_bm03_01.r3.json`：西側熔岩溝＋中央裂口（166 格），六足點皆在實地 |
| 玩法 | 火系命中→天然冰受熱→裂冰警告 2.6 秒→開裂成水→站上者落水（下沉 0.8 秒、6% HP、最低 1）→送回有完整 3×3 站立空間的最近岸點、2 秒保護→9 秒自動回凍；冰系招式立即回凍 | 熔岩每 0.5 秒 3% HP（依 HEAT＝個體 070 遞減，≥234 免傷，最低 1）；水系命中→8 秒冷卻岩（安全）、最後 2 秒回熱警告→回熔岩；重複冷卻只重設不疊加；HEAT 不免落水／電擊 |
| 測試 | `championship-battle-arena-ice-cases.mjs` 6 項 | `championship-battle-arena-lava-cases.mjs` 3 項 |
| 遊戲內 | 最高開裂 24 格、落水 7 次全部回岸、p50 16.7 ms | 燒傷 112／90、冷卻 40 格、回熱警告與恢復、p50 16.7 ms |
| 資源 | 14 檔 610 KB | 6 檔 751 KB（冷卻／回熱層近全寬，低畫質可再裁） |

重要限制（如實）：火、水全是 kind-1 特殊招式，原作 AI 很少命中，所以一般對戰中融冰／冷卻熔岩是偶發事件（固定測試以 seed 16 記錄到一次開冰）。遊戲內示範用本機 `battleFxDebug` 的 QA 觸發（同一規則在指定夥伴腳下加熱／灑水／放置），不是玩法。全 battle／Data Arena 套件與乾淨 HEAD 對照無新增失敗；導航測試曾因 QA hook 放進 `mountBattleField` 失敗，已移出並恢復 18／18。未提交、未推送、未部署；實體手機未驗。

## 9. 第三批：依 R1 修正版參考完成 11 張對戰地圖（2026-10-18 夜）

依 dot `battle-art-corrected-r1-20261018`：幾何、相機、物件、站位與通行一律以真 R1 `.blend`（已用索引 SHA-256 逐張核對；BM03 依 Owner 選定 R2）為準；修正版只借材質、色彩、光影。未套橢圓場；BM10 場線未改動（只調整 `fine terracotta sporting earth` 材質，場線材質與幾何不碰）；BM03 上部發光裂紋只作材質，不新增熔岩地形。

| 地圖 | 精修（Blender 5.2 經 MCP） | 遊戲內環境動態（表現層） |
|---|---|---|
| BM01 訓練土場 | 土色飽和／明度、草皮、樹葉 | 6 組樹冠擺動、雲影、塵埃、燈具微光、邊界光軌 |
| BM02 草原 | 草地黃綠、樹葉、泥土 | 10 組樹冠、草面風紋（只在草地遮罩內）、雲影、花瓣 |
| BM03 火山 | 改灰色玄武岩、裂紋只在熔岩邊、熔岩飽和橘黃、壓低西側反射燈 | 熔岩流光、火星；（玩法：燙傷／水冷／回熱，第 8 節） |
| BM04 潟湖 | 提亮青綠、深潭降藍、焦散網減弱 | 焦散、閃光、浪花、湧浪、棕櫚、漣漪；（玩法：導電） |
| BM05 南極 | 冰壁更飽和半透明青、海更深 | 海浪閃光、浮冰泡沫、飄雪；（玩法：融冰／落水） |
| BM06 沙漠 | 淡暖沙色、岩壁 | 13 組多肉／草擺動、沙面風紋、沙粒、雲影 |
| BM07 電腦設施 | 地板、面板 | 2 座風扇旋轉、螢幕／導管脈動、地板掃描光、資料粒子 |
| BM08 地獄地城 | 石板 | 燈火閃爍＋光暈、3 坑洞冒煙、靈魂粒子、邊界光軌 |
| BM09 古代競技場 | 石灰岩暖色 | 樹冠與旗幟擺動、雲影、塵埃、燈具微光 |
| BM10 體育場 | 紅土鮮橘、座椅 | 記分板／燈具亮度變化、雲影 |
| BM11 室內體育場 | 黃綠人工草、座椅 | 記分板／燈具亮度變化、光塵 |

- 檢視：`championship.html?battleReview=arena-polish-20261018&arenaHazards=1`。練習賽只能選 0–5、7 號場；BM07／BM09／BM10／BM11 以既有 `?battleArt=field_bm0X_01` 覆蓋在真戰鬥中驗證。
- 互動玩法本批未新增（BM01／02／06–11 只有環境動態）；BM04 導電、BM05 融冰落水、BM03 熔岩維持可調測試版數值。
- 低畫質（saver）：粒子 40%、單層焦散、關閉地面風紋，浪花只載一半影格（記憶體減半）；減少動態：停止擺動、旋轉、湧浪與掃描，危險區域仍以靜態方式可讀。
- 測試觸發（本機 `battleFxDebug` 的 heat／water／place）與正常玩法分開驗證：正常流程跑 11 張圖不使用任何觸發。

### 提交

- `d2779e99` feat(battle): opt-in arena hazards on the shared Data Arena grid
- `11b90104` feat(battle): layered ambient field presentation for polished arenas
- `d7e01ac5` art(battle): Blender-polished layered arenas BM01-BM11 (local review)（4.6 MB，只走 review manifest）
- `a0551b10` perf(battle): saver tier loads every other ambient foam frame
- 本報告另以文件提交。
- 同一工作區另有代理正在改 Data Arena（水龍捲／冰柱）、戰鬥戰術手牌、商店與 UI；其未提交內容未被納入任何提交（以「HEAD＋我的修改」重建暫存檔，並在乾淨 HEAD worktree 驗證 167／168，唯一失敗為既有 playtest URL 案例）。對方的前景對齊修正因專屬於本功能而一併納入。
- 未推送、未部署。

### 驗證（本機，2026-10-18）

- 單元／契約：危險地形 32 案（導電 7、戰鬥危險 5、融冰 6、熔岩 3，及 Data Arena 既有案）全過；戰鬥／Data Arena 回歸與 HEAD 基準相比無新增失敗（既有失敗：support helpers、licensed runtime、public playtest URL 等，與本批無關）。
- 正常流程（Playwright 開 Chrome，390×844 觸控，無任何測試觸發）：BM01–BM11 全部以 `arena-polish-20261018` 載入分層美術；畫面時間 p50 16.7 ms／p95 ≤ 16.8 ms，無 page error。BM02 第一次在登入頁等待網路閒置逾時（其他任務的音樂檔 404／串流讓頁面不閒置），改等 `load` 後重跑通過（載入 934 ms）。
- 低畫質＋手機效能模擬（saver、CPU 降速 4 倍）：

| 地圖 | 載入 | p50 | p95 | 最大 |
|---|---|---|---|---|
| BM02 | 878 ms | 33.4 ms | 50.1 ms | 66.6 ms |
| BM03 | 2072 ms | 50.0 ms | 83.3 ms | 100.1 ms |
| BM04 | 927 ms | 33.4 ms | 50.0 ms | 50.1 ms |
| BM05 | 913 ms | 33.4 ms | 50.1 ms | 99.9 ms |
| BM07 | 860 ms | 33.4 ms | 50.0 ms | 50.1 ms |
| BM08 | 886 ms | 33.4 ms | 50.1 ms | 50.1 ms |
| BM04（高畫質環境動態＋降速 4 倍） | 887 ms | 33.3 ms | 50.0 ms | 50.1 ms |

  降速 4 倍下多數地圖約 30 fps；BM03 最重（約 20 fps，載入 2 秒），是下一步優化對象（熔岩流光與火星層）。BM04 高畫質與低畫質在降速下幾乎相同，表示瓶頸不在環境動態層。
- 這是桌面 Chrome 的 CPU 降速模擬，**不是實體手機驗收**；實體手機（iOS Safari／Android Chrome）尚未測。
- 紀錄、截圖與影片在工作區外 `map-polish-20261018/qa-20261018/`（不進 repo）。

### 狀態

- 本機 main 已提交 4 筆（上列）＋本報告；**未推送、未部署、未上線**。
- 未完成：BM01／02／06–11 只有環境動態，尚無招式 × 地形互動；牧場／狩獵／Data Arena 地圖精修未做；實體手機未測；BM03 低階機效能待優化；其他代理的未提交工作保持原狀未動。

## 10. 安全整合（2026-10-19）

- 備份：本機 main 的 19 個已修改檔與 121,676 個未追蹤檔（8.97 GB）逐檔 SHA-256 打包在 `R:\Projects\Championship2026\_backups\worktree-20261019\`（`worktree.tar`、`manifest.json`、`tracked.diff`、`status.txt`）；抽 319 檔（全部 19 個修改檔＋300 個隨機未追蹤檔）還原比對全數一致。本機 main 另留 `backup/map-polish-local-20261019` 分支指向原五筆提交。
- 整合分支 `feat/map-polish-integration-20261019`：從最新 `origin/main`（`42252b41`）建立，依序 cherry-pick 五筆。唯一衝突是 `tests/ci-test-scope.v1.json` 同一處各加一行測試，逐段保留雙方並維持字母序。遠端鏡頭修正（`1d9009f0`，相機限制在地圖內、移除鏡像延伸）與本批前景對齊自動合併，已人工核對。
- 與 Gemini 未提交工作的隔離：`battleFieldAmbient.js` 在未追蹤期間被加入水龍捲／冰柱的繪製掛鉤，一併進了原提交；整合分支以單獨提交移除（本分支沒有任何程式會發出這些事件，畫面不變）。卡片、補給、進化、水龍捲、冰柱均未混入。地圖互動不依賴它們。
- 修正兩個整合問題：來源防火牆測試登記 `battleArenaHazards.js`；`battleRuntime` 改由 app 在本機 `?arenaHazards=1` 時動態載入危險地形層，公開模組閉包不再含它。
- 驗證（整合分支，獨立 worktree＋獨立 `npm ci`，伺服器 8771）：
  - CI 測試 2654／2654 通過；技術建置稽核通過（453 模組）。
  - `build:playtest` 依設計拒絕：8 個已核准原始檔雜湊變更，需 Owner 重新核准後才可能發布；未更動核准紀錄。這也代表誤推 main 會被部署檢查擋下。
  - 一般玩法（無觸發）11 張直向＋4 張橫向：載入 0.84–0.93 s，p50 16.7 ms／p95 ≤ 16.8 ms；34 張截圖無黑邊。開關關閉＝預設美術且無危險狀態；只開美術預覽＝精修圖、無危險狀態。
  - 測試觸發另跑：BM05 融冰→落水→回岸、BM03 燙傷→回熱警告→恢復、BM04 導電；一般玩法 10 秒內未自然觸發，不計為已接入正式玩法。
  - 已知差異：精修戰場的烘焙地面陰影接收面是未入庫的本機候選，整合分支退回既有簡易圓影（有 `SHADOW_FALLBACK` 警告）；正式地面陰影列入對戰批次。
