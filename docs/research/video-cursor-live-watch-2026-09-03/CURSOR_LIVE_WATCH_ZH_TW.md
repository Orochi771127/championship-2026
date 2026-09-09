# Cursor 現場觀看原文（2026-09-03）

作者：Cursor 會話（Championship 2026，Owner = Terence）
性質：**現場瀏覽器抽樣**，不是逐幀索引，也不是 ROM 追蹤。
用途：給 Codex 做證據統整時的第三來源。
**不得**用這份粗掃覆蓋 `docs/research/video-BV13u411B7BK/` 的 52 條影格，也**不得**覆蓋 `docs/research/video-BV1RQ4y1B7up/` 的 20 條影格。

證據等級：

| 標記 | 意思 |
|---|---|
| `VIDEO_OBSERVED` | 這次會話在播放器裡直接看到 |
| `WITHDRAWN` | 同一會話先講錯、後來收回 |
| `NAMING_CROSSCHECK` | 畫面暱稱對上 ROM 名稱時的限制 |
| `PRODUCT_MAPPING` | 對 2026 重建的設計約束，不是原作像素座標 |

影格**不准**進 git。本機圖錄若存在，只在 `_archive/video-research/`。

---

## 0. 已撤回的錯誤（必須保留，避免之後又寫回去）

| 錯誤 | 原因 | 正確 |
|---|---|---|
| `WITHDRAWN`：第一支片沒有 Gate／地球 | 第一輪停在 **12:00**，那一幀還是育成牧場 | Gate Select 球形地圖在 **12:15**（系統分析另有 **00:45**、**12:41**） |
| `WITHDRAWN`：第一支片沒有套繩 | 12:30 看到的是 **Normal Wire α**，誤以為跟繩有關；12:55 工具列有捲繩但還沒拉 | Wire ≠ Rope。拉繩在第一支約 **01:01–01:04**（系統分析 V08–V10），第二支約 **04:29** |
| `WITHDRAWN`：把片裡的球叫成 `earth` | Owner 口語「地球」；畫面也像地球 | 可進遊戲的是 `gate_select/3D_worldMap_model`（OVL12 loader）。`earth.nsbmd` 有檔、**找不到 loader**，不是星球關卡 |

---

## 1. 影片 A — BV13u411B7BK

- 標題：数码宝贝---冠军
- 上傳：超丸Beletia-Tisha，2022-03-24
- 網址：https://www.bilibili.com/video/BV13u411B7BK/
- 長度：**13:17**
- 編碼：**360×748 直式**（上下兩塊 DS 螢幕疊在一起）
- 語系：英文實機。本機研究包是日文 YDIJ。標籤可對功能，**不能**當日文 ROM 字串索引證據。
- 作弊警示：HP/TP 常 9999、Funds 常 9999999。不拿來推養成速度或經濟。

### 硬體分工（每一個遊戲畫面都成立）

- 兩塊 **256×192**。上 = MAIN（非觸控）儀表。下 = SUB（觸控筆）場地／選單／工具列。
- 啟動 Logo 是單畫面 FMV，不是雙屏 HUD。
- ROM UI 常成對出現 `_main` / `_sub` NXR。`training_sub_scene.nxr` 的「sub」是 **Nitro 繪圖引擎名**，**不是**「畫在下螢幕」。HP/TP/AP、暱稱、籠子條、log 在**上螢幕**。
- NXR 的 x,y 是給 256×192 用的。**禁止**抄進 2026 出貨 CSS。

### 這次抽到的時碼（現場觀看）

| 時碼 | 畫面 | 上螢幕 MAIN | 下螢幕 SUB |
|---|---|---|---|
| 0:00 | Boot | epics + Actimagine Logo | — |
| ~0:03 | Hunt 場 | Spring / Day 5 / Hunt / 時鐘、雷達、Time 倒數 | 俯視草地 + 圓形工具列 |
| ~1:30 | Training 育成 | HP/TP/AP/Capacity、季節／日／Training／時鐘 | 等距牧場 + 目的地鈕 + 底列工具 |
| ~3:00–5:00 | Free Battle | VS HUD、隊名、倒數 | 2D 場、腳底圈；結果字在下屏 |
| ~8:00 | Challenge Gears | VS 120 | 沙地場 + READY! |
| ~10:00 | Shop（Hunt 插件） | 商品說明、Bits | 商品格 + Analyzer / Radar / Memory |
| ~10:30 | Cage Edit | 模組名稱、效果、Occupancy Limit | 綠色六角板（片中標 Playground） |
| **12:00** | Training 牧場 | Summer Day 1 Training | **跑道 + 森林 + 熔岩** 拼在同一塊等距板 |
| **12:15** | Gate Select | 「Select a map to go to」、預覽、**Entrance Fee**、Funds | **可轉的 3D 球**（綠洲、深海）在六角虛空上；虛線圓游標 + 綠色六角游標；Settings / Return |
| **12:30** | Hunt 裝備 | 道具說明 | **Normal Wire α**：鋪在地面擋路，Length 24。**不是套繩** |
| **12:55** | Hunt 場 | Time 07:40 | 野生精靈 + 游標；底列有**捲繩圖示**（這一幀還沒拉） |

系統分析另外證明：球形地圖 **00:45**（V05）、畫圈與 Pull **01:01–01:04**（V08–V10）、球形地圖再出現 **12:41**（V51）。現場觀看漏了開頭那兩段，**以系統影格為準**。

---

## 2. 影片 B — BV1RQ4y1B7up

- 標題：数码宝贝冠军赛前期攻略
- 上傳：風月Official，2021-10-12
- 網址：https://www.bilibili.com/video/BV1RQ4y1B7up/
- 這次現場觀看長度：**07:52**（系列另有後期片，這次沒看）
- 編碼：**640×360** 橫式。剪輯攻略：單屏放大、雙屏原作、作者對照表、字幕混在一起。
- **作者排版不是遊戲 UI。** 左右對照、條件表、插圖都不能當原作版面。

### 這次抽到的時碼

| 時碼 | `VIDEO_OBSERVED` |
|---|---|
| **~4:29** | 沙漠 Hunt：**Pull!** 浮字、綠色耐力／抵抗條、觸控點到目標的**紅線**、六角工具列捲繩高亮 |

現場觀看**沒有**凍到畫圈那一幀。系統補充分析後來補上：圈繩 ~04:29、Pull ~04:30、倒下／紅手掌 ~04:31、手掌收取特效 ~04:32，以及沼澤段 ~05:03 綠斜繩。統整時以 `video-BV1RQ4y1B7up` 為準，這份只證明「第二支也有 Pull 階段」。

Gate 球在這支攻略裡不如影片 A 的 12:15／00:45 清楚。不要用這支當 Gate 的主證據。

---

## 3. 畫面怎麼疊（原作，現場 + 既有研究）

1. 每塊螢幕自己的 NSCR 底板（六角 UI 板、Hunt／Cage／Battle 地圖）。
2. NXR 節點把 HUD／工具釘在該 256×192 上。
3. 生物是 **SUB 場上的 2D 精靈**。戰鬥 Nitro 3D VFX 蓋在 2D 場上，**不會讓場景變成 3D**。
4. 戰鬥腳底圈是表現標記。2026 站位仍是 `PRODUCT_AUTHORED`，影片不能當座標。
5. Shop／Gate／Cage Edit 是 **上屏說明、下屏選擇**。Training／Hunt／Battle 進行中則是 **世界在下屏**。

不能寫成「上面永遠只看、下面永遠只按」。

---

## 4. 對 Championship 2026 的約束（`PRODUCT_MAPPING`）

已決定、不要在統整時改掉：

- 一支手機 **9:16** 取代兩塊 DS。不是把兩塊螢幕上下貼成細長條就叫還原。
- **DOM** = 以前 MAIN 的儀表與選單文字。
- **Pixi** = 以前 SUB 的 2D 場（Hunt、牧場、戰鬥場、捕捉線、Pull 字、耐力條）。
- **Three** = 有界：Gate 的 **world 球**、戰鬥／天氣 VFX overlay。有 3D 特效 ≠ 該場景改 3D。
- Hunt 繼續 **一次一張大地圖**。牧場是 **多塊籠子拼成一塊生活場景**；現在 Raising 預覽 `field_cm01_01` **不是**原作牧場。
- 捕捉線／Pull／綠條走 Pixi，不要做成戰鬥那種 3D VFX。
- `shippingReady` 維持 false。
- 執行期權利只認 `assets/production/ART_PRODUCTION_INDEX.json`。研究包不可 HTTP 讀取。

---

## 5. 命名與容易混的東西

| 看到的 | 正確名稱／意思 | 不要做成 |
|---|---|---|
| 片裡可轉的球、Owner 說「地球」 | `3D_worldMap_model` + `bg_world` 六角底 | `earth.nsbmd` 星球關、Desktop 啟動器 |
| Normal Wire α、Length 24 | 鋪地擋路的狩獵道具 | 套繩 |
| 捲繩圖示、畫弧、Pull!、連線 | 套繩捕捉 | 清單框選、戰鬥 3D 命中特效 |
| 下螢幕 8 個金色圓鈕 | `toolbar.nxr` | 育成場那排自創 CAGE／DATA／SHOP／BATTLE／GATES |
| CARE 一顆 | 產品收斂 | 原作是先選工具再點生物（手／飼料／清糞／藥／傷藥／蛋白質） |
| 圖鑑 No.xxx／216 | 遊戲內書 | 不要改成 224。228 = 物種表；224 = 8 蛋 + 216 美術格 |
| Hunt 的 Time 倒數 | 這次出擊的時限 | 頂欄 HH:MM 日曆時鐘 |

工具列數法：現場／影片分析常寫「左起第 1–8 格」。ROM 合約是 **slot 0–7**。最右格 = 影片第 8 格 = **slot 7**。不要混用還去改 handler。

---

## 6. 這次觀看沒有證明的事

- 畫圈閉合容差、拉力公式、耐久扣減、多目標上限。
- Gate 旋轉慣性、點位命中、Rank 鎖的畫面回饋（help 文字是另一條證據）。
- 牧場格子座標（OVL15 仍 UNKNOWN）。
- Database／Tamer／Schedule／Help 完整內頁。
- 日文版與英文版逐字對應。
- 把 NXR 座標當 2026 layout。
