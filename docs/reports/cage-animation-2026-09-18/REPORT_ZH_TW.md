# 2026-09-18 火山動畫中斷接手驗收

本機火山 `field_cm07_01` 兩幀重複問題已修復並完成遊戲畫面驗證。工作位於 `championship-2026-convergence-20260916`，分支 `planning/nexus-link-product-scope-2026-09-16`，接手基準為 `72b9ec1f7627bbd1c2c09463ebaf50e75288afe1`。本次未 commit、push、merge 或 deploy；正式 `main` 工作目錄沒有修改。

## 接手內容及修復

- 接手時已有火山第二幀、兩份清單、完整與增量重建程式的未完成修改，以及牧場縮放／空位蓋板修改。保留這些既有成果；本次沒有重新設計籠子或改動玩法。
- 舊合成把動畫層放在完整靜態圖後方，火山動畫遭覆蓋，兩張輸出相同。延續既有修補，以第一幀完整 RGBA 像素吻合的 16 個 8×8 格子作局部替換；火山兩幀有 254 個原生像素不同。第一幀、透明範圍、尺寸與播放時間保持一致。
- 只有火山第二幀的圖片內容相較基準改變；其他三張動態籠子及其餘靜態籠子的 runtime PNG 保持相同。火山每幀 50 原作 ticks，約 836ms；其他三張每幀 20 ticks，約 334ms。
- `rebuild-cage-animated-frames.py --check` 現在同時檢查四張完整名單、來源指紋、重建像素、輸出指紋、透明範圍、重複動畫與證據標籤。重建前先驗證四張，再開始寫入，避免後面一張失敗而留下半套結果。
- runtime 複製程式新增唯讀 `--check`，先驗證所有來源，再更新需要變更的圖片，不再先刪掉整個資料夾。保留多籠子同時載入規則。
- 收尾原有蓋板變更的測試：五個空位蓋板與一個循環接縫片段不再誤算成新設施；共用一張蓋板貼圖，釋放時不重複銷毀。調整三個已核對的美術規格來源指紋，其他幾何／物件規格不變。

## 證據邊界

修補的像素匹配可由 repo 已有解碼圖片重算，但**不能據此證明原作共用 VRAM 槽位的 CPU 機制**。Claude 未完成程式內的這項肯定說法已改為 `PIXEL_MATCH_RECONSTRUCTION_CPU_BINDING_UNKNOWN_REQUIRES_TRACE`。來源動畫解碼與 tick 證據保留；整體合成是否與原機逐像素等效仍未驗收。

來源為 `docs/art/production/cage/faithful-hd40/fields/field_cm07_01/` 內既有 `static-composite-native.png`、`animated-layer.json`、`animated-layer-frame-00.png`、`animated-layer-frame-01.png` 與清單。未從外部研究包複製新素材。Evidence MCP 搜尋另定位到原研究庫 `YDIJ_ORIGINAL_VISUAL_RECONSTRUCTION_ARCHIVE_2026-08-29/maps/o3b-training-cage/field_cm07_01/provenance.md`，僅作來源定位，不作 VRAM 行為證明。

## 已執行驗證

| 驗證 | 結果 |
|---|---|
| 完整 Node 測試 | 1,560 / 1,560 |
| CI 可攜測試 | 1,343 / 1,343 |
| Python 重建／破壞案例 | 7 / 7；涵蓋重複像素、相同像素重新編碼但指紋錯誤、來源損壞、缺少一張、末張失敗不先寫前三張 |
| 四張動畫重建、40 張 runtime／44 PNG 指紋 | 通過 |
| 啟動預載 | 184 模組通過 |
| 原有 cm01 製作規格重建 | 7 組比較皆 0 像素差異 |
| 真實遊戲火山動畫 | 1024×1366，隔離 QA 存檔經商店、牧場配置、放置火山、滑動鏡頭；載入兩張圖，8 張連續截圖有 4,023 個岩漿像素變化 |
| 原有牧場／籠子瀏覽器流程 | 390×844、820×1180、1024×1366；14 次尺寸／畫面旅程、6 組互動、存檔再繼續通過；無 page error 或缺檔 |

首輪完整測試有 5 項失敗，為舊清單指紋與蓋板數量／共用貼圖預期未更新，均已修正。首輪牧場瀏覽器撫摸測試失敗，因既有 12px 拖曳在新縮放倍率下未達原作 >3 native-pixel 門檻；改為 32px 後通過，未改動玩家手勢邏輯。新增火山瀏覽器測試開發時也修正了等待畫面完成、同名小火山選取，以及橫向模式仍維持直向框的測試假設；最終以 1024×1366 實測。

詳見 [validation.json](validation.json)、[火山瀏覽器回條](browser-animation.json)、[牧場瀏覽器回條](browser-layout.json) 及 [實際遊戲截圖](normal-ranch-volcano.png)。截圖只展示本機 runtime；像素變化由連續 8 張原始截圖驗證，原始檔仍在 `.tmp/browser-qa/cage-animation/`。

## 重跑

在本工作目錄執行：

```powershell
python scripts/rebuild-cage-animated-frames.py --check
node scripts/promote-licensed-cage-runtime.mjs --check
python -m unittest discover -s tests -p test_cage_animation.py -v
npm test
npm run test:ci
npm run validate:preload
```

瀏覽器檢查需先在另一個終端啟動既有本機伺服器：

```powershell
$env:CHAMPIONSHIP_PORT='8741'
node scripts/serve.mjs
```

```powershell
$env:CHAMPIONSHIP_QA_ORIGIN='http://127.0.0.1:8741'
node tests/championship-cage-animation-browser.cjs
$env:CHAMPIONSHIP_QA_URL='http://127.0.0.1:8741/championship.html'
node tests/championship-cage-layout-browser.cjs
```

實機、前景遮擋、原機動畫合成與商業／發布驗收仍未完成。本次沒有更新公開試玩的核准指紋或發布內容；這份本機驗收不代表線上版本已修好，也不代表 Claude 原先對 40 張圖提出的所有量測結論都已重新查證。
