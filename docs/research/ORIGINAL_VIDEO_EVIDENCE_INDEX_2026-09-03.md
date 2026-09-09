# Championship 原作影片與 ROM 證據總索引

日期：2026-09-03。目標：**同樣的玩家操作，在同樣條件下，造成同樣的遊戲狀態變化，並提供可辨認的原作回饋與後續選擇。** 9:16 現代化版面可以調整資訊配置，但不能用換背景、泛用 CARE 或單一捕捉按鈕取代原作玩法。

本次依 [統整任務](../coordination/CODEX_VIDEO_EVIDENCE_CONSOLIDATION_PROMPT.md)只整理文件、補 Claude 對照與工具列指定註解。toolbar、時鐘、牧場拼接等實作**尚未獲本次授權**；既有工作區出現相關程式，不代表本次新增、已批准或已驗收。沒有修改遊戲程式、素材、測試、production index 或 shippingReady；沒有 commit／push。

## A. 來源與判讀優先序

| 代號 | 來源 | 用途與限制 |
|---|---|---|
| V | [BV13u411B7BK](https://www.bilibili.com/video/BV13u411B7BK/)，数码宝贝---冠军，13:17；[系統分析](video-BV13u411B7BK/ANALYSIS_ZH_TW.md)、[52 條 JSON](video-BV13u411B7BK/VIDEO_OBSERVATIONS.json) | 時碼、UI 位置與流程的主要影片證據。英文實機、既有存檔；常見 HP／TP 9999、Funds 9999999，作者提及作弊，不據此推正常倍率或經濟 |
| B2 | [BV1RQ4y1B7up](https://www.bilibili.com/video/BV1RQ4y1B7up/)，数码宝贝冠军赛前期攻略，7:52；[補充分析](video-BV1RQ4y1B7up/ANALYSIS_ZH_TW.md)、[20 條 JSON](video-BV1RQ4y1B7up/VIDEO_OBSERVATIONS.json) | 捕捉中間狀態、牌照、非對稱賽事及日曆。剪輯攻略以英文畫面為主，另有日文實拍；作者的字幕、圖表、左右比較不是遊戲 UI |
| C | [Cursor 現場觀看](video-cursor-live-watch-2026-09-03/CURSOR_LIVE_WATCH_ZH_TW.md) | 粗掃與產品映射。不得覆蓋 V／B2 的精準影格；其中已撤回的說法見 B 節 |
| A | [Claude 原作稽核](https://claude.ai/code/artifact/47455915-26d7-4a98-a874-b5e4b48fe12f)，2026-09-02，含 09-03 第三輪；[本機摘要](../coordination/CODEX_VIDEO_EVIDENCE_CONSOLIDATION_PROMPT.md#6-claudechampionship-原作對照稽核正文摘要2026-09-02) | 修正網址末尾 f 後已讀正文；收到統整指令後改用本機摘要繼續，不再抓外部頁。歷史現況須與現有程式分開，不能把整頁都當已驗證規格 |
| R | 日文 YDIJ ROM 研究；[工具列](../contracts/championship/CHAMPIONSHIP_TOOLBAR_CONTRACT.v1.json)、[頂欄／時間](../contracts/championship/CHAMPIONSHIP_STATUS_BAR_CONTRACT.v1.json)、[Cage 組合](../contracts/championship/CHAMPIONSHIP_CAGE_RANCH_COMPOSITION_CONTRACT.v1.json)、[Gate 3D](../contracts/championship/VS2_GATE_SELECT_3D_RUNTIME_CONTRACT.v1.json)、[Hunt 輸入追蹤](HUNT_FIELD_INPUT_ROM_TRACE_2026-08-29.md) | 已追的結構／呼叫與尚未追的語意分開。英文影片不直接證明日文 ROM handler 或文字索引 |
| P | [Owner Direction](../coordination/OWNER_DIRECTION.md)、[Production Index](../../assets/production/ART_PRODUCTION_INDEX.json) | 2026-09-02 授權像素及產品呈現方向。不是新的原作發現；舊合約對素材的一般禁令不能蓋過這項明示方向 |

ROM SHA-256：`8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`。本次讀取既有解碼與追蹤結果，沒有重新 dump ROM。

本次另直接核對研究根目錄下的 `research-only/YDIJ_FULL_ROM_DECONSTRUCTION_2026-08-29/analysis/text/help_text_txt.csv`、同層 `analysis/NXR_SCENE_REGISTRY_96.csv`，以及 `YDIJ_BATTLE_REVERSE_CLOSURE_STAGE4_2026-08-24/derived/NSBMD_LOADER_XREF_CENSUS.csv`。根目錄位置以 [original-evidence 說明](../../research/original-evidence/README.md)為準。原作文字與影格維持研究用途；本機影格仍在 `R:/Projects/Championship2026/_archive/video-research/`，未複製進 repo。

| 標記 | 本索引的意思 |
|---|---|
| `VIDEO_OBSERVED`／`LIVE_FOOTAGE_OBSERVATION` | 保存影格直接看到的配置、文字或狀態；不是觸控事件或程式追蹤 |
| `ROM_VERIFIED`／`ROM_TEXT` | 既有追蹤已驗證的結構／呼叫，或本次讀到的原作解碼說明文字；後者不等於數值公式已解 |
| `PRODUCT_MAPPING`／`PRODUCT_AUTHORED` | 2026 的渲染邊界、適配或暫定實作，不冒充原作規則 |
| `WITHDRAWN`／`過期` | 已撤回的判讀／不再符合工作區的歷史描述 |
| `UNKNOWN_REQUIRES_TRACE` | 尚不能決定內部規則、參數、事件或分支；不可用常見遊戲慣例補成原作真值 |

## B. 已撤回聲明與命名界線

| 狀態 | 不再採用的說法 | 採用的證據 |
|---|---|---|
| `WITHDRAWN` | 第一支影片沒有 Gate；把 12:00 的牧場當作結論 | V05／V51：[00:45](https://www.bilibili.com/video/BV13u411B7BK/?t=45)、[12:41](https://www.bilibili.com/video/BV13u411B7BK/?t=761) 都有球形世界選擇 |
| `WITHDRAWN` | 第一支沒有套繩，或把尾段 Normal Wire 當成套繩 | V08–V10：[01:01 起](https://www.bilibili.com/video/BV13u411B7BK/?t=61) 的畫圈／Pull；V50：[12:30](https://www.bilibili.com/video/BV13u411B7BK/?t=750) 是地面阻擋用 Wire。**Wire ≠ Rope** |
| `WITHDRAWN` | 將影片球形世界直接命名為 `earth.nsbmd` | 可追的 Gate 模型是 **`3D_worldMap_model`（world）**，OVL12 `0x0210C6FC`；earth 不能因名稱或形狀類似就代入 |
| 過期 | 戰鬥仍只有色點、沒有場地美術 | Owner／Cursor 確認授權 11 張戰場；現有 manifest 亦有 11 個 field。場地存在與完整戰鬥回饋是不同完成度 |

`earth.nsbmd`、`desktop/Desktop_Launcher` 有資產，但目前追蹤未建立對應 loader／可達流程；產品方向明確不掛載，僅供研究／設計參考。不要把「未追到」寫成窮盡證明不存在任何可能呼叫，也不要據資產存在新增 Desktop hub 或獨立 earth 星球關。

工具列數法固定：**影片左起第 1–8 格 = ROM slot 0–7**；第 7 格是 **slot 6**，第 8 格才是 **slot 7**。有位置映射不等於有 command handler 映射。

## C. 雙螢幕到 9:16：保留資訊與操作關係

先用「實體上螢幕／實體下觸控螢幕」描述影片。**不可把上＝MAIN、下＝SUB 當成硬體永遠不變的對應。** Cursor 粗稿的該簡寫與其 sub≠下螢幕提醒有矛盾；Gate 合約 `10_inputBehaviorEvidence` 也曾據此把說明面板放錯邊。`training_sub_scene.nxr` 的名稱屬引擎／資產命名，片中的 HP／TP／AP、暱稱、概覽及 log 在上方。影片確定位置，精確引擎綁定仍由呼叫追蹤負責。

| 模式 | 實體上方 | 實體下方／觸控 | 2026 `PRODUCT_MAPPING` |
|---|---|---|---|
| Training | 頂欄、選中角色資料、場地概覽、紀錄 | 多塊場地、角色、物品、局部提示；底部工具；工具上方子選單 | DOM 管資訊、文字與選單；單一 Pixi 場景呈現連續牧場及直接互動 |
| Cage Edit | 名稱、縮圖、效果、建議收容數 | 綠色六角板、不等形模組、ID／Size／Return | DOM 詳情與操作列；Pixi 呈現可操作空間。資料槽、外形、空間成本不能合併 |
| Gate Select | 地點說明、預覽、Entrance Fee、Funds | world 球、選點、Settings／Return | 有界 Three 世界球；DOM 提供資料與確認，不增加 earth 流程 |
| Hunt | 頂欄、雷達、目標情報、容量相關槽與出擊倒數 | 局部野外、目標、繩索／提示；底部工具 | Pixi 地圖、角色、捕捉線、Pull／目標條；DOM 情報和工具。捕捉回饋不交給戰鬥 Nitro VFX |
| Shop／Loadout | 選中商品或裝備說明、價格／持有量 | 分類、候選、工具槽、數量與交易確認 | DOM 保留「選擇 → 詳情 → 提交」關係，避免把持有、裝備與購買當同一步 |
| 戰前／戰鬥 | 戰前詳情；戰中雙方總覽、隊名、倒數 | 戰前編隊、策略與提交；戰中 2D 場及演出 | DOM 決策與 HUD；Pixi 場地／角色；已驗證事件才驅動有界 Three 戰鬥／天氣 overlay |
| 結果／日曆 | 隨狀態顯示結果摘要或時間 | 結果處理、確認、日程選擇 | DOM 表達順序、返回、資源變化與條件分支；不是把全部 NXR 強制排成必播流程 |

一塊 9:16 畫面保留頂部全域狀態、主要可操作世界、隨選中目標變化的詳情、底部情境工具與按需選單；具體比例與折疊方式屬產品設計。NXR 的 256×192 座標用來理解相對關係，不能直接抄進出貨 CSS。**有 3D 特效不代表牧場、Hunt 或戰場改為完整 3D。**

## D. 功能、畫面與流程證據索引

下列 V／B2 編號連回 A 節 JSON；時間連結採既有 seek 目標，保存影格的顯示時間可能晚約一秒或數秒。此表是路徑索引，不覆寫原觀察。

| 項目 | 證據檔／代表時間 | 對 2026 的含義與未知 |
|---|---|---|
| Boot → Continue → Training；該路徑無 Desktop／Today | A 的讀檔觀察；V01 [00:10](https://www.bilibili.com/video/BV13u411B7BK/?t=10)、V02 [00:23](https://www.bilibili.com/video/BV13u411B7BK/?t=23)，見 [V 分析](video-BV13u411B7BK/ANALYSIS_ZH_TW.md) | V 索引直接保存 LOGIN 與 Training，**沒有完整 Data loaded 中間影格**；完整 Continue 敘述歸 A，不能偽稱 52 條已逐步證明。所有 New Game／事件日分支仍 UNKNOWN |
| 頂欄與時間 | V02／V46 [11:30](https://www.bilibili.com/video/BV13u411B7BK/?t=690)；[時間合約](../contracts/championship/CHAMPIONSHIP_STATUS_BAR_CONTRACT.v1.json) | 季節／日／模式／HH:MM，共用時鐘；cascade 4,8,24,60,400 來自 ROM。Shop 時鐘是否在所有子頁隱藏仍需分頁驗證，不把取樣缺值當全域規則 |
| 八格工具與管理五項 | V15 [01:57](https://www.bilibili.com/video/BV13u411B7BK/?t=117)／V32；[工具列合約](../contracts/championship/CHAMPIONSHIP_TOOLBAR_CONTRACT.v1.json) | 第 7 格＝slot 6：Tamer、Schedule、Cage Edit、Digimon、End Day；文字／位置為影片證據，handler UNKNOWN |
| 系統六項 | V13 [01:30](https://www.bilibili.com/video/BV13u411B7BK/?t=90) | 第 8 格＝slot 7：Help、Database、Battle、Save & Quit、Hunt、Shop。Digimon 與 Database 是不同入口，不能合成同一功能 |
| 六類照護 | V03 [00:30](https://www.bilibili.com/video/BV13u411B7BK/?t=30)、V46；合約 toolVocabulary；help #137–141、#143 | 手掌、食物、清掃、藥、傷藥、蛋白質有不同對象與效果；六類不是任意排入六格。#137–141 分述飢餓／蛋白質／清掃／傷藥／藥；#143 只講手掌可搬籠／撫摸，不能當成六類清單。蛋白質在合約原為 EXTERNAL_CROSSCHECK，影片補強可見使用，全部數值／handler 仍需追蹤 |
| 籠子編輯 | V16／V17 [02:00](https://www.bilibili.com/video/BV13u411B7BK/?t=120)、V44 [10:30](https://www.bilibili.com/video/BV13u411B7BK/?t=630) | 六角板與跨相鄰格輪廓直接可見；Occupancy ≠ 占地格數。slot 座標、ownership、合法放置規則 UNKNOWN，不能用單格假設蓋掉外形 |
| 連續牧場／環境訓練 | V04 [00:38](https://www.bilibili.com/video/BV13u411B7BK/?t=38)、V45／V47 [12:00](https://www.bilibili.com/video/BV13u411B7BK/?t=720) | 多個地形、角色、道具同時存在；場地配置會影響養成，不能只換一張背景。效果公式不由浮字倒推 |
| Gate／出發前配置 | V05 [00:45](https://www.bilibili.com/video/BV13u411B7BK/?t=45)、V48–V51 [12:41](https://www.bilibili.com/video/BV13u411B7BK/?t=761)；[Gate 合約](../contracts/championship/VS2_GATE_SELECT_3D_RUNTIME_CONTRACT.v1.json) | Three world 球、地點資料／費用、Settings／Return；裝備和地點有不同層級。world loader 已追，旋轉／吸附／精確 rank 和費用表 UNKNOWN |
| Hunt 鏡頭與工具 | V06–V07 [00:52](https://www.bilibili.com/video/BV13u411B7BK/?t=52)、V50 [12:30](https://www.bilibili.com/video/BV13u411B7BK/?t=750)；[輸入 ROM 追蹤](HUNT_FIELD_INPUT_ROM_TRACE_2026-08-29.md) | 空地拖曳移鏡頭，不是主角走路；Wire 放地面阻擋，Rope 圈住／拉扯；捕捉操作優先消耗輸入，不能同時拖鏡頭 |
| 圈繩／Pull／手掌收取 | V08–V10 [01:01](https://www.bilibili.com/video/BV13u411B7BK/?t=61)；B2-09–12 [04:27 起](https://www.bilibili.com/video/BV1RQ4y1B7up/?t=267)、B2-14–16 [05:00 起](https://www.bilibili.com/video/BV1RQ4y1B7up/?t=300) | 路徑圍繞目標 → Pull 與連線 → 倒下／紅手 → 手掌收取；ROM help #104 明示 HP 歸零後捕捉進記憶卡。精確觸控、條的綁定、拉力與耐久公式 UNKNOWN |
| 捕捉後結果管理 | V11–V12 [01:09](https://www.bilibili.com/video/BV13u411B7BK/?t=69)／[01:12](https://www.bilibili.com/video/BV13u411B7BK/?t=72) | 離場確認與 New／命名／放生／容量處理分開；手掌收取進記憶卡，不等於正式飼育名單／存檔已提交；超額處理仍 UNKNOWN |
| Shop | V14 [01:45](https://www.bilibili.com/video/BV13u411B7BK/?t=105)、V31 [06:49](https://www.bilibili.com/video/BV13u411B7BK/?t=409)、V41–V43 | 上方詳情、下方分類／卡片／數量／確認；單價、總額、Funds、持有狀態須各自有意義。商品表存在不等於交易 UI 等價 |
| 戰前組隊／策略 | V18–V22 [02:42](https://www.bilibili.com/video/BV13u411B7BK/?t=162)、[02:52](https://www.bilibili.com/video/BV13u411B7BK/?t=172) | 類型／賽事 → 對手 → 己方名單／成員／策略 → 雙方與場地總覽 → Battle；策略全集、match→arena UNKNOWN |
| 自動戰鬥／結果 | V23–V25 [03:00](https://www.bilibili.com/video/BV13u411B7BK/?t=180)、V37–V38 [08:00](https://www.bilibili.com/video/BV13u411B7BK/?t=480) | 上方總覽、下方自動活動及演出；結果有專用呈現。影片不能推出 AI／命中公式或所有干預機制均不存在 |
| 三種不同結束動作 | V33–V35 [07:11](https://www.bilibili.com/video/BV13u411B7BK/?t=431)、V11、V52 [13:12](https://www.bilibili.com/video/BV13u411B7BK/?t=792) | End Day 推進日曆；退出 Hunt 進結果；Save & Quit 結束遊戲。確認、時間、保存後果不能混成一個命令 |
| 牌照與長期成長 | B2-02–03 [00:45](https://www.bilibili.com/video/BV1RQ4y1B7up/?t=45)、[01:00](https://www.bilibili.com/video/BV1RQ4y1B7up/?t=60)；help #145／146 | Tamer rank／牌照控制進化階段；容量、Cage 空間與參賽資格各有資訊。英文 Ultimate＝完全體，Mega＝究極體；精確門檻 UNKNOWN |
| 非對稱人數／資格 | B2-06 [04:00](https://www.bilibili.com/video/BV1RQ4y1B7up/?t=240)、B2-19 [06:00](https://www.bilibili.com/video/BV1RQ4y1B7up/?t=360)、B2-07／18／20 | 包含 3 對 1、1 對 3；Species 與 Attribute 限制分開，不能只支援對稱隊伍；不合資格的完整回饋 UNKNOWN |
| 賽程／八日曆 | B2-07 [04:10](https://www.bilibili.com/video/BV1RQ4y1B7up/?t=250)、B2-17 [05:10](https://www.bilibili.com/video/BV1RQ4y1B7up/?t=310) | 季節選擇、賽事詳情、八日摘要支援安排養成與出賽；作者左右比較不是原作雙面板，勾選計數／紫色語意 UNKNOWN |

### D1. 玩家系統層級與「玩起來一樣」的判準

這是分析分類，不是原作同名路由，也不是新工單。每項都要保留「入口 → 操作 → 條件 → 狀態改變 → 回饋 → 返回／下一步」。

| 層級 | 玩家在做什麼 | 等價判準 |
|---|---|---|
| 長期管理 | rank、牌照、日程、成長、資金、容量 | 一樣的限制與進展能被看見、理解及預先準備；不同容量不能混用 |
| 功能入口 | 從 Training 到管理、Hunt、Shop、Battle 等 | 兩組工具子選單的功能與返回關係完整；不以自創五鈕當原作證據 |
| 準備流程 | 配置 Cage、裝備、選 Gate、參賽、編隊、挑商品 | 選擇與提交分開，條件與代價在提交前可見，取消不誤執行 |
| 場內操作 | 手掌搬動、放食物、清掃、畫繩、拉繩、收取 | 相同工具對相同目標作用；鏡頭拖曳、對象操作、捕捉手勢不互相搶用 |
| 自動模擬 | 角色需求、環境訓練、進化、時間流逝、自動戰鬥 | 規則來源可追，不因現代 UI 或美術替換改變數值、觸發或優先序 |
| 結果／再決策 | 獎勵、牌照、去留、命名、跳日、保存 | 回饋與真實狀態一致；確認和不同結束操作保留原有後果 |

完整等價還需要正常存檔的連續操作與已追函式比對，覆蓋成功、取消、失敗、資源不足、資格不足、超額及讀檔恢復。**72 條影格足以固定主要 UI／流程方向，不能宣稱全部數學、分支、時序已閉合或已可完整同玩。**

## E. 與目前產品的差距：分清素材、程式與已驗收行為

工作區基準 HEAD：`d0c48f340baac61cf399bf5bd5922ce58f3d38c7`，另有修改／未追蹤檔案；下表是唯讀查檔，不是本次實作或遊戲實測。[CURRENT_PRODUCT_STATUS](../CURRENT_PRODUCT_STATUS.md) 日期為 **2026-08-30**，勿當授權美術現況；本次依範圍不更新該檔。

| 項目 | 已存在／本次核對 | 差距與狀態 |
|---|---|---|
| catalogs／素材 | 既有商店 118、Cage 身分、Hunt 裝備與綁定、角色／圖鑑資料；[production index](../../assets/production/ART_PRODUCTION_INDEX.json) 登錄授權包 | 不再列成全部缺資料。216 為遊戲內圖鑑可見數；224 為 8 蛋＋216 美術槽；228 為 ARM9 物種記錄，不能互改 |
| 工具／導覽／CARE | [raisingHomeP1RView.js](../../src/championship/app/raisingHomeP1RView.js) 仍建立 disabled RAW 格與 CARE；[main.js](../../src/championship/app/main.js) 仍建立五顆目的地 nav | **仍有差距**：原作情境工具與兩組子選單尚未成為可操作入口 |
| 四欄頂欄 | [championshipStatusBar.js](../../src/championship/app/championshipStatusBar.js) 已建立四欄，main.js 已接 render | **「只有 08:00」已過期**；已有路徑不代表本次授權／驗收。End Day 仍是暫放頂欄，原作入口在子選單 |
| 世界時鐘 | [championshipWorldClock.js](../../src/championship/time/championshipWorldClock.js) 及 raising reducer 已有進位／End Day | **「完全沒有時間模型」已過期**。十分鐘換算函式本次搜尋只見定義，尚不能宣稱跨模式即時推進、保存與季節效果全部接妥 |
| 牧場拼接 | [runtimeMapArtBundle.js](../../src/championship/presentation/runtimeMapArtBundle.js) 已有 tile set；main.js 從 placements 經 layout 載入多塊 | **「程式只有單張 loader」已過期**。原作外形、座標、排列及回饋是否等價未驗收；Hunt 仍維持一次一張場地 |
| Raising HUD | 現有 COMPANION LINK 與部分狀態呈現 | 原作角色數值、暱稱、場地概覽與 log 的完整關係仍是差距；75 個節點不等於要在手機排 75 個控件 |
| Gate | [gateCatalog.js](../../src/championship/gate/gateCatalog.js) 仍 AVAILABLE；讀取的 Gate 資料沒有費用／rank 門檻；[vs2Screens.js](../../src/championship/app/vs2Screens.js) 有 LIST VIEW | 原作費用、rank、選點回饋與晝夜選擇規則未閉合。列表為產品適配，不冒充原作；本次不新增門檻或扣款 |
| 戰鬥場 | [Battle manifest](../../assets/production/battle/licensed-runtime-v1/manifest.json) 有 11 field、runtimeEligible true，main.js 已有載入路徑；Cursor 記錄 contain-fit | **色點／沒有場地的描述過期**。VS HUD、站位、隊伍／策略、事件演出與結果分支仍須各自核對 |
| VFX | [VFX manifest](../../assets/production/vfx/licensed-runtime-v1/manifest.json) 有 26 system，預設不掛載、`?vfxArt=` 預覽、gateEarthMounted false | 套件存在不等於戰鬥／天氣呼叫端已綁；本次不發明命中、Hyper、天氣觸發。捕捉線和 Pull 留在 Pixi |

`PRODUCT_MAPPING`：DOM 管現代 UI；一個 Pixi Application 管 2D 遊戲呈現；Three 僅用於 world 與有界 VFX。授權材料須位於 `assets/production/`、由 Production Index 登錄且 runtimeEligible true；研究包不可由遊戲 fetch。`shippingReady` 維持 false，`gateEarthMounted: false` 維持。舊 Gate 合約一概不准授權轉換素材的條文依 09-02 Owner Direction 更新解讀，不能誤阻已有素材，也不能擴張成本次素材製作授權。

## F. 禁止憑影片或命名發明的事項

| 類別 | 必須保留 UNKNOWN 的部分 |
|---|---|
| 捕捉 | 閉合容差、圈數、拉力／耐久／斷繩／傷害公式、多目標上限、觸控觸發細節；綠條不先命名成耐力，紅條不先命名成倒數 |
| Cage | slot 座標、索引到格子、錨點、空間成本／ownership、旋轉或碰撞 mask；不能用單格假設或自創多格模型取代追蹤 |
| Gate／時間 | 旋轉慣性、命中範圍、精確費用／rank 表、Hunt 晝夜選擇器、日初時刻、精確 tick；不掛 earth／Desktop，不新增週／月 |
| 戰鬥 | 未追的 match→arena、站位、命中／TP／AI、特效觸發、BM03／BM04 各動畫的行為語意；既有 trace 已解部分保留其範圍，不用檔名補剩餘部分 |
| UI／資料 | 不把 NXR 座標直接當 CSS，不把資產的 MAIN／SUB 當固定實體上下；不混合 216／224／228；不把列表／五鈕 nav／CARE 當原作 |

## G. Claude 稽核逐項對照與更正

| 稽核主題 | 判定 | 統一結論 |
|---|---|---|
| Continue 落 Training、沒有 Desktop／Today 中介 | 仍成立；完整中間序列未在兩支索引證明 | 保留 A 對該路徑的觀察；V 直接支持入口與 Training 端點，不外推所有新遊戲／事件日 |
| world／earth／Desktop | ROM 支持；措辭須限縮 | world loader 已追；earth／Desktop 未追到可達路徑，產品不掛載。口語球形地圖統一叫 world |
| Gate rank／費用／棲息 | 仍成立＋影片支持 | help #100–102 直接支持；V 顯示 Entrance Fee／Funds。精確每 Gate 資料與扣款整合仍待追 |
| Light 限夜間，引用 help #96 | 未在兩支片證明；引註待更正 | 本次 #96 僅講日長／季年；#92 講燈誘引。須補別的商品／程式來源，不把無效引註當規則已閉合，也不據此斷言規則不存在 |
| training_sub 的狀態與 log | 影片支持；原頁內文矛盾 | 後段與建議 C 仍寫下螢幕，應統一為影片的上方資料；Cursor 摘要已改正 |
| Cage Edit 未拍到、只可能每 Cage 一格外形 | 過期／影片不支持排他推論 | V16／V17／V44 有六角板與跨格輪廓；已有 Cage 契約後補影格，但單格外形強解讀仍應保留疑問 |
| Cage Occupancy Limit | ROM_TEXT 補充 | help #133 是建議收容數，允許超過但較易累積壓力；不能只因 Limit 字樣就拒絕超額放入，也不能拿它算占格 |
| 季／日／時鐘與 cascade | 影片＋ROM 支持；現況過期 | 影片支持外顯資訊；400 單位／分須依 ROM。每幀 +16 仍推論；四欄與模型已有程式路徑，未等於驗收 |
| 自創五鈕、RAW 工具與 CARE | 仍成立 | 檔案仍存在；兩組子選單與六類工具已有證據，不能任意填格；本次僅改誤導入口註解 |
| LIST VIEW | 產品增加；未在兩支片證明原作有 | 分開記錄適配與原作，不從未見直接宣稱所有版本絕無列表 |
| 96 場景／16 類與 Cage Edit 獨立列 | 數字支持，分類須更正 | CSV 為 96／16；Cage 的兩筆已包含 Training 七筆。原頁再單列 Cage 使總和成 98，應標子集合或拆 5＋2。各 NXR category 也不等於路由全集 |
| 圖鑑分母、224 槽、228 物種 | 保留不同語意；216 本次兩支索引未獨立覆核 | 不互改數值；採既有研究與 A/C 的來源歸屬，不捏造本次 Database 影格 |
| 遊戲標題缺 WORLD | 英文原作名稱有畫面支持；本次不調整品牌 | 英文標題與日文標題／2026 產品名分開，不能自行改品牌文案 |
| 三隻 VS1 展示與 228 筆資料未全接 | 歷史現況，本次未全面重跑 | 不把資料表存在當完整角色行為，也不據舊文刪除目前美術成果 |
| Battle 仍是色點 | 過期 | 授權 11 場地已存在；HUD、姿態、策略、結果等功能仍各自核對 |
| 戰鬥配置、類型與結果多頁 | 影片支持流程分層；全集未證明 | V 有隊伍／策略欄、1vs1／3vs3；B2 補 1vs3／3vs1。結果各 NXR 可能為分支，不要求每場全播 |
| Today／Tamer／Help／Schedule 缺口 | 原作功能存在，完整實作未在本次驗收 | V 有選單／翌日通知；B2 有 Tamer／牌照與日曆。勿以入口或資料數量當功能完成 |
| 捕捉行為未展開 | 影片＋ROM_TEXT 補足 | help #89：繩索束縛傷害；#104：HP 0 後手掌收取進記憶卡；#105：裝備對目標可有效或無效。具體公式仍 UNKNOWN |
| UI 溢出、708 項測試 | 歷史測試聲明 | 本次未重跑 UI／遊戲測試，不能轉寫成本次結果或仍有同一缺陷 |
| 資料大致齊、差距在畫面和接線 | 仍有指導價值 | 「有 catalog／素材」與「操作、規則、回饋同原作」分別驗收 |

Claude 的 A → B → B2 → C → D → E → F 順序僅作**尚未授權**的歷史建議：工具列 → 頂欄／時間 → 牧場 → 育成資訊 → Gate 規則 → 結果分層 → Today／Tamer／Help。本次不建立新實作工單；有些工作區路徑已存在，下一次授權前應先盤點可重用部分。

## H. 本次驗證與交付邊界

驗證限文件：引用檔存在、影格索引仍為 52／20、JSON 可解析、工具列合約僅新增 `observedSubmenu.whatIsNotThere.significance` 這類 LIVE_FOOTAGE 註解（不改 slot 幾何、不升版、不把第二組選單寫進 ROM_VERIFIED）。工作區曾出現把兩組選單整段寫進合約且順序與 V13 不符的 v1.3 擴寫，已撤回。來源影片觀察保留原時間與雜湊；Claude 狀態中繼資料更新成已對照並連本索引。沒有新增影格／ROM／GLB 到 repo，沒有改 `src/`、`assets/`、`tests/` 或 `CURRENT_PRODUCT_STATUS.md`。

本索引是之後理解與核對原作的入口；功能內頁、數值與時序仍依連結的原始證據與 UNKNOWN 清單判定，不能以「索引完成」宣稱整款遊戲已還原。
