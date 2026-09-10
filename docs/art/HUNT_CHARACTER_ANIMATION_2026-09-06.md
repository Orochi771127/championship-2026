# Hunt 單角色原始動作接入

狀態：**原作動作選擇、播放原語與 Pixi 幀投影已驗證；正常 Hunt 捕獲返家仍未完成。**

本批處理 `species-010 → m003_nyokimon`，沿用現有角色包、Hunt 場景、單一 Pixi bootstrap 與 Application ticker。沒有修改 AI、捕獲、卡片、Save 或返家所有權。沒有展開 Battle 或其他物種的動作綁定，也沒有新增 production 資產或修改來源素材包。

正式 repo 為 `R:/Projects/Championship2026/championship-2026`，branch `main`，HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。既有 dirty tree 全部保留；未 commit、push 或 deploy。開工已閱讀 AGENTS、README、Owner Direction、Architecture、Current Product Status、Dependency、Blocker、Hunt contracts 與最新研究報告，使用 championship-art-production、pixijs-ticker 與 browser skills。沒有待補的 Owner 授權 gate。

## 實際完成

- 在隔離的原作 DeSmuME library 中，以原有 stylus 操作腳本重新捕獲 wild index 7。ROM SHA 為 `8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`；起始 state SHA 為 `c0b30e38795287665c85f7aadbdb5247515d7c4849d408924eb93a11bd47f7e4`。全程只觀察 emulated RAM，沒有注入 HP、AI、RNG、捕獲成功或動畫完成。ROM、states、原作 screenshots 都留在 repo 外的私有研究目錄。
- 記錄 796 個原作 selector/setter/animator 呼叫與 476 個畫格，追到卡片數變為 1，卡片來源 HP 保持 210。觀察入口是原作 Hunt checkpoint，沒有宣稱 Web 正常入口或 fresh boot 驗證。
- 直接執行 OVL0 `0210C048 → ARM9 02047984` 的 640 組 CPU 輸入，證明動作 request 會受 `W+118` 綁定旗標與 `W+10C/+334/+40C` 影響。這些旗標只保留位址語義，沒有替它們發明狀態名稱。
- 直接執行 ARM9 `0202E438/0202E188/0202E030`，72 組明示的合成 frame-bank 輸入、9,288 次更新均與 JS 原始播放器一致，包含 loop start、播完停止、循環重設丟棄剩餘時間等邊界。
- 正式 `loadLicensedCharacterRoster → loadPixiCharacterRuntimeBundle → mountHuntFieldPixiPresentation` 現在可以接收這隻角色的 `nativeAnimation` 幀投影，套用 exact source cell 與原始翻轉位元。缺少 native state 時維持原始靜態 identity；其他物種也維持既有靜態處理。
- 新增隔離的逐幀／播放驗收頁。此頁從原作 setter/update 呼叫重新計算全部 476 個畫格，先逐項比對 expected，再交給正式 Hunt Pixi 場景；不是把 expected cell 直接當成播放器輸出。鏡頭以 3 倍置中供美術檢視，沒有正常 gameplay、save 或所有權寫入。

## 修正的原始播放語義

素材包的歷史文字標籤將 raw mode 1 寫成 `forward_loop`、raw mode 2 寫成 `forward_then_backward_once`。執行原作 ARM code 確認：

| 原始模式 | 此次驗證的行為 |
| --- | --- |
| 1 | 向前播一次，停在最後一幀，active 變成 0 |
| 2 | 向前循環，回到原始 loop start |
| 3、4 | 本批沒有 CPU 比較，播放器拒絕套用 |

`characterAnimationTimeline.js` 現在明確分開歷史 review-label 播放器與 `createNativeCharacterAnimationTimeline`。來源 archive 及既有 review pack 沒有被改寫。正式原作幀投影不依賴舊標籤或 provisional 60 Hz；它消費 native owner 的實際畫格。驗收頁的 60 Hz 是瀏覽記錄的播放速度，不是原作全部場景的時間頻率結論。

同一個 request 不一定等於同一個 NANR sequence。例如被綁住時 request 11 → sequence 21、request 15 → sequence 25。ARM9 `02047984` 對相同序列不重啟；原始 setter `02047904` 則可明確重設。

## 本次原作觀察

以下 ticks 只屬於上列 state hash 的本次輸入序列，不是通用捕獲時長。

| 畫格 | 原作狀態 | 實際序列／結果 |
| --- | --- | --- |
| 1 | AI4，未綁住 | sequence 13 已停止 |
| 136 | AI6，綁住 | sequence 20 |
| 143 | AI8 | sequence 21 |
| 214 → 215 | AI8 拉扯反應 | sequence 25 → 21 |
| 342 | AI10，野生 HP=0 | sequence 25 |
| 357 | AI11，hand-ready=1 | 保持 sequence 25 |
| 376 | AI12，收集開始 | 同一更新先設定 39，再設定 16；畫格最終顯示 16 |
| 386 | Hand phase 0 / counter 10 | 既有 hand controller 要求隱藏 field actor |
| 470 | Card insertion | 卡片數 1，來源 HP 210 |

不能把 sequence 25 播完當成 hand-ready 或捕獲成功；`W+11C` 的 15-update 倒地計數與 hand/card controller 仍是既有 gameplay authority。Renderer 只繪製其輸出，不呼叫 capture/save 完成方法。

## 正常路徑仍缺的實際接線

在一般 `championship.html`，實際操作 New Game → SYSTEM/Hunt → Gate 01 → 選取 Tether I → BEGIN HUNT。素材能正常載入，430×932 下只有一個 canvas，沒有水平 overflow 或 console error。但八個 Hunt toolbar slots 仍全部停用；一般 RETURN HOME 可回育成，沒有捕獲新個體。

原因已落在具體來源：

1. `championshipStandaloneApp.beginHunt()` 仍呼叫 `createHuntWorld()`，一般 `huntCaptureReplay` 為 null。
2. `huntWorld.js` 使用 catalog 前三個非蛋物種建立 prototype encounter；完整 native generation/source providers 尚未成為一般入口。
3. `huntRuntime.js` 只有在顯式 `captureReplay` 下建立 native capture flows；一般 tick 是 prototype wandering，沒有原作動畫 request/cadence。
4. `championshipToolbar.js` 在 Hunt mode 明確設定所有按鈕 `disabled=true`，原作工具指令尚未接到正常 pointer path。
5. 已捕獲個體返家後的 Raising 動作來源尚未驗證。現有 Result/save fixture 的通過不能取代上述正常捕獲鏈。

因此新的 `HUNT_CHARACTER_PRESENTATION.v1` 是已可用的繪製接點，**normal owner 尚未提供它的輸入**。下一個前置工作必須沿既有 Hunt owner 完成 native encounter、工具／AI 更新與卡片流程接線，再讓其輸出這份動畫狀態；不得讓美術推定的 idle/walk 代替原作狀態。

## 驗證與交付

- Focused character suite：17/17。
- Full serial regression：992/992，0 failed / 0 skipped，約 60.7 秒。
- `git diff --check`：PASS；既有 CRLF/LF warnings 保留。
- Browser：正式場景驗收頁 390×844；一般新遊戲 → 裝 Rope → Hunt → 一般返家 430×932。檢查拉扯兩個來源 cell、倒地、hand-ready、收集隱藏、card count、減少動態及播放記錄。無 console warn/error。
- 正常 Hunt 捕獲返家：**未通過**。實體 touch device、Battle、其他物種、Home action binding：**未驗收**。
- Public Pages build：重跑仍因 deleted tracked `src/data/championship/catalogs/entities.r1.json` 失敗。沒有恢復舊 catalog。部分輸出未包含 internal-faithful-baseline 目錄，production index 內本角色包的 entry 數為 0；這不代表完整公開 build 通過。
- Archive 總數仍為 1,541 rendered families / 164 diagnostic-only，本批未改變這些數字。

程式與 receipts：

- `src/championship/presentation/nativeHuntCharacterAction.js`
- `src/championship/presentation/characterAnimationTimeline.js`
- `scripts/research/hunt_animation_observer.py`
- `scripts/research/check-character-animation-cpu.py`
- `docs/contracts/championship/HUNT_CHARACTER_PRESENTATION.v1.json`
- `docs/research/HUNT_CHARACTER_ANIMATION_TRACE_2026-09-06.json`
- `docs/research/CHARACTER_ANIMATION_CPU_CHECK_2026-09-06.json`
- `tests/championship-native-character-animation-cases.mjs`

可操作驗收頁：`tests/fixtures/championship-hunt-character-review.html`。Screenshots、regression log 與機器可讀摘要在 `reports/art/hunt-character-animation-2026-09-06/`。
