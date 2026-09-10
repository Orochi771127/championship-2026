# Battle R11 — 可見 2D 特效與原作命中後段

> 2026-09-08 R12 更正：本頁的 16 張圖片是 imagegen 生成的原創替代圖，不是原作像素。Owner 要求改用已提供的原作特效後，該圖包已退出預設並標記 retired；本頁保留為歷史紀錄。現行本機研究预覽使用原包 151 bank／1,231 cell，見 [R12 來源與驗證](../battle-effect-r12/IMPLEMENTATION_2026-09-08.md)。本頁命中後段程式與 ARM 對照證據仍沿用，圖片與後續補原創 cell 的建議已被取代。

本輪完成正常選招到可見投射物、命中子效果、物件清除的增量實作。沿用 R10 的151 bank /484 sequence /1231 cell /496-slot pool，不重新解碼或重做碰撞與動畫時間。整體遊戲與全招式符合度仍為 **PARTIAL**。

開工確認：`R:/Projects/Championship2026/championship-2026`、`main`、HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。共享工作樹有既有修改，本輪保留；未 commit/push/deploy。

## 實作結果

- **16張原創效果 cell、7個原生 sequence 的圖片對應**：bank19 三段能量彈／速度碎片／火花；bank81 扇形能量脈衝；bank1 sequence30火焰、36斜向火光、43通用命中光點。16是圖片小格數，並非16招或全部特效。
- `battleEffectArt.js` 透過現有 production index 登錄檢查載入一張1254×1254透明圖，16個Texture共用一個source；離場釋放一次。圖片RGBA解碼約6MiB，沒有第二個資產管理器。
- `battleEffectSprites.js` 使用現有 `nativeLifecycle.effectActors` 的cell、Q12座標、高度、旋轉、正負縮放、兩軸翻面、alpha、RGB555。加入既有角色深度layer，共用場地鏡頭與ticker。重畫不推進動畫；同位址的新物件以serial ID區別；缺圖移除舊sprite並記錄 `missingCells`。
- 正式 `main.js` 與獨立測試場次使用同一個載入器與場景。新素材進本機runtime review，`humanApproved:false`、`shippingReady:false`；沒有將新ROM圖片複製進production。
- **D95C..D99C**：接觸成立後，依原作更新action+10、world+47884計數，讀取world+47888舊索引偏移；零count也保留原始讀取行为。
- **DA0C..DF20**：命中結果2的第二層2D火花依owner species<=133選012C，否則0124，套用目標變換後cell中心與偏移；970保留secondary actor，與field44 actor分開。受擋結果1的指定腳本轉入012E /0212F94E；kind5、拒絕結果、4個aux忙碌、24子槽額滿與配置失敗依原分支处理。Owner+94鎖定時寫入mode3。
- field44與受擋aux的六參數帶入有號位移，子腳本立即執行並繼續使用原aux生命週期。特殊prelude02120900的secondary3D要求接到既有impact service；完整3D矩陣呈現仍未驗收。
- production index舊測試的固定21筆改為登錄表統計與唯一ID檢查，另驗證新bundle身分。後續追加素材不需再修改固定數量。

## 原作與美術證據

ROM SHA256 `8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`；OVL19 SHA256 `d660e3e0bf243541c356c54dcbd1aec58e8df6c2dfaf4a5854d375a5f2d13715`。

先查 championship-evidence：`e003_kikanzyu00`找到 `research-only/YDIJ_FULL_ROM_DECONSTRUCTION_2026-08-29/analysis/ROM_FILE_CATALOG_6419.csv:674-676`；D740 literal查詢沒有結果，因此直接使用既有 `_archive/battle-presentation-r4/ovl19-all.asm` 與相同hash ROM的OVL19指令，不以產品程式推斷原作。新oracle見 [BATTLE_IMPACT_CONTINUATION_CPU](../../../research/BATTLE_IMPACT_CONTINUATION_CPU_2026-09-08.json)。

美術研究只目視 private pack 的 `08_FULL_FAMILY_CONVERSION/common/e003_kikanzyu00`、`e003_H_Knuckle`、`e003_battle`；新图是imagegen從文字描述生成，未提交原作圖片。原始輸出、完整prompt與crop處理見 [generation receipt](IMAGE_PROMPT.md)，尺寸／alpha／hash見 [asset QC](asset-qc.json)。數值時間沿用原作；新圖的形狀細節、origin與視覺比例仍待人工比對，不宣稱逐像素還原。

## 驗證

- **192個新增控制案例**：64個offset ring、128個命中後段組合，JavaScript結果逐一比對原ROM ARM執行輸出。比對配置編碼、position、active、mode、24子槽、aux ownership、970指標、子腳本地址及六參數。Allocator、目標box讀取、VM執行、3D服務為控制邊界；不是完整ROM對局。
- **Focused 45/45**：`reports/battle-effect-r11-focused.log` 23項；`reports/battle-effect-r11-continuation.log` 22項。
- **Regression 1240/1240**：`reports/battle-effect-r11-regression.log`。第一輪僅舊固定bundle數21失敗，改成登錄一致性檢查後全數通過。此後只有文件與fixture結算診斷變更，後者另經瀏覽器驗證。
- `git diff --check`通過；新檔案另檢查尾端空白。Normal receipt的12個source hashes均與目前檔案一致。

四場以正常AI從clock0選招，結果見 [normal-runtime.json](normal-runtime.json)：

| 場次／seed | 結算clock | 勝方 | 2D產生／釋放 | 既有3D服務產生／釋放 | 復起 |
|---|---:|---|---:|---:|---|
| 0／20 | 582 | 我方 | 14／14 | 11／11 | 無 |
| 1／12 | 1983 | 對方 | 66／66 | 78／78 | 我方slot0、對方slot3各54HP |
| 1／16 | 1729 | 我方 | 63／63 | 82／82 | 我方slot0回復54HP並繼續 |
| 1／21 | 2136 | 對方 | 52／52 | 85／85 | 對方slot3回復54HP並繼續 |

四場的clock、勝負、復起清單與終場角色狀態和R10對應receipt完全一致；四場合計195個2D實例全部釋放，結束後每場496個空閒槽、0個active launch，沒有未載入bank。尚未綁定的host仍是既有音效0203EA30，參數0/127/0尚缺原lookup table。

## 瀏覽器結果

使用正式battle module的獨立記憶體fixture，以公開按鈕推進正常AI；沒有寫入使用者存檔。

- 390×844、seed16、clock914：投射物命中1次、6個活躍2D實例，其中4個非零縮放可顯示；已看到新增通用光點，`missingCells=[]`。同pool中scale0物件依原值保留不可見，未強制放大。clock920已切換19:1/19:3並清除前物件。證據：`browser-projectile.json/png`、`browser-flight.json/png`。
- 320×740、seed16、clock1501：正常復起54HP；已走過能量彈、扇形脈衝、六幀火焰等15個cell，當下54產生／54釋放，缺圖0。最後clock1729結算，fixture金額9400→27400。
- 320×740、seed12、clock962：扇形光束展開可見；`browser-320-fan.json/png`。新分頁起初使用桌面寬度，保存前已重新套用並確認 `innerWidth=320`、`innerHeight=740`。
- 新分頁seed12結算clock1983：**66產生／66釋放、可見sprite與native pool皆0、free496、缺圖0、JavaScript errors0**，fixture金額9400。見 `browser-320-final.json/png`。測試早期fixture曾有相對路徑404，已改用document.baseURI；此最終乾淨分頁沒有該錯誤。
- 兩種手機寬度沒有水平溢出。這是瀏覽器尺寸模擬，實體裝置尚未驗收。

## 後續直接沿用的成果與缺口

1. 保留現有pool、7個sequence圖片對應、共用圖載入器與192個新增ROM對照案例。新增bank只補manifest/cell原創圖；不重新搭戰鬥框架或重做151組數值解碼。
2. 優先补其他共用cell，例如0124→bank1 sequence35、受擋012E→sequence45，以及文字效果142的DOM呈現契約。未收錄的cell維持明確診斷，不能任意換成通用火花。本次seed21可要求sequence46，尚無其文字圖／DOM呈現。
3. ADEC的完整3D矩陣／anchor、secondary3D模型實例呈現、特寫VM同步與音效lookup/播放仍需補齊。現在secondary3D已送入服務；既有overlay仍只暖載兩種normal hitspark，不能把新增服務事件當成完整可見3D演出。
4. 全224角色／各招正常參戰驗收、自有角色正式三人隊與養成數值、養成／狩獵／捕獲／進化動作仍未全部完成。素材review、玩法符合度、人工QA、裝置與shipping維持各自狀態。

本輪沒有安裝新軟體；既有工具已足夠。沒有新增router、store、save、Pixi Application、global ticker或跨專案依賴。
