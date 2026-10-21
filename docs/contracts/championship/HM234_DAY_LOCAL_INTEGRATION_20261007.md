# HM02 / HM03 / HM04 白天本機候選：2026-10-07

範圍：Owner 已下載五份普通 ZIP，parent 授權接入三個 DAY field。沿用現有 App、router、canonical save、Pixi Application/ticker、原生 Hunt；本批為 LOOPBACK_ONLY / PRIVATE_REVIEW，未升預設或公開發佈。實作前契約為本機 `LOCAL_BINDING_CONTRACT.json`。

## 落盤與版本

五份 Downloads 原檔保留，各自檢驗 bytes / SHA-256 / CRC 後解壓至單一空目錄；不是串接式分割檔。合計 99,381,446 bytes、243 檔，241 個 index 成員逐檔核對另加 README/index；24 PNG 解碼檢查。正式來源根目錄：`R:\Projects\Championship2026\intake-hm234-1007\source\HUNT-HM02-HM03-HM04-STATIC-ART-INTAKE`。

保留 HM02-SAVANNA-FINAL / HM03-FOREST-R2 / HM04-R12 / provenance。HM02 final 與 material4 是兩份 SHA 不同的 master，不合併；HM03 保留 1249 棵歷史樹、96 灌木，移除 40 棵洞口樹，未採用全域重排。HM03 atlas 順序為 `occluders.png` 的 2751 pieces，再 `occluders-backcap.png` 的 2 solid；不建立 occluders-1.png。來源的 review-only 標記不變，本機另建有限候選 adapter。未重渲或改寫 Blender；camera / master transform 採本版交付的 QA，不冒稱本機重做 Blender 結構驗證。三份 hunt-scene / object-inventory 與目前原始輸入 byte-identical。

| Field | Pieces | Solid | Backcap | 原始 frame SHA-256 |
|---|---:|---:|---:|---|
| field_hm02_01 | 967 | 165 | 3 | 02ae5b83e67a24d017b323c5acd8cab505fb6c8b783eec67e9de948053c58a87 |
| field_hm03_01 | 2753 | 121 | 2 | 768f1d6374c7cab90e4355e0d66a752803279f378c47261dc62d1bc595c86fff |
| field_hm04_01 | 3570 | 109 | 2 | a0c41ffd545c49f507763a7d8030661204614d27a37e95d5607eb5a8a359808f |

初次長路徑解壓因 Windows 路徑長度失敗，部分檔案保留在 `../handoff-review-20261007/hm02-hm03-hm04-intake-20261007/`，不作接入來源。上列短路徑重試完整成功。

## 接入及回退

現有 `src/championship/app/main.js` 的 loader 增加 loopback query：

`?presentation=player&huntReview=hm234-20261007&huntFoliage=dither-r1`

新目錄 `assets/production/hunt/hm234-day-review-20261007/` 共 13 檔 / 40,685,476 bytes；三圖 clean/atlas/pieces 原始 bytes 不變。三個 field manifest 優先，其餘 field 回到原本選定的 h1 / r10 / r11 / industrial，再沿用既有 licensed fallback；h1 預設、r10/r11 入口及資料均保留。新增候選目錄已納入 public-art-boundary 排除。

三圖現有 DAY/NIGHT 都是 1 frame / durationMs=null，不虛構三格動畫。HM10/11 的三格 217.29647047014586 / 200.58135735705773 / 200.58135735705773 ms 完整保留。原生 source 選 DAY/NIGHT：本次隔離 fixture 分別 Savanna 07→DAY、13→NIGHT；Forest 13→DAY、07→NIGHT；Jungle 14→DAY、13→NIGHT。這是現有原生 source 分支，不是新增時鐘判定。夜間實際載回 h1 field_hm02_02 / 03_02 / 04_02，未製作假夜版。

玩法 world size、collision、camera、spawn、escape、門檻與費用不改。QA 的 rank3 / badge46 / 10000 Bits / 指定 hour 透過現有 canonical API 建立獨立瀏覽器 fixture，沒有改正式存檔，也不是新手解鎖進度驗收。取消 huntReview 立即回到既有圖；取消 huntFoliage 回到原本 .42 fade。程式回退只反轉 `SCOPED_IMPLEMENTATION.patch` 的本批 hunks，須重新核對目前 SHA；禁止整檔 checkout 或覆寫既有 dirty 修改。來源、before 副本與舊候選完整保留。

## 分項驗證

- 資料與 affected tests：30/30（本批4、depth9、runtime map5、native normal-entry12），未重跑不相關全套。51 個保護輸入與13個新 runtime 檔案最终重核 SHA 通過。
- 真實 Pixi 受控呈現：47 位置 × opaque / .42 fade / dither / hidden foliage = 188 截圖；同 frame、origin、trim、腳點、鏡頭、Main cell0，使用目前 m201 species-034 delivered-r04、m454 species-181 dot-intake-r01、m317 species-085 mature-raw-r02。原生 density4 + world geometry 換算，未額外乘4或另行降圖。包含樹前/交疊/後方、三體型、X/Y flip、lift18、多角色；GPU 真實 alpha 外變更0px，實際 foliage 遮擋交集外0px，solid alpha=1。七個洞口前可見、背蓋後四模式角色像素皆0。這些是 presentation fixture，未主張正常 spawn/nav 可到每個點；案例中的 open 標籤是固定比較點，HM03/HM04 實際仍可能有植被交疊。
- 實看紀錄：三張 full clean、47 列四模式原像素裁圖（分10張）、另3張完整 flipY/lift 裁圖、3張正常流程 contact、3張同frame自然AI A/B 原像素 detail、3張原生 escape 到達畫面。固定 contact 的 flipY 下緣裁切另以完整 detail 補足。各模式圖沒有重畫或補繪。
- 正常 UI：隔離資格 fixture → Continue → 系統 → Hunt → 真實3D門 → 繩索 → 場地 → 地面拖曳 → 返回牧場 → 同門重進。自然AI持續移動；same-frame A/B 差異 HM02 20px、HM03 11339px、HM04 1094px，source view 不變。HM02自然取樣的植被交疊較小，強遮擋證據另見受控對照，不擴大自然覆蓋宣稱。
- 資源：正常離場新增 dither mesh created/released HM02 48/48、HM03 892/892、HM04 311/311，cache/active/overflow皆0；重進同一 Pixi App，正常分支無 page/console error/warning。數量是歷次累計，不是記憶體或效能 benchmark。
- 原生 escape：三圖均由實際 pointer 圈繩後釋放，未改野生角色或AI，只讀紀錄 native dispatch。HM02 species048 等待6100ms後到原生座標[1016,504]（右側場邊）；HM03 species060 等待3600ms到[216,136]（第一洞後方），sprite/shadow/selection/all layer 差異皆0px且實看被背蓋遮住；HM04 species108 等待7600ms到[0,784]（左側場邊）。HM02/HM04 **不算洞口逃脫路線驗收**，全部七洞的 native path/連續穿越仍未完。pan 後角色繼續正常移動，位置以 native dispatch 為準；HM02 到達點未完整留在可見 viewport。
- 回退：正常 UI 實驗 hm234+r11→grass r11、hm234+r10→grass r10、候選 manifest 強制404→savanna h1、不帶候選query→savanna h1，4/4。404的預期網路 console 訊息獨立記錄；沒有把此錯誤算進正常 clean run。未宣稱完整檔案損毀故障矩陣。

## 證據、未完與接續

完整證據：`R:\Projects\Championship2026\intake-hm234-1007`。`FINAL_QA_AUDIT.json`、`CONTROLLED_GPU_ALPHA_AUDIT.json`、`FALLBACK_BROWSER_AUDIT.json`、來源 audits、scoped diff、runtime receipts、可重現 harness 均保留。`audit-local-captures.py` 在完整本機原始截圖上執行；精簡私人包不攜帶全部 raw captures 或大型 Blender/atlas。

本批不是 Owner 最終美術選版、全角色 Main/Sub/ticks 語意、真手機、效能、商用權利或公開發布 PASS。三圖夜間仍為舊 h1；沒有授權替換預設。後續優先 parent 視覺複核本批，再按具體選版指令處理；不得因本次資料/瀏覽器通過擅改預設。既有 backlog（bank110整批R2、m454正常睡眠、蛋完整 animator/request、未驗角色語意與 m401/m503、分支條件/229/230、35籠圖示等）保留在 Codex owned 接續清單，未讓本批覆蓋歷史分項驗收。

没有 commit / push / deploy / 正式save / 生圖 / 付費API操作；未改其他worktree、地圖製作源、Claude狀態或歷史Master。
