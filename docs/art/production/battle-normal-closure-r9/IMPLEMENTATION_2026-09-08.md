# R9 normal battle closure — 2026-09-08

本輪完成原作狀態 8 追擊、狀態 16 所選 actionId1 的後續寫入，以及正常戰鬥世界旗標。整體對戰仍為 **PARTIAL**，本輪未完成 R10 全招式投射物、VFX 與音效。

## 工作樹與權責

Git root：`R:\Projects\Championship2026\championship-2026`；branch `main`；HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。開始時654筆既有 dirty entries，包含前輪未追蹤 battle 檔案。已讀 AGENTS、README、Owner Direction、Architecture、Status、Dependency、Blocker 與 battle contracts，依 Owner「請開工」延續實作，保留共享成果。

沿用既有 session、native memory、角色動畫、channel216 RNG 和三個攻擊槽；未新增 renderer、ticker、router、store 或存檔權責。未 commit、push、merge 或 deploy。現有 Node、Python、ndspy 與 Unicorn 已足夠，無須安裝新軟體。

## 遊戲行為改變

1. **狀態8會追擊並再次發動一般攻擊。** `02112394` 按原作對手隊伍順序選距離最近且未暫停者，同距離保留先遇到者。選擇器本身不額外過濾 HP/通知，後續交由 `021144B0` 拒絕目標。從原作 +C0 一般招式桶用 channel216 抽選，通知7播放既有跑步動畫3。`021164C8` 的距離、角度、三槽及 +24 計時器共同決定是否轉 state14；未套用 state4/5 的額外 cooldown 重選。
2. **statusCode1 的行動入口已接回。** `02115810` 讀角色實際 +24；已到期進 state8，仍有時間則寫50/30像素距離和未套正向加速的 `90 - 2*speed` 冷卻，再回 state3。先前只記錄非 NORMAL family seam，沒有完成這段行為。
3. **state16/actionId1 的後續已接入。** `02116FD8` 是 state16 完成後的原始指令段。對 HP>0、未暫停且通知不在18..21的對手，依隊伍順序套 status1，寫 stateCounter=1、目標指向施術者，再消耗一次 channel216 選一般招式。ROM 的通知7寫在施術者身上，且對每個符合的對手重複；實作保留此顺序。
4. **世界 +5EA8 接到既有 native memory。** `0210CDD0` 初始化清 bits0/1；`0210D3A4` 每幀含特殊招式獨佔分支更新 bit0；`02115068` 最後一隊 HP 歸零時設 bit1。state14/15/16 讀 **bit1** 拒絕新發動並釋放配置槽，保留其他位元。修正舊報告把條件寫成 `==2` 的描述。

世界旗標是既有記憶體的 scalar block；尚未把它發布為 `02131C40` 完整2D資源圖。特殊招式 `0211DF68` 的原有未接診斷仍保留。

## 原作證據與測試

ROM SHA-256：`8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`。

OVL19 SHA-256：`d660e3e0bf243541c356c54dcbd1aec58e8df6c2dfaf4a5854d375a5f2d13715`。

`scripts/research/trace-battle-normal-closure-cpu.py` 直接執行原始 ARM 指令，產出 `docs/research/BATTLE_NORMAL_CLOSURE_CPU_2026-09-08.json`，新增 **836 組**對照：最近目標160、state8追擊420、state16後續200、status1行動入口24、世界旗標32。R9既有4767組證據另保留。

CPU 的角色/隊伍資料、RNG 回傳、距離表、動畫完成與 state/notification服務都是明示 controlled seams；state16 的 status1 setter 沿用 R8。共享 runtime 測試另確認動畫3、icon6、目標連結、三槽釋放及 HP-zero 拒絕。這些不是原作整場比賽錄製，不宣稱具有相同賽前 RNG 歷史。

## 正常 AI 結果

`normal-runtime.json` 含目前 source hashes、事件、場次與種子。只走正常選招、接觸、受擊與結算，沒有注入傷害、復起或 outcome。

| 場次 / seed | 結算 clock | 成功發動 | 命中特效生成 / 清除 | 重點 |
| --- | ---: | ---: | ---: | --- |
| match0 / 20 | 582 | 15 | 11 / 11 | 近身基線保持，無未接 host call |
| match1 / 9 | 1415 | 40 | 59 / 59 | 6次自然追擊選招，各自經 state8→14 再發動 |
| match1 / 19 | 1589 | 46 | 61 / 61 | 敵方 slot3 在 clock1316 回復54/1080HP，完成復起並再出招 |
| match1 / 25 | 2014 | 52 | 55 / 55 | 我方 slot0 在 clock1496 回復54/1080HP，完成復起並再出招 |

四場結束均無 active launch、owner lock、impact，worldFlags=3。特殊演出期間另檢查每幀 bit0 已清除。match1 的 moves180/181 仍報 `0211DF68` 物件圖未接，moves180/181/255 仍報 `0203EA30` 音效未接；两種火花不構成全招式演出驗收。

原 R9 seed9 曾可復起。補上缺少的 status1 行為後，選招、RNG 與結果改變，本輪以 seed9 驗證自然追擊、seed19 驗證敵方復起、seed25 保留我方復起。沒有移除復起斷言；舊報告及 receipt 保留歷史值。

## 驗收記錄

- Focused **25/25**：`reports/battle-normal-closure-focused.log`。
- Regression **1216/1216**：`reports/battle-normal-closure-regression.log`。
- 靜態 coverage hash check 通過；`normalGameplayAcceptedRecords=0`，67 natives / 3014靜態callsite 不代表逐招完成。
- `git diff --check` 及本輪未追蹤原始碼/文件空白檢查通過；未改動共享工作樹的既有 CRLF 設定。
- Browser skill 所屬瀏覽器，以明示場次 fixture 操作共用戰鬥 module。390×844：seed9 clock1005 停於 slot4追擊、動畫3。320×740：seed19 clock1316寫54HP，clock1384觀察復起完成，再正常結算。clientWidth/scrollWidth為390/390、320/320，error log為0。詳見 `browser-review.json`。
- QA fixture 的「狀態8追擊」事件停格選項只在測試頁；正常產品 UI 未新增此選單。
- 截圖：`mobile-390-pursuit.png`、`mobile-320-recovery.png`、`mobile-320-result.png`。這是尺寸/流程檢查，不是完整原作視覺驗收。
- 實體手機未驗收；production approval、素材權利與 shipping 狀態沒有升級。

## 已定位的 R10 資源與下一步

原作 `0211A000` pool初始化使用 `0211A3EC → 02131754` 指標表，在bank1..151按需要載入 `common/e003_*`，bank0保留。新CPU receipt的 `effectBankProvenance` 有 **151筆名稱、ID與來源指標**，例如bank7火球 `e003_fireball00`、bank12光束 `e003_beam00`、bank21飛彈 `e003_missile00`、bank64 `e003_etc_hiteffect`。它們是專用2D資源，與角色Main/Sub和現有26組3D GLB效果不同。

已讀 allocator `0211B264 → 0211ABFC`：496個、stride0xD4的2D物件；`0211ACF8` 用swap-last清除live list，`0211A568` 按active、動畫完成與slot mode更新回收。本輪尚未完成其JavaScript port，也未完成 `0211BA40` 旋轉碰撞。

下一個安全實作步驟：先選一組有原作證據的普通投射招式，接 bank/sequence、世界引用與496槽生命週期，再比對旋轉接觸、來源位置、命中回饋，串接符合production條件的presentation資源。原始像素留在研究區。還需驗證飛行、命中偏移、次級/落地效果與音效，才可接受該完整招式。

仍開放：state16/action1 自然選招完整receipt；state8空一般招式桶的未使用/舊+C0指標（保留 `UNKNOWN_REQUIRES_TRACE`）；其餘負向狀態AI body；完整profile來源、非空selector10/11 cache、初始模式與賽前RNG；自有牧場組隊/養成值、各非戰鬥動作與全角色逐招/裝置驗收。
