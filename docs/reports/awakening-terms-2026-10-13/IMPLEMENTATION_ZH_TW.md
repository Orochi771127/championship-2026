# 第五階段顯示術語 — 2026-10-13

Owner 明確授權 `OWNER_APPROVED_ADAPTATION`：玩家可見「完全體」改為「覺醒體」。本批只處理文字顯示。

| locale | 顯示候選 |
|---|---|
| zh-Hant | 覺醒體 |
| en | Awakened |
| ja | 覚醒体 |
| th | ร่างตื่นพลัง（未經母語者審定） |
| vi | Thức tỉnh（未經母語者審定） |

## 範圍與自審

- `text/growthStageTerms.js` 集中五語名稱、雷達名稱及泰越 native-speaker review=false。育成／夥伴名單／既有相關UI共用的generationName、Hunt分析欄位及雷達displayName沿用這個來源。
- 五語產品翻譯的商店繩索／雷達描述、Help成長文字與兩場第五階段頭銜賽描述，改為引用同一名稱。英文必要的 a/an 隨術語調整；普通完整／完全形容詞不替换。
- `uiText` 僅接受完整的舊／新中文 display alias；沒有全域子字串替換，也不處理placeholder值。四語舊翻譯鍵保留相容，新舊鍵皆顯示新用語。
- 保留内部PERFECT、generation數值／順序、species ID、存檔key／格式、所有進化／能力值／雷達mask與遊戲規則。原始ROM轉錄資料與研究文件沒有改動。
- 保留 `Perfect Fighter` 賽名、究極體／Ultimate、必殺技ultimate tier、普通perfect/完全形容詞、玩家暱稱與既有perfect資產路徑。
- 目前圖鑑詳情只显示名稱、登錄、暱稱與來源，沒有generation行；本批沒有新增欄位或改圖鑑編號。圖鑑／成長相關既有display文案的修改與目前圖鑑畫面取樣分開記錄。
- 既有泰越Help資料把這個標籤放在heading run第26項；中英日為topic第32項。本批保留原有record／heading對應，未順便重編或修復其他Help語意對應。

## 驗證

- 聚焦46項全通過：五語術語、商店／雷達／分析／Help／頭銜賽覆蓋、placeholder與暱稱保護、原始日文轉錄保留、unknown回退與其他stage不變，含相關Shop／Database存檔回歸。
- `test:ci`：1760／1760，0 fail、0 skip。source preload 272；正式build／validate通過，9374 files。
- 五語正常DOM導航取樣全通過：育成名單的第五階段、商店雷達說明、既有圖鑑species-index=137詳情與Help，共20張取樣。此報告附6張代表圖，其餘在隔離QA輸出。
- 原full-QA存檔只有蛋與究極體；取樣器在副本中用既有native constructor、identity allocator、enclosure及canonical save writer加入一隻generation=5個體，先通過canonical驗證再經LOGIN→Continue。原fixture與個人玩家存檔未改動；这是seeded QA，不是自然捕捉／進化驗收。
- 使用本機正式公開產物映射核准公開origin、390×844的桌面Chromium手機模擬，正常UI操作，單一canvas；不是實機，也不是母語語意審定。採樣器可單獨重跑，無私有資料依賴。
- 沒有重做美術／產品規則／原作研究／圖鑑編號。父任務持有的CURRENT_PRODUCT_STATUS／TECH_DEBT文件未改動。

正式buildId：`bdc7780ad7ab03e80513124d35f6d903fafd0377cd4715dd223e5eb13f1b782a`。提交、exact SHA的CI／Pages與有界live核對由任務回報；不另下載整段影片。
