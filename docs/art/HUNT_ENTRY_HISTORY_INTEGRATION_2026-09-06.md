# Hunt 前置接線：功能來源與持久歷史

日期：2026-09-06。**完成正常 app 的 Hunt history／modifier 新遊戲、Save、Continue 接線；正常 Hunt 生成、捕獲與角色動作事件仍未接通。A 部分完成，B／C 未驗收。**

專案與 Git root：`R:/Projects/Championship2026/championship-2026`；branch `main`；HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。沿既有 `championship-art-production` 分工及 `engineering:debug` 的來源／consumer 對照流程；已有共享工作樹保留，沒有 commit、push、deploy。

## 本次實際接通

- `championshipStandaloneApp` 現在持有持久 Hunt 歷史及16組遭遇率修正。正常 New Game 使用已驗證的空歷史初始化；讀檔恢復三個持久槽、cursor與有效修正值。Gate／Loadout／Hunt／返家導航不重置此狀態。
- 外層 Save 升為v5，仍使用 `championshipModernSave:v1` 和同一 `ChampionshipPersistentSavePort`。原v1–v4沒有記錄過的歷史保留為 `null`，不冒充全零歷史；v4已保存的217-channel RNG完整保留。
- 保存前三個槽的species／biome／名字及cursor，不保存trait或帶入暫存的第四槽。Continue按照原作還原trait8及新第四槽。modifier保存低4bit，有效行長度來自正式目錄，沒有原始padding。
- 現有捕獲重播的Home提交也攜帶此持久slice，避免同一writer覆寫時遺失。重播沒有取得變更原作歷史的權力；普通返程writer仍待正常Hunt owner接入。
- 所有新資料先經候選還原／驗證。損壞存檔無法取代開啟中的session；寫入失敗保留原磁碟內容、目前記憶體歷史及RNG。

## 正式功能 provider

`scripts/build-hunt-entry-catalog.py` 從hash鎖定的原作ARM9建立 `hunt-entry.r1.json`，供 `nativeHuntSources.js` 使用。包含228種個體建構／祖先／初速輸入、16組地區catalog、32個一般Hunt index各4季，共128張功能遭遇表。provider要求明確的native index、season及完整modifier，無預設季節、Gate ordinal替代或固定生成個體。

祖先指標陣列不是ROM檔案中的已初始化資料。新builder在全新隔離記憶體載入ARM9，執行原作 `02098804..02099338` 的718條static-initializer指令，再讀取功能欄位；不使用玩家RAM、checkpoint或研究receipt。其228種結果與既有原CPU個體輸入逐項相等，包含祖先順序。

獨立驗證器 `scripts/research/check-hunt-pool-sources-cpu.py` 不讀產出的catalog。它在隔離原CPU中執行 `0211A57C..0211A588` 的來源選擇及 `0211B8E4` 候選consumer，對32個index、4季及modifier0／1／2／7／15共640例比較；使用明示的scratch allocator/free，沒有RNG呼叫。這些是受控CPU案例，不宣稱640種正常玩法皆已驗收。

原始ATR／ESC、場景指標、地圖圖像和固定重播個體未加入此catalog。美術manifest繼續只供presentation；provider屬既有gameplay模組。沒有搬動或重製原素材包，1541／164的既有美術盤點沒有因本次接線而改變。

## 驗證

- Focused64／64通過。涵蓋全物種／祖先／初速來源、全部640候選案例、既有完整個體池及RNG比較、原CPU歷史codec、非空存檔Continue、全部四版遷移、損壞拒絕、寫入失敗與重試、Gate往返保留，以及舊身份／經濟回歸。
- 手機瀏覽器390×844使用獨立本機來源 `127.0.0.1:8736`，未讀改使用者8732來源的storage。以可見UI操作New Game → Save & Quit → reload → Continue → Hunt → 草原 → Tether I → Begin Hunt → Return Home。Home/Hunt各一個canvas、沒有水平溢出，console error／warn為空。瀏覽器不注入存檔或個體。
- 瀏覽器只證實正常Save／Continue與既有導航可用。非空歷史、v5欄位及失敗原子性由headless app／CPU測試證實；沒有把DOM檢查說成底層存檔逐值檢查。
- 產物重建 `--check` 通過，LF輸出SHA-256 `9d76915304469991e62c5a7b70c2063b79a847f3841935a9008809c3e97778ce`。
- 完整回歸、diff檢查與檔案hash見 [verification.json](../../reports/art/hunt-entry-history-2026-09-06/verification.json)；[focused log](../../reports/art/hunt-entry-history-2026-09-06/focused.log)、[regression log](../../reports/art/hunt-entry-history-2026-09-06/regression.log)。

## 尚未完成與下一個安全步驟

正常 `beginHunt` 仍是prototype地形／六隻角色／漫遊；沒有消耗原作app RNG，也沒有把新季節pool provider當作可玩遭遇。一般Hunt的8個工具按鈕仍disabled。前輪完成的m003原作動畫與Pixi frame投影保留，但normal owner仍未輸出 `nativeAnimation`。本輪沒有新增可見捕獲動畫，也沒有完成捕獲返家驗收。

下一段先補齊正式Gate-node位置、地形／方向reader、場景條件及帶入actor註冊，將新provider與已存在的 `nativeHuntGeneration` 置於同一可回滾進場交易。舊檔缺失歷史仍須明確處理，不能歸零。通過A一般入口後，才接正常AI／工具／native phase與動作frame，再做C捕獲、卡片、Result、Home、Save／Continue。這些是工程／證據依賴，沒有新增Owner批准要求。

Battle、其他物種動作、圖鑑、UI/VFX事件、全圖視覺QA與164個診斷family未完成。本次未重跑公開Pages建置；既有deleted `entities.r1.json` 引用未修正，沒有公開build／shipping通過聲明。
