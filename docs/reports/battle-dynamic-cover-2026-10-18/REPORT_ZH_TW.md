# 普通對戰動態鏡頭與響應式場地 — 最終候選 2026-10-18

本候選依使用者最新方向：保留追蹤交戰、拉近、拉遠節奏；等比例 cover 戰鬥可視區，鏡頭及過渡都限於真地圖。允許地圖邊緣在視窗外，不再強制全圖 contain。未推送、未合入、未發布。

## 提交與整合基底

最終範圍提交以已發布音樂版本 75806702b41dbef09003e70260a2ec2398de6f24 為 parent，以獨立 Git index 建立；不 reset 或切換共用 R 工作樹。R 主工作樹仍是 main / 2c1cc29d26d375ab35c47224c75a276634dae9f2，加上既有未提交修改及本次顯示修正。

本候選是完整替代提交，包含移除鏡像副本、響應式側欄與最新動態鏡頭。它取代先前 db40c4e4 的固定全圖中間方案；整合時使用新的最終提交，不需先 cherry-pick db40c4e4。新提交 SHA 以交接訊息為準。

## 實作

- 移除地圖周圍八張鏡像／調暗副本，不新增額外地圖。
- 普通對戰啟用 boundedMap 動態鏡頭，既有 focus、sequence、punch、shake 與退回廣角流程保留。
- 每個影格重新計算最低 cover 倍率 max(viewport.width / art.width, viewport.height / art.height)，在插值後約束倍率；原生前奏、震動及 punch 組合後再作最後一次合法中心／平移範圍約束。
- 可同框的主要交戰角色使用實際動畫 cell、朝向、縮放及旋轉的可見邊界取景；VFX、地面與 native 模擬座標不變。必要時先捨棄構圖留白，再避免裁掉可同框角色。
- 分散隊伍不能同框時，沿用 staged focus 或追蹤正在交戰／最近的敵對組合；組合仍不可同框時跟隨主動交戰者，不停在空的中點，不移動模擬角色，不虛構場地。
- 直向場地加大，390×844 的場地容器約 390×475.8，canvas 約 390×472；戰況列依內容約 68px，高度內部剩白 8px，整個對戰區在可用高度內居中。舊方案約 344px 的戰況列空白已去除。
- 橫向維持 clock、雙方 HUD、紀錄與離開鈕側欄；戰場使用可用高度。轉向沿用原 Pixi Application、ticker、session 及 ResizeObserver。

## 驗證

正常共用工作樹（沒有 runtime override）的最終結果：

- 52/52 相關 Node 回歸通過；包括 960 個逐影格邊角交戰、追焦、震動、倍率與反覆 resize 檢查，另有分散隊伍、寬翼動畫 cell、接近 cover 容量的取景回歸。
- public-default 與 lagoon-r2 各 8 次同場尺寸切換：390×844 → 844×390 → 1366×768 → 320×568 → 568×320 → 390×844 → 844×390 → 390×844。
- 兩種素材合計超過 2,000 個實際 Pixi ticker 影格：露底違規 0、可同框主要角色裁切違規 0。每個 viewport 的倍率區間保留在 browser JSON，證明鏡頭仍有縮放。
- 每個尺寸實際點擊離開、再選繼續觀戰，session 保持；最後確認離開回到 RAISING_HOME。VFX 事件、座標投影、合成 safe-area 與反覆旋轉通過，page errors / missing requests 皆 0。
- Browser QA 所有請求由指定 R checkout 位元組供應；public-default 使用公開 origin 的既有映射，lagoon-r2 使用 localhost 限定 review 路由。沒有連線操控線上產品，也沒有使用個人瀏覽器 profile。
- 曾遇到另一工作正在寫入 BM05 terrain JSON 的暫時缺檔；檔案完成後已重新跑完整正常工作樹。runtime override 的中間證據不作最終驗收依據。
- Chrome headless 驗證；實體 iPhone/Safari/PWA 尚未實機驗收。

重跑：
node --test tests/championship-battle-full-arena-cases.mjs tests/championship-battle-field-scene-cases.mjs tests/championship-battle-dynamic-fx-cases.mjs tests/championship-public-responsive-layout-cases.mjs
node tests/championship-battle-full-map-browser.cjs final public-default
node tests/championship-battle-full-map-browser.cjs final lagoon-r2

## 素材版本與線上狀態

本次直接讀取線上 pages-build.json、PUBLIC_RUNTIME_INDEX.json 與 battle-original.v1.json，確認公開版本 commit 為 75806702b41dbef09003e70260a2ec2398de6f24，buildId 29b2177bb3beb90bf379a8c3ccd83aabc96b5d320fbaf6887d84fc9ed62020a7。
公開預設 BM04 仍為 art:battle:original-opus:v1：
assets/production/battle/original-opus-v1/fields/field_bm04_01/frame-00.webp
SHA256 34daac1e539da6544057feb0d38200f37d51a8ae29b4773fec62456d7628b320。
公開 metadata 實抓 hash 與 PUBLIC_RUNTIME_INDEX 的 243ef3d501ce89a1d65ce09fc55d428dbd17328fad276e085f7aa949722e1b97 相符。

lagoon R2 僅沿用 Claude 既有 localhost review 路由 ?battleReview=bm04-lagoon-r2：
art:battle:original-opus:v1:bm04-island-polish-r2
base.webp SHA256 63bfe8e326e63fe3bbae2aa40560d0e966c6e975b4725c8c34903f828ce0480e。
本任務沒有更改 main 的素材選擇、PUBLIC_RUNTIME_INDEX、manifest 或任何美術資產，也沒有把 review 提升為預設。整合時須保留當時最新核准的映射。

## Claude hooks 與共用檔案依賴

本機最終 R2 測試使用目前工作樹內 Claude 的既有 main review selector、withBattleFieldAmbient、battleFieldAmbient.js，以及 presenter 的 foreground mount、fieldArt.observe、art diagnostics、foreground disposal 與 hazard sink/grace 呈現 hooks。它們在本次修改後仍存在，沒有被覆寫；本次提交排除這些 Claude 未提交 hunks。

本次 presenter 的純顯示變更為：移除鏡像、啟用 boundedMap、可見 cell framingBounds、最後組合鏡頭約束，以及前景與地圖 local fit 同步。
整合 Claude BM04 時須保留 foreground mount 在 actors 前景層、每次既有 ticker 更新的 fieldArt.observe、diagnostics、dispose，以及 main 的 ambient wrapper；其他 battleRuntime、battlePresentationSource、bm03GroundShadows、Data Arena、hazards、terrain、美術檔均不在本提交。
只有本次顯示提交時，仍使用正式映射的舊圖與原有 VFX；R2 的水紋／泡沫／樹冠等新增效果依賴 Claude 的另外一份工作，不能以本次候選截圖冒稱已發布。

## 審圖

Library 圖片的精確 IDs 與原始檔識別資料保留於 LIBRARY_SCREENSHOTS.json。
- dynamic-lagoon-portrait.png / dynamic-lagoon-landscape.png：既有 R2 review。
- dynamic-default-portrait.png / dynamic-default-landscape.png：目前正式映射版本。
Library 保存成功；Windows 官方 metadata helper 的 os.setxattr 限制仍使本機 xattrs 未寫入，沒有繞過，也沒有因而重複建立圖片。

原始測試資料：default-browser.json、lagoon-browser.json。線上查核：LIVE_DEFAULT_AUDIT.json。
