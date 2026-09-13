# 馴獸師頁原作資料接點 — 2026-09-13

YDIJ ROM SHA-256 `8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`。
使用 ndspy、Ghidra／pyghidra-mcp 反編譯 OVL4 `0210BB9C`，再用 Unicorn 執行原作數字欄位填入。
40 個 CPU 案例包含 10 個階級與 4 組完成度／對戰紀錄；數字繪製為替身，除法執行原作 ARM9 指令與 DS 整數除法暫存器模型。

| 畫面欄位 | 原作讀取 | 修正／保留 |
|---|---|---|
| 頭銜完成度 | player +0C0，61 筆、stride 8，非零個數／61 | 已接既有 won title IDs；是百分比 |
| 圖鑑完成度 | player +4EE，216 個 byte，非零個數／216 | 已接既有永久登錄表；是百分比 |
| 地圖完成度 | player +2AC，17 個 word，非零個數／17 | 已知來源，尚無對應永久 writer；不能以 4 筆放生歷史或 33 個 biome 代替 |
| 對戰次數／勝率 | player +4D8／+4DA，ushort | 已接既有 native title record；保留舊存檔未知；零場勝率尚未確認，不填假數字 |
| 姓名 | player 起始名稱緩衝 | 既有 opening 姓名；不經詞彙翻譯，避免姓名 HUNT 被改字 |
| 階級 | rank +5A2 查文字 | 已接 10 個階級的繁體顯示 |
| 持有金額 | player +4C8 | 沿用錢包 |
| 遊玩時間 | player +AEA 的分鐘／60、餘數 | 已知來源，尚無原作長期累積 writer，不能用遊戲日曆冒充 |
| 育成執照 | 020E1E24 + rank ×36 查 generation 文字 | 接既有 lifecycle rank generation |
| 收納容量 | 020E1E14 + rank ×36 | 修掉以目前居民隻數代替容量的錯誤；rank 0 =64 G，rank 2 =96 G |
| 設施格數 | 020E1E18 + rank ×36 | 接既有 14／16／18／20 格限制 |

完成度使用原作 Q12 四捨五入除法後截去百分比小數；勝率則另做嚴格大於半數的進位。不是共同使用 `Math.round(count / total * 100)`。

資料：[CPU 收據](TAMER_UI_FIELDS_CPU_2026-09-13.json)。重跑：`scripts/research/check-tamer-ui-fields-cpu.py --rom <private-ROM> --out <numeric-receipt>`。
本輪沒有新增存檔欄位或跨專案資料來源。欄位來源關閉不代表原作整頁美術／實體手機驗收完成。
