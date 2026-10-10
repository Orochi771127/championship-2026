# 互動教學 runtime 第 2 切片：特殊孵化 actor 與五語 preview
日期：2026-10-09。狀態：INTEGRATED_BOUNDED。正常 onboarding eligibility 仍為 false。

已接好可實際操作的一段：明確本機 preview 新遊戲 → 邀請 → 接受 → 1495／1496／1497 → 點蛋或等待180次原始更新 → 特殊孵化動畫 → species17、state1 → 保存 raising-hatched／1498。可重載接續，也可退出預覽還原正常起始牧場。這不是整個 Raising／Hunt／Battle 教學完成。

## 本輪實作
- 新 nativeTutorialRaisingActor.js 接在既有 raisingActors owner。同一 actor、既有 character timeline、同一 Pixi Application／ticker；沒有第二個模擬或角色集合。
- 原生特殊表021283D0的state18（02125788／02125814）與state1入口02121A7C：初始(128,96)、state18；收到0x9B後播sequence1，等動畫完成，透過既有 constructNativeIndividualForm 固定建立species17並保留名字，再進state1。
- 初始介紹不能令正常egg年齡／三次點擊邏輯推進。只有介紹三段已保存後，符合點蛋或180次native update條件才送孵化指令；沒有用延遲ACK代替predicate。
- 新嚴格安全checkpoint raising-hatched,message0。保存成功前仍公開上一個checkpoint；孵化保存失敗會凍結待重試，不能重複建立個體／再耗RNG。中途重載回到已保存蛋邊界；孵化後重載由正常基底重建相同示範profile／RNG。此續教政策仍為OWNER_APPROVED_ADAPTATION。
- 正常Raising操作在隔離期間受保護。新增 exitInteractiveTutorial(expectedCheckpoint)，沿用slice1的hydrate／基底投影／每次失敗退出重試重新還原策略；不把退出當completed。
- 同一showChoiceDialog／焦點層提供五語preview；1495–1498讀現有五語tutorial dictionaries，品牌aria名稱讀brandTerms。既有字典、brandTerms與styles.css未改。新增preview控制文案使用現有locale owner。
- preview入口只在loopback且明確帶 tutorialPreview=raising 時，對本次New Game提供邀請。正常URL不邀請；Continue既存v2checkpoint會恢復preview。畫面明示「預覽」及目前只到孵化，沒有宣稱正常完整onboarding。
- DOM對話和Pixi pointerdown都捕捉expected checkpoint；移除／重建的舊對話按鈕或stale手勢不能推進。Escape可保留當前checkpoint，透過preview繼續鈕重開；保存失敗可沿用原persistenceFacade.retry。
- raisingPresentationSource及main日曆訂閱偵測session身份變更：解除舊session listener，綁定hydrate後的新session；view unsubscribe也清理新listener。教學對話使用AbortSignal解除舊對話與locale listener，不留舊view引用。

## 修正瀏覽器驗證抓到的實際缺口
第一次點蛋測試雖然最終孵化，但加上「必須在180次等待門檻前完成」斷言後失敗：工具列預設selectedTool=null，點蛋其實未送出hand操作，後來是等待路徑完成。
已修正教學工具初始化：既有toolbar在本段鎖定手掌、禁止其餘7格及取消工具，退出時還原先前工具與可用性；源腳本02126806起原本就停用1..7。UI鎖定只是輸入呈現，actor仍獨立驗證checkpoint／角色與動畫predicate。增加真實觸控必須早於等待門檻完成的斷言，避免把自動等待誤報成點擊成功。

## 實際驗收
**113／113 PASS**，含上一輪61項、10項新增actor／恢復／訂閱／ticker測試、2項工具限制測試，以及受影響的正常孵化、生命週期、clock driver與Raising presentation回歸。上一輪14項保存／隔離測試全數保留；其中「孵化未實作」斷言更新成「ACK不能代替孵化predicate」。

新增負向／恢復檢查：
- 未完成介紹、錯誤角色ID、缺少／過期checkpoint、重複點擊皆不能觸發。
- 179次更新仍是蛋；180次才送指令；動畫完成前不保存已孵化。
- 孵化途中reload、孵化後reload、孵化保存失敗＋retry、孵化後退出失敗＋額外資料變動＋retry。
- 名稱、正常角色／庫存／金錢／圖鑑／RNG等基底保持一致；只有預期保存版本與教學checkpoint不同。
- 舊session listener歸零，新session listener只留一份；停止view後新listener亦歸零。
- 原本ticker驅動特殊孵化、正常日曆保持暫停；隱藏分頁時間不補算。

既有8766伺服器、全新非持久Chrome contexts：
- 繁中、英、日、泰、越皆透過正常LOGIN／故事／兩次命名進明確preview，完成接受→介紹→孵化→退出還原。
- 語言從既有設定UI選擇；繁中以真實touchscreen.tap點中Pixi蛋（nativeFrame0觸控，95時完成，早於180等待門檻；等待分支在270完成），其餘四語走180次更新等待。
- 繁中保存失敗在隔離context注入，舊save不變，經UI重試成功；英文驗證Escape／重新開提示，以及孵化後reload→LOGIN→Continue。
- 五語零pageerror、單一Raising canvas、無橫向溢出；對話焦點在modal內，按鈕實測至少44px。實際檢視英文孵化圖與泰／越對話截圖，內容及底欄未被截斷。
- 額外控制檢查：對話中切換locale會取消舊對話，舊detached按鈕再click不會推進；只留一個modal；退出後沒有殘留preview對話。
- 不帶preview參數的正常New Game／Continue在390×844、360×800再次通過：維持v1 opening、無新教學、零pageerror、單canvas、無溢出。
- 這些是有限preview UI與正常入口回歸；不是完整互動教學、實機手機、母語審校或19狀態逐frame差分驗收。

## 明確尚未完成與直接下一步
本輪只完成特殊state18及state1入口，停在raising-hatched安全邊界；state1之後不運行正常idle／成長來冒充教學。

下一段直接接既有授權：
1. 讀同一特殊表state1 think021218F8與後續handler，接餵食selector0/1、tool1及(100,120)±12 predicate、真正食物／特殊actor反應。不要只用工具選取或ACK。
2. 三物件清理必須逐一鎖定命中且>20計數，全部完成再120更新；其後治療、拖曳到cage1／15、低HP恢復、傷口與專用睡眠逐段接入並保存可重建邊界。
3. 原DOM控制器可延伸下一stage與現有五語文案；移除preview「只到孵化」說明時要同步更新實作邊界。正常eligibility仍關閉。
4. 再接Gate16、Hunt13/21與Battle record61／189/212/207，沿同一core；completed恢復正常基底並原子保存。原作loss/draw仍UNKNOWN，web安全結束／重試分開記錄。
5. 全正常UI、全操作predicate、各段退出／失敗重試與完整收尾驗收後，才考慮開正常eligibility。

沒有等待Owner的新批准，也沒有工具或額度耗盡阻塞。這是依「每個有意義runtime階段回報」交付的孵化／UI里程碑，未將其餘 Raising 或完整教學報成完成。

## 本機交接
工作樹：R:\Projects\Championship2026\championship-2026
私有切片目錄：R:\Projects\Championship2026\tutorial-runtime2-20261009
本機preview URL：http://127.0.0.1:8766/championship.html?tutorialPreview=raising
此URL是preview，且New Game仍遵守既有覆蓋確認；驗收只使用隔離context，不使用玩家browser profile。

程式路徑：
- src/championship/raising/nativeTutorialRaisingActor.js（新）
- src/championship/raising/nativeRaisingActor.js（共用sequence函式與投影authority標記）
- src/championship/app/interactiveTutorialCheckpoint.js
- src/championship/app/championshipStandaloneApp.js
- src/championship/app/raisingPresentationSource.js
- src/championship/app/championshipToolbar.js（教學工具限制，保留圖示／標籤／觸控尺寸）
- src/championship/app/main.js
- src/championship/app/uiDialog.js
- src/championship/app/interactiveTutorialPreview.js（新）
- src/championship/text/interactiveTutorialPreviewText.js（新）
- src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js
- tests/championship-interactive-tutorial-save-cases.mjs
- tests/championship-interactive-tutorial-actor-cases.mjs（新）
- tests/championship-toolbar-layout-cases.mjs（追加2項限制／還原測試）

驗證紀錄：
- FOCUSED_TEST_OUTPUT.txt（113／113）
- PREVIEW_BROWSER_RESULT.json（五語）
- PREVIEW_LIFECYCLE_RESULT.json（對話／locale／stale）
- BROWSER_RESULT.json（正常入口）
- RUNTIME2_OWNED_DIFF.patch／RUNTIME2_FILES.json（本輪專屬diff與hash）
- SAFE_CONTINUATION_CHECKPOINT.json（下一步及安全狀態）
- private/actor-hatch-handlers.asm／special-state-table.json僅本機研究，沒有加入runtime或Library。

branch與HEAD不變：handoff/dot-continuation-20261001，1fb7d5fd21d3da47775d34ab0d3a1a95f6623972。伺服器仍127.0.0.1:8766／PID38660。沒有修改素材、地圖、原創角色、既有五語字典／CSS、玩家save或公開build inputs；沒有新server、commit／push／merge／checkout／reset／部署／刪除／額度重置或購買。其餘協作者修改保留。
