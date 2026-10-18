# PokéBonk 研究落地與技術債修正

日期：2026-10-18（Asia/Taipei）。候選版基底：`700996df05a598b88dce79285615753f3beed9b5`。
工作副本位於 `C:\Users\User\Documents\Codex\2026-10-18\task-2\implementation`。
階段紀錄：最初候選版與後續正式發佈驗證；最新結果見末節。

## 完成內容

1. **首頁素材交付**：保留四張原始 WebP，增加兩組可重建的縮圖／壓縮版本。
   手機版合計 **417,808 bytes**，大尺寸版 **626,146 bytes**；相較原本
   **5,350,394 bytes**，分別減少 **92.19% / 88.30%**。這是圖像 body 大小，
   不代表整站載入時間降低同比例。繁中首頁的 390×844、DPR 2 瀏覽器實測
   只請求四張 compact 檔；其他語言仍使用既有標題圖，但共享背景／角色縮圖。
   `build-title-delivery.py`、delivery manifest 保存來源 hash、輸出 hash、尺寸與 Pillow 版本。
   選擇在 TITLE lifetime 建立時固定，旋轉不會重抓另一套素材。
2. **生活感與回饋**：兩位首頁角色使用不同週期的輕微呼吸，原本腳底座標保留；
   減少動態、省電、影片、離開 TITLE／背景切換沿用生命週期。按鈕微動、競技場
   面板進場保持短暫，低畫質／減少動態不播放額外動畫。
3. **戰鬥可讀性**：輕擊保留局部閃光／火花／形變，不震動鏡頭；中重擊採 180ms
   鏡頭回饋間隔，重擊可覆蓋中擊。普通技能不會立即蓋掉絕招標語。
4. **升級卡與目標**：同一張升級表投影出目前 → 下一級與加成前後值，明確標示
   「升級加成合計；不是最終戰鬥數值」。橫向短螢幕三卡並排，直向可捲動。
   模式選擇顯示首次升級／首次勝利／既有最高分等下一目標，不增加獎勵或存檔欄位。
5. **iPhone Web App**：相對路徑 manifest、180/192/512 圖示、Apple meta、
   五語安裝說明。已安裝的 standalone/fullscreen 環境不顯示說明按鈕；
   提醒先匯出存檔，避免假設 Safari 與主畫面 App 共用儲存。
   保留既有自動方向與 safe-area，沒有強制橫向或加入離線快取。

## 本輪關閉的具體技術債

- 競技場 CSS 失敗原本被 resolve 為成功，失敗 `<link>` 留在 DOM，後續重試跳過載入。
  新 loader 依 document/URL 合併 pending、拒絕錯誤、15 秒逾時並移除失敗連結，允許再次請求。
- 全局 `FLASH` 原本讓同批所有 HIT 都被標成暴擊；現在只有具有明確 `critical` 歸屬的
  HIT 才能顯示暴擊。現有 tracker 沒有此歸屬時保持中性，不推測原作數值。
- 密集 HIT 持續疊加鏡頭晃動、技能標語互相覆蓋：採用強弱層級與閱讀時間門檻。
- 升級卡只有說明文字、重複等級且難比較：直接讀同一規則表，移除重複等級顯示。
- 選角圖片載入失敗顯示破圖：使用既有 fallback 樣式，事件隨畫面 lifetime 清理。
- 新靜態 manifest 原本不在打包路徑允許範圍：精確加入根目錄 `manifest.webmanifest`，
  新模組／素材接入既有 WEB_BUILD_INPUTS，不放寬其他路徑。

## 驗證與證據邊界

- 91 項焦點案例：新增 7 項可靠性／投影／manifest／預算測試，以及既有 title、Data Arena 回歸。
- 6 項戰鬥案例：事件、鏡頭、強度與相同輸入下 HP／結局不變。
- 40 項設定／結算案例：減少動態、畫質、存檔隔離與已結算收據不重複發獎。
- 共 **137 項通過**；不是完整專案 CI。
- 正式 browser bundle compiler 成功產生 100 個輸出，11,876,411 bytes（全部分塊合計，不是首頁初始傳輸量）。
  modulepreload 檢查 278 個啟動模組；`git diff --check` 通過。
- 隔離 Chrome：正常首頁、安裝說明與焦點返回、390×844／844×390、待機與 reduced-motion、
  競技場進退、真實鍵鼠輸入到第一次升級、三卡預覽、選卡暫停／繼續、養成存檔不變。
  JavaScript page error 為 0。使用軟體／桌面瀏覽器，不當成 iPhone 或 GPU 效能證據。
- 首頁與選角完成補齊資源後沒有 404；實戰驗證因稀疏副本缺少三個角色 runtime、
  場景與互動素材，使用**遊戲現有 fallback**。這一輪驗證互動與升級畫面，
  不宣稱完整角色／場地美術驗收。原始 404 清單保留於 browser.json。
- 測試伺服器只綁定 loopback，優先讀候選版；三個既有音樂／頭像檔從 R 槽唯讀提供。
  沒有讀取使用者瀏覽器存檔，沒有寫入 R 槽的遊戲檔案。

截圖與原始結果位於本資料夾的 `evidence/`；測試入口與建置檢查工具存於
工作區根目錄 `review-browser.py`、`prepare-review.mjs`，不是產品 runtime。

## 未完成／下一階段

- **未發佈**：專案 `AGENTS.md` 明定 commit/push/merge/deploy 需要適用授權；過往批次的
  發佈授權不涵蓋本次。尚未更新公開 playtest approval hashes，也沒有觸發 Pages。
- 稀疏副本沒有整套美術，**完整 production build/validate 與完整 CI 尚未執行**；
  程式打包成功與正常局部流程不取代這些 release gates。
- R 槽 HEAD 為 `94207e6e…`，比公開候選基底舊，且已有 `main.js`／`opening.css`
  的孵化過場修改。本輪沒有覆蓋或把它們錯當自己的修改；後續整合須以檔案／hunk 保留。
- 實機 iPhone：加入主畫面、系統列／瀏海、背景恢復、音訊手勢、Safari 與 Web App
  存檔可見性仍待驗證；不承諾隱藏所有 iOS 系統 UI。
- 大型新地形玩法、全角色動作資產、更多互動背景、全局 CSS 舊覆寫與原作未追證
  義務未在本輪清完。本輪沒有為了「清技術債」重寫模擬、存檔或引擎。

## 後續發佈授權（同日）

Owner 已明確授權 commit、push、整合 main、發佈與本機／GitHub 同步。發佈準備新增 manifest 與公開 JSON 相同的 schema／私有內容檢查，使用正式名稱 Cyber Partner: Tournament，新增第 8 項焦點測試。先前「尚未獲發佈授權」屬候選版當時的紀錄，後續以本節與發布回條為準。初次完整 CI 在素材未齊的稀疏副本執行，缺檔失敗保留原始結果；補齊後重新執行，不降低 CI 範圍。

## 最終發佈檢查

完整 CI **2,585／2,585 通過**（0 fail、0 skipped）。最終正式 playtest 建置、validate 與精確公開 payload 檢查通過；產物 **7,708 檔**，build ID `1dcc44cb892330c86653211c1f25e0369c0f68f619108c36f4c3a5764636b288`。新增程式與資產已加入既有精確 allowlist，Web App manifest 亦執行與 JSON 同等的 schema／私有內容檢查。沒有放寬原有門檻。

使用正式產物與完整素材的 Chrome 正常入口、手機／橫向畫面、安裝說明、競技場進退、首次升級、暫停／選擇／恢復與養成存檔隔離均通過。**0 page error、0 缺檔、0 fallback**，已取代候選階段的缺圖限制；截圖為 evidence/release-*.png，結果為 RELEASE_VALIDATION.json。實機 iPhone 未驗收。

R 槽原本的 5 個孵化草稿檔與 5 個碰撞素材已逐檔雜湊備份；草稿另有 stash 與 preserve/local-hatch-draft-20261018 分支。本次發佈不包含這些草稿。依 Owner 明確指示提交、推送至 main，觸發既有 CI／Pages；最終遠端工作流程及 live hash 回條另由發佈任務保存，不能由本機建置成功推定。
