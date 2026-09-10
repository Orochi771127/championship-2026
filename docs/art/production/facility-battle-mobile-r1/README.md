# 商店、牧場配置與對戰手機介面 R1

日期：2026-09-06。實作基準：main / d0c48f340baac61cf399bf5bd5922ce58f3d38c7；共用工作樹原有大量未提交修改，未提交、推送或部署。

本輪是可檢查的手機介面整合，**不是完整原作移植或所有美術已接完**。

## 已整合

- 商店保留四種商品分類、原有可見性、價格、持有數量、購買與單一錢包；籠子商品透過 ShopRecord → CageDefinition → visual field 接上既有 production 圖片與中文名稱。
- 牧場編輯按既有 slot ownership 顯示完整多格占地。以場地縮圖跨格裁切，保持圖片等比；可取回、選擇、放置、確認或返回取消。固定等候室維持不可取回。可左右捲動查看 20 格，階級仍控制開放範圍。
- 延續既有 R4 新遊戲布局：藍色等候室固定，旁接空地、運動場、小保健室。新介面不重寫初始布局，也不自動遷移舊存檔。
- 對戰選單、比賽 HUD、獎金頁採明亮的連續手機底色。修正立方體 canvas 與模式按鈕超出容器、壓到下方文字的問題。既有各模式未綁定時保持停用。
- HUD 顯示來源提供的 HP 現值／上限；沒有新加戰鬥指令。場地保持等比，站位標記跟隨同一場地矩形，避免漂到留白區。
- 結果與獎金文字中文化。只顯示实际結算 receipt，不把目錄獎金冒充已入帳。

## 素材與證據

指定包：`R:/Projects/Championship2026/YDIJ_PRIVATE_ROM_ART_PACK`。檢視 `01_UI/use-ready-hd4x-scenes` 的 Shop、Cage edit、Battle menu 背景及場景索引；它們是 research reference。本輪沒有把 raw ROM 或 decoded 圖片搬進 runtime。

顯示的設施與競技場來自 repo 已有的 `assets/production/{cage,battle}/licensed-runtime-v1/manifest.json`。36 個設施 identity 均有實際存在的圖片對應。DOM 的邊框與色彩為本輪手機適配；編輯盤使用的是**場地預覽圖**，不是聲稱還原了原作 thumbnail cell bank。

依據：既有 `nativeRanchLayout.js`、`ranchSlotGeometry.js`、`originalCageVisualBindings.js`、Cage identity trace、原有 Shop/Cage/Battle runtime contracts。手機版布局覆寫列在 [本輪 contract](../../../contracts/championship/CHAMPIONSHIP_FACILITY_BATTLE_MOBILE_UI.v1.json)。不改 gameplay、wallet、save、router、renderer authority。

## 驗證

- Focused tests：75/75；追加場地定位檢查：11/11；最終 serial regression：1140/1140。日誌在 `qa/`。`git diff --check` 通過。
- 正常瀏覽器：New Game → Home → Shop 分類；所有初始可見籠子圖成功載入、contain 顯示；0 bit 資金不足與已持有狀態保持停用。未在正常新遊戲中注入金錢。
- 正常瀏覽器：Home → Cage Edit → 取回三格運動場 → 移到空格 11–13 → 返回 → 重開恢復原位置 5–7；取消成功。
- 正常瀏覽器：空地移至格 10 → 確認 → Home Save → Reload / Continue → 重開仍位於格 10。之後以同一操作還原格 9 並存檔。固定等候室與未開放格保持停用。
- 正常對戰入口：春季第 1 天無可用賽事，顯示空清單。沒有假造新遊戲即可參賽的日期。
- 對戰完整 UI 測試使用 `tests/fixtures/championship-facility-battle-review.html`，**獨立記憶體存檔、明確推進至秋季第 4 天、10,000 bit 測試金額**。沿用實際 app、battle runtime、Pixi 場地與 DOM view，先準備比賽再扣 150，餘額 9,850；播放實際自動戰鬥後獲勝，入帳 7,000，餘額 16,850；下一頁顯示同一筆收據，返回可完成。初始暫停按鈕只用於截圖，不存在於正式遊戲。
- 320×568、390×844 瀏覽器尺寸驗證。商店按鈕高度 44 px；無頁面橫向溢出；牧場僅盤面水平捲動；窄版清單可垂直捲動，底部確認／返回保持可用。實體手機尚未測試。

## 尚未完成

- 商店一般物品的原作圖示／詳情肖像與整套原作 UI 圖層尚未綁定；部分名稱仍是本作的索引標籤。
- 原作籠子編輯 thumbnail bank 尚未直接重建，場地家具仍沿用既有合成圖；跨區角色歸屬與訓練數值 writer 不在本轮完成範圍。
- R1 當時對戰角色仍是站位標記；2026-09-07 的 [R2](../battle-characters-shop-r2/README.md) 已補上角色靜態 sprite、中文名稱與四項養成用品圖示。動作動畫、四模式到賽事表及賽事到競技場的自動對應仍未完成。
- Result 的升級、頭銜、個別戰績及完整 log 流程仍未完成。本輪只驗證既有勝負與真實獎金兩頁。
- 未宣告 shippingReady，未跑實體 Android/iOS 驗收。

## 畫面

| 畫面 | 390 寬 | 320 寬 |
|---|---|---|
| 籠子商品 | [shop](qa/shop-cages-390.png) | [shop](qa/shop-cages-320.png) |
| 起始牧場配置 | [cage](qa/cage-390.png) | [cage](qa/cage-320.png) |
| 正常對戰選單 | [battle menu](qa/battle-select-390.png) | [battle menu](qa/battle-select-320.png) |
| 測試場次戰場 | [fixture field](qa/battle-field-fixture-390.png) | [fixture field](qa/battle-field-fixture-320.png) |
| 測試場次獎金 | [fixture prize](qa/battle-prize-fixture-390.png) | — |
