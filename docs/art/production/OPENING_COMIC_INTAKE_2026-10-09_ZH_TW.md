# 開場漫畫：dot 最小交付規格

Owner 已指定 dot 製作原創漫畫，Codex 保留原文、順序及既有 DOM 五語／品牌替換。dot 已有 m201 OC035、m221 OC049、m232 OC060、八蛋 OC225..232完整參考，本機不另尋或重打包；角色參考不授予新孵化 mapping。

## 原文與順序

1. 每四年舉辦一次的\n數碼獸冠軍賽。
2. 取得參賽資格，\n正是身為真正數碼獸馴獸師的證明。
3. 而今天，你也迎來了\n參加數碼獸冠軍賽的機會。\n\n奪下勝利吧！\n數碼獸冠軍賽！
4. 好像已經收到郵件了。

第四段接現有信件／命名／贈禮流程。`\n` 表示 DOM 原有換行，不印在圖內。原文 authority：`src/championship/app/openingStoryPresentation.js`；目前 `uiText` 及 brandTerms 決定使用者實際語言與品牌文字，不新增世界觀或改寫故事。

## 圖框與最小素材

Chrome 390×844 實測：story 390×844、每卡390×422，初始下半部進場再向上捲動。五張無字圖：

| 插槽 | 現況 | 圖框 px | 約寬高比 |
|---|---|---:|---:|
| card0 arena0 | 第一卡第1幅競賽 | 176×173 | 1.02:1 |
| card0 arena1 | 第一卡第2幅競賽 | 129×148 | 0.87:1 |
| card0 arena2 | 第一卡第3幅競賽 | 226×165 | 1.37:1 |
| card1 world | 第二卡世界／參賽資格意象 | 218×305 | 0.71:1 |
| card2 champion | 第三卡冠軍意象 | 218×222 | 0.98:1 |

第二、三卡圖框會隨翻譯文字高度變化；不要把測量值當永久固定比例。建議每幅1024×1024、中央80%為必要主體；後續整圖 contain，維持既有三小幅／兩大幅與閱讀順序。亦可交可適應上述框的構圖母檔，必須保留完整角色輪廓。

不要烘焙文案、對話泡泡、按鈕、HUD 或 Logo。最小包為5張PNG/WebP及一份 manifest：slot、檔名、尺寸、SHA256、參考OC ID、版本。保留可編輯母檔即可，不必搬整套角色。接入目的地待收件後於 `assets/production/` 精確選版；本文件沒有提前接入新圖、刪除舊圖或授予發布權。Codex 不生成圖。

量測回條：`R:\Projects\Championship2026\opening-eight-eggs-20261009\COMIC_LAYOUT.json`。此批只交規格，漫畫製作與圖像視覺驗收未完成。

## 後續已接版本：R2（20261010 包）

R1 因 01_arena 站姿修正而禁止接入。Owner 已確認 R2 下載並授權接圖：Library `libfile_2eff4aeb18c081919a4f4a84fe1f4102`，ZIP 11,891,842 bytes／SHA256 `da5f15fe529d98f88b307d70b8215b8275ee91f0a65109184f71a84cf78f17f6`。本機已核包、五張PNG並完成有界接入，細節見 [R2實際成品與驗證](../../reports/opening-comic-r2-2026-10-10/REPORT_ZH_TW.md)。上面的舊占位圖框尺寸是收件前量測；R2第一卡採不重疊三格，其餘維持兩大圖及第四段文字。

目前四段可見文字由 `openingStoryText.js` / `brandTerms.getOpeningBrandTerms()` 取得五語待定名詞；上方原文僅保留來源，不代表現行顯示舊品牌。原 PNG 在 repo 外保留，runtime 五張 WebP 共 556,096 bytes；角色是敘事示意，不代表玩家 avatar 或新孵化規則。未發布，未宣稱實體手機或完整產品驗收。
