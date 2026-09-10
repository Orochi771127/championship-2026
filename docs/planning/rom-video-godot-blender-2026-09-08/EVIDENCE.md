# 來源、核對分級與可重跑紀錄

本文件將原作證據、既有研究、本次核對與工程建議分開。日期：2026-09-08。

## 本次直接執行

1. 重新讀取指定本機 ROM，確認大小、title、game code 及完整 SHA-256。
2. 由 FAT/FNT 取出 help／tutorial bank，以既有 `scripts/lib/ydij_text_bank.py` parser 解碼。68 筆 help 與原作研究 CSV、8 筆教學與既存記錄一致。只輸出索引、hash 與比較結果，沒有複製完整文字 bank。
3. 核對指定影片原始索引的 52 個 frame SHA-256 全部一致；本次查看 V02、V05、V10、V12、V16、V20、V39 與 `verified-202.png` 共 8 張。
4. 重跑既有 clock 靜態 ROM 查核：132／132。
5. 重跑 battle presentation 靜態 loader／資源表查核：2 named loaders、5 entries、4 instruction windows。

結果：[source-verification.json](source-verification.json)、[clock-rom-check.json](clock-rom-check.json)、[battle-presentation-check.json](battle-presentation-check.json)。hash 一致只證明是同一份素材；不代表該素材的每個解釋都正確。

## 影片與逐項對照

原始頁：[BV13u411B7BK](https://www.bilibili.com/video/BV13u411B7BK/)。本次瀏覽器確認標題、作者、13:17 長度及標題畫面，播放器顯示登入／30 秒試看提示。因此本次後段檢視使用先前保存在本機的原始影格；沒有新完整觀看／逐幀輸入 trace 的聲明。

正式觀察索引：[VIDEO_OBSERVATIONS.json](../../research/video-BV13u411B7BK/VIDEO_OBSERVATIONS.json)。完整舊分析：[ANALYSIS_ZH_TW.md](../../research/video-BV13u411B7BK/ANALYSIS_ZH_TW.md)。這些來源包括從 Spring Day 5 到 Summer Day 1 的取樣，並非全通關。

| 本次查看 | 導覽时间 | 直接觀察 | 搭配來源與限制 |
|---|---|---|---|
| V02 | [00:23](https://www.bilibili.com/video/BV13u411B7BK/?t=23) | 個體資料、多個環境、角色、工具列；HP／TP 9999 | 不能用作正常個體初始化 |
| V05 | [00:45](https://www.bilibili.com/video/BV13u411B7BK/?t=45) | Gate 球體、Dina Plains、費用和 Funds | 影片 0 Bits 費用不代表每個 Gate 都免費；所有選點座標未由此量測 |
| V10 | [01:03](https://www.bilibili.com/video/BV13u411B7BK/?t=63) | Pull、紅線、野生角色、未知情報、Hunt 倒數 | 條和色彩的精確 writer 不由圖形推斷 |
| V12 | [01:12](https://www.bilibili.com/video/BV13u411B7BK/?t=72) | New、命名／放生、066G／64G 紅字 | 與 YDIJ 入卡分支的關係待 trace；影片有異常值背景 |
| V16 | [02:00](https://www.bilibili.com/video/BV13u411B7BK/?t=120) | 六角編輯、多格形狀、Playground／HP Up／6 | 容量／形狀不是同一欄位 |
| V20 | [02:42](https://www.bilibili.com/video/BV13u411B7BK/?t=162) | 組隊、成員欄、策略名稱 | 策略完整說明由 ROM help #159 補上 |
| verified-202 | [03:22](https://www.bilibili.com/video/BV13u411B7BK/?t=202) | 數位圖樣、暗場、光環與放射束、上方 HUD | 本次未做招式 ID／模型／時間軸精確配對 |
| V39 | [08:36](https://www.bilibili.com/video/BV13u411B7BK/?t=516) | 進化訊息及場內外觀 | 不能由此得出任選進化按鈕或精確門檻 |

時間連結是 seek target；原保存 frame 的實際 media time 在 JSON。播放器顯示可能進位一秒。09-07 的 [BATTLE_VIDEO_CAPTURE_RECEIPT](../../research/video-BV13u411B7BK/BATTLE_VIDEO_CAPTURE_RECEIPT_2026-09-07.json) 排除了 stale captures；本文件使用 `verified-202.png`，不使用已排除的 t212／t486／t490／t494。

第 7／8 toolbar 子選單、商店、End Day 與 1VS1／3VS3 等其餘時間段，來自已存分析與索引，本次只重驗其檔案 hash，沒有另逐張查看。非對稱隊伍來自舊的第二支影片研究，並非指定影片的新觀察。

## ROM 文字：功能存在與規則描述

實際 bank：`ui/txt/help_text_txt.dat`。本次 parser 解出 168 筆有效項目；外部 CSV 的額外 EOF 記錄不是第 169 條玩法。以下使用 bank entry ID，並非 CSV 實體行號。

| entry ID | 支持的說明 |
|---|---|
| 89–95 | Rope、Shot、Wire、誘引／傷害陷阱、插件、記憶卡 |
| 96–105 | 8 日／季與 4 季／年、Hunt 強制返回、季節／天氣、Gate rank／費用／棲息、放生、HP0 手掌入卡、裝備有效性 |
| 113–121 | 世代、進化分類與族群方向 |
| 122–130 | 性格、活動期限、HP／TP、抗性、壓力、容量與進化、戰績、回蛋 |
| 131–143 | Cage 功能、編輯、建議收容、訓練類型、季節、食物／Protein、衛生、傷病、失去／回蛋、手掌 |
| 144–148 | Tamer、rank、牌照、Cage 空間、飼育 G 容量 |
| 153–167 | 訓練戰、日常戰、稱號賽、預選、本地／Wi-Fi／password、三類策略、必殺／TP／抗性、SP |

教學／用品 bank：`ui/txt/txt_list_txt.dat`，1568 entries；本次核對 #281、#282、#424、#1500、#1501、#1502、#1505、#1547。餵食／清掃說明需要與場景物件和角色反應配合，不替代數值 writer。

文字來源先由 Championship Evidence MCP 取得，路徑是歷史原作研究根 `R:/NEXUS LINK/原作/research-only/YDIJ_FULL_ROM_DECONSTRUCTION_2026-08-29/analysis/text/help_text_txt.csv`。該檔屬 Original YDIJ archive，與 Nexus Link 原創產品的程式／資產／存檔不同。最後又由本機 YDIJ ROM 獨立讀取所需文字做相等比較。

## 既有 ROM／契約研究：本次讀取，未全部重跑原生重播

| 來源 | 用途與狀態 |
|---|---|
| [捕獲確認 09-08](../../research/HUNT_CAPTURE_CONFIRMATION_2026-09-08.md) | touch-up 套繩、40／80／160 距離、HP0／AI10／AI11、入卡及永久資料分離；既有受控 CPU／觸控重播 |
| [全工具 09-08](../../research/HUNT_CORE_TWO_STAGE_IMPLEMENTATION_2026-09-08.md) | 46 裝備＋30 插件＋3 卡片、正常 Hunt 期限、完整家族清單、四散彈原始問題與核准修正；現有 Web QA 邊界保留 |
| [Cage 身分 09-05](../../research/CAGE_IDENTITY_BINDING_ROM_TRACE_2026-09-05.md) | field／name／description／Shop 多表 join，36 definitions，空地與跑道對應 |
| [Cage native geometry](../../contracts/championship/CHAMPIONSHIP_RANCH_NATIVE_GEOMETRY.v1.json) | shape mask／anchor／board／field origin，取代一格假設；bounded replay |
| [Cage tile composition](../../contracts/championship/CHAMPIONSHIP_RANCH_TILE_COMPOSITION.v1.json) | 582 原始 tile-copy cases；ordinary／filler／wall，保留完整物件與 renderer 未閉合處 |
| [時鐘 ROM trace](../../research/round2-clock-2026-09-05/CLOCK_ROM_TRACE.md) | 本次重跑靜態查核；VBlank nominal cadence 不等於完整原機 stall／interrupt 分布 |
| [戰鬥影片／ROM 09-07](../../research/video-BV13u411B7BK/BATTLE_PRESENTATION_ROM_COMPARISON_2026-09-07.md) | 特寫與資產分層；本次重跑其靜態 loader 查核。其舊 runtime 差距不當作今天現況 |
| [Battle R13 09-08](../../art/production/battle-presentation-r13/IMPLEMENTATION_2026-09-08.md) | 較新 runtime／native 進展來源；受控全腳本與全招正常原作視聽驗收分開 |
| [Gate contract](../../contracts/championship/VS2_GATE_SELECT_3D_RUNTIME_CONTRACT.v1.json) | `3D_worldMap_model` 與 16 biome identity 的既有研究；不因檔名存在而掛載 earth |
| [Toolbar contract](../../contracts/championship/CHAMPIONSHIP_TOOLBAR_CONTRACT.v1.json) | 8 slots 與 mode context；影片子選單屬觀察，不將未追 callback 編成 ROM 事實 |

09-03 分析裡的「捕捉公式全未知」「Cage 座標未知」「07:00 起日未知」不能直接抄成最新狀態；上列後續研究已補證其中部分。反過來，原生向量通過也不能宣稱整個系統完整。

## 工程建議來源

- [Godot Web export](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)：本次讀取的 stable 文件；Compatibility、WebAssembly／WebGL 2.0、GDScript 選型與單執行緒 baseline 的參考。
- [Godot 3D formats](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/available_formats.html)：GLB／glTF 推薦、`.blend` 經 Blender 轉換及其建置環境依賴。
- [Blender 4.1 glTF 手冊](https://docs.blender.org/manual/en/4.1/addons/import_export/scene_gltf2.html)：固定版的可交换類型說明；實際 Blender 版本未在本次安裝／執行，不宣稱其為最新。

節點樹、檔案結構、切片順序、命令模式、QA 清單、手機區域配置、art units 是製作建議。它們沒有被標成 ROM 結構或本次已實作。

## 重跑命令

從正式 repo 執行，依賴現有 Python 的 ndspy、capstone；输出只寫入本交付資料夾。此處命令不重跑完整模擬器。

```powershell
python docs/planning/rom-video-godot-blender-2026-09-08/verify_sources.py
python docs/research/round2-clock-2026-09-05/clock-rom-check.py --out docs/planning/rom-video-godot-blender-2026-09-08/clock-rom-check.json
python scripts/research/inspect-battle-presentation-links.py 'R:\8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1.nds' docs/planning/rom-video-godot-blender-2026-09-08/battle-presentation-check.json
git diff --check
```

本次只新增此資料夾的文件、驗證工具與有限 metadata receipts。沒有改 gameplay、圖像、save、Router 或既有 Owner Direction；沒有 push／merge／deploy。Godot build、Blender render、完整遊戲 regression 與實體裝置測試未執行，因為本次沒有製作或更動相應 runtime。

文件驗證：4 份 Markdown、19 個本機連結均通過，code fences 成對、無行末空白，4 份 JSON 可解析。全 repo `git diff --check` 返回成功；既有其他檔案的 CRLF 轉換提示不屬本次文件的錯誤。新檔尚未加入 Git index，因此另以文件驗證工具檢查新檔內容，不只依賴 tracked diff。
