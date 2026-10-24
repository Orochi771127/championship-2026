# 選單圖標與 click cue 發布準備

發布範圍：11 個專用選單圖標，以及已接的 select／open／back。Owner 2026-10-24 14:09 UTC 授權「做好以後就發佈吧」（`Sentinel_1c2f90da8e488191904551f4cbe2ce49`）；14:29 UTC 重開 League 後授權從既有分支續做（`Sentinel_fa6251ce2fa48191a82c1b51deacf80f`）。這不是商業發售或未完成 cue 的驗收。

## 範圍與保留

- 完整離線候選保留於 `feat/ui-completion-candidate-20261024`、`85078ebf13cbe725fdfa8493f1ed08e6d674753f`；發布準備位於 `release/ui-menu-cues-20261024`。
- GitHub 連接器重新讀取遠端 main，仍為 `105fafbd4d6a736476a414825e0dcfcf8ef8611c`，與產品差異起點相同。另一本機 main 的未發布修改不混入。此 SHA 保留為發布前 rollback reference。
- 11 個 entry.id：tamer、schedule、cageEdit、digimon、endDay、help、saveQuit、hunt、battle、shop、settings。Database／Medals 保留原圖片；八格工具圖、品牌、文字、分組、按鈕節點與既有 CSS 不替換。
- 54 個 Battle WAV 及兩個既有音樂目錄中的 29 個 BGM 檔案逐檔 SHA-256 與基準相同。完整證據在 R 槽 `ui-completion-archive-20261024/implementation-r1/audio-preservation-hashes.json`，不將聲音檔另行匯入、替換或重新編碼。
- 原 audioBus／AudioContext／settings 音量及靜音持續為唯一權威。UI cue 僅明確 trusted click 呼叫，80ms 共用節流、同事件去重。cleanup／自動教學／disabled 不出聲；不增加全域按鈕音效 listener。
- **reject 從發布模組中排除**：沒有確證的 domain 失敗接點；完整未接候選仍保留於 85078ebf，不當成正式功能宣傳。
- 不包括首頁候選 07cad19b、籠子相鄰擺放 bug、GR01–GR09、角色動畫或戰鬥／存檔／狩獵規則。

## 封閉發布資料

保留 `toolbar-menu-icons.r1.json` 的內部原創／provenance／hash 紀錄，生成新的 `toolbar-menu-icons.runtime.r1.json`，只含 schemaVersion、entries、entryId、src。產品只讀此投影；內部 authoring manifest 不進 build inputs。沒有刪除來源 metadata 或放寬 public-render/payload gate。

依既有選用機制加入 11 張 SVG、兩個模組、一份封閉 JSON，刷新本批已改來源、HTML 與 public index 的精確 hashes。`WEB_BUILD_INPUTS`、`PUBLIC_RUNTIME_ALLOWLIST`、`PUBLIC_RUNTIME_INDEX` 及 playtest policy 記錄本批範圍。modulepreload 由既有生成器重建；同時補回既有 Hunt import graph 原已缺漏的兩個 preload hint，沒有改 Hunt 程式或資產選擇。三個新 Node 測試加入 portable CI classification，442 個測試模組分類閉合。

## 檢查與既有 CI

- 原離線候選：66／66 focused unit／DOM mock／fake AudioContext 檢查通過，詳[離線實作報告](IMPLEMENTATION_ZH_TW.md)。
- 發布版本：14／14 本批 focused 檢查通過；重建 hash、301 個 modulepreload closure 及 syntax／diff 檢查通過。
- 既有 web-build contract 檢查單次執行 24 通過、1 因 `connect EACCES 127.0.0.1:57272` 受阻；未重試該測試。這不是產品斷言 FAIL，也不是 PASS；完整 CI 結果仍需另外確認。
- 中斷建置的舊 session 已不存在，舊輸出目錄不存在；沒有重複 commit／PR 副作用。恢復後合法本機 build 建立新獨立輸出 `dist/ui-menu-release-r2-20261024`：8,278 檔，buildId `2edd8209cbbba0c46449a33a337555588f44c38291b83c9ed360e53eadb31c21`。它是提交前工作目錄檢查，marker 仍標 85078ebf；不是最終遠端 release commit。
- 本機 validate 與 payload 結果、GitHub CI／PR／Pages 狀態及最終公開 marker，以後續執行回條為準，不能從 build 成功推定。

既有 PR 已會自動觸發 `ci.yml`、`raising-hints-browser.yml` 及 `scene-music-browser.yml`。沒有新建工作環境、工作流程或在本機重跑被拒瀏覽器。僅在原 Raising hints 的正常遊戲 smoke 追加本批斷言：390×844／1366×768 兩選單、13 個圖標正常載入與 >=44px 按鈕、重複點擊、Escape／返回焦點、工具 toggle、設定靜音與單一原生 AudioContext。測試只觀察原生 oscillator 的建立／start，沒有替換節點或模擬時間；聲音事件證據不等於人類聽覺驗收。runner `--self-test` 已通過，尚不能代替 GitHub Chromium 結果。

## 保留的限制

最初 Chromium `http://127.0.0.1:8746/full-qa-save.html` 的 `ERR_NETWORK_ACCESS_DENIED`、junction 的「存取被拒」均保留，沒有重試或換 URL／代理／瀏覽器規避。新的正常證據若有，只能來自本來就存在且已授權的 PR CI，須讀取實際回條，不可填造 PASS。

Git CLI fetch 在重啟前後均回 `getaddrinfo() thread failed to start`；GitHub 已授權連接器可以讀取遠端。若透過連接器送出本批 tree，必須逐一核對 blob SHA 及完整 tree SHA 與本地提交一致，使用新分支與 draft PR，不能直接改 main 或繞過保護。

Library 可選附件在準備官方 helper 時收到 Windows `CreateProcessW ... 206 (0x000000CE)`，尚未上傳且無 confirmed Library IDs；依指示停止，未換流程或移除 metadata。此項不阻擋合法發布。

實體手機及人類聽覺仍未驗收。PR 必須在必要 CI／正常流程證據確認後才轉 ready／merge；任何未滿足條件均須列明，不降級或繞過。
