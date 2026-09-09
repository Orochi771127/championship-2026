# 美術資料存在與遊戲實際使用的區分

2026-09-05 補充，回應 Owner 指出美術包內容尚未接入遊戲。

基準：`R:\Projects\Championship2026\championship-2026`，`main`，HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7` 加目前未提交工作樹。本次重新檢查來源、載入條件及素材檔雜湊，沒有新增美術接入或修改遊戲。

**整套美術尚未整合。不能把 224 角色、96 UI 場景及美術包檔案數當作遊戲內完成數量。不過，目前並非所有原作美術都零使用：已有部分轉換後的場地圖接到遊戲，角色／UI／事件美術則有很大的缺口。**

私有資料夾不被瀏覽器直接讀取，與「內容完全沒用到」是不同問題。現有程式的來源鏈是美術包／faithful 工作區 → `assets/production` 內的 PNG 與 manifest → 場景 loader。Hunt、Battle 的 promotion scripts 明確讀取 `YDIJ_PRIVATE_ROM_ART_PACK/03_MAPS`；Cage 從 repo 中的 faithful-hd40 基準轉出。這是既有鏈路盤點，不是本次執行 promotion，也不新增任何權利判定。

| 類別 | 目前普通遊戲入口怎麼使用 | 嚴格判定 |
|---|---|---|
| Cage 場地 | `main.js:171` 載入 Cage manifest，依放置籠子取得圖；沒有放置資料時使用預設 `field_cm01_01`。`main.js:288` 在育成場景實際呼叫 | 部分接入。本輪之前的同工作樹瀏覽器截圖已見樹／水泥管場地；這不代表所有籠子配置與原作拼接都完成 |
| Hunt 場地 | `main.js:144` 依所選 Gate 的 `originalFields.dayFieldId` 載入；`huntArt` 為可選的 QA 覆寫 | 普通入口有 loader 綁定；manifest 可供30 fields，不代表已逐一完成30場地的瀏覽器及玩法驗收 |
| Battle 場地 | `main.js:227` 依 battle presentation 的 arena field 載入；目前預設 arena 0；`battleArt` 為 QA 覆寫 | 普通入口有 loader 綁定；11 fields 已打包，但賽事→場地的完整對應未解 |
| 角色 | `main.js:69` 只有 `?characterArtReview=m201` 才載入單一 remix 技術檢視包；普通入口的角色仍有幾何 fallback | 224角色美術沒有完整綁定到實際個體與動作。單一review角色不能計成全角色接入 |
| 原作 UI／工具圖示 | 主要画面由 DOM/CSS 及文字建構；96 UI工作區不是96套已投入遊戲的畫面 | 原作UI美術未完整接入。DOM本身符合架構，問題是美術／版面／狀態的綁定覆蓋不足 |
| 戰鬥 VFX | `main.js:246` 沒有 `?vfxArt=` 就直接返回；有參數才掛review overlay | 預覽可用；一般戰鬥沒有依命中／技能等事件自動綁定全部26systems |
| 食物與照料物件 | 上一份稽核確認 FEED 尚未接空地投食命令，也沒有場景落肉流程 | 不能因美術包內存在道具或動作就算餵食美術整合完成 |

本次重新檢查 runtime manifests 引用的圖片：Cage 40 fields／44 frames、Hunt 30 fields／45 frames、Battle 11 fields／11 frames；共100個圖檔引用全部存在，SHA-256 與 manifests 一致。這證明可載入資源完整，**沒有把100個圖檔算成100個已驗收遊戲狀態**。

角色缺口可以定位到具體綁定：`raisingPresentationSource.js:51` 以目前 `speciesId` 查 sprite contract，找不到便回傳 `sheet:null`；`raising-home-presentation.v1.json:25` 卻仍只有舊三款 `greyshade-cat`、`blazetail-kit`、`crystalfin-seahorse`，與目前 `species-*` 身分不對應。育成 renderer 於 `createRaisingFieldPixiPresentation.js:244` 建立幾何 fallback，戰鬥 renderer 於 `vs5/createBattleFieldPixiPresentation.js:114` 畫隊伍圓形。這是資料與 renderer 中間缺少身分／動作綁定，不能靠把素材資料夾放在專案旁邊解決。

角色 faithful-hd224 與 UI faithful-hd96 manifests 均仍宣告 `runtimeEligible:false`，`src`／入口及 production index 沒有對這兩個工作區的引用。工具列 `championshipToolbar.js:183`、`:189` 使用文字 span。`data-original-scene` 標記及96場景JSON只能證明原作參照關係，不能證明原作UI圖像已載入。

來源位置：

- `src/championship/app/main.js`：普通場景 mount、map loaders、character/VFX query gates。
- `src/championship/presentation/runtimeMapArtBundle.js`：場地圖 URL 及載入政策。
- `scripts/promote-licensed-hunt-runtime.mjs:20`：Hunt來源為私有包 `03_MAPS/hunt-30-variants`。
- `scripts/promote-licensed-battle-runtime.mjs:20`：Battle來源為私有包 `03_MAPS/battle-11-native-gallery`。
- `scripts/promote-licensed-cage-runtime.mjs:21`：Cage來源為 `docs/art/production/cage/faithful-hd40`。
- 同目錄 `feed-ground-after-wait.png`：上一輪已實測的普通育成畫面，可見原作來源場地及幾何角色；本補充没有冒稱重新執行瀏覽器。

後續美術接入應以「一個真實遊戲狀態使用哪個素材、由哪個事件觸發、是否有fallback、是否通過畫面驗收」逐項追蹤。優先範圍可收斂為育成場景：目前個體的正確外觀與已知動作、籠內食物物件、工具圖示與狀態資訊。食物接近／食用動作仍需原作動作及事件依據，不能用美術存在反向補造玩法。
