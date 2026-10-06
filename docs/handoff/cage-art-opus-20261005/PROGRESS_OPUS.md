# 籠子美術 opus 輪次進度收據（Claude Code）

更新：2026-10-06（Asia/Taipei）。本檔是 Claude Code 自己的進度收據；共用 master sync／matrix／ledger 仍由 Codex 合併，本檔不改任何共用狀態檔。

所有輸出皆為 review-only：`humanApproved`、`runtimeEligible`、`shippingReady` 全為 false；`clockHz` 全為 null；未 commit、未 push、未發布；未改 runtime、碰撞、可走範圍、存檔或時序。

## 工作流（沿用 Blender → 分層 2.5D → 六角配置）

- 生產器：`scripts/build-cage-opus-family.py`（兩段式：measure → fit-table → render；每個來源物件一個固定放置，取最差動畫格；不使用 `hide_render`、不裁 alpha、不動錨點）。第一批用凍結的 `scripts/build-cage-opus-r1.py`；有核心動畫的場地（r10、r11）用 `scripts/build-cage-opus-surface.py`（核心逐幀輸出，manifest 記 `coreFrames` 的原作時長證據）。
- 收容：`scripts/lib/cage_opus_containment.py`（v1，r1～r3 與 r14）、`scripts/lib/cage_opus_containment_v2.py`（v2，可變視窗逐幀尺寸／pivot，r4 起）。兩者的雜湊已寫入對應 manifest，之後不得修改。
- 檢查：`scripts/check-cage-opus-family.py`（支援只有核心層的籠子；`--producer` 指定生產器）、`scripts/build-cage-opus-review.py`（完整 37 張配置頁＋frame-00／composite／state-envelope 三道閘＋worst-of-all）。
- 可走範圍：r5 起直接讀產品的 `src/data/championship/catalogs/raising-ground.r1.json`（遊戲資料，非研究檔）決定地面分區；高的景物只放在不可走格。
- 各輪的家族模組在寫完該輪後即凍結（雜湊寫進 manifest）；要改就開新模組＋新輪次，例如 r14 的 `cage_opus_sacred_polish_authoring` 疊在凍結的 r3 模組上。

## 已完成批次（A = `docs/art/production/original-character-cage-r1/cage-base3d-v1`）

| 批 | 場地 | 輸出 | 結果（worst-of-all，solid px，前→後） | 放置檢查 |
|---|---|---|---|---|
| r1 | 研究所 cm06、工廠 cm15、醫院 cm17 | `A/opm-opus-r1` | FAIL→REVIEW 290／269／175 | 630 |
| r2 | 小保健室 cm16、保健室 cm31 | `A/opm-opus-r2` | PASS 87／REVIEW 175 | 96 |
| r3 | 神殿 cm13、墓地 cm14、寺廟 cm24 | `A/opm-opus-r3` | REVIEW 182／REVIEW 296／PASS 87 | 472 |
| r4 | 溫泉 cm19、發電廠 cm22（可變視窗） | `A/opm-opus-r4` | FAIL 12,561→REVIEW 351；FAIL 1,805→REVIEW 182；32 個物件全部未縮放未移動 | 486 |
| r5 | 空地 cm01、叢林 cm12、擂台 cm27 | `A/opm-opus-r5` | FAIL 2,893→PASS 87；FAIL 2,020→REVIEW 296；FAIL 1,908→REVIEW 175 | 96 |
| r6 | 小高山 cm37、洞窟 cm40（只有核心層） | `A/opm-opus-r6` | PASS 87／PASS 87；美術重做（台地＋雲海；洞內岩壁＋木架＋晶簇，無洞口） | 104 |
| r7 | 高山 cm10 | `A/opm-opus-r7` | REVIEW 291→272；依 Owner 指示：橋兩端接在陸地上、雲只在橋下的峽谷 | 18 |
| r8 | 運動場 cm02、道場 cm04 | `A/opm-opus-r8` | REVIEW 231→182；REVIEW 686→264 | 58 |
| r9 | 花園 cm18、小花園 cm32 | `A/opm-opus-r9` | REVIEW 553→88；PASS 86→87 | 472 |
| r10 | 海灘 cm09、小海灘 cm39（海面兩幀動畫） | `A/opm-opus-r10` | REVIEW 435→272；PASS 86→87 | 70 |
| r11 | 火山 cm07、冰原 cm21、小火山 cm35（熔岩／冰水兩幀動畫） | `A/opm-opus-r11` | REVIEW 265→269；172→178；PASS 86→87（美術重做，幾何維持托盤殘差） | 92 |
| r12 | 森林 cm11、動物園 cm25、牧場 cm26 | `A/opm-opus-r12` | REVIEW 201→178；193→175；201→178（承接 Batch E，小道具重新設計而非縮小） | 230 |
| r13 | 健身房 cm05、沙漠 cm20、小健身房 cm34 | `A/opm-opus-r13` | REVIEW 172→178；290→296；PASS 86→87（美術重做） | 92 |
| r14 | 神殿 cm13 精修 | `A/opm-opus-r14` | REVIEW 182→182；階梯（平台口＋石塊踏面＋四道斜踢面）、移除共面黑色菱形、白色收翼守護像站上欄杆；物件最小縮放 0.8685→1.0 | 176 |
| r15 | 競技場 cm03、小運動場 cm30 | `A/opm-opus-r15` | REVIEW 265→272（五個六角的托盤殘差）；PASS 86→87；藍色跑道＋條紋草皮＋田賽設施＋看台＋燈塔／運動場的小型版本 | 70 |
| r16 | 毒氣室 cm23 | `A/opm-opus-r16` | REVIEW 191→182；封閉處理筒、處理槽、地面管線、警示燈、八個姿勢的黃綠毒氣 | 208 |
| r17 | 草原 cm08 | `A/opm-opus-r17` | REVIEW 442→269；野生草地、高草、灌木、岩脊與野花，兩叢擺動的黃花 | 110 |

累計（`A/review/refinement-opus-r17/footprint/worst-of-all.json`，基線鏈 r4→r5→r6→r7→r8→r10→r11→r13→r12→r9→r14→r15→r16→r17；說明與重作指令見該資料夾的 `README.md`）：**PASS 11／REVIEW 26／FAIL 0**，沒有任何場地有物件本身的越界（objects-only overflow 皆 0）。REVIEW 的多六角場地大多只剩托盤邊緣殘差（每個六角約 86px）。

每批的完整配置頁、before/after、overlay 與報告在 `A/review/refinement-opus-rN/`；每輪的檢查報告在 `A/opm-opus-rN/review/report.json`；每張場地的美術方向在 `A/visual-briefs/<field>/VISUAL_BRIEF.md`（研究觀察與原創提案分開）。每個場地資料夾都有 `master.blend`、`base.png`、`object-cells/`、`placed-object-cells/`、`modular-manifest.json`、`render-report.json`。

## 工具與成本

- Blender 5.2（Cycles）全部本機；ComfyUI 只做過 HTTP smoke（收據在 `A/review/refinement-opus-r1/comfyui-receipts/smoke/`），未用其輸出；Higgsfield 未呼叫。付費生成 0 次、費用 $0。
- 研究圖只在本機看功能意圖；沒有載入、描圖、取樣或上傳；擂台不使用原作標誌。

## 覆蓋狀態

交接要求的 36 個使用中場地，除了等候室 cm28（規格明定原配置沒有物件、不自行加長椅或植栽，維持藍白方格）以外，全部都有 opus 輪次的新版本；cm29 結構蓋板維持不動。舊版本全部保留在原資料夾。

回歸測試：`tests/test_cage_opus_family_rounds.py`（r2–r17 的旗標、生產器與相依模組雜湊、固定放置、最小縮放、核心動畫時長證據、最終配置），連同既有的 `tests/test_cage_opus_r1_batch.py`、`tests/test_cage_opus_containment.py` 共 30 項通過。

## 已記錄、未修（留給 Owner 決定）

1. 競技場 cm03：唯一不可走的後排在配置頁的頂端裁切範圍內，看台在實際配置頁大多被裁掉，只剩廣告板；原生全圖中完整。
2. 寺廟 cm24：坐像頭光在 14 格籠子放上排時會被頂端 24px 裁切（只發生在上排）。
3. 保健室的床可再精修。
4. 所有 REVIEW 場地剩下的是托盤邊緣殘差；要變成 PASS 需要改托盤或配置規則，不在本輪範圍。

## 接入遊戲（2026-10-06，Owner 指示）

- 牧場與籠子編輯器改讀 `assets/production/cage/original-opus-v1`（由 `scripts/build-cage-opus-runtime-bundle.py` 從 refinement-opus-r17 產生；WebP 畫格、與舊版同尺寸、四個動態地面沿用原作時長）。`licensed-runtime-v1` 保留但不再載入。
- 碰撞、可走範圍、牧場配置、容量與籠子訓練效果不在美術包內，仍由 Cage runtime 依籠子定義執行；既有對照原作 CPU 的測試全部通過。
- 驗證：`test:ci` 1,416 項通過（新增 `tests/championship-cage-original-opus-runtime-cases.mjs`）、`build:playtest`／`validate:playtest` 通過、瀏覽器 `cage-layout` 與 `ui-integration` gate 通過。
