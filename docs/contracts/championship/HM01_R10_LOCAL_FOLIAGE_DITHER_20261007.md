# HM01 r10 局部樹葉網點候選 — 2026-10-07

狀態：**LOCAL_QUERY_CANDIDATE / PRIVATE_QA**。本次是 Owner／parent 已授權的呈現候選，不是原作網點規則的 ROM_VERIFIED 宣告。

## 固定範圍與來源

沿用現有 App、Pixi Application/ticker、actorLayer 排序、原生 frame/ticks/origin、terrain/collision、AI、捕捉與存檔。來源為現有 `huntDepthOccluders.js`、`createHuntFieldPixiPresentation.js`、native character geometry 與實際 r10 PNG/9欄pieces；沒有重新生成 IMG3851 或修改 producer/art。

r10 frame SHA256：`451518a2ed5e71131b43f06698c238c9ca592bff6af5d091a1914ba4024f8451`。r10 manifest SHA：`e240bbc1882327dec63561442762b3d729fa4c469faca5ba4037370592fe72e7`。其 manifest 舊 source 標籤仍帶 h1；本驗證依實際 r10 檔案，不把它宣稱成 h1 或 r11。

## 已實作

- 僅 loopback URL `?presentation=player&caveReview=natural-r10&huntFoliage=dither-r1` 開啟。移除 `huntFoliage` 即原整片 `.42` fade；不帶 `caveReview` 的既有 h1 預設亦未變。
- 先實看固定 native frame/脚點/鏡頭，樹前、穿過、樹後排序合理，故未改 z。只有原有非 solid 且 `piece.z > actor.zIndex` 的交集片以同 z mesh 呈現。
- shader 取當前原生 cell 的真實 alpha，依 trim/origin、已套好的 scale、X/Y翻面、worldZ位置換算。沒有額外乘4、重新置中、角色置頂或角色副本。透明／隱藏角色不觸發。
- 網點為 world 固定的2px格（map2world/native）、4×4 Bayer、9/16開口。僅角色 alpha 與前景實際像素交集改變；陰影、圈圈、空白矩形不當成角色輪廓。
- 洞口／後牆等 solid 片仍為原sprite/alpha1。硬遮不因網點失效。
- Mesh/shader/geometry 隨 camera pieces 釋放、離場全部釋放；角色texture僅借用。unsupported renderer 保持原 `.42`；每片重疊超過 GPU texture/uniform 預算亦有 `.42` fallback 與診斷，不宣稱所有硬體已驗。

## 驗證

Chrome headless 桌面模擬390×844、DPR2；不是實體手機。

- 36項相關測試通過：depth8、stamina6、native phases8、normal entry13、equipped integration1。最後隱藏/alpha0 guard後重跑同8項depth，全部通過；不是44個不同案例。
- 最終受控7組 × opaque／.42／dither／hidden-foliage四種：樹前、穿過、後方、X翻、Y翻+lift、雙角色、solid洞。固定species-044當前原生格與所有脚點/鏡頭，受控僅presentation；全28次 source view 保持一致，沒有把穿過障礙物當成正常AI/nav。
- CPU依實際截出的原始frame alpha獨立核對：全部候選變化在 actor alpha 外 **0px**，在 opaque-vs無foliage差異外 **0px**。樹前、solid洞與opaque **0px差異**；洞口四模式皆0角色像素。圖片已實看。
- 正常 New Game→SYSTEM→Hunt→Grass→ROPE→Field→返回Home→再進入，AI/ticks未改。自然AI同frame canvas `.42/dither` A/B有639變動像素且source view不變；正常DOM畫面與native canvas圖分列，沒有把受HUD覆蓋部分宣稱成全可見UI。最終離場65/65 mesh/shader/geometry釋放，再進入仍同App；page/console error皆0。
- R10 frame/atlas/backcap/pieces/manifest SHA完全未改。所有 source/test 改動都有逐檔before副本、最終SHA與scoped diff；保存既有dirty修改，無Git寫操作。

失敗QA亦保留：早期contact裁切誤用DPR已更正；正常Home測試誤用root data-screen selector已改成實際child；一次隨機遭遇4秒沒有抽到active片，只修觀察窗口、不改spawn/AI。早期browser session的角色不同，沒有跨session像素等同宣告。

## 證據、回退與接續

本機證據：`../handoff-review-20261007/tree-depth-dither-r1/`，入口 `VALIDATION_SUMMARY.json`、`SCOPED_IMPLEMENTATION.diff`、`IMPLEMENTATION_SHA.json`、`candidate-final-v2/`、`normal-final-v4/`。詳細逐圖/full PNG保留R；私人小包收實看contact、native-raster detail、正常A/B、測試/雜湊/腳本與實作差異。

回退先移除URL的 `huntFoliage`。若需回退程式，先核對 `IMPLEMENTATION_SHA.json`，只逆套本批scoped hunk；不可整檔覆蓋目前dirty source，不能把`before/`當成無條件覆寫指令。

r11目前僅cloud凍結，未落R/未升default。版本IDs、SHA、限制與m201強遮點詳 `R11_CLOUD_WAITING.json`；Owner選版/下載後再核對bytes/CRC/SHA並做受影響同版Pixi檢查。cloud static35案例與Python零面積bucket修正不是本次runtime驗證。192²只分析：不改128 terrain/nav/spawn/radar/時間。

仍待：Owner比較選擇、r11同版renderer檢查、真手機及效能/主觀網點可讀性、其他地圖/全角色語意驗收。此候選不升default、不新增商用/出版/權利接受。m454睡眠、蛋完整animator/request trace、m401/m503修補同版檢查、branch228/229/230及未批准前置數值等既有清單繼續保留；不讓這些缺口阻擋本批呈現候選封存。


私人QA已保存：`libfile_f5ddeddf038481919c37737d4e61529e`，3,311,514B，SHA256 `4baa0aab38baf20ef8382ac7e9029d6f5c579f1cb8da5fc07d9f5cd087373e4b`，25檔CRC/逐檔SHA PASS。Windows本機xattr不可用，完整Library回條留R；未影響雲端保存。
