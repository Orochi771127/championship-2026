# 原作對戰演出：影片、YDIJ ROM 與目前實作對照

2026-09-07。專案 `R:\Projects\Championship2026\championship-2026`，branch `main`，HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。共享工作樹已有大量未提交變更，本輪只新增此對照、兩份證據紀錄及唯讀 ROM 查核腳本；未修改 gameplay、資產或 runtime。

來源：[数码宝贝---冠军，BV13u411B7BK](https://www.bilibili.com/video/BV13u411B7BK/)。接續既有 [影片分析](ANALYSIS_ZH_TW.md) 及 [Battle R3](../../art/production/battle-animation-r3/README.md)，此次重點為出招特寫、特效及它們與戰鬥事件的同步。

**結論：原作確實有一般交戰以外的出招特寫、場景壓暗、數位圖樣、光環／光束與攻擊軌跡。目前 R3 補的是部分角色動作序列，尚未還原完整的出招演出。現有特效素材與播放器可作為接續基礎，但正常對戰沒有相應事件接線。**

## 1. 這次直接看到的畫面

時間採播放器實際 media time，連結為方便回看而向下取整；播放器顯示時鐘可能向上取整一秒。這是取樣觀察，沒有逐幀量出原作演出起訖。圖片只保存在本機研究 archive，未複製進 production。

| 影片實際時間 | 觀察 | 邊界 |
|---|---|---|
| [03:20.078](https://www.bilibili.com/video/BV13u411B7BK/?t=200) | Free Battle 一般交戰，綠色場地、角色、隊伍光圈、圍欄與播報訊息；上方倒數 106 | 一般構圖參考，不是角色座標真值 |
| [03:22.055 / 03:22.288](https://www.bilibili.com/video/BV13u411B7BK/?t=202) | 倒數 105；場地變暗，上下出現藍色數位電路／0、1 圖樣，右上角色被突出放大，周圍有亮環、白青色光和放射光束；上方隊伍 HUD 尺寸維持 | 證明特寫與多層合成存在；不能由畫面獨自判定是整個世界鏡頭、角色縮放、特寫分身，或其組合 |
| [03:24.055](https://www.bilibili.com/video/BV13u411B7BK/?t=204) | 回到一般明亮交戰畫面，播報含 `Puppy Howling!` | 鄰近招式文字不等於已追到該招式腳本、特效 ID 或命中時點 |
| [03:27.054](https://www.bilibili.com/video/BV13u411B7BK/?t=207) | 一般場景可見獨立的青藍色球狀效果 | 不以球形外觀猜元素、傷害或來源招式 |
| [03:29.022 → 03:30.521 → 03:31.058](https://www.bilibili.com/video/BV13u411B7BK/?t=209) | 一般交戰之後再見數位覆蓋、突出的角色／光環；接著恢復場景，可見青白彎曲軌跡 | 足以確認這不是單張角色換圖；尚未證明三個取樣属于同一腳本實例 |
| [03:49.784](https://www.bilibili.com/video/BV13u411B7BK/?t=229) | 一般交戰中可見青藍色連續球狀／軌跡效果 | 粒子數量、速度、生命週期未量測 |
| [08:10.075](https://www.bilibili.com/video/BV13u411B7BK/?t=490) | Challenge Gears 的一對一場景，倒數 118、雙方光圈與播報 | 此張不是特寫階段，不拿它補證特寫參數 |

有效觀察 10 張；另 4 張因跳轉後影片尚未解碼到新時間而排除。排除名單為 `t212.png`、`t486.png`、`t490.png`、`t494.png`，不可引用其播放器數字作為影像時間。`verified-490.png` 已重取並直接確認一對一場景；`verified-202.png` 已重取並確認放射光束特寫。誤命名的 `attack-200.png` 實際為 210.520662 秒。完整路徑、時間、SHA-256 與排除理由見 [影片查核紀錄](BATTLE_VIDEO_CAPTURE_RECEIPT_2026-09-07.json)。

影片為英文版；本機 ROM 為日文 YDIJ。既有影片調查記錄了異常高 HP／TP、資金及作弊碼背景，因此本片用於演出觀察，不拿來反推正常平衡、攻速或模擬器與 ROM frame 的換算。

## 2. ROM 已查到什麼

本輪先讀 Evidence MCP，再直接读取本機 ROM 的 OVL19；沒有執行完整模擬器對戰，也沒有宣稱取得鏡頭 CPU trace。

| ROM 證據 | 本輪查核 | 已知範圍 |
|---|---|---|
| OVL19 `0x0211B03C` → ARM9 `0x0208AF6C` | 直接核對 ARM branch 及 literal 字串 `battle/hypereffect` | 原作有對應模型載入路徑 |
| OVL19 `0x0211B0E8` → ARM9 `0x0208AF6C` | 直接核對 branch 及 `battle/hypereffect_ring` | Hyper 本體與環是分開命名的資產；不可直接把影片某一環指定為這個檔案 |
| OVL19 `0x0211A260` 與表 `0x021319F8` | 直接讀取既有 census 所列五個名稱：`hitspark_small`、`hitspark_big`、`s_impact_s`、`s_impact_b`、`earth_hit` | 存在不同命中／衝擊特效資源；選擇條件尚未由此次讀取證實 |
| OVL19 `0x0211DF68` native 前段 | 讀取 VM 參數、呼叫 `0x0211B264`；成功分支寫入新物件 `+0x24/+0x28/+0x2C`，以 `(selector & 0xFF) - 1` 呼叫 `0x02047904`，再把新物件存入父物件槽 | 支持獨立 child/effect actor 及序列、座標欄位的結構；座標單位、完整生命週期與具體招式呼叫鏈仍待追蹤 |
| Nitro 3D 解碼研究 | hitspark 與 impact 有模型／骨架動畫；Hyper 有模型、骨架與 visibility 動畫；部分狀態效果使用材質動畫 | 原作特效不限於角色 sprite 幀。這不能推成整個競技場或所有角色都是 3D |

ROM SHA-256：`8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`。解壓後 OVL19 SHA-256：`d660e3e0bf243541c356c54dcbd1aec58e8df6c2dfaf4a5854d375a5f2d13715`。

可重跑：[唯讀查核腳本](../../../scripts/research/inspect-battle-presentation-links.py)，參數為 ROM 路徑與輸出 JSON 路徑。輸出：[二進位證據紀錄](BATTLE_PRESENTATION_BINARY_RECEIPT_2026-09-07.json)。`STATIC_BINARY_READ` 只證明列出的靜態指令與字串，不升格為 CPU 跑過整場戰鬥。

MCP 研究來源（路徑均屬原作研究 archive，不是另一個產品的 runtime）：

- `YDIJ_RAW_RESEARCH_EVIDENCE/YDIJ_BATTLE_ANIMATION_PARALLEL_RE_PROGRESS_v2.md:177–215`：native、動作序列、child/effect actor、兩軸 transform 線索。SHA-256 `75cdc68f64ad9c6c571f63c6d91bef2f17ef9cc9defdbf7565d82b93a3ac30d8`。
- `YDIJ_BATTLE_REVERSE_CLOSURE_STAGE4_2026-08-24/BATTLE_WORLD_MAP_LOADER_TRACE_v2.md:1–73`：battle 模型載入；未找到直接 world_map/world_map2 載入不等於不存在其他鏡頭或場景流程。SHA-256 `758baee891e036b15fa5bd7b05f6e33009f3527f1ea90328722d525794c33e59`。
- `YDIJ_BATTLE_REVERSE_CLOSURE_STAGE4_2026-08-24/derived/NSBMD_LOADER_XREF_CENSUS.csv:6–15`：loader 呼叫點及五項效果表。SHA-256 `81f83a2275fc39742d159b634bd801ff99cb89762e6fbcc2762326987f6a06cf`。
- `YDIJ_3D_DECODED_REFERENCE_PACK_2026-08-24/BATTLE_COMMON_3D_DECODED.md:3–38`：模型與動畫配對。SHA-256 `47dbbf07cb6c260532235c41667993cab30ddacda7adcd7c417f653d69242859`。

## 3. 與目前程式的具體差距

| 項目 | 目前狀態 | 下一步要補的內容 |
|---|---|---|
| 角色動作 | R3 已有三個角色的部分 raw sequence 播放；仍由目前 committed action 邊界投影，原作 launch timing 部分完成 | 同一招式的接近、出招、效果、返回時序 |
| 站位／移動 | `src/championship/app/battlePresentationSource.js` 的 `battleStandPosition` 是固定兩排，明列 `PRODUCT_AUTHORED` | 原作 approach/launch/return 的世界座標、朝向及物件參照 |
| 出招特寫 | `createBattleFieldPixiPresentation.js` 將場地 contain-fit，角色依固定 stand 與 native geometry 排放；無上述特寫狀態 | 先證明世界鏡頭與 actor transform 的分工，再同步角色、特效與場地變換 |
| 暗場／數位覆蓋 | 主戰場 scene 目前只有場地、標記與角色層 | 查原作層次、遮罩、顯示／清除時點；避免直接把整個手機 UI 壓暗 |
| 特效展示 | 已有 VFX 清單、動畫 runtime 及 `createBattleVfxThreeOverlay.js`；`main.js` 只有 `?vfxArt=` 才啟用；它以自訂鏡頭框定一個模型並循環播放 | 預覽不等於戰鬥接線；需依已驗證事件生成並清除一次性效果，使用原作座標 |
| 事件綁定 | `battleWeatherVfxPresentation.js` 定義 big-hit／Hyper 消費端；搜尋目前 `src` 未找到相應正常對戰 producer／controller mount | 完成 authoritative 事件來源與 instance ID；不能看到扣血就猜是哪個 hit effect |
| 同時出現的效果 | 現有 contract 的 battle channel 為「新事件取代上一個 transient」 | 原作 child actor 和多層畫面要求核對同時實例；未查之前不能認定單通道替換足以還原 |
| VM 完整性 | `battleMoveScriptRun.js` 仍記錄 `unimplemented`／`needsObjectGraph`；部分缺失 callback 可回傳 0 繼續 | 不能以 VM 沒有拋錯證明特效或鏡頭執行完成 |

## 4. 下一個 bounded slice

選定一個已能重現、已綁定角色的招式，交付完整的 **接近 → 出招 → 特寫／效果（若原作該招有）→ 命中回饋 → 返回交戰**，再擴到下一招。

1. 從招式腳本/native 到 child actor、transform、特寫開關與釋放追出同一條呼叫鏈。取得原作 frame、施術者、目標、位置、效果 ID 與層次；尚未取到的維持 `UNKNOWN_REQUIRES_TRACE`。
2. 在既有 battle session／presentation source 增加只讀演出事件，不建立第二套戰鬥計時、傷害或 RNG。角色序列與特效使用同一原作時間依據，單次事件不能因重繪重播。
3. 沿用 DOM UI、現有 Pixi 場景及有證據的 bounded 3D 特效能力。手機只有一個連續戰場；HUD 保持可讀，原作的演出資訊與回饋保留。這是構圖方向，並非已完成的鏡頭數值 contract。
4. 驗證同一招式進出特寫不改變模擬結果；同時效果、返回／dispose、resize、重複事件及 reduced-motion 均可收尾。再對照影片及模擬器，在 390×844、320×740 實際渲染檢查。

不把 Hyper 檔名直接等同本片所有特殊招式，不把每次攻擊都加相同放大／特效，也不自行加入慢動作、震動、停頓或新戰鬥操作。

## 5. 本輪驗證與未完成邊界

- 已完成：影片演出抽樣、有效／失同步截圖分流、現有 source 接線查核、原始 ROM 的兩條命名 loader／五個表項／四段指令視窗查核。
- 已完成：新增查核腳本重跑產物一致；JSON 可解析，10 張有效／4 張排除截圖的 SHA-256 核對；`git diff --check`（既有 CRLF 提示不屬 whitespace error）。
- 未執行：新的 gameplay focused/regression suites、手機裝置 QA、完整模擬器對戰 CPU replay。本輪沒有改 gameplay 或 runtime，先前 R3 測試結果仍只是先前那個切片的驗證。
- 未知：精確特寫倍率／曲線／時長、啟動條件、每招效果與影片對應、影格停頓／模擬是否暫停、完整 camera/actor transform 分工。
- 尚未完成：本片這套出招演出在手機 runtime 的還原。此報告不能當成效果已接好或對戰整體完成。
