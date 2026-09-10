# 工具安裝與明亮 UI 試作 R1

**最新交付為 [HUD 參考圖修訂 R2](HUD_REVISION_R2.md)。** Owner 指出 R1 太死板並提供圖一／圖二後，已把單純換色改為金色切角標籤、原創工具圖示與緊湊資訊面板，也驗證正常四籠配置並修正確認後未標記 dirty。以下 R1 UI 截圖與 1,097 測試數是先前階段紀錄；最新完整測試為 1,098 PASS。R2 保留8個既有工具入口，並把 Pixi 場地周邊空白底色調亮；籠子拼接／角色活動真值仍未改動。

日期：2026-09-06。正式產品 root：`R:\Projects\Championship2026\championship-2026`；branch `main`；準備及完工檢查 HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。共享工作樹原有大量修改；本次只加入下述試作與必要的登記／CSS 修改，沒有 commit、push 或部署。

Owner 授權：「安裝目前所缺的工具或軟體並按照你的建議開工」。進行中補充：「UI 材質……原本美術資料包的 UI 可以沿用？或是用類似風格重製……不要太黑暗深色系，請盡量明亮的風格」。最新要求取代先前深色材質提案。

## 已完成

| 工具 | 現在狀態 | 位置／驗證 |
|---|---|---|
| Blender 4.5.13 LTS | 新安裝，官方 portable 版 | `R:\Tools\Blender\4.5.13\blender-4.5.13-windows-x64\blender.exe`；版本及實際 CPU render 成功 |
| Aseprite 1.3.14.3-x64 | 已存在，確認可用並加入開始選單捷徑 | `C:\SteamLibrary\steamapps\common\Aseprite\Aseprite.exe`；indexed 匯入／匯出 exit 0，逐像素一致 |
| Python 3.12.10 / Pillow 12.3.0 | 已存在，沿用 | 執行像素與 artifact QA |
| Node 22.17.0 / PixiJS 8.19 / Three 0.185 | 已存在，沿用 | 沒有換 runtime 或安裝第二個遊戲引擎 |
| AI 圖像生成 | 已可使用 | 產生原創淺色材質，保留原始 PNG，以 bundled sharp 轉 WebP |

開始選單 `Championship Art Tools` 內有 Blender 4.5 LTS 與 Aseprite 捷徑。Blender 安裝在 R 磁碟，避免繼續占用空間較少的 C 磁碟。未更動全域 PATH。

Blender 下載自 [官方 4.5 發行目錄](https://download.blender.org/release/Blender4.5/)，檔名 `blender-4.5.13-windows-x64.zip`；和官方 `.sha256` 一致：

`b5fdf800ce65fa2f209e8f68d02667e4d720fa1c42f247c72d1882ab04decba6`

安裝檔保留於 `R:\Tools\Downloads`。下載模型來自 [Quaternius Monster Pack](https://quaternius.itch.io/lowpoly-animated-monsters)，發布頁標示 CC0；原封包留在 repo 外 `_archive/tooling-pilot-r1/quaternius-monster-pack.zip`，SHA256：

`c0b73e7d641a25348e46195e1413d050d08cf14302d999e0d40a634c43c47a9b`

## Raising Home 明亮 UI 已接入

- 沿用原作 UI 藍色／黃橙框線作為風格參考，以銀白、象牙與天空藍表面重製，搭配深藍文字。
- 原 UI 包 `docs/art/production/ui/faithful-hd96/manifest.json` 有 96 場景，但明確 `runtimeEligible:false`，其 witness 是參考切片，不直接接入本次 runtime。
- 新生成背景已接進既有 `.int-rh2-header`。同時調整現有 Home 面板、Save、季節時間列與 contextual toolbar 的顏色，使明暗一致。
- 共用列以原本的 `data-screen="RAISING_HOME"`、`data-mode="1"` 限定。沒有新增 DOM、控制項、router、save、ticker、renderer 或遊戲規則。
- 原材質 PNG 存在 `ui-source/raising-header-bright-original.png`；runtime 是 `assets/production/ui/tooling-pilot-r1/raising-header-material.webp`，1536×1024，12,966 bytes。
- manifest 已加入 canonical production index；生成器可重建共 21 個既有與新增登記項。新增項 `ORIGINAL_CREATED`、`runtimeEligible:true`，仍為內部試作，`humanApproved:false`、`shippingReady:false`、`publicReleasePermitted:false`。
- 初次深色生成檔保留為未採用試稿；沒有 runtime 引用。最新提示詞見 `ui-source/bright-prompt.txt`。

本次只完成 Raising Home 的明亮方向；其他頁面還沒有全面換色。Pixi 場地的既有深色空白區與素材邊緣問題沒有由 DOM UI 試作修改。

## 角色工具試作：完成工具鏈，沒有新增角色替換稿

[離線比較頁](review.html) 包含既有 main_023 像素稿及四個 Blender study renders。

- [可編輯 Aseprite 檔](aseprite/m201-main-023.aseprite)：從既有 r02 main_023 原生 32×16 稿匯入，indexed 匯出 RGBA 逐像素完全一致；9 種顏色含透明，alpha 0/255。這不是新增 master。
- [可編輯 Blender 檔](blender/m201-offline-pose-proxy.blend)：CC0 Dragon 模型移除翅膀、重配色與擺姿；共用 464×368 相機，source origin (184,268)，比例每原生單位12px。Study frames 1–4 只選取000／023／056／062的近似姿勢，不是原作時序。
- 固定投影、所有渲染未裁切及檔案 hash 通過；不能由此推導原作 ground、silhouette 或 motion parity。
- **適配結果：此模型不接受為 M201 替換稿。** 長嘴、尾巴與手腕 rig 不符合 M201 A；只適合觀察側面體積／轉動。056、062 原生稿缺口仍保留，沒有用降採樣渲染冒充完成。
- 正式角色產線继续沿用既有原生 pixel bank、共享 palette／patch、frame／ticks／mode／origin 編譯器。Blender 研究和 UI 生成都不改角色 gameplay truth。

重新產生離線檔（在產品 root 執行）：

```powershell
& 'R:\Tools\Blender\4.5.13\blender-4.5.13-windows-x64\blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/build-m201-blender-pose-study.py -- --source 'R:\Projects\Championship2026\_archive\tooling-pilot-r1\quaternius-monsters\Blend\Dragon.blend' --output docs/art/production/tooling-pilot-r1/blender --brief docs/art/production/tooling-pilot-r1/m201-candidate/candidates.jsonl
python scripts/verify-tooling-pilot.py
```

Aseprite CLI 需要等待程式結束：在 PowerShell 使用 `Start-Process -Wait -PassThru -WindowStyle Hidden`，以免 GUI exe 尚未寫檔便開始下一步。原 import/export log 留在 `aseprite/`。

## 驗證與實際限制

- A0 index 驗證與生成器 `--check`：PASS，21 bundles；0 shipping。
- focused Node tests：67 PASS，0 fail。
- 全部 `tests/*.mjs`：1,097 PASS，0 fail；完整 log：`qa/regression.log`（Git 忽略 log）。
- pixel compiler：直接執行 `python tests/test-compile-pixel-character-bank.py`，13 tests，1 skipped（未提供外部 archive/bank 的整合類別）。首次用 unittest discover 因檔名含連字號沒有发现測試，已改用直接執行，沒有把 0 tests 當作通過。
- `python scripts/verify-tooling-pilot.py`：PASS；詳細 `qa/artifact-checks.json`。
- 正常瀏覽器流程：New Game → SAVE → reload → Continue → Home → SYSTEM 展開／關閉 → HAND 選取。獨立 origin `http://127.0.0.1:8737` 隔離使用者原有存檔。
- 五種 requested viewport：360×800、390×844、393×852、412×915、430×932。393 實際回報為 **394×852**，不能宣稱精確393驗證；其餘符合要求。
- 所有已量測畫面無橫向溢出，八個 toolbar touch targets 高44px，只有1個 canvas。console warnings/errors：0。見 `qa/browser-viewports.json`、`qa/browser-summary.json` 與截圖。
- 獨立 UI Agent 檢視兩張390px screenshot與CSS／manifest，無阻塞；季節未知值的字色 fallback 已補。這不是該 Agent 重跑 root 的測試。
- `git diff --check`：PASS；共享樹已有 CRLF 轉换提示，不是 whitespace error。
- 沒有 physical-device QA，也沒有宣稱所有96個 UI 場景、224個角色或完整遊戲流程完成。

下一個可延續步驟是以此明亮 Home 為方向，逐畫面校對原作 UI 的可達性與元件，並在 Aseprite 補齊 M201 原生難姿勢。免費模型試作不作為角色通過條件。
