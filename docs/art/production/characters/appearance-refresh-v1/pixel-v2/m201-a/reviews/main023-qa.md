# Main 023 手工像素候選與 Main 000 修正複查

已用 canonical palette 手工寫出 **32×16、bounds [-16,-11,16,5]** 的 Main 023 候選，只有 8 個可見色。`author-main023-isolated.py` 不載入來源 RGBA，也不將原像素重新上色；輸出來自明示創作 glyph rows。QA 階段另外讀取來源，僅比對座標與透明 support。

候選保留左側頭形、右中上伸構件和右側向下的腿端，不使用概念板的普通平趴姿。兩個新短耳位於上方頭部區，奶油臉/胸與金毛重新設計。這個姿態的頭部與下半身都沒有聲稱可重用 Main 000 patch。

**已檢查**：原生 PNG 為32×16 RGBA、palette 與 canonical 一致；相對修正 source guide **沒有移除任何 alpha support**。新增12格全部在 rows0–3、cols7–16的頭/耳範圍。其餘構件 support 相同；上伸端保持 (20,1)，右側腿的最末淺色點保留 (25,11)。這些是格內座標，均0-based。

**仍是待 root 審查的候選**：左下 (7,9)–(8,9) 灰腕提示是美術對肢體的解讀，單一 OAM 矩形不證明腕的解剖位置；奶油臉面積與耳形也要在原生1×確認身份。眼使用一條三像素深色提示，没有推定它是睡眠或其他 gameplay 動作。透明 support 通過不等於遮擋/全動作通過。

可用 `main023-candidate.json` 的 `nativeBounds`、`pixels` 和空 `patches` 作為 bank master 輸入，保留 `artReview=PENDING_ROOT_REVIEW` 與 `poseReview` 的部分完成狀態，不直接標為正式可用。

另外已從目前 canonical bank 重新解析並渲染 Main 000，而非再次看舊 first-review 圖。三個頸/肩邊界像素已恢復，`eye-closed` 高度為2。這個修正後的 A 像素方向可保留；render 複本為 `main000-current-resolved-review.png`。

本次僅寫隔離工作目錄，沒有覆寫 canonical bank、切換 runtime 或宣稱全部母版完成。
