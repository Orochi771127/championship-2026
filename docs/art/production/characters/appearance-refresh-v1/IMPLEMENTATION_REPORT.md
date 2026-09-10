# 224 套角色外觀更新：本輪實作與第一批選案

日期：2026-09-06。正式產品 repo `R:/Projects/Championship2026/championship-2026`，`main / d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。本輪延續既有 dirty tree，以 root 唯一整合者接收三個隔離候選；沒有 commit、push、merge、deploy 或替換任何現行角色預設。

**製作資料與載入接點已實作，第一批四隻八個外觀方案可選。224 隻全部動作美術尚未完成。** Owner 在已核准流程中要求每四隻先看雙方案，所以本輪交付到可選案階段；M201 全套重繪依正式選案展開。

## 可直接使用的內容

- [第一批設計審查頁](batch-01/review.html)：M201、M001、M226、E000 的 A/B 完整圖、色票、身份特徵、來源姿態與風險。選擇只整理回覆文字，並不写入任何核准或遊戲存檔。
- [共同畫風](STYLE_GUIDE.md)、[製作政策](program.json)、[四隻設計資料](batch-01/designs.json)、[插畫評審](batch-01/concept-qa.md)、[生成與雜湊紀錄](batch-01/generation-receipt.json)。M201 初稿及定向修改都留存。
- [224 套來源清單](generated/catalog.json)、[56 個四隻工作包](generated/packets.json)，以及逐隻 `motion-contract.json`、`source-reuse.json`、`origin-audit.json`、`source-evidence.json`。七組各 32 套來源身份全部保留。
- `scripts/build-character-appearance-workflow.py`：可重建、可唯讀核對、拒絕覆寫漂移檔案；決策與核准不放進生成目錄。
- 既有角色 roster 的可選整隻替換介面與 Main/Sub 預檢。實際規則在 [replacement contract](../../../../contracts/championship/CHARACTER_APPEARANCE_REPLACEMENT.v1.md)。目前未登記或啟用新包。

## 覆蓋與新發現

| 來源核對 | 結果 |
|---|---:|
| 角色套數 | 224：216 一般角色＋8 蛋 |
| Main/Sub 槽位 | 17,235 |
| 序列 | 11,480 |
| 非空白去重母版 | 10,184 |
| 空白槽位 | 53 |
| raw mode 1 / 2 | 6,712 / 4,768 |
| loop start | 全部 0 |
| 來源檔案雜湊 | 21,825 |
| 原始位元解码與現有 02 圖集不符 | 0 |

`08_FULL_FAMILY_CONVERSION` 的通用圖像解碼未處理角色逐格 VRAM transfer，16,824 格不能用作精準姿態像素。新工具讀原始 NCER transfer、NCBR 線性／NCGR tiled 圖像及 OAM，重建結果全部與 archive 02 的實際圖像對應。來源 08 的 cells/animations metadata 另外與 raw bytes 核對。

archive 02 圖像雖正確，舊管線先把不同姿態各自縮放及置中，造成 2,939 格倍率不同、13,219 格相對同側第一非空白格原點漂移。這是本輪確認的動作保真問題，不能由畫師扭曲造型補償。

新工具鎖每隻一個倍率、共同來源原點，採 Main/Sub 全姿態聯集畫布。第一批 **275 張研究參照 PNG＋索引** 已實際輸出到 `R:/Projects/Championship2026/_archive/character-appearance-refresh-v1/pose-guides`，均標記 `RESEARCH_REFERENCE_GUIDE_NOT_REDRAW_CANDIDATE`，未進產品 repo 或 production index。

| 角色 | 槽位 | 倍率 | 參照畫布 | 共同原點 |
|---|---:|---:|---|---|
| M201 | 83 | 12 | 464×368 | 184,268 |
| M001 | 83 | 12 | 368×284 | 184,232 |
| M226 | 83 | 8 | 256×272 | 120,192 |
| E000 | 26 | 12 | 416×416 | 208,352 |

這些是經查驗的來源幾何參照；手、腳、嘴等人體／作用端點仍須逐隻人工鎖定。**現有 runtime guard 仍要求 baseline 畫布與 anchor，相容新聯集畫布的 world transform/display scale adapter 尚未實作或驗收。** 下一個 M201 vertical slice 必須先完成此轉換；不能因動作陣列相同而宣稱新畫布可以直接切換。

## 第一批設計評審

四張皆可供外貌選擇，`ownerSelection:PENDING`、`motionCompatibility:NOT_VALIDATED`。沒有把方案推薦當成 Owner 選案。

- M201：A 金色短吻貓型；B 蜜金圓耳幼獸。大型圖具有高清線條，但底部示意仍像素化，不能作正式高清 seed。
- M001：A 琥珀凝膠；B 緞面金色軟膠。A 突出膠珠須改內嵌；液滴數量及位置需逐 source cell，概念稿不能沿用到所有姿態。
- M226：A 灰鋼釉眉；B 礦片齒輪。減少細碎刮痕／裂紋，B 突出的眉板須壓平，再鎖構件中心與齒圈。
- E000：A 瓷釉四灰斑；B 月光石礦面。A 依實際生成稿將草案三斑調成四斑，未宣稱已核准；裂殼仍須依 cell 重新定位。

設計板有紙色背景、文字及示意陰影，不是透明母版。手機大小示意也不是實際 runtime 畫稿縮圖。選案後先做核准設定與高風險姿態，再展開所有唯一母版及同步播放器。

## 驗證與邊界

- 新增 replacement tests 40 項；相關 canonical focused suites **71/71 PASS**。覆蓋假核准、錯 hash、實際序列改動、缺 Main/Sub、非法依賴、壞 atlas/trim、整隻 fallback、cache／釋放及 native presenter 保留。
- JavaScript 全量串行回歸 **1,040/1,040 PASS**，輸出在 `reports/art/appearance-refresh-v1/regression-tests.txt`。
- Python motion tests **16/16 PASS**：ticks/cell/mode/loop/frame-order 漂移、signed OAM、裁切、來源像素、覆寫保護、determinism、check 唯讀與路徑限制。
- 動作 lane 全量重建 `--check`：955 JSON 位元一致。Root 整合後全量重算／reference export 再次通過相同 receipt：`f75ad0be93b5ef0d12ea7a2c62897b180fb2e51aac935de52dd901fa3dd214ac`。外部 guide index：`d2e53625cf41eaf8030a7020cfe59591a55855d2b6665f98627f1ad93eb27b77`。
- In-app browser：正常 New Game → Raising → System/Hunt → 戴納草原 → Tether I → Hunt → Home 路徑。現有角色可見；檢查時無 warn/error。Raising 單一 canvas，五組要求尺寸皆執行 viewport override，實際 CSS 393 寬被此瀏覽器回報為 394，沒有冒稱精確 393 裝置通過。截图與實測 JSON 在 `reports/art/appearance-refresh-v1/`。
- 設計頁載入四張 1536×1024 圖，手機 390 寬無水平溢出；暫選回覆與重新載入歸零另作互動檢查。
- `git diff --check` 通過。未做實體觸控装置驗收、完整新動畫逐格疊圖、正常新美術替換或全部 gameplay 動作觸發驗收。

下一個安全步驟是 Owner 對第一批每隻選 A/B 或提出修改，接著先完成 M201 設定、座標／顯示校準、高風險姿態與全部 Main/Sub。其餘 220 隻的技術工作包已就緒，並未完成各自雙方案。第二批依核准順序 M222/M228/M352/M431。
