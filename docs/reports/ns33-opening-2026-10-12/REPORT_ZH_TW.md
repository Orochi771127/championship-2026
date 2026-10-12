# NS33 片頭整合與發布驗證

基準 `ebcb41c6a17f718bdb2fa7065721f5696efc37f7`，隔離分支 `codex/ns33-opening-20261012`。既有主工作區、Claude 工作樹及玩家 8732 服務均未修改。Owner 已明確授權完成接入後 commit、正常 push main 與既有 Pages 發布。

唯一公開影片為 `assets/production/opening-film-ns33-r1/opening-720p-74e171ba.mp4`：14,563,538 bytes，SHA-256 `74e171baa7a3893a7e5e1274dab699339e9753733c1681ee18aff4f5dbaaf184`，720×1280、48.5 秒、1,164 frames、H.264/AAC、faststart，使用 Owner 原創 NS33 音樂。複製後已核對完全相同。未重製影片／音樂，未納入製作來源、分軌或原始音檔。

以既有 TITLE DOM 整合開場與手動觀看；略過／結束回 TITLE，連續 15 秒無操作才重播。選單、對話框、背景與其他畫面不重播。聲音須明確點擊並遵守全域靜音／音量；減少動態時僅手動觀看。載入拒絕、404、斷網與等待逾時可回 TITLE。沿用五語品牌、單一 save、router、Pixi application/ticker。詳見[契約](../../contracts/championship/NS33_OPENING_FILM_2026-10-12.md)。

既有 browser 共用 login helper 先讓影片以 8 倍速播放到原生 ended，再走原本 LOGIN／New Game／Continue；只調整 HTMLVideoElement 播放速率，不改應用時鐘、遊戲、故事或教學狀態。真實 48.5 秒播放與立即略過由獨立片頭 gate 驗證。三個回歸 gate 的 TITLE navigation 改等 DOM 與應用就緒，避免影片串流令 networkidle 等不到；保留所有原有斷言。

驗證：本機 CI **1,691／1,691**、最後聚焦單元／多語系 **15／15**、[片頭瀏覽器 15 情境](FOCUSED_BROWSER.json)通過。最終正式 build／validate **9,315 檔**，build ID `16c271e880e39bd1cb31417465e2b2bf86b7ce1838a1c56144506867cefa5172`。最後 LF／EOF 格式整理後，58 個實際執行的 bundle／HTML／CSS SHA-256 與已測版本完全相同。公開清單只有新增 4 檔、更新 3 檔，無移除；Git 暫存 bytes 逐一核對。

舊回歸結果分開保留：recent-integration **PASS**；int-rh2 **FAIL**（登入 BGM `net::ERR_ABORTED`）；ui-integration **FAIL**（6 個本機專用狩獵參考路徑）。以原基準 `ebcb41c6` 的 375 個已核對來源、原版測試／helper、相同 browser runner 與相同唯讀本機參考根目錄對照，後兩者重現完全相同的失敗路徑。詳見[基線對照與原始紀錄](LEGACY_BASELINE_COMPARISON.json)。它們沒有升格為本輪 PASS，也未放寬斷言或納入公開資產。Parent 在 2026-10-12 明確要求保留基線證據後繼續已授權發布；不擴大本次片頭修改。

本紀錄保留發布前檢查；實際 commit、同 SHA CI／Pages、公開檔案雜湊與公開 smoke 將寫入本機 `R:/Projects/Championship2026/ns33-release-receipt-20261012/` 的獨立發布回執。正式建置要求 `dist/` 輸出與實體依賴，本輪保留這些安全規則。

完整主觀試聽、physical iOS／Android 與實體装置表現仍為 **UNVERIFIED**。自動化播放／音量檢查不代表上述驗收完成。商業發行權利與完整原作 parity 旗標維持 false。
