# Gate 入場與原生個體返家：原作證據、實作、限制

日期：2026-09-08。ROM SHA-256：`8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`。本次直接執行該 ROM 的原生函式，沿用現有功能資料表與 app／wallet／save／RNG。CPU receipt 僅供研究，遊戲不讀取 receipt、ROM、emulator snapshot 或固定結果序列。

## Gate 規則

- ARM9 `02067920..02067954` 初始可見旗標，以及 OVL8 `0210CFD8..0210D0BC` 解鎖掃描：Gate row `+1C` 是種類，`+20` 是參數。種類0初始開放；種類1比較 tamer rank；種類2读取指定 battle record 的完成旗標。17筆含16正常場地及1教學草原。普通 New Game 只有草原開放。
- `+1A` 不是 rank。OVL12 `0210D008` 將它傳給 `020472FC` 的呈現 helper，未將該值當作解鎖条件。
- OVL12 `0210F7D0` 的入場處理在 `0210F84C` 比對錢包，`0210F874` 扣除費用。GameData `+EB8` 非零走豁免分支。初始化 `020688E0` 清除此旗標，讀檔 `0206AE24` 從 bit27 還原；自然取得豁免的事件仍未追通，正常 app 不開啟。
- `check-gate-admission-cpu.py` 執行費用原生函式，只 stub UI／輸入 helper；費用比較與減法不被替代。158 費用向量、95 解鎖向量、17 初始旗標均通過。解鎖向量是受控條件測試，不能證明自然 rank 進度已完成。

實作：`gateAdmission.js`、`gateCatalog.js`、`championshipStandaloneApp.js`、既有 presentation source／DOM。鎖定場可預覽但無法確認，缺錢不能開始。先完成 encounter candidate，確認 context／wallet 未變，再透過既有 wallet CAS 付費；免費場不送出空錢包交易。取消、重複按開始、失敗的 runtime factory 不扣款或耗 RNG。同步 observer 看到一致的 Hunt screen/runtime/history，交易期间無法再進場、修改錢包、rank 或保存。

普通 mode0／battleType0 勝利後，已觀察的 matchIndex 追加到既有 progression 的 `battleBadges`；既有結算 receipt 防止重複，保存後 Continue 還原。match7 對應 Ice、45 對應 Factory、46 對應 Jungle。這只是已有勝場的解鎖接線，不代表 Battle 的玩家來源、所有賽事進度或原作歷史 save 已完成。舊檔缺此欄位時維持無已知勝場，不回推以前勝利。

## 卡片與 Home 個體

野外 actor 的戰鬥／捕獲 HP 與原生個體 record 的 HP 是不同欄位。拉繩將野外 HP 降到0，不會把 Home 中該個體的 HP 一併改成0。已存在的原生 constructor `02062100` 給出已知欄位；原作 Home 插入函式 `02061BB4` 把 record 複製到16槽池第一個空位，並不重跑 constructor。

`check-native-individual-home-cpu.py` 對先前 CPU 對照過的228個 constructor 輸出，分別執行第一空位0／7／15。684次均保留所有已知 word、窄欄與 UTF16 名稱；故意填入的 padding 不輸出至玩家資料。這是函式級 CPU 對照，未聲稱684次硬體/UI捕獲。

新增 `nativeIndividualProfile.js` 保存：108個 u32 欄位、5個窄欄位、原生5 UTF16 unit名稱欄、版本1；嚴格拒絕缺欄、額外欄、非整數、錯物種與越界 HP／TP。未知語意以 offset 命名保留，沒有替欄位編造養成意義。`raising.collection[].nativeProfile` 是現有 collection 的附加欄位；使用同一個體 ID、同一 save key 與 outer envelope v5。沒有另一套 roster/store。展示 profile 從該個體欄位投影，不使用物種平均值；starter／舊捕獲資料無 profile 時保持未知。

正常 `exitHunt` 現在呼叫已經 CPU 對照的 `applyNativeHuntReturn`：

1. 普通捕獲調整當區 modifier（上限8），recaptured tag2 清除原 released slot；攜帶分支保留在 pure port，但正常 carried entry 尚未開放。
2. 每張返家卡片消耗一次 channel1；除數0仍消耗一次；寫入 `008 = species.field1c >> 1`、`00c = 0`、`178 = field20 + remainder`。
3. 全部 candidate 先驗證，才提交卡片／RNG／history，清除時鐘餘數並進 Result。返家交易重入不會重跑 writer。
4. Result／Home 仍用原有原子保存。失敗保留卡片與待提交選擇供重試；重複確認不複製個體。Result 才釋放卡片不倒轉較早 Hunt-return 已發生的 RNG／modifier 更新。

另修正 `nativeWildActor` 將 `00c` 誤讀為 `00C` 的大小寫錯誤；活動計數不再從 undefined 演變成 NaN，已知 u32 寫入保持原生位寬。

原生名稱欄是 source record 的資料；既有 product display-name 編輯仍是另一個現有呈現欄位。本次沒有宣稱原作字集／名稱編輯 writer 完全一致，也沒有自動截斷舊的 product 名稱。

## 第二階段的工程交付

production builder／validator 與现有 ART_PRODUCTION_INDEX 的24個登録對齊，包含21個早期 bundle、1個退役 bundle與2個明确的本機研究 bundle。僅精確的 ID／path 與雙方 manifest/index 的 localOnly、LOOPBACK_RESEARCH_ONLY、publicReleasePermitted:false、shippingReady:false 同時成立才接受本機例外。原 index 的批准值未重寫。完整 validator：1248 crosswalk、24 bundle、9 runtimeEligible（含2 local-only）、95 ready、0 shippingReady。

修正2個過期文字匹配測試，仍檢查呈現層不引入 runtime／store／save 權限，不把已追通的 CAPTURE_TRAP 名稱錯當越權。同步狀態／架構與 contracts，保留早期 receipt 作歷史證據。公開 Pages 的 input／依賴缺口另外記錄，沒有取消排除規則來讓建置假通過。

## 驗證與未完成項目

- focused：16／16；最終 full regression：1296／1296。以 audit 目錄最新 log 與 `two-stage-validation.json` 為準。
- 正常 app API 的圈選／拉繩／倒地／手掌／卡片／返家／Save／Continue 通過，並驗證实际 profile、channel1、modifier、唯一ID與重複呼叫。
- 真實瀏覽器390×844確認 Gate鎖定、Loadout、Hunt場景／道具操作、斷繩／返家、Save & Quit／reload／Continue；已消耗肉餌從10變9並保持到下次Loadout。多次實際指標捕獲嘗試沒有取得可證實的成功卡片，**不得標 browser touch capture PASS**。
- Home另檢查360×800、375×812、390×844、412×915、430×932，沒有横向溢出，每頁維持1 Canvas。這不是5台實體手機，也不是5尺寸完整Hunt流程。
- 尚未完成：照護與養成 writer、健康／進化／壽命、自有隊伍ENTRY／資格／戰後回寫、自然rank／license、carried entry／AI7、完整事件美術與224角色預設替換、公開Pages、背景／長時／WebGL恢復、實體裝置驗收。

工作根目錄與HEAD、兩階段完整狀態、命令 logs、瀏覽器 screenshots 與 receipt 在 `docs/reports/parity-audit/2026-09-08/`。本次沒有提交、推送、部署或將研究資產提升為可發布資產。
