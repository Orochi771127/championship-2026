# 互動教學第二階段 A：特殊初始化與推進條件
日期：2026-10-09。用途：既有 Championship 應用的教學接線與跨執行環境交接。

本輪補齊主要腳本、特殊初始化與操作條件的來源定位，並落下接線契約。**產品教學仍未接線；不宣稱瀏覽器完整教學已通過。** 此為可接續的中間里程碑，不是要求重新批准開工。

## 重要結果
- 新遊戲不出現教學的直接原因仍是 app.newGame 寫入 tutorialStep:null，而正常開場没有邀請／互動控制器。第一階段已由隔離瀏覽器的正常 UI 重現。
- 原作在 Raising 使用專用 19 狀態表。它不能交給正常 Raising FSM 再額外加一個教學計時器；睡眠、清理、治療與孵化都有教學專用控制。
- **17 是指定孵化目標 species index，不是 actor state。** 初始特殊蛋為 state18；實際操作後變成 species17、state1，仍保留初始名字。
- 教學狩獵專用分支固定建立 species13、21；戰鬥專用分支固定建立 species189、212、207。不能用一般隨機遭遇或玩家現有隊伍替代。
- 選對工具不等於完成操作。餵食需命中提示範圍；清理需三個目標全部完成；訓練／恢復要驗證落入 cage1／15；圈捕、HP 歸零、手掌插卡各有獨立條件。
- 已定位腳本合計使用 66 個教學 text ID；72 個字典條目不是一條連續流程。未在這些可達分支呼叫的六個 ID 是 1510、1542、1550、1551、1552、1566。這不證明它們在所有原作分支永遠不會出現。
- 原作勝利→返回 Raising→1564/1565→完成→存檔／重啟 Continue 已在第一階段實際操作。失敗／平手正常操作路徑仍 UNKNOWN；共用返回 handler 的 phase4→5 寫入沒有 outcome 分支，但不等於所有 outcome 已經實測。

## 原始來源邊界
使用既有本機 ROM、反組譯與私有模擬器 checkpoint；沒有抓取新遊戲參考。ROM SHA256：
8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1。

沒有可用 Championship Evidence MCP／Ghidra 執行工具，因此直接讀既有來源，以 ndspy／Capstone 做有限範圍解析，以既有 DeSmuME checkpoint 進行讀取及真實觸控。沒有記憶體寫入、強制改勝負或把測試結果當來源。

私有 ROM、二進位腳本、savestate、原作截圖留在研究目錄，沒有加入 runtime 或 Library 交付。本報告只包含語意結論及來源定位；完整檔案 SHA256 清單在接線契約 sourceFiles。

## 階段與主要 predicate
| 階段 | 原始來源 | 接線條件 |
|---|---|---|
| 邀請 | OVL18 0210FC04、02110128、021100F0、02110354 | 文字0x288；接受事件0x0D→phase1，拒絕0x0E→phase6。維持命名。只有明確 new game 才新建邀請。 |
| 初始 Raising | OVL18 VM021265B8，arg0→021267EF | 初始位置128,96；1495–1497後命中蛋或等待180次原始更新，command0x9B指定species17，再等特殊state1。 |
| 餵食 | VM0212691C後段；ARM9 020860B0 | 選tool1，1501後命中(100,120)±12原始邏輯像素；產生真正食物／角色反應，再按腳本停止及清除示範物件。 |
| 清理 | OVL18 VM初始分支、特殊actor | 三個示範物件：(100,120)食物freshness6、(160,100)排泄、(80,80)食物freshness-1。選tool3後每一目標各自鎖定命中並經>20計數，全部完成再等待120更新；不能單次 CLEAN事件推進。 |
| 生病治療 | ARM9 020862B8→OVL18 02121774 | 設profile138=1；選tool5，命中角色後command0x7D，等待90；保留教學專用治療語意。 |
| 移動／訓練 | ARM9 020864AC、020864D4 | 攝影機水平操作達來源條件；手掌抓住狀態3，放手後特殊state不再7且cageId==1；錯誤籠子回原提示位置，不能用畫面近似位置代替籠子歸屬。 |
| 低HP／恢復 | 同上＋condition selector4/5 | 050=1；放入cage15；完成後050=058。這是示範設定，不改正常恢復數值。 |
| 傷口／睡眠 | 特殊state17／4；0212566C、02121C10 | 134=1，tool4命中角色→command0x7C；等待240，再command0x9D進睡眠。睡眠不按正常疲勞／成長時鐘自行醒來；專用0x9C返回idle。 |
| 前往Gate | ARM9 020867AC | 教學允許system submenu3，事件0x8F→phase2。Gate16為獨立教學節點；不是普通Gate0。 |
| Gate說明 | OVL12 VM02114033，0210C450 | 1527及ack；教學初始化關閉0..15、啟用16。沿用現有Gate畫面及場景供應器的明確教學分支。 |
| Hunt初始化 | OVL0 0211A550..564、0211AAB0..AB64 | phase2分支建立species13/21各一個，呼叫既有02062100 builder；不是普通遭遇生成。 |
| Hunt示範與第一捕獲 | OVL0 VM02128472起 | 相機與提示定位、圈捕及拖拉自動示範後，等待選rope1→wild0 enclosure flag!=0→wild0 HP<=0→選hand0→field actor插卡訊號!=0。既有capture core是HP、圈線及插卡唯一權威。 |
| Hunt攻擊與第二捕獲 | VM02128CD9..021294F7 | wild1移動／rope示範；武器tool4需提示目標命中；tool2等待wild+11C>0的原始暈眩計數predicate0210C034；再tool1→enclosed→HP<=0→tool0→插卡訊號。不要靠 ACK、固定延遲或畫面動畫完成捕獲。 |
| Hunt返回 | OVL0 0211EA94、0211F41C | 清理教學card count並寫phase3；不得走一般捕獲返家提交以累積玩家名冊／圖鑑。原始handler對pending records仍有整理及RNG消耗，接線時只在教學範圍執行。 |
| Raising返回 | OVL18 VM arg4096→02127AB6 | 1553、1554；system submenu4／0x8E→phase4。 |
| Battle準備 | OVL10 0210BA24..0210BB20、VM021142C4/0211430D/0211438F | source phase4分支清示範名冊後建立189/212/207。只可對隔離demo集合做相同行為。既有entryMode4選record61，沿用Battle核心。 |
| Battle互動 | OVL10 VM，文字表02114A24 | menu state2→1555；state6→1556；state11→1557/1558；party state14→1559；nested state3且partymask7→1560/61/62；返回state11→1563，再BattleStart。 |
| 結果與完成 | OVL8 0210D7F8..0210D864；OVL18 arg8192→02127BD1 | 共用返回handler phase4→5；Raising1564/1565後0x9E→phase6。原作清理後只留重新建立的起始蛋並保留名字。web必須恢復自己保存的正常基底，不可照抄清全名冊。 |

原始frame／像素只作原始邏輯單位，不能直接套 CSS 座標或瀏覽器毫秒。沿用既有輸入座標轉換與唯一 ticker；不加全域計時器。

## 本輪有操作證據的負向檢查
1. 餵食提示時點(220,130)没有推進；正確(100,120)才觸發食物／角色流程。
2. 清理只處理兩個目標沒有推進；第三個目標處理完後才顯示下一段。
3. 特殊睡眠角色再跑600 native cycles仍為state4，沒有正常睡醒／疲勞計時推進。
4. 拒絕邀請直接phase6，原有起始species0／uid0／名稱保留。
5. 既有Hunt checkpoint只讀檢查：phase2、species13與21；此時profile HP210/390是該次實例觀察，**不是固定教學數值契約**。以正常builder產生，不硬編碼這兩個HP。

## 接線契約：存檔與單一權威
- 保留 v1 nativeOpening 及舊 tutorialStep 的既有解讀，35筆索引一個都不重排。null、-1、0..34及35..71都不自動轉成新教學。舊save Continue不突然出現邀請。
- 新互動流程使用獨立、版本化的語意checkpoint欄位，仍是同一 canonical save 的子資料；不是第二key或另一個遊戲store。具體欄位要在接線時做strict schema與相容性測試，不能先讓未知schema被正常load接受。
- 正常進度基底是現有app/session序列化出的不可變資料；不是另一個運行中的模擬器或第二app。只有一組可運行session／actor集合，切換教學時透過現有hydrate路徑。
- 接受教學後，活躍示範資料可供既有Raising/Hunt/Battle使用；保存時投影為「正常基底＋教學checkpoint」。基底的角色、名冊、ID高水位、金錢、道具、圖鑑、稱號、勝敗、日曆、籠子、RNG／Hunt history都保持不變。
- 捕獲、Battle結算、profile改寫、圖鑑登錄、autosave都必須先通過教學交易邊界。只在UI隱藏報酬不夠。不能把source中的clearRoster(-1)套到正常玩家。
- 完成或拒絕後恢復正常基底及初始trainer／egg命名，將教學記為完成／拒絕，經同一savePort原子保存成功後再發布正常Home。失敗保持可重試，不重複結算、不移除既有save。
- Web重新開啟接續是 Owner 已指定的 OWNER_APPROVED_ADAPTATION。原作battery loader只還原phase0或6；不能宣稱原作有任意步驟續教。
- 逐個成功操作保存語意邊界；跨Hunt/Battle的活動交易不強行呼叫目前會拒絕的normal save。先有教學保存投影，再接背景／關頁autosave。
- 中斷於一段活動／動畫時可由最後已保存安全邊界重新進入該段，不能略過尚未完成操作；此恢復政策須清楚記為web adaptation並在正常瀏覽器驗收。不得將循環引用、ROM地址、原始VM或整個runtime物件塞進save。
- 勝利以實際結果續教。失敗／平手保留真實結果，由有限的示範結束／重試流程安全返回，不假造勝利或加報酬；原作這些路徑保持UNKNOWN，不反覆重跑直到碰到勝利來冒充通過。

## 接線責任與下一步
仍在本輪授權內，不需要新的phase-start approval。
1. 在現有app的newGame／continueGame／save／清理交易接入版本化checkpoint及基底投影，先用既有save測試證明所有正常欄位隔離及舊cursor不變。
2. 將已定位的special actor handler接到現有actor owner，用相同角色／Pixi presentation／ticker。剩餘state逐個按原生handler核對，不能把這份流程表當成完整19狀態逐frame differential已完成。
3. 同一DOM對話／焦點層提供接受、拒絕及段落提示；使用現有五語字典與brandTerms；保留雙行clamp、觸控目標、可存取名稱與返回行為。
4. Gate16及Hunt demo adapter供應已驗證的專用初始化／引導輸入，捕獲與武器依現有core。Battle record61和三名示範個體接同一BattleRuntime。
5. 只用既有8766伺服器、新的非持久瀏覽器context及隔離save跑完整接受／拒絕／續教；沒有必要啟動全遊戲suite。

完成驗收前不開啟normal onboarding eligibility，也不把第一階段的legacy計数35、或本輪腳本text coverage66當成web完成率。

## 有限驗收清單
- 舊v1 save null/-1/0..34/35..71原樣載入，名稱及所有正常進度無變。
- 新遊戲正常LOGIN→story→兩次命名→邀請；接受／拒絕均可走通。五語正常UI，不用開發者跳轉當normal-flow證據。
- 點錯位置、選錯工具、只清兩物件、落錯籠子、未圈住、尚未HP0、尚未插卡、party不足三隻都不得推進。
- 接受後依序Raising→Gate→Hunt→Raising→Battle→Raising→完成，全部只用原本的一個canvas與ticker。
- 每個安全checkpoint退出／重載；至少各挑初始Raising、Hunt、Battle、結束未保存失敗點驗證。重試不重複扣費、獎勵、捕獲或圖鑑。
- 開始／拒絕／完成／中断恢復比較正常基底，除明確命名及教學完成欄位外零污染；真實玩家save完全不觸碰。
- 原生勝利是已觀察；原生失敗／平手是UNKNOWN；web處理與測試各自列示。實機手機、權利與發布維持未驗收。
- 本轮為文件與研究檢查，不執行無關完整測試；runtime正常瀏覽器驗收仍待接線。

## 安全交接
工作目錄 R:\Projects\Championship2026\championship-2026。
本輪開始 branch handoff/dot-continuation-20261001，HEAD 1fb7d5fd21d3da47775d34ab0d3a1a95f6623972；cached origin/main分岔為ahead2／behind23。開始有1067筆dirty status；不把這些變更當成自己的成果。

只新增本輪契約／研究文件與索引入口，保留全部既有dirty產品檔案。沒有改UI、CSS、五語字典、地圖、角色成品或玩家存檔；沒有commit、push、merge、checkout、reset、部署或刪除。模擬器已關閉。8766既有伺服器保留，沒有新測試伺服器。

私有工作目錄：R:\Projects\Championship2026\tutorial-phase2-20261009。
可續接資料：phase2-checkpoints.jsonl、private/PHASE2_OBSERVATIONS.json、private/hunt-special-setup-observed.json、bounded disassembly及Gate/Hunt可達VM解析。原生資料仍為RESEARCH_ONLY。
