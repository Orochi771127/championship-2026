# 狩獵場：原作道具、套繩、拉扯與收取核對

日期：2026-09-08。工作目錄／Git root：`R:/Projects/Championship2026/championship-2026`；branch `main`；HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。本次只做使用者要求的 ROM／影片確認與研究驗證，保留共享工作樹，不修改遊戲功能。

**結論：原作確實有「畫圈套繩 → 拉扯消耗目標 HP／管理繩索耐久 → 目標倒下 → 手掌收進記憶卡」的連續操作。** 圈住只建立束縛；收取另有狀態與容量條件。這次已重新執行原作觸控重播，並重新比對拉繩距離邊界。

## 1. 這次實際檢查的來源

| 來源 | 本次處理 | 能證明的範圍 |
|---|---|---|
| [使用者指定影片 BV13u411B7BK](https://www.bilibili.com/video/BV13u411B7BK/) | 瀏覽器開啟並暫停；直接看到約 01:04–01:05 的兩個 Pull 提示和藍色拉繩；另重新檢視既存 V08、V50 影格並驗證 SHA-256 | 畫面操作回饋、工具名稱與說明。沒有逐幀重看整部影片 |
| 日文 YDIJ ROM | 兩支既有研究腳本重新執行；均驗證指定 ROM 雜湊 | 實際原作觸控狀態，以及受控原生 CPU 數值／卡片資料流 |
| 原作 `help_text_txt.csv` | 證據 MCP 讀取 physical lines 91–107、126；索引 #89–95、#104–105、#124 | 原作自己對工具和捕捉條件的說明；不把說明文字當作逐商品公式 |
| 現有研究與程式 | 重讀最新 phase 修正、正常進場報告、capture contract 與現有入口 | 區分研究已確認和手機版尚未接線 |

ROM：`R:/Projects/Championship2026/_archive/hunt-history-2026-09-06/ui3/original.nds`。

SHA-256：`8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`。

原作說明來源是 Championship 的獨立原作研究庫 `R:/NEXUS LINK/原作/research-only/YDIJ_FULL_ROM_DECONSTRUCTION_2026-08-29/analysis/text/help_text_txt.csv`，不是 Nexus Link 產品規則。該 CSV SHA-256：`2e2e188c86580547f2eae84d47ef0eb2d13ec9c6d54a48f160ee70e2f08c9962`。

影片為英文版，ROM 為日文版。本次交叉確認玩法，不宣稱兩版 binary、逐商品數值或顯示時間完全相同。既有影片索引記錄作者提到作弊，畫面也有異常高數值；因此不拿片中捕獲速度推算正常難度。

## 2. 玩家實際操作順序

1. **出發前選場地、準備裝備及記憶卡。** 插件決定能看到哪些情報／雷達資訊；畫面的 `???` 不表示數值為零。
2. **進場找目標。** 拖曳空地移動視野。繩圈／拉扯中的輸入要由當前工具接收，不能同時拖動相機。
3. **選 Rope，在目標周圍畫圈，然後放開。** 原作 sampler 和形狀判斷接在 touch-up 後的空間查詢；成立後才向可接受的目標發出束縛事件。單純畫出封閉多邊形還不是捕獲成功。
4. **碰住已被綁住的目標，再向外拖曳、維持拉繩。** 顯示 Pull、繩線與條狀回饋；原作依當下目標與拉繩端的距離更新傷害、耐久及 AI 反應。實際重播包含持續按住，沒有要求連續點按或每次重畫圈。
5. **調整距離，管理拉力和繩索耐久。** 放鬆可回復繩索耐久；拉遠提高傷害累積，也有斷繩及特定目標的額外耗損。原作說明 #89 明示繩索斷後仍可再次使用。
6. **野外 HP 歸零後，等待原作倒下／可收取狀態。** 此路徑是 AI10 的倒下計時／位移，接 AI11 的 hand-ready。不能把 HP=0 當成立即入卡，也不能用任意動畫 callback 跳過原作計時。
7. **切換手掌並碰觸目標，收進記憶卡。** 卡上已用 G 加上新目標 G 必須小於或等於卡片上限。手掌接受後還有收取／飛行／插卡階段，完成才增加卡片數。
8. **離場後處理名單。** 記憶卡暫存、結果頁命名／放生、正式加入牧場是不同資料提交階段。

可定位的影片段落：[約 01:01 畫圈](https://www.bilibili.com/video/BV13u411B7BK/?t=61)、[約 01:02–01:05 Pull／繩線](https://www.bilibili.com/video/BV13u411B7BK/?t=62)、[約 01:09–01:12 離場及結果](https://www.bilibili.com/video/BV13u411B7BK/?t=69)。時間連結是 seek 目標，播放器 UI／保存影格可能晚數秒。手掌實際輸入與 HP／入卡條件另由本次 ROM 重播證明。

## 3. 道具用途不能混在一起

以下用途來自原作 help；這些是功能分類，不是已窮盡追通每個商品的 handler。

| 工具 | 原作用途 | 明確限制／差異 |
|---|---|---|
| Rope／繩索 | 綁住目標並造成傷害，透過拖曳拉扯 | 有耐久，會斷，但可再用；不是地面障礙線（help #89） |
| Shot／射擊 | 發射彈丸使目標退縮、暫停動作，輔助捕捉 | 有剩餘彈數；不推定所有彈種的傷害或異常相同（#90） |
| Wire／地面鋼索 | 在場地鋪線，阻擋或引導數碼獸 | 一段時間後損壞；不能與角色或場上物件重疊放置（#91） |
| 誘引類陷阱 | 餌、燈光、誘餌吸引目標；移動誘餌可引向陷阱 | 某些餌有麻痺、毒等效果；不是放下就直接捕獲（#92） |
| 傷害陷阱 | 直接造成傷害 | 包含放置後自動作動、目標碰到才作動兩種（#93） |
| 插件 | 顯示目標能力資料、雷達等情報 | 情報顯示與捕獲判定分開（#94） |
| 記憶卡 | 容納帶出／帶回的數碼獸 | 依目標 G 容量計算，不是只計頭數（#95） |
| 手掌 | 收取已符合條件的目標 | 原作說明明示 HP=0 後用手掌抓進卡片（#104） |

[影片 12:30 的 Normal Wire α](https://www.bilibili.com/video/BV13u411B7BK/?t=750) 在說明面板寫明鋪地阻擋，Length 24；本次重新看過保存影格。這不是前段畫圈／拉扯用的 Rope。

原作 help #105 明示有些目標不受某些裝備傷害，或只能被特定裝備降低 HP。因而「所有數碼獸皆用同一條普通繩就能抓」不能作為玩法規則。

## 4. 拉繩強弱及無力反抗的實際意義

原生 OVL0 `02114F54..02115284` 用 Q12 距離平方判斷。下列換算是原作座標單位，**不是手機 CSS px**。

| 距離 | 原作數值行為 |
|---|---|
| `<40` | 放鬆：本次 Rope 更新不直接扣 HP；耐久 +10，上限為該繩最大耐久 |
| `40≤d<80` | 普通拉扯：累加基礎傷害率並消耗耐久 |
| `80≤d≤160` | 強拉：傷害累積率加倍，另發出依角色狀態處理的事件；某些分類／限制狀態額外耗耐久 |
| `d>160` | 耐久設為 0，進斷繩狀態；等於 160 並不因距離直接斷 |

任何距離下，耐久耗盡同樣斷繩。強拉「累積率加倍」不保證每次顯示傷害剛好兩倍，還涉及 Q12 累積、原作每次只減一個4096單位的餘值行為，以及各 AI handler。

基礎傷害率取決於目標最大 HP、世代、物種分類及所選 Rope 的係數；初始耐久由原作 Rope 表的 byte×60 計算。這次重新跑 39／40／79／80／160／161 的原生 CPU 向量，保留上下界差異。

玩家描述的「無力反抗」在已驗證成功路徑中，對應 **野外 HP=0 → 倒下 → hand-ready**。原作 help #124 把 HP 說明為體力。本次沒有發現可以把此流程改稱另一條獨立「反抗值」的證據；Pull 下方彩色條的精確資料綁定仍需另外追 rendering writer，不能只按外觀斷言每條都顯示 HP。

## 5. 這次新的 ROM 重播結果

使用既存原作 Gate0 狩獵 checkpoint，選 wild index7／species10。觸控腳本讀目標位置來瞄準，但沒有寫入模擬 RAM、HP、RNG、選中工具、束縛或動畫完成旗標。

| 觀測點 | 本次結果 |
|---|---|
| 起始目標 HP | 210／210 |
| 套繩 | 畫圈並放開後，bound=1 |
| 逐次 Rope 更新 | 198 次，與現有純數值 port 逐次核對 HP、耐久與累積器 |
| HP 首次歸零 | 重播 frame351，尚未 hand-ready |
| 首次可由手掌收取 | frame367，AI11 |
| 首次入卡 | frame480，卡片數0→1 |
| 卡片 HP | 210／210；卡片複製來源個體資料，不把耗盡的場上 W.HP 寫回來源 R.HP |
| 另一個受控返家 CPU 重播 | 第一空牧場槽插入成功，名單1，卡片清為0 |

這些 frame 是此輸入序列的觀測點；不能套成所有物種／場景的固定毫秒，也不是手機瀏覽器正常捕獲驗收。原作重播的 battery-save adapter 提示只在 RAM 操作，本次不測 DS 電池存檔，亦不宣稱已驗證其保存。

新輸出：[verification.json](../../reports/hunt-capture-confirmation-2026-09-08/verification.json)、[觸控重播](../../reports/hunt-capture-confirmation-2026-09-08/native-touch-replay.json)、[距離／入卡／返家 CPU 重播](../../reports/hunt-capture-confirmation-2026-09-08/native-distance-and-card.json)。所有 ROM 影像／checkpoint 留在私有研究目錄，不加入遊戲素材。

最後驗證：本次198次觸控拉繩更新、6組距離／15次邊界更新全部與 port 一致；既有捕獲、原作觸控及階段回歸測試 **28／28 通過**；`git diff --check` 通過。沒有因純研究報告重跑無關的全專案測試。

## 6. 已確認、仍需追蹤與手機版差距

**同日後續更新**：[兩階段核心實作報告](HUNT_CORE_TWO_STAGE_IMPLEMENTATION_2026-09-08.md) 已接正常工具／角色／捕獲到 Home/save、全部 46 個裝備及 30 插件；四種散彈依 Owner 核准使用普通 Shot 物種反應初始化原作未初始化 byte（OWNER_APPROVED_ADAPTATION）。回歸 206／206，取代本節下方「正常捕獲尚未串好」的當時狀態。下方保留研究當下紀錄。完整觸控捕獲驗收與原作逐項視聽仍不能稱完成。

**已確認**：基本工具用途；Rope／Wire 分工；touch-up 後套繩；綁住後拖拉；拉力分段與耐久；受控 AI8 拉扯／AI10 倒下／AI11 手掌條件；G 容量和入卡資料流。

**仍需逐項追蹤**：每種射擊／餌／陷阱的碰撞、壽命、異常及物種有效性完整表；套繩的全部空間命中與多目標限制；所有 AI 反抗／逃脫分支；每條 HUD bar 與線色的精確綁定。影片同時出現兩個 Pull，不單憑影格推出「任意單圈一定可綁任意多隻」。

**目前正常手機／Web 入口仍是部分完成**：已接入未帶入角色的原作進場生成；正常 AI、工具操作、捕獲演出及完整 capture-to-Home 尚未串好。`vs2Screens.js` 的工具殼仍設 disabled，`huntRuntime` 保留未閉合輸入的邊界。已有 port 和本次 ROM 成功重播不等於正常遊戲入口已可完成上述操作。

下一個可驗收單位是同一場地內，正常工具選 Rope → 畫圈放開 → 拖拉／鬆繩／斷繩 → HP0 倒下 → 手掌 → 卡片容量 → 結果 → 返家保存。9:16 只調整資訊配置與座標適配，手指直接操作同一 Pixi 場地；保留現有 DOM 工具與單一 store/save/ticker。

本次沒有新增玩法或替換目前 UI，也未宣称全部道具／所有數碼獸已完整驗收。

## 7. 來源更正與重跑

- [既有影片總索引](ORIGINAL_VIDEO_EVIDENCE_INDEX_2026-09-03.md)：提供 V08–V10、V50 等定位；其早期「數值未知」由後續 CPU／觸控研究補充。
- [捕獲資料流](HUNT_CAPTURE_DATAFLOW_2026-09-05.md)、[原作實際觸控](HUNT_LIVE_CAPTURE_2026-09-05.md)：數值／操作來源。
- [最新倒下與收取階段修正](HUNT_PHASE_PORT_AND_RESIDENT_MIGRATION_2026-09-05.md)：AI10 倒下時鐘不能用舊的另一條 W+50C 動畫判斷取代。
- [正常進場整合](../art/HUNT_NORMAL_ENTRY_INTEGRATION_2026-09-06.md)：生成已接好，仍不代表捕獲可操作。
- 舊 `tetherSystem.js` 註解說160不是 rope邊界，屬較早分類器研究；本次採用直接 OVL0 拉繩執行結果，該旧檔不作原作數值依據。

```powershell
python scripts/research/trace-hunt-native-touch.py --rom R:/Projects/Championship2026/_archive/hunt-history-2026-09-06/ui3/original.nds --state C:/Users/USER/Downloads/DS/StateSlots/8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1.ds4 --private-dir R:/Projects/Championship2026/_archive/hunt-confirmation-2026-09-08 --out reports/hunt-capture-confirmation-2026-09-08/native-touch-replay.json
python scripts/research/trace-hunt-capture-closure.py --rom R:/Projects/Championship2026/_archive/hunt-history-2026-09-06/ui3/original.nds --out reports/hunt-capture-confirmation-2026-09-08/native-distance-and-card.json
node reports/hunt-capture-confirmation-2026-09-08/verify-native-replay.mjs
```
