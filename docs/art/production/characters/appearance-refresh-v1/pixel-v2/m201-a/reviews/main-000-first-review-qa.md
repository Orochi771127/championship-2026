# Main 000 第一張像素稿：方向可採用，三個邊界像素需局部回補

美術總監接受這個 **M201 A 的低像素方向**。三角耳、金色、奶油短臉/胸腹和腕灰可讀；沒有新增腳環。這不是把高清所有細節硬塞入，簡化合理。

source guide 與 20× nearest review 圖做逐格 alpha 採樣：**rows 14–23 完全相同**，手端、錯開足端及下部透明洞沒有像先前高清稿一樣漂位。新增 alpha 主要位於原上方餘量內的耳部，以及 row 8 的右側單像素臉毛尖，可接受為已選 A 的局部輪廓。

正式閉合 Main 000 前，建議在 author glyph 回補三個 `K` 像素（column,row，0-based）：**(11,11)、(11,12)、(12,13)**。這三處是來源頸/軀幹/肩右邊界，現稿不必要地收窄；恢復它們不妨礙貓型設計，也不需要改手足。可選擇把鼻點 **(1,6)** 從 `R` 加深為 `D`，提升短吻辨識，alpha 不變。

另外，author script 的 Main 002 `eye-closed` patch 是 **3×3**，第三行 `GGG` 會把 Main 000 row 7 原本的 `DDG` 改掉兩個像素；但實際 source 000/002 差異只有 rows 5–6、cols 7–9。把該 patch 改成 **3×2**，不要因「closed」名稱自行增加第三行變化。其他 cell 的局部 patch 也依各自 delta 判定，不一律套相同語義。

這次只完成第一格方向、手足 alpha support 與 author source 的具體檢查，未驗證整套47母版、83槽、完整播放或 runtime。完整逐格變更與範圍記錄在 `main-000-first-review-qa.json`。
