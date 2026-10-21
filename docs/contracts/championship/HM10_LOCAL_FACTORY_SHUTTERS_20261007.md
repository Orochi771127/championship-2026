# 工廠既有逃跑入口捲門 — 本機候選 2026-10-07

依 Owner 23:02／23:03 UTC 授權實作。倉庫 family r2 是獨立已保存的 Blender 視覺候選（Library `libfile_2ae6ce7c68848191b5903ef3ac1c7d0d`），本捲門功能使用目前正常本機 original-opus 工廠素材，沒有把缺 depth/occluders 的倉庫候選接入。

## 已接入

本機網址加 `factoryShutters=r1` 才啟用，只綁 HM10 既有兩個入口。原生錨點為西側(15–16,101)、東側(79–80,65)，每格8 native px。門、門框與室內暗面是獨立 Pixi 圖层，使用既有唯一 ticker；門葉160ms開啟、220ms關閉、無佔用後保留120ms，皆為核准的呈現改造，不是 ROM 原始門動畫。每個可見角色都參與佔用判斷，收取尚未隱藏及多人同入口不會提前關門。中斷／長暫停／重新進場丟棄舊運動狀態；近門角色會安全開啟。

原有兩格導航通道、碰撞、AI/RNG/工具/存檔不變。視覺門洞56 native px，以正常比例m301實測，沒有縮角色配門。門洞像素只從 runtime depth pieces 投影扣除；背牆取當前原有地圖影格的同位置像素，補不透明遮擋、跟隨原有三幀圖像切換。沒有改 atlas、地圖影格或來源場景，沒有額外 Blender 渲染。

## 狀態機查證

`nativeWildActor.js` AI8 呼叫 `nativeHuntEscapePosition`，抵達 escapeBoundary 後按既有 RNG/掃描規則跳至另一個 escapeAnchor，返回 AI1待機。沒有「入洞停留多久」或新增玩家控制躲藏狀態。本批只呈現這條既有流程，不把裝飾倉庫門當入口。倉庫r1中央兩扇 closed-service-shutter 仍是裝飾，地面門形有被誤認為入口的風險；family r2沒有再新增裝飾门。

## 實測

- 52/52 受影響檢查通過：捲門多人／中斷、遮擋裁片、原生移動／方向／生成、捕獲回家Save/Continue及呈現權威。
- 正常瀏覽器720×960，獨立新測試存檔（只設入場資格、金額與新遊戲時計12:34:02）；Continue→工廠→裝繩→實際圈繩。原生生成的原創m435/species164進東門、轉移至西側錨點。捕捉到OPEN→CLOSING→CLOSED。深處同一角色節點（身體、影子、選取圈）隱藏前後0像素差異，原有AI稍後活動至西側洞口。返牧場和同圖重進成功、兩門關閉且無舊佔用。
- 受控Pixi18個基礎畫面驗證進入、深處、出現、多人、收取可見階段、移除。m301/m454左右方向、m301抬升，兩洞×三環境影格共30組，深處0像素差異。這些是受控呈現，不充當正常AI路徑。
- 首輪有真實背牆漏影：m301全地圖擷取1467px；改局部solid後viewport仍20／2px，最後用原影格不透明背蓋降至0。失敗回條保留。測試fixture相對路徑404及favicon問題已修。
- 一項舊呈現測試只抓雙引號import且漏列既有foliage，已改為辨識兩種引號並明列7個呈現依賴，保持禁止另一Application/ticker/存檔或domain控制。

## 盤點與續作

16種正式Gate、32日夜Hunt索引、29份環境。27份有2或3組內部anchor；海岸HM06日夜都0組內部anchor、只有場邊出口。`R:/Projects/Championship2026/handoff-review-20261007/factory-shutters-r1/ALL_GATE_ESCAPE_INVENTORY.csv`逐份列資料。除了此HM10路徑，這份新盤點不宣稱其他圖已正常實測；先前同版本有效收據保留，不重做或升格。

1. Parent/Owner複核門的外觀與開關節奏；目前為功能性本機候選，未預設啟用／未發布。
2. HM06若要內部躲藏需明確的入口與導航改造決策；目前不補造新錨點。
3. 其他環境依實際版本逐批補正常通行、遮擋與角色體型；實體手機、不同browser/GPU、全角色及真正捕獲中斷browser情境尚未全驗收。
4. 倉庫family視覺接受後才另外產出匹配depth/occluders及三影格；不借用目前基線遮擋宣稱新倉庫可出貨。

私有回退原檔位於`R:/Projects/Championship2026/handoff-review-20261007/factory-shutters-r1/rollback/`，本批窄差異 `OWNED_DELTA.patch`、最終源檔 `source/`、SHA與證據皆附。回退須逐段套用本批差異，不整檔覆寫其他代理後續工作。未commit/push/deploy、未觸碰玩家正式存檔。

本次QA伺服器：127.0.0.1:8796；獨立受控畫面 `/tests/fixtures/championship-factory-shutter-review.html?factoryShutters=r1`，正常遊戲 `/championship.html?factoryShutters=r1`。這是local候選，非正式網站連結。
