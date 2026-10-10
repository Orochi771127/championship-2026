# R7 / R9 / R10 發布收尾與本機內容同步

此為提交前的驗證紀錄，基準 `e7c46ee67fbceffdbaf4fbaf46c38859fee40ba3`。本批依 Owner「做好後請你自我審查沒問題就發佈」及「本機端檔案也要記得更新喔」收尾；實際遠端 CI、Pages 與 live hash 另由發布回條確認，不在本紀錄預先宣稱成功。

## 變更

- R7：Gate renderer dispose 後釋放其獨立 WebGL context，保留既有單一 Pixi app。
- R9：首頁互動控制與美術容器分開；短直式按鈕改單欄，橫式控制保留實際 44px 以上的觸控範圍，保留原美術定位。
- R10 教學：camera 步驟從數碼獸起點滑動也交給鏡頭；canvas 原生 pointercancel 走既有取消路徑，避免拿起後卡住。原教學順序、carry／落籠／存檔判定不變。
- R10 進化：只將原數碼符號列替換為日／越／泰三行字，常數放在既有 text 層。現有中英／locale 行為、各列位置、方向、背景、角色、時序保持不變，不新增光環。
- 將 `common--e001_evolution_all--017.png` 從 assembled runtime manifest 的 cell / hud 選擇、產生 recipe、公開 build input 與核准 hash 清單排除。其他 cells / 索引不變。原 PNG 留在本機／Git 來源檔，未永久刪除；公開 artifact 與 runtime 請求均不含該 PNG。這不是整段演出或整遊戲的權利清理。
- 修復發布驗證器的 UTF-8 輸入解碼：原本逐 Buffer 轉字串會截斷跨分段字元，將合法大型 JS 誤判為語法錯誤。改由 stdin UTF-8 decoder 保留字元邊界；新增修正前失敗、修正後通過的大型非 ASCII identifier 回歸。

## 同一份 build 的驗證

Build ID：`f38f468aa2a77d10174e1d864850295953fa4615ad45d838725e12fa922b572c`；9,290 檔（移除一 PNG，新增一文字模組）。瀏覽器直接讀取公開 dist bytes，未為測試改寫 product bundle、未啟動另一個遊戲伺服器。

- 正常 `npm run test:ci`：1,617 / 1,617 通過，保留原 CI 範圍。`validate:playtest` 通過。
- 補交教學／onboarding／save 的 22 項原始 log；另有本機原專案 16 項相關回歸通過。
- 一個完整 UI 流程：隔離合成成年隊伍 Continue → Raising → Gate → Hunt → Raising → Practice Battle → 原生模擬結果 → Raising → Save/Quit → Continue。pageerror 0、warning 0、缺檔 0；未把合成存檔稱為自然新帳號進度。
- Gate 三次掛載／離開，含旋轉、選擇、loadout、輔助清單：Gate contexts 已失效、單一 Pixi context 保留。DOM loadout 會暫時脫離 Pixi canvas，不能把「connected canvas 為 0」誤判成 app 遺失。
- 自然 New Game → 八蛋選擇／命名 → 教學孵化／餵食／清理／治療 → actor 起點平移 → touch 取消／重試 → 訓練籠 → 回復籠 → reload / Continue。只透過瀏覽器操作，未設定 checkpoint。
- 存檔比較只排除 checkpoint 與原有 updatedAt／revision；`nativeOpening` 的 version、trainerName、tutorialStep 與其他非 checkpoint 欄位均逐步比較，不再刪除整個子樹。checkpoint 同步觀察、合法階段推進、落籠後單次前進與 reload 精確保持均通過。
- R9：五語 × 320×568／844×390、文字 130%，共 10 案；檢查真實 control bounding box、命中、44px 最小尺寸與畫面邊界，全部通過。
- 跑字：同一合成存檔由 app 孵化、食物、日切換指令生成，於 exact dist 普通 Continue 時觸發進化。五個 UI locale 均實際繪出日／越／泰文字，保留既有其他文字列的 locale 行為；繁中場景可見五語。舊符號 PNG 請求 0、缺檔 0。沒有擴大為所有物種／裝置／演出分支驗收。

原始記錄位於本次交接包的 `CI_FINAL_RAW.txt`、`TUTORIAL_22_RAW.txt`、`CYCLES_RESULT.json`、`GATE_CANDIDATE_RESULT.json`、`evidence/CARRY_RESULT.json`、`TITLE_CONTROLS_RESULT.json`、`EVOLUTION_LOCALES_RESULT.json`。最初沙箱 loopback 拒絕、原 UTF-8 錯判與兩次測試觀察假設的失敗回條保留，未改成 PASS。

## 原專案同步範圍與衝突

`R:\Projects\Championship2026\championship-2026` 保留 `handoff/dot-continuation-20261001` / `1fb7d5fd21d3da47775d34ab0d3a1a95f6623972`；沒有 merge、checkout、reset、force 或 pull。先備份所有受影響既存檔與該路徑的 untracked，並保留 122,131 項既有 untracked 的路徑清單；未做整庫美術複製。

已逐 hunk／唯一語意區塊合併：Gate presentation、Raising presentation、assembled manifest／recipe、build input、evolution text module、assembled tests、Pages parser／tests（9 檔），另加本報告與索引／Owner 授權紀錄。原 Raising 的 camera/layout/asset 所有者與既有修正未被整檔替換。

兩個語意衝突保留未動：

| 檔案 | 原因與最小後續決策 |
| --- | --- |
| `championship.html` | 原專案仍是 CSS 地景首頁，沒有 R8 圖片 panel、entry wrapper、背景載入／失敗介面。需另以已發布 R8 首頁及其依賴為界做本機合併，才可套 R9。 |
| `src/championship/app/opening.css` | 原專案沒有 R8 圖片座標與 loader 對應規則；直接套 R9 會破壞既有首頁。與上列一併處理，不要求合併整段 Git 分岔。 |

因此本批局部修正已同步，原專案不是發布 worktree 的整庫鏡像，R9 本機首頁尚未同步。沒有把本批內容同步混稱 HEAD 一致或原專案已可直接發布。

房間候選、角色大小／美術、狩獵接觸陰影及更廣角色／地圖／長時驗收均未混入。本次未碰玩家存檔、額度重置、購買或自動儲值。
