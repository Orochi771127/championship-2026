# 角色定稿圖鑑與工作區收尾 — 2026-10-19

本輪從最新遠端 main `8d9864dcd176a2439d7cae9bc7f7efc0cf498de7` 建立隔離整合工作區。原 R 槽 main 為 `6688298e`，有 19 個 tracked 修改及 121,676 個 untracked 檔案，沒有清除、覆寫、stash 或把它們全倉加入。原工作區保留其未完成候選，不能把隔離分支或遠端 main 的結果說成原工作區已乾淨同步。

## 定稿判準與盤點

Owner 本輪澄清：完整單張圖才是圖鑑候選；原本有武器、後來拆成本體與配件的角色，必須用本體實際拿著配件武器的完整持裝版本。空手本體、分離武器、設計板、像素動畫、三視圖不算該角色的持裝定稿。原設計本來不持武器的角色不用新增武器。[契約](../../contracts/championship/DATABASE_FINAL_ART_2026-10-19.md)保存本輪精確範圍。

逐筆核對今天的既有 230 身分設計盤點、當前圖鑑身分、最新公開選取與完整圖片 SHA-256。八類蛋另列；224–227 別名不重複計算，228 sentinel 不分配。

| 項目 | 結果 |
|---|---:|
| 非蛋圖鑑身分 | 230 |
| 整合前遠端專用單張圖 | 140 |
| 本輪新增完整單張圖 | 15 |
| 整合後專用單張圖 | 155 |
| 仍無專用單張圖 | 75 |
| 已知仍需持裝替換的舊空手圖 | 2（077、078）|

155 是圖片選取數，不是對全部舊設計重新核准的數量。077／078 舊空手圖有早先公開紀錄，但依本輪新規則列為完整持裝替換待辦；本輪未畫新武器，也未以像素圖倒退替換現有圖片。其餘舊 138 張保持原選取，未把「缺歷史核准證據」直接說成「沒做過」。完整名單及差異在 [CSV](character-finalization.csv)／[JSON](character-finalization.json)。

仍用像素／HUD 回退、尚缺非像素完整單張的幼年 II 共 11 隻：鋼鈴芽 B201、焰角丸 B202、曉暉靈 B203、芽螺寶 B204、角絨仔 B205、聖暉絨 B206、霧鬃貓 B207、幽咬豆 B208、花喙芽 B209、焰角幼龍 B212、星糯核 B214。這些按 Owner 的新定義列為未定稿，沒有裁切設計板或放大像素圖充當新定稿。

缺圖 75 筆再分為：11 筆幼年 II 缺完整單張；33 筆未定稿或版本核准證據不足；1 筆霜紋狼最新畫風返修；5 筆最新核准單張只有 Library ID、指定原檔尚未落地；105 握姿返修 1 筆；146 本體參考尚缺完整主圖 1 筆；23 筆有設計核准紀錄但完整單張來源／最終版本仍須補證。75 不等於 75 隻從未畫過，也不等於 75 隻都可直接生成。

## 本輪實際補入

完整持裝九圖：142 曜羽烈鳳、143 廢都王桶、145 界根樹王、149 煉獄殘焰、151 爵潮蛙皇、155 潮鰭海臣、156 玄竹戰熊、158 靈環仙靈、183 霜月鐮姬。逐張讀圖檢視本體、手部與武器；來源為 R 槽七 ZIP 備份的 equipped_hero，而非同角色的空手本體。Owner 本輪明確回覆「確認，9 張持裝圖都採用並整合」後才選入。[精確來源與核准 manifest](../../art/production/characters/approved-equipped-closeout-20261019/manifest.json)。

另補豆豆及雷霆戰狼五張已核准單張：237 星核豆獸（豆豆）、238 雷霆幼狼、239 雷霆貓狼、240 雷霆戰狼、241 雷霆戰狼（覺醒體）、242 雷霆霸狼。沿用既有角色美術入口，追加 ART07–ART12；不套用舊本機狼族的階段代碼草案，也不占用既有 UL40。[來源與 140 張舊圖保留快照](../../art/production/characters/approved-dex-closeout-20261019/manifest.json)。

六個新美術身分維持 `ILLUSTRATION / NOT_TRACKED`；普通 218 筆登錄、遮蔽、存檔、數值、進化與原模式角色選取不變。這十五張靜態圖不表示新的動作動畫已製作或接入。

## 工作區收尾與合併修正

完整盤點 **36 個已登錄工作樹**，其中 **16 個乾淨且 HEAD 已在遠端 main**。逐個 HEAD、分支、差異與未追蹤數量見 [原始快照](worktrees.json)、[處置 JSON](workspace-disposition.json)及[全部工作區總表](WORKSPACES_ZH_TW.md)。沒有刪除工作樹或研究素材。

另在近期 Codex 任務資料夾內查到並核對 **19 個相同專案的 clone／工作樹路徑**，含與上述清單重複的路徑，不直接相加當作55個獨立工作區。讀取其 remote、HEAD、分支及 tracked 狀態；3個帶 tracked 差異：HM02候選、狼族舊草案，以及近期任務的部分物化 reference clone。最後一項有大量檔案缺席，不能把這些 D 狀態當成授權刪除或產品變更。原狼族草案的角色圖片已沿用目前 main 的美術圖鑑架構整合，不將其舊身分／代碼／發布腳本覆回。[額外 clone 盤點](additional-clones.json)。

整合 `feat/map-polish-integration-20261019` 的 30 筆提交，包括原 R-main 五筆地圖提交的對應版本、Battle 環境圖層與效能修正、籠子遮擋／環境動態／成對邊緣、HM01 擴張與洞道的本機審核功能。各本機 gate 保留，沒有藉這次整合把待審地圖像素或危險地形改成公開預設。

實際修正四個整合問題：

1. 與 100 格獨立籠子副本合併時，生成位置必須透過 placement 找實際 definitionIndex，再選原始／review field；不能把副本識別直接當 definition index。
2. 地圖分支改到了 hash-locked `nativeRaisingGround.js`。本輪還原其原始完整位元，保留 ring／product wrapper 的有界 review 邏輯，原生 20 格合約不重新定義。舊原生 20 格繼續用原始 walkability；新 review walkability 限 ring／product 路徑。
3. esbuild 會追蹤 gate 內的字面 dynamic import，造成本機審核模組和 review JSON 被讀入公開打包。改以 source-relative URL 延後解析，仍由既有 loopback 開關控制；公開正常流程不請求這些檔案。公開模組閉包只補入其確實需要的 cave passage／review field helper，預設沒有 review 資料。
4. 正常新遊戲瀏覽器測試發現 CM02 與 generated foreground 錯把核准公開 origin 視為可載入私人 review 的位置，造成牧場載入失敗。改用既有 `isOriginalLoopbackLocation`，保留已發布 CM03／CM24 前景的公開路徑，並限制新環境裝飾／shared-edge 模組入口。新增兩個真實公開 origin「零私人請求」回歸；沒有允許測試忽略這些請求或加長等待繞過失敗。

下列工作仍有具體阻擋，保留候選並列待辦，不宣稱收尾完成：

- **HM02**：交接明記 12 個 tracked／10 個 untracked、公開選取腳本中途失敗，完整 CI/build、正常 Gate／洞口／日夜／橫直向與美術接受均未完成。27 項舊單元檢查不能代替最後接線驗收；未混入本輪。
- **Gemini 戰術／補給／暫時進化／水地形**：原 R-main 的 19 個修改保留。既有審查列出 HUD 接線、輸入正規化、庫存保存／callback、部分 BUFF 與地形物理缺口，以及 A3 對象／分支待決策。六個關鍵來源 SHA 與審查快照仍相同；本輪另跑其 16 項聚焦檢查全過，但不能推翻整合缺失。[來源未漂移證據](tactical-review-drift.json)。
- **歷史 m301／VFX／籠子與介面候選**：main 已有較新的角色 catalog、210 格 VFX 或後續修正，未把歷史 loader、私人索引與未證實殘留差異覆回。
- **values-trace**：遊玩時間與地圖完成度仍是未提交接線候選；缺本輪保存及正常瀏覽器驗收，沒有因歷史追蹤註解就公開。

## 圖片、打包與驗證範圍

十五張完整原稿保持原檔及 SHA。詳圖最大邊 768px，完整構圖、WebP Q90／Alpha100；列表 32 CSS px 使用 96px 無損縮圖以覆蓋 DPR3。PNG／原始參考、三視圖、本體／武器分離檔與私有 ART_PRODUCTION_INDEX 不加入公開產物。新圖透明度與等比例縮圖參考逐像素相同；有色像素的壓縮誤差另保存在 [詳圖數據](display-encoding-final.json)，縮圖 RGBA 逐像素一致見[縮圖數據](thumbnail-encoding-final.json)。這不是宣稱詳圖 RGB 無損。

整包接近既有 1,000,000,000-byte 上限。保留同一編譯器／版本及 `keepNames`，僅開啟 JavaScript 內部 identifier minification，避免為容量繼續降低角色圖畫質。公開 exports、function/class 名稱、來源 byte hash 與 module closure 檢查保留。容量閘門沒有放寬。

最終本機 CI **2,701／2,701** 通過；build／獨立 validate／獨立 payload check 通過，產物7,848檔、999,631,230 bytes，距容量上限尚餘368,770 bytes。不可把目前餘裕解讀為還能直接加入下一大批素材。正常瀏覽器 **90 個檢查**通過（33個普通圖鑑目標×手機／桌面、12個美術身分×手機／桌面），頁面錯誤0、缺檔／非產物請求0、登錄不變。本輪實際檢視全部15張來源單圖及15張手機顯示，九張持裝圖握持與完整構圖保留。[VALIDATION.json](VALIDATION.json)與其引用的90張成功截圖保存精確buildId及測量範圍；實體裝置不在本輪驗收範圍。

遠端 commit、GitHub CI/Pages、公開圖片讀回與 Codebase Memory 索引狀態各自核對；本文件不以本機檔案存在取代公開驗收，也不把尚有阻擋的工作區說成已完成。
