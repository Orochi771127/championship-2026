# 初次 Battle redraw 失敗清理修復

本批只修 R2 受控重現的 failure path；**Owner iPhone 自動回 TITLE 原因仍未確認**。真實診斷已記錄 ready，而 ready 在初次 redraw 成功後，本修復不能直接當作該 iPhone 個案根因修復。

先建立 `onView` 拋出固定 error 的失敗回歸：root destroy／detach 均為 0，且各留下 1 個本場景 ticker／resize callback。傳入的 fieldArt／characterRoster／effectArt 屬於外層 caller；正常失敗 catch 已會 dispose 這些輸入，不能內外層各 dispose 一次。

`createBattleFieldPixiPresentation.js` 現在先建立原有 disposable presentation，再 guarded 註冊／初次 redraw。失敗時 await 同一 disposer 清理本场景節點、resize／ticker 與內部建立的資源，再重拋原 error object；成功後才取得輸入資源所有權，後續原有正常 disposer 仍只釋放一次。沒有新增第二個清理 authority、runtime 或 ticker，也未改畫質、正常玩法、存檔、資產 bytes 或一次性 renderer observer。

40 個精準回歸通過：失敗後 root destroy／detach 各一次、本場景 callback 0、其他 shared callback 保留；caller-owned 三項輸入在 rejected mount 時未被 scene dispose，由 caller 各釋放一次。正常首 draw 成功、後續重複 dispose、既有視覺／30/60/120Hz 模擬、audio ownership、R2 observer 及診斷邊界均通過。

發布前 aggregate **1740/1740 PASS**；正式 build／validate **9336 files PASS**，build ID `ebe0014b6367b1e03f826130c467ddd259036c9e409f33acd46ccf93075328fa`。同一隔離 QA 教學 Battle 入場正常流程與 R2 五個 boundary event 次序／只記一次／存檔 bytes 不變均通過：[QA 結果](initial-redraw-normal-browser.json)。實機 Safari 仍未驗收。

發布 exact SHA／CI／Pages／live hash 在最終 receipt 提供。既有 Parent 独立驗收的 b3a5 不重查；不接入 parent 的符號設計、不編輯其 CURRENT_PRODUCT_STATUS／TECH_DEBT_REGISTER。
