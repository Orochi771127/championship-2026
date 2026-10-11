# Touch R3／Currency HUD R1 — 已審查範圍與驗收

基準 5d1ce6dabffea8076c311a8857cdfd55648be0f7（已發布六面方塊R2）。本批只發布 [RELEASE_FILES.json](RELEASE_FILES.json) 的32檔及必要发布紀錄：25個已審查runtime路徑（11個程式／HTML、14張原創貨幣PNG）逐byte與合併候選overlay相同；另7檔為3個測試、2個既有測試相容修改、CI分類與公開build-input。沒有重製已完成功能。

手機應用表面抑制非輸入文字選取與雙擊誤縮放，保留輸入／說明文字選取及遊戲canvas手勢。PASSWORD A/B與LINK提供明確的使用者點擊貼上按鈕；拒絕或缺少clipboard API時回到手動貼上。過期非同步回覆不得覆蓋已編輯、已離開或已換模式的輸入。既有複製與代碼解析／對戰authority保持不變。

牧場貨幣列顯示既有Bits精確safe-integer餘額及原創圖示；鑽石只開啟五語預覽提示，沒有鑽石ledger、儲值、支付、付費開通或數值改動。正常六面方塊觸控斜向拖曳、商店與既有保存／日期／時間UI已在browser證據中核對。

## 驗收證據

- 相同bytes本機正式CI1679／1679、聚焦77／77、mobile契約16／16、貨幣契約PASS；0 fail/skip。接收端獨立核對原始logs hash與測試計數，不冒稱重跑舊測。最新遠端CI與Pages結果以同SHA最終發布回條為準。
- 四組Chrome browser閘門PASS。HUD120案例涵蓋320/390px、五語、0/一般/MAX_SAFE_INTEGER Bits、保存／失敗、100/200%文字；此矩陣重用前次相同source成功結果。五個原生dialog的背景inert、鍵盤Enter/Space、Escape與返回焦點通過；單按鈕modal的Tab可到BODY/browser chrome，再回按鈕，沒有背景互動。
- 兩組受控剪貼簿各12項，涵蓋allow/deny/missing/deferred與過期回覆；沒有存取玩家系統剪貼簿。正式建置UI五語15個牧場視口與10個PASSWORD視口、貨幣PNG載入、無overflow、預覽不扣Bits、shop隱藏貨幣及方塊斜向拖曳通過。Chrome合成雙指縮放通過；不等同真機iOS。
- 正式build/validate9308檔通過，build ID 203d9a3241ab6de779798086040b83dd3d96e8b3c13aa274b38455b5abf5ce0d。只用process-local解析已安裝esbuild0.28.2，沒有產品／測試source override。
- 公開build-input只新增16個本批runtime路徑並更新9個已核准hash；其他policy、moduleEntries及核准輸入不變。CI portable只新增三測試，原分類及順序保留。完整來源、hash與限制見 [VALIDATION_RECEIPT.json](VALIDATION_RECEIPT.json)。

## 授權與未完成事項

本接收聊天取得直接人類授權，發布這32檔與必要紀錄、一般push既有main、部署既有Pages並同步本機。先前僅審查／不得發布限制已被本批直接授權取代。公開hash與commit以最終同SHA回條為準。

真機iOS Safari長按／雙擊／系統剪貼簿與OS中斷仍UNVERIFIED。正式建置browser觀察156次、12個既有internal-character-review 404路徑，前版Cube與本版均缺相同參考檔，沒有貨幣圖示失敗；不宣稱全部HTTP零錯誤，也不混入角色fallback修復。保留初次CI相容性失敗及browser斷言／selector／原生modal／pinch重試歷史。先前C公網冷牧場超時與Battle一般流程仍待結案；本批沒有重跑公網長測。

原121652個未追蹤路徑與兩個協作者worktree共14個dirty檔保留；僅本批19個新檔晉升追蹤。沒有金流、儲值、支付、付費開通、新線上LINK後端或其他協作者變更。
