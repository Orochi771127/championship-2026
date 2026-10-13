# 手機 TITLE 入口成本（2026-10-13）

起點為乾淨隔離工作樹 `12c4b61ae3f97d801445de74e373f15704bb039d`，已公開的桌機商店／圖鑑保留。Owner 本機 main 未切換、reset 或 stash。ROM／研究 checkpoint 工作不在此批。

使用桌面 Chromium 的 Pixel 7 Chrome 模擬、全新 contexts／獨立 loopback port（非8732）、實際HTTP gzip／Range／瀏覽器快取。每種profile各兩組冷→熱載入；熱載入前，正常略過、按LOGIN並等現有TITLE四張圖完成。不限速與受控4 Mbps下載／1 Mbps上傳／150ms latency／4×CPU；測試正常原生720p影片，未注入媒體／app模型。`requestVideoFrameCallback` 記錄真正首幀；Skip→TITLE以可信LOGIN點擊成功、New Game顯示為終點，因此包含既有350ms手勢消耗。這不是Owner實機或公開網路實測。

改前正式artifact build ID `3892e19fae0ebcb3fb7fe0ae1067446fbbb380c7da01097a0f6df6e818227e42`，bytes已於上一批核對公開12c4b61a。artifact本機metadata保留提交前的892c6d26，不能把這欄誤當改前未含桌機修改。見 [8次改前原始量測](before-performance.json)。

4G冷載入的主要操作門檻：31個初始JS、4,148,641 decoded bytes、約879,631 transfer bytes；腳本最後收完約2.59秒，之後約0.30秒主執行緒長任務，到Skip約2.93秒／首幀3.93秒。Skip→可操作TITLE約0.43秒；熱快取到Skip約0.42秒／首幀1.04秒。完整TITLE四圖則在Skip後約15.4秒完成，與可操作門檻不同；本批不改其5.35MB素材或音樂優先序。沒有證據認定Owner實機的唯一根因。

最小修改：`main.js` 的既有Raising view、VS2／VS3／VS4／VS5 views及三個Pixi field presenters改由原本非同步foreground mounts取得。Battle Field／Result先await模組，再同步呼叫原factory，保留view建立與內部callback的順序；serialized mounting、來源、dispose、單一Pixi/ticker及native module cache均保留。已經延後的Pixi／Three／battleRuntime不是本批成果。同步app建立、`refreshContinue`、錯誤存檔判斷、影片／圖片／音樂／15秒idle全部原樣。source preload依既有工具從272減為232；只更新HTML／main兩筆產品核准hash，沒有新增媒體或選擇素材。

候選先以同一既有bundle compiler重新編譯code、沿用未變的正式媒體／圖像量測，不重跑整個public build；確定有限改善後才跑唯一正式CI／build／validate。最終正式artifact的 [8次改後原始量測](after-performance.json) 與 [比較表](comparison.json)（每格兩次平均，沒有統計顯著性宣稱）：

| 條件 | Skip 改前→改後 | 真正首幀改前→改後 | Skip→可操作 TITLE 改前→改後 |
|---|---|---|---|
| 不限速冷 | 0.246→0.250s | 0.410→0.446s | 0.416→0.397s |
| 不限速熱 | 0.052→0.054s | 0.157→0.145s | 0.381→0.465s |
| 受控4G冷 | **2.926→2.589s** | **3.927→3.614s** | 0.430→0.463s |
| 受控4G熱 | 0.424→0.428s | 1.041→1.048s | 0.408→0.412s |

初始JS由4,148,641減為3,508,726 decoded bytes（-15.4%），gzip HTTP transfer由879,631減為721,392 bytes（-18.0%）。SCC splitting產生較多較小共用chunk，初始請求由31變38；沒有宣稱請求數下降。冷4G到Skip提早337ms（-11.5%），首幀提早313ms（-8.0%）；其他條件及Skip後沒有明確改善。後者含350ms防穿透及測試60ms點擊重試間隔。不完整放大這個結果：TITLE四圖仍是另段較長等待，Owner實機根因未確認。

驗證：聚焦57項、正式CI 1761/1761（0 fail／skip）、`validate:preload`232通過；唯一正式build／validate 9396檔、build ID `85622a383dcff286c31638bbca4e768f55bd8b09e7f8d6062ce3d13fac10849d`。

- [片頭銜接8/8](title-buffer-regression.json)：720p／1080p實際播放、buffer warmup、resize/replay固定source、立即略過、停滯、背景取消、URL回收、reduced motion、QA Continue單一canvas。
- [原播放器10/10](film-regression.json)：連續略過／350ms消耗／14.9s input／menu/dialog block、背景返回、reject／404／network／slow回TITLE、4.2s首次等待與3s播放stall、兩種reduced motion、TITLE存檔不變與Continue。未重播無關全流程。
- [正常UI首次模組進入6組](presenters-browser.json)：Continue→Raising；Shop／Database／Cage返回；Gate→Loadout→真Hunt→返回；真練習Battle→Result→返回。沒有模型／RNG覆寫，沿用同一Pixi canvas，0 pageerror／缺檔。
- [桌面牧場尺度回歸](desktop-raising-regression.json)：現代／復古、五語40配置與原有拖放／選取／New Game界限；同一native尺度2，3個已放置籠子完整可見。沒有修改世界／碰撞／解鎖。
- [上一批橫向UI回歸100配置／20操作](desktop-browse-regression.json)：五語、兩風格、短高／390px／resize／滾動／焦點全部通過。輸出移至本批；上一批已提交回條與PNG保留。
- 改後8次量測的TITLE均未請求五個含实际field/screen presenter本體的chunks；實際music state為login、playing、initialBuffering=false、error=null。存檔皆仍null；media／圖片與語言資產未改。

`git diff --check`、scope與兩筆hash自審通過。物理手機／Safari、主觀完整聽感與商業接受未升格；不做部署遷移、素材刪除或畫質降低。

原用於桌面尺度的QA hook現可在split出的既有presenter chunk找到同一場景，沒有把hook加入產品。此報告為提交前驗收快照；精確SHA／CI／Pages／live bytes以本輪最終回報及 `.tmp/title-entry-publication.json` 為準。
