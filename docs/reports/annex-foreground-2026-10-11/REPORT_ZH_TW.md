# CM03／CM24 折疊擴充前景 — 精確兩檔修復

基準 `53939f7ec46de322d7d2d1d349eaef104d0f5b3b`。擴充配置的底圖位於 band／cap 容器內，原前景僅查直接子節點，導致載入失敗。修復在既有 art owner 樹內索引底圖、按原 fold 邊界裁切 stencil 並投影座標，前景以既有折疊角色的畫面 Y 排序；未折疊保持原 wrap／depth。只整合 [RELEASE_FILES.json](RELEASE_FILES.json) 的兩檔，無素材、角色尺寸、碰撞、存檔、付費開通、UI／B／cube 或第二 renderer 改動。

## 證據與本次正式建置

- 原候選 bytes 不變：聚焦49／49、唯一一輪 hook CI 1646／1646保留沿用；那一輪本身不是候選正式發布建置。
- **本次正式既有 build／validate 通過**，9,291檔、build ID `28cb5afcb28ca67bfe4cfd4741eb603d0edeb3032bc1a8ccd1922b38c13f1bea`。正式 browser bundle metadata 與已測候選相同，57個输出 SHA／bytes 全數相符；未靠 hook 代替本次正式產物。
- hash-selected public-playtest 清單僅更新 `cageForeground.js` 一項，其他9231項不變，沒有新增素材或目的地。
- 正常隔離 QA 流程：390×844 DPR2 mobile、1280×900 DPR1 desktop，授予原型→CM03@20／CM24@26→正常手掌搬運合法落地→保存退出重開→取回→撤銷→保存重開均通過，pageerrors/warnings=0。QA授予不代表一般玩家已可解鎖。
- C四檔及28個受保護素材／manifest hash不變。候選包 `libfile_32325cd6e83c8191b26eb9d9f741ece9` 含原始圖、來源與測試輸出；完整CI log SHA為 `cd1cc1931e09b7e44d0f6a3a7a1d2d4234aaf64791fbeb2d5a290e1345e6411d`。

## 嚴格 FAIL 與有限視覺接受分開

[STRICT_PIXEL_PROOF.json](STRICT_PIXEL_PROOF.json) 原 bytes 保留，`allPass:false`，沒有改寫 PASS。dot 獨立檢查原尺寸畫面、幾何與 GPU 對照後採用 [VISUAL_ACCEPTANCE.json](VISUAL_ACCEPTANCE.json) 的有限例外，只限精確候選 hash、圖片 hash、viewport／DPR／pose與指定座標。桌面actor-free三點各channel差≤1、alpha不變；front另(196,296) blue202→203獨立記錄，非預期遮擋；outside-actor(190,290)為既有點。其餘座標／更大差／素材／形狀／位移仍block。mobile維持原零差異門檻，held current/raw零差。未建立全局近似比較或放寬既有測試。

dot判斷強證據支持共用三角對角上的4xMSAA合成量化；這是其分析／品質決策，不冒充新增GPU因果測試。mask ABC三座標A1=A2=C、B不同；break-only三點無差；mesh造成141底圖像素差而被拒絕，未採用mesh、關AA或renderer monkey patch。dispose後四張original控制圖hash還原。

## 發布與未完成界線

Parent明確要求把本批交既有local發布任務；接收端仍须確認適用授權。過去C接收聊天直接授權只涵蓋C、排除擴充，不能冒用。commit／push／CI／Pages／local main／公開hash僅以本批最後發布回條為準；此報告本身不宣稱已發布。

不重跑公網長測。既有C公網牧場載入超時、Battle一般流程、實體裝置、其他未列配置、付費／一般玩家擴充入口皆未因此結案。使用既有單一app/router/save/Pixi/ticker，沒有碰玩家存檔或新增伺服器。
