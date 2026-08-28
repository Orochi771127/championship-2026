# 《數碼寶貝冠軍賽》2026 網頁／手機重製版製作規劃摘要

日期：2026-08-29  
產品：獨立的 9:16、單螢幕、可觸控網頁／手機遊戲  
狀態：製作規劃；不代表自動解鎖 VS3–VS7 或大量美術生產

> 本文件名稱中的《數碼寶貝冠軍賽》只用來標示研究來源。最終公開產品不使用 Digimon／數碼寶貝品牌、角色、名稱或素材。

## 一、建議的成品形式

只維護一套遊戲程式：

1. 手機瀏覽器直接遊玩；
2. 可安裝的 PWA；
3. 網頁版完成並通過裝置測試後，再選擇是否用 Capacitor 包成 Android／iOS App。

最簡單的產品定義是：

> 做出一套功能完整的遊戲核心，再由可替換的 Content Pack／Skin 提供角色、名稱、圖像、地圖風格、文字與音樂。

先達成 `FUNCTIONALLY_COMPLETE`：從 New Game 可以玩到 Championship。之後才決定最終產品名稱、世界觀、首發角色數量與正式美術，換皮不重寫玩法。

不要另外製作第二套手機遊戲，也不要把現有專案改寫成 React、Phaser 或 Unity。沿用目前已完成的架構：

- DOM／CSS：選單、文字、面板、設定、無障礙；
- 單一 PixiJS：2D 地圖、角色、動畫、捕獲與戰鬥特效；
- 有限 Three.js：原作證據支持的 Gate Select 地球與另外核准的 3D 效果；
- 單一模擬狀態、單一存檔、單一 Pixi ticker；
- 所有玩法公式都在 renderer 外運算。

## 二、9:16 單螢幕的正確做法

基準尺寸是 390×844 CSS px，但必須同時支援 360×800 至 430×932。手機使用整個 `100dvh`；桌面瀏覽器則把相同 9:16 遊戲欄置中，支援滑鼠、鍵盤與手把。

每個畫面都分成：

```text
安全區／精簡狀態
主要世界或角色畫面
需要時才出現的操作面板
拇指可觸及的主要按鈕／導覽
底部安全區
```

不重現 NDS 上下雙螢幕，也不直接搬移 256×192 座標。原作的兩螢幕資訊改用頁籤、bottom sheet、drawer、stepper 與逐步結果揭示。

Hunt 的 128×128 地圖仍然是大型世界；9:16 只是攝影機視窗，不能把整張圖縮進手機。即時畫面不允許整頁上下滾動，只有資料庫、商店清單與說明面板可在自己的區域內捲動。

## 三、主要遊戲流程

```text
蛋／起始角色
→ 飼育、清潔、治療、訓練與時間流逝
→ 進化、隊伍與棲息地成長
→ Gate Select／Hunt Loadout
→ Hunt 探索與觸控圈捕
→ Hunt Result／收藏／資源
→ Shop／Database／Cage Edit
→ 三隻隊伍與策略準備
→ Auto Battle
→ Battle Result／Title／Rank／解鎖
→ 四年一度 Championship
```

原作的 Auto Battle、三隻隊伍、Hunt tether／circle capture、季節／時間與四年 Championship 都應保留。未知公式不能用一般 RPG 常識補寫，必須先追蹤或標成核准改編。

籠子系統同樣是不可刪除的核心玩法：玩家要在有限空間中拼裝具有特定形狀的籠子／功能地形，不同地形會提升不同培育數值。正式版必須具備 shape-aware 放置、重疊／越界驗證、效果預覽、確認／取消、培育 tick 與完整存檔；不能退化成只選一張背景圖。精確原作形狀、旋轉規則和數值仍需追蹤，詳見 [模組化籠子系統規格](CHAMPIONSHIP_2026_MODULAR_CAGE_SYSTEM_SPEC_ZH_TW.md)。

## 四、必做畫面

1. Boot／Title／Continue
2. Raising Home
3. Creature Detail
4. Cage Edit
5. Training
6. Database
7. Shop
8. Gate Select
9. Hunt Loadout
10. Hunt Field
11. Capture
12. Hunt Result
13. Battle Mode／Match Select
14. Team／Strategy Setup
15. Auto Battle
16. Battle Result
17. Title／Rank／Championship Progression
18. Settings／Accessibility／Help

每個畫面都要有正常、讀取中、空資料、錯誤、中斷恢復狀態，並通過 touch、mouse、keyboard、gamepad 與 safe area 測試。

## 五、觸控與 Capture

所有實體輸入先轉成命名動作，例如 `confirm`、`back`、`move-field`、`capture-start`、`capture-draw`、`capture-release`，玩法程式不能直接判斷某一顆鍵。

Capture 的正確路徑：

```text
Pointer Event
→ 瀏覽器／安全區座標
→ Pixi 世界 transform
→ canonical capture coordinates
→ 點位過濾、插值與閉合判定
→ 捕獲模擬
```

PixiJS v8 要在按下後使用 `globalpointermove`，並處理 `pointerupoutside` 與 `pointercancel`，否則手指離開目標範圍時會斷線。每次移動都透過 `toLocal()` 轉換，且重用點位 buffer，避免高頻配置物件造成手機卡頓。

## 六、高清美術重製方法

已拆解資料只能作為研究參考，不能把 ROM 圖、音樂、模型或直接衍生物放進正式包。規劃已採用「最終全原創內容」路徑，但將最終品牌與 roster 決定延後到功能完整之後。

「高清重製」不等於放大：

- 不接受最近鄰放大、濾鏡、AI upscale 當成正式重繪；
- 要重新建立乾淨母版、線條、陰影、分層與透明邊緣；
- 保留舊有輪廓、比例、構圖功能、色彩角色與動作節奏；
- 所有正式素材要有 rights、human approval 與 runtime QA。

### 角色

功能完整前不先製作 224 個正式角色：

1. schema 和程式仍支援完整 224 槽；
2. 使用 16–24 個中性 ID、原創臨時剪影／幾何角色測完所有系統；
3. 完整遊戲做好後，再先做 4–8 個正式原創角色 pilot；
4. Owner 根據實際成本決定首發 24／48／96 或其他數量；
5. 後續角色以 Content Pack 持續加入，224 是長期容量而非首發阻擋；
6. 正式動畫仍使用「一個已核准基準幀 → 一次完成整條動畫 → 統一縮放與 bottom-center anchor」。

### 地圖

- 16 個 Hunt biome：使用分層模組地形，不是放大背景圖；
- 40 個 Cage／Training：保留資料 crosswalk，CM12／CM18 衝突先隔離；Cage Edit 必須支援特定形狀模組的拼裝與功能地形數值效果；
- 11 個 Battle field：保留 common／field-specific 層；
- BM03／BM04 的未知動畫層不得猜位置與時序；
- logic grid／collision 只供模擬與除錯，不顯示在正式地圖。

### UI、VFX、3D、音訊

- UI 沿用 P1R 的深海軍藍、金框、青色資訊層級，改成現代響應式元件；
- VFX 分成小／中／大三個回饋等級，提供降低閃光、降低震動選項；
- 3D 第一目標只有重新製作的 Gate globe 與核准效果；
- 音訊分 Master／Music／SFX／Ambience／UI／Voice buses；
- 151 個 SDAT 資料只能協助對應事件，未授權時不能直接使用。

## 七、資產載入與手機效能

不能在啟動時載入 224 角色與所有地圖。建議 bundle：

- `boot-ui`
- `raising-home`
- `gate-select`
- `hunt-{biomeId}`
- `battle-{fieldId}`
- `results-common`

只預載下一個最可能使用的 bundle；離開場景後卸載不再需要的 bundle。角色用 atlas，特效、傷害數字與音效 player 用物件池。128×128 世界採 viewport culling／chunk activation。

效能目標：

- 現代手機穩定 60 FPS，低階模式穩定 30 FPS；
- steady memory 目標低於 250 MB；
- 首次可玩下載目標低於 10 MB compressed；
- mobile atlas 通常不超過 2048×2048；
- 先 profile 判斷 CPU 或 GPU 瓶頸，再優化；
- 真機執行至少 20 分鐘 thermal soak。

## 八、製作階段

| 階段 | 工作 | 粗估 |
|---|---|---:|
| R0 | 統一文件、權利路徑、核准規劃 | 1–2 週 |
| R1 | 輸入、safe area、品質分級、存檔版本化 | 2–4 週 |
| R2 | 飼育、模組化籠子資料契約、訓練效果與進化完整化 | 6–10 週 |
| R3 | Hunt AI、Capture、Hunt Result | 6–10 週 |
| R4 | Shop、Database、可觸控拼裝的 Cage Edit | 5–8 週 |
| R5 | Auto Battle、六模式、Result | 8–14 週 |
| R6 | Title、Rank、四年 Championship、完整存檔 | 5–8 週 |
| R7A | 中性 ID、臨時原創 Content Pack、全部槽位可載入 | 隨 R1–R6 平行 |
| 功能門 | New Game 可不靠 debug 玩到 Championship | 約 18–36+ 個月 |
| R7B | 決定正式 IP，逐批替換角色、世界、美術、文字與音訊 | 功能完整後決定 |
| R8 | Alpha、Beta、PWA、裝置／效能／公開發行 | 正式內容完成後 |

執行條件改為一位人類 Owner＋AI。人類負責方向、取捨、品味、遊玩驗證、權利與發布；AI 協助證據整理、程式、測試、資料、臨時內容、資產工具與 QA。一次只開一個 gameplay slice，最多另開一個不互相干擾的小型內容／工具包。

## 九、現在最先做的事情

1. 修正 README 與舊 Master Sync 對 VS2 狀態的矛盾；
2. 建立 IP-neutral ID、Content Provider 與 research import 禁止測試；
3. 核准 9:16 畫面表、可換皮資料契約與資產權利 schema；
4. 追查 Raising、Hunt、Battle 的 P0 公式缺口；
5. 開一個有限的 VS3 Capture vertical slice；
6. 製作一個「臨時原創角色＋一 Hunt biome＋Capture UI/VFX/音訊」的換皮證明；
7. 完成功能版後，再討論正式名稱、世界觀與首發角色數量。

## 十、完整執行文件

- `CHAMPIONSHIP_2026_MASTER_GAME_PRODUCTION_PLAN.md`：完整玩法、架構、路線、人力、風險與驗收。
- `CHAMPIONSHIP_2026_9X16_SCREEN_BLUEPRINT.md`：18 類畫面的 9:16 與觸控規格。
- `CHAMPIONSHIP_2026_HD_ASSET_PRODUCTION_PLAN.md`：角色、地圖、UI、VFX、3D、音訊高清產線。
- `CHAMPIONSHIP_2026_PRODUCTION_BACKLOG.csv`：48 個可排 Sprint 的工作包與依賴。
- `CHAMPIONSHIP_2026_SOLO_AI_PARITY_FIRST_PLAN_ZH_TW.md`：一人＋AI、功能完整優先與可換皮內容層的正式條件。
