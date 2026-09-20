# Championship 2026 籠子美術工作流交接給 Claude Code

建立日期：2026-09-21
交接目的：在 Codex Token 暫時不足時，讓 Claude Code 從目前狀態繼續籠子地圖的六角格配置、Blender 物件拆分、ComfyUI 輔助檢查與全圖稽核。

## 唯一產品工作目錄

```text
R:\Projects\Championship2026\championship-2026
```

所有 Championship 產品程式、Blender 產物、37 張籠子圖、零件格件、總覽、報告與交接用外部工具副本，都以這個 R 槽產品目錄為準。

目前確認：

- Git branch：`main`
- Git HEAD：`2d11821ff159dc6ca40e182be281c61968c17219`
- 目前工作樹原本已有其他使用者／代理人的未提交變更，請勿 reset、clean、checkout、覆蓋或整批 add。
- 產品程式根目錄不是 `R:\Projects\Championship2026`，而是上面的 nested repository。

## 本次交接資料位置

籠子主資料：

```text
R:\Projects\Championship2026\championship-2026\docs\art\production\original-character-cage-r1
```

目前主要產物：

```text
R:\Projects\Championship2026\championship-2026\docs\art\production\original-character-cage-r1\cage-base3d-v1
```

四張最新精修籠子：

```text
opm-industrial-refinement-v2   # field_cm15_01 工廠、field_cm23_01 毒氣室
opm-clinical-refinement-v1     # field_cm06_01 研究所、field_cm17_01 醫院
```

完整 37 張總覽：

```text
R:\Projects\Championship2026\championship-2026\docs\art\production\original-character-cage-r1\cage-base3d-v1\review\refinement-batch-d-v1\full-layout\all-37-full-layout-contact-sheet.jpg
```

最新超界與語意稽核：

```text
R:\Projects\Championship2026\championship-2026\docs\art\production\original-character-cage-r1\cage-base3d-v1\review\field-footprint-audit-v1\all-37-field-footprint-and-semantic-review.jpg
R:\Projects\Championship2026\championship-2026\docs\art\production\original-character-cage-r1\cage-base3d-v1\review\field-footprint-audit-v1\report.json
```

## 外部工具副本已集中到 R 槽

本次已將原本在 C 槽的工作流與生成結果複製到：

```text
R:\Projects\Championship2026\championship-2026\docs\art\production\original-character-cage-r1\external-tool-artifacts-v1
```

內容如下：

```text
comfyui\workflows\                         # 6 個 Championship ComfyUI workflow JSON
comfyui\input\                             # Championship 輸入圖副本
comfyui\output\championship_cage\         # 24 個 ComfyUI 生成輸出副本
higgsfield\previews\                       # 6 張 Higgsfield 預覽副本
MANIFEST.json                               # 檔案數、雜湊與來源說明
```

C 槽原始檔案沒有刪除，C 槽目前仍是 ComfyUI 的執行環境；R 槽副本才是本次交接的保存來源。不要把 C 槽路徑寫進產品 manifest。

## 目前驗證狀態

37 張籠子稽核：

```text
PASS   8
REVIEW 17
FAIL   12
```

本批已完成並通過離線格件重組的場地：

```text
field_cm06_01  研究所
field_cm15_01  工廠
field_cm17_01  醫院
field_cm23_01  毒氣室
```

四張合計通過 838 次合法格件放置檢查。四張的 `render-report.json` 都應保持：

```json
{
  "independentPartsExported": true,
  "runtimeEligible": false
}
```

`runtimeEligible: false` 是刻意保留的審查狀態，不可改成 true。角色前後遮擋、runtime 動畫時鐘、手機瀏覽器與 shipping 都尚未完成。

仍在 FAIL、下一批優先處理的場地：

```text
field_cm01_01  空地
field_cm11_01  森林
field_cm12_01  叢林
field_cm13_01  神殿
field_cm14_01  墓地
field_cm16_01  小保健室
field_cm19_01  溫泉
field_cm24_01  寺廟
field_cm25_01  動物園
field_cm26_01  牧場
field_cm27_01  擂台
field_cm31_01  保健室
```

建議優先順序：動物園／森林／牧場 → 溫泉／墓地 → 神殿／寺廟 → 小保健室／保健室 → 空地／叢林／擂台。

## 相同工作流

1. 讀取本文件、`championship-2026/AGENTS.md`、相關 `README.md` 與最新 `report.json`。
2. 以現有 native `shapeMask` 和六角 union 作為 footprint authority。
3. 在 Blender 中建立原創固定核心與可拆的 source-cell object bank。
4. 每個物件保留 `sourceObjectOrdinal`、`sourceAnchorNative`、`objectSequenceId`、`sourceCellId`。
5. 固定核心與每個物件都必須收進各自六角格的 conservative inset。
6. 產生完整 `frame-00.png`、`base.png`、`object-cells`、各 animation state、`master.blend`、`render-report.json`、`modular-manifest.json`。
7. 用 ComfyUI 只做候選材質、nearest-neighbor 放大、局部細節或 QA，不要讓生成圖取代六角格幾何權威。
8. 重建完整 37 張配置頁。
9. 執行 `audit-cage-field-footprint.py`，逐張檢查 footprint 與語意。
10. 執行精修批次檢查與測試；只有人工語意審查通過後才可以進下一道 runtime gate。

## 可使用的命令

在以下目錄執行：

```powershell
Set-Location 'R:\Projects\Championship2026\championship-2026'
```

工業批次：

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b --python scripts/build-cage-industrial-refinement.py -- --samples 12
```

醫療／研究批次：

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b --python scripts/build-cage-clinical-refinement.py -- --samples 12
```

完整配置頁：

```powershell
python scripts/build-cage-full-layout-review.py
```

37 張 footprint 稽核：

```powershell
python scripts/audit-cage-field-footprint.py
```

批次格件重組檢查：

```powershell
python scripts/check-cage-refinement-batch-b.py
```

目前已通過的 focused tests：

```powershell
python -m unittest tests.test_cage_field_footprint_audit tests.test_cage_industrial_batch tests.test_cage_care_batch tests.test_cage_full_layout_review tests.test_cage_stage2_nature
```

## Higgsfield 3D Jutsu 來源

Higgsfield 專案：

```text
https://higgsfield.ai/3d-jutsu/f7c92a20-d1ba-4d42-b009-6d897cd06f34
```

固定 revision：`1`
用途：工廠／毒氣室／研究所三個語意 2.5D 原型的視覺家族參考，不是 runtime renderer，也不是六角 footprint authority。

雲端 committed artifact 狀態：

```text
GLB  469,768 bytes  etag 069a4404e8716c0828940297cf00feb2
Blend 1,230,367 bytes etag ef140536c32903c1ab4428a066d6c90e
Preview 806,191 bytes artifact 44c5118ed0e7c56b75b11d65be609edb
```

目前 R 槽已保存 Higgsfield 預覽與 metadata；GLB／Blend 的唯一已確認來源仍是上面的 Higgsfield revision 1。若 Claude Code 需要本地 GLB／Blend，先從該專案下載到 R 槽的 `external-tool-artifacts-v1\higgsfield\exports\`，並把下載後的 SHA-256 寫回 `MANIFEST.json`，不要使用未驗證的外部路徑。

## 不可違反的界線

- 不要將研究用 ROM／原作素材複製進產品或當成原創。
- 不要把整張生成圖當成一個黏死的大圖；每個等候區、操場、籠子、設施與物件要保留自己的 source-cell 身分。
- 不要用 alpha 裁切掩蓋越界；必須修正 Blender 幾何或物件位置。
- 不要修改 collision、OPM、walkability、save、runtime actor depth 或動畫時鐘來配合美術圖。
- 不要因為 Higgsfield 有 GLB 就直接把 Three.js 接進全部籠子；Three.js 只可在明確核准的 bounded scene 使用。
- 不要 commit、push、部署、reset、clean 或刪除現有未提交內容。

## 交接完成條件

Claude Code 每批完成後應回報：

1. 改了哪些 R 槽檔案。
2. 哪些場地由 FAIL 變成 REVIEW 或 PASS。
3. 完整配置頁是否重建。
4. footprint audit 數字。
5. modular placement checks 數字。
6. ComfyUI workflow、輸入、輸出是否仍可追溯。
7. 是否仍保持 `runtimeEligible: false`。
