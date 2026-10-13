# 教學對戰 ready 到首次 renderer 返回的診斷補強

本批是 **診斷補強，非 iPhone 自動跳 TITLE 根因修復**。Owner 已確認沒有觸碰返回；不將 `back_forward` 歸因於使用者手勢。原 JSON／影片均唯讀，未開 live 網站或個人 profile，也未碰 Owner 存檔。

## 實作與界限

沿用原 `main.js` 入場順序、既有 Pixi Application／renderer／ticker、原存檔與畫質。每次對戰在已有 `LOAD battle ready` 後新增：

| event 欄位 | 精確意義 |
| --- | --- |
| `stage:loading-card, phase:done` | 既有 onReady callback 返回；該 callback 同步移除載入卡與 aria-busy |
| `stage:audio, phase:start` | 呼叫既有 optional audio 路徑之前，不等待或改變其順序 |
| `stage:first-render, phase:start, renderer:PIXI` | 既有 renderer 的首次 screen render 呼叫開始；忽略 offscreen render |
| `stage:first-render, phase:done, renderer:PIXI` | 該 renderer 呼叫成功返回；不是 GPU／compositor 實際呈現完成的證據 |

一次性 observer 保留原函式 this／參數／回傳／例外；不自行 render、不加 ticker、不加等待。在成功／拋錯後、離場或 mounter catch 清理時恢復原函式；其他後來替換的 renderer 函式不會被覆寫。若 render 拋錯只保留 start，不偽造 done；診斷寫入失敗不改變 render 結果。

去識別白名單與獨立 diagnostic key 不變，總量仍 **32 筆／8 KiB**。容量壓力先移除一般 LOAD，再移除一般 SCREEN，最後才按時間移除剩餘事件；保留原排列與最新事件。不永久保留所有事件，也不擴大 log。先建立失敗測試重現一般 LOAD 擠掉 BOOT，再修正保留策略，保護 document／lifecycle／失敗和對戰入場邊界。

## 驗收

21 個 diagnostics／既有 Battle optional audio 精準測試通過：成功返回透明性、offscreen 排除、只記一次、取消／拋錯不偽造成功、隱私／storage 失敗、32 筆／8 KiB、跨 document 重啟保留、core/VFX/audio 既有時序與 late disposal。發布 aggregate 已跑 1738 cases；最後 observer 細節修改後補跑上述 21 cases，exact SHA 的 CI 再核對全部。

只跑同一個隔離 QA seeded `battle-running` checkpoint 入場情境，經正常 TITLE→Continue；所有 request 由本機 hash-selected 正式產物供應。最終 build ID `551ac785904118af514c14c9d8cfce130effb6bdb66aef1d23ecfe825263c251`，9336 files。結果：[QA 事件](battle-entry-diagnostics-browser.json)。正常存檔原 bytes 不變，沒有新 document、pageerror 或缺失 URL；卡片已移除、aria-busy false；再觀察兩秒的新 frame 也不重複写入這四個事件。

本案例相對 document 時序：ready 2086ms → card removed 2087ms → audio start 2087ms → first render start 2186ms → return 2680ms。這說明程式 ready 與 renderer 返回有不同邊界，不用此 desktop 模擬數值推定 iPhone 故障原因或效能改善。

DOM 有一個 Pixi Application canvas 與一個原有 bounded Three VFX canvas。QA 觀測總共四個 WebGL context，其中只有這兩個 canvas 連在 DOM；另外兩個未連接、尺寸 0×0。不能把總數四直接當作兩個重複 Application，也不能由此判定 iPhone OOM。

前兩次相同案例嘗試分别修正 QA 將所有 WebGL probe 算成畫面 renderer 的斷言，以及在 build 替換目錄未完成時過早啟動驗證的安排錯誤；不是產品錯誤。最終是在完整 build 後按序驗收同一情境。未做其他 browser stress 或實機 Safari acceptance；Owner 暫無需反覆試。

## 限定資源檢查：有確證但另列修法

正常 Battle scene dispose 會移除其 ticker／resize observer、卸載場景並 dispose fieldArt／characterRoster／effectArt／shadows；正常 bounded Three overlay dispose 會移除原 Pixi ticker callback、卸載 instance/runtime 與 dispose renderer。此窗未證實重複畫面 renderer。

利用既有 `championship-battle-field-scene-cases.mjs` 的 recording stub，對 **初次 redraw 的 onView 注入拋錯**：mount 確實 reject，但 **scene root 1／destroy 0、ticker callback 1、resize callback 1** 仍留存。源碼 `createBattleFieldPixiPresentation.js:557–559` 在回傳 disposable presentation 之前先註冊與 redraw，該 throw 路徑沒有 scene cleanup。

建議下一個限定修復：先建立同一個 disposable presentation，再以 guarded initial registration/redraw，失敗時用同一 disposer 清理並重拋原 error，增加該受控 failure regression。本批按「找到確證才提修法」只提交上述確證與建議，未混入產品變更。Owner 此次已記錄 ready，而 ready 在初次 redraw 成功後，因此這個 fault path **未證實是本次 iPhone 根因**。

發布 exact SHA／CI／Pages／live bytes 在最終交接提供；不修改 parent 擁有的 CURRENT_PRODUCT_STATUS／TECH_DEBT_REGISTER。
