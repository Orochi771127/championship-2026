# 原作素材包 → 224 角色內部遊戲呈現

日期：2026-09-06。範圍：忠實像素角色資產與正常 Raising／Hunt 的靜態物種呈現。

正式根目錄：`R:\Projects\Championship2026\championship-2026`；分支 `main`；
開始與完成 HEAD：`d0c48f340baac61cf399bf5bd5922ce58f3d38c7`。
本輪開始時有大量既有未提交修改；本輪沒有 commit、push、merge 或 deploy。

## 本次結果

Owner 指定的 `R:\Projects\Championship2026\YDIJ\_PRIVATE\_ROM\_ART\_PACK` 不存在。
經工作區 README 與實際目錄核對，使用的素材包是
`R:\Projects\Championship2026\YDIJ_PRIVATE_ROM_ART_PACK`。

已從 `02_CHARACTERS/use-ready-pixi-hd4x-224` 建立獨立的內部 runtime 材料：

- 224 套美術：8 個蛋、216 個一般角色。
- 228 筆現有物種紀錄全部依 `creature-species.r1.json.lookupKey` 找到對應。
  最後四筆共用既有美術，沒有新增虛構的四套素材或用物種序號猜圖檔名。
- 17,235 個 Main/Sub 圖格、11,480 條原始 NANR 序列、503 張圖集。
- 1,231 個輸出檔案，共 35,147,667 bytes（約 33.5 MiB，含 manifest）。
- PNG 與 atlas JSON 維持來源 bytes；runtime JSON 只增加內部呈現分類，並撤除未驗證的動作 semantic alias。
- 每個角色保留獨立 Main/Sub、trim、sourceSize、anchor、圖格引用、原始 duration ticks。
- 所有 atlas 邊長不超過 2048；每個場景只載入出現物種的 Main，重複物種共用同一份；離開場景釋放。

輸出資料夾：`assets/production/internal-faithful-baseline/characters-v1/`。
唯一 production index 登記：`art:characters:licensed-internal:v1`。

這是已存在的忠實像素素材技術化與接入，**不是新增的手繪 HD 重製**。

## 正常入口與動作邊界

`championship.html` 的正常 New Game／Continue 入口會透過 production index 查找角色包。
Raising 由既有 resident.speciesId 決定圖像；Hunt 由既有 wild.speciesId 決定圖像。
不需要 `characterArtReview=m201` 或其他 query。M201 預覽分支保留原有功能。

本輪的正常呈現是原始 action 0 的第一張 source frame，保持靜態；這只表示物種身份。
不把 archive 的 idle／happy／walk alias 當成已驗證事件，也不使用 provisional 60 Hz 來驅動正常角色動作。
全部原始動畫序列已備妥，但完整遊戲事件→原始 slot／cell→更新時序仍需逐條接入已驗證 contract。
靜態物種呈現不等於全部動作 parity，且這個材料包不控制捕獲、HP、AI、移動、時鐘、保存或進化。

載入失敗或不存在的物種繼續使用既有 fallback，不把所有物種套成 M201。
本輪沒有建立第二個 Pixi Application、ticker、router、store 或 save authority。

## 來源、政策與實作

使用技能：`championship-art-production`、`create-game-assets`、`pixijs-assets`，
以及 Browser 技能做實際本機畫面操作。保留現有作品，因此未呼叫生成工具重畫素材。

已核對的依據：

- 當前 `docs/coordination/OWNER_DIRECTION.md` 的 2026-09-02 licensed pixel／內部 production index 指示。
- 素材包 `00_METADATA/PACK_MANIFEST.json` 的 `classification.rightsStatus: LICENSED`。
- championship-evidence MCP：
  `CLAUDE_CODE_YDIJ_HANDOFF/02_CHARACTER_ART_STRUCTURE/CODEX_DIGIMON_SPRITE_PIPELINE.md`，
  11–26 行的 224 entities 與 Main/Sub 區分，69–116 行的 cell/ticks 與未驗證動作名稱邊界。
- 每筆 source runtime 與全部 atlas 圖像／JSON 的 manifest SHA-256 均通過核對。

工具與接線：

- `scripts/promote-licensed-character-runtime.mjs`：整批來源預檢、hash、碰撞保護、獨立複製、index 變更前比對。
- `scripts/build-art-production-a0.mjs`：加入這個正式 manifest，確保重建 index 不會遺失登記。
- `src/championship/presentation/licensedCharacterRoster.js`：現有物種→美術映射、按場景載入、缺圖隔離及釋放。
- `src/championship/presentation/pixiCharacterRuntimeBundle.js`：沿用原 loader，增加只載入 Main 的選项；缺失 cell 時也會清理已載入資源。
- `src/championship/app/main.js` 與原 Raising／Hunt scene：正常入口傳入物種身份並使用已注入的圖像。
- `scripts/build-github-pages.mjs`：排除內部角色目錄及 `publicReleasePermitted:false` 的 index 條目。

重新建立（從正式 repo 執行）：

```powershell
node scripts/promote-licensed-character-runtime.mjs
node scripts/validate-art-production-a0.mjs
node --test tests/championship-licensed-character-roster-cases.mjs
```

來源包保持原樣。若已存在的輸出與來源不相等，builder 會停止，要求先檢查差異，不覆寫已有圖像。

## 驗收證據

- 本次 focused set：27 tests passed，涵蓋完整 224 套檔案雜湊、所有圖格引用、物種重用、未知物種、路徑拒絕、缺圖隔離、Main-only 載入、錯誤釋放及原有 runtime firewall。
- 完整回歸：987 tests passed、0 failures；紀錄在 `reports/art/character-runtime-2026-09-06/regression-tests.txt`。
- A0 validator 通過：1,248 crosswalk decision units、20 registered bundles、0 shipping；重建一致。
  Crosswalk 的 95 ready-for-runtime decision units 是其既有完整 deliverable 分類，本次靜態角色材料不冒充 224 個完整動作交付。
- `git diff --check` 通過。
- Browser 正常操作：New Game → Raising 看見數碼蛋 → 點選 → Save → reload → Continue →
  SYSTEM/Hunt → Gate01（既有 accessible list）→ Loadout → Begin Hunt → 拖曳空地 → Return Home。
- Raising 的新遊戲／Continue 與選取在 390×844 檢查；Hunt 在全部五種 contract viewport
  360×800、390×844、393×852、412×915、430×932 目視檢查，無橫向 overflow，Hunt DOM 為一張 canvas。
- 正常 Hunt 顯示三種既有 runtime 所提供的物種，使用正確圖像；這不驗證該 prototype roster 的原作生成 parity。
- 本次操作沒有 browser warning／error。素材在 world 容器中隨既有 camera pan 移動；返家後正常回到數碼蛋。
- 所有瀏覽器操作由原有 UI 觸發，沒有注入 HP／資金／RNG／捕獲結果或修改 save。
  Save 按鈕產生的是本次新遊戲的正常測試存檔。

截圖在 `reports/art/character-runtime-2026-09-06/`：
`raising-390x844.png`、`continue-390x844.png`、五種 `hunt-<尺寸>.png`、
`hunt-pan-430x932.png`、`return-home-390x844.png`。

## 全遊戲美術狀態與剩餘工作

| 家族 | 本次核對的素材存在狀態 | 本次正常流程驗收／剩餘 |
|---|---|---|
| Gameplay 角色 | 224 套內部圖集、228 species bindings | Raising 蛋與 Hunt 三種物種靜態呈現已驗；全部動作、Battle 角色及逐物種 QA 未完成 |
| Cage | 既有 licensed manifest 有 40 個 field | 這次看過目前 Raising 的場景；沒有宣告 40 field 都通過逐張 QA |
| Hunt | 既有 licensed manifest 有 30 個 variant | 這次正常 Gate01 畫面經五尺寸檢查；其餘變體未逐一驗收 |
| Battle | 既有 licensed manifest 有 11 個 field | 本輪未改 Battle 角色／地圖呈現，未宣告全場景完成 |
| VFX／3D | 既有 licensed manifest 有 26 個 system | 素材存在不等於 26 系統全部依 gameplay event 觸發；Gate 3D 等未知綁定保留 |
| UI | 96 scenes、1,369 nodes；45 scene screen-role 仍標 UNKNOWN_REQUIRES_TRACE | 使用現有 Modern DOM；沒有把 96 張 DS reference 圖直接貼成完整功能 UI |
| 原始完整家族包 | 1,705 families：1,541 rendered、164 diagnostic-only；49 families 有 warning | 診斷圖不是可用美術，不能用整包檔案數宣告全部轉換成功 |

下一個安全步驟：用既有 gameplay 提供的 raw slot／cell contract 接入角色狀態，先閉合一隻正常
Hunt→倒地→手掌→卡片→Home 的動作；再擴到 Battle／其餘物種，按原 UI 次序補 DOM icon 與 VFX event。
未知動作不得由美術名稱或相似姿勢推導。

## 公開封裝阻塞

`node scripts/build-github-pages.mjs dist/character-art-public-check` 已嘗試；完整 build 未通過，
原因是既有 tracked input `src/data/championship/catalogs/entities.r1.json` 在工作樹中已被刪除。
這項刪除在本輪開始前就存在，本輪未恢復舊 catalog 或變更 gameplay source。
該不完整測試輸出內，內部角色目錄不存在，角色 production index 條目數為 0；這僅證明本次排除行為，
不構成完整 Pages build／公開出貨 QA 通過。

狀態維持 `runtimeEligible:true / publicReleasePermitted:false / humanApproved:false / shippingReady:false`。
公開發佈、原始 ROM/Nitro、未驗證 gameplay 與全遊戲美術完成均不在本輪完成宣告內。
