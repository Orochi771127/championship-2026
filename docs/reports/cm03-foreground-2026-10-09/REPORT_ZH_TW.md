# CM03 r18 前景與 CM24 缺件交接

本批依 Owner 經 parent 指示，只從既有 CM03 r18 master 無損匯出前景並接入本機；不重畫、重排場景或改可走網格。CM24 僅交缺件契約。Git 仍為 `handoff/dot-continuation-20261001` / `1fb7d5fd21d3da47775d34ab0d3a1a95f6623972`。

## CM03 成果與來源

- 14 組前景與 manifest：`assets/production/cage/cm03-r18-foreground-20261009/`。每組記錄 master 物件名稱、4x 全畫布 bounds、ground depth、PNG SHA 與 mask rectangles。
- 原 master：`docs/art/production/original-character-cage-r1/cage-base3d-v1/opm-opus-r18/seam-v3/fields/field_cm03_01/master.blend`；SHA256 `9b5d847bc91c587413be5baf600501ab60820517a05742a4a53af13a8cf297f0`。
- 保留最終合成图 `assets/production/cage/final-intake-20261008/fields/field_cm03_01/frame-00.webp`；SHA256 `b757e18558a44b0f2ebd3052ae9de508258cff9b4670fe3b8215fb55bf6d70df`。旧 master 的 frame/base 色彩不同，未拿來替换最終成品。
- 匯出以原 master 相機／幾何對 1152×800 像素中心做可見面 ray cast，不渲染新色彩。PNG RGB 取自最終合成圖；93,352 個可見實心像素逐點相同。遮罩為像素中心二值輪廓，並非另一次帶抗鋸齒的美術重製。三組看台、一排擋板、兩燈柱、兩欄架、跳高墊／框架、四錐筒分別按原 master 地面投影深度排序；地板、跑道及地面標線不升為前景。
- Runtime 用 221 個合併矩形 stencil 輪廓重用底圖的同一紋理、完整 quad／UV，消除獨立裁圖在 1.5 device-pixel 取樣下的鄰像素差異。新增解碼貼圖 **0 bytes**；環繞三份共 42 組、663 個 mask 矩形。無新增 Application、ticker、模擬狀態或存檔。
- 僅 loopback、指定 final manifest 與 CM03 合成圖 SHA 匹配時接入。上排裁切與環繞跟隨現有 placement / viewport；其他籠子與公開站點不接此層。

## 驗證與界線

27 項聚焦測試通過（前景來源／裁切／環繞／生命週期、runtime art、cage plan、viewport、五語開場文案）。Chrome 隔離存檔正常 Continue／退出三次，species 8、34、218；再做 28 個受控呈現案例，包含錐筒、欄架、燈柱的後方／前方／手持及橫向畫面。這些受控坐標不宣稱正常尋路或實機驗收。

所有 28 組無角色的前景開／關比較為 **0 像素差**。每個後方案例皆產生遮擋，手持均不被遮擋，所有改變只發生於角色／陰影原有像素。第一欄架前方仍可被更靠前的第二欄架遮擋，屬分別排序結果。輪廓邊緣由 renderer 覆蓋率處理，未把半覆蓋像素誤列為全實心。三次退出皆釋放前景，無 page error 或 art fallback。

完整 screenshots／初始診斷與最終回條在 `R:\Projects\Championship2026\cm03-foreground-20261009`。以 `browser-verified/` 與 `BROWSER_VERIFIED_*` 為最終證據；`browser/` 的獨立裁圖取樣差異與 `browser-final/` 的测试定位不足均為診斷歷史，不作 acceptance。來源逐像素比對及最終摘要已複製至本報告目錄。未做全遊戲、所有籠子、實體手機、商用權利或發布驗收。

## CM24 最小下一步

[精確層契約](CM24_LAYER_REQUEST.json) 列出最後版本 SHA、原點、4x 尺寸、上／下排裁切與分組要求。最終合成圖及 ART_INDEX 已在本機，來自 21 包索引的 **PART21OF21**，Library `libfile_b1910288749c8191a5aac5a073fdc9ef`。无需重下載全包。

仍缺最終重排 master（SHA `dd731a1d27cec5cc19ecf67682e20a26bc3fd86c873f5e9e3c3b39b87ea28670`）或與其對齊的雕像、雙柱、祭壇／供物／香爐前緣、雙燭等 alpha 層與 ground anchor／depth。其 Library ID 目前未知。`libfile_59db9df36a4c81919572cc7bd1879360` 是舊 r3 SOURCE PART15，不是最終 master。雕像 +24 native y／香爐 +12 native x 只證明重排，不足以推算最終遮罩。未使用舊遮罩，未改網格。

## 開場文字

繁中舊回退原文仍可能顯示舊品牌，已讓四段顯示文案全部透過 `openingStoryText.js` 與 `brandTerms.getOpeningBrandTerms()` 取得待定名稱，保留每四年、參賽資格、你的參賽機會和收信語意。只處理四段，不動玩家名稱、技術 ID、存檔或字典全域替換。五語正常 New Game 390×844 均無舊品牌、無水平文字溢出，role / keyboard focus 保留；不宣稱母語者文字審定。八蛋與教程程式未修改。

## 安全狀態

使用既有 `127.0.0.1:8766` / PID 38660；保留協作者髒工作區，不 commit／push／merge／checkout／reset／部署／刪除。只建立測試瀏覽器隔離存檔，不碰玩家存檔。未重試 Library 拒絕、未購買或重置額度。後續漫畫 R2 為獨立 Owner 授權接圖批次，另列回條。
