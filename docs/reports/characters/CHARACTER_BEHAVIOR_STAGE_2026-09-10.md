# 全角色行為還原：單一階段與本次修正

日期：2026-09-10。正式 repo：`R:/Projects/Championship2026/championship-2026`；branch `main`；開始 HEAD `65afff9d57cb530e8d78dfb186b24f83c68db27d`。父資料夾不是 Git root。

**目前沒有完成全角色、全行為還原。本階段保持 IN_PROGRESS，不以已修正三項轉向行為代替原本的完整範圍。**

先前的修正已讓角色依自己的資源播放，接上多項飼育、狩獵、戰鬥流程。仍缺整體行為的逐條件觸發、完整中斷／返回、原作聲音與畫面比較。程式測試通過與原作完整還原是分開的結論。

## 單一階段的工作範圍

本階段沿用既有 application、Raising/Hunt/Battle owner、RNG、Save、DOM 與單一 Pixi/ticker。以下是同一階段的工作組，沒有重新拆成多個開工審批。

| 工作組 | 必須涵蓋的行為 | 本次結論與待補項 |
| --- | --- | --- |
| 全角色資源／播放 | 身分、Main/Sub、序列、cell、ticks、loop、原點、轉向、合法停格 | 224 組資源，228 筆物種綁定；重新核對 Main/Sub 時間表零差異。不能因此宣告全場景觸發正確。 |
| 飼育自主反應 | 待機、行走／跑動、同伴／性格／設施反應、跳躍／翻滾 | 通用反應執行器新增原作逐更新比較；其餘正常觸發、群體與畫面仍需補齊。 |
| 飼育操作與生命週期 | 餵食、持握／拋放、訓練、治療、睡眠、排泄、進化／重生、換日 | 已有整合與個別證據；仍須逐適用角色、條件與中斷驗收。 |
| 狩獵 | 出現／移動、逃跑、道具反應、束縛／拉扯、掙脫、倒地、手掌／卡片、回家 | 既有工具／捕捉流程保留；未解 steering producer 及各適用物種正常視覺對照仍未關閉。 |
| 戰鬥 | 移動、準備、攻擊、命中／格擋／落空、異常、恢復、倒地／復活、勝敗 | 原作完整 caller／notification 時機、各招式正常流程與結尾演出仍需比較。 |
| 跨場景驗收 | 同一角色進出場景、Save/Continue、暫停／恢復、手機顯示 | 保留角色身分與原本 clock/save；全物種／全條件與實機仍未完成。 |

完整 14 個工作項、來源與驗收規則見 [階段 contract](../../contracts/championship/CHARACTER_BEHAVIOR_RESTORATION_STAGE.v1.json)。逐物種資料見 [228 筆 CSV](../../../reports/character-behavior-stage-2026-09-10/species-coverage.csv) 與 [完整 coverage](../../../reports/character-behavior-stage-2026-09-10/coverage.json)。其中 `wholeBehaviorAcceptedSpecies: 0` 表示尚無物種通過「所有適用行為」整組驗收，不表示沒有角色能活動或沒有已通過的個別行為。

每一項需要記錄：原作條件 → 狀態 → 動作請求 → 正確播放 → 位置／轉向／回饋 → 中斷或結束 → 下一狀態與保存。缺證據標 `UNKNOWN_REQUIRES_TRACE`，原作不適用的配對也必須有 eligibility 證據，不能把所有動作硬套到所有角色。

## 本次實際修正

直接從 SHA-256 驗證過的 YDIJ ROM 載入 OVL18，執行 `021156B4` 反應參數、`02119880` 入口、`02119654` handler 及 `02112378` 動作 wrapper。原來的 activity catalog 未保存 actor `+0x1A4`，執行器也未處理這個轉向週期。

- 反應 6、22、29：每 20 次原作更新，依 `02119694..021196C8` 反轉面向。
- 反應 29：進入第二段時，依 `0211977C` 清除轉向週期；原作仍使用累計 counter 判斷後段時間，不重新猜一個動畫長度。
- 保留相同序列不重啟、指定影格與正常停止行為。未改角色速度、RNG、情緒名稱或玩法。
- 更新原有研究抽取腳本，將 `flipTicks` 納入輸出，避免日後重新抽取時再漏掉。

修正前，新 differential test 在「反應 6／一般狀態／第 20 次更新」失敗：Web 面向 0、原作面向 1。修正後所有 104 組條件、8,516 次 handler 更新吻合。這些條件涵蓋一般／慢速與兩種初始面向，核對每次轉向、交替動作、圖示切換與結束更新。

新原作 receipt 同時記錄全部 228 物種 × 2 狀態 × 40 個請求，共 18,240 次 wrapper 執行。這是原作 wrapper 輸出表，並不表示 Web 正常操作會提出全部請求。

26 種通用反應另以每一筆成年資源綁定執行：220 bindings × 26 reactions × 2 狀態 = **11,440 組**。每次使用該角色自己的 Main bank，檢查實際影格存在、播放與結束。220 bindings 對應 216 組非蛋資源；8 組蛋不套用成年反應。其餘五個反應 ID 使用既有移動／跳躍／待機路徑，不誤算成 31 種通用 handler。

**證據限制：** CPU receipt 使用 synthetic resident；攔截動畫請求、圖示 setup、帶狀態的輔助聲音與 signed division。沒有外部待處理指令；動畫 active flag 在第 73 次更新關閉，以單獨比較 handler。真實物種動畫在 JS 另外執行。這不是原作正常遊玩錄影、全部音效或手機硬體驗收。

## 驗證與可重跑輸出

- 修正前完整本機基線：1,411／1,411。
- Focused：46／46，涵蓋反應、活動、需求圖示、持握、生命週期、Hunt 與 Battle 動畫。
- 修正後完整本機 regression：**1,413／1,413**。
- Portable CI：**1,196／1,196**。將本次測試與同一行為工作的三份既有未分類測試補入明確 scope；沒有移除測試或降低斷言。
- `git diff --check` 通過；保留 Git 既有換行提示，沒有 whitespace error。
- 原作資源重新讀取：224 資源組，896 個來源 bank，13,008 序列；其中 Main/Sub 與目前已註冊 bundle 的時間表比較為零差異。圖鑑 bank 的存在不當作正常角色動作接入證明。

驗證紀錄：[本次輸出目錄](../../../reports/character-behavior-stage-2026-09-10/)。研究命令：

```powershell
python scripts/research/check-raising-reaction-dispatch-cpu.py --rom R:/8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1.nds --out docs/research/RAISING_REACTION_DISPATCH_CPU_2026-09-10.json
node scripts/audit-character-behavior-stage.mjs
node --test tests/championship-raising-reaction-dispatch-cases.mjs
npm test
npm run test:ci
```

原作來源詳細 inventory 留在產品 repo 外：`R:/Projects/Championship2026/_archive/character-behavior-stage-2026-09-10/all-character-rom-usage.json`。

## 本次正常瀏覽器抽查

使用獨立 loopback `127.0.0.1:8768`，以既有 hungry-adult fixture 準備受控存檔，再經正式 LOGIN／繼續遊戲及工具列操作。手機 viewport 390×844；一個 canvas、document width 390，沒有水平溢出。畫面可見角色活動與飢餓肉圖示；點選餵食、放置後庫存 50→49，較晚畫面已不見地面食物與飢餓圖示，角色位置改變。儲存按鈕回報成功，真實 reload 後仍找到同一驗收角色存檔。warn/error log 為空。

[餵食前畫面](../../../reports/character-behavior-stage-2026-09-10/home-before-food.png)、[餵食後畫面](../../../reports/character-behavior-stage-2026-09-10/home-after-food.png)、[驗證 receipt](../../../reports/character-behavior-stage-2026-09-10/validation.json)。這只是單角色普通流程抽查，沒有以兩張截圖宣告原作逐幀對照或精確驗收反應 6／22／29 在自然流程中的全部觸發。

## 尚未完成與下一個安全步驟

同一階段繼續處理 Raising music-state 的原作 writer／caller、各操作的狀態進入與中斷，再逐項關閉 Hunt steering／特殊分支及 Battle notification／結尾時機。最後以每一適用角色與情境的正常操作、原作畫面／聲音對照與實機結果收尾。這些欄位目前均不以資源數量或受控 helper 測試代替。

工作樹起始已有大量動畫、手掌、表情、角色 HUD、Hunt、Battle 及美術修改。本次沒有把這些既有成果算作新實作，也沒有覆寫其他 Agent 的 owned status。沒有 commit、push、merge、deploy 或公開發布。
