# Performance C — Battle 音效可選載入公開試玩發布集

基準 `89b4ffa1faf78a182e5d54171f19c4761dde791a`。接收聊天已取得 Owner 直接授權發布精確 C 四檔與必要紀錄；四檔 SHA／大小／before-after 與已獨立審查候選一致。精確來源見 [RELEASE_FILES.json](RELEASE_FILES.json)。

## 行為與範圍

- `main.js`：核心場景與必要 Three VFX 都就緒後先開始既有 Battle，再準備音效；core-art／必要 VFX 缺失不得假 ready。離場取消音效與角色工作，已取得的資源共用一次清理。
- `battleAudioPresentation.js`：最多四個完整 fetch/body/decode 工作；metadata、sample、decoder 可放棄等待並觀察晚到拒絕；完成準備時採當下事件游標，不补播載入期間的過期聲音；共享 audio bus context 不由場景關閉。
- 新增 12 個測試與既有 CI scope 的一行註冊。無新增產品模組、素材、圖像、字典、CSS、角色尺寸、擴充、B、cube 或其他協作者改動；既有 gameplay／RNG／save／router／單一 Pixi Application/ticker 保留。

## 發布前證據

- 原交接包 58 個檔案 hash 全符；獨立審查交接記錄 17 項隔離檢查通過。
- C 專項 12／12，七個相關模組聚焦 63／63。補驗完整 CI 1,642／1,642、0 fail／cancel／skip；loopback 1／1。原始輸出與 RUNS.json 的 SHA 已核對。早期 esbuild／loopback 環境失敗保留於原交接，補驗沒有改候選。
- 正式既有 release build／validate 通過，9,291 檔，build ID `8361e63a1d03e86ea41bdcae2861b1f89236b33030be8549c02892c21d30764b`。既有公開試玩核准清單只更新兩個產品 SHA，其他 9,230 個選定檔案未改，沒有新增或移除核准項目。
- 正式 browser bundle metadata 與已測候選逐項相同，57 個候選輸出的 SHA／bytes 均與正式產物一致。交接 candidate bundle 沒有代替本次正式 build／validate。
- 五個受控正常 UI 情境：正常、四 sample 永不完成、sample 延遲、sample 拒絕均自然戰鬥至結算與保存重開；核心 atlas 缺失正確顯示 error，沒有假 ready。四場自然戰鬥的必要 impact VFX 可見，0 pageerror／sampler error，原 QA seed 未改。這些是隔離供應精確 bytes 的本機證據。
- 本機只沿用既有 publish checkout 已安裝的 esbuild 0.28.2，以程序暫時 NODE_OPTIONS resolver 使用；沒有安裝或修改 package／lock。

## 驗證限制與後續回條

遠端 CI／Pages／公開 hash 及本機 main 以同 SHA 最終發布回條為準。公網最多一輪有時限、正常入口→自然戰鬥→保存重開；若失敗保留診斷，不反覆長測或假稱 PASS。

音效不再阻擋開始是本批已證明的行為；六角色 atlas 31,731,274 bytes 與必要 VFX 的等待仍在，core 永久 pending／超時沒有全面修復，不能宣稱公網速度、實機改善或峰值記憶體不增加。既有 CM03/CM24 fold 前景底圖查找缺陷與近身右側重疊／裁切屬於另批工作，本次沒有修補或混入。

room／values 及全部無關未提交／未追蹤檔案的保全以本批前後 HEAD／status／SHA 回條核對；不使用 reset、clean、force push 或整批 git add，不接觸玩家存檔。
