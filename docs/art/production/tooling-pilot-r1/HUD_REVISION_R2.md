# Raising Home HUD 參考圖修訂 R2

日期：2026-09-06。Owner 最新指示：設計需更專業，參考照片1的明亮經營遊戲質感與照片2的原作HUD；原作籠子可多個組合；照片2內容已在美術包內。這份紀錄取代 R1「只換成銀白底」的 UI 提案與驗收數字。

## 已接入的呈現

- 依美術包 `training/training_bg_top1/background-composite.png` 與原作實際錄影對照金色切角標頭、藍色資訊條、綠色狀態槽的形狀關係。完整來源定位：[source-map.md](ui-candidate/source-map.md)。素材分區圖不是完整畫面；未把背景圖的上下分區同時拼成一個假場景。
- 原120px的大留白header縮為78px；標題用金色切角標籤，畫面保留一處可見的共用時間。內部原有time元素仍更新，但不重複顯示。
- 原有八個toolbar入口維持原順序、callback與可存取文字。加入同一圖集的手、食物、掃具、藥物、繃帶、營養品、管理、系統图示，以及Save圖示。圖示是原創重製；位置沿用既有product order，原作確切slot mapping仍未知。
- 按鈕採明亮象牙色與金色厚邊，選取／展開狀態保留綠色與暖黃回饋。圖集為1254×1254的3×3 opaque ivory atlas，158,144 bytes；初次假的棋盤透明底已拒絕並使用imagegen修正，沒有宣稱透明通道。
- Companion資訊改為緊湊藍綠姓名條、米白面板与HP/TP數值槽。沒有捏造AP、能力槽比例、任務、金錢或新功能。
- 場地周邊空白底色由深色改為淡藍綠。只改背景繪色，保留同一Pixi bootstrap／world與現有資產、角色位置。桌面共用列對齊430px遊戲欄。

實作在 `src/championship/app/intRh2Styles.css` 與既有 `createRaisingFieldPixiPresentation.js` 的背景色；新圖集登記於既有pilot manifest。Production index仍21項，新增bundle為原創內部試作，尚非Owner視覺核准／shipping ready。

## 多籠現況與本輪實際驗證

多籠渲染早已由 `main.js` 的 `layoutRanchTiles → createRuntimeMapArtTileSetLoader` 接入。它會同時載入多個tiles，並非Hunt一次只有一張field的loader。新遊戲目前的committed placements為空，所以先前畫面使用單一fallback。

本輪在獨立測試origin `http://127.0.0.1:8737` 經正常UI完成：

1. Continue → MANAGE → Cage Edit。確認已有 Cage0、Cage1、Cage15、Waiting Room，14個開放格。沒有新增資金、改ownership或注入fixture。
2. 放一個籠後BACK，重進編輯，驗證未確認draft撤回。
3. 四種籠依序放入格1–4 → Keep this ranch layout → BACK。
4. Home同時顯示四個籠子；確認後顯示待存檔。
5. SYSTEM → Save & Quit → reload → Continue → Cage Edit，四個modules與格位全部恢復；再返回Home。

DOM證據：[確認後](qa/cage-four-confirmed.txt)、[重載後](qa/cage-four-restored.txt)。最終畫面：[390×844](qa/hud-r2-four-cages-390x844.png)、[360×800](qa/hud-r2-four-cages-360x800.png)。

發現並修正：`championshipStandaloneApp.confirmCageEdit()` 原本確認新配置後不標記dirty。現在比較既有editor的committed save快照，只有配置真實改變才呼叫既有 `savePort.markDirty()`。新測試涵蓋未修改確認、未確認draft、確認新增與移除；未改save格式或storage key。

**多籠仍是部分完成。** `ranchSlotGeometry.js` 是PRODUCT_AUTHORED shelf packing；原作精確接合anchor／slot geometry仍未trace。角色和拖放區仍使用既有prototype cage regions，尚未對齊實際放置的籠子。畫面顯示四籠與配置可存回，只證明合成／編輯／保存鏈，不能宣稱原作無縫拼接或角色訓練流程已還原。此畫面的間隙與角色尺度也不應被當成最終美術完成。

## 驗證結果

- 全部Node tests：1,098 PASS / 0 fail，`qa/regression-hud-r2.log`。最後背景配色調整後重跑相關HUD／Cage／toolbar：28 PASS。
- Cage focused：12 PASS，包含新增dirty回歸。
- 素材hash、Aseprite原生像素往返、Blender共同投影與未裁切：`python scripts/verify-tooling-pilot.py` PASS。
- A0 index validator / generator `--check`：PASS；`git diff --check` PASS。
- 五種手機尺寸與1280×800桌面：沒有橫向溢出、場地沒有壓到companion、只有1canvas；header78px，8個工具按鈕62px高。requested393×852實際回報394×852，不能稱為精確393測試。
- System submenu／HAND選取／Save & Quit／Continue均由正常UI操作。console warning/error 0。沒有 physical-device QA。

安裝成果仍見 [工具安裝紀錄](README.md)：Blender4.5.13LTS已安裝；Aseprite既有授權安裝已驗證；可編輯M201 study檔與Aseprite檔已保存。Blender代理模型不適配M201，沒有新增已接受角色master。

下一個安全的原作還原步驟：追證多籠的接合座標與角色活動區映射，再把同一套world transform接到居民與輸入。UI後續擴展應逐畫面讀取美術包與可達性證據，不將照片1的咖啡店功能移植進本產品。
