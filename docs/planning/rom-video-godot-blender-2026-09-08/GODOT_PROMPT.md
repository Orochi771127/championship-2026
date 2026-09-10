# 可直接交給 Godot 開發者／Coding Agent 的指令

請連同本資料夾的 README.md、EVIDENCE.md、BLENDER_PROMPT.md 一起使用。以下為工作指令正文。

---

你是 Godot 遊戲系統工程師、觸控介面工程師與測試工程師。請依可核對的日文 YDIJ ROM 研究與指定英文影片，實作一款以多隻生物飼育、環境訓練、野外手勢捕捉、進化與自動戰鬥為核心的遊戲。首先完成一個可玩切片，再擴充。玩法規格以本套文件及連結中的來源證據為準。

## 任務與專案邊界

1. 開工先回報實際工作目錄、Git root、branch、HEAD、dirty status，讀取該 repo 的 AGENTS、README、Owner Direction、Architecture、Status、Dependency、Blocker 與相关 contracts。
2. 本文件是 Godot 版本的製作藍圖，不授權在現有 `championship-2026` Web runtime 裡塞入第二個引擎。若只有原 Web repo 可用，先完成獨立的 port inventory 與可審查的資料契約；正式建立／遷移引擎前取得明確目的地與範圍。讀取原作研究不等於匯入 Nexus Link 產品。
3. 若目標已是 Godot repo，延續其現有 session/router/save 架構。下方名稱是建議責任分工；有等價元件便重用。
4. 原作已驗證行為預設保留；`PARTIAL` 保留已知結構；未解規則用 `UNKNOWN_REQUIRES_TRACE`，不得補任意公式、成長曲線或功能。
5. 分開 `ROM_TEXT`、`STATIC_BINARY_READ`、`BOUNDED_NATIVE_REPLAY`、`VIDEO_OBSERVED`、`OWNER_APPROVED_ADAPTATION`、`ENGINEERING_PROPOSAL`。不要把某個網站／catalog 的存在提升成 ROM 驗證。
6. 原作圖片、聲音、模型與影片截圖只作研究。發布素材必須使用具有效授權或原創的資產；依目標專案 production index 辦理。不將 private archive、研究報告或 ROM 路徑編進 release。

## 技術基準

採用鎖定版本的 Godot 4、GDScript、Compatibility renderer，以單執行緒 Web export 作第一個瀏覽器基準。先記錄 Godot／export template／Blender 的實際版本，不自行聲稱某版為最新。用可伸縮 UI 支援 9:16 與其他直式比例，觸控優先且滑鼠可測試。

這是以 2D 為主、局部 3D 的表現：Control 管 UI，Node2D 管育成／Hunt／主要戰場；有證據的 Gate 世界球或有界 VFX 才使用 Node3D 或 SubViewport。鏡頭、世界座標與資料共用同一個 session。

Web 匯出限制先核對 [Godot 官方文件](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)。本規格的選型基於現有 WebAssembly／WebGL 2.0、Compatibility 和 GDScript 支援，不能拿桌面原生執行成功代表手機 Web 完成。

## 系統與節點責任

```text
GameRoot
  GameSession                 唯一 domain state、命令處理、RNG 和 tick 排程
  ScreenRouter                唯一 UI／模式導覽與返回堆疊
  SaveRepository              唯一儲存讀寫與版本遷移
  WorldHost
    RaisingField / HuntField / BattleField   依模式裝卸的 2D presentation
    Bounded3DView                         同 session 的選點／效果投影
  UI (CanvasLayer)
    CommonStatus
    ContextInfo
    ContextToolbar
    ScreenPanelHost
    ModalHost
  AudioPresentation           消費既有事件與 sound ID 對照
```

子系統可拆成普通 RefCounted／Resource／純資料類別，不必把每一項都做 Autoload。GameSession 中分工 WorldClock、CreatureRecords、CageLayout、Inventory、HuntSession、BattleSession、Progression；它們共享一份交易邊界，不各自保存／複製另一份錢包或個體名單。

UI 送出 command，domain 驗證條件並改變狀態，產生事件及 read model，UI／美術只投影結果。每個命令紀錄 instance ID、目標、座標、tick、結果／拒絕原因。內部命令和事件名稱是工程映射，不是新的玩家功能。

## 需要的資料契約

| 資料 | 最少保留內容 | 不得混用 |
|---|---|---|
| CreatureDefinition | 穩定 species ID、分類、世代、原始欄位及來源 | 物種基準值不能替代個體現值 |
| CreatureInstance | 唯一 instance ID、物種、名稱、來源、所在地、已驗證個體 profile | 同種兩隻不可共用生命、名字、戰績或 Cage |
| IndividualProfile | current／max HP、TP、已驗證能力、性格、族群／屬性傾向、生命史等欄位 | 未解欄位 null＋證據狀態，不用 0 或 species 基準裝成真值 |
| CageDefinition／Placement | definition ID、shape mask、anchor、解鎖板、效果與 owner | 視覺外形、footprint、建議隻數、G 容量各自獨立 |
| ItemDefinition／Inventory | 穩定 item ID、品類、持有、裝備、消耗／效果／插件遮罩 | 購物與 Hunt 扣量必須用同一來源 |
| HuntSession | 地區、環境、原始 RNG 狀態、野生池、工具物件、時計期限、入卡名單 | 野外 actor HP 與永久個體 HP 各有來源 |
| BattleSession | 賽事／模式、雙方實際個體、策略、合法性、AI／VM 狀態、事件、結果 | 進場費與結果獎勵；賽事 ID 與場地 ID |
| Progression | 日期／季節／年、rank／license、稱號／資格、已驗證事件旗標 | 不以 wins 自動推測 rank，不創造每日任務或經驗條 |
| SaveEnvelope | schema、revision、上述可持久化狀態、ID 配發與交易紀錄 | 不保存 Node reference、Texture 或另一套 UI 真值 |
| AssetManifest | gameplay ID 對應 visual ID、來源、權利、尺寸、錨點、motion contract | 美術不能定義傷害、捕獲率、進化条件 |

所有需要原始整數／Q12／bit mask 的地方，保留位寬、有號性、截斷、飽和、溢位和 RNG 呼叫順序。GDScript 的整數寬度與 JS bitwise 不同；不能把原有數值 port 逐行翻成語法後就稱行為等價。使用原始 CPU 向量比對每一步。

## 模式與操作流程

### 育成

- Continue 恢復已保存的個體、配置、庫存和日期，回到對應可恢復狀態。New Game 不採影片作弊數值；未找到完整 initializer 的欄位保留待追。
- 用手掌選取／查看／搬動角色；選中與搬動不是餵食。撫摸／戳碰的精確手勢與回饋必須有原作支援。
- 食物工具在合法地面建立實體食物；扣庫存的提交點讀原作。角色決策、接近、吃到、消耗、剩餘、腐敗與清掃是分離事件。
- 環境訓練由 Cage 與個體條件發生。能力上升、下降、到上限、進化結果的 log 與視覺都由同一事件驅動。
- 壓力、飢餓、傷病、生命期限、回蛋、進化使用已追 writer。文字證明功能存在，未證明的數量與機率不能自創。

### Cage Edit

- 讀取 `CHAMPIONSHIP_RANCH_NATIVE_GEOMETRY.v1.json` 與 `CHAMPIONSHIP_RANCH_TILE_COMPOSITION.v1.json`。保留 shape mask 和 anchor；不用任意方格／自由物理吸附替代原始空間。
- 移動預覽、合法性判斷、提交和取消各自存在；拒絕重疊時不寫入個體／配置。
- 建議收容數可以超過且有壓力後果；不能和空間 mask 或全域 G 上限合併。
- tile 數值／ownership／collision 留在 gameplay 資料；Blender 圖層只管畫面。舊存檔位置不被自動重排成看起來更漂亮的排列。

### Gate、Loadout 與 Hunt

- Gate 呈現世界球、選中地區、說明、費用和 Settings／Return。rank、費用與不足資金回饋按證據；沒有個別值時不顯示假價格。
- Loadout 保留 Rope／Shot／Wire／誘引／陷阱與插件、記憶卡的功能差別；未裝 Analyzer／Radar 不提前揭露資訊。
- 空地拖曳移鏡頭，工具捕獲的 pointer 不再交給 camera。取消、換工具、失焦、離場都釋放 capture，不能出現殘留拖曳或重複扣量。
- pointer 的 screen → viewport → native/world 轉換統一。原始 40／80／160 距離界線必須在同一原始座標計算。
- 成功鏈：畫繩 → 放開閉合 → 束縛 → 拉扯／反抗 → HP0 → 倒下完成 → hand-ready → 點手掌收取 → 入卡／隱藏 → 結果 → Home commit。不要將 HP0 直接視為捕獲完成。
- 保留斷繩重用、物種無效反應、彈數／冷卻、Wire 合法性與壽命、陷阱觸發、誘餌食用、夜間燈、有限物件池和到期返回。
- 記憶卡不足時，按原始 branch 拒絕收取；不要由影片紅色超額結果頁推成所有版本允許超額。
- 返家只提交一次；正常命名、放生、取消和容量處理都有可測事件。四種散彈的核准修正保留 adaptation 標記及原始異常證據。

### Battle

- 日程／mode／資格 → 賽事／對手 → 自己的真實個體／隊伍策略 → 戰前總覽 → battle → result → 適用的付款與 progression。
- Normal／Special／Support 為策略優先，不改成玩家逐回合任選技能。保留其他已驗證模式的控制；無證據不新增戰中技能輪盤。
- 雙方各自有名額與條件，不假定一定 3v3。取消戰前配置不扣費，提交前重新檢查日期、資格、隊伍和錢。
- 使用原始 AI／選招／native/VM 證據與既有數值向量。接近、出招、效果、命中、返回、KO 的時間及相依由原始 contract 控制。
- 特寫、暗場、數位 overlay、光環和軌跡獨立分層。動畫與音效事件去重、可清除；HUD 不被世界鏡頭任意放大。
- entry fee 與 prize 不共用欄位。取消、失敗、重複結果與讀檔回放不能重複付款。若可保存狀態無法恢復正在執行的 VM，明確限制該保存時機並列為相容性差距。

### 日曆與長期進展

- 8 日一季、4 季一年；07:00 起日、22:00 訊號按證據。不要用 OS 日期初始化缺失的原作年。
- 單一排程驅動邏輯，渲染 30／60／120 FPS 不改變規則。native cadence、clock elapsed、影片秒數、battle script tick 分開紀錄。
- 暫停／子選單／背景／日結行為按模式證據。Web 生命週期保護若有適配，要另標示；不自行加離線收益。
- 進化需要完整 predicate、優先序、原個體身份及保留／重置欄位；有畫面無 writer 的 branch 不能假裝完成。
- 稱號賽、預選、牌照、通信與 password 皆列入總覆蓋矩陣；尚未進當前切片的項目保留 PLANNED／UNKNOWN，不刪除。

## 美術匯入與動作契約

2D 主角使用穩定 raw sequence／cell 對照。保留 Main／Sub resource set、每幀 ticks、播放 mode、canvas、origin、flip 與 landmarks。Main／Sub 不等於正反面。不同來源動作可共用 cell；不得為了 atlas 把它們錯當連續獨立畫格。

不要把全部動畫統一為 8 幀、12 FPS 或同長循环；可用自訂 timeline adapter，或在已驗證單一 sequence 上使用 SpriteFrames。AnimationPlayer／AnimatedSprite2D 不是原始時序的證據。圖像裁切時必須恢復 trim offset，不能讓重心、腳底或攻擊點跳動。

Blender GLB 只作有界物件。PNG／GLB 的視覺原點與 gameplay 原點透過 manifest 映射；匯入縮放不回寫世界距離。完整 materials／alpha／動畫匯入後再核對，不只看 Blender 預覽。

## 首個切片與驗收

先交付 Title／Continue → 牧場 → 選取／搬动 → 保存 → 實際重新開啟恢復。所需素材少量即可，且每種占位都明列 temporary。不要同時批量建立全部角色與空白畫面。

之後依 README 的 B–F 推進。每次交付包含：可執行版本、變更清單、使用證據、未完成表、測試命令與結果、正常入口操作紀錄、必要匯出／裝置限制。focused 與 regression 針對行為，不測試檔案僅僅存在。

最少測試：同種不同個體身份／保存；無效食物放置；碰撞與 footprint；39/40/79/80/160/161 拉繩邊界；HP0 尚未可收取；卡片不足；成功後重複 hand／result；取消購買、餘額不足、重複結果；日切換與季／年邊界；進化容量／牌照拒絕；30/60/120 渲染下相同輸入序列的邏輯一致；音效解鎖、背景／恢復；真實 reload 的 Web 保存耐久。

桌面及 360×800、390×844、393×852、412×915、430×932 直式 viewport 檢查文字、觸控、工具列、Modal、safe area 和世界命中。實體 Android／iOS Web 各自留下驗收紀錄；模擬 viewport 不冒充實機。

執行 `git diff --check`。不自行 push、merge、deploy、rebase、reset 或刪除共享成果。最後清楚列出完成、部分完成、未知、阻塞和下一個安全步驟。遇到未解規則先沿來源追查，其他獨立且已授權的工作繼續完成。
