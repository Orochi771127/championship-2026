# 冷牧場與首曲載入：第二個有界小批

基準：`f21e522c9d9dab8daae60407cee5662ecd7d0765`。Owner／parent 明確續作 cold Continue→角色素材就緒及 cold login music，沿既有修正後公開授權。帳號保存／交換碼／實時server的P0繼續暫緩。本批不改圖片像素、音檔、音量、曲目、戰鬥規則、RNG、存檔或單一Pixi／ticker權威。

## 既有完整trace定位

同一390×844、DPR2、mobile/touch、10Mbps down／5Mbps up上限＋80ms、隔離owned-party存檔：

- Continue後約1KB的 `createChampionshipModeShell` dynamic chunk獨自等待41.308秒；本體只是模式生命週期容器，沒有理由在使用者按Continue後再取一次。
- HUD索引從62.399秒到96.823秒、baseline manifest到99.220秒；角色adapter依賴到106.268秒，這些原本被逐段await。Pixi直到106.638秒才開始載入。
- 只請求當前species034的一份HUD及角色包，沒有重載全222角色。48張反應小圖總共9,463 bytes，並非大體積圖片；本批保留完整資源就緒要求，不提早假報ready。
- 四張首頁無損圖共約5.36MB，背景圖到97.189秒才結束。登入MP3沒有大封面，前置ID3只有133 bytes，192kbps／164.87秒。readyState0及stalled是等待媒體bytes，非解碼或靜音拒絕。
- page CDP已完成bytes下限7.216MB／142.625秒，約0.40Mbps；這不含未結束媒體與未完整捕捉的worker圖像，**不能當整體有效網速**。小檔案也出現數十秒等待，說明排程／傳輸阻塞不可只歸因於素材bytes或PNG解碼。

## 可驗證的小修

1. 共用小型模式shell改為static import，仍於既有async load呼叫時才建立實例，保留所有activation gates。
2. 當前牧場才啟動Pixi module下載，與HUD metadata並行；Application仍在實際canvas host存在時由原ensurePixiStage建立。HUD已通過的按需／cache／別名邏輯不變，只併行固定metadata與adapter讀取；缺少註冊仍立即fallback。
3. 離開首頁時停止未完成的裝飾圖下載，返回首頁恢復同URL；已解碼圖片保留。背景也沿原CSS恢復。沒有resize、重壓縮、重生圖或新來源。
4. 首次手勢觸發原首曲串流時，暫緩未完成的首頁裝飾圖；canplaythrough／readyState4或至少8秒buffer後恢復同圖，以low fetchpriority避免重新壓住media。保留原AudioContext、最多兩個HTMLAudioElement、mute／background／cue取消／錯誤釋放。沒有預抓九曲或重編音檔。

短實驗先否定64KB prefix快取方案，未接入產品。僅在playing時恢復正常優先圖片也被否定：1.386秒後再等待。最後一個12秒transport小實驗以低優先恢復原圖，約0.32秒起播；12秒檢查時currentTime11.670、buffered至36.031秒，未再waiting。這是受控網路實驗，不代替正式遊戲或實體iOS驗收。

## 驗收界線

- 30／30聚焦測試通過：並行啟動、缺註冊不等其它請求、圖片釋放／恢復、模式gate、首曲緩衝／mute／error、既有audio/HUD/build boundary。
- 已建置候選的正常UI：Continue→角色ready／僅一張canvas、保存返回首頁→原圖恢復、新遊戲開場／命名／選蛋→牧場、保存靜音不請求曲目，通過。使用隔離既有fixture，沒有改玩家存檔或注入遊戲時鐘／RNG。
- 發布後只做一個同profile的冷載小樣本，沿用既有baseline，不重跑長基準／全遊戲；其實際commit、buildId、音樂事件、worker請求（可得時）與timing收入本輪Library交接。
- 不宣稱人工聆聽、實體iOS或所有網路速度。冷載尚有等待就列為未關閉，不靠延長timeout宣稱解決。

本輪原始證據：`R:/Projects/Championship2026/new-game-fixes-20261010/cold-loading-r2/`。原協作工作區保持不動。
