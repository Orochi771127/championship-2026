# 對戰原生函式與攻擊位移 R6

延續 Owner「剩餘 18 個原生函式、完整招式與角色動作，請繼續開工」。目前正式 root 為 `championship-2026`，branch `main`、HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。開始時工作樹已有大量前輪變更，本輪保留共享成果，沒有 commit、push 或發佈。

本輪完成剩餘 18 個原生函式本體，以及原始方向／向量運算。地面與空中兩個複合攻擊段已能透過既有角色管線呈現位移、升降、淡出淡入和指定影格。**正常對局的完整攻擊、特效物件池與牧場自有隊伍仍為 PARTIAL。測試頁直接執行原生攻擊段，不能視為完整招式腳本、命中或 AI 流程已完成。**

## 本輪實作

- `battleRemainingNatives.js` 補齊 18 個 OVL19 body。現有 native registry 共 **67/67**，靜態涵蓋 **3,014/3,014** 個 CALL_NATIVE 位置。595 筆非 sentinel 記錄的 normal-gameplay acceptance 仍未放行。
- 補上鏡頭控制入口、速度／加速度、透明度／顏色、音效索引、特效配置／排隊、輔助 VM 查找與 reset。引擎呼叫、圖像／音訊載入器和 child actor 所有權仍是 host 依賴；函式本體完成不代表這些資源已全部接上。
- `0211E5A0` 地面段包含加速、12 幀淡出、目標旁定位、等待、攻擊與減速收招。`0211EA68` 空中段包含升起、停留、下降、6 幀淡出、目標旁定位、等待與減速收招。每一幀的原始 state、速度、座標、透明度參數、動畫請求、記憶體寫入及返回值均有 CPU 比對。
- 空中段的最後返回值為 **`0x003E7000`（999 Q12）**，不是把動作階段自行編成 3。這是腳本控制回傳，不能直接當成命中或傷害時點。
- `battleNativeMath.js` 移植 `02002C00..0200323C`、`020669D8`、`02066A40` 的整數三角多項式、角度查表、Q12 取整。一般浮點 `sin/cos/atan2` 不參與這個結果。runtime 只使用數值常數與重寫的 JS 運算。
- 既有 `runMoveScript` 接入這組數學 helper，並增加可選 `memoryAccess`；建構引數與每幀 native 讀寫使用同一個來源。`battleNativeMemory.js` 保證 `actor+24, offset0` 和 `actor, offset24` 共用同一批位元組，避免拆開鍵值後座標讀不到。
- 既有 presentation source 增加可選 `getNativeActor`。由呼叫者提供座標投影、離地高度、透明度、顏色與動畫請求；沒有提供時，正常對局仍保留原有、明確標為暫代的站位。
- 修正 `020479A4 -> 0202FA68 -> 0202E144` 所需的強制換影格：同一個原始動作可以在新請求時重新定位到第 2／3 影格；重畫不重啟，無效影格索引保留 reset 後的起點。沿用既有 animator 和唯一 Pixi 時鐘。

## 原始比對證據

ROM SHA-256：`8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`。

OVL19 SHA-256：`d660e3e0bf243541c356c54dcbd1aec58e8df6c2dfaf4a5854d375a5f2d13715`。

| 比對 | 結果 | 證據範圍 |
|---|---|---|
| 剩餘 18 body，受控引擎 helper | 124 cases／936 frames 一致 | 每幀呼叫、返回值、寫入值和完整寫入位置集合 |
| 相同 body 加原作方向／向量 helper | 124 cases／936 frames 一致 | 三角／角度 helper 執行原始 ARM，僅整數除法硬體由測試器模擬 |
| 向量 | 38,605 個整數角度 + 1,000 個帶正負長度測例一致 | `-12868..25736` 涵蓋目標方向與反向位移所用角度 |
| 方向 | 2,597 組 XY，各比對 Q12 radians 與 unsigned turn index | 四象限、零、相等座標及每個查表切換附近 |
| JS 集成 | 位元組別名、VM frame 讀取、兩個原生段抵達收招、同動作強制 seek | 不為測試傷害或接觸結果造值 |

原始 receipts 位於 `docs/research/BATTLE_REMAINING_NATIVES_CPU_2026-09-07.json`、`BATTLE_REAL_MOTION_CPU_2026-09-07.json`、`BATTLE_NATIVE_MATH_CPU_2026-09-07.json`。重現工具為 `scripts/research/trace-battle-remaining-natives-cpu.py` 與 `trace-battle-native-math-cpu.py`；ROM 路徑由命令列提供。

鏡頭、資源配置和音效引擎 helper 在 CPU 測例中仍是受控回傳；沒有因 body oracle 通過而宣稱完整 VFX 或音訊已完成。

## 驗證

- 全套 Node 回歸 **1,179/1,179 通過**，詳見 `REGRESSION.tap`。第一次失敗是既有 migration firewall 的明列模組清單尚未列入本次三個 helper；依本次開工範圍加上三個檔名，保留其餘限制，然後重跑全套。
- 更新全招式依賴清單並通過 `audit-battle-action-coverage.mjs --check`；所有 body source／math tables 的 hash 已納入。
- `git diff --check` 通過。
- **CODEX_BROWSER_PLAYWRIGHT_QA**：`tests/fixtures/championship-native-attack-motion.html` 實際載入招式 337 的伽樓達獸及 455 的翔龍獸，沿用 production loader、source、stage 和 animator。390×844 與 320×740 皆完成地面／空中段，正確出現 raw 9／10 的攻擊影格 2 和收招影格 3，沒有橫向溢出，按鈕 44 px，一個 canvas，console error 空清單。
- 另以 393×852 請求檢查；此環境實際 layout 為 393.6 px、clientWidth 394，沒有橫向溢出，但**不宣稱精確 393×852 contractual gate 已通過**。原始尺寸結果保存在 `BROWSER_MOTION_QA.json`。
- 保留既有指定場次 AI 回歸：場次 1、既定原作隊伍、獨立記憶體 save。原有 AI 在 clock 991 選中 move 255，進入 84 幀特殊技前奏，完成敗戰與 0 獎金結算，持有 9,400 Bits。這是回歸驗證，沒有把測試隊伍換成玩家自有隊伍。
- 瀏覽器檢查按實際尺寸分別留下桌面與手機紀錄；不能把背景頁的桌面尺寸當成手機驗收。未做實體手機、CLAUDE_RUNTIME_HEADLESS_QA、CLAUDE_BROWSER_RERUN 或 public build 驗收。

## 仍待完成與下一個接點

1. 正常 battle runtime 目前沒有完整原作 actor/effect graph。要讓本輪兩個段在正常招式中發揮作用，先追完 `0211C144` 的 owner、target、actor、位置、VM 初始化，再串接原始 approach／launch 狀態；不能直接以測試頁固定座標和目標取代。
2. child actor 的 24 槽、4 組 auxiliary VM、effect bank 與清除時序還要接到原本的 2D／3D VFX 消費者。音效／鏡頭 helper 亦需各自的 runtime binding。
3. 受擊後落地、異常狀態後續及復起判定仍要追通知 handler 的後續 writer。本輪空中攻擊的下降不是受擊後落地的完成證明。
4. 牧場自有角色組隊與養成數值、狩獵／捕獲／進化的動作觸發沒有在這輪變更，仍需依序接原始條件。

本輪沒有新增 ROM 圖像到 runtime，沒有重畫或更動 production art 核准，不放行 shipping。測試 UI 不會出現在正常遊戲選單。
