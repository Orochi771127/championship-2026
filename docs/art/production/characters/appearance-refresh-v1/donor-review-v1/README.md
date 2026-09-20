# 每隻角色的 donor 檢查

2026-09-20 Owner 要求：先確認每隻 donor 的全圖、Main/Sub、體型與步態、種族、表情、肢體行為和被綁動作，再製作原創角色。不能沿用上一隻的格號語意或中心點。

目前沿用既有 Nitro decoder、motion contract、catalog 和 source hash，不另建來源資料庫。

```powershell
python scripts/character-donor-review.py m002_choromon
# 查看產品 repo 外 _archive/character-donor-review-v1/m002_choromon/ 的全格與全序列圖。
# 在 review.json 記錄逐個 canonical cell 的可見事實，所有重複槽由 inventory.json 精確映射。
python scripts/character-donor-review.py m002_choromon --validate
```

檢查涵蓋：

- catalog 的 donor ID、species ID、generation、family bits；概念圖文字不能取代 catalog。
- 全 Main/Sub 的 raw sequence、ticks、loop、stop、cell mapping；不能只看待機幾格。
- 雙足、四足或無足等實際結構；沒有證據時不新增腿或動作。
- 臉部方向、可見／遮蔽、睜閉或壓縮、口型／有色區變化；未知器官和情緒保持未知。
- 附肢端點、離地／接觸、伸縮、翻轉、倒地與來源位移。
- 束縛作用在主體的位置與角度；不能把 m441 的024–038套用到其他角色。
- 同格、帶位移同格、黑白剪影、灰階與 palette relation；先證明，再重用原創像素。
- 每隻自己的64px原點和1px原生比例；4×／8×只做 nearest 顯示。

`review.json` 必須與 inventory、source、motion contract 和既有設計 hash 相符；任何變更使舊 review 失效。缺格、缺分析、尚未查看全序列或 unresolved blocker 都不能通過。

`PASS_DONOR_REVIEW` 只表示生成前來源審查完成，不代表生成圖、遊戲或公開發布通過。生成後必須再核對新圖。m001 的完成依據是 `m001-pipeline-v1/full-sheet-r05/acceptance.json`；m002 完成前不啟動下一組多角色生成。

## 工具決策（2026-09-20 實測與官方 repo 核對）

| 工具 | 本案用途與決策 | 依賴／維護判斷 |
|---|---|---|
| imagegen + sprite-pipeline skills | 已使用。每隻共用既有原創 seed，一張表生成所需新 master，獨立 manifest 固定格號，單格 NG 可返修 | 內建後端版本未公開，記錄 NOT_EXPOSED；不冒稱已確認 GPT Image2.5，不改走另付費 API |
| 既有 Python/Pillow/Node/Pixi/Playwright | 已使用。來源比對、去重、固定原點、純色衍生、包裝、全序列和遊戲驗收 | 已存在；新增 production dependency=0 |
| 本機 ComfyUI MCP | 已確認可用：0.3.44、Python3.12.9、Torch2.11.0+cu128、RTX4070Ti12GB。6份現有工作流主要服務 cage | 已有 ControlNet/IPAdapter/AnimateDiff 等目錄不等於角色工作流已驗收；不更換核心版本，也不干擾 cage 工作 |
| [sprite-forge-mcp](https://github.com/kitepon/sprite-forge-mcp) | 參考角色資料、單 panel 返修與品質 gate。沒有採用其整套 backend／LoRA 流程 | 作者標示 MIT、約30GB GPU 架構與5090驗證；本機12GB與其完整示範環境不同。未安裝、未實测其品質或依賴相容性 |
| [Sprite H3](https://github.com/fmmix/sprite_h3) | 參考 hash build 和逐格挑選；本案不使用影片生成再抽格來替換 raw cell timing | 作者標示 alpha、約16GB最低／24GB測試、Python3.13開發環境；MIT程式但模型另有授權。無必要引入不同主版本與模型 |
| [LibreSprite](https://github.com/LibreSprite/LibreSprite)／[Aseprite](https://github.com/aseprite/aseprite) | 可作人工 pixel/onion-skin 檢視備選，現有預覽與逐像素修正已足夠 | LibreSprite GPLv2，Aseprite EULA，不把「可讀原始碼」當免費授權。未購買、未安裝，非 runtime dependency |
| Higgsfield／Blender | 本輪沒有需要其獨有功能；未新增工作流 | Higgsfield0呼叫／0扣點；Blender不需要替2D source motion建立新骨架 |

上述外部 repo 能力是作者文件，不是本案測試結果。沒有工具能以此保證精確的 donor motion、表情與每格原點；本案用來源審查、可重現轉換及遊戲測試來驗收。
