# Battle R12 — 改用已提供的原作特效圖片

已將 R11 的 16 張生成替代圖退出預設，接入 Owner 美術包中現有的原作逐格圖片。本輪沒有生成、重繪或縮放任何特效圖片；沿用既有正常選招、原生動畫時間、碰撞與命中流程。本次修正完成的是 **2D 圖片來源、原生 cell 對應、本機顯示与清除**，整體遊戲與所有招式完整演出仍為 PARTIAL。

開工核對：`R:/Projects/Championship2026/championship-2026`、`main`、HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。保留共享工作樹原有修改與刪除，未 commit、push 或 deploy。Owner 在澄清生成圖及本機研究使用邊界後回覆「對,請處理好」，見 [Owner Direction](../../../coordination/OWNER_DIRECTION.md)。

## 圖片來源與可重現性

實際原包：`R:/Projects/Championship2026/YDIJ_PRIVATE_ROM_ART_PACK`。使用 `08_FULL_FAMILY_CONVERSION/common/e003_*/cells/cell-NNN.png`、`cells.json`、`animations.json`，並核對 `07_RAW_NITRO_ART_BY_ROM_DIRECTORY/common` 的原生 NANR／NCER 檔案 hash。championship-evidence 的 `e003_H_Knuckle` 查詢亦對應 `research-only/YDIJ_FULL_ROM_DECONSTRUCTION_2026-08-29/analysis/ROM_FILE_CATALOG_6419.csv:610-611`；查得的研究資料沒有引入其他專案的產品程式。

| 檢查 | 結果 |
|---|---:|
| 目前原生效果表使用的資源 bank | 151 |
| 沿用的原生動畫 sequence | 484 |
| 已收錄 cell 圖片 | 1,231 |
| 逐格 RGBA 像素一致 | 1,231／1,231 |
| 原圖本身完全透明的 cell | 99，原樣保留 |
| NANR／NCER hash 比對 | 302／302 |
| 尺寸、原點、動畫時序不一致 | 0 |
| 本輪 AI 生成圖片 | 0 |

151 是資源 bank 數，484 是動畫序列數，1,231 是圖片 cell 數，均不能當成已完成招式數。像素檢查證明打包結果與 Owner 提供的已解碼 PNG 相同，並核對其原生來源與時序；不以此宣稱每一招已完成整體演出驗收。

`scripts/build-battle-reference-art.py` 只做整數座標圖集排列，輸出一張 1024×1024 RGBA PNG，解碼占用 4 MiB。每格以 `[-lowX,-lowY]` 保留原生原點，原點超出圖片也不置中修正。圖集 SHA256：`d24cebb99d921eb5288aa654d1ae91d46e6f4a3e186cc69c7aef8443d635098b`。完整來源與每格 hash 在 bundle manifest；[打包驗證](pack-verification.json) 記錄統計。

重現命令（既有 Python／Pillow，無需另裝軟體）：

```powershell
python scripts/build-battle-reference-art.py --archive 'R:\Projects\Championship2026\YDIJ_PRIVATE_ROM_ART_PACK' --check
```

`--check` 已通過，重新產生的 PNG、manifest 與驗證報告 bytes 一致。

## 既有架構內的接入

- 原包不成為 runtime URL。準備好的圖包位於 `assets/production/internal-faithful-baseline/battle-effects-v1`，由既有 production index 與 `battleEffectArt.js` 載入。
- `battleEffectSprites.js` 使用原生 pool 快照的 bank／cell、Q12 座標、翻轉、旋轉、透明度與色值。1,231 個 Texture 共用同一圖集 source；使用原來的 actor layer、Pixi Application 與 ticker。
- 原生透明格仍存在於 pool，但不可見。未知 cell 繼續明示 missing；不套通用火花、不退回生成圖。
- R11 生成 bundle 標為 `RETIRED_GENERATED_REPLACEMENT_OWNER_CORRECTION`、`runtimeEligible:false`。歷史圖片和生成紀錄保留，方便追溯。
- 原作動畫、命中、落地與復起的 12 個既有來源 hash 全部維持 R11 記錄。沒有改寫碰撞、數值、招式條件、隊伍或存檔；不重做已通過的 ROM 控制案例。

## 正常流程與測試

使用原有 battle module 的獨立記憶體 fixture，從 clock0 由正常 AI 選招；只用頁面按鈕推進，沒有注入命中或結算結果，不寫使用者存檔。

| 場次／seed | 瀏覽器尺寸 | 結算 clock | 2D 產生／釋放 | 缺圖 | 結果 |
|---|---|---:|---:|---:|---|
| 1／12 | 390×844 | 1983 | 66／66 | 0 | 對手獲勝，9,400 bit |
| 1／21 | 320×712 | 2136 | 52／52 | 0 | 對手獲勝，9,400 bit |

兩場結束後皆 active0／free496，JS error0；clock、勝負與 R11 對應場次一致。seed21 正常流程已走到先前缺圖的 bank1 cell142 原作文字效果；這是 runtime cell 綁定證據，沒有新增文字玩法或聲稱該幀人工逐像素驗收。

390×844、seed12、clock962 的 bank81 cell2 正常顯示：原圖 32×48、原點 (4,23)，沿用場景縮放；見 [畫面](seed12-fan-390.png) 與 [場景快照](seed12-fan-390.json)。結算紀錄：[seed12](seed12-settlement-390.json)、[seed21](seed21-settlement-320.json)。320 寬沒有水平溢出。這些是桌面瀏覽器手機尺寸驗證，未宣稱實體手機驗收。

- Focused：33／33，包含全 cell 尺寸／原點、原生序列可取得、共用 texture、清除、空白格、拒絕生成 fallback、非本機不抓取與伺服器／打包隔離。
- Regression：1,244／1,244。初跑唯一失敗為 M201 舊測試把 Pages 變數名稱写死；改成驗證素材與登錄實際被排除後，整體重跑通過。沒有修改 M201 圖片或審核狀態。
- 圖包 deterministic check、來源 hash 比對、`git diff --check` 與新增文字檔空白檢查結果見 [verification.json](verification.json)。

## 本機與發布邊界

新 bundle 明示 `localOnly:true`、`publicReleasePermitted:false`、`shippingReady:false`。載入器僅接受 HTTP(S) localhost／127.0.0.1／[::1]，其他網址在抓取前退出。開發伺服器對此圖包另檢查 loopback peer 與 Host；實測本機 PNG200、外部 Host403。現有 8738 伺服器本來即綁定 127.0.0.1，未中斷共享程序；新的 server guard 已由另啟的短期測試程序驗證。

Pages builder 和 validator 共用排除規則，原作 bundle、已退休的生成 bundle，以及兩筆登錄都不进入公開包，相關測試通過。**完整 Pages build 尚未通過**：共享工作樹原有 tracked 檔案 `src/data/championship/catalogs/entities.r1.json` 已被刪除，builder 因缺少 input 中止；本輪保留該既有刪除，沒有復原或宣称可發布。未執行部署。

## 後續直接沿用與仍未完成

1. 目前數值表全部 151 bank 的 2D cell 已有原作圖片，後續不需要重新生圖或重解碼此批素材。直接用既有 manifest／原生 pool 檢查更多正常招式的時間、位置與圖層。
2. 下一個演出缺口是完整 3D 變換／anchor、次級特效實例與音效 lookup／播放。先查原包和已解碼證據，缺少的執行條件繼續標示 UNKNOWN_REQUIRES_TRACE，不用生成圖替代未接好的來源。
3. 全角色逐招正常遊玩、自有角色正式三人隊與養成數值，以及養成／狩獵／捕獲／進化動作、實體手機、完整授權／shipping 驗收仍未全部完成。本輪不升級這些狀態。
