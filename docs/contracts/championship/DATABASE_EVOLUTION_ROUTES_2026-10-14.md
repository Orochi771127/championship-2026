# 圖鑑一階候選路線 — 2026-10-14

分類：`OWNER_APPROVED_ADAPTATION`（圖鑑顯示及導覽）。沿用既有進化候選／分支歷史，不能據本畫面推論進化資格、條件、原作完整 UI 或新的完成事件。

## Evidence → contract → implementation

- 候選：`src/data/championship/catalogs/raising-lifecycle.r1.json` 的 179 組、178 非空組、477 條有序規則，最多五條，目標 species20–223。來源是現有 [生命週期查證](../../research/RAISING_LIFECYCLE_STAGE_2026-09-08.md) 及 [生命週期契約](RAISING_LIFECYCLE_STAGE.v1.json)；本批沒有新 ROM tracing。
- 寫入：`championshipStandaloneApp.js` 原有普通進化提交位置記錄 `(event.oldSpecies-8)*5+event.index` 至 `raising.nativeHome.evolutionBranches`；繼承／重生不補普通分支。本批保持 writer、resolver、順序、RNG 及 save normalization。
- 登錄：原有 `databaseRuntime.js` 綜合已登錄 species、現存個體及原有 starter 規則；固定碼沿用 [首版編號契約](DATABASE_DISPLAY_2026-10-13.md)。候選存在、目標登錄、這個來源分支的完成紀錄是三個獨立事實。

## 顯示及資料邊界

僅已登錄普通來源顯示一階候選。未知來源不建立路線 DOM 或圖像請求，八顆蛋保持 `NOT_TRACKED` 且無路線；空組／最終階段顯示無候選狀態。畫面沒有條件計算、未達標判定、故事或多代樹。

`databaseEvolutionRoutes.js` 只投影原有候選目標、branchIndex、legacyBranchOffset、targetRegistered 及 historyState。`RECORDED` 必須精確包含有效的該來源偏移；沒有時是 `NOT_RECORDED`，不能描述成「從未進化」。無效旗標使其餘未確認分支成為 `UNKNOWN`，不修復存檔。不一致的「有完成旗標但目標未登錄」保留完成事實，名稱／肖像仍保守遮蔽，不補目標登錄。

同目標由不同來源到達，仍有不同分支歷史。例：source8→20 的偏移是0；即使20已登錄，`[]` 或 `[5]` 都不能揭露此路線。揭露要求該分支 `RECORDED` 且目標登錄；其餘以固定碼、黑色剪影／中性占位、`????` 和「尚無完成紀錄／紀錄未能確認」呈現，不在 aria、alt、title 放入被遮蔽的名稱。

已揭露候選按鈕走既有 `selectDatabaseSpecies`，必要時切至目標階段篩選，焦點移至詳情標題；關閉後回到目標列。保留原桌機雙欄／手機詳情操作、兩種 HUD、五語、44px 觸控及獨立捲動。

## 圖像權限與生命週期

僅 `accepted-original-character-selection.r1.json` 現有選中角色、`public-playtest.r1.json.acceptedOriginalRuntime` 的限定公開授權，以及 `accepted-20261010/<folder>/hud-r01/manifest.json` 的相符 identity、source hash、原始 cell0 derivation、包裝授權、像素精確紀錄與 rasterCanvas 才可提供圖像。測試逐一比對214個可用普通種對應圖像 SHA。不呼叫可能回退 research/baseline 的 `getPortrait`；不增加素材或來源權限。

每個選中來源最多六張靜態圖像，僅載入當前來源及最多五個候選。沿用96→226、97→227的既有 HUD alias。換選／關閉／離開時 abort manifest 請求、移除舊 image src／事件，generation guard 阻止遲到回呼更新。

species222（UL02天穹帝龍）、species211（UL33黃銅王猿）目前沒有接受清單中的 HUD。已登錄時顯示「圖像暫缺」，和未知種遮蔽分開。本地母圖／CSV只能證明檔案與命名存在；OC-211王銅獼王和OC-220黃銅王猿共用entityId不構成替換授權。最新 Owner 指示由dot整批整理驗收後存私人Library，再決定是否下載；先前零散候選均暫停，沒有整合、下載或發布新圖。

## 驗收範圍

須有477條 identity／歷史、同目標不同來源、未知／蛋／空組、214張hash／alias／缺圖、唯讀save／dirty／RNG回歸；正常Continue→Home→Database，兩HUD×五語×1366×768／1366×480／1024×420／390×844／resize，長字、捲動、候選操作及焦點、遲到callback；portable aggregate、公開build/validate、編譯產物瀏覽器及精確SHA發布確認。實際結果與未完成美術／實體裝置驗收見 [報告](../../reports/database-routes-2026-10-14/REPORT_ZH_TW.md)。
