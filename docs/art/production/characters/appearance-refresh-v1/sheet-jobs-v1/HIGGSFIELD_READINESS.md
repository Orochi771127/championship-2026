# Higgsfield 接入確認（2026-09-20）

使用者已購買方案。透過已連接的 Higgsfield 外掛實際讀取：目前 workspace 回報 `ultra`、3010 credits。這是查詢當下的餘額，不是固定配額或支出授權。

模型目錄和 models_get 都回報 `gpt_image_2_5` / GPT Image 2.5，可用圖片參考、Flare/Sunburst、1K/2K/4K、透明背景。這是 Higgsfield 的模型標示；先前 builtin imagegen 的產物仍記錄 `NOT_EXPOSED`，不能回填成此模型。

以下為 estimate_image_cost 的即時報價，均使用 Flare、4:3、透明背景、count=1，沒有提交生成工作：

| Resolution | Quality | credits_exact |
|---|---|---:|
| 1K | medium | 1 |
| 1K | high | 2 |
| 2K | medium | 1.5 |
| 2K | high | 3 |

未帶入實際參考圖的預估不是最終扣點保證；正式提交前必須以完整參數再估價。不得把一張整表等同於一隻已驗收角色，也不得據此推算 3010 點必定能完成多少角色。

## 工作邊界

- 本次 Higgsfield 生成 0 次、上傳 0 次、消耗 0 點。
- free_trial.unlim_available=false；目錄的模型支援資訊不等同帳戶免費權益。免費的 motion-control / Viral 次數不能當成 GPT Image 2.5 圖片額度。
- 既有 m001 r05 保留。m002 已有一次整表與一次六格返修，沿用既有候選，不因購買方案重新生成。
- 下一次需要生成時：先鎖 donor review、原創設定、格位清單和 origin，再帶原創 identity + 對應姿勢 guide。完整參數估價後，依使用者允許的付費範圍提交；購買方案本身不代表無上限支出授權。
- Higgsfield 僅負責需要繪製的圖。Main/Sub alias、黑白剪影、已證明可衍生的灰階與 palette、格號、64px 容器、origin、timing、序列和驗證仍交給現有本機 scripts。
- 每個 job 保存模型 ID、參數、輸入 hash、返回 job ID、實際輸出與用量；返回 job ID 後只查該工作，不因等候而重送。
- 新增正式環境 dependency 0 項；未安裝 custom node、未更換 CUDA / Torch / Python、未暴露外網。

方案資訊（外掛返回）：https://higgsfield.ai/mcp-pricing
