# 圖鑑階段篩選與固定顯示碼（2026-10-13）

沿用乾淨、已發布的`391cbe78227ed60b5d88148188cc5a7a7c12149c`隔離工作樹，Owner本機main保持`94207e6ee4927bb5357646a4319d90e4d7e3ceea`，未reset／stash或覆寫其他工作。[本批契約](../../contracts/championship/DATABASE_DISPLAY_2026-10-13.md)記錄三份可讀Library附件來源與工程判定；私人研究附件未原樣落盤或進runtime。

逐筆核對盤點228筆身份、階段、lookupKey與原ordinal，保存224個固定顯示項：八蛋EG01–EG08，另216格按舊bookOrdinal順序在各階段配號B1／B2／GR／MA／AW／UL。七階段8／12／14／38／64／51／37，特殊224–227仍排除。固定身份摘要阻擋重新配號／刪除既有映射；後續只追加，不回收退役碼，不以語言、篩選或目前排序即時計算。這是Owner呈現適配，沒有改寫原作證據。

原216格projection、登錄writer、Hunt返Home保存成功gate與失敗回滾未改。蛋明示NOT_TRACKED內容索引、不計入216格登錄。未知項列表????，詳情只顯示固定碼／階段及中性提示，不揭露名稱、介紹或個體欄位。原UI沒有進化樹，本批不新增故事／路線／條件引擎；分支歷史保持來源＋branchIndex身份。正式蛋名及其五語名稱註記、五語階段與覺醒體均沿用既有權威。

44px階段控制與既有雙欄／手機詳情流程共用兩種HUD。篩選排除已選項時清除詳情並留住篩選焦點；關閉與Escape恢復項目焦點，resize保留活的暱稱輸入與pane滾動。沒有第二router、store、ticker或save。

QA使用全請求攔截的獨立Chromium context，未連Owner8732或玩家瀏覽器儲存。既有QA save只在context副本移除未持有species10登錄作遮蔽案例；原QA檔案不改。不修改RNG／actor來偽造事件。

- 聚焦23／23：固定映射、八蛋、七階段五語、216格、DOM文字／遮蔽、保存與獨立分支。
- 登錄／正常捕獲保存／桌面契約回歸8／8。
- [改前4配置](before/browser-summary.json)；[改後100配置、20操作、10組篩選／八蛋／遮蔽](after/browser-summary.json)全過，pageerror／缺檔0。含1366×768、1366×480、1024×420、390×844、resize往返、五語、warm／classic。
- aggregate CI1766／1766，無跳過；source preload仍232。
- 一次正式build／validate9398檔通過，build ID `8f78abda3f1d571cb2b14ded1654b19a84822bda4119fdc8cc24f70979f444cd`。[compiled browser](compiled/browser-summary.json)另驗两種HUD、繁中／長泰語40配置、8操作、4組篩選／八蛋／遮蔽全過，pageerror／缺檔0。詳見[驗證摘要](validation.json)。

改前：[暖色](before/warm-zh-Hant-database-1366x768.png)／[復古](before/classic-zh-Hant-database-1366x768.png)。改後：[暖色固定碼與篩選](after/warm-zh-Hant-stage-filter.png)／[泰語復古短高雙欄](after/classic-th-database-1366x480.png)／[泰語390px詳情](after/classic-th-database-390x844.png)／[蛋索引](compiled/classic-th-egg-phone.png)。圖片檢視服務一度中斷，已從原PNG壓縮預覽人工複核這些配置，未見截斷或橫向溢出；完整原PNG保留。

發布僅提交本批檔案、祖先核對及非強制推送。精確SHA、CI／Pages與公開artifact bytes於執行完成後回報。既有Pages容量警告不藉此刪素材、降畫質或遷移部署。實體裝置、泰／越母語及原作完整視覺／保存語義仍未驗收。
