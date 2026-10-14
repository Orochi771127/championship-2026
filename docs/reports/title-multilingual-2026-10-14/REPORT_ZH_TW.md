# 四語 TITLE Logo 最終本機驗收 — 2026-10-14

基準／origin main `50c03fedaf12c2a40df46eed5129b5b589c77747`，沿用乾淨隔離worktree；Owner main `94207e6ee4927bb5357646a4319d90e4d7e3ceea`不動。dot完成四圖、三產品檔patch及36項focused；本批負責完整環境驗收、自審與已授權的正常push／Pages發布，不重畫或重做架構。

Owner下載`C:/Users/User/Downloads/integration-handoff.tar.gz`（Sentinel_935b4aa7b9a08191907f5cd53f41e517），6575393 bytes／SHA `ecebbe66ce66f7381dd1ba74fe3049edd69c53b53fb1c562d637b7a20b65ff0d`完全吻合私人Library整包。原下載檔未動；安全解壓前拒絕絕對路徑、traversal、links、special files與重複路徑。這是Owner本機交付，**不是官方helper materialize，也未宣稱xattrs**；先前官方helper因Windows沒有`os.setxattr`而停止，沒有改helper或繞道取URL。[來源對照](owner-download-receipt.json)與[精確四圖選取](selected-assets.json)保留Library ID、Owner來源及hash。

## 結果

`git apply --check`通過後只套patch與複製en/ja/vi r1、th r2四張PNG到`assets/production/title-multilingual-r1/`，像素檔byte原樣，繁中原WebP不改。實際WEB_BUILD_INPUTS僅新增四圖＋manifest五個exact-path/hash，更新HTML／opening.css／titleImageLifecycle三個hash；[candidate delta](candidate-build-input-delta.json)保留交接原hash，最終CSS兩項必要修正的hash以真build-input與[validation](validation.json)為準。所有無關核准、其他設定及moduleEntries未改。

同一titleImageLifecycle選當前locale，五語2:1 contain；原正式h1保持唯一可讀標題與pending／404／decode fallback。切語取消pending及listener，request identity＋epoch阻擋舊回呼；完成cache、retry、背景／離開取消、影片warmup／skip／attract／reduced-motion沿用。

真瀏覽器找到兩項限定CSS問題並修復：390px的外語PNG非透明邊緣被既有cover畫布裁到；1366×480、130%外語fallback字頂部被裁。外語Logo區域現在以現有portrait panel置中且限制寬度，fallback以panel字級計算；不改繁中原構圖、四圖byte、正式名字、角色／按鈕錨點或影片clone的原外語文字。沒有600→420、桌機育成、手機直橫全場景、Battle/Hunt、角色美術或atlas變更。

## 驗證與實際界限

- Focused／品牌46/46（包含交接36項及原品牌10項）；唯一一次必要portable aggregate1788/1788。實際build／validate9406 files，ID `582bb56de4df6476c814c890ef526a0cef480d1cc4c6caab39df85540df80f98`；preload233項未改。[validation](validation.json)亦記錄完整checkout中未修改的app／save／film／locale／brand等pinned source hashes。
- [來源Browser](source-browser.json)與[compiled Browser](compiled-browser.json)各90配置／五語初始與正常settings操作：320×568、390×844、1366×480，100／130%文字，pending／ready／404、retry、快切／舊inactive事件。QA量實際DOM文字rect與圖像alpha>16的非透明邊界，不把被裁掉的透明外框當字被裁；像素fit、唯一h1、角色／入口分離、無水平溢出均過。網路完全攔截至checkout／artifact；fresh Chromium未連Owner8732、未安裝存檔至個人profile，errors／missing皆0。
- 全TITLE圖像／切語／故障操作前後save原始bytes相同。正常Continue→Home→Save & Quit→TITLE保留titles、book、badges、rank、訊息內容及個體IDs／species；原Continue會檢查`entryChecked`，明確Save & Quit可持久化原`freeBattleMenu`／revision normalization，不能把整份舊QA種子不變當契約。回TITLE後再切語的save bytes不變；app／save作者程式未改。
- [影片回歸11/11](film-contracts.json)與[TITLE buffer回歸8/8](media-buffer.json)記錄真原檔播放、skip、防穿透、手動／待機重播、dialog／background、reduced-motion、warmup／cache／URL生命週期及五語film clone。初次兩個ready wait timeout來自舊QA把新增四個inactive img也算進必須完成；只修正QA為active images，保留原四請求及cache/buffer斷言並補inactive未請求檢查，產品程式未因此改動。

dot只完成全尺寸圖像自審，Thai為非母語者審查；此處是受控Chromium／iPhone browser emulation，**沒有實體手機、Safari、母語Thai或完整主觀聽感驗收**。素材權利文件／commercial release仍未接受。角色美術繼續dot整批私人Library流程，不下載接入本批。精確提交CI／Pages及live manifest／四圖hash結果交付於最後發布回執；容量警告不作為刪圖、降畫質或臨時部署遷移的理由。

| compiled 320px／130% | 證據 |
|---|---|
| English | [ready](images/en-ready-320-130.png) |
| 日本語 | [ready](images/ja-ready-320-130.png) |
| ภาษาไทย r2 | [ready](images/th-ready-320-130.png) |
| Tiếng Việt | [ready](images/vi-ready-320-130.png) |
| English 404文字fallback | [可讀fallback及retry](images/zh-Hant-error-320-130.png) |
