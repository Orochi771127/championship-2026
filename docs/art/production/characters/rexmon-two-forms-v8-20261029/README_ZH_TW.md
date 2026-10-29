# 雷克斯獸雙形態 v8 — 入冊與接入狀態（2026-10-29）

依 Owner 交付 `REXMON_V8_CLAUDE_SETUP_HANDOFF.zip`（SHA256 `0666d12a…a41882`）與其中指令（SHA256 `dc3d048f…def1ae`）。美術包 `雷克斯獸-雙形態設計交付-v8.zip`：9,779,509 bytes，SHA256 `4990677778c0a9428484cbb1cf7654fa4df1d037c83231be5d6c586cb09a235f`。

## 身分

同一角色（`characterKey: rexmon`）的兩個形態，兩者都是究極體（`numberingStageIndex: 6`）。這不是兩隻無關的角色，也不新增進化階段。

| speciesIndex | 名稱 | form | 圖鑑編號 | 主圖 SHA256 | 三視圖 SHA256（僅設計參考） |
|---|---|---|---|---|---|
| 243 | 雷克斯獸 | `dragon` | UL41 | `989c4b80…ab334d9b`（檔名 v7，v8 manifest 選取） | `abb20ebf…a0512c41`（`dragon-threeview-v6.png`，v8 manifest 選取） |
| 244 | 雷克斯獸·戰鬥型態 | `battle` | UL42 | `b0655ca5…e4709039` | `2a08062d…1e15de4a`（v8） |

- 243／244 在 main、所有本機分支、所有 worktree 的 `src`／`docs/contracts` 都未被使用。究極體原本到 UL40，依「階段內追加、不回收」規則取 UL41／UL42。既有 speciesIndex、UL 編號沒有重排，也沒有借用其他角色的 ID。
- 形態關聯：`database-illustrations.r1.json` 新增可選欄位 `form: {characterKey, formKey}`，由 `assertDatabaseIllustrationCatalog` 驗證：同角色每個 formKey 唯一、同一階段、至少兩個形態。另新增 `databaseIllustrationForms()`。原有 12 筆不受影響。
- v7 人形背炮方向已被 v8 取代，不採用。v1 雙型圖（`dual-form-main.png`）只當故事模式立繪參考。雙型合圖與三視圖都不進遊戲資產。

## 三種狀態分開看

| 層 | 狀態 |
|---|---|
| 入冊（美術／角色資料規範） | **完成**：本資料夾 `manifest.json` 記錄主圖、三視圖、來源路徑與 SHA。 |
| 展示（圖鑑） | **完成（本分支，未合併、未部署）**：兩型以 `ILLUSTRATION／NOT_TRACKED` 顯示在究極體與「角色美術」分頁。768 px 展示圖與 96 px 無損縮圖已接入公開資產選集、資產索引與建置清單。 |
| 可登錄 | **未接入**：可登錄仍是 218（216 原生＋229／230）。不能說已有 220 可登錄，也不能說可遊玩。 |

圖鑑總條目由 238 變成 240（224 原生＋2 擴充＋14 僅展示）。

## 動畫

兩型都還**沒有任何動作格**。需求與缺件見 [ANIMATION_REQUIREMENTS.v1.json](ANIMATION_REQUIREMENTS.v1.json)：一般遊戲 Main40／Sub13，加上 Data Arena 八方向 move／melee／ranged／hurt，以及 KO 與 win 的條件格。

## 待 Owner 決定（不自行杜撰）

1. **D1 數值與屬性**：HP、攻防等數值，屬性／元素。
2. **D2 技能**：一般 Battle 招式，以及 Data Arena 招式 2–4 與終極技。
3. **D3 取得途徑**：捕捉、商店、轉蛋、進化或其他。
4. **D4 形態關係**：兩型之間能否變形；變形觸發條件；是否為同一存檔個體切換形態。
5. **D5 一般動作時序**：指定 motion donor 的 tick 表，或改用原創時序。
6. **D6 動畫畫布**：尺寸與密度。
7. **D7 文字**：英、日、泰、越名稱與五語圖鑑故事。目前只有繁中名，其他語系也會顯示繁中名，圖鑑沒有故事段。
8. **D8 名稱分隔點**：Owner 原文用「·」(U+00B7)，既有「天穹帝龍・戰鬥型態」用「・」(U+30FB)。目前照 Owner 原文。
9. **D9 可登錄化路線**：目前的擴充契約只允許繼承 211／222 的數值，雷克斯獸不適用。要成為可登錄的 219／220，需要原創數值來源與契約變更。
10. **D10 Data Arena 定位**：可選拍檔、對手，或兩者都是。
11. **D11 攻擊部位**：近戰與遠程各由哪個部位發動（磁軌砲臂、背炮、龍顎、爪），以及釋放點。
