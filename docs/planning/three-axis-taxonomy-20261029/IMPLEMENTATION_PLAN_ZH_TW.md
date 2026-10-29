# 三軸分類（陣營／種族／十屬性）實作計畫（2026-10-29）

依據：Owner 2026-10-29 定案指令（Gemini 整理稿）與 `企劃研究與改版規劃/三軸分類草稿_20261029/`。分類：`OWNER_APPROVED_ADAPTATION`。分支 `feat/three-axis-taxonomy-20261029`，不推送、不部署。

## 不變的東西

- ROM 物種紀錄（`creature-species.r1.json`）的屬性與種族位元組不改。原「自由」的 10 隻只在新分類資料裡分配陣營。所以「疫苗點／資料點／病毒點」與各種族點數的進化條件逐位元組不變，只在顯示層改名為心輝／黑鐵／裂隙點數。
- 原生對戰（ROM 對等）的傷害公式不改。十屬性相剋與陣營被動都做成對戰調整策略（與既有 `aiPolicy` 同一模式）：產品遊戲開啟，ROM 對等測試關閉，雙方適用同一規則。

## 架構

| 層 | 檔案 | 內容 |
|---|---|---|
| 資料 | `src/data/championship/species-taxonomy.v1.json` | 232 隻：陣營、種族、屬性 |
| 規則 | `src/championship/contracts/speciesTaxonomy.js` | 驗證、查詢、雙五角環倍率、抗性條對應、陣營共鳴判定、適居判定 |
| 文字 | `src/championship/text/taxonomyText.js` | 遊戲現有五語：zh-Hant／en／ja／th／vi |
| 美術 | `src/championship/presentation/taxonomyBadgeArt.js` | 10 屬性＋3 陣營＋8 種族的 SVG 徽章，不用任何 Emoji |
| 介面 | `src/championship/app/elementChartModal.js` | 「屬性相剋表」雙五角環視窗 |
| 原生對戰 | `battleRuntime.js` 新增 `taxonomyPolicy` | 相剋倍率與被動，透過既有 `globalPercent`／`critTier` 套用 |
| Data Arena | relay 規則 | 用雙五角環取代 10-28 的九元素輪；陣營被動 |
| 牧場 | 籠舍與養成 | 種族適居加成與資訊卡徽章 |

## 規格不明處的決定

1. **語系**：遊戲現有五語是繁中、英、日、泰、越，沒有簡中與韓文。這批照現有五語做；要新增簡中或韓文需要另開語系工程。
2. **相剋判定**：原生對戰中，屬性招式（ROM 元素不是物理）用「攻擊方拍檔屬性 對 防守方拍檔屬性」查雙五角環；物理招式不參與。Data Arena 依拍檔屬性判定，物理招式同樣不參與。
3. **必殺技**：原生對戰沒有「終極技」標記，以拍檔技力消耗最高的那一招作為必殺技；Data Arena 用既有的終極技。
4. **共鳴編隊**：原生對戰用出戰隊伍（最多 3 隻）。Data Arena 用接力兩隻加上隨行夥伴。三元協同需要三個陣營都在，所以 Data Arena 要靠隨行夥伴才可能成立。
5. **防禦／能力 +%**：原生能力是個體階梯值，被動不改存檔裡的能力，只在戰鬥中換算成傷害倍率：攻擊 +8% 等於造成傷害 ×1.08，防禦 +8% 等於承受傷害 ÷1.08。速度與智力的 +8% 在原生對戰中沒有可安全套用的單一欄位，會在報告中如實列出。
