# 已核准原圖的公開圖鑑漏接修復

調查基準是實際公開版 `a8337dc64622111e57f972ba2ef67cca131abc35`，不是 R 槽仍停在 `6688298e` 的舊工作樹。公開 `pages-build.json` 已讀回確認該 commit；當時公開主圖 manifest 有 155 張。原 R 槽既有 tracked 修改與未追蹤素材均保留，本輪只在獨立 checkout 修改。

直接原因：`src/championship/app/vs4Screens.js` 的主圖區只在 `databaseHeroPortrait(speciesIndex)` 有資料時建立圖片；列表縮圖也只讀該主圖 manifest。已有角色 HUD／動作、原圖或核稿不會自動成為圖鑑主圖。缺映射時沒有主圖 `<img>`，不能直接說成 HTTP 404，也不能反推角色未核准。原模式 portrait fallback 是進化預覽的另一條路徑。

正常公開政策 `FRIENDS_PLAYTEST_POLICY.fullDexView=true`；圖鑑另保留登錄狀態。一般投影的未揭露條目會在主圖區前 return，但 `viewable`／已登錄條目不受此遮蔽。測試分別保留登錄遮蔽，及公開正常完整圖鑑瀏覽；不修改玩家登錄來湊圖。

| 階段 | 原缺口 | 本輪新增 | 仍待核對 |
|---|---:|---:|---:|
| 成熟期 | 17 | 5 | 12 |
| 完全體 | 29 | 9 | 20 |
| 究極體 | 18 | 13 | 5 |
| 合計 | 64 | 27 | 37 |

全圖鑑主圖由 155 增至 182。新增 species ID：103、105、119、120、124、136、138、139、141、146、168、178、182、185、190–199、203–205。八蛋與其他階段不在此缺口合計內。完整身分、名稱、現行代碼、來源 SHA、Library ID 與核准證據見 [27 張來源 manifest](../../art/production/characters/approved-dex-repair-20261019/manifest.json)、[64 張對照](gaps64.json)、[目前 37 張缺口](remaining-current.json)。`remaining44.json` 是較早 20 張增量時的交接快照，不是目前數字。

## 來源與範圍

- 105 僅使用已核准 r3 `90b4834b1048497840aaadf9142791e08158f0771c27e01a69e99ce362481804`；不用遭退回 r2。103／119／124／136／141 使用各自精確已核准造型與上色原圖，不套用另製姿勢的核准。
- 146 v3 的 R 角色原紀錄有 `owner_approved=true`、`approved_for_dex=true`，精確核准訊息 `Sentinel_fe3ba0201b6c8191846c68fb0af798be`。目視歷史原創設計只有身體骨爪，沒有獨立持械物；沿用完整 v3 原圖，不創作新裝備。
- 168 v5 以 `R_BACKUP_PENDING_BATCH` 的 v5 `OWNER_APPROVED` 記載及精確原檔 SHA 接回；不是因檔名、存在或發布而新核准。
- 178 v3 以 `Sentinel_9f656f5afcb881919b9cc25e6e6b3ab0` 的「Ok」核准指定圖。畫面左側彎曲手臂是角色右機械義肢；不鏡像、不改構圖。
- 185 的 `BATCH_184_188.json` 記載 `accessories_pending=[]`、`encyclopedia_requires_equipment=false`；`FIRST31_DUAL_PURPOSE_AUDIT.json` 記載 `A_RETAIN`、`retain_current_detailed_art=true`。手臂砲已整合於本體，沿用核准原圖。
- 120／138／139 使用原 2026-10-17 交付版本；使用者 2026-10-19 明確表示「我記得那幾隻我們都核過了」，與本次補圖指示共同綁定精確原檔。沒有捏造舊的逐隻 Ok，也不選用較新未核草稿。
- 195–199 等歷史核准索引的證據強度原樣保留，不改寫成剛找到的新使用者原話。原圖 SHA 逐張讀回一致。
- 187／188 的錨鏈與羽槍有具體使用者要求，201／202 的持裝圖仍待補。這些與其他尚待核對項目不以 body-master 自動宣稱完整圖鑑稿。200 本體核准與圖鑑裝備範圍仍分開列。核稿不因這些缺口撤銷。

全部衍生檔只等比例完整縮放：詳圖最大邊 768px、WebP Q90／Alpha100；縮圖最大邊 96px、無損 RGBA。透明度與等比例縮放原圖逐像素一致；不裁切、去背、改姿勢、生圖或改動畫。原檔與私人來源證據不加入公開產物。

## 容量與資料表去重

既有公開包已接近 1,000,000,000-byte 上限。本輪不放寬限制，也不降低既有角色圖片畫質。已由 esbuild 內嵌的 `src/data/championship` 靜態 JSON 省去第二份原始發布副本；保留圖鑑與角色 catalog 兩份公開查驗 manifest。只有編譯器確實讀入並通過原有 SHA 選取的檔案可省去；來源檔與數值不變。

程式所用資料仍在相同 lazy chunks；未合併原本的動態載入。被 `new URL` 指定的 JSON 和腳本會保留原始 runtime 資源及其模組閉包。新增測試實際執行內嵌資料，並確認同一 JSON 一旦被 `new URL` 或直接 `fetch` 使用即不省去。沒有加入新的網路依賴，離線載入仍使用原有 bundle／資產相對路徑。公開主圖 manifest 與角色 catalog 保留，供正常路徑及 HTTP 核對。

## 驗證與發布

最後的 CI、build、獨立 validate、payload、手機／桌面正常圖鑑瀏覽、真正公開 HTTP／解碼結果與發布 commit 分別寫入 `VALIDATION.json` 和 `PUBLICATION.json`；未完成的項目不由本文件預先宣稱通過。瀏覽器使用臨時新 context；不注入存檔、不改登錄。本機以 route 直接讀隔離產物，不啟動全專案測試伺服器。

本輪是可確定來源的增量修復，不代表另外 37 張已補完。後續可沿用目前缺口清單繼續比對新找回的核稿，不能用舊台帳覆蓋較新的核准。
