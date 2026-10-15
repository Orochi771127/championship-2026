# Data Arena 資產來源清單（2026-10-15）

本批次**沒有新增任何圖檔、音檔或字型檔**。

| 用途 | 來源 | 權利／核准狀態 |
|---|---|---|
| 玩家拍檔（鎧焰蜥 species-034、曦冕幼獅 species-064、雪晶幼龍 species-061）、隊友（極潮角獸 species-073）、守衛（墓焰暴君 species-146）角色圖與 HUD 小圖 | 既有 `assets/production/characters/accepted-20261010/<folder>/`（`runtime.review.json`、`main.json`、`main.webp`、`hud-r01/main-cell_000.webp`），經 `accepted-original-character-selection.r1.json` 以唯讀方式選取並核對 `entityId`／`sourceBankSha256` | 沿用 2026-10-10 Owner 雜湊選定的公開試玩授權（`ACCEPTED_ORIGINAL_RUNTIME_20261010`）；同一 `isOriginalRuntimeLocation` 閘門（loopback 或核准公開網址）。`rightsDocumentVerified=false`、`commercialReleaseAccepted=false` 不變；本批次不改變任何權利狀態。 |
| 角色動作序列語意（站立 0、走 2、攻擊 7、受擊 6、倒下 15、勝利 33） | 既有 `battleCharacterAction.js` 中以 CPU 核對的通知→序列對應 | 只讀重用，未改動原資料 |
| 角色名稱 | 既有 `text/zhHant.js` `speciesNameForId` | 只讀 |
| 場地、掩體、水面、火焰、冰面、敵方「雜訊」三種、彈幕、雷射、觀眾、燈光、UI | 本批次程序生成（`dataArenaTextures.js` canvas 繪製、`dataArenaPixiScene.js` 向量烘焙）、CSS | 原創，隨程式碼授權；執行時生成、離開時銷毀 |
| 音效 | `dataArenaAudio.js` 以 WebAudio 振盪器與自產雜訊即時合成 | 原創；走既有音量／靜音設定 |
| 音樂 | 既有原創音樂目錄的 `battle_normal`／`battle_final`／`victory`／`defeat` cue | 沿用既有已發布音樂 |

參考來源（僅方法／產品原則，未複製角色、名稱、招式、美術、音效、UI 或地圖）：BigKidNation Pokémon Arena（大型場面、觀眾競賽感）、pokesurvivor（走位／成長循環）、Claude-Code-Game-Studios v1.0.0 `984023ddac0d5e27624f2baacde6105e45de375f`（MIT；vertical-slice／playtest-report 方法結構，未複製文字）。

## 第二輪補充（錦標賽、四招套組）

仍**沒有新增任何圖檔、音檔或字型檔**。

| 用途 | 來源 | 權利／核准狀態 |
|---|---|---|
| 錦標賽對手：潮鬃海豹 species-047、焰核炎靈 species-113、赤棘暴龍 species-102 | 同一 `accepted-20261010` 選集，經 `dataArenaArtRecord` 唯讀選取並核對 `entityId`／`sourceBankSha256`；名稱來自 `speciesNameForId` | 同上（公開試玩雜湊選定；`rightsDocumentVerified=false`、`commercialReleaseAccepted=false` 不變） |
| 招式名稱、說明、數值、預告、彈體材質（`bolt`）、對戰表、HUD | 本專案原創（`dataArenaConfig.js`、`dataArenaText.js`、`dataArenaTextures.js`、CSS） | 原創 |

**參考與機制邊界**：Pokémon Zarza Arena（https://pokemonzarza.com/poke-arena.html?lang=en&avatar=red、https://pokemonzarza.com/play-guide.html?lang=en）。

- 第一次嘗試被代理拒絕（403）。
- Owner 調整網路後，以 HTTP 讀取公開頁面與前端規則檔（`play-guide-copy.js`、`poke-arena-rules.js` 等）做純文字研究：未執行其程式，未下載或使用任何圖、音、字型，檔案只留在本機暫存區，不進 repo。

取得的是**節奏原則**：

- 四招＋終極；
- 能量回復與輕重招分工（便宜快招 vs 長前搖大招）；
- 閃避有明顯冷卻；
- 小場地讓雙方隨時在射程內；
- 柱子阻擋直線攻擊；
- 重擊會把對手打飛、撞牆受傷；
- 錦標賽每輪有時限；
- 波次生存為獨立模式。

本產品的數值、場地、招式、名稱、角色、美術、音效與 UI 全為原創，每招機制類型記錄在 `DATA_ARENA_MOVES[].mechanic`。Pokémon 相關名稱與角色不在本產品中出現。
