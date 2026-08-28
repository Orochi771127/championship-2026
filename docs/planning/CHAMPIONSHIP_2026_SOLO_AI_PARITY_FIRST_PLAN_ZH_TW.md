# Championship 2026 — 一人＋AI、功能完整優先計畫

日期：2026-08-29  
最新 Owner 條件：先完成整體玩法、功能、模式與流程；最終原創角色、品牌與世界觀在功能完整後另開決策門  
發行原則：最終公開產品不使用 `Digimon`、`數碼寶貝`、原作角色、名稱、美術、音樂、文字、程式碼或 ROM 素材

## 1. 核心決定

採用 `PARITY-FIRST / IP-NEUTRAL RUNTIME`：

- 原作拆解資料只用於研究玩法、資料關係與行為驗證；
- 遊戲核心由我們重新撰寫，不載入 ROM、Nitro 或原始程式碼；
- runtime 從第一天使用中性 ID、原創臨時素材與可替換內容 manifest；
- 先完成從新遊戲到 Championship 的完整可玩流程；
- 功能完整後，再決定正式名稱、世界觀、角色數量與最終美術；
- 最終內容只需換內容包，不需重寫 Raising、Hunt、Battle、Shop、Database、Progression 或 Save。

不採用「先做一套完整 Digimon 畫面，再全部替換」：那會讓一人開發重做第二套角色、地圖、UI、文字與音訊，並在開發期間累積不必要的版權與商標風險。

## 2. 兩種完成定義

### A. 功能完整 `FUNCTIONALLY_COMPLETE`

- 18 類現代畫面都有正常、讀取、錯誤、中斷與恢復狀態；
- Raising、Care、Training、Evolution、Hunt、Capture、Result、Shop、Database、Cage、Auto Battle、Title、Rank、Championship 與 Save 都能運作；
- Cage 必須包含特定形狀模組拼裝、合法放置、功能地形數值效果、預覽、確認／取消及配置存檔，不能只做場景選單；
- 從 New Game 可以不靠 debug 指令玩到 Championship；
- 使用中性角色 ID、原創臨時圖形／剪影、原創臨時名稱與可替換音效；
- 所有玩法測試、存檔遷移、9:16、觸控與效能門檻通過；
- 不代表可公開發行，也不要求先完成 224 個正式原創角色。

### B. 公開內容完整 `PUBLIC_CONTENT_COMPLETE`

- 正式產品名稱與商標檢索完成；
- 所有公開角色、名稱、圖像、地圖、UI 裝飾、文字、音訊與宣傳素材為 `ORIGINAL_CREATED`、`OWNER_OWNED` 或 `LICENSED`；
- 最終首發角色與場景數量在功能完整後由 Owner 決定；
- 每個資產有權利紀錄、人工核准與 runtime QA；
- 研究素材沒有進入 build、快取、PWA、安裝包或 CDN；
- 通過公開發行的法律、平台、隱私與商標檢查。

## 3. 哪些可以延續、哪些要替換

這是製作風險矩陣，不是個案法律意見。台灣著作權法第 10-1 條及智慧財產局說明指出，保護通常及於具體表達，而不及於思想、程序、系統、操作方法與概念；遊戲規則／方法通常可由他人以自己的方式重新表達。但角色、美術、文字與程式碼等具體表達仍可能受保護，商標也另有來源混淆問題。

| 項目 | 規劃處理 | 條件 |
|---|---|---|
| 飼育、訓練、進化的抽象循環 | 可延續並重新實作 | 自行撰寫程式與 UI；未知規則不假裝原作真相 |
| Hunt 探索、裝備準備、圈捕手勢 | 可延續並重新實作 | 使用自有座標、圖像、名稱、關卡與回饋 |
| 三角色隊伍、策略準備、Auto Battle | 可延續並重新實作 | 不複製原程式碼、技能文字、角色或視覺表現 |
| Title／Rank／週期 Championship | 可延續概念 | 正式名稱、敘事、獎勵表與呈現另行原創化 |
| 已驗證公式與資料關係 | 可作 parity sandbox 依據 | ROM 表不進 runtime；公開版另做獨立平衡／法律複核 |
| 原作程式碼、ROM table、Nitro 檔 | 不可直接使用 | 只留在 research-only；產品重新編寫資料與程式 |
| Digimon／數碼寶貝名稱與標誌 | 最終產品不可使用 | 正式名稱需商標檢索，避免近似讀音、外觀或商業印象 |
| 原作角色、蛋、進化樹與角色名稱 | 最終全部替換 | 不只改名字；輪廓、配色、特徵、關係與成長樹都要足夠原創 |
| 原作 UI 圖、角色圖、地圖、特效 | 不可出貨 | 只研究功能層級、構圖關係；正式素材重新設計 |
| 台詞、說明、技能名、劇情、教學 | 全部重寫 | 不逐句改寫；以我們自己的世界觀重新表達 |
| 音樂、聲音、角色叫聲 | 全部替換 | 使用原創或有明確授權的音訊 |
| 原作截圖、影片、宣傳圖 | 不進產品與商店頁 | 研究畫廊與正式產品完全隔離 |

官方參考：

- [台灣智慧財產局：著作權只保護表達，不保護思想、系統與操作方法](https://www.tipo.gov.tw/tw/copyright/773-4961.html)
- [台灣智慧財產局：遊戲規則可用自己的方式重新表達](https://www.tipo.gov.tw/tw/copyright/692-15175.html)
- [台灣智慧財產局：手機遊戲角色圖像可能屬受保護美術著作](https://www.tipo.gov.tw/tw/copyright/692-17063.html)
- [美國著作權局：遊戲方法不受著作權保護，但文字與圖像表達可能受保護](https://www.copyright.gov/register/tx-games.html)
- [USPTO：商標即使不完全相同，若聲音、外觀、意義或整體商業印象近似仍可能混淆](https://www.uspto.gov/trademarks/search/likelihood-confusion)
- [WIPO：遊戲是由軟體、圖像、聲音等多種可能受保護的作品組成](https://www.wipo.int/en/web/copyright/activities/video_games)

公開發行前應由熟悉預定市場的智慧財產律師做個案檢查。

## 4. 三層隔離架構

```text
RESEARCH_REFERENCE
  R:\NEXUS LINK\原作
  ROM / Nitro / decoded / trace / screenshots
  絕不被 runtime import

PARITY_SANDBOX_CONTENT
  中性 ID、幾何剪影、色塊、原創臨時名稱、測試音
  用來完成全部玩法、流程與測試

PUBLIC_PRODUCT_CONTENT
  最終原創品牌、角色、世界觀、美術、音訊與文字
  通過權利、人工與 runtime QA 後才能進入 production manifest
```

產品資料不可出現以原作角色名稱作為永久 key。使用穩定中性 ID，例如：

- `species.core.0001`
- `ability.active.0042`
- `biome.hunt.03`
- `arena.field.07`
- `title.tier.12`

顯示名稱、角色圖、動畫、技能文案、音訊與世界觀全部由 content pack 提供。

## 5. 一人＋AI 的工作模式

### 人類 Owner 必須掌握

- 最終方向、品味、優先順序與每批核准；
- 遊戲是否好玩、節奏與難度；
- 權利／商標／公開發行決定；
- 帳號、金鑰、商店、付款與部署權限；
- AI 產出採用前的程式、美術、文字與音訊複核。

### AI 適合處理

- 逆向證據整理、規格、資料轉換與 manifest；
- 小步程式實作、測試、存檔遷移與除錯；
- UI 變體、原創臨時素材、動畫 strip 正規化與 atlas；
- Playwright 截圖、viewport、差異、效能與缺檔檢查；
- 文案草稿、命名候選、內容矩陣與變更紀錄；
- 每次只提交可驗證的小工作包，由 Owner 決定是否保留。

### WIP 限制

- 同時只開 1 個 gameplay slice；
- 可另開 1 個不阻塞 gameplay 的小型內容／工具工作包；
- 每批都要能 rollback；
- 先完成與測試，再開下一個大系統；
- 不同 AI 不得同時改同一份 canonical 狀態檔。

建議容量配置：

- 50% 功能／玩法；
- 20% 逆向與資料契約；
- 15% 測試、效能、存檔與技術健康；
- 10% 原創臨時內容與工具；
- 5% 未預期問題緩衝。

## 6. Solo Now / Next / Later

### Now — 0–3 個月

- 修正 VS2 文件漂移；
- 建立 IP-neutral ID、content provider、研究 import 禁止測試；
- 把目前臨時角色與顯示文字標成可替換 presentation；
- 完成 Raising／Hunt P0 追蹤工作包；
- 開始 VS3 Capture；
- 建立 4–8 個純原創／幾何臨時角色供測試，不追求最終美術。

### Next — 3–12 個月

- 完成 Capture、Hunt Result、Care、Training、Evolution；
- 完成 Shop、Database、Cage Edit；
- Cage Edit 先用至少三種中性原創 shape 與三個效果通道跑通完整模擬，再以追蹤資料替換原作精確 footprint／數值；
- 完成 Auto Battle 所需的 hit/miss、TP、init/result trace；
- 以中性內容包完成所有畫面與存檔 schema；
- 持續擴大測試 roster，但不要求 224 張正式角色圖。

### Later A — 12–24+ 個月

- 完成 Battle、Title、Rank、完整 progression 與 Championship；
- 達成 `FUNCTIONALLY_COMPLETE`：New Game 可正常玩到 Championship；
- 完成 PWA、長存檔、裝置、效能與中斷恢復；
- 凍結功能版本，開啟最終 IP 決策門。

### Later B — 功能完整之後

- 決定正式產品名稱、世界觀、首發 roster 與美術成本；
- 先做 4–8 個正式原創角色 pilot，再決定 24／48／96／224 的長期規模；
- 逐包替換角色、地圖、UI 裝飾、文字與音訊；
- 每一個內容包都可單獨發布，無須等待 224 角色全部完成；
- 完成 `PUBLIC_CONTENT_COMPLETE` 後才進入公開發行。

時程只是範圍：一人＋AI 的功能完整版本約 18–36+ 個月；最終原創內容時間取決於首發 roster 與美術品質。不要為了看似精確的日期犧牲存檔、測試與權利隔離。

## 7. 功能完整前的內容規模

程式與 schema 支援完整 224 槽、16 Hunt、40 Cage/Training、11 Battle fields，但功能測試不必先製作 224 個最終角色。

建議 parity sandbox 使用：

- 16–24 個中性測試物種，覆蓋蛋、成長、進化、狀態、各種體型與動畫；
- 16 個 biome 全部有可走、可捕獲的結構，但只有 3–4 個需要較完整的原創臨時視覺；
- 40 個 Cage/Training 資料槽全部可載入，使用模組化臨時環境；shape mask、配置、功能效果與存檔都必須可測；
- 11 個 Battle field 全部可選，使用少量可換色／換材質的原創 arena kit；
- 所有 Title、隊伍與 progression 使用中性名稱與資料。

如此可以驗證完整遊戲，而不先背負兩次 224 角色美術成本。

## 8. 最終決策門

達成下列條件後才討論最終替換規模：

1. New Game 到 Championship 可完成；
2. 所有 P0 玩法規則已驗證或明確標成 Owner adaptation；
3. 存檔 migration、rollback 與長期 progression 測試通過；
4. 9:16 touch、desktop、低階模式與 PWA 測試通過；
5. runtime 沒有 ROM、原作名稱、原作圖片、音樂與研究 import；
6. 可透過更換 content manifest 替換一個物種、地圖、技能、文字與音訊，而不修改 gameplay code。

這個 gate 通過後，Owner 再決定首發要 24、48、96 或更多正式原創角色。
