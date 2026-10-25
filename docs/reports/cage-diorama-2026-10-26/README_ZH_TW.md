# 籠子微縮沙盤質感批次（2026-10-26）

這是 Owner 確認的 37 張籠子微縮基線，目前只在本地；有沒有發布，以 Owner 另外的授權為準。

## 範圍

- 37 個 `assets/production/cage/three-20261021/field_*.glb`：只換掉 baseColor 貼圖。改動是地面重繪，以及 BVH 光線投射算出的接觸陰影。
- 各 GLB 的 Draco 幾何資料逐位元組不變，所以可走格、碰撞和支撐三角形的位置與索引雜湊都沒變。
- `ranchThreeScene.js`：只改牧場 3D 場景的光源。
  - 暖主光 `#FFF1D6`，強度 2.7。
  - Hemisphere 光：天空 `#C9DDF2`、地面 `#5D6B45`，強度 2。
  - 陰影 `radius 3`、`intensity .82`。
- 跟著更新的雜湊鏈：manifest、`physical-ground-tops.r2.json`、`SUPPORT_METADATA_SHA`、`logical-stair-bridges.r1.json`、`LOGICAL_BRIDGES_SHA`、兩份公開合約，以及測試釘值（friends runner、filmstrip `BASE`、cm18/cm34 remap fixture）。

## 驗證

- 遊戲渲染器（`ranchThreeScene.js`，SwiftShader）37 張前後對照：
  - draw calls 與三角形都不變；
  - reduced-motion 下畫面穩定；
  - 沒有新增黑色像素；
  - 同主題成對籠子的接縫與右緣循環都已檢查。
- 角色快篩：把 Agumon 依原生比例疊在 CM08、CM04、CM11、CM07、CM21 上，輪廓都清楚。
  - 角色材質是 MeshBasic，加上 `toneMapped:false`，所以新光源不會影響角色本身。
  - 綠草地上的明度對比變低了（CM11 從 73 降到 29），但色相對比仍然足夠。綠色系角色站在草地上是剩下要注意的情況。
- 20 個聚焦測試檔通過；`build:playtest` 與 `validate:playtest` 通過。
- 未驗證：手機實機效能、人工遊玩。

## Backlog（不在本批處理）

- CM21、CM35、CM37 的地形或斷崖重建模。目前保留已發布地形，只套用質感層。
- 道具倒角、樹冠球面法線、`COLOR_0` 頂點 AO。這三項都要重新編碼 Draco，也要重做 8 張支撐籠的支撐資料。

製作方法見 [`docs/art/production/ART_PRODUCTION_DIORAMA_TEXEL_PASS_ZH_TW.md`](../../art/production/ART_PRODUCTION_DIORAMA_TEXEL_PASS_ZH_TW.md)。腳本與證據放在 R 槽 `cage-diorama-20261025\`。
