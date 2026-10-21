# 原創共用 VFX 157：本機接入契約（2026-10-07）

依本輪 Owner／parent 委派，接入已保存 `original-shared-review-157-text-r1`，不追逐 Claude 正在製作的 167/173 或後續版本。原生玩法與 `battleEffectProfiles.json` 完全不變。只透過 loopback `?vfxOriginal=shared-v1` 啟用；未授權發布或最終美術驗收。

## 來源與資料約束

- 來源 `R:/Projects/Championship2026/VFX_共用特效_原創交付_20261006/package/original-shared-review-157-text-r1`。
- manifest SHA `f8de5234a99f660250f1dfa20430dabdcdf970db3febfa8970d63d3272c20a26`；主 atlas SHA `a9d69a11dd936ca1cdec200196a17b2fa8556c64355bf997908ed52d35fc94e0`。
- 32 組、157 格，新增 bank4/132/39 共15格；原142筆完整record與RGBA逐byte保留。Bank110已撤回，不包含在本批。
- 4 raster px/native px；每格自身frame/origin，既有effect pool、投影、ticks/mode、傷害與釋放權威不變。單一既有Pixi application/ticker。
- 主圖1024×2048（解碼RGBA下限8MiB），文字各256×1024（各1MiB）。這些數字不是實測GPU VRAM。

## 遊戲設定與文字

沿用既有preferences key、store、environment與locale observer：中文→zh-Hant，日文→ja，其餘→en；不讀瀏覽器語言。設定新增日本語選項並明示「目前僅戰鬥文字支援日文；其餘介面使用繁體中文」。DOM仍用繁中lang；不假稱全遊戲已翻日文。既有schemaVersion1可保存/讀回ja，不改遊戲存檔。

只載當前文字atlas。切換先準備下一張、換getCell，再經兩個animation frames釋放舊atlas；dispose解除observer並清理active/pending/retiring。12個文字sequence為1:10..20、46，仍各31ticks，完整原生框限不變。

用詞核對：原作圖內cell54實際為「めいちゅうUP」、cell142為「クリティカルUP」，故本稿「命中UP／ACC UP」和「暴擊UP／CRIT UP」保留。`battleContactTargeting.js` 說明的3197筆文字檢索不包括圖片內字樣；這項圖片發現不證明命中率擲骰存在，也不新增accuracy stat、buff或規則。術語仍為這批呈現文案，沒有重新命名全遊戲品牌/欄位。

## 獨立光束接縫候選（歷史；後續已接受）

額外 query `vfxCandidate=beam-body-seamfix-r1` 讀 `assets/production/vfx/original-shared-beam-seamfix-r1/manifest.json`。原157圖仍保留；候選只改12:0的2像素與138:0的34像素，均32×64、origin[0,32]，所有geometry/ticks及其餘155格像素保持。三語共用原157文字圖。本日後續已由parent確認視覺接受，先升為157-seamfix，再承接至210-seamfix；不包含其他finish/flame/fang選擇。當前版本與回退見[210收尾契約](ORIGINAL_SHARED_VFX_210_LOCAL_CLOSEOUT_20261007.md)。本節以下157證據保留其原版本適用範圍。

## 證據分層

證據根 `R:/Projects/Championship2026/handoff-review-20261007/vfx157`。

- `INTEGRATION_RECEIPT.json`：3個交付ZIP SHA/CRC、157+36文字格RGBA與來源雜湊核對、逐檔回退副本。
- `focused-tests.log`：49/49，本輪VFX、JA持久化、候選範圍、locale及settings焦點檢查。沒有重跑/冒認Claude的1407全套為本HEAD全樹驗收。
- `browser/result.json`：獨立Chrome 390×844 DPR2，瀏覽器de-DE；正常設定JA/reopen/練習戰鬥、EN及ZH正常進場；受控同場切換快取與dispose另列。錯誤/警告0，不是真手機，也不是三語文字自然觸發全驗收。
- `beam-browser/result.json`：正常英文徽章61位置及詳情、正常Practice進場載入独立beam候選；兩格texture.source確為候選atlas。未觀察自然光束觸發，不能把載入證據當整個光束動畫驗收。
- Claude同157 `controlled-sequence-report.json` 24項、三語各24項，用其manifest/atlas SHA限定適用；已實看92/148完整12格既有畫面。它們與12組自然AI場次仍未觸發92/148是兩件事。
- seq45保留137..141的1/1/3/3/1。原OVL19 SHA `d660e3e0bf243541c356c54dcbd1aec58e8df6c2dfaf4a5854d375a5f2d13715` 的0x0211CC7C..CD28共44指令重新反組核對；同frame在0x0211CCE0後進行animation/physics advance，吻合runtime `battleEffectActors.js`。受控可見runs為138/139/140/141，不延長137以湊截圖。
- 最新157 performance receipts SHA相符，但只適用該桌面Chromium/ANGLE/DPR3/4x CPU throttle案例；managed textures穩定9/10並非0。三語cache清空與整個renderer資源歸零不能混稱。
- 較早142文字HP截图只作同SHA文字圖視覺參考，其中ZH紀錄有404；不將它提升為157正常全流程PASS。

私有原創包 `libfile_ad4a19dc8b6c81918b66d78b789a6ebc`；分離候選包 `libfile_9cad6609e51c8191bfc55ec8eef318aa`。原作截圖與混合遊戲畫面未放入original-only包；字型檔未散布。

回退只能按receipt與owned hunk處理；不要把完整before檔覆蓋後續Claude/Antigravity修改。正式save、commit/push/deploy未操作。
