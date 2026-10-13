# 六角色 Battle 無損緊排 atlas 接入

只改六個既有 species 的 Battle Main 圖集表示；沿用同一 loader、動畫器、Pixi Application／ticker、router 與存檔。Raising／Hunt／其他角色與 Sub 保持既有選擇。不是低解析度版、未刪動作，亦未接入新命名／圖鑑／符號需求。

## 實際載入與算量

舊六張 Main atlas 基礎 RGBA8 算量 465,567,744 bytes（444 MiB）；新 **11 頁全部載入**為 125,843,456 bytes（120.013671875 MiB），減少 **72.97%**。每頁最多 2048×2048；完整尺寸、檔案 bytes／SHA 及 370 frame pixel SHA 在 `assets/production/characters/battle-packed-20261013/manifest.json`。原 main 壓縮 WebP 30.2613 MiB，新為31.5284 MiB，**下載增約4.2%**，request 6→11。

這是 actual loaded TextureSource pixel dimensions ×4 的基礎容量算量，不是 iPhone 實測 GPU／RAM。CPU 若有完整 RGBA 解碼副本約120.01MiB；GPU 若全部頁面以RGBA8上传，基础纹理亦约120.01MiB。两者分開列，不當作一定同時有兩份，不含driver／mipmap／VFX／HUD／場地等。沒有 `.game-dev/adapter.json`／相容 scenario，使用既有 repo Playwright／Pillow，不安裝新框架、不宣稱手機硬體量測。

Main frame 本來已裁切；此次重排移除格間空白，原 frame w/h、sourceSize、spriteSourceSize、trim、pivot／anchor、density、reviewGeometry、所有 Main/Sub sequence／ticks／loop 資料保留。生成器 `scripts/build-battle-packed-atlases.py --check` 實際重解 WebP，370 frame RGBA 逐 byte 相等；Node 契約同時核對原 runtime motion／geometry contract 及真實 Pixi Sprite 的各 sequence sample、anchor／orig／trim／bounds。

Battle 明確選新 runtime manifest及獨立 cache prefix，沒有先 decode 原 Main atlas。若新包失敗，不回退原大 atlas 或歷史低密度圖；沿既有載入失敗路徑處理。原始核准資料全部保留，公開僅新增六角色 lossless representation 的 allowlist／hash，沒有提升商業權利或原作 parity 接受狀態。

## 固定 seed A/B 證據與限制

兩個全新桌面 Chrome 390×844 QA context，所有請求由本機正式產物供應，正常 TITLE→Continue 到 seeded 教學 Battle；baseline 只在 QA 攔截把該選擇旗標改 false。以原生 animationFrame **1／31／61** 對齊，完整 Battle views 相同，真實 core 自然判決與保存結果相同。QA 保存 wall clock 固定，performance／ticker clock 照常由控制時鐘推進；serialized save bytes 亦相同。

11 個新 Main WebP URL 各 request 一次，載入 source 去重為11；沒有同時 request 六個原 Main atlas。退出 Battle 到結果後，捕捉到的 Main TextureSource 全部 destroyed。原有 asset scope 引用計數與 ImageBitmap close 路徑保留；沒有把 source destroyed 直接當作 OS/GPU 立即歸還全部實體記憶體。

各取樣區間 Pixi draw call 實測 A/B 相同（16／248／248）；這不是所有動作或 iPhone 上均無額外drawcall的保證。更多 pages 仍可能增加切換／batch代價，下載與request代價已明列。

**不宣稱整张Canvas逐像素完全一致。** 對齊上述frame後，390×473 Canvas 的差異為41／84／0 pixels，前兩個是少量邊緣取樣差（最多0.046%）；frame資料的RGBA逐byte仍完全一致、座標／anchor／完整Battle view皆相同。與atlas UV改變後的有限精度取樣相符，但未以獨立GPU測試確認此歸因；未改shader／採樣品質去掩蓋差異。前次以相同毫秒而非原生frame取樣造成较大呈現差、QA hook未匹配minified bundle及registry summary漏更新均已修正，不算產品根因。

Owner iPhone 自動回 TITLE 仍 **UNKNOWN**；此更新確實降低已載入圖集容量，不等於證明 OOM或重啟已根治。Root/Parent 可安排後續一次真機驗收，這批不要求 Owner 反覆試。

1743 個必要 aggregate、370-frame實際pixel check與精準 runtime/ownership回歸通過；final build／validate及exact SHA的CI／Pages／live bytes在最終receipt提供。未修改 parent 擁有的 CURRENT_PRODUCT_STATUS／TECH_DEBT_REGISTER。
