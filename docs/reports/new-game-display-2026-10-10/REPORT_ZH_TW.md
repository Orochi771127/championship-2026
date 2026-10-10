# 新遊戲與牧場顯示修復（2026-10-10）

本批依 Owner 當日指示修正開場漫畫黑邊、正式蛋名、焰脈蛋影子、孵化素材失敗回饋，以及三個過大的原創牧場角色。首頁新版與 BGM 分批處理，不在本批內。

## 來源 → 契約 → 實作

- 漫畫：`openingStoryPresentation.js` 的五張 R2 原圖尺寸與 `opening.css`。固定深色框與 contain 產生留黑；改讓 img 保持固有比例、max 尺寸，框不再塗黑；不 crop／cover，也沒有改圖或故事的原生時序。
- 八蛋正式名由 dot 實看 OC225..232 設定板後交接：星絮蛋、焰脈蛋、潮環蛋、森芽蛋、雷紋蛋、月霧蛋、晶棘蛋、聖耀蛋。`openingEggChoices.js` 承載正式名，`openingPresentation.js` 只換 species 選項 caption；玩家暱稱與存檔不改。其他四語明示正式名保留繁中，未冒充已完成專名翻譯。
- 焰脈蛋：已批准 runtime `e001_digitama-dot-intake-r01/runtime.review.json`，cell0 `nativeBounds=[-27,-62.75,26.5,2.75]`。atlas 為未 trim 的384×352，舊幾何把透明框算成96 native寬、bottom8；真可見寬53.5、bottom2.75。`raisingNativeSizing.js` 優先取已驗證逐格 nativeBounds，陰影／selection 隨畫格更新；身體保留原點、密度，跳躍 Z 不傳入地面陰影。
- 正常孵化仍走 `nativeRaisingStarter.js` → `nativeIndividualEvolution.js`。egg0 ancestry140=14，其餘維持原生 constructor；不使用教學0→17去覆寫正常孵化。20種候選已在 accepted selection；未將載入問題誤判為缺製作。
- `loadActorTextures` 以前 ensureSpecies=false 且無舊版 idle/reaction sheet 時靜默 return，留下灰色幾何獸。canonical species 現在以 DOM 顯示載入／錯誤，提供重試；不繪出假孵化角色。diagnostics 保留 species、entity、runtime URL 與錯誤。`createPixiAssetScope` 移除尚未產生 bundle 時留下的 rejected held promise，同一場景才可重新載入。
- 三個 Raising 原創角色採固定係數：m518_blackwargreymon=0.6444、m529_metalgarurumon_va=0.3648、m541_dukemon=0.5948。每個 pose 在原生幾何更新後乘同一係數，補償水平中心和底部；只匹配 completed-original 證據。m503、m509保持1。此為 Owner 授權顯示調整，**OWNER_APPROVED_ADAPTATION**，不稱 ROM_VERIFIED；Hunt、Battle 1.5、結果畫面、原生移動/碰撞/地面座標不改。

## 已驗證及界線

23項聚焦測試及既有 mandatory CI 1,578/1,578 通過。正常UI開始、逐蛋拒絕教學後由實際ticker自然孵化，八蛋全數成功，涵蓋五語390×844/DPR3；保存／重載身份和玩家暱稱一致。原圖比例／無裁切／透明框背景已量測。刻意503阻斷幼生 runtime 後，錯誤提示可見，同場景重試成功，沒有灰色幾何角色。三究極體實際長按進入 carry state6，放下回到地面 Z=0；另外兩隻比例不變。摘要見 [VALIDATION.json](VALIDATION.json)。

使用隔離瀏覽器和測試存檔；沒有 Owner 原始存檔，也未在實體iOS重現當時失敗。這次焰脈正常自然孵化為species018；先前受控touch/clock重現為species017，均有對應原創entity。Owner照片當次species與GPU/網路原因尚不可追溯，不宣稱已證明該次設備根因。

完整本機腳本、逐格診斷與截圖：`R:/Projects/Championship2026/new-game-fixes-20261010/`。Library官方materializer在Windows的`os.setxattr`失敗，未繞過下載流程。指定標題參考影片已用既有ffmpeg抽10幀、只作研究，未進runtime。
