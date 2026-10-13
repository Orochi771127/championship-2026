# TITLE 圖片可見性小批次（2026-10-13）

起點為乾淨已發布`125ad364d7789ee8247fdbd849fe73f59a81621b`的同一隔離工作樹。Owner本機main與存檔不動。依dot已有來源及冷4G分析完成兩項確定改善，沒有擴充圖鑑、部署或圖片排序候選。

`titleImageLifecycle`依實際語言只載可見logo；非中文不抓1,393,020 bytes的中文圖，也不把其失敗算進當前進度／error。切回中文才載；完成Blob快取與URL可在語言來回時沿用；未完成隱藏logo取消，晚到body／decode不掛回。失敗保留明確retry，語言切換同步狀態。原同一owner、60秒deadline、低優先序、背景取消與URL回收保留。

中文原正式h1在等待、decode及失敗時可讀；原DOM img完成附掛decode後才顯示核准logo。預留原2:1 logo區，其他錨點與最終原圖不變。h1保持唯一可讀標題，裝飾logo仍aria-hidden，沒有新圖或降畫質。CSS只作用於原TITLE面板：自審發現影片結尾clone同名品牌節點，已收緊選擇器，保留其原規則並补回歸；因此初候選build後作必要修正與最終重建。

正常UI使用獨立Chromium context、全部請求攔截至工作樹／artifact及既有QA副本。五語初始、en→zh→en中止、缺圖、retry、多次切語快取、手機390×844、短高1366×480、Continue→Save & Quit→TITLE皆通過。初期新QA供檔漏.mjs MIME造成牧場引擎載入失敗，補正QA後原遊戲入口正常；沒有為此修改引擎或保存流程。

量測用原720p影片真實首幀與可信Skip／LOGIN、原圖、真實HTTP gzip／Range及隨機loopback埠（非8732）。Pixel7 Chromium模擬、冷快取、4Mbps下載／1Mbps上傳／150ms、CPU4；每語言兩次，沒有實機或統計顯著性宣稱。逐圖附掛／arena decode與品牌／構圖可見時戳記錄於[改前](before-performance.json)、[最終改後](after-performance.json)與[比較](comparison.json)。初候選量測另保留[candidate](candidate-performance.json)，不冒充最終artifact。

39項聚焦、一次必要aggregate1770項通過（其後僅收緊CSS面板範圍，重跑聚焦／compiled及相關媒體檢查，精確發布SHA的CI另驗最終檔案）。最終build／validate9398檔通過，build ID `ce0608e632398f69a080fb393b01ed2202d036c0aa8cdea40e0f35306c3f4d74`。compiled五語UI、[媒體buffer八項](media-buffer.json)與[三項skip／idle／dialog／startup合同](film-contracts.json)通過；buffer回歸另驗影片clone保留原樣式。保留六秒headroom、720／1080／540選擇、音樂初緩衝優先、350ms防穿透、idle、reduced motion、失敗回退及背景URL清理；不改影片檔案或原圖hash。

最終兩次冷4G樣本平均（完整原始數據見比較檔）：

| 語言／指標 | 改前 | 改後 |
|---|---:|---:|
| 中文：圖片bytes／請求 | 5,350,394／4 | 5,350,394／4 |
| 中文：Skip→品牌可讀 | 12.704秒 | 0.030秒 |
| 中文：Skip→背景＋品牌 | 15.380秒 | 15.393秒 |
| 中文：Skip→四圖全齊 | 15.380秒 | 15.394秒 |
| 英文：圖片bytes／請求 | 5,350,394／4 | 3,957,374／3 |
| 英文：Skip→品牌可讀 | 0.029秒 | 0.029秒 |
| 英文：Skip→背景＋品牌／完整可見構圖 | 15.380秒 | 12.611／12.612秒 |

英文省1,393,020 bytes（約26%），可見構圖提前約2.77秒；中文先有可讀品牌，四圖完成未加速。Skip→可操作菜單中文473→480ms、英文434→434ms，沒有入口全面加速的宣稱。[驗證摘要](validation.json)與公開精確SHA回條分開。

改前[中文等待](before-ui/zh-text-pending.png)與[改後文字回退](source/zh-text-pending.png)、[失敗仍可讀](source/zh-text-error.png)、[完成原logo](source/zh-Hant-title-ready.png)。完成logo後的區域位置一致；五語正常UI詳見[source](source/browser.json)與[compiled](compiled/browser.json)。

發布使用只提交本批、正常祖先整合及非強制push。精確SHA CI／Pages／live bytes驗證於最終回報；既有Pages容量警告不藉此刪素材、降畫質或遷移部署。Owner實機、完整主觀聽感與商業權利未在此批驗收。
