# 自我審查：愛醬新遊戲故事與教學導覽（發布前）

審查者：Claude（claude-opus-5-5／high）。比對範圍：分支 `codex/onboarding-ai-chan-owner-approved-20261103` 對最新 `origin/main` 的完整 PR 差異（46 個檔案）。

## 範圍確認

- **只改了該改的地方**：
  - 新遊戲後的故事呈現（`openingStoryPresentation`、`storyCutsceneStage` 的向下相容選項）
  - 教學導覽外觀
  - 兩個偏好：`guideAppearance`、`openingStoryResume`
  - 故事與教學的選曲
  - 設定頁「導覽員外觀」
- **沒有動到**：標題、logo、NS33 標題影片、取名／八蛋／孵化流程、教學 step／checkpoint、存檔、router、ticker、Pixi。
- **素材**：4 個 runtime 媒體與核准包位元組相同，沒有重新轉碼。來源 ZIP、PNG 母檔、本機歸檔與證據都不進入公開 payload；`assert-public-payload` 已通過。
- **發布紀錄**：Owner 2026-11-02 的發布授權只記在本切片的 `public-playtest.r1.json#onboardingAiChan20261103` 與 art index 條目。以下仍明確標記為 false，沒有被宣稱為已驗收：
  - `rightsDocumentVerified`
  - `physicalDeviceAccepted`
  - `listeningAccepted`
  - `finalArtAccepted`
  - `commercialReleaseAccepted`
  - `shippingReady`
- **與 main 的合併**：
  - 原始碼自動合併。
  - 兩份生成契約以 main 的版本為準，只重新釘選本切片改動的 17 個檔案與新增的 7 個檔案，再用既有的 `reconcile-public-runtime-selection.mjs` 重建。
  - main 自己的檔案 hash 都沒有被改寫。

## 發現與處理

1. **在每頁都能返回標題**：已在第二輪補上（含外觀選擇頁）。點擊不會冒泡造成翻頁，會釋放 video、計時器與監聽器，並保留頁碼書籤與外觀偏好。已在瀏覽器實測。
2. **設定頭像預覽**：曾有截圖兩框皆空，原因是截圖時圖片尚未 decode，CSS 與圖都正確。gate 已加入可見幾何斷言防止回歸。
3. **本機伺服器不支援 byte range**：本機 `scripts/serve.mjs` 原本不回應 Range 請求，影片無法跳轉。已補上，只影響開發用伺服器；Pages 原本就支援。
4. **保留未清除的舊內容（刻意不擴大範圍）**：
   - 舊的四卡文案（`openingStoryText.js`）與漫畫 r2 素材仍在 repo。
   - 漫畫 r2 的 webp 仍在公開選取中，但已沒有程式引用，約 0.6 MB。
   - 刪除屬於另一個決定，這次沒有做。
5. **載入成本**：背景影片 9.9 MB，只在進入新遊戲故事時載入（`preload=auto`）。文字最多等 8 秒就會先顯示，不會被影片卡住。行動網路的實際體感尚未在實機量測。
6. **譯文**：en、ja、th、vi 譯文與 zh-Hant 互動文字屬 PRODUCT_AUTHORED，尚待 Owner 或母語者審閱。zh-Hant 敘事逐字取自核准包。

## 驗證（最終合併候選）

| 項目 | 結果 |
|---|---|
| `npm run test:ci` | 全數通過（合併 main 後 3324/3324；最後一次合併的數字見發布結果） |
| build:playtest、validate:playtest、`assert-public-payload` | 通過 |
| `tests/championship-onboarding-cinematic-browser.cjs`（建置產物） | 通過 |

瀏覽器 gate 涵蓋：
- 兩種外觀
- 閱讀中返回標題與重新整理後恢復
- 設定切換
- 教學導覽與故事接教學的音樂延續
- 靜音與音量
- 載入失敗、減少動態、頁面隱藏

以上都是本機 Chromium 的 viewport 模擬（390×844、844×390、1366×768），不是實體手機、iOS 或 Safari 的認證。

## 結論

沒有阻擋發布的問題。可以在角色動畫 release（PR #158）完成合併與 Pages 部署之後，依正常 PR 流程整合到 main 並發布。
