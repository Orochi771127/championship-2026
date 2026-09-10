# R10：正常選招的 2D 投射物與原作資源池

本輪已將原作 2D 特效物件池、動畫和投射物接觸接入正常對戰。**整款遊戲、全角色逐招演出仍為 PARTIAL。** 本輪沒有新增151組可見特效圖；畫面仍只有既有已接入的特效。數值執行、素材、呈現和完整遊玩驗收分別記錄。

工作目錄/Git root：`R:\Projects\Championship2026\championship-2026`；branch `main`；HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。開工時657筆共享dirty entries，延續原有戰鬥檔案，保留其他工作。已讀專案指令、README、Owner Direction、Architecture、Status、Dependency、Blocker及相關契約。Node、Python、ndspy、Capstone與Unicorn已可用，本輪不需安裝軟體；未commit/push/merge/deploy。

## 實作與遊戲行為

- 直接從ROM整理**151組2D資源、484條動畫、1,231個NCER框**。輸出只有數值、原生資源名稱及來源雜湊，沒有影像/調色盤。這些資源是`common/e003_*`專用特效，不能用角色Sub動畫替代。
- `0211A054..A17C`按現有參戰者的招式清單計算載入需求，保留初始需求和兩個特定script指標的加倍條件。銀行0會計數但不載入。正式自有角色的額外招式來源仍未完整接入。
- `0211ABFC`配置**496個固定槽**，保留LIFO空槽、swap-last刪除、模式欄位、資源初始化與序列選擇。`0211ACF8`只回收live handle；動畫/資源資料須保留至該槽再次配置。這一點修正後，seed21在後續動畫查詢遇到的`02047904/02047C48`未接呼叫消失。
- 原生角色、特效、24個VM子物件沿用**同一份戰鬥memory**。發布`02131C40`對應既有world，接通正常`0211DF68`生成。這不代表所有world/3D/audio服務完整。
- `0211CCEC`在VM分派後逐一更新active子物件。mode0由物件池更新；mode1/3由所屬launch更新。修正primary釋放順序為先完成四個auxiliary步進再釋放primary子物件，並在結算/離開清除全部live效果。
- `0204819C`保留有號Q12加速度乘法、+2048捨入及先加速度後位置；非整幀delta仍不縮放位置增量。`020482AC`重力是另一個原生呼叫，沒有擅自每幀重複套用。
- `0211BA40`保留無旋轉分支、旋轉四邊、目標框inset及原作不同的高度處理；`02066C90`保留退化線段和32位乘積判斷。碰撞讀當前cell的縮放/翻轉框，沒有使用素材裁切尺寸取代。
- 修正`0211D2E0`漏傳world/pool：`0211AD9C`按物件資源查回bank，再左移20。缺少world仍明確報`NEEDS_OBJECT_GRAPH`。
- 正常選招的非零參數actor已走投射物接觸，受擊來源座標使用投射物位置，接到原有HP、落地及復起流程。新增有上限的診斷歷史供驗收，不新增遊戲UI。
- 巨型飛彈bank135/sequence2有原生0-tick frame；特效可保留0，但角色timeline預設仍要求正duration。全0序列明確拒絕。

## 原作來源與證據界線

ROM SHA-256：`8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`。

OVL19 SHA-256：`d660e3e0bf243541c356c54dcbd1aec58e8df6c2dfaf4a5854d375a5f2d13715`。

直接ROM指令和FNT資源為主證據。既有研究索引`research-only/YDIJ_FULL_ROM_DECONSTRUCTION_2026-08-29/analysis/ROM_FILE_CATALOG_6419.csv` lines546–548亦列出`e003_fireball00`，該catalog hash為`1abb70188ce982e856f3283821cf789a3c3446d876404bfcfb554d98f33a1c65`。本輪查到另一overlay也含同地址`0211BA40`；沒有把Capture overlay的函式誤當Battle證據。

`scripts/research/trace-battle-effect-cpu.py`執行原始ARM9/OVL19，輸出`docs/research/BATTLE_EFFECT_CPU_2026-09-08.json`：

| 對照 | 數量與範圍 |
| --- | --- |
| 線段接觸 | 600組，含退化/共線 |
| 旋轉投射物接觸 | 700組，實際原生softfloat與segment指令 |
| 配置 | 30組，含無效編碼/未載入bank/mode |
| 滿池/釋放 | 498次配置嘗試、5次釋放、一次mode混合sweep |
| 物理 | 120組，含非整幀、負delta |
| 0-tick動畫 | 4種delta，各50次更新 |
| 載入需求 | 4組原生move-list輸入 |
| bank查詢 | 5組D2E0→AD9C，含null |

池測試把圖形資源/動畫服務列為controlled seams；接觸測試把已變換框列為controlled inputs；需求loop在圖形載入前停止。另以共同runtime測試151組bank/484序列初始化及step，不宣稱所有動畫都在正常對戰出現。這些是受控原始CPU對照，並非原作完整比賽錄製，也不證明相同賽前RNG歷史。

## 正常AI與回歸

`normal-runtime.json`以明示schedule/seed從正常選招執行至結算，含当前source hashes。未注入傷害、復起或勝負。

| 場次/seed | 結算clock | 發動 | 投射物接觸呼叫/命中 | 2D配置/回收 | 既有3D火花配置/回收 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0/20 | 582 | 15 | 0/0 | 3/3 | 11/11 |
| 1/9 | 1874 | 44 | 20/7 | 14/14 | 54/54 |
| 1/12 | 1983 | 45 | 30/15 | 28/28 | 58/58 |
| 1/16 | 1729 | 49 | 20/9 | 21/21 | 62/62 |
| 1/21 | 2136 | 41 | 20/16 | 19/19 | 59/59 |

五場均ended、live launch=0、live 2D=0、free=496、無未載入bank/序列。專用bank19、81及通用bank1在特殊場次實際使用；seed12有225個可觀察的效果位置改變幀。最後一場另自然使用move17；不等同所有support招式驗收。

投射物與bank查詢接通會改變接触、消耗和RNG路徑，R9 seed19/25不再保證復起。本輪**保留復起與再出招斷言**，改用seed21檢驗敵方slot3、seed16檢驗我方slot0；兩者均回復54/1080HP後完成復起及再發動。R9報告/receipt保留歷史值。

- Focused **51/51**：`reports/battle-effect-r10-focused.log`。
- Regression **1228/1228**：`reports/battle-effect-r10-regression.log`。初次失敗是source-family allowlist順序，已按原有排序修正後全數重跑。
- 32個seed的正常流程survey保存在`docs/research/BATTLE_EFFECT_NORMAL_SURVEY_2026-09-08.json`，執行記錄在`reports/battle-effect-r10-survey.log`。32場全部結算、合計278次投射物命中，無未載入bank或物件圖錯誤；尚未接入的host只剩本批招式的音效服務。五場詳細receipt與survey的source hashes均重新核對目前檔案一致。
- 靜態coverage仍為596 records、67 native bodies、3014 callsites；**normalGameplayAcceptedRecords=0**。
- `git diff --check`、本輪未追蹤檔案的空白檢查、數值profiles從原ROM重新生成的byte-for-byte `--check`均通過。

## 瀏覽器可見操作

沿用browser skill和同一個正式battle module的獨立記憶體fixture；fixture只提供指定場次與推進按鈕，並非真實存檔/實體手機驗收。

390×844，seed16正常推進到clock914：move180的投射物命中slot3，HP314；當下6個bank19物件存在，沒有頁面溢出。`browser-projectile-hit.json/png`保留DOM診斷及畫面。**圖片只證明現有角色/場地/火花呈現；新2D投射物本身尚無可見圖。**

320×740，clock1501我方slot0回復54HP、sequence33；clock1569完成復起，後續clock1729結算。獨立fixture金額9400→27400，沒有JavaScript error或頁面溢出。`browser-recovery.json/png`及結算紀錄同目錄。未進行實體手機或shipping驗收。

## 尚未完成與下一步

1. **先補完整投射物呈現。** 151組數值bank需要合格的2D圖、原生anchor/cell對照和現有Pixi呈現接入；目前不能把受保護ROM圖直接當shipping素材。既有character和26組3D資產狀態不因本輪變更。
2. **補完整D740命中後段。** 原始offset ring、通用secondary spark、blocked-hit專用auxiliary及不同prelude分支仍未完整接回。現在的field44子VM和兩種3D火花不能代表全部VFX。
3. **補音效/場景服務。** `0203EA30`仍明確未接；現有host尚未裝入其lookup table，因此診斷args目前是0/127/0，不能當成已驗證音效ID。特寫期間的完整VM/actor同步和其他3D服務仍為partial。
4. **逐角色逐招驗收。** 現有224實體/228種族binding和484效果序列是資料覆蓋；仍需正常參戰、每招分支與完整演出驗收，不得以instantiate代替。
5. **接正式牧場隊伍及非戰鬥動作。** 自有角色三人組隊、真實養成數值、Hunt/capture/evolution觸發仍需各自的原作證據與流程整合，不能宣稱已完成。

本輪沒有新增router/store/save/Pixi bootstrap/global ticker。Gameplay、presentation、QA、rights與shipping狀態各自保留；總完成狀態仍為PARTIAL。
