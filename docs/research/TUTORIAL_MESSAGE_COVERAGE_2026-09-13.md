# 導覽缺漏與控制流程重新核對

本批沒有把導覽標成上線。舊 `tutorial-steps.r1.json` 的 35 個 cursor 只涵蓋文字 1515–1549，是中間片段；不能當成第一次開局的完整教學。

## 新確認的範圍

- 原作文字庫有 1495–1566 共 72 則相關文字。舊表漏 37 則：開頭 1495–1514 的照顧、清潔、治療及搬動，以及 1550–1566 的狩獵收尾、對戰介紹和結語。
- ARM9 `02085EF4` 讀 VM 的第 0 個 Q12 參數，經 `020CBC64` 的表取得文字 ID，再交給 `0208568C`。Unicorn 重跑 36 個實際原作 selector，結果為 1495–1526、1553、1554、1564、1565。VM 參數讀取、文字查表與最後 renderer 是明列替身；沒有模擬整套導覽。
- 既有正常原作觀察看到 34 則。扣除與 CPU selector 重疊的部分，72 則中仍有 14 則只有文字庫證據。文字存在，不等於已找到呼叫、順序或等待條件。
- 繁中文案現涵蓋 72 則；這只完成文案庫，不建立未驗證的玩法或把「按繼續」當成所有步驟的條件。

## 原作不是單一路徑的文字列表

私人研究反組譯 `R:/Projects/Championship2026/_archive/lifecycle-two-stage-2026-09-09/tutorial-script.asm` 的入口是 OVL18 `021265B8`。開頭按參數分到 `021267EF`、`02127AB6`、`02127BD1`，分別對應最初育成、狩獵返回及對戰返回段。此腳本呼叫 55 個 native wrappers，本批已用 Ghidra／pyghidra-mcp 取得反編譯，再追 44 個共用 helper。

例如 `02126626` 是逐 frame 等待 helper；`021266A8` 啟用工具輸入、輪詢工具選擇，再停用工具輸入。初始段也包含角色位置、狀態切換和自動示範。不能從教學句子的動詞反推「玩家一定要做這件事才能繼續」。

py-desmume 對既有 first-home 狀態重播原作接受選項，監看 root + A8 的讀取，找到 `0211D94C`、`0211DD44`、`02082FEC`、`02083868`、`02110C4C`、`021113B4`、`0210E6E8` 等路徑。`02110C34` 依教學階段建立不同 controller，不能直接把普通育成／狩獵畫面視為原作專用教學場景。

反編譯及記憶體收據留在 `../tools/development-toolkit/reports/tutorial-phase-readers/`、`tutorial-reader-decompile.json`、`tutorial-natives-decompile.json`、`tutorial-method-decompile.json`。這些是研究檔；沒有放進產品資產或建置清單。

## 產品保護與續接

1. 保留舊存檔 cursor 0 對文字 1515 的身分，不把新補 20 則插到舊 cursor 前面。
2. generator 與 catalog 明列 `LEGACY_MIDDLE_SEGMENT_ONLY`、`normalOnboardingEligible: false`、`fullOriginalProgressionVerified: false`。
3. 下一個實作條件是閉合專用教學角色／物件生命週期、各等待條件、離開清理及存檔續接；完成後再沿用既有 app/store/save 接入正常開局。

可重跑 `scripts/research/check-tutorial-message-dispatch-cpu.py`、`build-tutorial-message-coverage.py` 及 `scripts/build-tutorial-steps.py --check`。數值證據見同目錄 `TUTORIAL_MESSAGE_DISPATCH_CPU_2026-09-13.json`、`TUTORIAL_MESSAGE_COVERAGE_2026-09-13.json`。
