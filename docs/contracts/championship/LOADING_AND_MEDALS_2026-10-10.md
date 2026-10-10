# 首頁與牧場載入、公開徽章入口（2026-10-10）

## 授權與範圍

Owner 同日要求「載入真的蠻慢的可以去調查然後優化嗎？」並以「好」核定先改善首頁、冷啟動 Continue／New 至牧場與相同條件的前後量測。parent 同批指示僅修復核准公開 origin 的徽章入口，沿本批修正完成後 commit、push 與公開授權。此契約不更改遊戲數值、RNG、時鐘、可走網格、存檔 key／權威、圖片尺寸或壓縮品質；不建立第二個 app／Pixi／ticker、service worker 或外部服務。

帳號雲端存檔及房碼實時 battle 是後续獨立批次，不列入本契約。

## 實作契約

1. 原本的 application entry 與 source modules 是唯一程式來源。公開建置以固定 esbuild 0.28.2 產生 ESM 分塊；static 與 dynamic import 共用相同模組實例，保留 import.meta.url 原始資源基準。產物使用內容雜湊檔名，不把另一份生成程式樹提交為 runtime authority。
2. 所有 bundler 讀入檔案必須包含於既有、通過稽核的 WEB_BUILD_INPUTS 白名單；額外依賴直接拒絕。建置記錄每個來源 SHA、工具版本、生成檔及 startup closure；validator 重新編譯並比對 metadata、生成 bytes、HTML 與完整檔案表。原有公開素材 hash 選擇、權利與商業發布限制保持不變。
3. 移除首頁背景預載 Battle／Three／全角色 roster；原畫面的 foreground loader 保持有效。首頁只 preload 打包後的 static closure。當前 raising resident、戰鬥參與者及結果畫面的 species 決定 HUD 載入範圍。
4. 僅成功的 HUD JSON 在頁面生命週期內以 URL／fetch reader 合併請求。失敗請求可重試，不持久保存 textures 或遊戲狀態。後續新／進化 species 可按需補齊並使目前 view 重繪，不推進模擬。既有四組 species 別名沿用其原創來源，不倒退為原始參考美術。
5. 徽章選單只用既有 isOriginalRuntimeLocation gate 開放於核准公開 origin/path 及 loopback；其他 localOnly 功能不變。頁面仍顯示 canonical 61 枚 title flags，勝利頒發及持久化沿既有 progression/save 流程。

## 驗收

- 聚焦：ESM static/dynamic 共用狀態、資源 URL、拒絕未核准依賴、HUD 合併／失敗重試／按需新角色／別名、公開 gate 與既有 build boundary。
- 正常瀏覽器：打包產物的 gesture 音樂、New→命名／選蛋→牧場、隔離既有 fixture 的 Continue→61 枚徽章→正常頭銜戰勝利→徽章→reload persistence。不得注入戰鬥 outcome／傷害／RNG 或加速遊戲時鐘。
- 公開站前後使用 390×844、DPR2、touch/mobile、新 browser context 冷快取及相同 context 暖載入；相同隔離存檔，CDP 上限 10Mbps down／5Mbps up＋80ms 延遲。記錄 title enabled 及 Continue 後 resident assets 全 ready；不能只以 DOM 出現代替完成。
- CDN 實際波動仍須明列；程式／請求減量與單次 wall time 分別報告。技術播放 currentTime 前進不等於人工聆聽；實體 iOS 與人工音質驗收另列。

## 來源

來源為本專案 main.js、characterHudArt.js、completedOriginalCharacters.js、toolbar、medalCollection／title progression／canonical save，以及既有公開 build-input contract。本批不是新 ROM 行為重建，不將展示優化標成 ROM_VERIFIED。

建置 API 參考：[esbuild code splitting](https://esbuild.github.io/api/#splitting)、[onLoad source verification](https://esbuild.github.io/plugins/#on-load)。
