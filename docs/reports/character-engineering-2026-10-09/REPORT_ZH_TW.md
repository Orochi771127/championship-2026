# 角色工程修復與有界容量驗證 — 2026-10-09

本輪完成兩項已授權缺陷；保留 Slice6 教學成果。工作分支 `handoff/dot-continuation-20261001`，HEAD `1fb7d5fd21d3da47775d34ab0d3a1a95f6623972`。本機未提交，未發布。

## 修復與 authority

1. **38 隻成長期 density 契約不一致。** 舊測試要求交付 sidecar manifest 的 `packedPixelsPerNativePixel`，但這 38 份缺少該歷史欄位；正式 loader 已使用 runtime 的 `artProfile.scale` 與逐 frame `reviewGeometry.scale`。抽取現有 runtime validator，讓 loader 與全部 222 個角色驗收共用。明確要求既有 schemaVersion 1 / PIXIJS_V8_SPRITESHEET，保留 bank、identity、canvas、anchor、origin、Main/Sub 完整 animation/ticks 守門。沒有補造 sidecar 第二權威或放寬 scale 判斷。新增缺失／錯誤 scale、缺失 geometry、錯 origin/ticks 等負例。
2. **容量診斷誤讀被替換的 baseline record。** Bundle 現在記錄實載 TextureSource 的 physical pixelWidth/pixelHeight、頁數與 format；同來源去重。Roster 聚合這些資訊，`rgbaBytes` 保留為相容別名。尺寸缺失回報 null；不以舊 baseline 或邏輯 sprite 尺寸代填。標籤為 `BASE_RGBA8_ESTIMATE_NOT_GPU_USAGE`，只計 width × height × 4，不包含 mipmap、解碼副本、driver/cache 或峰值。

契約：[正式角色 runtime authority](../../contracts/championship/COMPLETED_ORIGINAL_CHARACTER_RUNTIME.v1.md)。來源包含 `completedOriginalCharacters.js`、catalog、實選 runtime.review.json／baseline runtime.json、`pixiCharacterRuntimeBundle.js`、`licensedCharacterRoster.js`，以及本機 Pixi TextureSource 原始碼。championship-art-production skill 在可用 catalog 與已知本機位置找不到；本輪為工程修正，未選取、製作或改寫美術。

## 驗證

- 單一去重回歸：**56 個檔案、465/465 tests PASS**。包含 Slice6 相關回歸與角色 loader、動作、origin、replacement、capacity 檢查；不加總重跑數字。
- 繁中正常 URL：新遊戲 → 育成 → 兩次 Hunt 捕捉 → Battle → completed；重載與保存重試通過，基底存檔不變，單一 canvas，無 page error。本輪未重跑五語全鏈；先前五語 Slice6 回條保持原樣。
- 正常草原入口實載 **8 entities / 8 Main pages**。同一組 IDs 的舊 baseline 估算為 **110,920,576 bytes**，新診斷與 PNG header 核對為 **142,606,336 bytes（136 MiB）**。這次自然抽取不同於舊 7 隻樣本，不混用兩次族群比較。

## 最大圖集

桌機 Chrome headless；390×844 CSS px、DPR2、touch 模擬。實際 WebGL `MAX_TEXTURE_SIZE=16384`。下列 PNG 皆為 8-bit RGBA（color type 6）；本機 decoded TextureSource 回報 `bgra8unorm`。

| 角色／side | 圖集像素 | PNG bytes | 基礎 RGBA8 估算 | 本輪驗證 |
|---|---:|---:|---:|---|
| m535_slayerdramon Main | 6144×6912 | 10,781,797 | 169,869,312（162 MiB） | 正常 Home 載入／離開各 2 次 |
| m535_slayerdramon Sub | 6144×2304 | 3,130,957 | 56,623,104（54 MiB） | 靜態 header／hash |
| m531_metalseadramon Main | 6144×6144 | 10,703,397 | 150,994,944（144 MiB） | 正常 Home 載入／離開各 2 次 |
| m531_metalseadramon Sub | 6144×2304 | 3,090,420 | 56,623,104（54 MiB） | 靜態 header／hash |

m535 ready 時間為 2201／1905 ms；m531 為 1922／1870 ms。包含導航及場景準備，僅為本機觀察，不是穩定 benchmark。每次只載該角色 Main 一頁，沒有同時承載兩隻最大角色。UI 進入 Shop 後觀察到 source.destroyed、resource 清空及 ImageBitmap.close 後尺寸歸零。這證明應用資源釋放路徑完成，**不證明 GPU 實際回收量或實機手機穩定性**。

本機未出現 texture-limit/load 錯誤，不進行無依據重新 packing。圖集大於 4096；手機低限與峰值仍待實機驗證。截圖可見大型角色在窄 viewport 有部分超出畫面，這是保留既有尺度／原點的觀察，未宣稱完整視覺驗收，也未偷偷縮小角色。

## 有界缺口觀察

- **m454_grondramon**：依現有 `nativeRaisingActor` / Growth / Sleep 程式，idle state 1 且 signed `00c >= 178` 時由 owner 進入 state 4、request 13。隔離初始存檔用原有 species 181 profile，僅將初始 fatigue 設為 1210、threshold 保留 1211；正常 Continue 後不改執行中狀態。最多 20 秒，於 3.75 秒受控時間觀察到 state 4 / sequence 13，並實看睡姿截圖。這是接近門檻的初始條件驗證；未宣稱從幼年自然養成、完整睡眠／醒來或原作全 parity。
- **Battle**：既有成年隊伍／比賽日期隔離 fixture，正常 UI 入場，最多 40 秒受控時間，1755 筆讀取觀察，出招及 HP 變化可見。結束時 model 為 TEAM_DOWN / TEAM_ONE_AHEAD，但畫面尚為 BATTLE_FIELD；本次不宣稱結果畫面完成。`originalTimingParity=false` 與 dispatch timing partial 均保留；缺 native 同步逐 frame 對照。
- **m528／m540**：維持 UNKNOWN_REQUIRES_TRACE；未加入猜測分支值。

## 安全交接

沿用原伺服器 8766／PID38660。沒有玩家存檔操作、素材改写、新伺服器、commit/push/merge/checkout/reset/deploy/delete。既有協作者修改保留；本任務 before copies、owned paths、scoped diff、hash 與檢查紀錄位於 `R:\Projects\Championship2026\character-engineering-20261009`。Slice6 checkpoint 以 hash 引用保全，未複製整個專案。

本輪 Library 呼叫 **0 次**；依 parent 已確認的官方傳檔阻塞停止重試，沒有雲端 file ID。最後讀到 Codex 額度已用 61%、剩餘約 39%；沒有 reset、購買或自動儲值操作。

[機器可讀回條](VALIDATION.json)。原始 logs、隔離 fixture、PNG、探針與 SAFE_CONTINUATION 位於上述本機 evidence 目錄。實機、完整 Battle timing、m528/m540、權利與發布仍保持未關閉。
