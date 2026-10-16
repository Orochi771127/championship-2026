# 育成提示位置與限時淡出

範圍：`OWNER_APPROVED_ADAPTATION`，只調整 DOM 提示與顯示偏好，不改玩法。
基底：`aeb125257619667774d5ccd4927987184d8e5e95`；tree `574c685240c561495a56ba1438d40836dfbe882a`。

## Owner 決定與畫面契約

Owner 的三張實際畫面將一般操作提示圈在上方、清潔工具說明圈在工具列正上方。2026-10-16 決定：一般提示移到左下，工具說明保留水平置中；兩者不能互相遮擋。最後同意首次一般提示 5 秒，之後 3 秒，工具提示 2 秒，接著約 0.3 秒淡出。來源：`Sentinel_feebd60fccb48191bbde4e4c6b61f0e1`、`Sentinel_a08456d82e808191a1cdc7f533f94939`、`Sentinel_668ebafbf6dc8191aecea9cd51db445a`、確認 `Sentinel_b34d51445ab88191898739f6117fff2e`。

- 一般提示在可玩場景載入完成、教學／生命週期遮罩解除後才開始計時，不以遊戲第一天當作「首次使用」。
- 首次是此瀏覽器來源第一次實際顯示；之後每次重新進入育成最多顯示一次 3 秒。選取夥伴仍會關閉一般提示，不因取消選取或每幀重畫而重啟。
- 兩提示同時存活時，一般提示在左下的上一列，工具提示在工具列上方置中。工具提示的實際換行高度加 8px 由既有工具列 DOM 回報；不使用語言專屬固定高度。淡出完成後才釋放這列空間。
- 工具每次新選取重新計時 2 秒；語言更新、庫存更新、相同 mode 更新不重啟。快速換工具會取消舊的 hold/fade timer。導覽離開與 dispose 會解除 timer、observer 與 listener。
- 降低動態偏好仍保留 5／3／2 秒閱讀時間，但不做淡出動畫。
- 一般提示正常長度不攔截場景操作。極端加長文字超出剩餘高度時，限制在狀態列下方、工具提示上方的可用範圍內，只有文字卡本身可觸控／鍵盤捲動，不覆蓋場景其他區域；焦點會在淡出前返回原控制。工具選取狀態及實際操作完全保留，時間到只隱藏提示，不呼叫工具／玩法 intent。

## 工具退出與可及性

既有工具列按鈕本來即可再次按下以放下同一工具，維持 `aria-pressed`。提示中的「完成」淡出後，這個持續可見的工具列按鈕仍可觸控或鍵盤使用；其選取時可及名稱增加既有 `uiText('完成')` 翻譯。圖示及畫面短標籤不加字，不改工具列尺寸。若鍵盤焦點在即將淡出的「完成」上，會先回到相同工具列按鈕；直接按「完成」亦回到該按鈕。教學鎖定工具的限制不變，不新增教學逃離路徑。

## 首次使用偏好與保存邊界

`raisingHintSeen` 是既有 `settings/preferenceSchema.js` 的 device／access 布林顯示偏好，預設 false。應用程式把既有 preference store 注入提示期限 callback；只有 `ChampionshipPersistentSavePort.js` 的既有 preference port 可持久寫入 `championshipModernSave:preferences:v1`。沒有額外 storage key、第二個 writer，亦不放寬 migration firewall。只在第一次真正顯示時設為 true；首次已開始但中途離開，也算已看過。儲存被拒絕時，既有 store 保留此分頁值並誠實回報失敗；新版 preference 文件仍 read-only、不被覆寫。重設「操作與輔助」或全部偏好可恢復首次 5 秒，重設音效不會影響它。沒有讀寫遊戲存檔、錢幣、鑽石、背包或角色欄位，也沒有 save schema migration。隔離展示未注入 store 時只使用模組記憶體，不接觸 Storage。

## 驗證與界線

本機聚焦 Node 檢查涵蓋 5／3／2 秒與 300ms、實際使用前載入等待、偏好 storage 拒絕、重畫／重新翻譯不重啟、快速換工具、反覆點選、導覽與回到育成、dispose、降低動態、工具保留及焦點／退出路徑。既有全幅育成、浮動角色卡、responsive toolbar 與 ceremony 回歸仍保留。

實際瀏覽器 runner `tests/championship-raising-hints-browser.mjs` 與 `.github/workflows/raising-hints-browser.yml` 將矩形量測、真實牆鐘時間、兩提示同時可見、點擊與截圖分開記錄：390×844、844×390、1366×768；繁中／英／日／泰／越；兩套 HUD；安全區、130% 文字及加長文字壓力案例。另有隔離 QA save 的正常育成進入、工具操作與離開／回來 smoke。DOM 測試使用已公開的 field presentation seam，不把它宣稱為遊戲渲染測試；正常流程則使用真實場景。

本機 Chromium 啟動受到執行環境限制，不能用 Node／來源檢查冒充瀏覽器通過。完整 CI、build／validate 及瀏覽器結果必須在對應候選 commit 驗證後才可宣稱完成；真實 iOS/Safari 裝置驗收仍分開。沒有改動已核准角色圖、美術、ROM 計時、Pixi renderer/ticker 或其他模式。

## 打包

新增的 `transientHint.js` 加入既有 build input 的 `moduleEntries`、`files`、公開選用 hash；後續修正只更新實際變動的 runtime／preference schema hash。其餘紀錄逐項保持不變，不重排 ledger、不加入 ledger 自己。工程測試列入既有 CI scope，瀏覽器 runner 單獨分類並由專用工作流程執行。


## d51cd84 精準修正與驗證

修正基底：`d51cd84ee8814725c300917bb6c21781f59f6fea`，tree `2e818948f4db9d805b1b6dd2914e7ff280da6323`。該次 hosted build／validate 通過，原 CI 2403／2405 通過；兩項失敗是新的直接 Storage writer 與舊測試只預期一個 ResizeObserver。現已改走既有偏好 owner，並讓工具列測試同時驗證 rail 與 hint observer、量測彼此獨立及兩者 dispose 後都不能重寫 CSS。

該次瀏覽器 120 組矩形與 5／3／2 秒、300ms 檢查通過，但人工檢視發現 844×390、越南文四倍加長／130% 文字／模擬安全區的提示超出上方狀態列。此修正加上頂部界線及溢位文字捲動，不能沿用舊矩形通過當作新畫面驗收。QA 另修正開場片 Skip 尚未出現時就檢查一次的入口競態，依實際可見的片／登入／繼續／育成狀態前進，沒有跳過玩法。

本機修正後 88／88 聚焦 Node 測試通過；不改動的「一個 save key／一個 persistent writer／一個 Pixi bootstrap／無第二 ticker」firewall 個案另通過。新瀏覽器 runner 語法與 self-test 通過；頂部界線、溢位捲動及正常育成 smoke 仍待下一個 exact-head hosted CI，不宣稱已通過。

## 4d13363 工具文字視窗修正

`4d133635b03182b8957e00bd2775588a2accac53` 的較強瀏覽器檢查發現 390×844、英文四倍加長／130% 的工具卡：外框高度已限制120px，但子文字捲動視窗仍依22dvh達169.67px，超出父卡上下界。原始文字未被刪除，但子視窗被父卡裁切，不能把「有scrollTop」當作完整可讀。本次只把文字視窗同步限制為父卡上限減16px；正常短文字、短橫向畫面、2秒工具期限均不變。保留既有 child bounds 與真實 wheel 捲動斷言，不放寬檢查。新增CSS cap回歸，本機89／89聚焦測試及原封不動的writer firewall通過；修正後實際瀏覽器仍待exact-head CI。四倍合成文字是邊界壓力測試，不代表2秒內可讀完長段落；實際五語言短提示才是主要閱讀契約。
