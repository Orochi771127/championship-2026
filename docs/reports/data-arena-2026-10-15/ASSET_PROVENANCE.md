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
