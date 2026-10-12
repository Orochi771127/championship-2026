# 八蛋 Raising 原作尺寸校準

基準：`94207e6ee4927bb5357646a4319d90e4d7e3ceea`。工作樹：`R:\Projects\Championship2026\egg-native-sizing-20261012`。本報告記錄提交前驗證；2026-10-12 Dot 完成 R2 審查並授權本輪 commit／main 整合／push／Pages。exact-SHA 發布回條保存於本機 egg-sizing-review-20261012/release。

## 授權與證據

Owner 經 Dot 轉達：`Sentinel_ec2469868d0c8191b5fc1f129a04b880` 要求蛋恢復原作大小；`Sentinel_0ad6158a0628819197b140ea7ae3f3c4` 要求每一顆都改。範圍為 e000–e007 的 Raising 世界顯示尺寸。

Owner screenshot reviewed by Dot; not opened locally. 本機 Library 官方 materializer 在 Windows 寫入 xattr 失敗，未繞過；手機照片比例不作為原作尺寸依據。本機已查看既有 native 圖與八顆成品的控制對照。

依據：

- `src/data/championship/battleCharacterGeometry.js`：八蛋 Main cell_000 可見邊界均為 `[-7,-17,7,1]`，即 **14×18 原生像素**。OAM cell 的 16×24 不是可見身體尺寸。
- `docs/art/production/tooling-pilot-r1/scale-review/character-main-zero-scale-candidates.json` 與 `docs/art/production/characters/appearance-refresh-v1/generated/entities/e000_digitama/origin-audit.json` 至 e007 同名紀錄：既有 decoded/native 像素比對證據。未以現行實作反推原作行為。
- `src/data/championship/accepted-original-character-selection.r1.json` 及其八蛋 `runtime.review.json`、`main.json`、`main.webp`：逐一解碼 alpha，104 個 Main 影格均與 reviewGeometry 相符。
- `docs/contracts/championship/OPENING_EIGHT_EGGS_2026-10-09.md`：沿用八蛋身份、孵化、選單、存檔與教學權限。

## 根因與顯示契約

原創蛋 raster cell 是 384×352、density=4，邏輯畫布 96×88。除以 density 的步驟正確，但成品 alpha 的邏輯佔地遠大於 native 14×18；八蛋沒有身體校準比例，陰影和選取圈又直接跟隨該大邊界。兩次 sprite.scale.set 是覆寫，不是倍率相乘。

使用每顆 cell_000 的可見邊界計算 `min(14/width,18/height)`，等比例納入原作待機範圍。原創裝飾與寬高比不同，因此不宣稱每張均恰為 14×18，也不非等比拉伸。每顆全部影格使用同一比例與平移；idle 中心對齊 native x=0、opaque bottom 對齊 y=1，孵化相對位移保持。原圖、atlas、origin 與動畫資料不改。

| 蛋 | 現行可見寬×高（native px） | 固定倍率 | 校準後待機寬×高 |
|---|---:|---:|---:|
| e000 星絮蛋 | 49×45.75 | 0.285714286 | 14×13.071 |
| e001 焰脈蛋 | 53.5×65.5 | 0.261682243 | 14×17.140 |
| e002 潮環蛋 | 48.25×47.5 | 0.290155440 | 14×13.782 |
| e003 森芽蛋 | 43.25×52.75 | 0.323699422 | 14×17.075 |
| e004 雷紋蛋 | 58.25×55.5 | 0.240343348 | 14×13.339 |
| e005 月霧蛋 | 61.5×55 | 0.227642276 | 14×12.520 |
| e006 晶棘蛋 | 53×59.25 | 0.264150943 | 14×15.651 |
| e007 聖耀蛋 | 60.25×68.25 | 0.232365145 | 14×15.859 |

孵化影格可超過 idle 範圍，保持同一倍率，不逐幀塞回 14×18。陰影、選取圈沿用既有公式，以校準後的可見邊界繪製；觸控區保持至少 44×44 CSS px。

## 實作與界線

僅修改 `raisingNativeSizing.js`、`createRaisingFieldPixiPresentation.js`、其聚焦測試與本報告。倍率只作用於 `COMPLETED_ORIGINAL_DENSITY4_LOCAL_PLAY` 的八蛋；native baseline、其他角色既有倍率、Hunt/Battle、選蛋 UI、籠子、字典、輸入／保存 authority 不變。使用既有 Pixi Application/ticker。

Claude 的 battle-dynamic-fx 工作樹及 VS5 衝突未修改；主工作樹既有資產不覆寫。瀏覽器若讀取主工作樹的缺失本地 art，只用唯讀 fallback，逐筆記錄來源。

## 驗證

以下聚焦測試 **33/33 PASS**：

```text
node --test tests/championship-raising-native-sizing-cases.mjs tests/championship-opening-eight-eggs-cases.mjs tests/championship-raising-hatch-cases.mjs tests/championship-raising-field-viewport-cases.mjs
```

涵蓋八蛋、所有非 blank Main/Sub 影格、固定 anchor、flip、renderer resolution、不同 native screen scale、44px hit area、原作孵化順序、Continue 與 viewport 座標。既有 scene mock 已補齊現行資產 scope 和 canvas 所需介面；未修改產品碼去遷就 mock。

瀏覽器驗證與截圖結果另附 `R:\Projects\Championship2026\egg-sizing-review-20261012\browser\REPORT.json`。八蛋正常開局與點選全部通過；page error／missing request 均為 0。e001 另通過 Continue、390×844／844×390／1024×768 resize 與正常觸控孵化至 species13。隔離 Chromium context；請求由本地檔案 fulfill，未開 TCP 伺服器、未使用玩家 profile。以實際 LOGIN／New Game／Continue／選蛋／點選操作驗證，只有唯讀 Pixi instance 掛接供量測。

物理 iPhone、Owner 視覺接受、合併及發布均未宣稱完成。


同鏡頭比較另見 `browser-comparison/REPORT.json`：兩次正常 New Game、390×844、DPR2、cell_001、resident root=(195,432)、host=(0,95,390,675) 完全一致。e001 可見範圍由 116.5×128 降為 30.486×33.495 CSS px；陰影由 97.86×30.29 降為 25.608×7.926，選取圈由 126.5×39.28 降為 40.486×11.756；觸控區仍為 44×44。這是 cell_001 觸摸姿態量測，與上表 cell_000 idle 數值分開。兩次 New Game 的 RNG／初始能力值可能不同，未更改 gameplay 邏輯。已實際檢視成對截圖。

完整八蛋瀏覽器檢查使用頁面內正常操作；網路傳輸由隔離測試的 route 改為本機讀檔，因此不宣稱 public deployment/network QA 或實體手機驗收。初次受限環境執行已停止，最後完成結果取自獲准的獨立 Chromium；未開測試伺服器。

交接 ZIP 包含限定的三個程式／測試變更、此報告、tracked diff、alpha 稽核表、前後圖與 browser JSON。沒有原始 ROM、大批素材、玩家存檔或 Library 私密傳輸資料。新報告未改共同 README／Owner Direction，以避開 Claude 已暫存的共同檔案。

## R2：旋轉後的實際 CSS 觸控尺寸

Dot 審查發現 R1 的 hitArea 量測是 Pixi 內部像素；在既有橫向 portrait frame 的 CSS scale=0.5625 下，44 內部像素只有 24.75 CSS px。R1 的橫向步驟僅 resize／截圖，沒有實際點選，因此其結果不構成橫向 44 CSS px 驗收。上述 390×844 前後比較仍有效。

R2 僅在八顆已校準原創蛋的 actorGeometry 呼叫傳入 canvas.getBoundingClientRect 與 app.screen 的 x/y 比值，據此換算最小 hitArea。sprite scale、visible bounds、anchor、shadow／selection 繪圖、籠子、portrait layout、其他角色 hitbox 與進化流程均保持不變。不使用 DPR 當作 CSS transform。

聚焦回歸：`node --test tests/championship-raising-native-sizing-cases.mjs`，8/8 PASS；新增八蛋在 1、0.5625 與非等比 CSS transform 下維持 44 CSS px，並逐項比對 visual geometry 不變。`browser_egg_css_touch.cjs` 正常開局後由 390×844 旋轉到 844×390，量測 canvas-to-DOM scale=0.5625、hitArea 約 78.222×78.222 Pixi px，即 44×44 CSS px；真實 touchscreen.tap 落在舊 24.75px 區外、新區內，成功開啟蛋資訊卡。回直向仍為 44×44 CSS px。page error／missing request 均為 0。

R2 交接階段未重跑八蛋完整開局套件，當時未啟動 build/esbuild 或發布檢查。R2 最小差異與回條位於 `R:\Projects\Championship2026\egg-sizing-review-20261012\touch-css-r2`。

## 審查後發布檢查

Dot 獨立核對 R1/R2 hash pairs、3744 geometry cases 與橫向邊緣點選後，授權本輪 commit／非強制 main 整合／push／既有 Pages。依 lockfile 完成 `npm ci --no-audit --no-fund`；esbuild 0.28.2 可執行。完整 `npm run test:ci` 為 1692/1692 PASS；正式 build／validate 各 9315 檔，buildId=`106d829359b7e76755ed9e2d7e7704b174a53603fbab1e80a96fe67077a48f3e`。

第一輪 CI 的既有 loopback server 測試被 sandbox EACCES 阻擋；保留紀錄後，在具備 loopback 權限的環境原樣重跑通過，未改测试或門檻。正式公開模式產物通過正常 New Game／e001／0.5625 橫向縮放／舊觸控區外側點選並開啟資訊卡；沒有 page error 或缺檔。首次 navigation 的 networkidle 等待逾時，改用 DOMContentLoaded 後原有實際 LOGIN／ready gate；所有正常流程與失敗斷言保留。這是本地產物 smoke，公開 URL 的 exact-SHA 回條另記於本機 `egg-sizing-review-20261012/release`，不以本段替代公開驗證。
