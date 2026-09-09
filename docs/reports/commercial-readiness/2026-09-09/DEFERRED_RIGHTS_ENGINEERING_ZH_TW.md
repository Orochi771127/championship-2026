# 授權延後至公開發行前：工程紀錄

本文件承接 Owner「那這四項要怎,請用一 個階段做好」及「能把授權留到最後嗎？」。授權文件不作為內部工程開工的前提；正式文件與使用範圍核驗留到公開發行前。這不改變既有忠於原作方向，也不表示已取得原作權利。四項仍屬同一工作範圍，以下只記錄已有證據的完成部分。

基準：`R:/Projects/Championship2026/championship-2026`，`main`，HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。稽核及建置使用共享未提交工作樹；沒有 commit、push 或 deploy。

## 已完成的建置與檢查

- `WEB_BUILD_INPUTS.v1.json` 明列現有 4,387 個程式、資料、contract、依賴與素材輸入。靜態 ESM／明列動態模組及 HTML／CSS 相依檢查通過，訪問 266 個模組／資料。建置不再以 Git tracked 清單誤取已刪除的 `entities.r1.json`，也不再遺漏既有未追蹤模組。
- `npm run build:internal` 使用相同遊戲入口與架構，建立 `dist/internal-review`；`npm run validate:internal` 驗證實際檔案清單、逐檔 SHA-256、入口一致性與模組閉合。輸出為 4,389 個檔案（含入口副本與建置紀錄）。這是当前本機工作樹的完整快照，不宣稱僅靠 HEAD 或乾淨 checkout 即能重建；私有本機素材仍需既有受控來源。
- `npm run serve:internal` 沿用現有 server，以 `--root` 指向快照，限制 loopback、Host 與清單內檔案，提供 `X-Championship-Build` 以辨識實際服務版本。SVG 的 MIME 為 `image/svg+xml`。原有 8732 開發程序未重啟。
- `publicArtIndex` 改為明確核准才納入：權利狀態、人工視覺、runtime、runtime QA、shipping 與 public-release 欄位均須合格，local-only／私有路徑另有否決效果。
- 公開 builder／validator 同時檢查實際素材檔案、唯一核准項目、逐檔核准雜湊及權利紀錄範圍／日期。缺少文件核驗、平台／地區、素材核准或仍引用私有檔案，會在取代舊輸出前停止。未把授權 registry 或任何素材改標為已核准。
- 複製清單只容許既有 runtime、production、JSON contract 與指定依賴；不容許 legal/private、research、ROM／Nitro／RAM／存檔原始 payload。候選包不包含私人授權合約。

正式授權核验仍需要實際文件與合適的人員審查；上述程式檢查只檢驗已記錄的核准資料，不能自行判定法律權利或替代商店審核。

## 四項狀態

| 項目 | 狀態與證據界線 |
| --- | --- |
| CR-01 權利文件 | **依 Owner 排程延後**。現有 `PENDING_PRIVATE_DOCUMENT_LINK`／`shippingPermitted:false` 保留。 |
| CR-02 完整建置 | **本機建置及檔案驗證完成**。公開建置仍按最終權利與內容 gate 拒絕；未宣稱公開包已完成。 |
| CR-03 玩家隊伍與多輪大會 | **尚未完成**。本次原碼讀取已定位資格、隊伍、戰後回寫及輪次控制，但尚未將這些新定位宣稱為正常遊玩或 CPU 對照通過。 |
| CR-04 素材發行檢查 | **檢查工程完成，素材核准尚未完成**。仍為 25 包、0 shippingReady；重新繪製或改名不會自動取得核准。 |

## 玩家隊伍／大會的後續原作查證位置

這些只是本次 `STATIC_BINARY_READ` 定位，尚待受控 CPU 與正常入口對照；不作新的 gameplay contract。

- ARM9 `02092204` 無限制預設，`02092380` 將資格表複製到條件結構，`02092244` 依種族／世代等物種欄位及個體條件回傳結果。
- OVL10 `0210FF08` 查詢可參賽個體，額外排除 `+134/+138/+13C` 非零及物種 `+0C <= 1`；`02112D40` 及後續隊伍槽處理使用 root `+158` 的玩家 party。
- OVL10 `02110A90` 按大會與輪次建立對手；OVL19 `0210E280` 記錄輪次，後段回寫個體的出賽／勝利／HP／TP／狀態及其他欄位。`0210EAA4` 依已完成輪次與勝敗選擇回到下一輪入口或最終結果。
- 原 ROM SHA-256：`8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`。本次私有反組譯與建置稽核輸出在 `R:/Projects/Championship2026/_archive/commercial-readiness-2026-09-09/`，不進 runtime。

## 本機驗收

獨立網址 `http://127.0.0.1:8764/championship.html` 使用新測試來源，避免操作原有 8732 存檔。驗收只涵蓋明列流程；桌面瀏覽器與 Node 測試不代替全場大會、所有資產動態載入、真機或正式上架。

- focused：8 pass／0 fail，涵蓋靜態依賴、既有本機參考边界、新增建置與發行檢查；Host 測試使用原生 HTTP request，避免 Fetch 改寫 Host 的測試假象。
- regression：`node --test --test-concurrency=2 tests/*.mjs`，**1,384 pass／0 fail／0 skip**，95.47 秒。
- `git diff --check`：exit 0；既有換行格式提示保留。
- 內部建置與獨立 validator 均成功：4,389 files；build ID `ef18e00ccf391967ee0473d5c803b008e4d11251fc17e1a9a7628ea1a74d9b39`。
- 實際公開 build：exit 1／`PUBLIC_RELEASE_NOT_APPROVED`，在輸出替換前拒絕。未宣告發行範圍 1 類、私有輸入 3,851 筆、尚未逐檔核准的素材 4,077 筆；這些計數是 gate 明細，不是獨立 gameplay bug 數量。
- Browser：獨立 8764 origin 走 LOGIN → 開始新遊戲 → 四張故事自然結束 → 信件 → 馴獸師「驗收一」→ 數碼蛋「驗收蛋」→ 育成。已實際查看渲染畫面，三個 SVG 工具圖示可見；這段流程收集到的 warn/error 為 0。未操作原有 8732 存檔。
- 正常按下儲存後，重新載入看到「找到存檔：驗收蛋」，經 LOGIN → 繼續遊戲回到第 1 日 08:41 的育成畫面，warn/error 仍為 0；隨後關閉本次驗收分頁，停止測試存檔的時間推進。

日誌：私有稽核資料夾內 `stage-regression.log`、`stage-public-gate.log`、`stage-diff-check.log`、`web-build-stage.json`。新增測試文件為 `tests/championship-web-build-release-cases.mjs`。尚未宣稱自有隊伍／多輪大會、全部動態素材或實體手機驗收完成。
