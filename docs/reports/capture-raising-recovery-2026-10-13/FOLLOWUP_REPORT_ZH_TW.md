# 本機重啟診斷與教學洞穴可見性續批

## 確定修復與未確認事項

Owner `IMG_3929.jpeg` 的洞穴說明上方可見第二隻拍檔片段。`nativeTutorialHuntScript.js` 的逃走演示只移動位置；`hunt-escape-explain` 又以預設 `hidden:false` 重建角色，而 dialogue 停止演示 tick。因此說明期間角色仍在可見清單。先新增失敗測試，實際得到 `['species-021']` 而非空清單；修復只隱藏逃走完成後的第二個 scripted actor，在 return 第 181 幀開始真正返回時恢復。普通 Hunt AI、物種、地圖、動作與存檔 schema 均未修改。

重啟／跳 TITLE 的 Safari 根因仍 **UNVERIFIED**。先前影片約 38 秒的 document 重啟候選，以及舊大型捕獲存檔不能繼續的個案，都不能由這次教學可見性修復或受控診斷測試宣稱已解決；未以 OOM 推論替代證據。先前已發布的 Hunt 返家拒絕後提前 dispose 修復保留，parent 的 `a660408c` 文件提交也已整合。

## Owner 下次如何取回診斷

再遇到跳首頁／重載時，先不要開新遊戲或清除網站資料；在 TITLE 的設定開啟「資料與帳號」，點「下載本機診斷」。不需先成功 Continue。檔名為 `championship-runtime-diagnostics.json`，Safari 請從下載列表確認檔案，再提供給調查者。UI 僅確認已準備檔案，不宣稱瀏覽器一定存檔成功。資料不會自動上傳。

獨立 key `championshipModernSave:runtimeDiagnostics:v1` 最多保留 32 筆／8 KiB；不讀取或修改遊戲存檔、玩家名稱、拍檔名稱、存檔內容、URL origin／query／fragment 或原始錯誤訊息／stack。只保留白名單技術欄位、相對 approved production asset 路徑、已知錯誤 code、限定 module:line:column 與短暫隨機 document ID。例外儲存不可用時仍保留本 document 的記憶體事件，export 的 `persistent:false` 表示無法保證跨 document 留存。無法寫入但可讀取舊紀錄時，不再以舊 ring 蓋掉新記憶體事件；此分支也先建立失敗測試後修正。

| 事件 | 可確認的事實與限制 |
| --- | --- |
| `BOOT` 的 document 改變、navigation type | 新 document；不能單獨確認誰觸發、Safari process 終止或 OOM |
| `TITLE_RETURN` start/done + source | 程式實際呼叫／完成既有 returnToTitle；不是新 document 的同義詞 |
| `DOCUMENT_RELOAD` source | Raising 明確「保存並重新載入」按鈕呼叫 reload |
| `PAGE_HIDE`／`PAGE_SHOW` persisted | 已觀察到的 lifecycle／bfcache 訊號；缺少 PAGE_HIDE 不證明 OOM |
| `CONTEXT_LOST`／`CONTEXT_RESTORED` | 實際 WebGL event；既有 Pixi context 與恢复處理未改 |
| `LOAD`／`LOAD_FAILED`／`ASSET_FAILED`／`ERROR`／`REJECTION` | 載入階段、失敗 code／安全相對路徑；不保留 private raw text |

有限 ring 可被後續多次操作覆蓋，因此應在第一次問題後下載。網站資料被清除、private browsing 限制或作業系統不發送 lifecycle event 時，缺失的紀錄仍標為未知。

## 驗收證據

來源：`nativeTutorialHuntScript.js`、`interactiveTutorialHuntSteps.js`（message 1544/1545；escape 90、return wait 180／總長 235）、`championshipStandaloneApp.js` 的 checkpoint 與既有 normal Hunt controls；既有 `INTERACTIVE_OPENING_TUTORIAL.v1.json` 契約、Owner 照片和本輪限定修復指示。沒有把 current implementation 升格為新 ROM 證據。

- 62 個診斷／教學 Hunt／設定／storage guard／asset ownership 精準測試通過，包含所有 Hunt checkpoint 復原與完整教學完成、正常 baseline 不变、第 180 幀不可見／181 幀可見、可讀不可寫 storage 邊界。
- 12 個既有 Battle optional audio 測試通過；VM mount fixture 加入診斷相依 stub，確認 core ready／required VFX gate／late disposal 時序仍保留。
- 隔離 Chromium 390×844：正常 Continue 進入 seeded cave checkpoint，message 1544／1545 與 reload 可見清單為空，回來後 species-021 再次可見；無 pageerror／缺失 URL。種子 checkpoint 和正常 UI 清楚區分，未當作從 New Game 全流程或實機 Safari 驗收。
- 診斷三案例：TITLE 真正下載且 save bytes 不變；受控 Raising 503 → 保存並重載 → 下一 document 仍可下載失敗／reload；同一 Pixi WebGL context lost/restored → 正常 SYSTEM 保存返回 → 完成 TITLE_RETURN 可區分。
- 前後視覺：[修復前](tutorial-cave-before.png)、[修復後](tutorial-cave-after.png)。兩圖皆隔離 QA 的同一 approved 本機資產與畫面條件，不發布 Owner 私人照片。

正式 build／validate **9336 files PASS**，build ID `45c4f2e6c7a1447d34f710374fdbe0fee26c8e2e51515ac517dc91b3537c200d`；必要 aggregate `test:ci` **1735/1735 PASS**。正式產物 browser 結果為 [診斷](followup-diagnostics-browser.json) 與 [洞穴可見性](tutorial-cave-visibility-browser.json)。發布 exact SHA 與 CI／Pages／live bytes 結果在最終交接訊息提供。實機 Safari 根因及穩定性仍待下一次紀錄與 Owner 真機驗收，不新增範圍或承諾日期。
