# 210 格共用 VFX 本機收尾（2026-10-07）

Owner 經 parent 於本日移交 Claude 已中斷的 210 批次收尾：核實既有成果、補缺驗證、合併已接受的兩格光束修補、封存及本機整合。沒有授權下一批新美術、公開發布或 gameplay 改寫。Claude 原工作區及所有舊包保留。

## 目前版本與回退

- 正常本機既有流程加 `?vfxOriginal=shared-v1`，讀取 `assets/production/vfx/original-shared-review-210-seamfix-r1/manifest.json`。
- manifest SHA256：`eb64b9790addceffd87638cd024bbe338953547f80ef84b0f01973dfcefe46ea`。
- atlas SHA256：`992850bf24b0594b727ba2a45e2d484d8277e3c31e8bf48ae6af67b7f5f985a0`。
- 回退 `&vfxRevision=157-seamfix` 或 `&vfxRevision=157-baseline`；舊明確候選 query 亦保留。
- 39 特效項目、26 個不同 bank、210 格；文字另三語各12格。Bank110 不在此版。finish、flame-c2、fang-fire 等未選方案分開。
- loopback opt-in、reviewOnly、非 shipping；public-art-boundary 明確排除此新目錄。重用既有 effect pool、native clock、Pixi app/ticker 及語言設定，没有第二套戰鬥或 save。

Claude 原210的 manifest `dff7cabc87a002068145be64a544d450eb3ffe51ea28d8b07a4cf95f21f07da8`，atlas `d3ce57f6f20f7c7879cb59a2bf5acd916d3ca4d5f90d8b36a1478537519355c2`。其142及157舊格紀錄/像素完全保留。本機派生版只取已視覺接受的12:0／138:0修補，共2＋34個raster像素RGB；其他208格、alpha、框、origin、density4、native ticks與三語文字都不變。相對已接受的157-seamfix，全157格均保留。

## 可驗證證據

完整根目錄：[210 收尾與限制](../../../../handoff-review-20261007/vfx210/README_210_CLOSEOUT_ZH_TW.md)。

| 層級 | 結果與邊界 |
|---|---|
| 素材與來源 | 210逐格RGBA、142/157舊格、36文字格SHA核對。33單色程序設計job及3多色設計層核對，無Blender重繪；3角色形象來源SHA吻合，bank148來源仍是未接受候選。 |
| 受控序列 | 沿用原終版56非文字與72三語案例；於主工作區補88缺漏，合計216。覆蓋72非文字序列雙向＋12文字序列三語雙向；逐幀cell、ticks、origin、flip、blank、release通過。不能推成自然AI或人工美術全PASS。 |
| 正常入口 | 隔離既有fixture save，正常title設定→Continue→Practice arena1實際載入210-seamfix，JA重開保存、受控切EN/釋放通過，0error/0warning。Chrome390×844 DPR2，非真手機、非自然養成、非各新特效自然觸發全驗。 |
| 程式檢查 | 19/19焦點測試、1407/1407主工作區portable CI通過。本機素材測試分類為localReference，另行執行。CI首輪兩項陳舊檢查已修：商店公開參考fallback斷言、Codex-owned狀態的相對路徑。 |
| 視覺 | 七組新53格contact sheets已實看。巨浪最差離線median亮度差0.09、亮度差≥0.10占比0.338，保留視覺複核項，不宣稱contrast全PASS。 |
| 效能 | 原210 A/D/H已有有效三組成本/釋放紀錄，未重跑。D首輪candidate median18.1/p95 31.9ms、H第二輪candidate尾延遲偏高皆保留；無GC/冷啟動因果證據。只能承接未變幾何/alpha的面積計算，不能把原210 CPU/GPU量測改標修正版實測。 |

88次補驗錄製後只修正manifest provenance文字；報告仍保留當時manifest SHA，像素、native profiles、loader及幾何相同，承接邊界記於[CONTROLLED_COVERAGE.json](../../../../handoff-review-20261007/vfx210/CONTROLLED_COVERAGE.json)。效能每輪對象、700樣本及方法詳[PERFORMANCE_AUDIT_ZH_TW.md](../../../../handoff-review-20261007/vfx210/PERFORMANCE_AUDIT_ZH_TW.md)。

原生節奏沒有調整：bank104各2 native ticks，在owned配置幀推進後可見1tick；bank1 seq45首格137只1tick，因此同幀已推過。Bank19 seq1是單格6tick loop，受控12次同格顯示不是12/13tick新節奏。

## 正常 AI 尚有限制

| 新項目 | 保存證據能證明的內容 |
|---|---|
| bank1 seq34 | 掃描見107..116於996..1022；保存錄片只110/111/112，掃描有未定位404。 |
| bank3 | 實際保留5場掃描未觸發（其中一場蛋組合），不是舊文字的10場；受控雙向通過。 |
| bank91 | seq0格0..7可見；seq1格8不在210替換範圍。 |
| bank104 | 錄片見0/2/3；端帽1仍缺自然錄片。 |
| bank44 | 保存錄片只命中格8，不等於月牙飛行5..7或命中9全驗。 |
| bank134 | 錄片見飛行4/5；發射/爆炸自然片段缺口保留。 |
| bank19 | 錄片0..3；這些是fixture AI片，不是正常入口觸發證明。 |

Bank92／148自然觸發仍未觀察。全151 banks／484 native序列盤點中，替換84、未替換400（替換由72一般＋12文字組成）。若只看有招式欄位引用的386序列，替換67、未替換319；三個語系不把文字序列乘三，39特效項目也不是序列分母。

按既有缺口排序的前三列：bank119 `e003_crescemonarrow01` seq1（2格、4ticks，有實際對戰觀察）；bank86 `e003_delumonegg00` seq1（1格、9ticks，有實際對戰觀察）；bank8 `e003_unchi00` seq0（2格、30ticks，6物種有引用）。相同bank8的seq1列第四（2格、18ticks）。這是待辦優先級，不是下一批製作授權；Bank110另有已完成的dot候選等待落R核收。

## 私人 Library 封包

| 包 | Library ID | bytes / SHA256 |
|---|---|---|
| 原創成品、來源、210獨立圖格、動畫、離線索引 | `libfile_7e8aa26b26a88191b29c67ca1b1be42b` | 7989293 / `b8a98bd4c6818bb58adddff0d67befce09eee21cd6d94d6995805c5c69aa6d95` |
| 分離未選方案 | `libfile_0763370312dc8191a38554ef4b13bbd4` | 2597289 / `1c744445754766c7e42d99bde1fdb9897610f92dcce5668e5b10a0201b4f3d2d` |
| 私人驗證（可能含未替換的參考特效，不散布） | `libfile_bdb04bc59e4881918730585b9bda2744` | 18549807 / `286d2b4b83253486df137c1322ad848a4d7ce614b1fb40c3b314c1f9c14d7a48` |

三包均小於20MiB；CRC及各內部檔案SHA通過。Library逐項成功；本機Library身分標記因Windows helper不支援而未寫入，完整回條另存。不得把該限制誤寫為雲端封包未保存。

Bank110新R2 `libfile_6ec830c177d4819199501b2e670fb0ca`（6227423 bytes，SHA `238756dc22139f035180165bc216e40f18854a60d2c1b32c941f05344eb8e551`）仍是待整批落R核收的dot候選；沒有拿撤回鳥補入。

本批不改地圖、解鎖、傷害或進化門檻；不改正式save、不commit/push/deploy。回退按receipt與持有hunk操作，不用整檔before覆蓋並行工作。
