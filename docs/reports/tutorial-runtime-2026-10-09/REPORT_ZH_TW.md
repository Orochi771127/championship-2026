# 互動教學 runtime 第 1 切片：checkpoint 與基底隔離
日期：2026-10-09。狀態：INTEGRATED_BOUNDED，尚未開放正常教學入口。

本輪已修改既有 runtime 並執行測試，不是新增規劃文件。完成的範圍是：明確新遊戲邀請 → 接受 → 1495/1496/1497 三段語意 checkpoint → 保存／重載接續；以及邀請 → 拒絕 → 還原正常基底 → 成功保存後解除隔離。到 raising-hatch 會明確停下，available=false、finished=false；尚未用正常 Raising 行為假裝完成特殊教學。

## 已實作
- 新 interactiveTutorialCheckpoint.js 僅接受 version1、stage、message 三個精確欄位。支援 invitation、raising-intro、raising-hatch、declined；未實作的 Battle 等階段、completed、額外欄位、非整數／越界 message、異常 prototype／symbol 皆拒絕。
- nativeOpening 的 v1 及舊 tutorialStep 索引意義保留。新互動資料為 nativeOpening.version2 + checkpoint，tutorialStep 必須為 null。仍在 canonical v5 save 與 championshipModernSave:v1 之下，沒有第二存檔 key。
- 只有當次明確 newGame 建立的 app session 可呼叫 offerInteractiveTutorial。Continue 載入舊save不能自行加入新流程。main.js 尚未呼叫新入口，正常 onboarding eligibility 仍 false。
- app 私有 tutorialBaseline 是深凍結的序列化 rollback 資料，不運行模擬、不另建app/store。正常 save 在隔離期間投影為「正常基底＋checkpoint」，示範錢包、庫存、角色集合、圖鑑、戰績、RNG、Hunt history 等不作為保存來源。
- 將原有 Continue 還原整理為同一 hydrateSavedGame／applySavedGameData；拒絕與正常 Continue 共用既有 session 開啟和資料重建路徑。教學安全邊界重建保留座標、以暫時複製的 RNG 初始化呈現，不推進保存中的正常 RNG。
- savePort.prepare 只建立並驗證候選，沒有寫入／採納另一分頁／改變保存狀態。
- 保存成功才公開新 checkpoint；失敗保留 pending 供原 persistenceFacade.retry 重試。stale ACK與保存 observer 重入不能重複推進／寫入。stale-tab conflict 仍拒絕覆寫。
- 教學隔離期間，正常 Raising clock／command 不推進；普通 beginHunt 及捕獲 Home commit 暫時封住，等待專用教學 adapter 接好。沒有繞過既有捕獲保存保護。
- 缺少 RNG 的 active checkpoint 在替換現有 session 前拒絕，避免破壞已開啟遊戲。

## 找到並修正的重試缺口
新增測試先令「拒絕後保存」失敗，再刻意修改金錢、rank、照護及 RNG，最後重試並再作一次正常保存。第一版測試抓到記憶體中的變更可能滲入退出後的下一次保存。

修復是每次結束重試均透過共用資料還原程序重新套用不可變基底，成功寫入後才清除隔離。該負向測試現在通過；不只是第一次保存的 bytes 正確。

## 實際驗證
最終 focused／affected regression：**61/61 PASS**，其中新教學保存測試14項。舊cursor測試逐一覆蓋 null、-1、0..71（74種）。

涵蓋：
- strict schema與future／malformed checkpoint拒絕；
- v1舊save的 cursor、命名與未啟用狀態；
- 正常clock與command暫停；
- 活躍示範wallet、items、rank、badges、care、RNG改動後，canonical正常資料逐欄仍等於基底；
- 接受／三段ACK／重載／stale tap與hatch未實作邊界；
- 邀請、接受、ACK、拒絕寫入失敗及原保存介面重試；
- 拒絕保存失敗後的額外變動、重試、再正常保存仍無污染；
- 另一分頁較新bytes／重入observer／非法RNG；
- 既有save衝突、schema遷移、64KiB／forensic防線、clock、autosave、Battle交易、正常手勢捕獲返家及Continue。

另在**既有127.0.0.1:8766**、新的非持久Chrome context，以真正LOGIN／story／命名UI走完New Game，並reload→LOGIN→Continue。390×844與360×800均通過，pageerror=0，一個Raising Pixi canvas、無橫向overflow，仍是原本v1開場資料，沒有突然彈新教學。截圖已實際檢視，底欄文字／工具圖示與現有畫面保留。

這是正常入口回歸，**不是新互動教學的完整瀏覽器驗收**。本輪新流程的證據是app domain／存檔測試；尚無接受到孵化／Hunt／Battle的UI錄影。

重跑命令：
node --test tests/championship-interactive-tutorial-save-cases.mjs tests/championship-tutorial-cases.mjs tests/championship-save-conflict-cases.mjs tests/championship-save-economy-v2-cases.mjs tests/championship-clock-runtime-save-cases.mjs tests/championship-hunt-normal-capture-save-cases.mjs tests/championship-autosave-cases.mjs tests/championship-battle-economy-transaction-cases.mjs

## 下一段可直接接續
仍在原授權內，無需重問開工。
1. 在既有actor owner接專用19-state教學handler，先完成 raising-hatch species17 與初始餵食／清理等predicate。不得交給正常睡眠／成長authority。
2. 同一DOM對話／焦點層接 offer、choose、ACK（ACK攜帶expected checkpoint）；保存失敗畫面留在原checkpoint並提供既有retry。接UI時須依現有shell生命週期處理還原後的view訂閱。
3. 增加已實作且可恢復的checkpoint邊界，再逐段接Gate16、固定species13/21的Hunt adapter，以及Battle record61／189/212/207。依同一核心處理；普通Hunt entry的保護不可直接移除而沒有專用adapter。
4. 完成後的清理交易需要沿用本輪同一基底／重試策略，增加真正completed邊界及其負向測試。當前schema刻意不接受未實作completed。
5. 做正常全流程、五語、各段退出恢復、保存失敗、真實Battle結果的瀏覽器驗收，才開 eligibility。失敗／平手處理是明示web adaptation；原作仍UNKNOWN。

## 檔案與安全狀態
實作：
- src/championship/app/interactiveTutorialCheckpoint.js（新）
- src/championship/app/nativeOpeningState.js
- src/championship/app/championshipStandaloneApp.js
- src/championship/app/ChampionshipPersistentSavePort.js
- tests/championship-interactive-tutorial-save-cases.mjs（新）

契約：docs/contracts/championship/INTERACTIVE_OPENING_TUTORIAL.v1.json。
本輪報告／驗證：docs/reports/tutorial-runtime-2026-10-09/。
私有檢查與本輪專屬diff：R:\Projects\Championship2026\tutorial-runtime-20261009\。
RUNTIME_OWNED_DIFF.patch只比較本輪修改前快照，不混入協作者先前對StandaloneApp的改動；before/只保全本輪三個必要程式原檔與四個受影響文件。

開始branch handoff/dot-continuation-20261001，HEAD 1fb7d5fd21d3da47775d34ab0d3a1a95f6623972，dirty1071項；結束1077項，增加的6項均為本輪路徑，沒有移除既有status紀錄。保留其他協作者改動；沒有改素材、地圖、角色、五語字典、CSS、玩家實際save、public build inputs。沒有新server、commit/push/merge/checkout/reset/deploy或刪除，也沒有額度重置／點數購買。沒有工具或權限blocker；餘下的是實作與驗收工作，不是待Owner批准。

安全接續紀錄已保存於同一私有目錄的 SAFE_CONTINUATION_CHECKPOINT.json；本輪檔案雜湊在 FINAL_FILE_RECEIPT.json，最終範圍檢查在 FINAL_SAFETY_CHECK.json。
