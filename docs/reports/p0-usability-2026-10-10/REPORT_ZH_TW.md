# P0 保存與交換碼可用性 — 2026-10-10

Owner 已透過 parent 授權本輪 P0 修正、重點驗證、commit/push 與 Pages 公開核對。基線：906915b7a9dd560768ab5e98309c51b3b831ddeb。工作僅在獨立發佈 checkout；原工作區 67 個既有 tracked 修改的 SHA256 與交接清單一致。

## 修正

- 沿用唯一 save port／autosaveScheduler。既有 SAVING、SAVED、SAVE_FAILED 指示不重做；設定與狀態詳情補最後成功時間。跨分頁衝突顯示原有不覆寫說明。
- 設定 → 資料與帳號增加下載完整備份。先以既有 envelope parser 及 Continue 的 restoreCandidate 驗證，含內層育成 digest、身份、育成 production、RNG 與狩獵紀錄。成功保存時輸出原保存 bytes；寫入失敗時輸出最近未寫入 snapshot。下載不觸發保存、adopt、匯入或覆寫，也不假稱包含尚在等待保存的變更。原失敗專用匯出使用相同驗證與 DOM 下載 helper。
- 先以兩個紅測試重現 host/guest 換隊仍保留舊 invite/reply/prepared。換隊現在撤销本頁舊碼與啟動資格；更換貼入回覆也撤销 prepared。這不能遠端收回已分享的離線碼，畫面明說需要重新交換。
- 雙方皆有複製按鈕；Clipboard API 拒絕時選取完整碼並提示手動複製。主方先讀取回覆、確認碼內雙方隊伍，另行啟動本機重播。隊伍名稱用本機對應名稱／碼內名稱或種類，保留底層 instanceId。
- 密碼對戰產生自己的隊伍碼後自動填入 A 隊，B 隊供貼入對手碼；換隊清掉自己的舊 A 碼。非同步過期結果不得重新填入舊碼。
- 24 個新 UI keys 補入既有繁中、英、日、泰、越五語表。交換及重播界線明確，沒有房間、帳號、伺服器或即時連線功能。

## 驗證範圍

重點回歸涵蓋 autosave、保存衝突／失敗、保存經濟與時鐘、link/password codec 與 app、owned party、UI、設定與語系。115 項首次全通過，追加非同步密碼測試後 UI 17/17 通過；去重共 116 項。

手機：隔離 Chrome context、390×844、DPR 2、touch；由既有 canonical fixture 加入第二個原生合法 owned profile，驗證後保存，未使用玩家資料。成品用本地 route 載入，並無新伺服器。保存成功、等待、失敗、最後成功時間、失敗備份保留原檔，以及兩個獨立 context 真實交換後進入既有 Battle core 已驗證。未控制比賽結果或修改 RNG。

五語驗收有 html.lang 斷言；初版腳本誤用 language 欄位而全為繁中，該批五語主張已撤回，修正為 locale 後重做。最終手機與雙端收據見 VALIDATION.json；圖片、逐步腳本與測試輸出由本輪 Library 小包交接。

保存 schema/version/key、原始 codec、對戰規則及 RNG 均未修改。沒有重製美術、額度重置、購買或自動儲值。

## 保留 OPEN

冷啟動／媒體傳輸停滯依 R4 實測仍為 OPEN。後續可研究可取消背景載入，但本輪未納入。手機模擬驗證不等於實機接受；五語為工程驗證，尚未新增母語編校。此報告不宣称全遊戲穩定、完整原作 parity 或商業發佈權利接受。
