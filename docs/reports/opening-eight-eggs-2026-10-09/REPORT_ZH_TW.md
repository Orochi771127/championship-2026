# 八蛋選擇與原作邀請順序：本機完成

依最新 Owner 指示撤回「正常孵化後才邀請」。現在 New Game 在所選蛋尚未孵化時邀請；拒絕保留蛋，接受以獨立 species0 示範蛋走 special hatch17；退出／完成恢復所選正常基底。八選一是 Owner-approved adaptation，不改原作證據或 native 孵化規則。

既有故事／信件／馴獸師命名後，新增8個既有原創蛋 portrait 供選擇，再接原有蛋命名。保留返回選擇、名字草稿、取消新遊戲不覆寫存檔、五語與觸控／鍵盤操作。修正測試找出的個體 ID 問題：選蛋只改種類，保留唯一 R2 starter resident ID，使正常育成與教學都能取得同一個體。

[實作契約](../../contracts/championship/OPENING_EIGHT_EGGS_2026-10-09.md) · [漫畫交付規格](../../art/production/OPENING_COMIC_INTAKE_2026-10-09_ZH_TW.md)。m201／m221／m232與八蛋參考由dot持有，不重做或重打包。漫畫尚未製作／接入。

## 有界驗證

- 受影響8檔 node測試：51／51，含8蛋基底、拒絕、Continue、教學接受、checkpoint續接、special17、受控完成清理、原本正常孵化/RNG/save回歸及舊hatched baseline相容性。
- 五語 zh-Hant／en／ja／th／vi 正常 New Game：每語8選項圖片載入、逐一選取、320與390寬佈局、返回保留草稿、命名後蛋時邀請、拒絕／Continue。每語零pageerror；按鈕至少44px、無橫向溢出。桌面Chrome、390×844 DPR2，不是實體手機驗收。
- zh-Hant 另走真實取消覆蓋存檔，bytes保留；再一次正常New Game選egg7 → 接受 → demo0 → 重載Continue → 3段ACK → 自然既有ticker孵化17 → 退出還原egg7；保存的正常基底完全一致。沒有透過寫checkpoint通過此瀏覽器分支。
- 完成教學清理的8蛋單元案例明示使用 `raising-after-battle` checkpoint，未重跑完整Hunt／Battle。沿用既有Slice6證據，不把其數量與本批加總。

證據／before副本／逐步PNG／scoped diff：`R:\Projects\Championship2026\opening-eight-eggs-20261009`。初輪抓到未同步resident ID的產品錯誤已修正；browser追加案例曾在取消後重點已隱藏LOGIN，修正harness重新載入後5語通過。主體圖片已由Codex本機查看；parent沒有Library可讀副本，不宣稱其已視覺驗收。

## 安全與剩餘

同一app／router／save key／schema／Pixi／ticker；styles.css、brandTerms與原先字典修復保留。無玩家存檔接觸、Git寫操作、部署、刪除或新伺服器。八蛋仍限本機入口；發布、母語者、實體手機及漫畫美術驗收未完成。遮擋結果另列[有界報告](../scene-occlusion-2026-10-09/REPORT_ZH_TW.md)。額度只讀查詢31%剩餘，未重置／購點／自動儲值。
