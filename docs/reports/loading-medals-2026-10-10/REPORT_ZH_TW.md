# 載入與公開徽章入口驗收（2026-10-10）

基準公開 commit：`b10c16272d8cb299362d167ca685c35b016513f6`。本批契約：[LOADING_AND_MEDALS_2026-10-10](../../contracts/championship/LOADING_AND_MEDALS_2026-10-10.md)。發布後 commit、buildId、公開量測與原生 Library receipt 由交接包補充；此原始碼報告不預稱尚未執行的公開結果。

## 根因與修復

- 首頁 static closure 原有 252 modules／5,288,711 bytes，且首頁暖載入會提早競爭 Battle／Three／roster 資源。現在公開建置為 26 個必要 ESM chunks，約 3.86MB 未壓縮 JS；沿既有 app/module authority，取消不在當前畫面的背景預載。
- 原先每次建立 HUD 均等待 222 份角色 overlay manifests。改以畫面 resident／combatant／result species 載入，成功 JSON 在同一頁內合併；未來角色按需補齐並重繪。圖片、atlas、邏輯尺寸、四倍密度與別名映射不變。
- 徽章素材早已允許核准公開站，但工具列仍用 localOnly 過濾。只把 medals 入口改用既有 original-runtime gate，其他本機試驗不受影響。

## 音樂深度診斷

同一登入 MP3：完整公開冷載時 gesture 為 trusted／userActivation=true、AudioContext=running；請求 206、audio/mp3、CORS *，主／音樂音量皆1。play promise 並未拒絕，media readyState=0、無 buffered range，約3.3秒觸發 stalled。實際等到約67.9秒 play resolve，currentTime 2.312→7.332／5秒，readyState4、unmuted，cue gain 正常。

相同本機 bytes 約66ms開始；僅音樂走公開 CDN、其他 bytes 本機約473ms開始。這些對照支持啟動請求競爭／傳輸停滯，沒有證据支持 MIME、CORS、gesture 或 mute 錯誤。沒有藉增加 timeout 冒稱修復，也沒有改音樂內容或自動播放限制。人工聆聽、實體 iOS 仍未完成。

## 基準與證據

相同公開環境：390×844、DPR2、mobile/touch，隔離既有 owned-party fixture；CDP 最大10Mbps down／5Mbps up、額外80ms，CDN仍有波動。冷title可互動 76,266ms；Continue→所有resident ready 122,002ms。相同context暖載為209ms／411ms。此單次基準不代表所有玩家速度；發布後同条件結果放入交接包。

本機證據根目錄：`R:/Projects/Championship2026/new-game-fixes-20261010/loading-optimization/`。正式原生 Library交接包包含量測 JSON、正常流程、畫面及公開 commit/build hash，而非私人工作區或玩家存檔。完整1585項先前批次已執行，本批本機只做受影響測試，遠端 CI 依既有 workflow 執行。

原始協作工作區 `championship-2026` 不改動；所有實作位於既有發布工作區 `championship-2026-publish-20261010`。未啟動新伺服器、未重製角色／地圖、未使用額度重置或付費服務。

## 本批本機驗收結果

- 23/23 聚焦單元與 build-boundary 測試通過；包含 164 張既有 UI PNG 完整 SHA／密度、61 canonical flags、HUD species／別名、快取與未核准 bundle 依賴拒絕。
- 正式打包產物於核准公開 origin 的隔離瀏覽器：gesture 音樂時間0.154→1.171秒、新遊戲正常开場／命名／選蛋→牧場、61枚徽章全圖載入、既有 species217 fixture 正常頭銜戰自然勝利、取得第1枚徽章、reload仍為1枚，全部通過。無 runtime RNG／傷害／outcome／時鐘注入；無 console pageerror 或404。測試準備的 controlled save 不等於玩家養成成就。
- 原協作工作區67個 tracked修改的SHA全部與保全記錄相符。

## 公開第一輪量測與入口修正

`f06c5053` 已公開，CI1590/1590、61個公開產物檔案SHA均通過。相同profile第一輪 title 103,713ms，較基準慢；Continue完整resident ready 46,686ms，暖title131ms／Continue333ms。登入後5秒原生媒體currentTime為3.887秒，無播放拒絕。不能將這一輪描述成「首頁載入改善」。

Network記錄顯示 static chunks 最慢約5.7秒完成，但主入口未預載、由HTML動態插入，到103.7秒才完整下載（444,157傳輸bytes）；同時大型首頁圖持續下載。據此補上主入口的第一個 modulepreload 與 high fetchpriority，維持完全相同JS和图片bytes，只改請求排程。發布後再次使用原profile量測；CDN變化與實際結果由最終交接包記錄，不預設此修正一定消除所有延遲。
