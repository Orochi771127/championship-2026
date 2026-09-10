# Raising Home UI R3 — 2026-09-06

本輪把明亮的原作數碼風格接入正常養成主畫面，並修正場地圖片與角色／拖放區的座標基準。這是主畫面呈現切片，並非全遊戲或原作多籠拼接完成。

## 畫面改動

- 角色資訊移到場地上方，形成共享日期時間列 → 精簡標題／儲存 → 角色狀態 → 場地 → 共享工具列的順序。
- 藍青色六角紋理、金色邊框、淺綠色名稱區、淺色狀態讀數，取代原先奶油色大面板的主要視覺。保留既有已登錄工具圖示。
- 六種工具、管理／系統選單使用同一明亮材質。沒有增加指令或替換選單項目。
- 全部材質由 CSS 繪製；六角 SVG 為手寫幾何 data URI，不發出外部請求，也沒有從研究資料包複製原作圖片。
- 新樣式由正常 championship.html 載入，不需要美術預覽參數。原來的 UI pilot 保留為歷史基礎；本輪樣式只套用養成主畫面。

## 場地整合修正

`raisingFieldViewport` 統一圖片縮放矩形。角色位置與拖放範圍改用此矩形，原生像素大小也共用同一縮放值。過去把角色按整個 canvas 定位，較窄的圖片上下留白仍可能接受拖放；本輪已拒絕這些留白。

此修正保持既有兩個 prototype 區域的 normalized geometry、名稱、assignment 與 Save。它不是原作 CageDefinition 成員分配或 ATR/COL 碰撞；即使角色在圖片矩形內，仍可能和未接入碰撞的道具重疊。多籠仍使用既有 shelf 排列。

## 驗證

實際使用隔離的本機 port 8737，由 New Game 開始；點選蛋 → 拖放到另一個既有區域 → 管理 → Cage Edit → 放置 Cage 0、1、15、Waiting Room → Confirm → Back → System → Save & Quit → 真正重載 → Continue。

瀏覽器截圖、focused / regression 記錄在 [qa](./qa/)。尺寸檢查與最終測試結果另記於 `qa/acceptance.json`；沒有實體手機測試，也未發佈。

## 原作依據與差距

- 使用本次 Owner 提供的圖二作為數碼 UI 參考、圖一作為明亮精緻材質參考。
- `docs/contracts/championship/CHAMPIONSHIP_STATUS_BAR_CONTRACT.v1.json`：season/day/mode/time 四欄。
- `docs/contracts/championship/CHAMPIONSHIP_TOOLBAR_CONTRACT.v1.json`：八格工具列、已知工具和選單身分；位置仍未被提升為原作證據。
- `docs/contracts/championship/raising-home-presentation.v1.json`：既有產品區域；`originalParityClaim:false`。
- Evidence MCP 查得 `CLAUDE_CODE_YDIJ_HANDOFF/01_UI_ART_LAYOUT/nxr_94_analysis/NXR_LINKED_ASSET_MAP.csv:96` 的 info_bar → menu_sub 結構連結，及 `extracted_reference/YDIJ_UI_REFERENCE/UI_SOURCE_ASSET_INVENTORY.csv:167` 的 info_bar 清單。僅研究查閱，沒有進 runtime。

仍待完成：已驗證 tile-copy compositor 的正常場景接入、原作多籠地板相接與道具層、原作 actor/cage membership、碰撞及完整工具效果。HP/TP 的個體資料未知時仍顯示 `--`，不畫虛構滿條。其他頁面及既有英文字串尚未在此輪統一。

下一個切片應直接完成多籠的地板／道具／角色在同一場景中的整合，延續既有研究，不能以新增研究報告代替可見接入。
