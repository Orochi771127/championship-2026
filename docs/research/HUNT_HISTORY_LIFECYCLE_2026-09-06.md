# Hunt A：遭遇率修正、放生歷史與原作存讀檔

日期：2026-09-06。**本輪完成原作返程 writer、歷史選擇與存讀檔生命週期的功能移植及比較。A 一般入口仍未完成；B／C 未驗收。**

Git root：`R:/Projects/Championship2026/championship-2026`；branch `main`；HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。初始 cwd 為上層非 Git 工作區；開工時463筆 dirty entries，保留既有共享成果。先讀當前權威文件／合約，使用 engineering:debug，並先查 championship-evidence MCP 的 `02067134`。MCP結果是同一ROM的歷史研究路徑；沒有引用其他遊戲產品程式或規則。

## 已閉合的原作行為

| 流程 | 原作指令與結果 | 驗證 |
|---|---|---|
| 歷史初始化 | ARM9 `02068824`：四格都是species228、biome33、trait8及預設名字；cursor0 | 執行原CPU；冷啟動實際觀察到初始化。這不宣稱所有New Game選單分支都驗收過 |
| 再次出現的放生個體 | OVL0 `0211A600`：只掃前三格，採第一筆地區相符、物種非228的紀錄；不旋轉、不消耗RNG | 16地區×5配置，共80個CPU案例；含同地區多筆與第4格不入選 |
| 帶入個體暫存 | 原先已驗證的池建構回傳slot3寫入；新helper把它套用到候選history，保留前三格及cursor | 與既有carried CPU receipt連用；沒有替帶入actor製造位置 |
| 一般捕獲返程 | `0211956C`：第一筆相同species的地區修正byte加1，上限8；先發生byte wrap | 0/1/7/8/15/254/255邊界；255→0是受控邊界，不能宣稱正常遊戲可達 |
| 重新捕回放生個體 | tag2清空本次選中的history slot：species228、biome33、空名；**保留該格trait** | CPU驗證選中槽清空、其他槽及cursor不變；不做一般捕獲的加1 |
| 帶入個體返程 | tag1存在於返程卡片時不加入放生歷史；帶入旗標為1且沒有tag1返回，才把slot3寫入cursor格，再`(cursor+1)%3` | 帶回／未帶回、3個cursor位置、混合卡片案例 |
| 返回卡片數值 | `0211977C`：每張卡片包含tag1/2都抽一次channel1，更新已定位的+008／+00C／+178 | 全228species及其他返程案例，共242張卡片、242次原RNG，結果與217-channel終點相等 |
| 原作存讀檔 | ARM9 `02069F2C → 0206AF34`，修正值`02072958 → 0207AD30` | CPU編碼／解碼比較，加上原作「存檔退出→重啟→Continue」實際觸控驗證 |

一個不能自行修正的細節：帶入個體未返回後的修正值減2，原作 `02119724` 使用 **`packedEntry & 0x700`** 比較，與一般species比對的`0xFFF`不同。本次原CPU確認：受控species0命中減2，species38沒有命中。實作要求provider供應獨立的`releaseMatchValue`，保留此條件；不將其改成看起來合理的species比對。

## 持久欄位與暫存欄位

- 原作保存前三格的species、biome、名字（5個UTF16單位）及循環cursor，沒有保存trait。**讀檔明確還原trait8**，不是完整history物件原樣JSON roundtrip。
- 第4格是帶入暫存，不進此段存檔。原loader不動該格；正常boot先由constructor初始化，不能把前次Hunt的slot3搬回來。
- 地區修正值共16陣列；原codec用154byte存放低4bit及對齊padding。功能存檔投影只需要有效陣列值，不能把packed ROM資料、pointer、catalog或padding塞進玩家Save。
- 已觀察到冷啟動的修正值為0、歷史為空；Continue再由存檔覆寫。**現有Web v1–v4從未記錄這些歷史，不能據此宣稱它們的真實歷史都是0。** Web舊檔遷移與正式provider仍屬下一段接線工作。

## 原作觸控存檔驗證

最後採用的完整紀錄在私有目錄`R:/Projects/Championship2026/_archive/hunt-history-2026-09-06/final-lifecycle2/`。開始於原作存檔確認畫面，來源checkpoint內已有明確受控的`TEST`歷史與修正值6；本次再設trait3、cursor2作辨識。操作是原作Save Yes、等待、reset、Title Login、Continue；沒有在讀檔後注入資料。

| 時點 | slot0 | cursor | 地區0前兩個修正值 |
|---|---|---:|---|
| 存檔前 | species38／biome0／trait3／TEST | 2 | 6、1 |
| 重啟後、Continue前 | 空species228／biome33／trait8／預設名 | 0 | 0、0 |
| Continue成功 | species38／biome0／trait8／TEST | 2 | 6、1 |

原作畫面顯示資料正常讀入，實體`runner/original.dsv`已建立。CPU讀寫觀察也命中上述save/load指令。這是**受控存檔生命週期證據**，不是自然生成個體或正常browser捕獲驗收。精簡receipt：[HUNT_HISTORY_LIFECYCLE_CHECK_2026-09-06.json](HUNT_HISTORY_LIFECYCLE_CHECK_2026-09-06.json)。ROM／電池檔／RAM／checkpoint／截圖仍只在私有研究目錄。

早期`save-load4..8`與`battery3..4`未通過：Windows Store Python位於受保護目錄，DeSmuME預設在host旁建電池檔，失敗後改用RAM，reset丟失該資料。觀察器現為Windows建立私有host，電池檔也留在私有目錄。Python套件的export docstring稱`.dsv`，但底層只接受`.sav`，已依實際結果修正。[DeSmuME路徑實作](https://github.com/TASEmulators/desmume/blob/master/desmume/src/path.cpp)、[備份讀寫與export實作](https://github.com/TASEmulators/desmume/blob/master/desmume/src/mc.cpp)用於診斷工具，沒有成為遊戲玩法來源。

## 實作、測試與範圍

新模組`src/championship/hunt/capture/nativeHuntHistory.js`提供初始化、首次匹配選擇、套用帶入暫存、保存／載入功能投影，以及返程history／modifier／card數值候選。輸入不完整會在消耗RNG前拒絕；輸出不修改現有history、modifier或card參照。RNG沿用呼叫者的現有217-channel物件，沒有新seed、store、save key、router或ticker。

研究oracle `scripts/research/check-hunt-history-cpu.py`執行原ROM指令；22組返程、80組歷史選擇、3組存讀檔比較。CPU返程跳過前綴UI dispatch，保留資料處理及RNG；新JS helper的範圍是history／modifier／card數值，不包含UI、時間欄位+BC、Home插入或存儲提交。`scripts/research/trace-hunt-history-lifecycle.py`則操作私有原作DeSmuME library，不宣稱操作可見的0.9.13 GUI。

重跑CPU：`python -X utf8 scripts/research/check-hunt-history-cpu.py --rom <private-rom> --field <normal-field.dst> --out <receipt>`。重跑觸控：`python -X utf8 scripts/research/trace-hunt-history-lifecycle.py --rom <private-rom> --state <save-confirm.dst> --private-dir <new-private-directory>`，stdin使用私有`final-commands.jsonl`。不覆寫使用者ROM或原始存檔。

Focused9/9；全套serial regression **983/983 PASS**；CPU receipt重建SHA一致；`git diff --check`通過。完整命令、hash、限制見[validation receipt](../reports/parity-audit/2026-09-06/hunt-history-validation.json)。沒有commit／push／deploy。

## 仍未完成與下一步

**原作history／modifier的writer與存讀檔欄位已閉合；Web正常持久接線尚未完成。** 這輪沒有改`beginHunt`或Save schema，`normalSpawnRuntimeBound`／`huntGenerationConsumesGameplayRng`／`normalEntryCapturePlayable`仍為false。

下一個工程段落是A剩餘的帶入actor註冊，以及正式季節／Gate／地形／場景功能provider；將已驗證history／modifier與現有app RNG作為同一候選交易接入一般入口，並在既有save writer處理New Game、Continue、舊檔缺失與失敗回滾。原始ATR／ESC、ROM資產與固定重播個體不能替代provider。A通過後才進B正常AI／工具／捕獲階段，最後C正常Gate01捕獲返家／存檔／重載。上述依然在既有Owner授權內。
