# m002：Higgsfield 首次實際製作

狀態：`PASS_REGION_IMPORT_STRUCTURE` + `PASS_53_SEQUENCE_PREVIEW`。這次完成的是六個被綁姿勢的局部返修與完整候選銀行重組，不是整隻角色的遊戲／美術驗收。

2026-09-20，使用者在方案、點數及單張估價已回報後，明確要求用 Higgsfield 協助角色動作圖。本次限定提交一張六格返修，不進行第二隻或自動追加生成。

- 模型：Higgsfield 目錄 `gpt_image_2_5`，Flare、2K、high、transparent、3:2、count=1。
- Job：`d398f90f-2df3-4913-87ba-deebb131e0ca`，已完成；原始輸出 `result.png`，2048×1360 RGBA。
- 唯一上傳：`input-six.png`，由現有原創候選的六格排列而成；沒有上傳 donor 像素。檔案 hash 在 `plan.json`。
- 完整請求與回應：`request.json`、`submission.json`。提交前含參考圖估價3點。查詢前後都回報3010點，工具沒有提供實扣明細，因此實際扣點尚未確認，不能宣稱免費。
- 本次只有一次成功生成，沒有因輪詢或下載重送工作。

## 採用方式

模型改善了繩帶，但同時產生光暈及約1px局部輪廓偏差。因此沒有把整張輸出直接替換原稿。以固定3×2格位取樣，在明列的六個區域內只取繩帶色彩；保護原有青色面部記號、原alpha、原點和區域外像素。

六個canonical母格：Main027、029、035、038、040、043。共採用133個原生像素色彩修改；Main031、033依原映射同步重用Main027。全部83格有8格更新、75格逐像素不變。所有83格alpha與前版完全相同，未做逐格置中或縮放。

最終候選：`../candidate-r03-higgsfield-final/`。`candidate-r03-higgsfield/`是同圖像的早期包裝快照，生成次數欄位未累加；檢視與驗證均以final目錄為準。m001與預設遊戲資產未變。

## 驗證

- `validation.json`：83格64×64、二值透明、hash receipt、Main/Sub alias和位移、origin[24,38]、53組原始sequence完全相符。
- `browser-validation.json`：既有native timeline，53組、1969次tick、83圖載入、1×／4×／8× nearest、loop/stop/restart，無page error。
- `tests/test_character_region_repair.py`：3項保護測試，涵蓋不可引入光暈／新輪廓、不可覆蓋臉部或區域外像素、錯誤尺寸／區域拒絕。
- `before-after.png`：前後對照，包含4×全畫布與8×固定視窗細節。
- `browser-bound-review.png`：實際瀏覽器檢視畫面。

重建不會再次呼叫生成服務或扣點：

```powershell
python scripts/import-character-region-repair.py docs/art/production/characters/appearance-refresh-v1/sheet-jobs-v1/m002_choromon/higgsfield-r01/region-final-manifest.json
python -m unittest discover -s tests -p test_character_region_repair.py
node tests/character-sheet-review-browser.mjs docs/art/production/characters/appearance-refresh-v1/sheet-jobs-v1/m002_choromon
```

預覽（本機server8732）：`../review.html`。整隻動作與表情美術驗收、正常遊戲接入仍為PENDING／NOT_RUN；不可據此開啟批量或公開發布。
