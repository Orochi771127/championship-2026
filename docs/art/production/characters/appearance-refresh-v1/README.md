# 224 隻角色外觀更新工作流

**現行方案已改為原生像素製作，全量 224 套都要更新外觀，合格後逐隻自動置換。** 查看 [像素計畫](pixel-v2/PLAN.md)、[全量名冊](pixel-v2/production-queue.json) 與 [M201 像素連動預覽](pixel-v2/review/index.html)。原本高清候選留存，停止以逐格獨立生成方式展開。以下舊交付與說明保留歷史脈絡，畫風／方法以像素計畫為準。

此工作包實作 Owner 於 2026-09-06 核准的「逐隻重新設計、所有原動作保留、每四隻雙方案看稿、整隻驗收後替換正常遊戲預設」計畫。決策保存在 [program.json](program.json)，畫風與職責在 [STYLE_GUIDE.md](STYLE_GUIDE.md)。舊 cat/dog 配額不適用本批；舊 M201 候選保留為可審查方案，未自動升級成核准美術。

前一輪實際交付與驗證見 [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md)。Owner 已選 **M201 A、M001 B、M226 B、E000 A**，紀錄見 [owner-selection.json](batch-01/owner-selection.json)。後續由美術總監依 [較低出錯風險政策](production-autonomy.json) 自行選案並接續製作，不再逐批等待 Owner 選擇。目前先製作 M201 A；224 套技術檔案已建立，全部動畫重繪仍在進行流程中。

## 現在可以使用的交付

- [最新自主製作進度](AUTONOMOUS_PRODUCTION_UPDATE.md)：首批選案、M201設定與修繪狀態、已實作geometry adapter，以及第二組自主選擇。

- [第一批四隻 A/B 設計審查](batch-01/review.html)：M201、M001、M226、E000。透過既有 repo server 開啟，以便讀取 JSON；每隻另有完整 PNG。
- `generated/catalog.json`：224 套的覆蓋、原七批對照與來源計數。
- `generated/packets.json`：56 個四隻工作包，先兩組形體代表，再接回原清單順序。
- `generated/entities/<entityId>/`：各自的原動作約定、畫稿重用映射、來源原點稽核。這些是技術生產資料，並不表示 224 隻已完成設計。
- `batch-01/designs.json`：四隻的兩案設計、原始 pose IDs、色票、風險與推薦。Owner 正式選案保存在獨立紀錄，不能被生成腳本重建覆蓋。

## 使用流程

1. 以角色工作包開始；讀對應 Main/Sub、native decoded sequence/OAM 和生成的 origin audit。
2. 角色設計提出兩案；技術美術同時關閉該隻的來源倍率、共同原點與 landmark 問題。
3. 每四隻整理兩案；首批採 Owner 明確選案，後續由美術總監依授權評分選案並記錄理由。設計板有紙色背景，是選案圖，不是可直接裁切上線的透明動畫。
4. 選定設定後做標準姿勢及最多十二個來源高風險姿勢；蛋直接審全套。
5. 全部唯一畫稿受控重繪；保持原有 blank/status/embedded-effect cells，依證據回填重复槽位。
6. 同步使用 native timeline 比較原／新序列；相同輸入的 sequence/cell/frame/flip/completion 必須一致。
7. 正式圖格輸出 RGBA + Pixi JSON，單頁 <= 2048；畫布／原點不因 packing 改變。整隻藝術與技術通過後才登記正式候選。
8. Owner 最終視覺驗收、正常場景 QA 後逐隻切換。載入失敗整隻退回基準包，不把同一動作混成兩種身份。

先完成 M201 的完整流程，再完成第一組其他角色。第二組 M222/M228/M352/M431 驗證多肢、植物、長嘴與水生構造。M003 已驗證的原始執行資料僅用作 native 播放器校驗，不因其存在宣告整個名冊已具備正常動作觸發。

## 命令與來源

從正式 repo 執行 `python scripts/build-character-appearance-workflow.py --help` 查看可重建清單與 `--check` 模式。來源根目錄为 `R:/Projects/Championship2026/YDIJ_PRIVATE_ROM_ART_PACK`；原像素不由本流程複製進正式資產。

```powershell
python scripts/build-character-appearance-workflow.py --archive-root R:/Projects/Championship2026/YDIJ_PRIVATE_ROM_ART_PACK --output docs/art/production/characters/appearance-refresh-v1/generated --check
python tests/test-character-appearance-workflow.py --archive-root R:/Projects/Championship2026/YDIJ_PRIVATE_ROM_ART_PACK -v
node --test tests/championship-character-appearance-replacement-cases.mjs
```

第一批 275 張修正原點的研究參照已輸出至 `R:/Projects/Championship2026/_archive/character-appearance-refresh-v1/pose-guides`。重建時加上 `--export-reference-guides` 與此絕對路徑；加上 `--check` 時只核對、不寫檔。來源 PNG 不進產品 repo。

完整來源查驗揭露舊高清管線有 2,939 格倍率變動和 13,219 格原點漂移。新參照使用每隻固定倍率與共同原點；M201 已實作可選的共同原點換算，保留目前首格的遊戲尺寸／位置與其餘姿態原始相對位移。新 geometry 必須額外以內容 hash 登記並通過獨立 QA；未登記仍只接受基準 logical canvas/anchor。美術與裝置顯示仍待驗收。詳見 [載入約定](../../../../contracts/championship/CHARACTER_APPEARANCE_REPLACEMENT.v1.md)。

來源查核順序：本次 Owner 計畫 → 当前 repo contracts / source → `02_CHARACTERS` catalog/runtime → `08_FULL_FAMILY_CONVERSION` decoded cells/animations → 必要時核對 `07_RAW_NITRO_ART_BY_ROM_DIRECTORY` 的 NCER/NANR。舊預覽的播放字串與 provisional 60 Hz 不具最新 native playback authority。

舊檔把 raw mode 1/2 標錯；本計畫使用原作 CPU 比較成立的 mode 1 向前一次停末幀、mode 2 回 loop start。完整 decoded loopStart、raw ticks、frame refs 保留。來源 cell 是否是「攻擊／睡眠」仍須獨立的 gameplay 呼叫證據。

## 進度與完成定義

設計選案、全部畫稿、動作相容、技術包、Owner 最終視覺驗收、正常預設替換、全部正常動作，各有獨立狀態。概念板、JSON 全覆蓋、預覽播放與 unit tests 都不能代替人眼與正常路徑驗收。

本次 active work 是 M201 A 設定、姿態與顯示校準。首批選案已關閉，後續低風險選案及製作由美術總監自主接續。224 隻全動作重繪與所有正常 gameplay 事件接入尚未完成；本流程不會讓美術名稱反向創造 gameplay。公開發行是另外的 gate。
