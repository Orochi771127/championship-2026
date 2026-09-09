# 原作影片與目前遊戲：角色動畫及回饋差異

日期：2026-09-10。產品基準：`main`，`8143aff2706a700631833072913f2a966f4f1b58`。

結論：目前已具備角色 Main 影格播放與部分正常場景動作，但還缺角色狀態展示、需求／反應圖示、完整持握／拋擲連接、原作結果演出，以及部分工具美術。不能以全量影格綁定測試宣告所有原作動畫使用情境完成。

## 這次實際看了什麼

- Owner 在 Codex 瀏覽器登入後，重新播放 [原作影片 BV13u411B7BK](https://www.bilibili.com/video/BV13u411B7BK/)。確認能跳至 8 分鐘後，並看到約 13:10 的片尾牧場內容。先前登入／短試看限制已解除。
- 對牧場、狩獵、對戰與結果片段反覆抽查並記錄 18 個時間點；不是 13 分 17 秒逐幀完整審核。播放中截圖的可見時間可能比 DOM 取樣晚約一秒，以下時間採近似區間。
- 影片有英文 UI；ROM 研究版本是日文 YDIJ。影片的 HP/TP 9999/9999 與資金 9999999 不作一般數值、難度或速度的還原基準。播放器讀到 1 倍速，不足以證明錄影時模擬器沒有加速或其他修改。
- 在獨立 localhost:8766 測試來源，使用既有 `tests/fixtures/championship-character-scenes.html` 準備成年亞古獸、秋季第 4 日及 50000 位元幣。從正式登入／繼續遊戲進入牧場，裝備繩索、普通射擊、肉餌進入戴納草原，再返回牧場參加存取突擊兵，執行到敗北、獎金頁、返回牧場。
- 查看正常遊戲截圖與 DOM、相關 renderer / owner / UI 原始碼。瀏覽器 warn/error 查詢為空；沒有量測 FPS、frame time、實機表現或全角色／全技能。
- 測試亞古獸敗北後的伏地姿勢不能當作動畫故障；它當時低 HP，之後在牧場恢復。影片多角色與本次單角色的數量差異，也不能直接推論群體行為缺失。

## 差異與優先順序

### 1. 角色頭上的需求／反應圖示缺少呈現（高）

影片約 00:21、00:35 可見音符等反應，約 07:23 可見多隻角色頭上的肉圖示氣泡。這些訊號讓玩家直接讀懂角色正在反應或有所需求。

目前正常牧場缺少對應呈現。`projectNativeRaisingActor` 有位置、序列、治療、訓練、進化資料；`updateAnimations` 有這些畫面的更新，但沒有同等的需求／反應氣泡渲染流程。此處是可見回饋的缺口，不是「角色完全沒有需求規則」。音符與各圖示的精確條件、序列及優先順序仍須追 ROM，不能只憑圖案命名情緒後新增玩法。

定位：`src/championship/raising/nativeRaisingActor.js:37`、`src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js:524`。

### 2. 牧場與對戰的角色資訊區沒有原作角色展示（高）

影片約 00:42，上方有選中角色的較大角色展示、HP、TP、AP、容量及小地圖；約 08:04–08:12 的對戰，上方同時顯示雙方角色、血條與數字計時，下面是實際戰場。

目前牧場選中角色後顯示名稱、所在設施、HP／TP，沒有角色圖片、同等狀態區及小地圖。對戰參賽者卡片只有名字、條狀值與文字；時鐘主要是條狀呈現。場上角色即使正常動，上下資訊區也比原作靜態。這次確認原作角色展示存在；各 UI 資源組的動作編號與同步規則沒有逐幀證明，不可把 Main 任意映射成 Sub。

定位：`src/championship/app/raisingHomeP1RView.js:93`、`src/championship/app/vs5Screens.js:218`、`:277`。

### 3. 對戰結算缺少角色、勝敗與獎勵演出（高）

影片約 08:20–08:31 有 WIN 背景、角色展示、獎章／升級與獎金呈現。目前實測敗北頁只有結果文字框，下一頁是獎金與持有金額。

雙方勝敗不同不能用來比較獎勵數值或要求失敗發獎，但查碼確認目前結果頁只建立 RESULT、PRIZE；`result_sub_status_scene`、`result_sub_rankup_scene`、`result_sub_titleget`、`battle_result_log_scene` 明列 `notBuilt`。即使勝利也不能據此宣告完整原作結算演出。

定位：`src/championship/app/vs5Screens.js:410`。這是演出與頁面內容的缺漏，不等於已實作的獎金入帳失效。

### 4. 持握與放手仍以拖曳搬移為主（高；原作完整鏈需追查）

本次操作與原始碼確認：pointerdown 選取角色、拖曳直接移動 render root、pointerup 呼叫 `relocateToGround`。沒有在此入口連接完整原作「被抓住 → 特定反應 → 放手／拋出 → 落地」狀態鏈。

這是一個程式接入缺口；本次影片抽樣不足以驗收所有拋擲條件、速度或落地後果，不把推測寫成影片已證明。下一步需用原作手掌操作 trace 對照後，再沿現有 owner 接入。

定位：`src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js:243`、`:291`、`:508`；`src/championship/app/raisingPresentationSource.js:315`。

### 5. 狩獵工具及命中特效仍有替代圖形（中）

本次正常狩獵可裝備工具，探索後看到野生鳥型角色，位置與姿勢有變化；不能再說所有野生角色都只有靜態第一張。

但 renderer 的 WIRE、MEAT、DECOY、LIGHT、CAPTURE_TRAP、BOMB/MINE、SHOT_IMPACT/TOOL_BURST 仍用線段、橢圓、圓、星形等 `PIXI.Graphics` 組成。這與角色 Main 圖集接好是兩件事；原作工具各 cell、命中特效與角色反應須一起驗收。這次沒有完成繩索捕捉或逐工具命中驗收，肉餌點擊截圖也不作成功引誘證明。

定位：`src/championship/presentation/vs2/createHuntFieldPixiPresentation.js:319`。

### 6. 畫面配置和視覺密度差異大（中）

目前牧場採淺色、較薄資訊列、寬按鈕與大片留白；對戰在場地上下也留有空間。原作採連續的藍綠資訊面板、金色工具邊框、角色展示及訊息帶。這些差異會影響角色動作的可讀性和整體活動感。

這是直接畫面比較，不代表應取消 9:16 或照搬 NDS 雙螢幕尺寸。應保留已核准的 Web/mobile 架構，在既有 DOM/Pixi 分工內重新安排內容。

### 7. 同動作強制重啟可能中斷播放進度（程式差異已確認；影響待重現）

既有直接 ROM 研究記錄：`ARM9:02047984` 收到目前相同序列時不重啟；牧場 `02117C4C -> 02112378` 使用該條件式路徑。

目前 `request(actor, sequenceId, force)` 在 force=true 時會重新建立播放器。`enterIdle` 與部分 `beginNativeActivityReaction` 入口傳 true。若相同動作再次進入，就會回到開始，而非保留進度。

這是一個具體的優先 differential trace 目標；本次沒有重現其發生頻率，也沒有證明它是所有不流暢感的原因。指定影格與原作強制播放的合法呼叫不能一概改掉。

定位：`src/championship/raising/nativeRaisingActor.js:20`、`:84`；`src/championship/raising/nativeRaisingActivity.js:29`。

## 已具備、但不能擴大解讀的部分

- 正常牧場與狩獵確實有角色活動、位置／姿勢變化；本次對戰有角色移動、HP 變化和場上特效，也能進入結果並返回牧場。
- 既有全量 Main 綁定和原點／倍率修正保留；本次沒有重跑全部 42849 筆綁定測試，不把前次測試當成本次新結果。
- 目前仍欠「狀態發生 → 選對動作 → 正確播完／中斷 → 圖示及工具回饋 → 回到下一狀態」逐情境驗收。
- 不以增加任意補幀、統一加速、循環播放全部 40 動作來掩蓋接入缺口。

## 建議延續次序

1. 同一個動畫整合階段先處理：原作／Web 同動作請求對照、需求／反應圖示、持握放手、牧場／對戰角色展示。每個情境均保留 ROM 入口與正常操作證據。
2. 在同一驗收階段補齊：狩獵工具美術、對戰／獎勵演出及 9:16 配置，然後驗收全情境和實機流暢度。此為既有最多兩階段計畫的優先順序，不是重新宣告第一階段已完成。

本次是查證與差異盤點，未修改 gameplay、動畫速度、圖片或執行公開部署。文件檢查用 `git diff --check`；無產品程式變更，未重跑完整測試。

## 證據位置

- 本機截圖與影片時間點：`R:/Projects/Championship2026/_archive/video-game-comparison-2026-09-10/`，`video-samples.json`。有 loading、轉場或選單的樣本僅用於取樣紀錄，不作該時刻角色動作證據。
- 視覺對照頁：同目錄 `comparison.html`；僅引用本機截圖，不含下載的遠端影片。
- `docs/research/CHARACTER_ANIMATION_USAGE_ROM_2026-09-09.md`：ROM 資源及牧場原作播放入口。
- `docs/reports/commercial-readiness/2026-09-09/CHARACTER_ANIMATION_INTEGRATION_ZH_TW.md`：前次整合完成範圍。
- `docs/contracts/championship/HUNT_CHARACTER_PRESENTATION.v1.json`、`RAISING_LIFECYCLE_STAGE.v1.json`：影格接入／完整情境驗收邊界。
- championship-evidence 檢索：`R:/NEXUS LINK/原作/CLAUDE_CODE_YDIJ_HANDOFF/02_CHARACTER_ART_STRUCTURE/CHARACTER_BUILD_PLAN.md:27`，224 entity 的 cell/OAM/animation manifest 索引。此為外部原作研究資料，不引入 Nexus Link 產品。
