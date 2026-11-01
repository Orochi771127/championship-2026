# 共用招式特效 Web Atlas（292 格）回報

日期：2026-11-01｜分支：`feat/vfx-five-layer-20261101`（PR #138 之上，已 commit 並推到 PR #138）

## 1. 這輪做了什麼

- **新增 82 格原創特效**，以程式繪製，沒有任何圖片輸入或 AI 生圖。涵蓋 11 組 bank：bubble00、walaser00、unchi00、lightball02、toge00、dark01、onpu00、tatumaki00、rock00、seed00、snowcrystal00，另外重繪了 beam01 與 blacksmoke04。
- **與原本的 210 格合併成一張 2048×2048 圖集**，共 292 格。原本的 210 格逐像素複製，每格的可見像素雜湊都已比對，與來源完全相同。
- **網頁打包**：
  - 使用 MaxRects（best short side）排版，每格四周至少保留 2 px 透明邊。
  - 4 px alpha 顏色外擴：透明像素取最近實色，線性取樣時不會吃進黑邊。
  - 同一份像素輸出兩個檔：無損 `effects.webp`（exact），以及最佳化過的 `effects.png`。
- **載入**：
  - webp 優先，失敗時改用 png。
  - AI 對戰、圖鑑、Data Arena 三處都改讀同一張圖集，只有一張貼圖。
  - 圖鑑在第一顆「預覽必殺」按鈕出現時就開始非阻塞預載，兩張圖集並行下載。圖集到位後按下即播，不需等待。
- **招式綁定**：
  - 暗系備援格改為 dark01（黑洞弦月），音波改為 onpu00（霓虹音符）。月系元素點綴也改為 dark01。
  - 木、冰、土、風在 AI 對戰與圖鑑原本就綁了 seed00、snowcrystal00、rock00、tatumaki00，這輪補上 Data Arena：
    - 技能本身風格沒有格子時，改用元素格；
    - 近戰命中時加上元素點綴格。
- **移除 r2**：模組 `sharedVfxRemakeR2.js`、r2 素材與 r2 腳本全部刪除，r2 的格子已併入 292 圖集。ART 索引條目改為 `art:vfx:original-shared:review:292-r1`。

## 2. 檔案大小對比

| 項目 | 位元組 | 說明 |
|---|---:|---|
| **effects.webp（新，無損）** | **1,072,574** | 2048²，292 格，瀏覽器優先載入 |
| effects.png（新，最佳化） | 1,869,730 | 同一份像素，作為 fallback |
| webp 相對 png | **−42.6%** | 解碼後像素完全相同（腳本內已驗證） |
| 舊：210 格 png + r2 png | 1,078,792 + 34,482 = 1,113,274 | 舊做法要兩張貼圖 |
| 新 webp 相對舊兩張合計 | −3.7% | 多了 82 格，下載量反而略少 |
| manifest.json / render.v1.json | 172,138 / 97,754 | 前者記錄來源與每格雜湊；後者是執行時描述檔 |

老實說：

- 2048² 解碼後佔 **16 MB 顯示記憶體**，舊做法約 9.2 MB。這是選單張貼圖的代價。
- 排版填充率只有 **50.2%**，圖集還有一半空位，可以再放其他 bank。
- 1024×2048 放不下 292 格。MaxRects 實測只能放進 203/272 格有內容的格子，所以採用你選的 2048 方案。

## 3. 自檢（Step 7）

- 新增格碰到繪製畫布邊緣（裁切）：**0**。第一次建置有 4 格（6:4、33:8、33:9、121:9），把設計留白從 22% 加到 45% 後歸零。
- 錨點落在格子外：**0**。snowcrystal00 #5 的原生錨點本來就在格外（origin y = −1），這是原始資料的規格。
- 外擴缺口：**0**。指的是緊鄰亮色像素、卻仍是黑色的透明像素。
- webp 解碼後與 png 逐像素相同；兩檔 sha256 都寫入 manifest，測試會再驗一次。
- 任兩格之間至少 4 px 間距（各 2 px 邊），測試逐對檢查 286 格。
- 一個修正：toge00 一開始畫成翠綠色，但戰鬥系統把這個 bank 歸為土系，木系招式名會再轉色，結果變成藍色。已改為琥珀土色晶刺，木系名稱轉回綠色，土系維持原色，見截圖 3。
- 涵蓋率（565 個具名招式）：至少用到一格原創格 **90.4%**（上輪 89.9%）；全部格子都是原創 75.6%。

## 3b. 美術自審（2026-11-01，合併前）

做法：把每組重繪 bank 的原生序列依 tick 排開，上排原作 ROM 圖格、下排新格，同為原生 2 倍。對照圖含 ROM 像素，只留在本機研究資料夾，不進 repo。另外統計 `battle-moves.r1.json` 裡每組 bank 實際用在蓄力、發射、本體還是命中。

| bank | 實際用途（招式數） | 對照原作 | 判定 |
|---|---|---|---|
| bubble00 | 發射／本體／命中各 4 | 小泡→破泡；新格為能量泡→環形破裂，尺寸節奏一致 | 通過 |
| walaser00 | 發射／本體／命中各 4 | 原作為螺旋水環；新格為水彈＋濺花。發射第 2 格比原作大，屬可讀性取捨 | 通過 |
| unchi00 | 本體／命中各 6 | 毒核→擴散毒漬，結構相同 | 通過 |
| lightball02 | 蓄力／本體／命中各 4 | 本體日冕球與原作同形；命中原作是斜向閃光，新格是八芒星爆，同樣是命中閃光 | 通過 |
| toge00 | 發射／本體／命中各 3 | 飛行方向與原作同向（朝右）；原作 3 支、新格 1 支大刺 | 通過 |
| dark01 | 發射 2、本體／命中各 3 | 發射與命中共用 c0。原作是小環，新格較大，可讀性較好 | 通過 |
| onpu00 | 本體／命中各 4 | **原本不通過**：原作命中從小點擴散成大環，新格一開始就是滿尺寸。已改成 1 倍→3.25 倍逐格擴散 | 修正後通過 |
| tatumaki00 | 蓄力／本體／命中各 2 | 形狀與節奏幾乎一致 | 通過 |
| rock00 | 本體／命中各 1 | 一致 | 通過 |
| beam01 | 本體／命中各 2 | 橫段、直段、命中三種方向都對 | 通過 |
| seed00、snowcrystal00 | 沒有招式紀錄，只當作元素備援 | 雪晶一致；種子命中原作是火花，新格是發芽，屬於木系的重新詮釋 | 通過 |
| blacksmoke04 | 沒有任何招式或備援會播 | 原作是橘紅爆煙，新格是暗紫煙，且在暗背景上對比低 | **不通過，但不影響遊戲**；之後要用到時再重畫 |

與 Pokémon Arena 2D 的對照：它的招式特效全部用 Canvas 漸層加發光疊加即時繪製，沒有任何圖片。我們走的是原作序列幀路線，以 4 倍密度的像素畫呈現，再由五層系統補上光暈、粒子、地面痕跡和頓幀。Arena 2D 給的經驗是「分層＋命中後的痕跡＋頓幀」，這部分在上一輪的五層系統已經處理；圖格本身維持像素風，和原作及既有 210 格一致。

## 4. 測試

- `npm run test:ci`：**3,241 / 3,241 通過**（exit 0）。
  - 跑完後只重繪了 toge00 的顏色，之後重跑 `championship-vfx-five-layer-cases.mjs`，11/11 通過。
- `championship-vfx-five-layer-cases.mjs` 新增兩項測試：
  - 292 格圖集：2048²、邊距、外擴、webp/png 雜湊、webp 優先、ART 索引、僅限 loopback。
  - dark01、onpu00 與木冰土風的綁定。
- `championship-public-map-projection-cases.mjs` 更新 ART 索引雜湊。
- `npm run build:playtest` + `validate:playtest`：通過（7,819 檔），公開包內沒有 292 圖集。
- 發佈合約：
  - 移除 `sharedVfxRemakeR2.js` 那幾列；
  - 重新寫入 6 個改動模組的 sha（含 `originalSharedVfxReview.js`）。
  - 292 圖集不進公開版。

## 5. 截圖（手機直式，127.0.0.1:8814）

1. `phone-1-review-sheet.webp`：新增 82 格審查表。在瀏覽器內從 `effects.webp` 直接繪製，同時證明 webp 能解碼；紅十字是錨點。
2. `phone-2-bubble-unchi.webp`：
   - 圖鑑「焰角泡泡」是 bubble00 經火系轉色；
   - 「腐沼毒核」是 unchi00 紫綠瘴毒核；
   - 格子來源標記都是 `original-shared-292`。
3. `phone-3-elements.webp`：
   - 風「雲耳旋風」tatumaki00；
   - 木「苔角猛衝」seed00；
   - 木「花刺落英」toge00；
   - 冰「雪印寒掌」snowcrystal00 點綴；
   - 土「碎晶投石」rock00；
   - 月「朔月紗幕」dark01。
4. `phone-4-data-arena.webp`：Data Arena 接力。診斷資料顯示 `cells 292`、`sheets ORIGINAL_SHARED_292`、`src …/effects.webp`。

## 6. 範圍與注意事項

- 292 圖集只在 loopback 生效（`humanApproved: false`）。公開試玩網址仍使用已核准的 210 格，等你看過這批新格子再決定是否發佈。
- 在 loopback 加上 `?vfxShared=210` 可以退回 210 格比較。
- Data Arena 的格子在畫面上偏小（攝影機很廣，SCALE 5）。這是上一輪的倍率，這輪沒有改動。

## 7. 修改檔案

新增：
- `scripts/vfx/build_shared_vfx_web_atlas.py`
- `assets/production/vfx/original-shared-review-292-r1/`：effects.webp、effects.png、manifest.json、render.v1.json
- `docs/reports/vfx-five-layer-2026-11-01/web-atlas/`：本報告與 4 張截圖

修改：
- `src/championship/presentation/originalSharedVfxReview.js`：292 描述檔、webp 優先貼圖載入、驗證器接受兩種路徑
- `src/championship/presentation/juicy/showcaseBankCells.js`：圖鑑讀單一共用圖集，webp 優先，並行預載
- `src/championship/presentation/vfx/originalVfxCellArt.js`：Data Arena 只讀一張貼圖
- `src/championship/presentation/vfx/unifiedMoveVfxResolver.js`：dark → dark01、sound → onpu00、月點綴 → dark01
- `src/championship/presentation/dataArena/dataArenaElementFx.js`：元素格備援與近戰點綴
- `src/championship/app/main.js`：移除 r2 包裝層
- `assets/production/ART_PRODUCTION_INDEX.json`、`docs/contracts/championship/WEB_BUILD_INPUTS.v1.json`、`docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json`
- `tests/championship-vfx-five-layer-cases.mjs`、`tests/championship-public-map-projection-cases.mjs`

刪除：
- `src/championship/presentation/vfx/sharedVfxRemakeR2.js`
- `scripts/build-shared-vfx-remake-r2.py`
- `assets/production/vfx/original-shared-remake-r2-20261101/`
