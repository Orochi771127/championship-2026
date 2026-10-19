# 140／171／172 已核准原圖接圖增量

承接 main 84a53724。140 v3 是 2026-10-17 08:47:50 UTC 送出的俐落戰鬥天使原稿，完整 SHA256 81b361ae2c8a3cccae307554cba55334146544fbc8a30a92a20e70dfa4e8f3ed；使用者批次接受後，角度追修指向136，沒有撤銷140。171／172由使用者看過兩張指定原圖後明確確認「對那個是定稿的版本」，只接這兩個Library ID所代表的bytes。確切Library ID、file ID、SHA256、尺寸及訊息ID見 `docs/art/production/characters/approved-dex-140171172-20261020/manifest.json`。舊awaiting紀錄不能覆蓋後續核准。

原PNG和原尺寸完整保存。只做等比例display最大768／WebP Q90、thumbnail最大96／無損RGBA；alpha精確等於原圖縮小後的alpha，不裁切或重畫。三張深淺底CSS272對照及實際390px手機viewport畫面已目視，羽翼、杖、手腳和爪沿用原圖，沒有新增裁切。不是實體手機驗收。

191張主圖；最初64缺口累計補36、剩28（成熟11、進階14、究極3）。完整現行範圍 `remaining28.json`。082仍須遵守後續改風格指示；187錨鏈、188羽槍與200圖鑑範圍仍分開追查，設計核稿不撤銷。

## 無損容量處理

三張衍生檔合計520,314 bytes，既有網站餘量不足。本次僅把公開 `pages-build.json` 診斷收據升為schema3的目錄前綴表 `fileTable`，避免約7,800筆完整路徑重複列目錄。各筆完整path、SHA256、bytes可完整還原；commit/buildId/fileCount等頂層欄位保留。`scripts/lib/build-manifest-codec.mjs` 的 `decodeBuildManifest` 同時讀舊schema2和新schema3；驗證器先還原全表，再核對每個真正檔案的SHA256、bytes、closure與公開界線。表格篡改、非法索引、路徑穿越、錯誤雜湊和尺寸會拒絕。

所有runtime檔案、CSS、既有圖片／動畫／聲音原樣。舊版7,734個assets檔案逐筆SHA256與bytes完全相同。建置共7,875檔，含908,937-byte收據，實際999,647,925 bytes，距1,000,000,000上限餘352,075 bytes。沒有降低圖片品質或放寬上限。

CI首次2712項中2711項通過；唯一失敗是歷史測試仍要求140缺圖，依恢復核准更新此預期後，該模組2項全過。收據codec／建置相關13項重跑全過。正常新遊戲進圖鑑，36張×桌面與手機＝72組主圖／縮圖檢查通過，72個唯一圖檔回應hash相符、無頁面／網路錯誤，registeredSpecies前後皆空。最終獨立產物驗證及公開部署結果分開記錄，未完成前不宣稱已發布。

本增量在隔離checkout完成，未改R槽原工作樹、不啟動全專案測試伺服器、不生圖、不修改玩法或動畫。
