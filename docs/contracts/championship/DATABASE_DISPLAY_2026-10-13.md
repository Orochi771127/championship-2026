# 圖鑑階段篩選與固定顯示碼

分類：`OWNER_APPROVED_ADAPTATION`。Owner 於2026-10-13授權階段篩選、固定階段號、八蛋內容索引及自審後提交／正常推送／公開發布。沿用已發布`391cbe78227ed60b5d88148188cc5a7a7c12149c`，不移動Owner本機main。

顯示目錄：[database-display.r1.json](../../../src/data/championship/database-display.r1.json)。第一版按既有216格bookOrdinal順序，在各階段各自配號；八蛋依現有`openingEggChoices`核准內容順序EG01–EG08。前綴固定為EG／B1／B2／GR／MA／AW／UL，序號至少兩位，100之後不改既有碼。固定entryKey、speciesIndex、speciesId、numberingStageIndex、serial、displayCode及legacyBookOrdinal；後續只追加該階段最大已用／保留／退役serial＋1，不回收或重排。退休項保留目錄記錄。發布身份回條由聚焦測試固定SHA-256，不因篩選、語言或排序重新配號。

第一版224個顯示項：8蛋＋216常規，階段數量8／12／14／38／64／51／37。蛋的legacyBookOrdinal為null；物種224–227仍排除。228筆來源物種不是222筆已核准角色美術的數量，也不是本次發布素材清單。所有原物種／個體／資產／進化與存檔ID保持原值。

常規登錄權威仍是原`databaseRuntime`及既有登錄集合，分母216。未知列表顯示????，詳情只顯示中性未登錄訊息、固定碼與共用階段詞彙，沒有名稱／介紹／個體輸入的揭露。已登錄零持有仍保留登錄。既有instanceCount只計捕獲collection，本批不改標成完整持有數。

蛋使用現有已核准八蛋圖像與正式名稱；非繁中沿用現有名稱註記。狀態NOT_TRACKED，明示內容索引及沒有永久取得歷史，不計入216格登錄。本批沒有新增蛋存檔或seen歷史。普通selector仍拒絕蛋；蛋詳情選擇只留在既有DOM view的暫態中，沒有第二個router或全域store。

目前圖鑑DOM頁沒有進化樹，本批不新增候選線、故事或條件引擎。既有`raising.nativeHome.evolutionBranches`保持來源物種＋群內分支位置的獨立歷史；測試登錄target20不產生source8→20的offset0，既有其他分支值與空歷史均保留。捕獲返Home消費者、保存成功gate及失敗回滾不變；原作相同持久保存語義仍UNKNOWN。

七階段標籤重用`generationName`及已發布五語覺醒體詞彙。桌面保留列表／詳情雙欄與獨立滾動；手機保留列表→詳情→返回、44px階段控制及兩種HUD。切換篩選時只清除被排除的詳情，保留filter焦點；關閉詳情恢復原項焦點及可見位置，resize不替換活的暱稱輸入。

私人來源僅作工程核對，未原樣落盤或放入runtime：

- Library `libfile_5b362465d4808191a7cc153c3caf74b3`：DEX_ENGINEERING_HANDOFF_20261013_ZH_TW.md，17行。
- Library `libfile_30954e1dcd7081919934a23ef20e52f9`：DEX_DATA_CONTRACT_DRAFT_20261014_ZH_TW.md，345行；非EG前綴及首次配號提案由本輪Owner明示方向定案。
- Library `libfile_a061a4f060ec8191851e90fc5a698ce4`：DEX_CATALOG_EVIDENCE_20261014.csv。忽略Library渲染頁頭與新增index，逐筆交叉核對228筆recordIndex／speciesIndex、階段、lookupKey、原ordinal；displayCode由現有產品目錄建立。

驗收與發布：[本批報告](../../reports/database-display-2026-10-13/REPORT_ZH_TW.md)。產品瀏覽器測試不替代原作動態、逐像素視覺、母語或實體裝置驗收。
