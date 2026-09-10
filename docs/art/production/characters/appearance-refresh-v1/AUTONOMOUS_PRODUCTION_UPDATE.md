# 選案授權與 M201 A 自主製作進度

Owner 已指定 **M201 A、M001 B、M226 B、E000 A**，並授權後續由助理選擇較不容易出錯的方案，自動接續製作。這四個明確選案保持不變，後續不再逐批等 Owner 挑 A/B。

## 決策與執行

[production-autonomy.json](production-autonomy.json) 記錄加權原則：動作構造／端點30、極端姿態身份穩定25、大色塊與少量特徵20、材質低噪點15、無新增活動裝飾10。先排除需要改動拓樸或動作的方案，再評分；不能用「A通常比較簡單」或物種刻板印象代替逐隻判斷。每個後續選案保留具體理由。

[首批 Owner 紀錄](batch-01/owner-selection.json) 包含原文、選案、板圖 SHA 及核准範圍。它批准外觀方向，不會讓未完成的動畫自動變成 QA PASS。看稿頁已顯示四個正式選案；頁面改選仍僅是修改提議，不能覆寫 Owner 紀錄。

## 本輪實際製作

1. 完成 [M201 A 設定](m201-a/SETTING_SPEC.md)：減少細碎毛斑、簡化銀腕環反光，保留已選的金色短吻貓型身份。
2. 看完來源65Main＋18Sub，整理12個高風險姿態及可見部位區域。這12母版對應23來源槽；仍有35個母版待繪。
3. 實際生成三次 Main000 候選，保留原稿和提示詞。v3大色塊較穩定，前伸手臂改善；但部位位置仍不符合來源，三檔皆RGB而非真正透明RGBA。詳見 [生成紀錄](m201-a/generation-receipt.json) 與 [v3評審](m201-a/candidate-v3-qa.md)。合格透明母版仍為0／47；不展開同一失敗方法的大量生成。
4. 已將 M201 可選共同原點轉換合併到既有 loader。新畫布464×368、anchor(184/464,292/368)、resolution1，可保持目前首格的位置與尺寸，並保留其他來源姿態的相對位移。原場景 scale、Sprite API、父節點翻轉及 ticker 都沿用。需要正式 geometry hash 與獨立geometry QA才會啟用；本輪没有啟用新包。

技術詳見 [replacement contract](../../../../contracts/championship/CHARACTER_APPEARANCE_REPLACEMENT.v1.md)；metadata-only fixture 在 `tests/fixtures/championship-m201-origin-geometry.v1.json`。來源像素不進新 production 包。

第二組已完成兩案文字評估與自主選擇：[設計決策](batch-02/DECISIONS.md)／[完整評分與設定](batch-02/design-decisions.json)。M222 A朱甲青額、M228 A翠葉面罩、M352 B赤冠金肩、M431 A霧背藍腹；各自選擇較少紋理、反射與透明變化的方案。這是文字設計風險評分，尚未生成第二組圖板，更不是动画QA。M201仍先完整交付。

## 驗證與完成邊界

- 28項新geometry測試，使用實際安裝Pixi類別，驗證全部83來源圖格的相對位置、首格baseline尺寸、兩種場景scale、四種父節點翻轉以及非法資料拒絕。
- canonical focused85／85、全量回歸1080／1080通過；輸出保存在 `reports/art/appearance-refresh-v1/autonomy-regression-tests.txt`。
- 看稿頁正式選案讀回正確，沒有warn/error；正常New Game仍進入Raising。
- 動作透明母版、全部動畫疊圖、正常新美術替換與實體裝置驗收尚未通過。公開發行沒有授權。

後續依自主授權處理可修正的製作問題與選案，保留逐隻QA；不把暫停重複失敗生成解讀成需要Owner再選一次。M201仍是第一個完整交付角色。
