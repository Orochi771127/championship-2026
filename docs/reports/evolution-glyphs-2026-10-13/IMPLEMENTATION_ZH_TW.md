# 原創進化符號接入（2026-10-13）

Owner 已選定 dot 的 CP-G01 連結、CP-G02 記憶、CP-G03 成長、CP-G04 進化，授權在既有演出額外加入，驗證與自審後提交／推送／發布。本批屬 `OWNER_APPROVED_ADAPTATION`，沒有新增原作行為證明。

## 接入

- Library 包 `CYBER_PARTNER_EVOLUTION_GLYPHS_V1.zip`，100,993 bytes，SHA-256 `d669d93e6cb7b013550fcd99c3456dda4c6de9182cabe14d5d7a439641ef1523`；支援的 materialize 流程成功，CRC／manifest SHA／預覽可讀。
- 僅選四張原始 128px RGBA PNG（16,989 bytes，解碼 RGBA 合计 256 KiB），檔案／幾何／中心 anchor 未改。SVG、64/256px、預覽與生成腳本均留在私有 intake，不加入 runtime 或預載。
- 既有 Raising 進化寫字容器，在原文字第一與第二列之間額外加入四符號裝飾帶；原六列與繁中／英／日／泰／越文字保持原樣。符號在角色背後，不取代操作提示。
- 符號首次於進化文字顯示階段載入，沿用原生 `totalFrames` 向左流動；降低動態時新增帶置中靜止。沿用現有 Pixi asset scope、容器、Application／ticker 與 dispose；取消後晚到資源不掛回場景，其他存活 scope 保留各自引用。
- 未修改角色、進化条件／命名／存檔／場景路由／原動畫時序；覺醒體改名與橫向演出不在本批。

## 驗證與自審

- 聚焦 24/24：四 PNG SHA／RGBA／尺寸、280/320/390px 布局、原幀數向左移動、降低動態靜止、失敗／尺寸錯誤清理、晚到載入與跨場景共同引用、既有進化／生命周期／原裝素材回歸。
- 正式 `npm run test:ci` aggregate **1,747/1,747**，0 failed／skipped。新測試列入既有 portable 清單。未縮減現有分類。
- `npm test` 包含未隨倉庫提供的既有私有参考資產，未通過；不補造那些無關檔案。正式 CI aggregate 在有本機 loopback 權限的環境完整通過。
- `build:playtest` 9,371 檔；`validate:playtest` 與 `validate:preload` 檢查。源 HTML 271 個 preload 是源模組索引，正式站仍沿用既有 bundler；無四 PNG 開場預載。
- 同一正式 artifact、全新隔離 Playwright contexts；正常 New Game DOM，再以既有 Hand／照護／換日 API 與受控原生 tick 達到第3日的 14→21 自動進化，沒有改 profile、資格或强制觸發動畫。後四個 context 使用這次自有流程產生的進化前存檔；不是 Owner 進度。
- 繁中390/full、英320/full、日320/reduced、泰390/full、越320/reduced 五個情境通過：四符號可見、現有六列內容不變、各語介面切換、四 PNG 請求且只為128px、正常左移／降低動態固定、完成隱藏、離場銷毁四 texture、Save & Quit→Continue 再進入維持一張共享畫布；無缺檔、pageerror 或 unhandledrejection。390/full 與320/reduced 截圖人工檢視，新增帶沒有遮住角色。
- `git diff --check`，選擇檔案與 hash 對照、自審容器層級／事件模式／late load guard／共同引用回收均完成。來源碼、語言文字、角色與規則檔差異僅限上述接入。

## 接受範圍

這是受控瀏覽器／桌面手機窄幅模擬，**新符號尚無手機實機驗收**，不是所有物種／裝置／完整進化條件的新增證明。五語不是20種尺寸／動態組合全排列；覆蓋情境如上。公開範圍仍為 Owner hash-selected public playtest，不提高商業發行／完整 parity 接受。

先前5a003bb9教學對戰到結算返育成成功的 Owner 手機回條，已另存私人圖鑑交接包；不是本批新符號的實機驗收。
