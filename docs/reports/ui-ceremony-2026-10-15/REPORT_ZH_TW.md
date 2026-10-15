# 晴空競技 UI／HUD 與演出層：改前／改後與驗收（2026-10-15）

> Owner 指示見 [Owner Direction 2026-10-15](../../coordination/OWNER_DIRECTION.md)；設計與動效規則見 [SPEC_ZH_TW.md](SPEC_ZH_TW.md)。
> 起點：`main` `2e706013`，中途合併 `24314275`（#23–#26 圖鑑美術）。所有變更為呈現層 `OWNER_APPROVED_ADAPTATION`。

## 1. 交付內容

| 項目 | 結果 |
|---|---|
| 視覺系統 | 「晴空競技」明亮配色成為預設主題（標題主視覺的晴空／象牙石／Logo 網路線青綠／冠軍金）；遊戲按鍵立體度；頁面標題「連結線」招牌元素；所有色值通過既有 WCAG 測試 |
| 品質樣板：育成 → 狩獵 → 獎勵／徽章 | 夥伴卡名字完整、傳送門連線、捕獲成功、收穫揭曉、徽章獲得、徽章收藏頁 |
| 擴展 | 進化揭曉（原生進化序列之後）、對戰開場 VS、對戰結算場地背景、全部系統頁套用新配色與元件 |
| 響應式 | 短橫向（844×390）：選擇狩獵場地球完整入鏡不需捲動、頁首壓縮、傳送門左右排列、夥伴卡名字不截斷 |
| 略過／減少動態／省電 | 三者皆實作並截圖驗證（§4） |
| 資源與釋放 | 演出不載入任何新檔案；離開畫面即移除節點、計時器、監聽與音效 |
| 玩法／存檔／時序 | 未變更。演出只讀已決定的狀態；Hunt frame 只多一個唯讀 `hud.onCard` 投影 |

## 2. 改前／改後（同場景、同 QA 存檔）

改前為 `main 2e706013`（當時預設深色夜景），改後為本分支（預設晴空競技）。所有圖片由實際啟動遊戲、經正常入口操作擷取（捕獲畫面需 `presentation=developer` 取得野生位置，截圖前已隱藏開發者證據欄）。

### 手機直向 390×844
- [育成首頁](compare/390x844-01-home.webp)　[夥伴卡（名字不再被截斷）](compare/390x844-10-companion.webp)
- [選擇狩獵場](compare/390x844-02-gate-globe.webp)　[狩獵設定](compare/390x844-03-loadout.webp)
- [狩獵進場：傳送門連線](compare/390x844-04-hunt-entry.webp)　[捕獲成功](compare/390x844-05-capture.webp)　[收穫揭曉](compare/390x844-06-hunt-result.webp)
- [徽章收藏](compare/390x844-07-medals.webp)　[對戰開場](compare/390x844-08-battle-opening.webp)　[對戰結算](compare/390x844-09-battle-result.webp)

### 手機橫向 844×390
- [選擇狩獵場（地球完整入鏡）](compare/844x390-01-gate-globe.webp)　[傳送門連線](compare/844x390-02-hunt-entry.webp)　[捕獲成功](compare/844x390-03-capture.webp)
- [夥伴卡](compare/844x390-04-companion.webp)　[狩獵結算](compare/844x390-05-hunt-result.webp)

### 桌機 1366×768
- [育成首頁](compare/1366x768-01-home.webp)　[選擇狩獵場](compare/1366x768-02-gate.webp)　[捕獲成功](compare/1366x768-03-capture.webp)
- [狩獵結算](compare/1366x768-04-hunt-result.webp)　[對戰開場](compare/1366x768-05-battle-opening.webp)　[商店](compare/1366x768-06-shop.webp)

### 演出圖集（改後）
- [徽章獲得：起承轉合時間軸](ceremonies/medal-timeline-390x844.webp)
- [傳送門／捕獲／進化／對戰開場](ceremonies/gate-capture-evolve-versus-390x844.webp)
- [橫向](ceremonies/landscape-844x390.webp)　[桌機](ceremonies/desktop-1366x768.webp)
- [減少動態、省電與略過](ceremonies/reduced-saver-skip-390x844.webp)

徽章與進化在正常遊玩中需要贏得未取得的頭銜賽或自然進化，本機無法在合理時間內穩定到達，因此以 `tests/fixtures/championship-ceremony-review.html`（正式模組與樣式表、標示清楚的合成資料、不寫存檔）呈現；兩者的觸發時機另以單元測試對真實 view 驗證（§3）。

## 3. 測試結果

| 檢查 | 結果 |
|---|---|
| `npm run test:ci` | 合併 main 後 **2197／2197 通過**（新增 `tests/championship-ceremony-cases.mjs` 12 項） |
| 新增測試涵蓋 | 每種演出結束即移除節點與監聽；點擊／Esc 略過；toast 不攔截場景輸入；背景分頁即落定；減少動態與省電長度；建構失敗不顯示；收穫揭曉吞掉略過那次點擊；合成音效無檔案；樣式表無無限動畫、只動 transform/opacity、停止規則特異度高於所有部件規則；進化揭曉在原生序列與換日之後才播且只播一次、離開即釋放；對戰畫面維持只匯入顯示文字 |
| 調整的既有測試 | 預設主題 `night`→`arena`（設定測試 6 處、加入 arena 對比檢查）；Hunt HUD 白名單加入唯讀 `onCard`；對戰導覽測試 vm 情境補 `battleCeremonies:null` |
| `build:playtest`／`validate:playtest` | 通過（新模組與樣式表登錄於 `WEB_BUILD_INPUTS`，刷新本批變更檔的核准雜湊；`build-module-preload` 重新產生，`--check` 通過） |
| 實際遊戲流程（自動化瀏覽器） | 390×844、844×390、1366×768 各走：登入→繼續→育成→選單→狩獵→選場→裝備→進場→捕獲→結算→返回→選單→徽章收藏；對戰：選擇→參賽→載入→開場→自動對戰→結算各頁；Home 選取夥伴、詳細、拿起道具、選單。全程無頁面錯誤 |
| 系統頁巡檢（三種尺寸） | 馴獸師、賽程、設施配置、夥伴名單、說明、圖鑑、商店、對戰選擇、徽章收藏、選擇狩獵場：**無橫向捲動、無小於 44×44 的可按元素** |
| 既有瀏覽器回歸 18 支 | 與 `main` 逐支對照：通過集合相同（hunt-loading、full-qa-save、desktop-browse、responsive-battle 通過）；其餘 14 支在 `main` 與本分支**失敗於完全相同的檔案:行:欄**（`networkidle` 逾時、本機缺內部參考素材 404、需 18743 dist 伺服器、測試假設過時如 evolution-glyph 搜尋的函式已在 main 被切到 lazy chunk）。非本批造成，列於 §6 |
| 演出期間幀時間 | 受控無頭 Chromium＋SwiftShader，390×844 與 1366×768、平衡與省電：每種演出 2.6 秒內 p50／p95 皆 16.7ms，**無 >50ms 長幀**（[原始數據](perf-ceremony-frames.json)）。這是相對比較，不是實機數據 |
| 進場時間 | 傳送門最短顯示 0.9s，場地就緒時間不受影響（就緒早於 0.9s 時最多延後 0.9s 揭幕；減少動態時就緒即揭幕） |

## 4. 略過、減少動態、省電、釋放

- **略過**：moment／reveal 第一次點擊立即落定為完整構圖（截圖：開始 100ms 後點擊），第二次點擊或 Esc 關閉；toast 從不攔截輸入。
- **減少動態**：無位移／縮放／旋轉／粒子，只有 160ms 淡入淡出、不播音效；收穫揭曉直接呈現最終畫面。
- **省電**（設定 → 畫面品質 → 省電）：不畫碎光、光芒與額外光環，演出縮短。
- **釋放**：狩獵場、結算、對戰、育成離開時 `dispose()` 演出；分頁切到背景即落定結束。

## 5. 素材來源與授權

本批未新增點陣圖、模型、字型或外部音檔。光效為 CSS／內嵌 SVG 手寫，音效為 Web Audio 即時合成（專案原創）；徽章、頭像、記憶卡框沿用既有核准素材與其紀錄。沒有使用 Blender 或新的 Three.js 場景：在現有素材下以 CSS 合成即可達成，且不增加下載量。角色主圖與畫風校準未改動（dot 負責）。

## 6. 工具無法驗證／剩餘事項

1. **實機**：未在 iPhone／Android 實機、Safari、低階機上測試；觸感、實際幀率、音量平衡、瀏覽器自動播放政策下的首次音效需 Owner 試玩確認。截圖中的中文字型是容器內的文泉驛正黑，實機會是 PingFang／Noto，字寬略有差異。
2. **自然流程的徽章與進化**：在遊戲中真正贏得新頭銜、自然進化時的演出，只以 fixture 與真實 view 單元測試驗證，未在完整遊玩中觸發。
3. **場景美術**：牧場、狩獵地圖、對戰場地、角色與原生進化序列的美術未改動（受既有 Owner 授權與 dot 負責範圍限制）；「同一套美術語言」本批只落在 UI／HUD 與演出層。
4. **既有瀏覽器測試在本容器失敗**（main 同樣失敗）：ui-integration、vs2、vs3、settings、responsive-layout、responsive-followup、desktop-raising、int-rh2、capture-raising-recovery、owned-battle（`.cm-vs5-field__loading` 計數假設已過時）、gate-world-layout、recent-integration、hunt-tool-normal、evolution-glyph。建議另開工作批次修正這些測試或環境前提。
5. **已保存的主題**：明確選過其他主題的玩家維持原選擇；若 Owner 裝置曾手動選「深色夜景」，請到 設定 → 外觀 → 晴空競技。
6. 桌機 1366×768 的系統頁仍為置中欄寬；牧場維持 Owner 核准的固定參考縮放，未放大像素。
7. **公開產物的狩獵場美術**：以建置後 `dist/github-playtest` 煙霧測試時，戴納草原（`field_hm01_01`）的場地圖檔不在公開核准清單，畫面顯示為場地剪影；`main` 的公開產物同樣缺少此檔，屬既有發布選擇，本批未變更。演出、捕獲、結算、徽章收藏在建置產物中均正常運作。
