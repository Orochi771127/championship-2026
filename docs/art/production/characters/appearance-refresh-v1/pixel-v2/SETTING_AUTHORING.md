# 像素設定的製作與返修

`settings/<entityId>/setting.json` 是目前外觀設定的可編輯來源。每個姿態儲存來源 slot key、原生 signed bounds 與索引色 pixels；同一角色所有姿態共用 palette。features、faceRules、ornamentRules 固定身份；sourceRefs 與審查資料記錄參照證據。設定試稿不等於完整動作母版庫，尚未畫的 Main/Sub 槽位不可用來源像素補上。

最新方向必須附 `identityDesign`：`directionVersion: creature-identity-v1`、選定 family、至少三個不同的 fixedTraits、changedRegions、preservedMotion 與 allowedContourChanges（空陣列明示不允許新增輪廓）。視覺審查另需 `identityDirectionVersion` 與 `identityVerdict: PASS_IDENTITY_DIRECTION`；舊技術／視覺 PASS 不自動升級。審查人須實際檢查新身份的可辨識度，不能只確認色盤或座標。

全員同時開始單體設計。單姿態稿可以編譯與展示，但取樣仍標示 INCOMPLETE；之後補到有來源依據的代表姿態再審查。這不改動既有最低姿態數或完整角色置換條件。設計 brief 本身永遠記為 BRIEF_ONLY_NOT_DRAWN；已繪數由實際像素設定與 PNG 計算。

先觀看修正解碼後的原生來源，選擇有差異的真實姿態。手寫完整像素或明確的材質區域與局部圖樣。來源輪廓描摹須明示，不能把原圖 RGB 換色後的內部圖樣當作新設計定稿。普通色盤最多 15 個可見色，透明索引為 0，所有 alpha 為 0 / 255。

共用新畫部件時，記錄母版版本、適用姿態和遮擋條件。原作像素完全相同的槽位可以依證據重用；只有輪廓相同的角色，不足以證明整張原作圖格相同。不同蛋的新增碎片與裂紋位置需要具名變體。姿態內部不同時獨立編修，不旋轉或縮放一張站姿來假造來源動作。

初稿先保留在隔離工作包，作者觀看原生尺寸與整數倍預覽並返修，主整合者再獨立查看原／新比較。已通過的設定若修改，先保存舊版本及舊審查，再指定新設計版本，重新編譯到新快照目錄。不要覆寫內容不同的既有比較快照。

Owner 指出部分稿件色塊相黏、無法辨識後，單體看稿增加以下人工檢查。這些是視覺判斷，不能由色數、alpha 或編譯測試自動判為通過：

- 同時看原尺寸及固定整數倍率，使用淺、深背景；先辨認頭、身體與眼口，再檢查貓／犬／龍等身份特徵。
- 眼白、嘴部與胸腹不可無意中連成長亮帶。需要分開時，使用身體色或明確輪廓分隔；保留來源中實際的遮擋與接觸關係。
- 小體型优先保留兩眼與一個清楚嘴部，不強塞眉毛、鼻樑、鬍鬚與多層面罩。每個亮點應有可辨認用途，零碎陰影不得切斷主要形體。
- 裝甲、前後肢和胸腹相接處，檢查材質明暗與遮擋邊界。若原尺寸只能看到一團色塊，先返修再擴展動作。
- 單體返修必須附修前／修後及實際 PNG 的雜湊；單體可讀性改善不代表整套身份、全動作或遊戲驗收通過。

例：

```powershell
python scripts/review-character-pixel-settings.py --setting docs/art/production/characters/appearance-refresh-v1/pixel-v2/settings/m001_zurumon/setting.json --archive-root R:/Projects/Championship2026/YDIJ_PRIVATE_ROM_ART_PACK --output docs/art/production/characters/appearance-refresh-v1/pixel-v2/settings/m001_zurumon/review-r03
```

重新審查後，`visual-review.json` 綁定 setting、technical QA 與 source-comparison 的實際 SHA-256，明列觀察、待處理問題、reviewer 與 verdict。若審查使用新目錄，用 `current-review.json` 的 `directory` 指到 `review-r03` 等本地快照；舊目錄留存。技術通過不能自行產生美術通過，審查人必須實際看稿。

```powershell
python scripts/build-character-pixel-setting-gallery.py
python scripts/build-character-pixel-setting-gallery.py --check
python tests/test-character-pixel-setting-review.py
```

圖庫只由實際資料產生。進階檢查核對全部 224 個 ID、前八套代表角色、setting 版本、實際 indexed PNG 與 receipt，以及比較圖和審查雜湊。設定或圖片變更、缺檔、待返修均不能沿用舊 PASS。

第一階段通過後进入全員設定階段；必須 224 套設定都通過，才將整個程式的製作階段切到完整動作。完整角色包仍須經動作相容、技術包與正常場景檢查，才按 Owner 既有授權自動置換。這些設定工具不修改遊戲預設，也不替代實體裝置驗收。
