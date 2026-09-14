# Championship 2026 指令與 skills 整理實作紀錄

日期：2026-09-14  
範圍：本機指令、文件、相關使用者 skills；不包含遊戲實作、commit、push、merge 或 deploy。  
基底：`main` / `8f270dc63f5735f4b67218c8047f5d020b6d8b7f`，正式 Git root 為 `R:\Projects\Championship2026\championship-2026`。

## 結果與範圍

已依 Owner 核准的整理方案，將常駐規則、歷史紀錄、按任務讀取的專業流程與未來規劃分開。父層只指路，全域只保留共同工作方式，正式 repo 定義產品邊界。美術 skill 已由 Nexus Link Junction 改成同名獨立資料夾。

Owner 後續補充的 Astra／Meng To、原生像素製作及現代化方向，收進既有的 [原作重建後現代化計畫](../../../planning/CHAMPIONSHIP_POST_PARITY_MODERNIZATION_PLAN_ZH_TW.md)，從 [文件入口](../../../README.md) 可找到。該計畫保持 `PLANNED / POST-PARITY`；此整理不啟動 Gate Select POC、角色量產、全遊戲 Three.js 改造或社群功能。

本任務未修改遊戲 API、Save、Router、Store、renderer 接口、資產 registry schema、CI 與發布設定。本機原有的 45 個修改／新增檔案已逐一保存雜湊；前段核對全數相同，最後一輪發現其中一個測試檔另有變動，已保留現況並記錄於下方，不將其他工作的內容算成本次成果。

## 原規則 → 新位置／適用條件 → 保留保護

| 原問題／規則 | 新位置與適用條件 | 保留的保護 | 驗證方式與結果 |
|---|---|---|---|
| Codex 從父資料夾開始，內層指令可能未被讀到 | 父層 `R:\Projects\Championship2026\AGENTS.md` 只指向正式 repo；[repo AGENTS](../../../../AGENTS.md) 要求從 Git root 執行產品命令 | 正式產品 authority、Git root／branch／HEAD／status 定位 | 本任務已收到更新後的全域與父層正文；父層／repo 的新 CLI 啟動均看到對應入口正文，但其後檔案讀取被政策阻擋，完整新工作載入測試僅部分完成 |
| 全域指令要求每次整套閱讀與全套驗證 | `C:\Users\USER\.codex\AGENTS.md` 保留共同習慣；repo AGENTS 與 [文件入口](../../../README.md) 依任務路由 | 開工定位、寫前重讀、授權、相關 contract 與共享修改保護 | 文件／skill 引用及格式檢查通過；案例驗證見下節 |
| VS1／VS2、算術限定及 `SYNC ONLY` 被當作今天的限制 | 從常駐 AGENTS 移除；[Owner Direction](../../../coordination/OWNER_DIRECTION.md)、[算術交接](../../../coordination/CURSOR_BATTLE_ARITHMETIC_HANDOFF.md) 加歷史批次與後續適用說明 | 原始 Owner 指示保留；新範圍、未知證據與發布仍需適用授權 | scoped diff 已核對；後續指示僅取代其授權範圍，不把所有 STOP 刪除 |
| ROM、實作、Owner 與權利被排在單一順位 | [Authority by question](../../../README.md#authority-by-question) 分成原作事實、目前實作、允許改編、驗收／權利／發布、歷史回報 | `ROM_VERIFIED = DEFAULT_PRESERVE`、`PARTIAL` 保留已知結構、`UNKNOWN_REQUIRES_TRACE` 不猜；改編不變成原作證據 | 來源與規則逐項核對；沒有替任何產品未知項補 PASS |
| 共享同步在不同文件重複，且固定舊 revision | [Shared-file update protocol](../../../coordination/SHARED_FILE_UPDATE_PROTOCOL.md) 為現行完整定義；Owner 與 skill 引用；僅交接／共享更新時啟動 | owned STATUS／DELTA、單一 merge writer、stable ID、衝突隔離、候選驗證、SHA-256、`ABORT_AND_REREAD`、原子替換 | 獨立 fixture 案例檢查，不碰正式共享資料 |
| 美術 skill Junction 連到 Nexus Link，引用仍混用產品路徑 | `C:\Users\USER\.agents\skills\championship-art-production` 為普通目錄；入口、authority、ART-A、sync 與腳本 help 使用 Championship 正式 repo | Nexus 原件、研究來源、26 個來源檔案、相對引用、`agents/openai.yaml` 與 implicit invocation | 原件 26/26 雜湊不變、非 Junction／symlink、使用者探索根內同名入口僅一個 |
| 局部盤點也被推進完整 ART-A／製作流程 | 美術 SKILL.md 分局部盤點、完整 ART-A、已授權製作、共享同步四種模式；歷史長流程移到 `references/historical-art-programs.md` | 完整 ART-A 仍有 13 項、reconcile、`NOT_SCANNED` 門檻及 post-audit Owner gate；局部不冒稱完整 | 技能格式與引用通過；獨立行為案例見下節 |
| 已授權延續可能因缺少特殊英文口令再次停下 | `references/production-autonomy.md` 按現有授權與批次判斷，不要求 literal `BOUNDED AUTONOMY` | 首次製作、重大方向、identity、mass production、gameplay、權利與新範圍門檻 | 授權案例與 QA 交付條件由獨立檢查核對 |
| 通用名詞造成過寬的 skill 觸發候選 | 26 個 PixiJS、game-ui-ux、game-feel、performance-optimization、create-game-assets、generate2dmap、generate2dsprite、sprite-pipeline，共 33 個入口只縮描述 | 專業正文逐份保持不變；Pixi API keyword 索引僅用於已識別的 Pixi 任務 | 33 份正文對照相同；描述原始字元總數 18,092 → 3,629，僅為靜態文字量 |
| 美術路由指定當次不存在的 skill | `references/production-routing.md` 按可用能力路由至 game-ui-ux、imagegen、sprite／map、PixiJS／Three.js 及當次瀏覽器工具 | 不安裝／停用外掛；若工具缺失，使用可用方法；每幀原始 origin／offset 保留 | 路由名稱對照本任務 skill 清單，文件引用通過 |
| Three.js 未掛載／只能手動 deploy 的敘述過時 | [README](../../../../README.md)、[Current Product Status](../../../CURRENT_PRODUCT_STATUS.md)、[現行架構](../../../architecture/CHAMPIONSHIP_2026_ARCHITECTURE.md) 與 [歷史架構](../../../coordination/CHAMPIONSHIP_RUNTIME_ARCHITECTURE.md) 更正或加日期 | bounded Three.js、既有唯一 authority、發布需授權；不將 source wiring 當成新 QA | 依現有 source 與 workflow 核對；本次未變更 workflow、build 或場景 |
| 每次貼長指令再次帶入舊規則 | [可重用任務範本](../../../coordination/CODEX_TASK_PROMPT_TEMPLATE_ZH_TW.md) 只提供目標、路由、授權與回報方式 | 實際任務範圍、未知不猜、共享修改保護、發布界線 | 已掛文件入口；說明檔案更新不撤回舊聊天指令 |

## 美術 skill 拆分與來源保全

拆分前來源為 `R:\Projects\NexusLink\web\.agents\skills\championship-art-production`。先在 skills 探索範圍外建立完整副本，逐檔比對 26 個來源雜湊；驗證使用者入口的 Junction 目標後，只移除該連結，再將已驗證副本移入同名位置。沒有刪除或修改 Nexus Link 目標目錄。

修正只發生在獨立 Championship 副本。scripts、references、既有授權／來源資訊與介面設定均保留；`build_art_reports.py` 只更正 `--repo-root` 說明文字，未改報表邏輯。`allow_implicit_invocation: true` 保持不變。全域 AGENTS 的 Nexus Link 專屬段落亦保持原文。

原生角色仍依逐格證據保留 origin、offset、timing、flip、空白幀及 reuse；不使用通用 shared anchor／bbox-fit／shared scale 覆蓋原始資料。Research／local reference／public playtest／shipping 的素材與權利狀態仍分開。

## 後續規劃保存方式

原有 GitHub 文件取自 `ad1f6975e21c0a7a2c5e0aee36e290693dc930aa`，blob 為 `96f2176cb730e0ff830f77fd413eee428bdb86ed`。原文件在 `a76b989` 建立、在 `ad1f697` 掛入口。本機加入該份文件並補充 Owner 本次提供的兩份討論，沒有 merge／cherry-pick 遠端提交，也沒有同步其他程式碼。

只有一份 canonical post-parity planning entry，未另建重複的 Astra visual plan。新增內容明確記錄：

- 原作 baseline 優先，現代化分開驗證；Gate Select 為首個候選，其後才是 Battle → Hunt → Raising。
- 保留 DOM／PixiJS／bounded Three.js 分工。候選視覺改動限 geometry、lighting、materials、particles、camera presentation、transitions；不更動 biome ID、unlock、fee、save、navigation、玩法或未知行為。
- Image 2／2.5 為先前討論名稱，UI 裝飾、icon、透明 PNG、concept/reference 是候選用途，不表示本次確認工具版本或品質。
- 生成式大圖及縮小圖不直接當正式角色母版；AI 可透過 Aseprite 像素操作協助製作，人工負責方向與審核，不要求使用者手畫全部母版。工具清單與一隻角色三張圖格皆為候選，未安裝或啟動。
- Blender 只在此規劃中負責 trailer／marketing 離線畫面；不取代遊戲 runtime。
- 所有 upgrade 要做手機 9:16 及 portrait → landscape → portrait QA；先保留已核准的置中直向框與側邊留白。
- 日曆、有限離線、個體履歷、雲端、非同步對戰、排行榜、分支進化、派遣、計步、自訂外觀與社群需求保留為候選；維持「生活同步，不懲罰沒上線」。

本次沒有重新研究外部文章、工具品質或社群需求；來源連結保留為討論出處，沒有宣稱已驗證其效能或適用性。

## 驗證紀錄

### 檔案與格式

- 34 個變更相關 skills 執行 Skill Creator `quick_validate.py`：全數通過。
- 美術來源 26/26 檔案、33 個一般 skills 正文、Nexus Link 全域段落與美術介面設定：保持不變。
- 原有 45 個工作樹修改／新增檔案：前段 45/45 相同；最後一輪 44/45 相同，`tests/championship-migration-firewall-cases.mjs` 在期間另有變動。本任務未寫入該檔，不回復、不覆蓋，保留雜湊差異；因此「所有既有檔案完全不變」這一項不標 PASS。
- 改動文件與美術 references 的新相對引用：可解析；未發現新增失效路徑。
- 本次 tracked 文件的 `git diff --check`：通過；新文件另做空白與衝突標記檢查。
- `build_art_reports.py --help`：通過，顯示 Championship 2026 正式 repo；未改 script/schema/report 行為，因此不執行無關報表 fixtures。
- 沒有執行遊戲測試、build、瀏覽器／實機驗收或發布；這些不能由文件整理推定通過。

驗證使用現有 Python 3.12.10。因既有 Python 未提供 PyYAML，只把 `PyYAML==6.0.2` 放入本次備份下的 `validation-deps/`，供 quick_validate 使用；未修改全域 Python、repo dependency 或 Codex 設定。

### 指令載入證據與限制

| 層次 | 觀察到的結果 | 不能推定的事項 |
|---|---|---|
| 本任務重新接續時的 desktop 上下文 | 實際提供了更新後全域規則與父層 workspace entry 正文，skill 清單也顯示縮短後的描述 | 不表示每個新 task／不同模型都採取相同行為，也不表示所有 skill 正文都已讀取 |
| 從父層啟動的新唯讀 CLI | 收到父層入口，能從正文指出內層 repo；嘗試用工具讀取，但被政策阻擋 | 不能算已成功從入口讀到內層 AGENTS 或實測 Git 狀態 |
| 從正式 repo 啟動的新唯讀 CLI | 收到新的 repo AGENTS 正文；後續 Git／檔案讀取被政策阻擋 | 不能把依注入文字回答的案例當作 skill／fixture 實讀 |
| 本任務與獨立唯讀檢查 | 使用可用工具實讀目標檔案並核對 Git 與案例來源 | 不替代上述 CLI 的完整新工作載入驗收 |

CLI 初次啟動因目前 app 的 `mcp_servers.node_repl` transport 不相容而失敗；之後以單次 `--ignore-user-config` 啟動並保留原模型／推理設定，未改持久設定。唯讀 shell 命令仍回報 `blocked by policy`，因此保留為 **PARTIAL**，沒有放寬沙箱繞過。完整新工作從父層讀到內層的驗收仍待該環境可執行唯讀工具後重做。

### 獨立決策案例

依 Skill Creator 的 Independent Forward-Testing，使用獨立唯讀 agent，提供實際請求情境、目前指令與原始 fixture，未提供預期答案或先前結論。它實際讀取所需檔案，回報下列決策。這是指令行為推演，不是製作、發布或遊戲 QA。

| 案例 | 實讀後的決策 | 主要依據 |
|---|---|---|
| README 一個錯字 | 只讀必要上下文、修改前重讀、限定 diff；不跑完整 ART-A／同步／遊戲套件 | repo AGENTS 的 task routing 與 completion |
| 兩個 Shop icon 的局部盤點 | 只盤點指定素材；唯讀不寫狀態、不宣稱完整 ART-A | art SKILL.md 的局部模式、qa-gates.md |
| 完整 ART-A 僅 12/13 且 `NOT_SCANNED` | 繼續補齊；目前只能 PARTIAL／BLOCKED，不能 PASS | art-a-recovery.md required outputs、qa-gates.md acceptance |
| ART-A 剛通過，只有稽核前「接著製作」措辭 | 提交完成報告後停在 post-audit gate，等待點名首批的 Owner 指示 | art-a-recovery.md Gate |
| 已點名核准三批，續做第二批，無特定英文口令 | 依現有授權續做第二批與 QA，不重問開始許可；不自行擴第四批 | SKILL.md、production-autonomy.md、qa-gates.md 修正後條文 |
| 捕捉缺 trace 但有合理解釋 | 查 evidence／contract；未知維持未知，假說不當成原作事實 | repo AGENTS、Authority by question |
| 本批只准本機，舊批曾准公開 | 完成本機工作；不把舊檔案／雜湊／目的地授權延伸到本批，不發布 | repo AGENTS publication、Owner Direction |
| 讀到 modernization plan，未批准 POC | 可在目前任務範圍評估，不開始 Gate、安裝候選工具或改玩法 | post-parity plan 的頂部 gate、Gate POC 與像素候選段落 |
| 共享 target 與 captured base 不同 | `ABORT_AND_REREAD`；保留現況，不以候選覆蓋 | Shared-file update protocol 步驟 1–5；fixture 實際雜湊 |
| 只批准第一批，未授權後續 | 完成首批、提出下一批建議；不自行開始第二批 | production-autonomy.md prerequisites |
| locks 未齊就大量生成 | 在大量生成前列明缺項、範圍、成本、輸出與風險；只繼續獨立已授權準備 | production-autonomy.md mass production gate |
| 新批需改玩法／Nexus／未核准 identity 或重大方向 | 在受影響動作前取得適用決策，繼續不依賴它的已授權工作 | production-autonomy.md Owner Decision Gates |
| 有效有限續作下選安全下一批／commit | 可選適用有限批次並驗證；小型 commit 仍須有 commit 授權 | production-autonomy.md loop、qa-gates.md 修正後條文 |
| 批次完成要交付什麼 | 批次與資產紀錄、來源／權利、QA／效能、registry delta、阻塞、rollback 與下一步重估 | production-routing.md、production-autonomy.md、qa-gates.md |

獨立檢查指出兩處歧義後已修正並請其只複核受影響案例：

1. `qa-gates.md` 原本把所有後續批次免重問綁在 autonomy active；現明確分為「已點名核准的批次依既有批准完成」與「自行選擇額外批次需有限續作授權」，並釐清 commit 仍需適用授權。
2. 文件入口保留的無例外 ROM 禁令與已記錄 rendered-reference 例外有用語交疊；現引用 repo 的限定素材／目的地規則，仍禁止由此推導私人來源檔案庫、raw ROM 或 commercial shipping 授權。

第二次唯讀複核確認兩處消歧完成，未發現新增保護缺口。其檢查範圍仍保留 13 份交付、必要掃描、post-audit STOP、未知不猜、單一狀態／renderer、owned status、共享雜湊、runtime promotion／IP 與 QA 保護。

共享 fixture 的 SHA-256 實讀結果（未替換任何 fixture）：

```text
captured:  52ddfeeda899b68c120219dd2d4852e2afdb88503b24c31a25dd25720fb4a0eb
current:   599c777bb0d9f31ac758d91b4705ca337fb53a6e29413338afd86094ed82523e
candidate: 79292123354cc70b707b5eed3574f474e8b65d71fb7be8b642581b73274af031
decision:  ABORT_AND_REREAD
```

### 最後一輪共享工作樹觀察

`tests/championship-migration-firewall-cases.mjs` 的初始 SHA-256 為 `e350d20eaba8b892d805ac9442672fd6a7ccb5d64383fc1b3a4a9fe5ff647cf8`，最後觀察為 `a0ab40fb31b9f1119a664c8cc25dbaa54944c4c6881d40f54005c093446f4d98`，檔案修改時間 `2026-09-14T11:43:38.2978434Z`。工作樹同時出現其他戰鬥／測試相關新增內容。

本任務的寫入清單僅包含指令、文件及 skills，沒有該測試檔。保護檢查如實回報 mismatch，未把初始 hash 改成新值來製造 PASS，也沒有對該檔寫入或回滾。本次文件驗證不依賴這些產品變更，因此繼續完成自身交付，產品驗收留給其工作範圍。

## 交付、備份與復原

本次新增 repo 文件為：

- `docs/coordination/SHARED_FILE_UPDATE_PROTOCOL.md`
- `docs/coordination/CODEX_TASK_PROMPT_TEMPLATE_ZH_TW.md`
- `docs/planning/CHAMPIONSHIP_POST_PARITY_MODERNIZATION_PLAN_ZH_TW.md`
- 本紀錄。

既有 repo 修改為 AGENTS、README、docs/README、Current Product Status、Owner Direction、算術交接、歷史 runtime 架構與現行架構。repo 外修改為全域 AGENTS、新父層入口、獨立美術 skill、33 個技能描述與 Pixi API 索引說明。所有修改留在本機。

備份及機器可讀驗證位於 `C:\Users\USER\.codex\backups\championship-instructions-20260914`：

- `before.json`：原始檔案位置、備份對應、SHA-256、原件與既有工作樹保護清單。
- `original-art/`：拆分前完整美術 skill。
- `instruction-changes.json`、`skill-changes.json`：變更範圍及描述長度。
- `validation.json`：格式、來源、介面、工作樹及引用檢查。
- `after-files.json`：本次寫入範圍在最後驗證時的 SHA-256，供逐檔檢視／復原前比對。
- `behavioral-validation.json`：獨立案例與消歧複核摘要。
- `probe-parent-*`、`probe-root-*`：新 CLI 工作輸入、結果與受阻資訊。
- `merge-fixtures/`：隔離的共享更新基底、當前內容與候選內容。

如需復原，先重新讀取目標並比對本次完成時的雜湊，確認沒有其他 Agent 的後續修改，再逐檔對照備份復原；新增文件個別審查處理。不要用整樹 reset／覆寫還原，也不要透過 Nexus 目標修改 Championship 副本。恢復 Junction 是另一項明確的連結操作，需重新核對目標，不是日常回滾必要步驟。本次未執行任何復原或 Git 提交。

此次能證明的是規則、引用、檔案隔離與受測案例的結果。沒有量測實際讀取量、等待次數、速度或誤觸率改善，也沒有推定 Astra 的結果適用其他模型。
