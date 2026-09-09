# Codex 任務：統整原作影片證據（禁止改遊戲程式）

Owner：Terence
發出：Cursor 會話，2026-09-03
產品：`championship-2026`（PixiJS 8 + 有界 Three.js，直式 9:16）
ROM SHA-256：`8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`

你這次**只做文件統整**。不要實作 toolbar、時鐘、牧場拼接、Gate 入場費、戰鬥結果頁、角色 224。不要 commit、不要 push、不要把影格或 ROM 解碼檔寫進 git。

第二份影片分析當時讀不到 Claude artifact（Page not found）。下面把稽核結論**整段交給你**，請併進索引，不要再去抓 claude.ai。

---

## 1. 你要產出什麼

主交付（新建，繁體中文）：

`docs/research/ORIGINAL_VIDEO_EVIDENCE_INDEX_2026-09-03.md`

這份要讓下一個 agent **先讀它就能知道**：哪些是影片直接看到、哪些是 ROM 已追、哪些是產品自創、哪些已撤回、哪些還不能發明。

同時做這三件文書（仍禁止改 `src/`、`assets/`、測試）：

1. 補完 `docs/research/video-BV1RQ4y1B7up/ANALYSIS_ZH_TW.md` 第 5 節：現在 Claude 稽核正文已在本提示第 6 節，把「讀不到」改成逐條對照結果。
2. 在 `docs/README.md` 的 Start here 表加一列，指向新的 INDEX（若 Cursor 現場觀看列還不在，一併加上）。
3. **可選、僅改註解／significance 文字**：`docs/contracts/championship/CHAMPIONSHIP_TOOLBAR_CONTRACT.v1.json` 的 `observedSubmenu.whatIsNotThere.significance`。它現在還寫 Shop／Battle／Gate「多半靠點牧場地點進入」。影片已直接看到**另一格工具列**展開 Help／Database／Battle／Save & Quit／Hunt／Shop。把這句改成「視覺入口在工具列另一格；ROM handler 仍 UNKNOWN_REQUIRES_TRACE」。**不要**把影片按鈕名寫進 `ROM_VERIFIED`，不要改 slot 幾何。

不要新增多份互相複製的長分析。INDEX 用表格＋連結指向既有 `ANALYSIS_ZH_TW.md` 與 JSON。

---

## 2. 必讀（這個順序）

1. `docs/research/video-cursor-live-watch-2026-09-03/CURSOR_LIVE_WATCH_ZH_TW.md`
   Cursor 現場觀看原文。粗掃。含已撤回錯誤。
2. `docs/research/video-BV13u411B7BK/ANALYSIS_ZH_TW.md`
   第一支片的系統分析（52 條影格）。**時碼與畫面以它為準。**
3. `docs/research/video-BV13u411B7BK/VIDEO_OBSERVATIONS.json`
4. `docs/research/video-BV1RQ4y1B7up/ANALYSIS_ZH_TW.md`
   第二支片補充（20 條）。捕捉階段 D／E（倒下、手掌收取）以它為準。
5. `docs/contracts/championship/CHAMPIONSHIP_TOOLBAR_CONTRACT.v1.json`
6. `docs/contracts/championship/CHAMPIONSHIP_STATUS_BAR_CONTRACT.v1.json`
7. `docs/contracts/championship/CHAMPIONSHIP_CAGE_RANCH_COMPOSITION_CONTRACT.v1.json`
8. `docs/contracts/championship/VS2_GATE_SELECT_3D_RUNTIME_CONTRACT.v1.json`
9. `docs/coordination/OWNER_DIRECTION.md`（2026-09-02 licensed pixels）
10. 本提示第 6 節（Claude 稽核）

影格在 repo 外：`R:/Projects/Championship2026/_archive/video-research/`。需要核對畫面時讀本機圖錄，**不要複製進 `docs/` 或 `assets/`。**

---

## 3. 證據誰贏（衝突時用這張表，不要發明第四套故事）

| 題目 | 贏家 | 輸家 |
|---|---|---|
| BV13 時碼、畫圈、Pull、球形地圖、兩組子選單、牧場拼接、Wire≠Rope | `video-BV13u411B7BK` 52 條 | Cursor 現場觀看的粗時碼 |
| 捕捉階段「倒下／紅手掌／手掌收取」 | `video-BV1RQ4y1B7up` | Cursor 只凍到 Pull 的那句 |
| Gate 3D 用哪顆模型 | ROM：`3D_worldMap_model` + OVL12 `0x0210C6FC` | 口語「地球」、檔名 `earth.nsbmd` |
| `earth.nsbmd`、`desktop/` 啟動器 | 有美術、**無 loader** → 設計參考，不出貨 | 「原作有 Desktop hub／地球關」 |
| 工具列 8 格幾何、mode 1/2 | `ROM_VERIFIED` 合約 | 把 NXR x,y 寫進 CSS |
| 第 7／8 格子選單按鈕文字 | `LIVE_FOOTAGE_OBSERVATION`（影片左起 1-based） | 宣稱 ROM handler 已追到 |
| 頂欄四格、四季 8 日、時鐘 24h | 影片 + `STATUS_BAR` 合約 | 育成場只顯示 `08:00` 當原作 |
| 日曆 cascade `4,8,24,60,400` | ARM9 `0x020C8A4C` | 用作弊片推時間倍率 |
| 戰鬥場還是不是色點 | **過期。** 2026-09-03 已有授權 11 張戰場 | Claude 稽核 9/2 那句 |
| 216 vs 224 vs 228 | 三個都對，語意不同 | 互改成同一個數 |
| Cursor 第一輪「片裡沒 Gate／沒繩」 | **WITHDRAWN** | 不要寫回 INDEX 當現況 |

影片格數是左起第 1–8 格。ROM 是 slot 0–7。最右格 = 影片第 8 格 = slot 7。INDEX 必須寫清楚，禁止把「第 7 格」寫成 `slot7` 而不加換算。

---

## 4. INDEX 必須包含的章節

用繁體中文。章節標題可微調，內容不可缺：

### A. 來源清單

兩支 Bilibili、系統分析路徑、Cursor 現場觀看路徑、Claude 稽核日期 2026-09-02、ROM SHA。標明：英文實機 vs 日文研究包；作弊存檔；攻略片有作者排版。

### B. 已撤回聲明

把第 3 節「輸家」裡 WITHDRAWN 三條寫進正文，避免之後的 agent 只讀 Cursor 記憶又寫錯。

### C. 雙屏 → 9:16 怎麼對

表格：原作 MAIN／SUB 在各模式放什麼，2026 的 DOM／Pixi／Three 對應什麼。強調：有 3D 特效 ≠ 場景改 3D；`training_sub_scene` 的 sub ≠ 下螢幕。

### D. 畫面／流程證據索引（連結，不重貼長文）

至少覆蓋：

- Boot → Continue → Training（沒有 Desktop、沒有 Today）
- 頂欄 Season | Day N | Mode | HH:MM
- 工具列 8 圓鈕；**兩組**子選單（管理五項 vs 系統六項）
- CARE 六工具 vs 產品一顆 CARE
- 牧場：Cage Edit 六角板 + Training 多地形拼接（跨格輪廓存在；Occupancy ≠ 佔地格數）
- Gate Select：3D world 球、Entrance Fee、Settings/Return；**不是** earth
- Hunt：鏡頭拖曳 ≠ 走路；Wire ≠ Rope；圈繩 → Pull! →（第二支）倒下／紅手掌 → 手掌收取 → 結果名單
- Shop 上說明下選卡
- 戰鬥：戰前編隊／策略；場上自動打；上屏總覽下屏現場
- End Day ≠ 退出 Hunt ≠ Save & Quit
- 第二支多出來的：Tamer 牌照、非對稱 1vs3、賽事種類／屬性限制、八日曆格

每列給：證據檔 + 代表時碼連結（用已有 `?t=` URL）+ 對 2026 的含義（一句）+ 若仍 UNKNOWN 就寫 UNKNOWN。

### E. 與成品的差距（畫面層，不是缺 catalog）

資料層（商店 118、圖鑑槽、Cage 身分、Hunt 裝備、戰場 11）不要寫成「還沒做」。差距在：自創五顆 nav、工具列 RAW 不能按、頂欄只有時鐘、牧場單張 loader、Gate 全開無入場費、Raising HUD 過瘦、VFX 26 僅 `?vfxArt=` 預覽。

### F. 禁止發明清單

閉合容差、拉力／耐久公式、牧場 slot 座標、match→arena 對照、Hunt 晝夜選擇器、BM03/BM04 動畫語意、戰鬥站位、把 earth 掛進 runtime、Desktop hub、把 NXR 座標當出貨 layout、把 216/224/228 合成一個數。

### G. Claude 稽核對照表

用第 6 節逐條：`仍成立` / `影片支持` / `過期` / `未在這兩支片證明`。不要開新的實作工單除非 Owner 下一則訊息要求；可把稽核建議順序 A→F **抄成「尚未授權」**，不要開做。

---

## 5. 硬性禁止

- 改 `src/`、`assets/`、`tests/`、production index、`shippingReady`。
- 新增或提交 PNG／GLB／ROM／Nitro。
- 把 Cursor 粗掃時碼寫成比 V08／V05 更準。
- 把 `earth.nsbmd` 寫成 Gate Select 執行期模型。
- 把 Wire 寫成套繩。
- 把產品五顆 nav 寫成原作。
- 實作或「順便修」toolbar／clock／ranch tiling。
- 更新 `CURRENT_PRODUCT_STATUS.md`（那份過期，但不在本次範圍；只在 INDEX 註一筆「狀態檔日期 2026-08-30，勿當授權美術現況」即可）。

---

## 6. Claude「Championship 原作對照稽核」正文摘要（2026-09-02）

來源：https://claude.ai/code/artifact/47455915-26d7-4a98-a874-b5e4b48fe12f
同一顆 ROM。查了 96 NXR、22 OVL、help_text 170。Owner 影片只作 layout，不存影格。

**現在仍成立（2026-09-03 授權像素批次之後）：**

- 標題 Continue → `Data loaded.` → **Training / Raising Home（OVL18）**。這條路沒有 Desktop、沒有 Today。`championshipScreenStack.js` 初始 `RAISING_HOME` 正確。
- `desktop/` 3D 啟動器與 `gate_select/earth.nsbmd` 有檔、**無 loader**。設計參考。禁止出貨 Desktop hub 或地球星球關。
- 能玩的 Gate 3D 是 `3D_worldMap_model`（OVL12 `0x0210C6FC`），底是 `bg_world` 六角格。Bilibili 球是這顆 **world**，不是 earth。
- Help #100／#101／#102／#96：Rank 鎖 Gate、入場費、各 Gate 棲息（Hunt 綁定已做）、晝夜 Light 道具。現在 16 Gate 全 `AVAILABLE`、無入場費、無晝夜狀態。標籤 01–16 不是 GateIcons；沒有 `obj_world_time`。
- `training_sub_scene.nxr` 的 HP/TP/AP、暱稱、籠子條、狀態、log 畫在**上螢幕**。75 個 ROM 節點 vs 現在過瘦的 COMPANION LINK。
- 牧場是籠子咬邊拼接。跟「一次一張住民場」loader 衝突。Hunt 維持單張；牧場要另開拼接路徑。slot 座標 UNKNOWN（OVL15）。`cover1/2/3` x=170/194/218、y=8、pitch 24。
- 頂欄：Season | Day N | Mode | HH:MM（Shop 會拿掉時鐘）。現在育成場多半只顯示 `08:00`。Cascade ARM9 `0x020C8A4C`：4, 8, 24, 60, 400。help #96：一數碼日約 10 真實分鐘。
- 育成 CAGE／DATA／SHOP／BATTLE／GATES 是**產品自創**。原作是 `toolbar.nxr` 8 圓鈕，y=184/178、pitch 26，`submenu_origin` (167, 162)。現在 8 格仍是停用 RAW。
- CARE 收斂了六個 ROM 工具。原作：選工具再點生物。
- 遊戲內圖鑑 `No.xxx / 216`，不是 224。228 = ARM9 物種表；224 = 8 蛋 + 216 美術。不要互改。
- HTML title 缺 WORLD（原作 *DIGIMON WORLD CHAMPIONSHIP*）。
- 執行期仍用 3 隻 VS1 展示生物；`creature-species.r1.json` 228 筆未被 `main.js` 當戰鬥／育成主資料。
- 資料層大致齊（商店 118、稱號 62、隊伍 152、預設 456、戰場 11、招式 596）。缺口在**畫面與接線**，不是缺表。

**2026-09-03 已過期：**

- 「Battle Runtime 還是色點」→ 授權 11 張戰場已載入（3:2 帶 contain-fit）。VS HUD 仍是產品自創。
- Hunt／Cage 授權 runtime 包已存在；牧場仍未拼接；Gate 仍無費／Rank／晝夜。
- VFX 26 overlay 只有 `?vfxArt=` 預覽，沒有戰鬥／天氣呼叫端。

**稽核建議順序（尚未授權實作）：**
A 讓 8 格 toolbar 活、拿掉自創五鈕 → B 四格頂欄 + 時間軸 → B2 牧場拼接（Hunt 仍單張）→ C 育成上屏 HUD → D Gate 費／Rank／晝夜 → E 戰鬥結果多頁 → F Today／Tamer／Help。

---

## 7. Cursor 現場觀看裡，系統分析沒寫成「產品約束」的部分

這些要進 INDEX 的 PRODUCT_MAPPING，不要當成新的影片發現：

- 2026 三渲染器邊界：DOM 選單、Pixi 2D 場、Three 只給 world 球與 VFX overlay。
- 捕捉回饋走 Pixi，不走戰鬥 Nitro overlay。
- 授權像素進 runtime 必須經過 `assets/production/` + `ART_PRODUCTION_INDEX.json`；研究包不可 fetch。
- VFX 包 `gateEarthMounted: false` 必須維持。

---

## 8. 完成定義

- INDEX 存在，且一個沒讀過這次聊天的 agent 能靠它分清 world／earth、Wire／Rope、兩組子選單、sub≠下螢幕。
- BV1RQ 第 5 節不再寫 Page not found。
- 沒有 `src/` 或素材 diff。
- 沒有把影格路徑寫進 runtime 會讀的 JSON。
- 工具列若有改合約，只動 `whatIsNotThere.significance` 那一小段，並註日期 2026-09-03。

寫完用幾句繁體中文向 Terence 報告：INDEX 路徑、改了哪些檔、刻意沒做哪些實作。
