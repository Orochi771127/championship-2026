# 互動教學 runtime 第 3 切片：完整首段 Raising，至 Gate16 前交接點

日期：2026-10-09。狀態：INTEGRATED_BOUNDED_RAISING。正常 onboarding eligibility 仍為 false；未發布。

本輪已把原本只到孵化的 preview 延伸為完整首段 Raising：邀請、特殊孵化、飢餓、餵食、三物件清理、生病治療、鏡頭操作、搬運至訓練籠1、低HP搬運至恢復籠15、傷口治療、專用睡眠，以及 SYSTEM → Hunt 提示。終點是已保存的 raising-gate-ready；仍在同一 RAISING_HOME。沒有把普通Gate0冒充教學Gate16，也沒有宣稱整個互動教學完成。

## 來源 → 契約 → 實作

沿用 docs/research/INTERACTIVE_TUTORIAL_PREDICATES_2026-10-09.md 及 INTERACTIVE_OPENING_TUTORIAL.v1.json。Evidence MCP 不可用，使用既有本機研究與有限新增 disassembly，不重做全遊戲研究。

來源 ROM SHA256：8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1。ROM、原始位元組、反組譯與 native 截圖皆 RESEARCH_ONLY，沒有放進 runtime 或這份 Library 交付。

本輪核對：
- OVL18 特殊表021283D0與普通表02128630分開；state1入口／更新02121A7C／021218F8，移動02121ADC／02121B6C。
- state5進食02121C8C..0212211C；state6搬運02122124..02122338、state7飛行021224E8..02122E90。
- state11訓練0212355C..02123C40；state15弱態021252F0、state16恢復0212553C、state17治療0212566C。
- state4專用睡眠02121C10／02121C2C，只接受原本喚醒事件；不套用普通疲勞／成長的自動醒來。
- VM021267EF..02127AB5首段與既有 tutorial-script.asm；不是按字典72句依序播放。1510仍未插入此已定位分支。

現有 nativeTutorialRaisingActor.js 使用同一 raisingActors 集合，重用既有 individual constructor、食物bite、medicine mode6、movement、hand classifier、carry/flight、cage training、reaction與動畫timeline。未新增 app、save key、router、session authority、Pixi Application或global ticker。沒有運行正常Raising FSM／growth來替代特殊教學。

## 實際操作條件

| 段落 | 實際條件與保存邊界 |
|---|---|
| 孵化 | 前三段介紹保存後，真實點蛋或180次native更新；等特殊孵化動畫完成才保存species17邊界 |
| 餵食 | 真實選取feed，再點native(100,120)各軸±12；建立真正示範食物，actor移動／進食bite，原腳本180更新後進下一段 |
| 清理 | 新鮮食物(100,120)、排泄物(160,100)、腐敗食物(80,80)各自命中；每個鎖定後>20更新，保存三位元完成mask；三個都完成再120更新 |
| 生病治療 | 實際選medicine、點中角色且病況存在；既有mode6治療與反應，等待90更新 |
| 鏡頭 | 真實選手掌並平移達原始100 native單位；手機自動取景不算完成手勢 |
| 訓練搬運 | 原有hand classifier判定持續按住後carry；release後飛行落地，確認cage1且state不為7。再至少60更新並等訓練回state1 |
| 恢復搬運 | HP置1，真實carry／release至cage15；錯籠／取消回可重試位置；後續說明還原示範HP上限 |
| 傷口治療 | 實際選woundMedicine、點中角色且傷況存在；等待240更新，再特殊睡眠命令及60更新 |
| 睡眠與Gate提示 | state4保持睡眠，SYSTEM只開放Hunt項；選Hunt後30更新保存raising-gate-ready。ACK、Battle項或普通Gate路徑不能代替 |

每次輸入均驗證當前checkpoint、tool、action、角色、畫面與保存狀態；DOM選單及Pixi手勢捕捉開始時的checkpoint。錯誤位置／工具、舊按鈕、過期手勢、重複治療或未完成清理不能推進。

手機窄畫面採同一場景的取景調整及既有edge-scroll，保持原native hitbox與坐標；提示圈只屬呈現。錯籠或取消後增加呈現revision，讓角色重新回到可見位置。沒有用縮放hitbox或改可走網格迎合畫面。

## 存檔隔離與恢復

仍是 championshipModernSave:v1；正常基底為不可變序列化rollback資料，非第二個運行中的遊戲。示範食物、病傷、HP、訓練、位置、RNG變化不寫回正常基底。普通nativeHome／position儲存路徑在preview期間停止，避免示範腐敗食物freshness=-1進入正常home編碼。

checkpoint仍為嚴格三欄位version/stage/message，版本1；stage必須字串，message上界逐stage驗證。正常legacy opening／35游標與舊存檔值保持原狀。

Continue按已保存語意邊界重建示範角色／物件／病況／等待；部分清理mask也可重建。未提交的物件操作重新做，沒有把未完成操作標為已完成。這是明確的 OWNER_APPROVED_ADAPTATION：安全邊界續教，不是重播所有先前瞬間動畫、示範profile成長或RNG軌跡，也不是原作逐frame存檔。

保存失敗時維持舊bytes、凍結actor與RNG、拒絕重入，透過既有persistence retry提交一次；退出仍重新還原正常基底。退出preview不當作完整tutorial completed。

## 驗收

**119／119 focused/regression PASS，0失敗**。含上一輪113項及6項完整Raising整合測試：
1. 全流程實際操作、逐步基底比較、專用睡眠與Gate前邊界、退出還原。
2. 錯工具／落點、stale輸入、真實bite消耗、清兩個不能前進、hand第4更新進carry、取消／錯籠、錯選單及ACK阻擋。
3. 各順序語意邊界Continue後完成Raising並退出，schema上界與可強制轉字串的非法stage拒絕。
4. 治療寫入失敗後舊bytes不變、actor／RNG凍結、retry不重複消耗。
5. 所有Raising轉換逐一注入canonical write失敗（至少45個轉換），沿同一retry owner完成。
6. 清理mask1..6依不同順序reload、未完成目標仍存在且可完成。

同輪正常孵化、生命週期、clock、save conflict／economy／autosave、Hunt normal capture、Battle transaction、Raising presentation與toolbar回歸通過。沒有為文字修改另跑無關全套。

既有127.0.0.1:8766，隔離非持久Chrome contexts：
- 繁中、英、日、泰、越均從正常LOGIN／故事／命名UI進明確preview，再完成整段Raising至raising-gate-ready，最後退出還原。
- 390×844或360×844、DPR2、有touch；餵食／清理／治療使用touchscreen事件，鏡頭／搬運使用真實pointer按住、移動、edge-scroll及放開。未使用測試捷徑跳stage。
- 英文在清理兩項後reload → LOGIN → Continue，再完成未保存的第三項；繁中注入隔離存檔失敗並以UI Retry恢復。
- 逐checkpoint正常基底一致，單一canvas，零pageerror，無橫向溢出；對話按鈕至少44px。
- 最終英文負向回歸再走完整Raising：真實放錯籠，checkpoint不變、角色回到可見起點；第二次拿起時遇畫布尺寸改變／既有取消保護，沒有進度誤推。測試辨識取消、放開並重新操作後，正確籠1／15及後段全部完成。保留resize取消保護，不讓腳本沿失效座標繼續。
- 不帶preview參數的正常New Game／Continue於390×844、360×800再次通過，維持舊入口、無不請自來的新教學。
- 人工檢視繁中睡眠、泰文終點與英文錯籠回起點截圖。不是實體手機或母語審校。

歷史 RAISING_BROWSER_FAILURE.json、FINAL_NEGATIVE_BROWSER_FAILURE.json 留在本機作診斷；最終成功以 RAISING_BROWSER_RESULT.json、FINAL_NEGATIVE_BROWSER_RESULT.json 及119項輸出為準。未刪除失敗紀錄。

## 限制與parent直接下一步

本輪完成的是首段Raising bounded preview，不是原作19個特殊state全分支／逐frame差分驗收。固定首輪訓練已測通；若特殊進化predicate意外回code1，保留 TUTORIAL_SPECIAL_EVOLUTION_REQUIRES_TRACE，不假造成功。尚未驗收特殊進化全分支、實體裝置、完整原作差分、權利或發布。

接續點：{version:1,stage:"raising-gate-ready",message:0}。
- 先接教學專用Gate16（OVL12 02114033、1527），保持普通Gate0..15不變。
- 接既有Hunt core與示範species13/21；實際rope、HP、hand collection、stun predicates，禁止normal capture Home commit吞入示範資料。
- 接回Raising後再同一Battle core：record61、mode4、species189/212/207，原選單／隊伍mask條件與回程。
- Battle loss／draw仍UNKNOWN_REQUIRES_TRACE，不由本輪勝利或安全web結束政策補成ROM_VERIFIED。
- 完整尾段要先恢復基底、原子保存completed，失敗維持隔離／retry；全正常UI完成驗收前，normalOnboardingEligible繼續false。

不需另開server、不需重新做角色／地圖，也不需重設玩家存檔。後續從現有工作樹和下列owned patch接續，保留全部協作者未提交檔案。

## 檔案與安全交接

本機工作樹：R:\Projects\Championship2026\championship-2026
本輪資料：R:\Projects\Championship2026\tutorial-runtime3-20261009
明確preview：http://127.0.0.1:8766/championship.html?tutorialPreview=raising
僅在隔離browser context驗證；New Game仍有原有覆蓋確認，不以玩家profile測試。

主要程式：
- src/championship/app/interactiveTutorialRaisingSteps.js（新）
- src/championship/raising/nativeTutorialRaisingActor.js
- src/championship/app/interactiveTutorialCheckpoint.js
- src/championship/app/championshipStandaloneApp.js
- src/championship/app/championshipToolbar.js、main.js、raisingPresentationSource.js
- src/championship/app/interactiveTutorialPreview.js
- src/championship/text/interactiveTutorialPreviewText.js
- src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js
- tests/championship-interactive-tutorial-raising-cases.mjs（新）
- tests/championship-interactive-tutorial-actor-cases.mjs（只更新已延伸邊界的available斷言）

交接證據：FOCUSED_TEST_COMMAND.json／FOCUSED_TEST_OUTPUT.txt、RAISING_BROWSER_RESULT.json、FINAL_NEGATIVE_BROWSER_RESULT.json、BROWSER_RESULT.json、RUNTIME3_OWNED_DIFF.patch、RUNTIME3_FILES.json、SAFE_CONTINUATION_CHECKPOINT.json與repo VALIDATION.json。Patch相對本輪開始前副本，不能將整個dirty tree当成本輪產出。

branch與HEAD保持 handoff/dot-continuation-20261001／1fb7d5fd21d3da47775d34ab0d3a1a95f6623972；既有server仍127.0.0.1:8766／PID38660。開始1086筆dirty status全部保留；只新增本輪檔案與有限文件更新。沒有素材、原創角色、地圖、既有五語字典、brandTerms、styles.css、觸控尺寸、玩家save或公開build inputs改動。沒有新server、commit／push／merge／checkout／reset／部署／刪除／額度重置／購買／自動儲值。Library只交付本報告，不傳研究payload。

最新額度讀值：2026-10-09 19:01:01 UTC，Codex週額度已用39%、剩餘61%。未達上限；未重置、購買或啟用自動儲值。Library ID會保存於本輪RUNTIME3_LIBRARY_IDENTITY.json與SAFE_CONTINUATION_CHECKPOINT.json；本報告為唯一雲端交付，研究與程式diff留在本機。
