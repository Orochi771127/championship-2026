# 正常 Hunt 進場：來源、生成與可回滾交易

日期：2026-09-06。正式 repo：`R:/Projects/Championship2026/championship-2026`，branch `main`，HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。保留共享工作樹與其他美術工作；沒有 commit、push、merge、部署或新建 router/store/save/Pixi/ticker。

**本輪完成目前正常 UI 使用的「未帶入角色」進場交易。完整 A 仍為 PARTIAL；正常捕獲返家 B/C 未驗收。** Owner 已授權此工作，後續已知工作不需要再取得開工許可。

## 正常玩家入口現在做了什麼

New Game 或具有已知 Hunt 歷史的 Continue → System/Hunt → Gate → Loadout → Begin Hunt，現在使用當前遊戲日曆、Gate biome 身份、歷史修正值及延續的 217-channel RNG，建立原作個體、初始 AI、位置與同種配置。現有 Pixi 畫面會顯示真正生成的物種，並使用同一次交易選出的 day/night field 美術。

正常入口不再使用固定六隻 prototype roster、Gate seed 生成地形或 prototype wandering。角色暫留在原作算出的初始位置；初始 HP 已有原作來源。相機仍沿用既有 2026 視窗控制與中心，不以畫面範圍重新排列野生角色。八個工具仍停用，normal owner 仍未輸出 `nativeAnimation`；這不是可操作的捕獲動畫交付。

## 來源與原作對照

| 項目 | 來源／驗證 | 本輪結果 |
| --- | --- | --- |
| Gate 節點 | 原作模型載入全新隔離 CPU，執行 OVL12 `0210C9D8` / ARM9 `0208A6B0` / `02001558` | 16 個節點向量與既有載入場景 CPU 結果一致；使用 biomeId，沒有使用 UI 字母排序索引 |
| 日夜場景 | 原作 `0210D1A4` 的節點／整點輸入 | 16 Gate × 22 個可處理小時 = 352 個 CPU case；Grass 13:00 選 native index1 |
| 初始地形 reader | 原作 constructor `0207C828` 將 wrap 設為0；`0207C9E8` 的實際返回值 | 29 張 × 16,384 格 = 475,136 格逐格一致；場外阻擋與 bit0 語義保留 |
| 初始方向 reader | 原作 `02088048` 逐格執行；離線 `.esc` 來源與 reader 結果一致 | 共 950,504 次地形／方向及場外 CPU reader calls；runtime 保存 targetQ12/blendQ12，不放原始 ESC bytes |
| 實際方向／地形消費 | 新 provider 直接供給已存在的移動 port | 208 次原作移動呼叫的完整 state 一致；僅 controller 結果仍來自該次 bounded replay |
| 四季場景條件 | `020CAA9C + nativeIndex*0x58`，四組 descriptor 欄位 | 32 個 regular index × 4 季；保留 primary/secondary presence、threshold、parameter，以及無資源也消耗的 channel0 |
| 正常整批生成 | 新 provider + 既有原作生成器 | 重現原作 15 隻角色的物種、HP、最終位置與全部217個 RNG channel 的最後狀態；既有492次逐抽樣比對仍通過 |
| 其他 Gate／季節 | 16 Gate × 4 季 × 7/13/22 時，延續同一 RNG | 192 個生成案例通過；這是規則／初始化測試，並非全部地圖與物種視覺 QA |

新 catalog 是功能性遊戲規則資料，與美術 manifest 分開。生成器只在離線讀取 hash-locked ROM，輸出不含原始模型、ATR/ESC 檔、mesh/texture、player RAM、checkpoint、預錄個體或未來抽樣清單。原始美術包沒有因這次整合而升級 shipping 狀態。

`scripts/build-hunt-scene-catalog.py --check` 通過。Catalog 為 UTF-8/LF，1,539,631 bytes，SHA256 `9d70f593bbf83e76b4d4e102578476b35a55160fe4850da9f636633df568bb09`。

## 進場交易與保存

`championshipStandaloneApp.beginHunt` 是唯一提交者。`prepareNativeHuntEntry` 以副本解析 Gate/clock/history、建立 pool、AI、位置及場景條件。既有 world 與 Hunt runtime 全部建立成功後，才一次替換 runtime、RNG、歷史及 screen；Save observer 看到的是完整提交後的狀態。提交期間拒絕 RNG 重入與離開 Hunt。

實測刻意在「已生成角色、runtime 尚未完成」時拋錯：仍停在 Loadout，RNG、歷史、舊保存內容不變，重試所得的角色與無錯誤進場一致。重複按 Begin Hunt 不會重抽。退出空場後重入會延續 RNG。具釋放歷史的個體會走原作特殊候選路徑，進場本身不清除歷史；返回／再捕獲的寫入仍由相應交易處理。

外層 Save 維持前輪 v5 與同一 key，沒有新增存檔 authority 或保存暫態野生個體。Save 失敗保留舊存檔，重試保存當前 RNG；Continue 後的下一次生成與未關閉應用的一致。

v1–v4，以及明確保存 `huntHistory:null` 的 v5，仍表示歷史未知。正常進場會在 Loadout 顯示無法進入的原因並保留原資料；沒有偷偷把舊歷史補成全零或要求覆寫存檔。

## 帶入角色的實際界線

本輪修正了先前「帶入者使用另一套初始 placement」的描述：帶入 slot0 與普通野生先走相同 `02065EB0` / `0206489C` 註冊。個體 `+004` 在共同註冊後寫成 entity slot；生成器現在保留該值，而不是 pool 階段的 `0xffffffff`。

隨後 `0211AA60..AA98` 才有額外分支：將第一隻 actor 的顯示欄位清零，以 priority128 發出 request45，然後呼叫 `02065CE8` 更新全部 active entities。

新增 probe 先透過原作 Gate 存檔與真實 stylus 到達註冊邊界，只讀取 RAM；再在隔離 Unicorn 中控制 carried flag，比較同一份原作註冊狀態的兩個分支。這是 **CONTROLLED_POST_REGISTRATION_BRANCH_ONLY**，不是帶入選角 UI 或完整帶入玩法驗收。結果：未帶入分支不執行額外更新；帶入分支執行230次狀態 dispatch，第一隻隱藏且 wildState=3，其他14隻 AI state=1/request4，AI+1D4 全部由0到1，位置不變，此受控案例沒有新增 RNG 抽樣。

目前 normal UI 沒有已接通的帶入個體來源；non-null carried 仍在 RNG 消耗之前明確拒絕。不能將上述結果直接概括成所有物種／狀態的完整首次更新。**下一個安全步驟是閉合並移植 request45 與整批首次 dispatch，再接正常 AI／工具生命週期；不能把帶入者當普通野生略過這次更新。**

## 驗證與輸出

- Focused：**53/53**。
- 完整共享工作樹 serial regression：**1052/1052**，88.339 秒，0 fail/skip/todo。
- `git diff --check` 通過；既有 CRLF 提示不是錯誤。
- 瀏覽器採獨立 origin `127.0.0.1:8737` 的測試存檔，未操作使用者 `8732` 的保存內容；390×844 走 New Game → System/Hunt → Grass → Tether → Hunt → Home → Save & Quit → reload → Continue → Grass → Hunt。兩次入場均無 console warn/error，單一 canvas、無橫向溢出、8個工具停用。截圖見 `reports/art/hunt-normal-entry-2026-09-06/`。
- 瀏覽器操作僅經公開 UI；數值與回滾驗證來自 headless app／原 CPU 測試，沒有以隱藏 state 注入代替正常入口。
- 依 `HUNT_SCENE_SOURCES.v1.json` 更新來源與接線界線；沿用 Championship 美術技能的 renderer/IP 分界與瀏覽器技能的正常 UI 驗證方式。

仍未驗收：帶入完整首次更新、原作 AI1/2/3 與非零目標、controller/工具採樣、正常 `nativeAnimation`、捕獲→Result→Home→Save→Continue、Battle、其他物種動作、UI/VFX 與完整視覺／實機 QA。

公開 Pages 本輪未重跑。`entities.r1.json` 仍是 tracked deletion，既有 build 的 `git ls-files` 路徑枚舉問題未在本輪處理；不宣稱公開 build 或 shipping 通過。

相關入口：[scene contract](../contracts/championship/HUNT_SCENE_SOURCES.v1.json)、[正常進場測試](../../tests/championship-hunt-normal-entry-cases.mjs)、[reader CPU receipt](../research/HUNT_SCENE_READERS_CPU_CHECK_2026-09-06.json)、[帶入分支 CPU receipt](../research/HUNT_CARRIED_REGISTRATION_CPU_CHECK_2026-09-06.json)。
