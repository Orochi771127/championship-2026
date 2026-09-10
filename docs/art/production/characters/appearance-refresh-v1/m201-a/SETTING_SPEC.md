# M201 A 金色短吻貓型幼獸設定

Owner 已選 **M201 A**。依 `production-autonomy.json` 的低出錯優先方向，後續可以自動整理與返修，無需重新開啟這隻 A/B 選案。這份設定用於受控重繪，尚未通過姿態、runtime 或裝置驗收。

**固定五組身份：**三角耳與短臉毛；大型深色眼及奶油短吻；暖金毛與連續奶油胸腹；兩個簡單銀腕環；短厚尖端金尾與淺色趾端。遠側眼耳、腕環、腹斑或趾端被來源姿態遮住時就隱藏，不能為顯示身份而移動構件。

**降低逐幀出錯：**移除比較板大部分碎毛色筆觸，不另加虎斑或花紋。以清楚深褐輪廓、金/奶油的大色塊及固定左上柔光描繪；銀環只留一塊窄亮面和深灰邊，不加反射景物、吊飾或閃爍。色票是設計目標，具體值及規則見 `setting-spec.json`，不是從圖像取樣的測量結果。

**姿態依修正 guide，不依比較板：**

- Main 0 的實際前肢位置、錯開後足與 A 板上的整齊站姿不同；不能將大畫稿縮小置中當成第一格。
- Main 23 的修正圖頭在左、身體偏右，右中有上伸構件與右側白色端點。它明顯不同於舊表/概念板的簡化趴姿；先保留來源可見構件位置，未證明的部位或動作語義不命名。
- 耳形與短臉毛可局部整理成 A 身份，但不移動嘴部、手腳作用端、共同原點或遮擋。不要新增耳尾擺動、腕環旋轉或幀數。

已實際檢視 [Main 0 guide](R:/Projects/Championship2026/_archive/character-appearance-refresh-v1/pose-guides/m201_agumon/main/cell-000.png) 和 [Main 23 guide](R:/Projects/Championship2026/_archive/character-appearance-refresh-v1/pose-guides/m201_agumon/main/cell-023.png)。目前 guide 幾何為 464×368、共同原點 (184,268)、來源倍率 12，狀態仍是 `GEOMETRIC_PROPOSAL_NOT_APPROVED_EXPORT`；不能把研究 guide 的尺寸直接宣稱正式場景比例已驗收。

下一張候選須使用真正透明 RGBA，不含紙色、接觸影、文字與色票；先目視檢查身份與來源構件，再用技術工具檢查尺寸、alpha 及原點。漂亮的角色圖本身不構成動作相容證明。
