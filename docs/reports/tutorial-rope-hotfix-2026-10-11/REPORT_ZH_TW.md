# 教材与斷繩重試：公開試玩 hotfix 發布集

基準 `9d850b79cd0d2bdc568561ddd2e822d1d7fe210c`。Parent 獨立審查 14 個前後 SHA、6 個產品 bundle inputs、29／29 與 64／64 回歸、最後 fresh-pull 單項與五語 10 個 UI 後，核准精確 7 檔進入既有公開試玩發布流程。逐檔 bytes 見 [RELEASE_FILES.json](RELEASE_FILES.json)。

## 變更

- 五語 Gate 教材與實際 UI 一致：選擇目的地，再按既有在地化「開始狩獵」。保留歷史 action ID。
- 第二目標使用既有 speciesName(21) 的「焰角丸」映射；不改 ID、暱稱或存檔。
- 拉斷繩索後放開，清理已無 rope 的 ROPE_PULL pointer，允許同頁再拉扯；握住期間仍保留 pointer 所有權。未改耐久、HP、隨機、時鐘、捕獲數值或教學順序。
- 加入斷繩放開後建立 fresh pull 的回歸測試。只更新既有核准表的 6 個產品 SHA，其餘 9,226 筆不變；沒有新增素材或目的地。

## 發布前驗證

- 完整 test:ci 1,629／1,629 PASS，0 skipped；沿用原有 portable／local-reference 分類。
- production build 成功：9,291 檔，build ID `a6606c99a1c22a3e817a9837eefab2e867752b02319074212f5362ceb94f96ee`。validate 回條與同 SHA 的遠端 CI／Pages／live hash 另隨最终發布包保存。
- 預載清單 257 項已新，不需修改 championship.html；成品 HTML 與兩個 bundle 名稱因實際編譯 hash 更新。其他產品、样式、角色與地圖不動。
- 精確 production bytes 的隔離 Chrome：自然存檔經正常 LOGIN→Continue，Gate 選擇→開始狩獵與第二目標教材通過；缺檔與 pageerror 皆 0。先前五語 10 UI 與候選斷繩→重試→手掌收取證據保留，不能冒稱為公開版測試。

## 分開保留的 QA 與缺口

基準公開版的一條正常教學已從原第一次捕獲 checkpoint 完成第二次狩獵、自然 Battle 結果、教學結束、自由育成、名冊與保存返回。完成瞬間，自己的蛋、暱稱、RNG 與經濟皆回復原基底，只更動 checkpoint／revision／保存時間。這不是全遊戲驗收，也沒有完整錄到 Battle 動畫。

教學結束後外觀載入期間時鐘前進、錯過自己的蛋／孵化，是**仍開放的 clock P1**。Battle 首載至少 6 分 35 秒、六圖集共 31,731,274 bytes，以及舊品牌可見字串另案處理；本提交沒有 clock 候選、對戰壓縮或額外去品牌變更。

本檔為提交前紀錄，發布成功僅以同 SHA 的 remote CI／Pages、live build／檔案 hash 与公開斷繩重試／教材 smoke 最終回條認定。實體觸控、DOM pointer-capture 分支、全 Battle 動畫、全物種／地圖、母語審校、素材權利及商業上架仍未由本批完成。

保留全部既有 untracked、room／values worktree、玩家存檔與既有伺服器；沒有 force、reset、clean 或新增常駐伺服器。未使用額度重置、購點或自動儲值。
