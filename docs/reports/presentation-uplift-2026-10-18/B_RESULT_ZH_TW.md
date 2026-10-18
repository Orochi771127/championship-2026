# B 港口角色與呈現審查

已完成既有前後錄影片段的抽幀目視審查（全片逐秒、操作段每秒4幀，加原尺寸 idle／walk 截圖）。這是單一港口、species-034與species-073的呈現試點；parent仍負責美術效果最終接受。沒有合併部署。

## 目視結果與限制

- 同條件：Windows Chrome155、1280×720、DPR1、seed7、同一選角／港口及實際鍵盤腳本；本機攔截既有發行檔，完全無網路。影片前11.12秒、後9.88秒包含不同長度載入等待；遊戲觀察到約7.1秒，不能用影片總長推論加速，也不是逐幀同步的模擬重播。
- 前後idle截圖同為倒數5:25，主角位置、場地、HUD、文字及底部技能列構圖一致。後版主角短暫回頭，使用既有圖的鏡射，沒有新姿勢圖；拍檔採另一待機節奏。原有短走圖仍隨真實位移切換，身體沒有新增整體上下漂浮。
- 接地影子改為較扁、角色不同寬度的腳底範圍（主角52×11、拍檔84×15個世界像素）；仍跟隨原腳點與場地高度修正。原尺寸截圖未見影子脫離、腳底跳位或新裁切。這是呈現改善，不宣稱新骨架／新動作。
- 移動、短暫雷射、暫停／返回的錄影未見HUD跳位、重複面板或按鈕裁切。減少動態及低畫質案例仍可移動、暫停及退出。
- **場景視覺覆蓋有限：**此片段的`visibleMechanisms`為空，吊臂未入鏡；吊臂分相位動停與兩角色遮擋的程式及單元證據保留，不能將其列為本片已目視接受。水面局部變化很輕，不誇稱重建場景。這兩項由parent審查本PR方向後決定是否補單一取景。
- before／after／reduced／low四個正常UI案例均通過，無page error或失敗請求；兩個quiet案例水面offset及吊臂幀均為0。影片與截圖見`evidence/`。

## 關鍵diff

| 檔案 | 差異 |
|---|---|
| `dataArenaHarborLife.js`（新增） | 只計算兩角色已有stand/walk的呈現節奏、短暫鏡射及影子尺寸；attack/hit/down/win的delta維持原值 |
| `dataArenaPixiScene.js` | 只在HARBOR且species-034／073有核准圖時套用；x/y仍直接讀原模擬；接地與共享ticker不變；增加只讀診斷 |
| `dataArenaEnvironment.js` | 既有吊臂幀分相位／休息，水面及燈光局部節奏；quiet凍結；遮擋檢查同時接受兩角色 |
| `dataArena.css` | 限HARBOR按壓100ms、選取背景；reduced／low／saver移除位移過場 |
| `titleImageLifecycle.js`、`championship.html` | A的分尺寸宣告、CSS×DPR選圖、關鍵圖優先與角色後載 |
| 兩份build合約 | 僅新增17個選定衍生圖與1個呈現模組、刷新受影響產品hash；原高清圖及停用影片保留 |

## 不改玩法的證據

`evidence/UNCHANGED_BOUNDARIES.json`逐檔比對main700996df的Git blob與當前bytes，16檔全部相同：9個DataArena simulation／config／grid／nav／props／save、持久化writer、角色適配與texture來源，加上4張原首頁圖、既有下載器、單一Pixi stage及FX粒子池。另`git diff`確認`modes/`、`field/`、`raising/`、`battle/`、`kernel/`、`shop/`沒有改動。

68個既有模式／互動測試已通過，含同seed同輸入重現、碰撞／冰水／坐騎、既有持久化隔離；新增4個呈現測試通過，含戰鬥序列原delta及quiet保留必要動作。四個browser案例中主遊戲存檔key始終未建立／改寫；暫停時simulation time不前進，退出後QA觀察口移除。這支持本次差異限制在呈現層，不宣稱完成所有戰鬥或實體手機驗收。

提交前將首頁HTML換行正規化為LF，產生腳本亦固定LF，避免Git入庫後與核准雜湊不同；畫面與行為內容未改。正規化後playtest構建及獨立驗證均通過，buildId `04833e3803528f1378efc06453b15b77530649316cdfd152d43a46cceb8c9f21`。真實HTTP冷暖快取測速仍受拒絕；保留A報告的待驗項，不重試該路線。

影片及PNG為本次任務的本機審查證據，未列入產品或PR附件。Library交付未能連線，尚未開始傳檔，未改用其他附件發布路線。PR保留本報告與精簡的`evidence/B_ACCEPTANCE_SUMMARY.json`及未改玩法的hash證據。
