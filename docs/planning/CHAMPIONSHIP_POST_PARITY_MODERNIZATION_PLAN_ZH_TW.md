# Championship 2026 — 原作重建後現代化與擴充計畫

日期：2026-09-14  
狀態：`PLANNED / POST-PARITY`  
Owner 方向：**先把原作可驗證內容重建完成，再以已重建完成的遊戲為基準做視覺、手機體驗與功能現代化；論壇／社群希望的新功能可作為後續候選，但不得在原作重建尚未完成時污染 parity 基準。**

> 這份文件是未來升級的 canonical planning entry，不是立即全面施工授權。  
> 除非 Owner 明確指定某個 POC，Codex／Claude Code 不得因讀到本文件就提前改寫現行玩法、數值、流程或資產。

---

## 1. 核心策略：先重建，再升級

目前產品工作分成兩個明確階段：

### A. `PARITY_BASELINE`

目標是把《Championship》原作中可驗證的玩法、流程、資料關係、畫面責任與行為建立成可測試基準。

此階段優先：

- Raising／Care／Training／Evolution；
- Gate／Hunt／Loadout／Capture／Result；
- Battle／Title／Rank／Championship；
- Shop／Database／Cage；
- Save／Continue／calendar／long-term progression；
- mobile 9:16、touch、reload、interruption、device QA；
- 對未知原作行為維持 `UNKNOWN_REQUIRES_TRACE`，不得以現代化設計補洞後再宣稱是原作。

### B. `POST_PARITY_MODERNIZATION`

只有在對應原作功能已建立可驗證 baseline 後，才允許在獨立範圍內改善：

- 視覺品質；
- 手機 UX；
- 現實時間／日曆；
- 離線進展；
- 雲端存檔；
- 非同步對戰／排行榜；
- 分支進化與個體化；
- 社群回饋中合理的新功能；
- 未來原創 IP／內容包。

**現代化不能反過來覆蓋或消滅 parity baseline。** 後續需要能清楚回答：「這是原作行為，還是現代模式新增／改良？」

---

## 2. 必須保留的產品邊界

依目前 repository 架構繼續維持：

- `DOM`：screen UI、menu、panel、toolbar、text；
- `PixiJS`：2D playable field、creature sprite、2D VFX；
- `Three.js`：只在明確需要的 bounded 3D 範圍使用；
- simulation state 不由 renderer 持有；
- 不因視覺升級全面改寫成 Three.js；
- 不另造第二套 router／save／ticker／global state；
- Nexus Link integration 仍維持 `FROZEN / OUT_OF_CURRENT_PRODUCT_SCOPE`，除非 Owner 另開正式決策門。

未來現代模式建議保留明確 profile／feature boundary，例如概念上區分：

```text
PARITY_BASELINE
POST_PARITY_MODERN
```

實際實作形式需等現行 save/runtime contract 稽核後再決定；不得先硬塞 feature flag 造成雙重狀態真相。

---

## 3. 現代化的第一個視覺 POC：Astra / Hybrid Asset 方法

### 3.1 來源與可借鏡方法

參考 Meng To 的 Astra / Three.js 工作流與其公開 `MengTo/Skills`：

- X post: https://x.com/mengto/status/2099125215708234119
- GitHub Skills: https://github.com/MengTo/Skills
- `build-hybrid-game-assets`: `agent-skills/game-development/build-hybrid-game-assets/SKILL.md`

可借鏡的不是「整款改成 3D」，而是：

1. 先分類 runtime asset 應該是 2D、程序化 3D、imported mesh 還是 reference-only；
2. AI 圖片用於概念、UI、icon、裝飾與 reference；
3. 程序化 geometry 用於可控的場景、建築、地形或變體；
4. 所有視覺必須回到真正遊戲 camera／mobile viewport 驗收；
5. Blender 可以做 trailer／marketing render，但不等於 runtime asset。

### 3.2 第一候選：Gate Select visual POC

**Gate Select 是第一個候選，不代表現在自動獲准施工。**

開始前 Codex 必須先稽核 current `main`：

- 現行 Gate presentation 由哪個 renderer 負責；
- Three.js 是否實際 mounted；
- camera、input、selection、biome data、unlock、fee、save 的 authority 在哪裡；
- 哪些行為仍是 `UNKNOWN_REQUIRES_TRACE`。

若 Owner 明確批准 POC，允許調整：

- geometry／environment dressing；
- lighting／materials；
- particles／ambient VFX；
- camera presentation（不得改 gameplay authority）；
- transition；
- biome icon／decorative UI／透明 PNG；
- mobile presentation。

不得因視覺 POC 改動：

- biome identity／ID；
- unlock requirements；
- fees；
- save semantics；
- navigation authority；
- verified gameplay rule；
- unresolved original behavior。

### 3.3 成功後的擴充順序

只有上一個 POC 通過後才考慮下一個：

```text
Gate Select visual POC
  -> Battle arena/environment polish
  -> Hunt environmental presentation layer
  -> Raising habitat polish
```

每一階段都必須保留原作 gameplay baseline，不可同時大改四個場景。

---

## 4. 角色與像素資產：與視覺環境升級分開

Championship 現行 native-pixel character replacement 不因 Astra POC 改規則。

正式角色圖格仍依當前 character appearance / replacement contracts：

- 原生像素；
- palette／alpha／frame geometry 依 current contract；
- 保留已驗證 sequence、timing、relative offset；
- AI image model 主要做 identity concept、造型探索、pose reference；
- 正式 shipping pixel 需經 pixel-authoring、technical QA 與人工 visual review；
- 未完成槽位維持未完成狀態，不用 reference ROM pixel 偷補成 production。

未來若另開原創 IP（例如暫稱「幻獸心核」）才可以重新設計動作、程序動畫與新 sprite pipeline；那是另一個 Owner gate，不得混入 Championship parity 線。

---

## 5. 社群／論壇需求：作為候選 backlog，不是直接規格

社群討論只能提供需求訊號，不能覆蓋原作證據或 Owner priority。

目前值得保存的候選方向包括：

| 候選 | 建議定位 | 初步優先度 |
|---|---|---:|
| 現實日期／星期／季節 | 世界節奏與活動層；不強迫所有 simulation 1:1 等現實時間 | 高 |
| 有限離線進展 | 只結算玩家已安排的工作；不因沒登入直接懲罰 | 高 |
| 個體履歷 | 孵化、進化、首次勝利、重要事件等可回顧紀錄 | 高 |
| 雲端存檔／復原 | 先保護長期養成成果，再談競技 | 高 |
| 非同步對戰 | 上傳／驗證隊伍、server-side 或可信規則重算 | 中高 |
| 排行榜／賽季 | 待 anti-cheat、server authority 與獎勵經濟成立 | 中 |
| 分支進化 | 適合現代／原創模式；不得回寫成「原作就是如此」 | 中高 |
| 派遣／探索任務 | 適合有限離線系統；需防止變成純放置 | 中 |
| 計步器／活動量孵蛋 | 手機特性候選；需權限、隱私與替代取得路徑 | 低中 |
| 自訂色／外觀變體 | 原創內容包較適合；需避免破壞角色辨識與像素成本 | 低中 |
| 好友展示／棲地訪問 | 可早於即時多人；唯讀／非同步較安全 | 中 |
| 即時 PvP／聊天／自由交易 | 高伺服器、作弊、騷擾與營運成本 | 後期 |

參考討論：

- Reddit: https://www.reddit.com/r/digimon/comments/1ux82sy/since_the_new_digimon_up_is_a_complete_letdown/

任何候選進入 implementation 前，都要另外寫：

1. 玩家問題是什麼；
2. 是否與現有原作循環重疊；
3. 是否會造成 FOMO／每日打卡負擔；
4. offline／save／server authority 如何處理；
5. 是否需要新的法律、隱私、平台或營運義務；
6. 如何保持 parity baseline 可測。

---

## 6. 現實時間／日曆的預設設計原則

若未來批准 modern calendar，預設採「生活同步，不懲罰生活」：

- 真實日期、星期、季節與活動窗口可同步現實；
- 不把所有原作 game-day mechanic 直接改成現實 24 小時；
- 離線不自動做不可逆的重大決策；
- 沒登入不直接等於 care mistake；
- 不以付費道具作為離線保護必要條件；
- 夜班／跨時區／改時區／多裝置必須有測試與政策；
- server-backed competitive features 不可只信任 client clock。

這是 post-parity modern design，不是原作還原主張。

---

## 7. 線上化建議順序

待單機核心與 save 完整後，依風險由低到高：

```text
可靠本機 Save / export / restore
  -> PWA / installable mobile shell
  -> optional account + cloud save
  -> friend/profile showcase
  -> asynchronous battle
  -> leaderboard / season
  -> real-time multiplayer / chat / trading (only if later justified)
```

先保護玩家投入，再增加競爭與營運成本。

---

## 8. Modernization QA Gate

任何 post-parity 功能至少要驗證：

### Gameplay isolation

- parity tests 不因 modern feature 改寫 expected result；
- modern feature 關閉時能回到 baseline；
- 不新增第二套 authoritative simulation；
- save migration 可回復、可測、不可重複領取。

### Mobile

現行 portrait contract 仍是 authority。至少在既有主要 viewport 驗收：

- `360×800`
- `390×844`
- `393×852`
- `412×915`
- `430×932`

若某 POC 宣稱支援 landscape，必須另外驗證 portrait -> landscape -> portrait，並符合：

- canvas／renderer／camera／pointer mapping 同步 resize；
- 不 stretch sprite／world；
- HUD 不遮住 playable area；
- safe-area 正確；
- 不因 orientation change 重啟 simulation 或重複 tick。

若沒有正式 landscape support，應採清楚且可預測的 portrait-preserving fallback，而不是單純拉伸。

### Visual

- 真正 game camera 下看，不只 asset viewer；
- mobile 原尺寸可讀；
- frame time／texture count／draw calls 有代表性量測；
- generated/imported/procedural asset 都要有 provenance；
- reference-only 不可誤標 production-ready。

---

## 9. Codex / Claude Code 執行規則

Agent 接手任何 modernization 任務前，至少先讀：

1. `docs/README.md`
2. `docs/CURRENT_PRODUCT_STATUS.md`
3. 本文件
4. 對應 current runtime／save／art contract
5. 對應 tests

預設行為：

- **先稽核，不先重寫。**
- 明確區分 `PARITY_BASELINE` 與 `POST_PARITY_MODERN`。
- 若原作行為未知，標 `UNKNOWN_REQUIRES_TRACE`，不要用 modern design 冒充答案。
- 每次只做一個 bounded POC／slice。
- 視覺升級不得順手改 gameplay。
- 未經 Owner 明確批准，不全面導入社群功能、線上服務或 Nexus Link 系統。
- 每次完成後留下 before/after screenshots、測試結果、已知限制與 rollback 路徑。

---

## 10. 決策門

### Gate P0 — Original parity

對應系統有可驗證 baseline、正常遊戲路徑與 save/reload 驗收。

### Gate P1 — Visual modernization POC

Owner 指定一個 bounded scene（第一候選 Gate Select）做 visual-only POC。

### Gate P2 — Modern time / offline pilot

只做一個小型 vertical slice，例如：真實日期顯示 + 一項可離線完成的排程工作 + 正確 reload settlement。

### Gate P3 — Cloud / social pilot

先做 save protection／account，再做非同步互動；不先做 chat／trading。

### Gate P4 — Original IP decision

功能與架構穩定後，再決定是否另建原創內容包／品牌。若選擇原創 IP，保留可重用 simulation/framework，重新設計具體角色、美術、世界、文字、音訊與公開品牌。

---

## 11. Owner 意圖的最短版本

> **Championship 2026 先把原作重建成可信、可測、可完整遊玩的 baseline。完成後，不把它停在復刻版，而是用這個已完成的遊戲作為底座，逐步做視覺升級、手機體驗、現實日曆、離線進展、雲端與非同步互動等現代化；論壇／社群需求是候選來源，不是直接照單全收。每一個升級都必須能與原作 baseline 分開驗證。**
