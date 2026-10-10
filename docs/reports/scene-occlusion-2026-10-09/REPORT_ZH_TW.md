# 地圖遮擋小批次：檢查與最小修正

HM10 已修正大型角色在東、西門兩側牆面漏出武器／翅膀的可重現呈現缺陷。僅修改 `huntFactoryShutters.js`：R3與最終本機稿在既有左右遮擋邊緣，各補64×128世界像素的實心牆面條帶，使用當下背景同一影格的原像素。門洞112×64、開閉機制、角色大小、native AI、走格、時間、RNG均不改；舊r1 candidate不套用此修正。沒有新增計時器、Pixi Application、素材檔或全域模糊。

## 檢查與證據

- HM01最終day `field_hm01_01`：small species008／medium034／large218，依真實grid找合法繞樹路徑。每種前／側／後3點，共9個controlled畫面，背景／遮擋phase一致。前後路徑不能直穿樹下阻擋區；未改網格。小、中角色在合法路徑幾乎不與樹冠重疊，大型只有局部重疊，因此這是有界通路檢查，不是所有樹冠遮擋PASS，沒有據此修改renderer。
- HM10最終R3：同3種尺寸×東西2門×門外／門洞／門內3點，共18個修正前及18個修正後controlled畫面；所有路徑點位使用現有可走grid。每場使用同一既有stage／ticker；fixture只控制位置，不宣稱native AI自然穿越全尺寸。
- 最後grid核對找到早期fixture門外起點1744／1168落在欄杆阻擋格；僅修測試起點為1740／1164，重新取得完整兩門對照。早期資料保留但不作合法通路證據，最終以 `legal-before/`、`legal-final/` 為準。
- 修正前大型深處畫面的可見角色差異像素：西1249、東1232；修正後兩門及3尺寸均0。門洞仍能看見角色，門外small／medium／large差異像素數保持原值。逐張看過兩門大型before／after；沒有把atlas透明外框大小當角色實體。
- 初次只把附近atlas pieces改solid的瀏覽器候選不能消除缺口，未寫入產品；最後只補已核對為牆面的兩条64×128色彩條帶，不增加涵蓋屋頂上方地面的整塊矩形。保存候選證據以說明修法選擇。
- 相關3檔node測試21／21，含素材hash、atlas裁切／影格同步、透明剪影／深度、portal gating／開閉與釋放。沒有跑全遊戲。
- 修正後隔離canonical存檔 → 正常Continue → Gate／loadout → HM10 native野生角色自然活動 → 正常回育成。390×844 DPR2桌面Chrome，11份runtime觀察、背景與遮擋phase同步、零pageerror／fallback／drift；回育成canvas可見，Hunt disposed=true。這補齊前批錯誤DOM selector造成的不完整離場斷言，不是修復一個假設的回程產品bug。

證據根目錄：`R:\Projects\Championship2026\scene-occlusion-followup-20261009`，包含CONTROLLED_RESULTS、FINAL_PIXEL_CONTRIBUTION、legal-final/、hunt-normal/HM10/RESULT、before副本及scoped diff。背景／角色畫面只在本機由Codex查看，未宣稱parent或實體手機驗收。

## CM24／CM03：最小dot需求

兩张最終平面稿已接入，不能再拿舊圖或舊master覆盖：

| 項目 | 目前最終圖 | 可用source | 仍需交付 |
|---|---|---|---|
| CM03 | r18，1152×800／native288×200，SHA256 `b757e18558a44b0f2ebd3052ae9de508258cff9b4670fe3b8215fb55bf6d70df` | 本機r18 master.blend已核對SHA256 `9b5d847bc91c587413be5baf600501ab60820517a05742a4a53af13a8cf297f0` | 直接由既有master分出可能在角色前方的跨欄、跳高架／橫桿／墊、錐筒、燈柱／看台等透明物件層；不重畫平面跑道 |
| CM24 | `CM24_SHRINE_REARRANGEMENT_R1_20261008`，384×448／native96×112，SHA256 `601b05420d77f23fdc1dea75323ed350a85f11bb28068b77212c922989dd6146` | 找到的opm-opus-r3 master hash正確但屬舊版，不能取代重排版 | 取最終重排master，或與該最終圖逐像素對齊的中央像、左右柱、祭壇／奉納箱／香爐前緣、燭台透明層 |

每層至少：PNG/WebP alpha、來源最終圖hash、原圖座標／尺寸、pivot、接地底邊或depth row、穩定object ID；多個物件不同底邊時分開。CM03依既有r18 selectors即可，不需再搬19包完整來源。CM24優先核對最後重排稿，先不要求動畫重製。

現有 `source-object-animation-contract.json` 保存CM24的5個來源物件、cell0..5／raw ticks15，但 `runtimeEligible:false`、`clockHz:null`、`loopModeInterpreted:false`；它是來源資料，不是現成alpha mask、最終重排depth或運行時時鐘。`CAGE_FIXED_SOURCE_PHASE_AND_OBJECT_CELL_CONTRACTS.json` 的CM24仍指向舊r3。不要據此開新動畫timer。

目前Cage manifest是flat單frame，無depthOccluders；Raising foreground空，不能把整張底圖抬到角色前。沿用 `raisingCageArtPlan.js`：CM03現有上24 native／96 raster裁切、CM24僅上排裁切，網格不變。此批沒有改Cage素材／步行規則，也沒有把前批未成功選手工具的拖放嘗試提升為PASS。

## 來源、安全與剩餘

使用現有final-intake manifests、occluders.json／atlases、nativeHuntSceneSources、huntDepthOccluders／huntFactoryShutters、Raising cage plan，以及 `intake-20261009/verified-payload` 兩Cage索引／contracts。HM10 source checkpoint包本輪再核對13,659,765 bytes、SHA256 `d4caf3147f755a961985e5d6eda4c0b89fc01c46fa38b0eb49b025d565b5508a`；沒有使用10月7舊包或覆寫交付美術。

保持協作者既有改動、同一HEAD／分支、8766 PID38660；無commit／push／merge／checkout／reset／部署／刪除、新伺服器或玩家存檔操作。不重試Library，沒有成功傳檔宣稱。m401／m503按Owner維持原稿，m535單頁162MiB基底RGBA估算的手機風險未關閉。未完成：CM24／CM03前景層交付與接線後動態QA、HM01全物件覆蓋、實體手機、母語與公開發布。31%額度讀值未到上限，沒有重置／購點／自動儲值；不自動啟動下一大批。
