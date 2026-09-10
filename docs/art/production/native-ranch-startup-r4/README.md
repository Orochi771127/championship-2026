# Native ranch startup R4 — 2026-09-06

正常新遊戲現在先建立藍色 Waiting Room，旁邊接上三座原作初始設施。移除新遊戲的空配置／單獨水管預覽行為；既有存檔保留原來的配置與排列，不會自動搬動。

## 已接入

- `newGame` 建立原作 setter 證據中的 `(definition, anchor)`：`(35,0), (0,8), (1,4), (15,7)`。
- 新配置使用 `NATIVE_ANCHORS_V1`。待機區固定占用 0–3；其他三座設施占用 4–8，合計九格。編輯器阻擋 footprint 重疊、跨列與超出已開放格位，保留既有 Confirm／Back 語意。
- 原作地板起點、上排裁切三個 tile rows，以及右邊界同列回捲，接到既有 production 圖片載入器。初始四張圖形成相接場地，原來 shelf 排列只留給舊存檔。
- 一個橫向可拖移的相機視窗取代整片縮圖。原生像素尺度由場地和角色共用；開場對準左側待機區。相機只存於場景中，未增加 ticker、renderer 或 Save。
- 角色仍使用既有交互區域，只把這些區域投影在待機區內；UI 顯示 Waiting Room。尚未聲稱角色可以依原作規則進入各訓練設施。
- 裁切紋理是現有圖片的 view，退出時釋放 view，底層圖片仍由 Pixi Assets 管理。沒有複製、生成或修改任何研究圖片。

## 證據與限制

使用 R2A native geometry、R2B native compositor receipt、初始化 setter windows，以及本次 Owner 提供的藍色待機區截圖。Evidence MCP 再查 `field_cm28_01`，命中既有 `maps/o3b-training-cage/field_cm28_01/provenance.md:1,4`；讀取為研究，不進產品資產。

這輪接的是原作位置與裁切規則。R2B 的四個 tile/attribute/collision/owner plane 演算法並未替換成正式資料供應管線。目前 production PNG 已把地板和道具合併，所以裁切也作用於道具，還不能宣稱原作逐像素、獨立道具遮擋和動畫原點完全一致。未接入 filler、底部牆、原作角色／設施 membership、碰撞與訓練效果。相機是明確的手機呈現適配，沒有宣稱複製原作相機的全部控制。

## 驗證

Focused：48 PASS。完整 serial regression：1,135 PASS。記錄在 `qa/focused.log` 與 `qa/regression.log`。存檔測試包含新配置 roundtrip、舊配置不移位、不升級版本、取消草稿、待機區不可移除、占用與邊界拒絕、紋理失敗清理和原生縮放一致。

本機 port 8738 為本輪獨立測試存檔。實際執行 New Game、選取蛋、橫向滑動到三座設施、Cage Edit 移動／取消與確認、Save & Quit、重新載入、Continue。`qa/acceptance.json` 記錄最後的尺寸與操作驗收。未做實體手機測試，未 commit、push 或部署。

相關契約：[CHAMPIONSHIP_NATIVE_RANCH_STARTUP.v1.json](../../../contracts/championship/CHAMPIONSHIP_NATIVE_RANCH_STARTUP.v1.json)。
