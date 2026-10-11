# 角色載入 Performance A — 公開試玩發布集

基準 `65ccdc69579fee29edebbbbdb072c68a70833a3c`。Parent已獨立審查精確四檔，八個前後SHA、patch重建和browser inputs一致；另跑5個queue/race/retry與7個ownership小測通過。核准沿既有公開試玩release gate發布；檔案與SHA見 [RELEASE_FILES.json](RELEASE_FILES.json)。

## 變更與界線

- `licensedCharacterRoster.js`：初始及動態角色共用最多2個完整bundle工作和pending去重。取消後不啟動排隊工作，dispose等待所有active與晚到資源釋放。
- `completedOriginalCharacters.js`：驗證baseline fetch沿用signal；取消後不開始baseline atlas fallback。
- `main.js`：Hunt傳既有signal；Battle mount持有並在dispose時abort角色signal；共同選項傳遞signal。
- roster測試：初始／動態上限、別名去重、預先取消、active late cleanup、失敗重試、原創adapter取消。

素材、授權來源、像素／nearest取樣、原生動畫與geometry、玩法／RNG、save、router及單一Pixi Application/ticker不變。沿用既有Assets引用計數；底層沒有逐request取消，late resource必須等完成才卸載。2工作可增加同時decode配置，未量到實體GPU峰值，不能說峰值不增加。

## 驗證

- 聚焦108項全通過；含224-art/228-species素材及Hunt／Raising／Battle各14,283 native frames幾何契約。
- 完整 `test:ci` 1,630／1,630、0 fail／skip。production build／validate 9291檔，build ID `b0d5d894fb85aba8fdc85b70beea5857a1df2ea81eacee6c6aebe7d741cf3dd6`。
- 只變更3個既有product approval SHA，其餘9,229不變。新增／刪除的6對hash命名JS chunks是既有bundle輸出變更，不是新增產品模組。
- 同六物種＋重複物種、每bundle固定60ms、交錯三輪：initial平均391.62→196.74ms；dynamic384.94→196.34ms；peak1→2，各六bundle載入／dispose一次。只證明受控排程，不能宣稱公網速度減半。
- 候選隔離正常UI：Battle自然完成至1081幀、六隻原生動作和HP改變、我方獲勝、結算返回、教學completed；只有1 Pixi Application、0 pageerror／缺檔。經濟／RNG／商店／籠子／instance identity／hunt history恢復原隔離存檔。
- 正常退出控制：2個runtime延後回應時結束教學回牧場；晚到2個均卸載、其餘4個角色未啟動、沒有晚到場景。
- 本次未修改的production artifact正常UI：教學選隊→完整自然戰鬥→勝負結算→返回→教學完成→保存退出→Continue重開，0 pageerror／缺檔。使用獨立context與先前自然遊戲存檔；沒有fixture／時鐘改寫／新增伺服器。

## 尚未關閉

上述production流程以本機供應精確建置bytes，並非公網或實體手機效能宣稱。公開驗證最多一輪cold，任何failure依診斷保留。遠端CI、Pages與線上hash需以同commit回條認定。

Battle近身交戰可見右側大量角色重疊／裁切；本批未改geometry，未縮小核定角色來掩蓋，視覺問題另列。Hunt的進度／STALLED診斷／小cell排程B、optional準備C，以及cube自由旋轉／好友入口均不混入。原LINK_BATTLE離線流程與PASSWORD格式保持。未宣稱全面原作對照、實體裝置或商業權利完成。

room與values協作者14個既有dirty tracked檔的HEAD／status／SHA不變，121,647個untracked路徑清單保留；未開新測試伺服器，未動玩家存檔，未重置額度／購買點數／啟用儲值。
