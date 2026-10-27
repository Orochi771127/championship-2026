# 雙模式對戰 UI/HUD 重構報告（2026-10-28）

> 依 [Owner Direction 2026-10-28](../../coordination/OWNER_DIRECTION.md) 執行，分類為 OWNER_APPROVED_ADAPTATION（呈現層）。
> 戰鬥邏輯、計時、傷害、獎勵結算與存檔完全不變；首頁與六角籠舍沒有任何修改。
> 所有測試依賴的 id、class、`data-*`、按鈕文字與事件綁定都保留。只有對手頭像徽章 `cm-vs5-match__crest` 等是新增元素，沒有改名任何既有元素。

## 範圍與做法

### 選擇對戰（`vs5Screens.js`、`ui/arcade.css`、`ui/screenLayout.css`）

- **返回鍵穿模：**
  - 成因：sticky footer 在 arcade 主題被設成全透明（`arcade.css` 舊規則），卡片直接從「返回牧場」下面露出。
  - 修正：footer 改成實心網點底欄，列表底部預留 `calc(92px + safe-area)` 的空間。
- **`[hidden]` 失效：**
  - 成因：`.cm-vs5-data-arena` 與 `.cm-vs5-action` 本身的 display 規則會蓋過 `[hidden]`。
  - 修正：補上 `[hidden]{display:none !important}` 防護。
- **數據競技場入口：**
  - 電光青與霓虹紫的斜切裝甲框，加 3D 底座與掃描光。
  - 「⚡ LIVE ACTION」徽章以 `data-badge` 屬性顯示，按鈕原本的文字不變。
- **3D 立方體：** 後方加靜態聚光燈光暈。立方體不自轉，對應的測試照舊通過。
- **六個模式鈕：** 改成 5px 硬底鍵，選中時下沉並亮起霓虹外框與頂部 LED。
- **對戰列表改成 VS 門票卡：**
  - 左側是對手剪影徽章。頭像取自圖鑑既有核准的縮圖，以黑色剪影顯示；沒有縮圖時只顯示 VS 標記。
  - 名稱放大，報名費做成膠囊，金色賞金徽章加上箭頭。
  - 卡片有發牌入場動畫，點擊時有果凍回彈。
  - 名稱改包在 `cm-vs5-match__title` 裡，按鈕的可讀名稱完全相同。

### 多輪賽事（arcade 主題 CSS）

- 拿掉佔版面卻沒內容的大外框，改成兩張聖盃卡匣：冠軍大會用白金／翡翠框，世界大會用黑金／紅蓮框。
- 獎盃放大並加上金屬底座，輪數與獎金做成立體獎牌標籤。
- 未開放時，以鎖定能量條顯示原因。

### 數據競技場（`dataArenaScreen.js`、`dataArena.css`、`dataArenaPixiScene.js`）

- **幽靈文字：**
  - 成因：那些字是局內觸控鈕的初始標籤「2／3／4／終極／衝刺」。觸控層在大廳也一直顯示，而標籤的 `z-index:1` 在根疊層裡壓過了選單，還會吃掉拍檔卡的點擊。
  - 修正：每顆按鈕自成疊層，選單層提高到 z5，非對戰狀態下隱藏觸控層。
- **出戰鈕遮卡：** 內容改放進獨立捲動區 `da-panel__body`，出戰／返回成為下方的實心固定底欄。
- **大廳：**
  - 模式卡選中時亮起琥珀金與電光青雙框，加上角標。
  - 拍檔立繪下加全息底座光環。
  - 數值條改成分段霓虹格。
  - 每張卡加上專屬技能膠囊列。
- **扇形拇指技能輪（接力對戰）：**
  - 普攻 76px 在角落。內環 r=106，放 s1／s2／s3（180°／135°／90°）。外環 r=182，放衝刺（160°）與強力技（112°）。
  - 色標：普攻青、技能依拍檔屬性、強力技金紫、衝刺疾風藍。
  - 冷卻改成扇形倒數，由兩片半圓旋轉組成，只用 transform。
  - 強力技就緒時有呼吸光環；按下時 40ms 下沉，並觸發 `navigator.vibrate(8)`。
  - 換角依 Owner 選擇留在左側搖桿上方，加上後備拍檔血量條與冷卻扇形。
  - 搖桿改成八方位刻度盤加搖桿頭。
- **頂部 HUD：**
  - 生命條加上白色延遲殘影：主條立即扣除，殘影 400ms 後收縮。
  - 後備拍檔顯示成雙槽膠囊。
  - 對手血條加深色裝甲、威脅標記、受擊閃白與殘影。
- **戰術網格：** 在既有 Pixi 場景裡用一個靜態 Graphics 繪製，每 4 格一條線，加邊界刻度，只畫一次。

### AI 自動對戰（`vs5Screens.js`、`battleFxLayer.js`、`battleFxLookups.js`、`arcadeFx.js`）

- **載入：**
  - 載入卡改成 VS 對決看板：雙方名稱與 HP/TP（取自同一個 frame）、場地徽章、分段充能槽。
  - 「正在準備對戰場地…」與「N／5 項完成」照舊保留。
- **開戰！：**
  - 原生 READY／FIGHT 的時序不動。
  - FIGHT 字樣改成 46px 金色，縮放曲線 2.2→0.9→1，加一次放射速度線。
- **雙方面板：**
  - 改成陣營裝甲框：我方翠綠／電光藍，敵方赤紅／暗紫，底色不透明，不再和圍欄柱子穿模。
  - 外層容器仍維持透明，且不接收點擊。
- **陣營光環：** 在既有的 FX 地面層畫雙層光環，我方綠青、敵方紅橘。用 `localTeam` 判斷陣營，所以通訊對戰也正確。
- **絕招切入：**
  - 底部實況字幕匣有陣營色邊。
  - 發動絕招時出現「⚡ 絕招！」徽章，加彈簧切入與流光；比賽結束時清除。
  - 受擊方的面板會微震，並跳出傷害數字。數字是既有的粗黑邊拋物線浮字。
- **離開對戰：** 改成深色立體戰術鍵，仍維持 ≥44px。

### 勝利頒獎台（`battleResultCharacters.js`、`main.js`、`createHighlightBurstThree.js`）

- **偏左的成因有兩個：**
  - 原作的站位錨點（slot 0 = 46,151）本來就在左側。
  - 新參數 `layout` 被函式內同名的 `function layout()` 宣告遮蔽。這點已修正。
- **新增 `layout:"podium"`：**
  - 1 隻置中，2 隻並列，3 隻是中央加兩翼。
  - 以角色實際外框置中，大型角色也不會偏移。
  - 經典主題與預設值仍使用原作錨點，原有測試照舊。
  - 新增一項頒獎台單元測試。
- **蓋臉的白色方塊：**
  - 成因：highlight 的 back 層在角色之上，裡面有近白的 Three 碎片與頭頂階梯標記。
  - 修正：角色移到 z2、高於 back 層，碎片改在角色後方噴發，調色盤移除純白，階梯標記移到側邊。
- **版面：**
  - 「一方全員倒下」膠囊，加上金色浮雕的「🏆 我方獲勝」，有彈簧過衝。
  - 中央是聚光錐與全息底座。
  - 下方是金色戰利品橫欄，數字 pop 加流光。數字不逐字跳動，因為測試會讀取正確值。
  - 「下一頁」改成 62px 的大鍵。

### 順手修正的既有錯誤

- **數據競技場整個 HUD 會停止更新：**
  - 位置：`dataArenaPixiScene.js` 在拍檔沒有進行中動作時讀取 `null.releasedAt`。
  - 影響：場景 render 拋出錯誤，之後的 HUD 更新都不再執行（`DATA_ARENA_FRAME_FAULT`）。這是 `f7b3a387` 留下的問題，在 main 上會讓 `championship-data-arena-browser.cjs` 停在「2 鍵施放」那一步。
  - 修正：加上一行 null 防護。
- **開場覆蓋層 class 重複：** 開場覆蓋層原本共用 `cm-vs5-field__loading`，讓「載入卡已消失」的檢查永遠不成立。現在改成獨立的 `cm-vs5-field__opening`。

## 效能與無障礙

- 新動效只用 transform 與 opacity，沒有 `backdrop-filter`、`transition: all`、`ease-in-out` 或 blur。
- 長時間循環的效果都放在偽元素上，按鈕本身的方框不會動，所以輸入閘門看到的目標是穩定的。
- 沒有新增 rAF、ticker、Pixi Application 或 WebGL context。光環與網格畫在既有的 Graphics 上。
- 減少動態（`[data-motion="reduced"]` 與 `prefers-reduced-motion`）時，會關閉掃描光、切入、呼吸、震動與過衝。
- 數據競技場在低畫質下原本會關閉所有 CSS 動畫。這次只例外保留殘影條的一個 transform 轉場。
- 所有觸控目標維持 ≥44px，接力觸控鈕 ≥48px。

## 驗證

| 項目 | 結果 |
|---|---|
| `npm run test:ci` | 2,999／2,999 通過（含新增的頒獎台測試） |
| `championship-data-arena-relay-touch-browser.cjs`（320×568、390×844、430×932、844×390：8 鈕 ≥48px、距邊 ≥8px、不重疊） | 通過 |
| `championship-data-arena-relay-browser.cjs`、`-relay-map-browser.cjs`、`championship-battle-cube-browser.cjs`、`championship-responsive-battle-browser.cjs` | 通過 |
| `championship-data-arena-browser.cjs` | 44 項中 43 項通過；手機段另以探針版完整跑完 58／58。唯一失敗是「raising 存檔欄位不變」，基準 main 加上同一行 null 修正後也同樣失敗，屬既有問題 |
| `championship-ui-integration-browser.cjs`（貨幣 8,000,000）、`championship-vs2-browser.cjs`（狩獵入口裁切）、`championship-map-test-release-browser.cjs`（期待首頁有競技場入口）、`championship-responsive-followup-browser.cjs` 與 `championship-mobile-stress-leak-browser.cjs`（狩獵入口逾時） | 基準 main 失敗位置相同，屬既有問題 |
| `championship-owned-battle-browser.cjs` | 新版與基準 main 都在 300 秒逾時，屬既有問題 |
| `build:playtest`／`validate:playtest` | 通過：8,283 個檔案，建置 `222880c6…`；只更新了 13 個修改檔的發佈雜湊（`WEB_BUILD_INPUTS`、`PUBLIC_RUNTIME_ALLOWLIST`） |
| `championship-battle-full-map-browser.cjs`（建置產物：浮動 HUD 幾何、10 個場景） | 通過 |
| `championship-battle-entry-diagnostics-browser.cjs`（建置產物） | 載入卡在 ready 後歸零、Pixi 與 Three 畫布各 1 個、WebGL context 恰好 2 個，都通過。「進入對戰後存檔位元組不變」這項失敗，基準 main 也同樣失敗（基準本來更早就停在重複的載入卡，這次已修正） |
| `championship-alternate-form-browser.cjs` | 需要本機已編譯的 QA 資料夾（`.tmp/alternate-form-compiled-qa`），這個檢出沒有，未執行 |

截圖都在 390×844 直向、觸控、DPR 2 下拍攝，存放於 `screens/`，`before-*` 與 `after-*` 一一對照。

## 工具無法驗證的部分

- **實機：** 沒有在實機 iPhone 或 Android 上驗收。觸覺回饋只有 Android 會生效。
- **軟體算繪：** headless Chromium 使用 SwiftShader，幀率數據不代表 GPU 效能。
- **獎金數字：** QA 存檔的錢已達上限，所以結算畫面顯示「獎金 + 0」；獎金數字的 pop 只在程式碼層驗證。
