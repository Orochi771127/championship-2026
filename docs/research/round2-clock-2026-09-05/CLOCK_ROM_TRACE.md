# 第二輪：原作 shared clock writer、起日與 normal cadence

日期：2026-09-05。工作 repo `R:\Projects\Championship2026\championship-2026`，branch `main`，HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。本資料夾只含研究程式與有限指令／數值 receipt，沒有 ROM、overlay payload 或 runtime dependency。

本輪先查 championship-evidence MCP：`020C8A4C`、reports 中 `clock` 沒有結果；`じかん` 找到原作 help CSV physical line 98／entry 96，只有「一天約十分鐘」的描述。MCP 來源雖位於歷史 `R:\NEXUS LINK\原作\research-only\YDIJ_FULL_ROM_DECONSTRUCTION_2026-08-29\analysis\text\help_text_txt.csv`，這是 Original YDIJ 研究素材，沒有使用 Nexus Link 的產品程式、存檔或規則。CSV hash `2e2e188c86580547f2eae84d47ef0eb2d13ec9c6d54a48f160ee70e2f08c9962`。檢索結果僅供線索；下列 binary checks 直接讀 Owner 附件 ROM。

可重跑：

```powershell
python docs/research/round2-clock-2026-09-05/clock-rom-check.py
```

[clock-rom-check.py](clock-rom-check.py) 對 exact SHA-256 `8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1` 驗證後輸出 [clock-rom-check.json](clock-rom-check.json)。目前 **132／132 靜態檢查通過**。包含原指令、literal 解址、所有 overlay 的 direct ARM B／BL clock-call census。這不是受控模擬器實測，也不宣稱完整間接呼叫與所有模式語意都已閉合。

## 已閉合的 shared clock 結構

全域 base 是 `0x0210AA94`。舊 Status Bar contract 把 `0x0210AA98` 當成 400 units/minute 的總計數，並推測 day divisor 為 576000，這部分應撤回。

| Offset | 原作作用 | Binary evidence |
|---|---|---|
| +0 byte | year counter；reset 0；自然 year wrap 最多加至 99 | `0207B9E8/0207BA0C`、`0207BB04..0207BB10` |
| +4 | 本年 world minutes；即 `0210AA98` | writer `0207BAE4..0207BAEC`；hour reader `0207BCFC` 直接除 60 再 mod 24 |
| +8 | 已轉換 elapsed 單位的次分鐘餘數 | `0207BABC..0207BAC4`、`0207BB14..0207BB24` |
| +0C | 待加 world minutes；本輪未閉合所有 setter | writer `0207BB28..0207BB50` |
| +10 | 日結門檻分鐘，1320＝22:00 | initializer `020987B4/020987C4/020987E8` |
| +14 | 這次更新的 world-minute 增量 | `0207BAE0`；育成其他系統有消費者，副作用另追 |
| +18 | elapsed units / world minute；全域預設 400，Training entry 改成 200 | `020987F0/020987F4`；setter `0207BDAC`；OVL18 `0211CF94` |
| +1C | 自然時計到達 22 時後的日結旗標 | `0207BB54..0207BB6C` |
| +20 | running flag | `0207BBD4` stop；`0207BC14` resume |
| +24 | 起日分鐘，420＝07:00 | `020987D4/020987EC` |
| +28 | lock，為非零時 tick、start／stop 受限 | `0207BA20`、`0207BC54/0207BC68` |
| +2C | minutes/year＝46080 | initializer `020987C8/020987DC/020987E4` |
| +30 | days/year＝32 | initializer `020987D8/020987E0` |
| +34 | minutes/season＝11520 | initializer `020987C8/020987CC` |
| +38 | minutes/day＝1440 | initializer `020987B8/020987BC` |
| +3C/+40 | 上一次 64-bit hardware-timer sample | `0207BA44/0207BA48`、`0207BB74/0207BB78` |

季／日讀取仍是 `0207BC9C`、`0207BCCC`，但是它們使用 **minutes** 的 divisor 11520／1440。4／8／24／60 cascade 本身保留，400 是 elapsed-to-world-minute 的分母，不能再乘進 saved minute-of-year 的 calendar divisor。

年 byte 的數值是 0..99；UI 年份是否另加 1 不在本次範圍。舊 2026 存檔缺年份，不得從今天或檔案時間推補歷史年。

## 起日、22 時與 End Day

ARM9 `020987A0` initializer 從 60 計算 `60*7` 寫 +24，從 60 與 22 計算 +10。新局 `02001024` reset，`02001028` 讀 literal `0210AAB8`（base+24），`02001030` 呼叫 `0207BB8C` 指定當前分鐘，因此**原作新局 07:00 已有 writer 證據**。緊接著 `02001034` stop，待育成 entry resume。

自然 update 先加入分鐘與處理 year wrap，然後 `0207BB54` 讀 hour；`hour >= 22` 才呼叫 stop 並設日結旗標。它**不是先把任意大 delta clamp 到 22:00**。web 對背景／大 delta 的限制屬 lifecycle 保護，不可描述成原 ROM 的精確 clamp。

育成 loop `OVL18:0210D610` 讀日結旗標，非零時要求 state 10（`0210D620`）。其完整日結 effects、動畫、生命與進化 writers 本輪未閉合；所以純時計到 22 時停止不等於完整自動日結已完成。

同一日結 state record：`021281FC` entry 指向 `0210FA30`，`02128214` update 指向 `0210FAA4`。entry 的 `0210FA34` 先 stop，清除次分鐘餘數。update 讀分鐘／小時與 +10/+24/+38，計算：

```text
(dayEnd - currentMinuteOfDay) + (minutesPerDay - dayEnd) + dayStart
= 1440 - currentMinuteOfDay + 420
```

然後 `0210FAFC` 呼叫 shared add helper `0207BD88`。故下一日落在 07:00、次分鐘餘數 0 有 entry→update 鏈。**add helper 本身只相加，沒有 year wrap**；手動日結跨年最終由哪一後續 phase 完成仍需追蹤。2026 的共同純 cascade 可以做日期算術，但不能把這點說成已完整驗證原作日結 pipeline。

## 正常育成時計頻率

`0207BA18` 沒有以瀏覽器 frame count 或預設 600 秒推時間。它讀硬體 timer `0200896C`，對 64-bit 差值做：

```text
convertedElapsed = floor((timerDelta64 << 6) / 33514)
accumulator += convertedElapsed
worldMinuteDelta = floor(accumulator / elapsedDivisor)
accumulator -= worldMinuteDelta * elapsedDivisor
```

timer 讀寄存器 `04000100`，設定 control `0xC1`。devkitPro 的 [timer definitions](https://github.com/devkitPro/calico/blob/master/include/calico/gba/timer.h) 定義 bit 0 的 prescaler＝64、bit 6 的 IRQ 與 bit 7 的 enable；[libnds timers.h](https://github.com/devkitPro/libnds/blob/master/include/nds/timers.h) 記錄 33.513982 MHz timer source。這支持 convertedElapsed 是約毫秒的整數值。33514 與硬體精確每毫秒 33513.982 有微小近似，且 **每次 update 都先 floor**。

固定 native cadence 的 ROM 呼叫鏈：

```text
OVL18 0211DED8 -> ARM9 020437D0 common loop
    -> [Raising vtable +8] at OVL18 021289A4 = 0207AFF8
    -> ARM9 0207B018 -> 0207BA18 clock update
    -> ARM9 020437EC -> 02008F70
    -> 02006388(clear=1, IRQ mask=1), wait next selected IRQ
    -> common-loop next iteration
```

devkitPro [IRQ definitions](https://github.com/devkitPro/calico/blob/master/include/calico/nds/irq.h) 將 mask 1 定義為 VBlank。melonDS 的 [GPU hardware scheduling implementation](https://github.com/melonDS-emu/melonDS/blob/master/src/GPU.cpp) 定義每列 `355*6` bus cycles、每幀 263 列。因此**正常未落幀的原作 cadence**可表示為精確有理數：

```text
native frame seconds = 560190 / 33513982
native timer ticks per frame = 8752 or 8753 (prescaler phase dependent)
floor((8752 or 8753) * 64 / 33514) = 16
global base divisor 400 / 16 = 25 native frames per world minute
normal Training divisor 200 / 16 = 12.5 native frames per world minute
```

這不是從 help 倒推的「60 Hz 所以 16」。由 ROM common loop→VBlank、timer divider／conversion 及 primary hardware implementation 共同支持。clock-rom-check 對 64 種 timer prescaler phase 全部計算，所得 convertedElapsed 都是 16。

2026 可從既有 ticker 的 elapsed 累計出虛擬 native frame，再以每個 native frame 16 raw elapsed units／當前 divisor 餵同一個純時計，避免瀏覽器 30／60／120 Hz 改變結果。若純時計選擇 canonical 400 units/minute，**Training 每個 native frame 換算為 32 canonical units**，不能冒稱 canonical units 就是 Training 原始 +8 餘數。也不能把 browser 每幀直接當 native 每幀。

範圍限制：上述是正常未落幀 cadence；原機 CPU stall、非常態長 frame、跨 thread／interrupt jitter 的實際分布沒有受控量測，不宣稱逐 instruction 時序完全復現。第一個 elapsed sample 原作僅建立基準，不加入時間。

OVL18 `0211CF90/0211CF94` 的 `400 >> 1`（200）路徑已擴追至正常 Training scene entry。`0211DEA8` 是該 scene main，`0211DEC8` 呼叫 entry `0211CE88`，無條件在其末尾設 divisor 200；`0211DED8` 進 common loop；`0211DEDC` 呼叫 exit `0211CFCC`，其首段 `0211CFD8` 恢復 400。**因此 Training 整場基準是 200，並非尚未命名的加速功能。** earlier 122-check receipt 的 provisional「200 語意未知」已由 132-check receipt 取代。

Training entry 最先 `0211CE8C -> 0207AE74 -> 0207AEA0 unlock -> 0207AEA4 stop`，清餘數後才改 divisor 200。exit 先還原 400，末尾 `0211D0C8 -> 0207AF50 -> 0207AF64 stop` 清餘數；這兩段沒有插入 common clock loop。這給 canonical 表示一個已驗證的 scene 邊界：離開時丟棄 raw 餘數，而非按新 divisor 改比例保留。

Shop main `OVL17:0210C344` 的 `0210C364` 呼叫 entry `0210C218`；entry `0210C21C` 同樣走 common-enter stop，`0210C374` 才進 common loop；exit `0210C2C0` 走 common-exit stop。因此 **Training→離場清餘數→Shop 入場仍 stopped** 的 entry/exit 鏈已知；Shop 中全部互動的無 resume 聲明仍受下面 census 限制。

## Mode / overlay 矩陣與停止條件

| 場景／狀態 | 本次已知 | 可以宣稱的範圍 |
|---|---|---|
| 正常育成 entry | scene entry 設 divisor 200；`OVL18:0210EBBC` resume；common loop 每 VBlank update | 每 native frame 16 raw／32 canonical400 units |
| Tool submenu | 無完整 UI→handler→stop／resume crosswalk | `UNKNOWN_REQUIRES_TRACE`；不得因 submenu 覆在育成畫面就猜它走時或停時 |
| 育成兩類 modal | `0211B24C` stop / `0211B370` resume；`0211C6DC` stop / `0211C74C` resume | 只證明這兩對 handler，UI 語意未知 |
| Shop entry/exit | 已有 entry→common stop；exit→common stop，Training 先清餘數再離場 | 入場停時計已知；Shop 全部互動路徑未全部驗證 |
| Help / Database / Schedule / Digimon / Cage | common wrappers 有 stop，對應 overlays direct-clock census 無獨立 resume，但尚有間接 handlers 未閉合 | `UNKNOWN_REQUIRES_TRACE`；沒有 direct resume 不是完整暫停證明 |
| Hunt | `OVL0:02116CA4..02116CB0` 在 session+0xA8 != 2 才 resume | conditional resume 已知；數值 mode 2 的完整語意未映射 |
| Battle | `OVL19:02110004..02110010` 只在 session+0xA8 == 6 resume | 至少一種 Battle 時計會走；不能 blanket 宣稱所有 Battle 暫停 |
| Battle Result | direct-call census 未見 resume；完整 transition 未追 | `UNKNOWN_REQUIRES_TRACE` |
| 自然達 22 時 | stop、day-end flag；育成轉 state 10 | 時計停止可用；自動日結副作用仍 partial |
| 背景／鎖屏／離線 | 原作沒有 browser visibility API；本輪未追 NDS sleep 的完整狀態鏈 | 2026 lifecycle gate，不得當原作離線成長規則 |

clock resume 與 stop 都清除 hardware sample／次分鐘餘數。2026 保存所有時間餘數是跨保存精度要求；若在實際 ROM stop／resume 邊界保留餘數，需分清工程保存精度與原作丟棄邊界，不能把兩者混成同一聲明。

下一個受控實驗：在同一 `.ds1` baseline 記錄 `0210AA94..0210AAD8`，依序只打開／關閉一個 toolbar submenu 或一個目的模式；每條軌跡保留 VBlank 數、timer sample、running／lock／divisor／remainder、minute-of-year 與 year。再對 stop／resume 的 caller 做 UI handler crosswalk。缺這條證據時，runtime 可以保留明示的未接入 gate，不可將它升為原作暫停規則。
