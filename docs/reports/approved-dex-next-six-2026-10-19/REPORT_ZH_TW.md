# 新核准六張圖鑑增量

承接已推 main 的 27 張修復 37468628。本次僅接入使用者明確核准的六張原圖：126 月兔 v5 雙腿修正版、169 蒼鋒機暴龍 v6、170 機冕龍 v8、173 旭煌彈龍 v2、201 裝備王鎚版本、202 杖與棺盾版本。沒有生圖，沒有研究 ROM 圖，沒有改戰鬥、動畫或養成資料。原圖與核稿資格保留。

來源、核准訊息 ID、原圖 SHA256、衍生圖尺寸與 SHA256 詳見兩份 manifest：`docs/art/production/characters/approved-equipped-201202-20261019/manifest.json`、`confirmed-dex-next-four-20261019/manifest.json`。原稿未修改；display 最大 768、WebP Q90，縮圖最大 96、RGBA 無損。透明遮罩精確等於原圖比例縮圖，完整 contain、無裁切。既有 182 張選圖位元組不變。

圖鑑由 182 增至 188 張。最初 64 個缺口累計補 33、餘 31：成熟期 11、進階體 17、究極體 3（187、188、200）；完整目前範圍見 `remaining31.json`。這些是接圖／版本定位缺口，不表示取消角色核稿。187 錨與鏈、188 羽槍完整裝備版仍需確切最終原圖；200 身體版使用範圍尚待釐清。

容量採無損包裝減重：公開 pages-build.json 改 compact JSON；已完整編入程式、沒有 runtime fetch 的 hero registry 與 character catalog 不再重複複製原始 JSON。所有來源仍先按原始 SHA256 審核，URL/fetch 指向的真實 runtime 檔案保留，公開 `assets/production/PUBLIC_RUNTIME_INDEX.json` 保留完整圖鑑資產角色與雜湊對應。沒有再壓既有或新增圖片。實際產物含 build 清單 999,966,291 bytes / 7,869 files，距 1,000,000,000 上限餘 33,709 bytes。

驗證：CI 2708 項中的 2706 首次通過；另 2 項被 sandbox junction／loopback 權限擋住，重跑對應 2 模組 17 項全過。正常 UI 新遊戲進入圖鑑，33 張 × 桌面/390px 手機＝66 組主圖與縮圖核對通過，實際 66 個圖檔回應 SHA256 一致，無 console/network error，registeredSpecies 前後皆空。6 張另逐張查看 CSS272 深淺底原稿對照及實際手機圖，無明顯方塊、振鈴、糊邊或肢體／武器裁切。這是桌面 Chrome 手機 viewport 驗證，不是實體手機驗收。詳見 VALIDATION.json 與工作目錄 output/playwright/dex-next-six-quality、dex-approved-repair。

發布順序：第一批 27 張已在 main 37468628，Pages run 39281217973 因 GitHub 官方 Actions／Pages／Webhooks 可用性事故仍 queued；公開站已回傳 37468628：實際 54 圖檔全部 HTTP200／SHA256 通過，27 張 × 桌面與手機的 54 組公開正常流程全過，無頁面與網路錯誤；146 與 185 公開手機畫面另目視確認。GitHub UI 仍 waiting。六張增量先保留本地 commit，未推送、未取消或重觸發遠端工作，避免新 workflow 自動取消官方事故中仍 waiting 的前一批；不取消或重複觸發。原 R 工作樹未修改。

新增角色動畫對照見前一報告資料夾的 ANIMATION_CURRENT_IDS.md；山豬 233 是雙足，水母 234／鯊魚 235 不可互換；ART 身份不是正式 gameplay stage。
