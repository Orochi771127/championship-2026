# 自有夥伴素材就緒與時鐘 P1：公開試玩發布集

基準 `945447fcdb85ebfb451850eeb9c3afa80e1ad449`。Parent 已獨立審查精確 3 檔候選；逐檔 SHA 見 [RELEASE_FILES.json](RELEASE_FILES.json)。延續 Owner 本批修復、commit/push、既有 Pages 公開試玩與本機同步授權。

## 問題與最小修復

既有 clock driver 已檢查 scene.isPlayable，但 Raising Pixi scene 未提供此 getter。場景 mount 後，自有角色圖集仍 pending／error 時育成時鐘照常前進，慢速網路可能錯過自己的蛋。新增 getter，只在場景未 dispose／abort、當前每隻夥伴的相符 species 資源皆 ready 時放行既有時鐘。裝飾與非必要回饋素材不列入。

動態夥伴載入中維持 aria-busy 與既有取消／重試／保存返回控制；保存失敗仍不 reload。教學完成由臨時教學角色切回自有蛋時重置既有鏡頭初始定位，讓蛋回到畫面內。沒有新增 Application、ticker、存檔權威、離線進度、時間倍率、孵化／RNG 規則或素材。

## 驗證

- focused 48／48；含真正場景 getter 與既有 clock driver 的 pending→error→retry→ready、dispose／late completion。只有 Pixi 繪圖替身；1 場景 listener＋1 clock listener，dispose 後皆移除。
- 完整發布 CI 1,630／1,630、0 skipped。Production build／validate 9,291 檔，build ID `7e3bfbd4d636b4d277874d7ddccc2664cb4633c93e642ebeb63cea6f14b3d95e`。
- 只更新 2 個產品 approval SHA，其餘 9,230 筆不變；原預載 257 項已新。成品 HTML／main bundle 依編譯 hash 更新。
- 同一自然完成存檔與 4 秒自有蛋圖集延遲：基準時間 07:02→07:23；候選維持 07:00／nativeFrame 0，就緒後沿既有速率前進，無追補跳時。
- 精確 production 成品的隔離 Chrome：受控單素材 hold→ready，正常手指點選自有小焰、滑鼠按住／移動／放開手勢、自然孵化、夥伴名冊、保存返回首頁均通過；1 canvas、0 pageerror、0 missing。此手勢證據不等於實體手機搬運驗收。
- 先前正常 after-Battle checkpoint 經最後兩段對話回復自己的蛋，再自然孵化至 species-022；基底經濟／RNG／暱稱未受此修復改變。正常 Continue 既有初始化會消耗兩次 RNG（朝向／角度），已有獨立隔離證據；不能宣稱磁碟存檔的 RNG 在 Continue 前後完全相同。生物互動路徑不同時，不把孵化種別變化歸因於 clock 修復。

## 證據邊界與保存

本檔為提交前紀錄。正式完成以同 SHA 的 remote CI／Pages、live build／檔案 hash 與公開受控 hold→ready／正常操作回條認定。單素材 hold 是受控故障注入，公開正常網路與先前自然教學另列；沒有宣稱全 Battle 動畫、全物種／地圖、實體 iOS、商業權利或全遊戲已驗收。

Battle 六圖集冷載入、有限併發／去重、品牌可見字串留待獨立批次。保留原有 121,647 untracked 路徑、room／values worktree、玩家存檔與現有伺服器；不 force／reset／clean，不開新伺服器、不使用重置／購點／自動儲值。

前批 `945447fc` 已推送，CI 38123205250／Pages 38123205253 成功，live hash 20／20 相符。公開 Hunt 補測出現下載逾時；僅斷繩後 HP 359→298→0 可證明輸入恢復，完整收取／返回與第二目標文字未完成。Parent 已確認此獨立下載可靠性問題不阻擋本 clock 批發布，保留後續性能診斷。
