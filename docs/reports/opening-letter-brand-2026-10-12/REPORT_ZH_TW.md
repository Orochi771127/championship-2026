# 新遊戲贈禮信件品牌用詞修正

基準 `a28a33c6d788a2ba8f4ecb8b9f62ab9bb627c3bd`；隔離工作樹 `egg-native-sizing-20261012`。Owner 要求修正新遊戲信件殘留「數碼獸／數碼蛋」（Sentinel_cfc02d51dad48191b422823d4462a773），並明確指示「改完自己審查沒有問題就送上去commit跟push並發佈」（Sentinel_34621683f3508191bb44e93ffef6ca07），由 dot 轉達本輪有界發布。

## 根因與修正

截圖目標是 TITLE 的兩封開場贈禮信件。`openingPresentation.js` 直接交給一般 `uiText()`；繁中沒有覆寫，因此顯示舊來源字串。其他四語的字典雖有譯文，卻沒有統一讀取集中品牌詞。

沿用 `getOpeningBrandTerms()`／`openingStoryText()`：加入既有 EGG_TERM，將兩封信及蛋命名提示接到五語精確來源鍵轉換。繁中實際顯示「從現在起，你也是拍檔馴獸師了。」「這顆培育蛋送給你。」「請替培育蛋取名字」。既有詞彙候選的全域審批狀態不變。

未變更玩家自取名稱、ID、research、Raising 郵箱效果、canonical save key／格式、原作規則、介面佈局及觸控／無障礙流程。開場信件在 `onStart` 建立存檔前顯示，不是已收信佇列；舊存檔無須遷移，Continue 不重播。來源字串仍作為內部精確翻譯鍵，並非再次顯示舊品牌。

## 驗證

- 聚焦開場品牌／狀態／八蛋／晨間郵件測試：22/22 PASS。
- 完整 `npm run test:ci`：1693/1693 PASS。
- 五語實際 LOGIN → New Game → 信封 → 信件 → 命名：全部 PASS。每語讀取 DOM 的實際文字；繁中兩封信截圖已人工檢視。
- 繁中完整建立隔離測試存檔，玩家名稱故意使用「數碼獸」「數碼蛋」，名稱原樣保存；重載 Continue 進入育成且沒有開場信件。
- 其他四語使用前一測試生成的舊存檔，在閱讀信件及取消開場前後核對原始 save bytes 完全相同。沒有安裝 full QA save，也沒有碰玩家 profile。
- 正式 build／validate 與公開模式 bundle smoke 的最後結果、exact-SHA CI／Pages／public hashes 記錄於 `R:\Projects\Championship2026\opening-letter-brand-20261012`；提交前已通過的結果另列於下方發布檢查。

瀏覽器使用隔離 Chromium context 與檔案路由，不啟動 TCP 伺服器。五語原始碼測試對缺失的本地 art 使用主工作樹唯讀 fallback，逐筆列於 BROWSER_LETTERS.json；正式公開 bundle 檢查僅使用正式 build 產物。這不是實體 iPhone 驗收。

### 提交前發布檢查

正式 `build:playtest`／`validate:playtest` 均 PASS：9315 檔，buildId `45579fb366f9b6acc2b681ef524bdd75fd58e9dce80e5bb1cd987e076c7105bc`。正式 bundle 以公開 origin 啟動、正常點 LOGIN／New Game／信封／兩封贈禮信件，確認實際 DOM 為拍檔／培育蛋，page error／缺檔均為 0。產品碼未為測試注入捷徑。提交後遠端與公開站證據另記本機 RELEASE_RECEIPT.json，不把本機成功冒充公開成功。

## 安全與後續

只修改三個 product 檔、一個聚焦測試、三項既有 public approval hash 及必要紀錄。Owner 主工作樹既有 untracked 素材、8732、Claude battle-dynamic-fx 與其 VS5 衝突均未改動。沒有重置額度、購買點數或自動儲值。

Owner 後續通報教學 actor 像舊圖／帶骨肉，以及到對戰時返回 TITLE，屬獨立問題；本次郵件驗證不宣稱完成整條教學或修好那些問題。截圖由 dot 實看，帶骨肉狀 actor 有綠色血條與 ??? 面板，後續需追 texture／atlas 綁定與場景跳轉原因，不能只更換肉圖結案。
