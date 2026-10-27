# HM10／HM11／HM13／HM14 真 3D 狩獵地圖接入（2026-10-26～28）

## 範圍與結論

- 四張地圖都走正式的 `HUNT_AUTHORED_MAP.v1` 管線，在遊戲共用的 Pixi／Three 畫面內以真 3D 繪製，沒有用 2D 平面代替。
- 原有的 2D 授權地圖仍保留作備援。
- 遊戲座標不變：四張維持原生 128×128 格（2048 world px），沒有加入任何擴張資料。
- 候選幾何是 2880 的擴張版。超出核心區的部分由遊戲既有的地圖裁切（Pixi `visibleMapRect` → Three scissor）遮住；完全落在核心外的節點、primitive 則直接移除。
- 美術接入在 PR #97 已合入 main；本分支補上：回歸測試、雜湊鏈，以及 12 張舊圖的質感層。

## 來源對照（逐張開檔核對構圖與地標）

| 地圖 | 遊戲 Gate／場地 | 主題 | 採用的候選包 | 舊母檔（參考） | 缺件 |
|---|---|---|---|---|---|
| hm10 | Factory → `field_hm10_01`（日夜共用） | 工廠：油槽、管線、階梯、圍場 | `hunt-runtime-handoff-20261023/HM10/v7/.../draco-v7/terrain-props.draco.glb` | `handoff-review-20261007/hm10-final-production-r3/source/hm10-r3-accepted.blend`；`docs/.../hunt-h1/terrains/hm10/master.blend` | 私人 authoring 母檔未交接；排水動畫的 3 個 phase GLB 未接 |
| hm11 | Sewer → `field_hm11_01`（日夜共用） | 下水道：渠道、出水口、橋 | `HM11/v7/.../draco-v7/terrain-props.draco.glb` | `hunt-h1/terrains/hm11/master.blend` | 同上 |
| hm13 | Ice → `field_hm13_01`（日）、`field_hm13_02`（夜） | 冰原：冰崖、開放水面 | `HM13/v6/.../draco-v6/terrain-props.draco.glb` | `hunt-h1/terrains/hm13/master.blend` | 冰崖貼著格線呈階梯狀（原 art hold 項目），未修 |
| hm14 | Crag → `field_hm14_01`（日）、`field_hm14_02`（夜） | 岩山：懸崖、洞窟、岩柱 | `HM14/v9/.../frozen-hm14-v9/terrain-props.draco.glb` | `hunt-h1/terrains/hm14/master.blend` | 擴張區與核心交界的落差（原 art hold）：已不在可見範圍內 |

可編輯母檔放在 R 槽 `cage-diorama-20261025/hunt4/masters/hm1x-c1-20261026.blend`。這些是從 runtime 候選 GLB 匯入後另存的**衍生母檔**，不是原本的 authoring 母檔。場景屬性記錄了來源 SHA 與重建鏈：`hunt4_stage.py` → `hunt4_fix_hm14.py` → `hunt4_install.py`。

## 修改紀錄（幾何有改的地方逐項列出）

- **hm10、hm11、hm13：**
  - 只移除整個落在 2048 核心＋32 px 以外的節點或 primitive：hm10 −16 個、hm11 −40 個、hm13 −26 個。
  - 保留下來的 Draco 區塊逐位元組相同（有斷言檢查）。
  - 檔案大小：4.57→3.88 MB、6.90→5.38 MB、2.19→1.86 MB。
- **hm14：**
  - 刪除三角形：只刪三個角都在核心外的三角形，並移除只屬於擴張區的 relief 與燈具 primitive。
  - 所有 primitive 用 Draco 重新編碼，量化位元數 16/10/12/8。**這是幾何變更，不是位元組鎖定。**
  - 乾地頂點色朝中位色拉近 45%，壓下原本的斑塊雜色。
  - 新增 `ground-heights.json`：180×180 格，只對 ground／relief 做垂直射線取高度。
  - 檔案大小：15.13→5.78 MB。
- **hm13 的暗色格狀水面：** 由 main 的 `hd2dLook.mjs` 材質調整處理。這張圖四個貼圖槽共用同一張圖，所以依規則不寫入局部 AO。

## 遊戲實測（正式入口：選 Gate → 裝備 → 進入；`presentation=developer` 只用來讀取野生怪位置）

- **環境：** Chromium 151 headless，ANGLE D3D11，NVIDIA RTX 4070 Ti，127.0.0.1:8761。
- **解析度：** 手機直向 390×844（桌面模擬）＋桌面 1280×800。

| 地圖／變體 | 3D | 載入 | 幀時間 p50/p95 | 野生怪 | 捕捉 | 離開→結果→牧場 | 重複進出 | console error／404／退回 2D |
|---|---|---|---|---|---|---|---|---|
| hm10 日 | active | 1.4–2.5 s | 16.7/16.7 ms | 14 | ✔ native-wild:4 | ✔ | 2 次，canvas 1 個、heap 不增加 | 0/0/0 |
| hm11 日 | active | 1.5–1.9 s | 16.7/16.7 ms | 14 | ✔ native-wild:4 | ✔ | 同上 | 0/0/0 |
| hm13 日 | active | 1.4–1.6 s | 16.7/16.8 ms | 14 | ✔ native-wild:1 | ✔ | 同上 | 0/0/0 |
| hm13 夜 | active | 1.9 s | 16.7/16.7 ms | 14 | ✔ native-wild:8 | ✔ | 同上 | 0/0/0 |
| hm14 日 | active | 1.4–2.4 s | 16.7/16.8 ms | 13 | ✔ native-wild:0 | ✔ | 同上 | 0/0/0 |
| hm14 夜 | active | 1.4 s | 16.7/16.8 ms | 13 | ✔ native-wild:0 | ✔ | 同上 | 0/0/0 |

- **晝夜切換：** 依原作規則，由存檔的遊戲內時鐘決定。夜間用的種子只改了 `clockMinutes`，再用產品自己的 `digestCanonicalRaisingHomeDataR2` 重算 digest；同一套程式在 07:00 算出的 digest 與原 QA 存檔完全一致。
- **另外 12 張：** 其餘 12 個 Gate 同樣走正式入口，全部 3D active，0 錯誤。

## 角色可辨識度

綠色（Petimon）、橘色（Koromon）、暗色（Botamon）都疊到實機截圖上測過，詳見 R 槽 `boards/hunt4-play-c2/contrast-sheet.jpg`。

- **偏弱的一組：** 只有「hm14 日間＋橘色」的數據偏低（明度差 7、色相差 26°）。肉眼看外框仍分得出來，但這是最弱的組合。
- **未專門測：** 暗色角色在洞穴內的情況。

## 效能（相同條件下與現有地圖比較）

| 地圖 | GLB | draw calls | 繪製三角形 |
|---|---|---|---|
| hm10 | 3.88 MB | 46 | 379k |
| hm11 | 5.38 MB | 124 | 451k |
| hm13 | 1.86 MB | 106 | 289k |
| hm14 | 5.78 MB（另有高度表 0.43 MB） | 16 | 590k |
| 既有 hm18 | 9.36 MB | 249 | 654k |
| 既有 hm15 | 6.26 MB | 37 | 595k |

**沒有手機實機驗證。** 上面的手機數據來自桌面瀏覽器以 GPU 模擬直向畫面，不能當作手機效能的證據。

## 已知限制與後續

- hm10／hm11 的排水動畫（3 個 phase GLB）沒有接上，水面是靜態的。
- hm13 冰崖貼著格線呈階梯狀，需要幾何重做。
- 四張的私人 authoring 母檔沒有交接過；R 槽保存的是衍生母檔。
- **仍非 3D 的狩獵地圖：**
  - hm00 教學場（沿用 hm01 版面，仍為 2D）。
  - hm07、hm12 不在 Gate 對照表中，不適用。
- 測試：`friends-playtest-groups-cases` 的「source-corners `slots:[4,8,7]`」在乾淨的 origin/main 上就已失敗，不是本批造成的。本批另外修好了 BASE 過期造成的 2 項失敗。
