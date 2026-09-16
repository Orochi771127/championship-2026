# GPT Image 2.5 全名冊原創角色概念輸入

這個資料夾是既有 `pixel-v2` 全名冊製作線的概念輸入，不是第二套角色 registry，也不是 runtime 素材。

Owner 指定以 `YDIJ_ART_PACK_ASSEMBLED/05_角色/動作總表` 與每個編號自己的原作透明 PNG 作參考。原圖只用來約束粗略體型、動作輪廓範圍、支撐／接觸位置與腳底原點；臉、材質、色塊、裝甲、圖樣、名稱與識別特徵必須重新設計。研究 PNG 不複製進正式 repo。

內建圖像工具依 Owner 要求使用目前 Codex 提供的 ChatGPT Images 2.5 工作流。工具沒有回傳可驗證的後端 model ID，因此紀錄為 `requestedProduct: CHATGPT_IMAGES_2_5`、`resolvedModel: UNKNOWN_TOOL_NOT_EXPOSED`，不能冒充可核對的 API model receipt。

## 目前批次

- `representatives-01`：M006、M312、M418、E000 四個不同體型的透明概念候選。
- 這批只通過「輸出存在、四格映射清楚、背景有真實 alpha、未把研究 PNG 放進 repo」的概念檢查。
- 尚未完成原生尺寸像素設定、15 色限制、逐姿態 Main/Sub 畫稿、0/255 alpha、共同原點、正常遊戲或實機驗收。
- 224 個編號的正式進度仍由上一層 `identity-design-queue.json`、`setting-progress.json` 與 `production-queue.json` 管理；本資料夾不自行宣稱 roster 完成。

每批的 `manifest.json` 保存輸入來源、SHA-256、生成／編修步驟、輸出映射與限制。原作來源路徑只供本機研究追溯，不能發布。
