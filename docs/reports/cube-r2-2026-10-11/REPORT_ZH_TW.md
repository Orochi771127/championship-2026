# 六面方塊自由旋轉 R2 — 已審查範圍與驗收

基準 `043a150289f9cef6cbd74ce02fa045d78e4fa92b`。只整合 [RELEASE_FILES.json](RELEASE_FILES.json) 六檔及必要發布紀錄。產品兩檔與 dot R2 原包逐 byte 相同；原包 SHA-256 `08e94747525a26a5dc88de55c430c18c2250ca42128e930250025c8f957b56d6` 已在本機重核。前景批次已先獨立發布。手機 R3、房號貼上、貨幣 HUD、金流、付費開通與其他未驗收功能不在此批。

R2 沿既有 Three 選單使用 quaternion trackball；水平、垂直與斜向拖曳可持續自由旋轉，放開保留方向，四方向鍵每步15度。沒有慣性、snap、額外 ticker 或第二遊戲 authority。點擊實際 cube 面透過 raycast 選擇原六個 mode，拖曳、取消或空白點擊不選模式。兩個沒有原創 panel 素材的面使用既有五語 UI 文字；沒有新增美術或 ROM 素材。保留 HTML 模式按鈕、WebGL/texture fallback、既有 offline LINK/PASSWORD、注入 onSelect 與 dispose 界線。

## 已完成驗收與正式建置

- 聚焦25／25、完整 LINK/PASSWORD16／16、本機正式 CI1663／1663，0 fail/skip。具體原始 log hash、指令及完整限制見 [VALIDATION_RECEIPT.json](VALIDATION_RECEIPT.json)。接收端核對相同程式/測試 bytes 與原始 logs，不重做功能或重跑無關長測。
- 桌面與390px Chrome觸控模擬各點六個實際面；正常app另點六面，六個mode面板皆正確、未直接開戰、保存的Bits不變。禁用面12次、空白點擊、自由拖曳／取消、五語、重入、texture/context釋放及既有五視口/fallback閘門均通過。真機iOS、手寫筆及OS中斷仍UNVERIFIED。
- 正式既有 build/validate 9292檔通過，build ID `1fac5008e3656f825b67af6131f06acaa5d616b612241b8ae992ec6e389dc138`，候選輸出 `dist/cube-r2-20261011`。只以 process-local NODE_OPTIONS 解析已安裝的 esbuild0.28.2，沒有產品或測試source override。
- Build-input只新增trackball模組及其hash、更新既有presenter hash；其他核准輸入不變。CI scope只新增既有portable分類的一支trackball測試。browser測試只把被教學鎖定的新遊戲入口改用隔離repository full QA save的正常Continue，不改教學或玩家存檔。

## 授權、保留的失敗與未完成事項

本接收聊天已取得直接人類授權：六面方塊自由旋轉完成並驗收通過後，獨立commit、一般push main、部署既有Pages並同步本機。最新commit、CI/Pages、local main與公開hash以同SHA最終回條為準，本預提交報告不宣稱已部署。

保留原Library Windows `os.setxattr` 落盤失敗歷史；後續有授權的傳輸已讓原包落盤，本次實際核对其hash。原browser新遊戲SYSTEM被教學鎖定、初次lost-capture測試事件順序及esbuild/loopback EACCES失敗亦保留；只據後續正式成功證據判定本批，不冒稱從未失敗。

真機觸控仍未驗收；沒有新線上LINK房間後端或開通聲明。先前C的公網冷牧場載入超時與Battle一般流程仍待解決，本批不重跑公網長測或宣稱已修復。保留既有單一app/router/save/Pixi/ticker與其他協作者工作。
