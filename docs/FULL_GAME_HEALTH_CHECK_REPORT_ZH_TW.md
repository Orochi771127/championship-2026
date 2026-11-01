# 《網線拍檔：錦標賽》全遊戲 UI/UX 與連線健檢報告

日期：2026-11-01（自我審查與發佈 2026-11-02）　分支：`feat/full-viewport-health-check-20261101`（起點 `82fa48e2`，當時的 main；發佈前已合併 main `b692ad5b`）

> 狀態：2026-11-02 Owner 指示「請你自我審查一次，沒問題就請你commit跟push並整合至main後發佈建置」。自我審查的發現與修正見第 5.1 節；修正後在合併 main 的版本上重跑完整健檢。
> 修改前的數據來自 main 起點 `82fa48e2` 的乾淨工作樹（`health-check-baseline-20261101`，埠 8822）；修改後來自本工作樹（埠 8821）。兩邊用同一支腳本、同一份 QA 存檔、同樣的 GPU 繪製設定。

## 1. 結論

| 項目 | 修改前（main） | 修改後（本批） |
|---|---:|---:|
| 檢查的畫面狀態（6 視口合計） | 536 | 554 |
| G1 重疊 | 77 | 0 |
| G2 裁切 | 122 | 0 |
| G3 橫向適配 | 1 | 0 |
| G4 連線 | 50 | 0 |
| G5 溢出／觸控 | 696 | 1 |
| **合計** | **946** | **1** |

| 切片 | 修改前 | 修改後 |
|---|---:|---:|
| S1 牧場中樞 | 374 | 1 |
| S2 商店／轉蛋 | 95 | 0 |
| S3 圖鑑 | 228 | 0 |
| S4 狩獵／對戰／Data Arena | 145 | 0 |
| S5 故事／執照／社群 | 104 | 0 |

修改後的 1 項是開場序章的「⏭ 跳過序章」伸進右側瀏海（844×390）：序章不在簡報點名的範圍，依規則維持 main 原樣、只回報（第 6 節）。修改後的數字來自合併 main `b692ad5b` 後的完整重跑（2026-11-02）。

修改後畫面狀態較多，是因為修改前有些畫面到不了（例如 844×390 的隊伍編成點不到成員，之後的對戰、結算都無法檢查）。

修掉的重點（每一項都是腳本量到、再用同一支腳本確認消失）：

1. **667×375 小手機橫拿不再縮成直向小框。** 選單、商店、圖鑑、設施配置與 3D 狩獵場在 640–719px 寬的橫向畫面原本落回「直向框整體縮放」（約 44–54%），按鍵只剩 24–31px 高。門檻由 720 降為 640px 後，這些畫面改用既有的橫向版型（側欄停靠、雙欄）。
2. **844×390 對戰隊伍編成的死路。** 名單被橫向雙欄版型壓成 166px 高卻不能捲，內容溢到底部按鈕列下方；一捲動，「返回賽事選擇／決定」整列被帶到畫面中間蓋住名單，成員點不到。修改前在這個畫面無法完成編隊。
3. **牧場夥伴資訊卡**：桌機上壓在「探索手帳」（逛街手札）鍵上、橫向手機超出畫面、出現瞬間被同一次觸控誤點開詳情、667×375 開卡後舞台只剩 50–54%、桌機上七字長名把種族標籤擠成「黑…」；改為手帳下方起算、矮橫向放在左欄並收斂工具列寬度、展開量表時暫收地點列、擋掉觸控留下的誤點、種族標籤不再被壓縮。
4. **轉蛋 10 連抽在 844×390 時【確定收下】與後排卡片都在畫面外、在 667×375 時按鍵縮到 24px 高**；矮橫向改成 10 張一列，確定鍵常駐可見（375 寬直向的 5×2 本來就能完整顯示，已確認）。合成爐（5 合 1）與晶片背包在矮橫向改為左右兩欄，背包最後一列不再被底部返回鍵蓋住。
5. **圖鑑詳情在 844×390 只剩 190px 高的一條**，動作鍵（轉向／待機／散步／攻擊／歡呼）落在畫面外；改為左側立繪＋動作、右側資料捲動的雙欄。
6. **對戰選單**：375×667 第一場賽事被返回鍵蓋住；矮橫向標題區佔 184px、方塊掉到畫面外；獎金標籤蓋住報名費。
7. **Data Arena**：橫向時「陣營共鳴」標籤壓在換角鍵上且伸進瀏海；667×375 暫停面板的「離開競技場」在面板外。
8. **故事模式**：選單「故事章節」在牧場畫面尚未就緒時**點了沒有任何反應**（靜默失效）；現在會等待最多 4 秒，仍不行就顯示提示。對話控制鍵 32→40px、紀錄面板開啟時下方台詞不再透出、星圖節點觸控區維持 40px。
9. **好友頁**：375 寬時「＋ 新增好友」被擠成一字一行的 34px 窄柱、輸入框被撐到 116px 高（桌機也折成三行）；「複製」「設定我的防守隊伍」「婉拒」與「我的馴獸師代碼」是近白字壓在米白底上（對比約 1.1:1），幾乎看不見。
10. **必殺展演與切入條**：展演沙盒的框頂被狀態列膠囊壓住（375×667、844×390、667×375），改為從狀態列下方開始；必殺切入條在六個視口（含 1920×1080 與 844×390）量測角度（−8°）與臉部裁切（頭部 100% 在臉框內、臉框 100% 在畫面內）。
11. **觸控尺寸**：主牧場 8 鍵工具列、快捷鍵、篩選鍵、相剋表按鈕、展演切換鍵、設施配置角落鍵等，全部 ≥ 40px。

沒有修改、只回報的項目見第 6 節（《未被聽見的回聲》分支屬於另一個未提交的工作階段；紙娃娃編輯器在任何分支都不存在）。

## 2. 健檢工具

```bash
node scripts/qa/run-full-viewport-health-check.cjs --gpu --origin http://127.0.0.1:8821 --story-origin http://127.0.0.1:8812
```

- `scripts/qa/run-full-viewport-health-check.cjs`：主程式。每個視口×切片開一個全新的瀏覽器環境，**只透過遊戲自己的按鈕**走完流程；拒絕 8732（Owner 的存檔），預設用 8761。參數：`--slices 1,2`、`--viewports portrait-pro,landscape-pro`、`--out`、`--evidence`（存對照用 PNG）、`--story-origin`、`--gpu`。全部通過才回傳 0。
- `scripts/qa/viewport-health-rules.cjs`：五道關卡的判定規則（純函式，有單元測試 `tests/championship-viewport-health-rules-cases.mjs`，已列入 `test:ci`）。
- `scripts/qa/viewport-health-probe.cjs`：在頁面內量測（矩形、裁切祖先、命中測試、行數、安全區、捲動清單末端、計時器數量）。
- `scripts/qa/viewport-health-slices.cjs`：五個垂直切片的操作流程。
- `scripts/qa/title-zero-diff.cjs`：標題／主選單／開場的計算樣式零差異比對。

六個視口：1920×1080、1366×768、390×844（iPhone Pro 直向，模擬瀏海 47px／Home 條 34px）、375×667、844×390（iPhone Pro 橫向，左右瀏海 47px／Home 條 21px）、667×375。安全區用 CDP `Emulation.setSafeAreaInsetsOverride` 模擬真實 `env(safe-area-inset-*)`。

五道關卡：

| 關卡 | 量什麼 |
|---|---|
| G1 重疊 | 可互動元件彼此相交（>2px 且 >9px²）、HUD 群組相交、文字壓文字、點擊被別的元素攔截（3 個取樣點） |
| G2 裁切 | 被 `overflow:hidden` 祖先切掉 >10%、徽章露出 <95%、超出畫面、2–4 字按鍵被擠成兩行、短標籤被省略號截斷、捲動清單捲到底後最後一項仍被固定底欄蓋住 |
| G3 橫向適配 | 矮橫向（≤520px 高）主舞台可視面積 ≥55%；工作區（六角格棋盤、對話框）的最小／最大比例；展演與相剋表置中且完整 |
| G4 連線 | 每個入口從主畫面用實體按鈕到得了；每個子畫面有可見的返回／關閉；關閉後沒有殘留遮罩、dialog、錯誤的返回畫面或多出來的 `setInterval` |
| G5 溢出／觸控 | `scrollWidth ≤ innerWidth`；主要按鈕寬高皆 ≥40px；按鍵不得伸進瀏海／Home 條安全區 |

### 判準說明（為了不誤報而做的決定）

- **短暫提示不算重疊**：toast（`.cm-arcade-toast` 等）與 Data Arena 開場「開打！」橫幅約 1 秒就消失，比照 toast 不列入文字重疊。
- **牧場角色素材下載提示**屬於暫時性通知列，不計入主舞台面積；但它本身仍檢查重疊與按鍵大小（並修正了它被錢包蓋住的問題）。
- **安全區容忍 6px**：iPhone 圓角讓 `env()` 邊界附近幾個像素本來就可視，貼邊 ≤6px 不判定侵入。
- **繩索切換「⇄」**是繩索鍵角落的徽章，設計上用隱形 `::before` 把熱區撐大；改以命中測試量實際可點範圍（≥40×40 才算過），不以徽章外框判定。
- **2–4 字標籤換行**只算「同一段文字被折行」；刻意上下排的雙層按鍵（例如「換角／後備」）不算。
- **可捲動的面板**（例如矮橫向的系統選單）裡的各區塊，先捲到該區塊中央再檢查——能捲到就算到得了，但必須真的捲得到；三個雲端登入鍵是一組選項，以中間那顆置中，要求三顆同時完整可見。
- **狩獵場網址參數**：在本機 QA 環境用 `?huntReview=hm01x2-20261019` 讓 3D 狩獵地圖與正式站相同（這只是美術選擇，正式站預設就是這組地圖）；進入狩獵仍是點「狩獵」鍵，不是靠網址繞進去。
- **`--gpu`**：無頭 Chromium 預設用 CPU（SwiftShader）畫 WebGL，1920×1080 的 3D 牧場每格畫面太慢，Playwright 等不到「連續兩格位置穩定」就判定點不到，造成假的「無法點擊」。修改前、修改後兩輪都用顯示卡（RTX 4070 Ti，D3D11）繪製。

## 3. 各切片的問題與修法

### S1 主牧場中樞、夥伴資訊卡、逛街手札與設施配置

| 問題 | 視口 | 修法 | 檔案 |
|---|---|---|---|
| 創角執照、八蛋孵化器、蛋命名在矮橫向超出畫面，確認鍵在畫面下方 | 844、667 | 矮橫向改左右兩欄（執照：資料｜通行證章＋確認；孵化器：四蛋兩列；命名：孵化艙｜名字＋按鍵） | `onboarding.css` |
| 8 鍵工具列在直向手機按鍵偏窄、「蛋白質」折成兩行（844 時還撞到庫存數字） | 390、375、844 | 間距 3px、側邊 4px、說明文字不折行 | `ui/arcade.css` |
| 橫向工具列被瀏海壓窄，說明文字撞到庫存徽章；快捷鍵 34px 高 | 844、667 | 圖示在上、單行說明在下；快捷鍵 80×40px | `ui/arcade.css` |
| 夥伴資訊卡壓在「探索手帳」（逛街手札）鍵上 | 1920、1366 | 卡片從手帳鍵下方起算（手帳發布 `--cm-journal-clear`） | `ui/screenLayout.css`、`ranchDiscoveryJournal.js` |
| 矮橫向夥伴卡超出畫面、蓋住提示；‹ › 與關閉鍵 36–38px | 844、667、桌機 | 矮橫向放左欄（寬 ≤38vw、讓舞台 ≥55%）、提示讓位、數值兩兩一列；鍵改 40px | `ui/screenLayout.css` |
| 667×375 開著夥伴卡時舞台可視只剩 54%（展開量表 50%） | 667 | 矮橫向 ≤700px 寬時 8 鍵工具列改為置中 488px（每鍵 56px、保留文字）；展開量表時暫時收起地點／心情列；兩欄量表的數字改 10px，「5200 / 5200」不再被截 | `ui/screenLayout.css` |
| 桌機夥伴卡遇到七字長名（黑暗戰鬥暴龍獸）時名字折兩行、種族標籤被壓成「黑…」 | 1920、1366 | 名字列可換行、種族標籤不縮，放不下就換到名字下方 | `ui/screenLayout.css` |
| 點牧場上的夥伴時，剛出現的資訊卡吃到同一次觸控留下的 click，直接開了詳情 | 844 | 卡片出現後 350ms 內，攔下「卡片本身沒有被按下」的那一次真實 click | `raisingHomeP1RView.js` |
| 角色素材下載提示滑到季節膠囊下、重試鍵被錢包蓋住（素材串流較慢的早期回合量到；最終兩輪用 GPU，素材很快就緒、提示未停留，所以不在第 8 節） | 全部 | 改到狀態列下方的通知列（手機與直向平板全寬、矮橫向在右欄手帳鍵下、桌機版牧場置中並讓出兩側卡片） | `ui/screenLayout.css` |
| 矮橫向的牧場選單只剩約 100px 高 | 844、667 | 選單站在一列工具列上、快捷鍵左側，四欄排列 | `ui/screenLayout.css` |
| 對話框按鍵捲出畫面：探索手帳「繼續散步」（844、667）、炫耀名片「完成」（1366、667）、好友抽屜「關閉」（375、844、667） | 844、667、1366、375 | 遊戲內的對話框按鍵列黏在面板底邊（不改原本間距，底色用面板本身的純色；教學導覽的夜色面板不加底）、矮橫向對話框加寬；標題畫面的對話框維持原樣 | `ui/screenLayout.css` |
| 夥伴詳情底部「收合」鍵折行 | 667 | 不折行、不縮 | `intRh2Styles.css` |
| 設施配置：選取面板蓋住「全覽／還原」；篩選鍵 36px；側邊瀏海；矮橫向棋盤不到一半 | 375、844、667 | 選取面板讓出角落鍵；篩選 40px；標頭與內容留安全區；側欄 `clamp(220px,34vw,300px)`、角落鍵改直排 | `ui/screenLayout.css` |
| 667×375 的選單、商店、圖鑑、設施配置落回直向縮放框（約 54%） | 667 | 橫向門檻 720→640px | `portraitFrame.js` |

### S2 商店、數碼轉蛋機、5 合 1 合成爐與晶片背包

| 問題（修改前量到） | 視口 | 修法 | 檔案 |
|---|---|---|---|
| 商店 4 個分頁、「返回牧場」、轉蛋模式鍵只剩 22–24px 高（直向框整體縮放） | 667 | 橫向門檻 640px，改用橫向商店版型；橫向分頁右側預留數量徽章位 | `portraitFrame.js`、`cyberGacha.css` |
| 商品詳情的「關閉／購買」在 375×667 被底部返回鍵蓋住、在 844×390 捲到卡片外；667 時「購買」折成兩行 | 375、844、667 | 手機版面板止於底欄上方、按鍵黏在卡片底邊、矮手機圖片縮為 140px | `ui/screenLayout.css` |
| 轉蛋機的「單抽 ×1／十連狂轉 ×10」在畫面外 | 844 | 矮橫向隱藏標題列、錢包與模式同列、機台｜抽獎鍵左右排、抽獎鍵 44px | `cyberGacha.css` |
| 單抽與 10 連抽結果的「確定收下」與後排卡片在畫面外；667 時按鍵 95×24px | 844、667 | 矮橫向 10 張一列（內寬 780px）、單抽卡 132px、按鍵列常駐 | `cyberGacha.css` |
| 合成爐「開始熔煉合成」在畫面外；「自動填入低階晶片」在 375 寬被截成省略號 | 844、375 | 矮橫向左欄：說明＋5 格＋按鍵、右欄：晶片背包（可捲動）；窄螢幕縮小鍵內距與字級 | `cyberGacha.css` |
| 模式鍵「晶片背包」在 375 寬被截成省略號 | 375 | 窄螢幕（≤380px）縮小模式鍵內距與字級 | `cyberGacha.css` |
| 離開商店回到牧場時工具列「蛋白質」「管理」「商店」折行、「蛋白質」撞到庫存數字 | 390、375、844、667 | 同 S1 的工具列修正 | `ui/arcade.css` |

### S3 圖鑑、實機動作、必殺／進化展演與雙五角環相剋表

| 問題 | 視口 | 修法 | 檔案 |
|---|---|---|---|
| 圖鑑詳情在矮橫向只剩 190px 高，動作鍵在畫面外 | 844、667 | 狀態列到底欄的全高面板（以畫面外殼為定位參考，減少動態時位置相同；開啟時隱藏被蓋住的標題列）；左欄立繪／動作檢視＋動作鍵（不隨內容捲動），右欄資料捲動；左欄寬為「視口寬扣除安全區 × 36%」（244–300px），右欄與立繪相隔 15px，667 寬時四個動作鍵仍各 ≥40px | `ui/screenLayout.css` |
| 雙五角環相剋表在 667×375 的「土」節點被切掉 87%、「關閉」在畫面外；展演沙盒的 ✕ 只有 24×24px | 667 | 橫向門檻 640px；相剋表高度扣除安全區，窄螢幕與矮橫向重算環的尺寸 | `ui/taxonomy.css`、`portraitFrame.js` |
| 【❓ 屬性相剋表】、展演切換鍵、【進化預覽】、【條件】鍵 <40px | 全部 | 改 40px | `ui/taxonomy.css`、`ui/juicyShowcase.css`、`ui/screenLayout.css` |
| 必殺／進化展演框的頂端被狀態列膠囊壓住 | 375、844、667 | 狀態列顯示時，展演層的上內距取狀態列高度 +6px | `ui/juicyShowcase.css` |

必殺／進化展演沙盒與相剋表的層級（z-index）、關閉後回到詳情原本的捲動位置、桌機與橫向置中且完整可見，修改前後都通過檢查。

### S4 3D 狩獵場、AI 自動對戰與 Data Arena

| 問題 | 視口 | 修法 | 檔案 |
|---|---|---|---|
| 667×375 狩獵場落回直向縮放框：工具鍵 28×31px、返回鍵 53×24px、兩側大片留白 | 667 | 狩獵橫向版型門檻跟著改為 640px，工具改在右側停靠 | `huntLayoutResolver.js` |
| 844×390 隊伍編成名單溢到底欄下、底欄被捲到畫面中間、成員點不到 | 844 | 橫向雙欄的名單保留內容高度（`min-height: auto`），整頁捲動、底欄黏在底部 | `vs2Styles.css` |
| 375×667 對戰選單：方塊把第一場賽事擠到返回鍵下面 | 375 | 矮直向手機方塊縮為 168px 寬 | `ui/screenLayout.css` |
| 矮橫向對戰選單：標題區 184px、方塊在畫面外、667 寬時模式鍵折成兩行 | 844、667 | 標題與 Data Arena 橫幅同一列；方塊縮小；640px 起就用雙欄 | `ui/screenLayout.css`、`vs5Styles.css` |
| 賽事卡的獎金標籤蓋住報名費 | 390、375（667 改為雙欄後同樣會發生） | 窄卡片時報名費與獎金各一行 | `ui/arcade.css` |
| Data Arena 橫向：「陣營共鳴」壓在換角鍵上、伸進瀏海 | 667（844 修改前因隊伍編成死路到不了，修改過程中量到同樣問題） | 矮橫向移到左上量表下方，左邊距取安全區 | `ui/taxonomy.css` |
| 667×375 暫停面板的「離開競技場」在面板外 | 667 | 矮橫向：繼續鍵整列，其餘兩兩一列 | `dataArena.css` |
| 結算頁「📸 生成炫耀名片」與下方「下一頁／返回牧場」鍵重疊 | 1920、1366 | 名片鍵下方留 16px | `ui/social.css` |
| 選場畫面「場地列表」在 667 寬被擠成 4 行並壓到說明文字 | 667 | 橫向門檻 640px，選場改用橫向版型 | `portraitFrame.js` |

搖桿在左下、扇形技能輪在右下、HP 條、陣營共鳴、Home 條誤觸區與立繪重疊，在六個視口都已檢查。自動對戰在 60 秒內不一定放出必殺，所以必殺切入條改在圖鑑【預覽必殺技】量測（同一個 `skillCutIn` 元件，見第 5 節表格）。

### S5 故事模式、馴獸師執照、炫耀名片、雲端通行證與社群連結塢

| 問題 | 視口 | 修法 | 檔案 |
|---|---|---|---|
| 選單「故事章節」在牧場尚未就緒時點了毫無反應（靜默失效） | 全部 | 等待牧場就緒最多 4 秒；仍無法開啟就顯示「暫時無法開啟」提示 | `main.js` |
| 對話控制鍵（紀錄／自動／略過）32px | 全部 | 40px | `ui/storyTheater.css` |
| 觀測紀錄開啟時，下面的台詞透出來疊字 | 全部 | 紀錄開啟時隱藏當前台詞、名牌與▼ | `ui/storyTheater.css` |
| 星圖幕間節點 36px（矮橫向所有節點縮到 34px、幕間 28px）；關閉鍵 36px | 全部；844、667 | 觸控區 40px、畫出來的星球維持原大小；關閉 40px | `ui/storyTheater.css` |
| 好友頁「＋ 新增好友」在 375 寬被擠成一字一行（桌機折三行） | 375、桌機 | 輸入框可縮、按鍵不折行 | `ui/online.css` |
| 好友抽屜的次要鍵（複製、設定我的防守隊伍、婉拒）與說明字近白字壓米白底，約 1.1:1（目測發現；五道關卡不量顏色對比） | 全部 | 抽屜內改用主題的表面色與墨色（`--c-surface-1`、`--c-text-1`、`--c-text-3`） | `ui/online.css` |

對話框高度：直向 ≤40%、矮橫向 ≤45%、桌機 ≤35% 的畫面高度（遠低於 ⅔ 的上限），在六個視口都通過。

## 4. 連線（Wiring）：從主畫面用按鈕到每個系統

| 系統 | 路徑（全部是實體按鈕） | 返回／關閉 |
|---|---|---|
| 夥伴資訊卡／詳情 | 點牧場上的夥伴 → 卡片 ‹ › 切換 → 點卡片開詳情 | 詳情「收合」、卡片 ✕ |
| 逛街手札（探索手帳） | 右上「探索手帳」鍵 | 「繼續散步」／「收下發現」 |
| 設施配置 | 管理 → 設施配置 | 「返回牧場」／「確認配置」 |
| 商店（4 分頁）、轉蛋機、合成爐、晶片背包 | 快捷鍵「商店」→ 分頁 | 「返回牧場」、各面板關閉 |
| 圖鑑、詳情、動作、展演、相剋表、進化條件 | 快捷鍵「圖鑑」→ 卡片 → 動作鍵／【預覽必殺技】／【進化預覽】／【❓ 屬性相剋表】／【條件】 | 詳情「關閉」、展演 ✕、相剋表「關閉」 |
| 3D 狩獵 | 快捷鍵「狩獵」→ 地球儀選場 → 前往狩獵設定 → 開始狩獵 | 「返回牧場」（選場、狩獵場）、「返回選場」（整備） |
| 自動對戰（自由／通訊／密碼大廳／編隊／對戰／結算／炫耀名片） | 快捷鍵「對戰」→ 方塊或模式鍵 | 「返回牧場」、「返回賽事選擇」、結算最後一頁「返回牧場」 |
| Data Arena | 對戰 → 「數據競技場」橫幅 → 接力對戰 → 出戰 | 暫停 → 離開競技場 → 返回 |
| 故事章節 | 選單 → 故事章節 → 開始觀測 | 略過劇情、星圖「返回牧場」 |
| 馴獸師執照、炫耀名片 | 管理 → 馴獸師 → 生成炫耀名片 | 名片「完成」、「返回牧場」 |
| 好友與名片、帳號與雲端、社群連結塢 | 選單 → 好友與名片／帳號與雲端；選單內的社群鍵 | 「關閉」 |

每次關閉都檢查：沒有殘留遮罩或 dialog、回到正確畫面、`setInterval` 數量沒有增加。

## 5. 驗證

| 項目 | 結果 |
|---|---|
| 六視口健檢（修改前 main，埠 8822） | 536 個畫面狀態、946 項問題 |
| 六視口健檢（本批，合併 main `b692ad5b` 後，埠 8821） | 554 個畫面狀態、**1 項**（開場序章跳過鍵伸進瀏海，只回報，第 6 節）；另一分支《回聲》的 9 類只回報 |
| `npm run test:ci`（合併 main 後） | **3,267 / 3,267 通過**（本批新增 19 項規則單元測試，main 的 #138 另加 11 項）。桌機 Node 24 以模擬 CI Node 22 的 `navigator.locks` 關閉方式執行 |
| `tests/championship-viewport-health-rules-cases.mjs` | 19 / 19 通過 |
| `npm run build:playtest`、`validate:playtest` | 通過：7,821 個檔案；同一提交在本機與 CI 建出相同的 buildId（證明產物逐位元組一致） |
| 牧場提示瀏覽器閘門 `championship-raising-hints-browser.mjs`（合併後，對 8821） | 通過：120 個幾何狀態、6 個計時案例 |
| 圖鑑立繪瀏覽器閘門 `championship-dex-portrait-browser.cjs`（對本機公開產物，含 844×320） | 擷取全部通過（237 張；這支閘門的「視覺審查待辦」是固定狀態） |
| 標題零差異 `scripts/qa/title-zero-diff.cjs`（main `b692ad5b` 對本批；1366×768、390×844、844×390，手機套用瀏海與 Home 條安全區） | 標題、主選單、開場序章、信件 **0 差異**；簡報點名的開場表單（執照、八蛋、蛋命名）在桌機與直向 0 差異，只在 844×390 有差異——那是本批的矮橫向雙欄 |
| `championship-data-arena-browser.cjs` | 在 main 與本批都於同一個存檔斷言失敗（既有紅燈，與本批無關） |
| `championship-responsive-layout-browser.cjs` | 在 main 與本批都於同一個斷言失敗（既有紅燈，與本批無關） |

重跑說明：修改前的數字是 main `82fa48e2` 的三次執行合併（完整一輪、S1／3／5 用最終版腳本重跑、S5 兩個橫向視口重跑），同一視口與切片以最後一次為準。修改後的數字是 2026-11-02 合併 main `b692ad5b`、完成自我審查修正後的一次完整重跑；圖鑑欄距的修正是在那輪途中做的，所以兩個橫向視口的 S3 再單獨跑一次（30 個畫面、0 項）並取代該格。

標題零差異比對排除了兩種本來就每次不同的東西：標題遊行角色（每次隨機出場）與 `blob:` 圖片網址；開場故事的逐字打字透明度依時間而變，也不列入。

### 5.1 自我審查（2026-11-02）

發佈前重新逐檔審查全部差異，找到並處理下列問題（第 1 節的數字是處理後、合併 main `b692ad5b` 後重跑的結果）：

| 發現 | 影響 | 處理 |
|---|---|---|
| 開場序章「⏭ 跳過序章」的瀏海內距改動 | 序章屬於開場，簡報點名的是創角、選蛋、取名，序章沒有點名 | 還原為 main 原樣，改列第 6 節只回報 |
| 標題零差異比對沒有模擬瀏海 | 只讀 `env(safe-area-inset-*)` 的規則在平面螢幕上看不出差異，序章那條就是這樣漏掉的 | 直向與橫向套用與健檢相同的安全區，信件也列入保護 |
| `playStoryChapter` 在新加的「等待牧場就緒」期間可被呼叫兩次 | 兩個章節會同時播放（目前只有星圖會呼叫，且星圖有忙碌旗標，屬防禦性修正） | 等待結束後再檢查一次是否已有章節在播 |
| 角色素材提示條的寬度公式 `100% − 2×卡片 − 48px` | 只適合桌機版牧場；601–1023px 寬的直向平板（不在六個視口內）會被壓到 120–170px | 預設全寬；只有桌機版牧場（非矮橫向）才置中縮窄。實測 820×1180 為 804px、1366×768 置中 440px、844×390 在右欄 320px |
| 對話框按鍵列 `background: inherit` | 獎勵、炫耀名片面板的放射光暈與教學導覽的夜色漸層，會在按鍵列的框內重畫一次而形成色帶 | 改用面板本身的純色 `--c-surface-1`，教學導覽不加底；整組規則只在遊戲內生效（`:where()` 保留原本的選擇器權重，炫耀名片等變體的寬度不受影響），標題畫面的對話框維持原樣。實測各變體按鍵列底色與面板相同 |
| 圖鑑矮橫向雙欄的欄寬 `clamp(244px, 36%, 300px)` | 立繪（絕對定位）與右欄內距用不同的框解析 36%，740–844px 寬時右欄離立繪只有 0.7px，看起來貼在一起 | 改為「視口寬扣除左右安全區 × 36%」的長度，右欄從立繪右側隔一個間距開始：667、740、844（含瀏海）都是 15px |
| 好友表單同一條規則宣告兩次 | 無功能影響 | 合併為一條 |

### 必殺切入條（圖鑑【預覽必殺技】，定格在 300ms 停穩的那一格）

| 視口 | 帶狀條角度 | 頭部在臉框內 | 頭部在遮罩清晰區（22–78%）內 | 臉框在畫面內 | 臉框外框 x、y、寬、高 |
|---|---:|---:|---:|---:|---|
| 1920 | -8° | 100% | 100% | 100% | 737、419、204、142 |
| 1366 | -8° | 100% | 100% | 100% | 460、263、204、142 |
| 390 | -8° | 100% | 90% | 100% | 16、313、165、137 |
| 375 | -8° | 100% | 90% | 100% | 16、223、158、126 |
| 844 | -8° | 100% | 100% | 100% | 201、167、198、102 |
| 667 | -8° | 100% | 100% | 100% | 113、166、198、102 |

直向 390／375 的「清晰區 90%」是頭部外圍 12% 的安全邊（`SKILL_CUT_IN_FACE_FIT.margin`，讓角與下巴不被切）落進臉框兩側的漸層；頭部本身在清晰區內。帶狀條角度在六個視口都是設計值 −8°，臉框全部在畫面內。

## 6. 沒有修改、只回報的項目

1. **《未被聽見的回聲》（Data Area 故事）**：位於 `feat/story-unheard-echoes-20261029`，另一個工作階段還有未提交的修改，所以只用唯讀方式在 8812 掃描、不改它的檔案。掃到的問題（明細見第 8 節最後一表）：
   - 對話時沒有「略過」鍵（`[data-da-action="skip"]` 不存在），六個視口都一樣——違反「每個子畫面要有略過／返回」。
   - 章節頁的「潛入 Data Area」在 390×844、375×667、844×390、667×375 都在畫面外（要捲動才看得到，且沒有捲動提示）。
   - 844×390 時章節分頁（章節、調查筆記）、「返回」、「自動」等鍵伸進左右瀏海安全區。
   - 1366×768 時「拍檔的小日常」標籤壓在獎勵文字「艾瑪金屬碎片 ×2」上。
   建議修法：對話列加入與主線故事相同的略過鍵；章節頁把「潛入」鍵做成黏底按鍵列；左右內距取 `max(16px, env(safe-area-inset-*))`；小日常列用兩欄格線讓標籤與獎勵各自一欄。
2. **紙娃娃編輯器**：簡報提到的馴獸師紙娃娃（髮型／臉型／服裝）編輯器，在 main 與所有分支都沒有程式碼，無從健檢；故事對話框的立繪（`portraitVnOverlay`）存在且已檢查。
3. **既有紅燈的瀏覽器閘門**：`tests/championship-responsive-layout-browser.cjs` 在乾淨的 main 樹上以同樣的斷言失敗（它驗證的「關閉響應式牧場」模式產品已不提供），與本批無關；本批只把其中狩獵門檻的算式同步為 640px。PR #140 的 CI 紅燈與 main 上一批（#138）相同：
   - evolution-streaming（chromium、webkit）：在 baseline 模式準備夾具時就 120 秒逾時，還沒測到本批。
   - currency-layout：期待起始位元幣 100,000，好友試玩模式給 8,000,000（自 10-26 起每個 PR 都一樣）。
   - friends-playtest 的 fresh-economy、legacy-persistence、source-adjacent-mobile 與彙總：失敗位置與 #138 逐行相同。
   - friends-playtest 的 source-wrap-mobile：#138 在存檔退出時逾時；本批走得更遠，在第 9 次相位捕捉時剛好有一隻夥伴在串流下一段動畫（`aria-busy=true`、一隻 `loading`；前 8 次都就緒）而未通過「捕捉時牧場必須完全就緒」。這是既有的動畫串流時序，本批沒有改動美術載入。
4. **刻意放行的重疊**：相剋表是瀏覽器頂層 dialog，本來就會蓋在狀態列之上（帶遮罩），所以「相剋表 ⟂ 狀態列」不算 HUD 重疊；展演沙盒不是頂層，已改成從狀態列下方開始。
5. **需要 Owner 知道的行為變更**：橫向門檻 720→640px 之後，640–719px 寬的橫向裝置（例如 iPhone SE、部分 Android 小手機）的選單、設施配置與狩獵場改用橫向版型，而不是過去整體縮小的直向框。標題、主選單、開場序章與信件不受影響（零差異比對見第 5 節，含瀏海模擬）。
6. **開場序章的「⏭ 跳過序章」伸進右側瀏海（844×390）**：序章屬於開場，但簡報點名的是「創角／選蛋／取名開場流程」，序章沒有點名，依專案規則（標題、主選單與開場維持 main 原樣）不修改。若要修，建議把 `#cm-opening .cm-cutscene` 的左右內距改為 `max(16px, env(safe-area-inset-*))`（只在有側邊瀏海時生效），需 Owner 點名同意。

## 7. 對照截圖（修改前｜修改後）

每張圖左半是修改前（main `82fa48e2`，同一份 QA 存檔），右半是修改後（合併 main 後的最終版本）；圖檔在 `docs/reports/full-viewport-health-2026-11-01/compare/`（WebP，共 101 張、約 4.4 MB）。844×390 與 390×844 模擬 iPhone 的瀏海與 Home 條安全區。

### 含夥伴資訊卡的牧場

![牧場＋夥伴卡（1366×768）](reports/full-viewport-health-2026-11-01/compare/ranch-card--desktop-laptop.webp)

![牧場＋夥伴卡（390×844）](reports/full-viewport-health-2026-11-01/compare/ranch-card--portrait-pro.webp)

![牧場＋夥伴卡（844×390）](reports/full-viewport-health-2026-11-01/compare/ranch-card--landscape-pro.webp)

![牧場＋夥伴卡（展開量表）（667×375）](reports/full-viewport-health-2026-11-01/compare/ranch-card-next--landscape-se.webp)

### 商店：數碼轉蛋機

![轉蛋機（1366×768）](reports/full-viewport-health-2026-11-01/compare/gacha-machine--desktop-laptop.webp)

![轉蛋機（390×844）](reports/full-viewport-health-2026-11-01/compare/gacha-machine--portrait-pro.webp)

![轉蛋機（844×390）](reports/full-viewport-health-2026-11-01/compare/gacha-machine--landscape-pro.webp)

![10 連抽結果（844×390）](reports/full-viewport-health-2026-11-01/compare/gacha-reveal-ten--landscape-pro.webp)

### 商店：5 合 1 合成爐與晶片背包

![合成爐（1366×768）](reports/full-viewport-health-2026-11-01/compare/gacha-synth--desktop-laptop.webp)

![合成爐（390×844）](reports/full-viewport-health-2026-11-01/compare/gacha-synth--portrait-pro.webp)

![合成爐（844×390）](reports/full-viewport-health-2026-11-01/compare/gacha-synth--landscape-pro.webp)

![晶片背包（844×390）](reports/full-viewport-health-2026-11-01/compare/gacha-bag--landscape-pro.webp)

### 圖鑑詳情與實機動作

![圖鑑詳情（1366×768）](reports/full-viewport-health-2026-11-01/compare/dex-detail--desktop-laptop.webp)

![圖鑑詳情（390×844）](reports/full-viewport-health-2026-11-01/compare/dex-detail--portrait-pro.webp)

![圖鑑詳情（844×390）](reports/full-viewport-health-2026-11-01/compare/dex-detail--landscape-pro.webp)

![實機動作（844×390）](reports/full-viewport-health-2026-11-01/compare/dex-motion--landscape-pro.webp)

### 雙五角環相剋表

![相剋表（1366×768）](reports/full-viewport-health-2026-11-01/compare/dex-element-chart--desktop-laptop.webp)

![相剋表（390×844）](reports/full-viewport-health-2026-11-01/compare/dex-element-chart--portrait-pro.webp)

![相剋表（844×390）](reports/full-viewport-health-2026-11-01/compare/dex-element-chart--landscape-pro.webp)

### 必殺展演與切入條

![必殺切入條（1920×1080）](reports/full-viewport-health-2026-11-01/compare/dex-cutin--desktop-fhd.webp)

![必殺切入條（844×390）](reports/full-viewport-health-2026-11-01/compare/dex-cutin--landscape-pro.webp)

![必殺展演（844×390）](reports/full-viewport-health-2026-11-01/compare/dex-special--landscape-pro.webp)

### Data Arena 戰鬥與暫停

![Data Arena 對戰（1366×768）](reports/full-viewport-health-2026-11-01/compare/arena-match--desktop-laptop.webp)

![Data Arena 對戰（390×844）](reports/full-viewport-health-2026-11-01/compare/arena-match--portrait-pro.webp)

![Data Arena 對戰（844×390）](reports/full-viewport-health-2026-11-01/compare/arena-match--landscape-pro.webp)

![Data Arena 暫停（667×375）](reports/full-viewport-health-2026-11-01/compare/arena-pause--landscape-se.webp)

### 故事模式舞台

![故事對話（1366×768）](reports/full-viewport-health-2026-11-01/compare/story-dialogue--desktop-laptop.webp)

![故事對話（390×844）](reports/full-viewport-health-2026-11-01/compare/story-dialogue--portrait-pro.webp)

![故事對話（844×390）](reports/full-viewport-health-2026-11-01/compare/story-dialogue--landscape-pro.webp)

![觀測紀錄（390×844）](reports/full-viewport-health-2026-11-01/compare/story-log--portrait-pro.webp)

![故事星圖（844×390）](reports/full-viewport-health-2026-11-01/compare/story-map--landscape-pro.webp)

### 修改前到不了或最嚴重的畫面

![隊伍編成（844×390）](reports/full-viewport-health-2026-11-01/compare/battle-team--landscape-pro.webp)

![3D 狩獵場（667×375）](reports/full-viewport-health-2026-11-01/compare/hunt-field--landscape-se.webp)

![設施配置（667×375）](reports/full-viewport-health-2026-11-01/compare/cage-edit--landscape-se.webp)

![對戰選單（667×375）](reports/full-viewport-health-2026-11-01/compare/battle-menu--landscape-se.webp)

![對戰選單（375×667）](reports/full-viewport-health-2026-11-01/compare/battle-menu--portrait-se.webp)

![好友與名片（375×667）](reports/full-viewport-health-2026-11-01/compare/friends--portrait-se.webp)

### 其他對照圖

[arena-pause--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/arena-pause--desktop-laptop.webp)、[arena-pause--landscape-pro](reports/full-viewport-health-2026-11-01/compare/arena-pause--landscape-pro.webp)、[arena-pause--portrait-pro](reports/full-viewport-health-2026-11-01/compare/arena-pause--portrait-pro.webp)、[battle-field--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/battle-field--desktop-laptop.webp)、[battle-field--landscape-pro](reports/full-viewport-health-2026-11-01/compare/battle-field--landscape-pro.webp)、[battle-field--portrait-pro](reports/full-viewport-health-2026-11-01/compare/battle-field--portrait-pro.webp)、[battle-menu--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/battle-menu--desktop-laptop.webp)、[battle-menu--landscape-pro](reports/full-viewport-health-2026-11-01/compare/battle-menu--landscape-pro.webp)、[battle-menu--portrait-pro](reports/full-viewport-health-2026-11-01/compare/battle-menu--portrait-pro.webp)、[battle-result--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/battle-result--desktop-laptop.webp)、[battle-result--landscape-pro](reports/full-viewport-health-2026-11-01/compare/battle-result--landscape-pro.webp)、[battle-result--portrait-pro](reports/full-viewport-health-2026-11-01/compare/battle-result--portrait-pro.webp)、[battle-team--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/battle-team--desktop-laptop.webp)、[battle-team--portrait-pro](reports/full-viewport-health-2026-11-01/compare/battle-team--portrait-pro.webp)、[cage-edit--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/cage-edit--desktop-laptop.webp)、[cage-edit--landscape-pro](reports/full-viewport-health-2026-11-01/compare/cage-edit--landscape-pro.webp)、[cage-edit--portrait-pro](reports/full-viewport-health-2026-11-01/compare/cage-edit--portrait-pro.webp)、[cage-select--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/cage-select--desktop-laptop.webp)、[cage-select--landscape-pro](reports/full-viewport-health-2026-11-01/compare/cage-select--landscape-pro.webp)、[cage-select--portrait-pro](reports/full-viewport-health-2026-11-01/compare/cage-select--portrait-pro.webp)、[dex-cutin--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/dex-cutin--desktop-laptop.webp)、[dex-cutin--portrait-pro](reports/full-viewport-health-2026-11-01/compare/dex-cutin--portrait-pro.webp)、[dex-evolution--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/dex-evolution--desktop-laptop.webp)、[dex-evolution--landscape-pro](reports/full-viewport-health-2026-11-01/compare/dex-evolution--landscape-pro.webp)、[dex-evolution--portrait-pro](reports/full-viewport-health-2026-11-01/compare/dex-evolution--portrait-pro.webp)、[dex-motion--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/dex-motion--desktop-laptop.webp)、[dex-motion--portrait-pro](reports/full-viewport-health-2026-11-01/compare/dex-motion--portrait-pro.webp)、[dex-special--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/dex-special--desktop-laptop.webp)、[dex-special--portrait-pro](reports/full-viewport-health-2026-11-01/compare/dex-special--portrait-pro.webp)、[echoes-dialogue--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/echoes-dialogue--desktop-laptop.webp)、[echoes-dialogue--landscape-pro](reports/full-viewport-health-2026-11-01/compare/echoes-dialogue--landscape-pro.webp)、[echoes-dialogue--portrait-pro](reports/full-viewport-health-2026-11-01/compare/echoes-dialogue--portrait-pro.webp)、[friends--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/friends--desktop-laptop.webp)、[friends--landscape-pro](reports/full-viewport-health-2026-11-01/compare/friends--landscape-pro.webp)、[friends--portrait-pro](reports/full-viewport-health-2026-11-01/compare/friends--portrait-pro.webp)、[gacha-bag--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/gacha-bag--desktop-laptop.webp)、[gacha-bag--portrait-pro](reports/full-viewport-health-2026-11-01/compare/gacha-bag--portrait-pro.webp)、[gacha-reveal-ten--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/gacha-reveal-ten--desktop-laptop.webp)、[gacha-reveal-ten--portrait-pro](reports/full-viewport-health-2026-11-01/compare/gacha-reveal-ten--portrait-pro.webp)、[hunt-field--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/hunt-field--desktop-laptop.webp)、[hunt-field--landscape-pro](reports/full-viewport-health-2026-11-01/compare/hunt-field--landscape-pro.webp)、[hunt-field--portrait-pro](reports/full-viewport-health-2026-11-01/compare/hunt-field--portrait-pro.webp)、[menu-system--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/menu-system--desktop-laptop.webp)、[menu-system--landscape-pro](reports/full-viewport-health-2026-11-01/compare/menu-system--landscape-pro.webp)、[menu-system--portrait-pro](reports/full-viewport-health-2026-11-01/compare/menu-system--portrait-pro.webp)、[opening-egg-choice--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/opening-egg-choice--desktop-laptop.webp)、[opening-egg-choice--landscape-pro](reports/full-viewport-health-2026-11-01/compare/opening-egg-choice--landscape-pro.webp)、[opening-egg-choice--portrait-pro](reports/full-viewport-health-2026-11-01/compare/opening-egg-choice--portrait-pro.webp)、[opening-tamer-name--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/opening-tamer-name--desktop-laptop.webp)、[opening-tamer-name--landscape-pro](reports/full-viewport-health-2026-11-01/compare/opening-tamer-name--landscape-pro.webp)、[opening-tamer-name--portrait-pro](reports/full-viewport-health-2026-11-01/compare/opening-tamer-name--portrait-pro.webp)、[passport-bind--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/passport-bind--desktop-laptop.webp)、[passport-bind--landscape-pro](reports/full-viewport-health-2026-11-01/compare/passport-bind--landscape-pro.webp)、[passport-bind--portrait-pro](reports/full-viewport-health-2026-11-01/compare/passport-bind--portrait-pro.webp)、[social-dock--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/social-dock--desktop-laptop.webp)、[social-dock--landscape-pro](reports/full-viewport-health-2026-11-01/compare/social-dock--landscape-pro.webp)、[social-dock--portrait-pro](reports/full-viewport-health-2026-11-01/compare/social-dock--portrait-pro.webp)、[story-log--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/story-log--desktop-laptop.webp)、[story-log--landscape-pro](reports/full-viewport-health-2026-11-01/compare/story-log--landscape-pro.webp)、[story-map--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/story-map--desktop-laptop.webp)、[story-map--portrait-pro](reports/full-viewport-health-2026-11-01/compare/story-map--portrait-pro.webp)、[tamer--desktop-laptop](reports/full-viewport-health-2026-11-01/compare/tamer--desktop-laptop.webp)、[tamer--landscape-pro](reports/full-viewport-health-2026-11-01/compare/tamer--landscape-pro.webp)、[tamer--portrait-pro](reports/full-viewport-health-2026-11-01/compare/tamer--portrait-pro.webp)

## 8. 完整檢查明細（腳本輸出彙整）

每一列是一類問題（同一畫面、同一代碼、同一對元件），「視口」列出出現的寬度，「修改後」欄由同一支腳本在修改後重跑判定。

#### S1 牧場中樞：修改前偵測到的問題（182 類）

| 畫面狀態 | 關卡 | 代碼 | 視口 | 偵測內容（範例） | 修改後 |
|---|---|---|---|---|---|
| cage-edit | G3 橫向適配 | AREA_SMALL | 667 | .cm-hexworld__viewport 只佔畫面 3%（高 74%，279px） | 已清除 |
| cage-edit | G1 重疊 | HUD_OVERLAP | 667 | counter（p.cm-hexworld__counter「9／100 可用土地 40 格」）⟂ filters（div.cm-cage-filters「1格 2~3格 4~5格 場上已放置」） | 已清除 |
| cage-edit | G1 重疊 | HUD_OVERLAP | 667 | counter（p.cm-hexworld__counter「9／100 可用土地 40 格」）⟂ tray（div.cm-vs2-cage-tray「寺廟 ×1 智力上升 · 建議 2 隻 星靈族 」） | 已清除 |
| cage-edit | G2 裁切 | LABEL_WRAP | 667 | 「還原」被擠成 2 行 | 已清除 |
| cage-edit | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-cage-help「?」 伸進右側瀏海安全區 | 已清除 |
| cage-edit | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-vs2-action.cm-cage-row-lock「開放土地 +10 格」 伸進左側瀏海安全區 | 已清除 |
| cage-edit | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-cage-filter[data-filter="4-5"]「4~5格」 伸進右側瀏海安全區 | 已清除 |
| cage-edit | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-cage-filter[data-filter="placed"]「場上已放置」 伸進右側瀏海安全區 | 已清除 |
| cage-edit | G4 連線 | STEP_FAILED | 667 | locator.waitFor: Timeout 5000ms exceeded. | 已清除 |
| cage-edit | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button.cm-cage-filter[data-filter="1"]「1格」 264×36px < 40px | 已清除 |
| cage-edit | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button.cm-cage-filter[data-filter="2-3"]「2~3格」 286×36px < 40px | 已清除 |
| cage-edit | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button.cm-cage-filter[data-filter="4-5"]「4~5格」 280×36px < 40px | 已清除 |
| cage-edit | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button.cm-cage-filter[data-filter="placed"]「場上已放置」 307×36px < 40px | 已清除 |
| cage-edit | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action.cm-hexworld__zoom「−」 22×24px < 40px | 已清除 |
| cage-edit | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action.cm-hexworld__revert「還原」 22×24px < 40px | 已清除 |
| cage-edit | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action「返回牧場」 66×24px < 40px | 已清除 |
| cage-edit | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action.cm-vs2-action--primary「確認配置」 121×24px < 40px | 已清除 |
| cage-edit | G4 連線 | UNREACHABLE | 667 | button.cm-vs2-action.cm-hexworld__zoom「−」 不在畫面內 | 已清除 |
| cage-exit | G2 裁切 | LABEL_WRAP | 390、375、844 | 「蛋白質」被擠成 2 行 | 已清除 |
| cage-exit | G2 裁切 | LABEL_WRAP | 844 | 「管理」被擠成 2 行 | 已清除 |
| cage-exit | G2 裁切 | LABEL_WRAP | 844 | 「商店」被擠成 2 行 | 已清除 |
| cage-exit | G1 重疊 | TEXT_OVERLAP | 844 | 文字互相重疊：span.cm-toolbar__cell-label「蛋白質」 ⟂ span.cm-toolbar__stock「90」 | 已清除 |
| cage-filter-1 | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-cage-help「?」 伸進右側瀏海安全區 | 已清除 |
| cage-filter-1 | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-vs2-action.cm-cage-row-lock「開放土地 +10 格」 伸進左側瀏海安全區 | 已清除 |
| cage-filter-1 | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-cage-filter[data-filter="4-5"]「4~5格」 伸進右側瀏海安全區 | 已清除 |
| cage-filter-1 | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-cage-filter[data-filter="placed"]「場上已放置」 伸進右側瀏海安全區 | 已清除 |
| cage-filter-1 | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844 | button.cm-cage-filter[data-filter="1"]「1格」 264×36px < 40px | 已清除 |
| cage-filter-1 | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844 | button.cm-cage-filter[data-filter="2-3"]「2~3格」 286×36px < 40px | 已清除 |
| cage-filter-1 | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844 | button.cm-cage-filter[data-filter="4-5"]「4~5格」 280×36px < 40px | 已清除 |
| cage-filter-1 | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844 | button.cm-cage-filter[data-filter="placed"]「場上已放置」 307×36px < 40px | 已清除 |
| cage-filter-2-3 | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-cage-help「?」 伸進右側瀏海安全區 | 已清除 |
| cage-filter-2-3 | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-vs2-action.cm-cage-row-lock「開放土地 +10 格」 伸進左側瀏海安全區 | 已清除 |
| cage-filter-2-3 | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-cage-filter[data-filter="4-5"]「4~5格」 伸進右側瀏海安全區 | 已清除 |
| cage-filter-2-3 | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-cage-filter[data-filter="placed"]「場上已放置」 伸進右側瀏海安全區 | 已清除 |
| cage-filter-2-3 | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844 | button.cm-cage-filter[data-filter="1"]「1格」 264×36px < 40px | 已清除 |
| cage-filter-2-3 | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844 | button.cm-cage-filter[data-filter="2-3"]「2~3格」 286×36px < 40px | 已清除 |
| cage-filter-2-3 | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844 | button.cm-cage-filter[data-filter="4-5"]「4~5格」 280×36px < 40px | 已清除 |
| cage-filter-2-3 | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844 | button.cm-cage-filter[data-filter="placed"]「場上已放置」 307×36px < 40px | 已清除 |
| cage-filter-4-5 | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-cage-help「?」 伸進右側瀏海安全區 | 已清除 |
| cage-filter-4-5 | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-vs2-action.cm-cage-row-lock「開放土地 +10 格」 伸進左側瀏海安全區 | 已清除 |
| cage-filter-4-5 | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-cage-filter[data-filter="4-5"]「4~5格」 伸進右側瀏海安全區 | 已清除 |
| cage-filter-4-5 | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-cage-filter[data-filter="placed"]「場上已放置」 伸進右側瀏海安全區 | 已清除 |
| cage-filter-4-5 | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844 | button.cm-cage-filter[data-filter="1"]「1格」 264×36px < 40px | 已清除 |
| cage-filter-4-5 | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844 | button.cm-cage-filter[data-filter="2-3"]「2~3格」 286×36px < 40px | 已清除 |
| cage-filter-4-5 | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844 | button.cm-cage-filter[data-filter="4-5"]「4~5格」 280×36px < 40px | 已清除 |
| cage-filter-4-5 | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844 | button.cm-cage-filter[data-filter="placed"]「場上已放置」 307×36px < 40px | 已清除 |
| cage-filter-placed | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-cage-help「?」 伸進右側瀏海安全區 | 已清除 |
| cage-filter-placed | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-vs2-action.cm-cage-row-lock「開放土地 +10 格」 伸進左側瀏海安全區 | 已清除 |
| cage-filter-placed | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844 | button.cm-cage-filter[data-filter="1"]「1格」 264×36px < 40px | 已清除 |
| cage-filter-placed | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844 | button.cm-cage-filter[data-filter="2-3"]「2~3格」 286×36px < 40px | 已清除 |
| cage-filter-placed | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844 | button.cm-cage-filter[data-filter="4-5"]「4~5格」 280×36px < 40px | 已清除 |
| cage-filter-placed | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844 | button.cm-cage-filter[data-filter="placed"]「場上已放置」 307×36px < 40px | 已清除 |
| cage-select | G1 重疊 | COVERED | 375 | button.cm-vs2-action.cm-hexworld__zoom「全覽」 被 div.cm-hexworld__selection 蓋住 | 已清除 |
| cage-select | G1 重疊 | COVERED | 375 | button.cm-vs2-action.cm-hexworld__revert「還原」 被 div.cm-hexworld__actions 蓋住 | 已清除 |
| cage-select | G1 重疊 | HUD_OVERLAP | 390、375 | keys（div.cm-hexworld__keys「− ＋ 全覽 還原」）⟂ selection（div.cm-hexworld__selection「運動場 · 生態：運動場 移動 收回 取消選取」） | 已清除 |
| cage-select | G1 重疊 | OVERLAP | 375 | button.cm-vs2-action.cm-hexworld__revert「還原」 ⟂ button.cm-vs2-action「取消選取」 | 已清除 |
| cage-select | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-cage-help「?」 伸進右側瀏海安全區 | 已清除 |
| cage-select | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-vs2-action「移動」 伸進左側瀏海安全區 | 已清除 |
| cage-select | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-cage-filter[data-filter="4-5"]「4~5格」 伸進右側瀏海安全區 | 已清除 |
| cage-select | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-cage-filter[data-filter="placed"]「場上已放置」 伸進右側瀏海安全區 | 已清除 |
| cage-select | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844 | button.cm-cage-filter[data-filter="1"]「1格」 264×36px < 40px | 已清除 |
| cage-select | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844 | button.cm-cage-filter[data-filter="2-3"]「2~3格」 286×36px < 40px | 已清除 |
| cage-select | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844 | button.cm-cage-filter[data-filter="4-5"]「4~5格」 280×36px < 40px | 已清除 |
| cage-select | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844 | button.cm-cage-filter[data-filter="placed"]「場上已放置」 307×36px < 40px | 已清除 |
| menu-management | G2 裁切 | LABEL_WRAP | 390、375、844 | 「蛋白質」被擠成 2 行 | 已清除 |
| menu-management | G2 裁切 | LABEL_WRAP | 844 | 「管理」被擠成 2 行 | 已清除 |
| menu-management | G2 裁切 | LABEL_WRAP | 844、667 | 「商店」被擠成 2 行 | 已清除 |
| menu-management | G1 重疊 | TEXT_OVERLAP | 844 | 文字互相重疊：span.cm-toolbar__cell-label「蛋白質」 ⟂ span.cm-toolbar__stock「90」 | 已清除 |
| menu-management | G4 連線 | UNREACHABLE | 844、667 | button.cm-toolbar__entry[data-entry-id="digimon"]「夥伴 夥伴名單與能力值」 不在畫面內 | 已清除 |
| menu-management-closed | G2 裁切 | LABEL_WRAP | 390、375、844 | 「蛋白質」被擠成 2 行 | 已清除 |
| menu-management-closed | G2 裁切 | LABEL_WRAP | 844 | 「管理」被擠成 2 行 | 已清除 |
| menu-management-closed | G2 裁切 | LABEL_WRAP | 844、667 | 「商店」被擠成 2 行 | 已清除 |
| menu-management-closed | G1 重疊 | TEXT_OVERLAP | 844 | 文字互相重疊：span.cm-toolbar__cell-label「蛋白質」 ⟂ span.cm-toolbar__stock「90」 | 已清除 |
| menu-system | G2 裁切 | LABEL_WRAP | 390、375、844 | 「蛋白質」被擠成 2 行 | 已清除 |
| menu-system | G2 裁切 | LABEL_WRAP | 844 | 「管理」被擠成 2 行 | 已清除 |
| menu-system | G2 裁切 | LABEL_WRAP | 844、667 | 「商店」被擠成 2 行 | 已清除 |
| menu-system | G1 重疊 | TEXT_OVERLAP | 844 | 文字互相重疊：span.cm-toolbar__cell-label「蛋白質」 ⟂ span.cm-toolbar__stock「90」 | 已清除 |
| menu-system | G4 連線 | UNREACHABLE | 1920 | 選單：無法點擊（locator.click: Timeout 12000ms exceeded.） | 已清除 |
| menu-system | G4 連線 | UNREACHABLE | 844、667 | button.cm-toolbar__entry[data-entry-id="backpack"]「背包 道具、用品與探索發現」 不在畫面內 | 已清除 |
| menu-system-closed | G2 裁切 | LABEL_WRAP | 390、375、844 | 「蛋白質」被擠成 2 行 | 已清除 |
| menu-system-closed | G2 裁切 | LABEL_WRAP | 844 | 「管理」被擠成 2 行 | 已清除 |
| menu-system-closed | G2 裁切 | LABEL_WRAP | 844、667 | 「商店」被擠成 2 行 | 已清除 |
| menu-system-closed | G1 重疊 | TEXT_OVERLAP | 844 | 文字互相重疊：span.cm-toolbar__cell-label「蛋白質」 ⟂ span.cm-toolbar__stock「90」 | 已清除 |
| opening-egg-choice | G4 連線 | UNREACHABLE | 667 | button.cm-onboard-cta「選這顆蛋」 不在畫面內 | 已清除 |
| opening-story | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-cutscene__skip「⏭ 跳過序章」 伸進右側瀏海安全區 | 仍在（844） |
| opening-tamer-name | G4 連線 | UNREACHABLE | 844、667 | button.cm-onboard-cta「決定」 不在畫面內 | 已清除 |
| ranch-card | G1 重疊 | COVERED | 1920、1366 | button.int-rh2-discoveries[data-action="ranch-discoveries"]「探索手帳 · 3/12」 被 span.int-rh2-companion__name 蓋住 | 已清除 |
| ranch-card | G1 重疊 | HUD_OVERLAP | 1920、1366、844、667 | journal（button.int-rh2-discoveries[data-action="ranch-discoveries"]「探索手帳 · 3/12」）⟂ card（section.int-rh2-compan | 已清除 |
| ranch-card | G2 裁切 | LABEL_WRAP | 390、375、844 | 「蛋白質」被擠成 2 行 | 已清除 |
| ranch-card | G2 裁切 | LABEL_WRAP | 844 | 「管理」被擠成 2 行 | 已清除 |
| ranch-card | G2 裁切 | LABEL_WRAP | 844、667 | 「商店」被擠成 2 行 | 已清除 |
| ranch-card | G4 連線 | NO_EXIT | 844、667 | button.int-rh2-companion__close「×」 不在畫面內 | 已清除 |
| ranch-card | G1 重疊 | OVERLAP | 1920、1366 | button.int-rh2-companion__copy「黑暗戰鬥暴龍獸 黑鎧龍 等候室 ✨ 精神百倍 詳」 ⟂ button.int-rh2-discoveries[data-action="ranch-disco | 已清除 |
| ranch-card | G5 溢出／觸控 | TARGET_SMALL | 390、375 | button.cm-toolbar__cell[data-menu-id="MANAGEMENT"][data-icon="manage"]「管理」 39×71px < 40px | 已清除 |
| ranch-card | G5 溢出／觸控 | TARGET_SMALL | 390、375、844、667 | button.int-rh2-companion__nav「‹」 44×38px < 40px | 已清除 |
| ranch-card | G5 溢出／觸控 | TARGET_SMALL | 390、375、844、667 | button.int-rh2-companion__close「×」 44×38px < 40px | 已清除 |
| ranch-card | G5 溢出／觸控 | TARGET_SMALL | 375 | button.cm-toolbar__cell[data-icon="hand"]「手掌」 39×71px < 40px | 已清除 |
| ranch-card | G5 溢出／觸控 | TARGET_SMALL | 375 | button.cm-toolbar__cell[data-icon="feed"]「餵食 90」 39×71px < 40px | 已清除 |
| ranch-card | G5 溢出／觸控 | TARGET_SMALL | 375 | button.cm-toolbar__cell[data-icon="protein"]「蛋白質 90」 39×71px < 40px | 已清除 |
| ranch-card | G5 溢出／觸控 | TARGET_SMALL | 375 | button.cm-toolbar__cell[data-icon="clean"]「清潔」 39×71px < 40px | 已清除 |
| ranch-card | G5 溢出／觸控 | TARGET_SMALL | 375 | button.cm-toolbar__cell[data-icon="woundMedicine"]「傷藥 90」 39×71px < 40px | 已清除 |
| ranch-card | G5 溢出／觸控 | TARGET_SMALL | 375 | button.cm-toolbar__cell[data-icon="medicine"]「藥品 90」 39×71px < 40px | 已清除 |
| ranch-card | G5 溢出／觸控 | TARGET_SMALL | 375 | button.cm-toolbar__cell[data-menu-id="SYSTEM"][data-icon="system"]「選單」 39×71px < 40px | 已清除 |
| ranch-card | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.cm-toolbar__quick-entry[data-quick-id="hunt"][data-entry-id="hunt"]「狩獵」 72×34px < 40px | 已清除 |
| ranch-card | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.cm-toolbar__quick-entry[data-quick-id="battle"][data-entry-id="battle"]「對戰」 72×34px < 40px | 已清除 |
| ranch-card | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.cm-toolbar__quick-entry[data-quick-id="shop"][data-entry-id="shop"]「商店 10」 72×38px < 40px | 已清除 |
| ranch-card | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.cm-toolbar__quick-entry[data-quick-id="database"][data-entry-id="database"]「圖鑑」 72×38px < 40px | 已清除 |
| ranch-card | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.int-rh2-companion__nav.int-rh2-companion__toggle「選取的夥伴」 44×36px < 40px | 已清除 |
| ranch-card | G1 重疊 | TEXT_OVERLAP | 1920、1366 | 文字互相重疊：span.int-rh2-companion__name「黑暗戰鬥暴龍獸」 ⟂ button.int-rh2-discoveries[data-action="ranch-discoveries"]「探索手 | 已清除 |
| ranch-card | G1 重疊 | TEXT_OVERLAP | 844 | 文字互相重疊：span.cm-toolbar__cell-label「蛋白質」 ⟂ span.cm-toolbar__stock「90」 | 已清除 |
| ranch-card | G2 裁切 | TEXT_TRUNCATED | 1920 | 「黑鎧龍」被截斷成省略號 | 已清除 |
| ranch-card | G4 連線 | UNREACHABLE | 844、667 | button.int-rh2-companion__nav「‹」 不在畫面內 | 已清除 |
| ranch-card-expanded | G1 重疊 | COVERED | 844 | button.int-rh2-discoveries[data-action="ranch-discoveries"]「探索手帳 · 3/12」 被 span.int-rh2-companion__place 蓋住 | 已清除 |
| ranch-card-expanded | G1 重疊 | COVERED | 667 | button.int-rh2-discoveries[data-action="ranch-discoveries"]「探索手帳 · 3/12」 被 span.int-rh2-companion__species 蓋住 | 已清除 |
| ranch-card-expanded | G1 重疊 | HUD_OVERLAP | 844、667 | journal（button.int-rh2-discoveries[data-action="ranch-discoveries"]「探索手帳 · 3/12」）⟂ card（section.int-rh2-compan | 已清除 |
| ranch-card-expanded | G2 裁切 | LABEL_WRAP | 844 | 「蛋白質」被擠成 2 行 | 已清除 |
| ranch-card-expanded | G2 裁切 | LABEL_WRAP | 844 | 「管理」被擠成 2 行 | 已清除 |
| ranch-card-expanded | G2 裁切 | LABEL_WRAP | 844、667 | 「商店」被擠成 2 行 | 已清除 |
| ranch-card-expanded | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.cm-toolbar__quick-entry[data-quick-id="hunt"][data-entry-id="hunt"]「狩獵」 72×34px < 40px | 已清除 |
| ranch-card-expanded | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.cm-toolbar__quick-entry[data-quick-id="battle"][data-entry-id="battle"]「對戰」 72×34px < 40px | 已清除 |
| ranch-card-expanded | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.cm-toolbar__quick-entry[data-quick-id="shop"][data-entry-id="shop"]「商店 10」 72×38px < 40px | 已清除 |
| ranch-card-expanded | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.cm-toolbar__quick-entry[data-quick-id="database"][data-entry-id="database"]「圖鑑」 72×38px < 40px | 已清除 |
| ranch-card-expanded | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.int-rh2-companion__nav「‹」 44×36px < 40px | 已清除 |
| ranch-card-expanded | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.int-rh2-companion__nav.int-rh2-companion__toggle「選取的夥伴」 44×36px < 40px | 已清除 |
| ranch-card-expanded | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.int-rh2-companion__close「×」 44×36px < 40px | 已清除 |
| ranch-card-expanded | G1 重疊 | TEXT_OVERLAP | 844 | 文字互相重疊：span.cm-toolbar__cell-label「蛋白質」 ⟂ span.cm-toolbar__stock「90」 | 已清除 |
| ranch-card-next | G1 重疊 | COVERED | 844 | button.int-rh2-discoveries[data-action="ranch-discoveries"]「探索手帳 · 3/12」 被 span.int-rh2-companion__place 蓋住 | 已清除 |
| ranch-card-next | G1 重疊 | COVERED | 667 | button.int-rh2-discoveries[data-action="ranch-discoveries"]「探索手帳 · 3/12」 被 span.int-rh2-companion__species 蓋住 | 已清除 |
| ranch-card-next | G1 重疊 | HUD_OVERLAP | 844、667 | journal（button.int-rh2-discoveries[data-action="ranch-discoveries"]「探索手帳 · 3/12」）⟂ card（section.int-rh2-compan | 已清除 |
| ranch-card-next | G2 裁切 | LABEL_WRAP | 844 | 「蛋白質」被擠成 2 行 | 已清除 |
| ranch-card-next | G2 裁切 | LABEL_WRAP | 844 | 「管理」被擠成 2 行 | 已清除 |
| ranch-card-next | G2 裁切 | LABEL_WRAP | 844、667 | 「商店」被擠成 2 行 | 已清除 |
| ranch-card-next | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.cm-toolbar__quick-entry[data-quick-id="hunt"][data-entry-id="hunt"]「狩獵」 72×34px < 40px | 已清除 |
| ranch-card-next | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.cm-toolbar__quick-entry[data-quick-id="battle"][data-entry-id="battle"]「對戰」 72×34px < 40px | 已清除 |
| ranch-card-next | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.cm-toolbar__quick-entry[data-quick-id="shop"][data-entry-id="shop"]「商店 10」 72×38px < 40px | 已清除 |
| ranch-card-next | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.cm-toolbar__quick-entry[data-quick-id="database"][data-entry-id="database"]「圖鑑」 72×38px < 40px | 已清除 |
| ranch-card-next | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.int-rh2-companion__nav「‹」 44×36px < 40px | 已清除 |
| ranch-card-next | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.int-rh2-companion__nav.int-rh2-companion__toggle「選取的夥伴」 44×36px < 40px | 已清除 |
| ranch-card-next | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.int-rh2-companion__close「×」 44×36px < 40px | 已清除 |
| ranch-card-next | G1 重疊 | TEXT_OVERLAP | 844 | 文字互相重疊：span.cm-toolbar__cell-label「蛋白質」 ⟂ span.cm-toolbar__stock「90」 | 已清除 |
| ranch-detail | G2 裁切 | LABEL_WRAP | 667 | 「收合」被擠成 2 行 | 已清除 |
| ranch-detail-closed | G2 裁切 | LABEL_WRAP | 390、375、844 | 「蛋白質」被擠成 2 行 | 已清除 |
| ranch-detail-closed | G2 裁切 | LABEL_WRAP | 844 | 「管理」被擠成 2 行 | 已清除 |
| ranch-detail-closed | G2 裁切 | LABEL_WRAP | 844、667 | 「商店」被擠成 2 行 | 已清除 |
| ranch-detail-closed | G1 重疊 | TEXT_OVERLAP | 844 | 文字互相重疊：span.cm-toolbar__cell-label「蛋白質」 ⟂ span.cm-toolbar__stock「90」 | 已清除 |
| ranch-fresh | G2 裁切 | LABEL_WRAP | 390、375、844 | 「蛋白質」被擠成 2 行 | 已清除 |
| ranch-fresh | G2 裁切 | LABEL_WRAP | 844 | 「管理」被擠成 2 行 | 已清除 |
| ranch-fresh | G2 裁切 | LABEL_WRAP | 844、667 | 「商店」被擠成 2 行 | 已清除 |
| ranch-fresh | G5 溢出／觸控 | TARGET_SMALL | 390、375 | button.cm-toolbar__cell[data-menu-id="MANAGEMENT"][data-icon="manage"]「管理」 39×71px < 40px | 已清除 |
| ranch-fresh | G5 溢出／觸控 | TARGET_SMALL | 375 | button.cm-toolbar__cell[data-icon="hand"]「手掌」 39×71px < 40px | 已清除 |
| ranch-fresh | G5 溢出／觸控 | TARGET_SMALL | 375 | button.cm-toolbar__cell[data-icon="feed"]「餵食 50」 39×71px < 40px | 已清除 |
| ranch-fresh | G5 溢出／觸控 | TARGET_SMALL | 375 | button.cm-toolbar__cell[data-icon="protein"]「蛋白質 10」 39×71px < 40px | 已清除 |
| ranch-fresh | G5 溢出／觸控 | TARGET_SMALL | 375 | button.cm-toolbar__cell[data-icon="clean"]「清潔」 39×71px < 40px | 已清除 |
| ranch-fresh | G5 溢出／觸控 | TARGET_SMALL | 375 | button.cm-toolbar__cell[data-icon="woundMedicine"]「傷藥 10」 39×71px < 40px | 已清除 |
| ranch-fresh | G5 溢出／觸控 | TARGET_SMALL | 375 | button.cm-toolbar__cell[data-icon="medicine"]「藥品 10」 39×71px < 40px | 已清除 |
| ranch-fresh | G5 溢出／觸控 | TARGET_SMALL | 375 | button.cm-toolbar__cell[data-menu-id="SYSTEM"][data-icon="system"]「選單」 39×71px < 40px | 已清除 |
| ranch-fresh | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.cm-toolbar__quick-entry[data-quick-id="hunt"][data-entry-id="hunt"]「狩獵」 72×34px < 40px | 已清除 |
| ranch-fresh | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.cm-toolbar__quick-entry[data-quick-id="battle"][data-entry-id="battle"]「對戰」 72×34px < 40px | 已清除 |
| ranch-fresh | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.cm-toolbar__quick-entry[data-quick-id="shop"][data-entry-id="shop"]「商店 10」 72×39px < 40px | 已清除 |
| ranch-fresh | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.cm-toolbar__quick-entry[data-quick-id="database"][data-entry-id="database"]「圖鑑」 73×39px < 40px | 已清除 |
| ranch-fresh | G1 重疊 | TEXT_OVERLAP | 844 | 文字互相重疊：span.cm-toolbar__cell-label「蛋白質」 ⟂ span.cm-toolbar__stock「10」 | 已清除 |
| ranch-home | G2 裁切 | LABEL_WRAP | 390、375、844 | 「蛋白質」被擠成 2 行 | 已清除 |
| ranch-home | G2 裁切 | LABEL_WRAP | 844 | 「管理」被擠成 2 行 | 已清除 |
| ranch-home | G2 裁切 | LABEL_WRAP | 844、667 | 「商店」被擠成 2 行 | 已清除 |
| ranch-home | G5 溢出／觸控 | TARGET_SMALL | 390、375 | button.cm-toolbar__cell[data-menu-id="MANAGEMENT"][data-icon="manage"]「管理」 39×71px < 40px | 已清除 |
| ranch-home | G5 溢出／觸控 | TARGET_SMALL | 375 | button.cm-toolbar__cell[data-icon="hand"]「手掌」 39×71px < 40px | 已清除 |
| ranch-home | G5 溢出／觸控 | TARGET_SMALL | 375 | button.cm-toolbar__cell[data-icon="feed"]「餵食 90」 39×71px < 40px | 已清除 |
| ranch-home | G5 溢出／觸控 | TARGET_SMALL | 375 | button.cm-toolbar__cell[data-icon="protein"]「蛋白質 90」 39×71px < 40px | 已清除 |
| ranch-home | G5 溢出／觸控 | TARGET_SMALL | 375 | button.cm-toolbar__cell[data-icon="clean"]「清潔」 39×71px < 40px | 已清除 |
| ranch-home | G5 溢出／觸控 | TARGET_SMALL | 375 | button.cm-toolbar__cell[data-icon="woundMedicine"]「傷藥 90」 39×71px < 40px | 已清除 |
| ranch-home | G5 溢出／觸控 | TARGET_SMALL | 375 | button.cm-toolbar__cell[data-icon="medicine"]「藥品 90」 39×71px < 40px | 已清除 |
| ranch-home | G5 溢出／觸控 | TARGET_SMALL | 375 | button.cm-toolbar__cell[data-menu-id="SYSTEM"][data-icon="system"]「選單」 39×71px < 40px | 已清除 |
| ranch-home | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.cm-toolbar__quick-entry[data-quick-id="hunt"][data-entry-id="hunt"]「狩獵」 72×34px < 40px | 已清除 |
| ranch-home | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.cm-toolbar__quick-entry[data-quick-id="battle"][data-entry-id="battle"]「對戰」 72×34px < 40px | 已清除 |
| ranch-home | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.cm-toolbar__quick-entry[data-quick-id="shop"][data-entry-id="shop"]「商店 10」 72×38px < 40px | 已清除 |
| ranch-home | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.cm-toolbar__quick-entry[data-quick-id="database"][data-entry-id="database"]「圖鑑」 72×38px < 40px | 已清除 |
| ranch-home | G1 重疊 | TEXT_OVERLAP | 844 | 文字互相重疊：span.cm-toolbar__cell-label「蛋白質」 ⟂ span.cm-toolbar__stock「90」 | 已清除 |
| ranch-journal | G4 連線 | NO_EXIT | 844、667 | button.cm-dialog__action.cm-dialog__action--secondary[data-action="close"]「繼續散步」 不在畫面內 | 已清除 |
| ranch-journal-closed | G2 裁切 | LABEL_WRAP | 390、375、844 | 「蛋白質」被擠成 2 行 | 已清除 |
| ranch-journal-closed | G2 裁切 | LABEL_WRAP | 844 | 「管理」被擠成 2 行 | 已清除 |
| ranch-journal-closed | G2 裁切 | LABEL_WRAP | 844、667 | 「商店」被擠成 2 行 | 已清除 |
| ranch-journal-closed | G1 重疊 | TEXT_OVERLAP | 844 | 文字互相重疊：span.cm-toolbar__cell-label「蛋白質」 ⟂ span.cm-toolbar__stock「90」 | 已清除 |

#### S2 商店／轉蛋：修改前偵測到的問題（53 類）

| 畫面狀態 | 關卡 | 代碼 | 視口 | 偵測內容（範例） | 修改後 |
|---|---|---|---|---|---|
| gacha-bag | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-shop__tab「養成用品」 56×24px < 40px | 已清除 |
| gacha-bag | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action「返回牧場」 66×24px < 40px | 已清除 |
| gacha-bag | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-gacha-key.cm-gacha__mode「轉蛋機」 61×22px < 40px | 已清除 |
| gacha-bag | G2 裁切 | TEXT_TRUNCATED | 375 | 「晶片背包」被截斷成省略號 | 已清除 |
| gacha-bag-selected | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-shop__tab「養成用品」 56×24px < 40px | 已清除 |
| gacha-bag-selected | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action「返回牧場」 66×24px < 40px | 已清除 |
| gacha-bag-selected | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-gacha-key.cm-gacha__mode「轉蛋機」 61×22px < 40px | 已清除 |
| gacha-bag-selected | G2 裁切 | TEXT_TRUNCATED | 375 | 「晶片背包」被截斷成省略號 | 已清除 |
| gacha-machine | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-shop__tab「養成用品」 56×24px < 40px | 已清除 |
| gacha-machine | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action「返回牧場」 66×24px < 40px | 已清除 |
| gacha-machine | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-gacha-key.cm-gacha__mode「轉蛋機」 61×22px < 40px | 已清除 |
| gacha-machine | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-gacha-key.cm-gacha__pull「單抽 ×1」 82×30px < 40px | 已清除 |
| gacha-machine | G2 裁切 | TEXT_TRUNCATED | 375 | 「晶片背包」被截斷成省略號 | 已清除 |
| gacha-machine | G4 連線 | UNREACHABLE | 844 | button.cm-gacha-key.cm-gacha__pull「單抽 ×1」 不在畫面內 | 已清除 |
| gacha-machine | G4 連線 | UNREACHABLE | 844 | button.cm-gacha-key.cm-gacha__pull「十連狂轉 ×10」 不在畫面內 | 已清除 |
| gacha-reveal-closed | G2 裁切 | TEXT_TRUNCATED | 375 | 「晶片背包」被截斷成省略號 | 已清除 |
| gacha-reveal-one | G4 連線 | NO_EXIT | 844 | button.cm-gacha-key.cm-gacha__action「確定收下」 不在畫面內 | 已清除 |
| gacha-reveal-one | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-gacha-key.cm-gacha__action「確定收下」 95×24px < 40px | 已清除 |
| gacha-reveal-ten | G4 連線 | NO_EXIT | 844 | button.cm-gacha-key.cm-gacha__action「確定收下」 不在畫面內 | 已清除 |
| gacha-reveal-ten | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-gacha-key.cm-gacha__action「確定收下」 95×24px < 40px | 已清除 |
| gacha-reveal-ten | G4 連線 | UNREACHABLE | 844 | article.cm-gacha__card「R 貝塔礦石碎片 進化金屬」 不在畫面內 | 已清除 |
| gacha-reveal-ten | G4 連線 | UNREACHABLE | 844 | article.cm-gacha__card「R 速度超頻晶片 晶片」 不在畫面內 | 已清除 |
| gacha-reveal-ten | G4 連線 | UNREACHABLE | 844 | article.cm-gacha__card「R 生命超頻晶片 晶片」 不在畫面內 | 已清除 |
| gacha-reveal-ten | G4 連線 | UNREACHABLE | 844 | article.cm-gacha__card「R 飼料鮮肉 ×11」 不在畫面內 | 已清除 |
| gacha-synth | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-shop__tab「養成用品」 56×24px < 40px | 已清除 |
| gacha-synth | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action「返回牧場」 66×24px < 40px | 已清除 |
| gacha-synth | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-gacha-key.cm-gacha__mode「轉蛋機」 61×22px < 40px | 已清除 |
| gacha-synth | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-gacha-key.cm-gacha__action「自動填入低階晶片」 92×24px < 40px | 已清除 |
| gacha-synth | G2 裁切 | TEXT_TRUNCATED | 375 | 「晶片背包」被截斷成省略號 | 已清除 |
| gacha-synth | G2 裁切 | TEXT_TRUNCATED | 375 | 「自動填入低階晶片」被截斷成省略號 | 已清除 |
| gacha-synth | G4 連線 | UNREACHABLE | 844 | button.cm-gacha-key.cm-gacha__action「開始熔煉合成」 不在畫面內 | 已清除 |
| gacha-synth-filled | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-shop__tab「養成用品」 56×24px < 40px | 已清除 |
| gacha-synth-filled | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action「返回牧場」 66×24px < 40px | 已清除 |
| gacha-synth-filled | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-gacha-key.cm-gacha__mode「轉蛋機」 61×22px < 40px | 已清除 |
| gacha-synth-filled | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-gacha-key.cm-gacha__action「自動填入低階晶片」 92×24px < 40px | 已清除 |
| gacha-synth-filled | G2 裁切 | TEXT_TRUNCATED | 375 | 「晶片背包」被截斷成省略號 | 已清除 |
| gacha-synth-filled | G2 裁切 | TEXT_TRUNCATED | 375 | 「自動填入低階晶片」被截斷成省略號 | 已清除 |
| gacha-synth-filled | G4 連線 | UNREACHABLE | 844 | button.cm-gacha-key.cm-gacha__action「開始熔煉合成」 不在畫面內 | 已清除 |
| shop-cages | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-shop__tab「養成用品」 56×24px < 40px | 已清除 |
| shop-cages | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action「返回牧場」 66×24px < 40px | 已清除 |
| shop-detail | G2 裁切 | LABEL_WRAP | 667 | 「購買」被擠成 2 行 | 已清除 |
| shop-detail | G4 連線 | NO_EXIT | 375、844 | button.cm-vs2-action.cm-vs2-shop__close「關閉」 不在畫面內 | 已清除 |
| shop-detail | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action.cm-vs2-shop__close「關閉」 41×24px < 40px | 已清除 |
| shop-detail | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action.cm-vs2-action--primary「購買」 25×24px < 40px | 已清除 |
| shop-detail | G4 連線 | UNREACHABLE | 375、844 | button.cm-vs2-action.cm-vs2-action--primary「購買」 不在畫面內 | 已清除 |
| shop-exit | G2 裁切 | LABEL_WRAP | 390、375、844 | 「蛋白質」被擠成 2 行 | 已清除 |
| shop-exit | G2 裁切 | LABEL_WRAP | 844 | 「管理」被擠成 2 行 | 已清除 |
| shop-exit | G2 裁切 | LABEL_WRAP | 844、667 | 「商店」被擠成 2 行 | 已清除 |
| shop-exit | G1 重疊 | TEXT_OVERLAP | 844 | 文字互相重疊：span.cm-toolbar__cell-label「蛋白質」 ⟂ span.cm-toolbar__stock「92」 | 已清除 |
| shop-hunt_items | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-shop__tab「養成用品」 56×24px < 40px | 已清除 |
| shop-hunt_items | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action「返回牧場」 66×24px < 40px | 已清除 |
| shop-training_goods | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-shop__tab「養成用品」 56×24px < 40px | 已清除 |
| shop-training_goods | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action「返回牧場」 66×24px < 40px | 已清除 |

#### S3 圖鑑：修改前偵測到的問題（69 類）

| 畫面狀態 | 關卡 | 代碼 | 視口 | 偵測內容（範例） | 修改後 |
|---|---|---|---|---|---|
| dex-conditions | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-vs2-action.cm-vs2-database__close「關閉」 伸進右側瀏海安全區 | 已清除 |
| dex-conditions | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button.cm-showcase-toggle__option「高清立繪」 138×30px < 40px | 已清除 |
| dex-conditions | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button.cm-showcase-cta.cm-showcase-cta--evolution「✨ 進化預覽」 107×38px < 40px | 已清除 |
| dex-conditions | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button.cm-element-chart-button「屬性相剋表」 104×38px < 40px | 已清除 |
| dex-conditions | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button#cm-dex-conditions-1-0-toggle.cm-dex-conditions__toggle「條件」 78×38px < 40px | 已清除 |
| dex-conditions | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button#cm-dex-conditions-1-1-toggle.cm-dex-conditions__toggle「條件」 78×38px < 40px | 已清除 |
| dex-conditions | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button#cm-dex-conditions-1-2-toggle.cm-dex-conditions__toggle「條件」 78×38px < 40px | 已清除 |
| dex-conditions | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button#cm-dex-conditions-1-3-toggle.cm-dex-conditions__toggle「條件」 78×38px < 40px | 已清除 |
| dex-conditions | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action.cm-vs2-database__close「關閉」 48×24px < 40px | 已清除 |
| dex-conditions | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-showcase-motion__turn「↻ 轉向」 35×22px < 40px | 已清除 |
| dex-conditions | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-showcase-motion__action[data-action="stand"]「待機」 28×22px < 40px | 已清除 |
| dex-conditions | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-showcase-motion__action[data-action="walk"]「散步」 28×22px < 40px | 已清除 |
| dex-conditions | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-showcase-motion__action[data-action="attack"]「攻擊」 28×22px < 40px | 已清除 |
| dex-conditions | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-showcase-motion__action[data-action="cheer"]「歡呼」 28×22px < 40px | 已清除 |
| dex-conditions | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-showcase-cta.cm-showcase-cta--special「🎬 預覽必殺技」 68×22px < 40px | 已清除 |
| dex-detail | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-vs2-action.cm-vs2-database__close「關閉」 伸進右側瀏海安全區 | 已清除 |
| dex-detail | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button.cm-showcase-toggle__option「高清立繪」 138×30px < 40px | 已清除 |
| dex-detail | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button.cm-showcase-cta.cm-showcase-cta--evolution「✨ 進化預覽」 107×38px < 40px | 已清除 |
| dex-detail | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button.cm-element-chart-button「屬性相剋表」 104×38px < 40px | 已清除 |
| dex-detail | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button#cm-dex-conditions-1-0-toggle.cm-dex-conditions__toggle「條件」 78×38px < 40px | 已清除 |
| dex-detail | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button#cm-dex-conditions-1-1-toggle.cm-dex-conditions__toggle「條件」 78×38px < 40px | 已清除 |
| dex-detail | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button#cm-dex-conditions-1-2-toggle.cm-dex-conditions__toggle「條件」 78×38px < 40px | 已清除 |
| dex-detail | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button#cm-dex-conditions-1-3-toggle.cm-dex-conditions__toggle「條件」 78×38px < 40px | 已清除 |
| dex-detail | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action.cm-vs2-database__close「關閉」 48×24px < 40px | 已清除 |
| dex-detail | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-showcase-cta.cm-showcase-cta--special「🎬 預覽必殺技」 68×22px < 40px | 已清除 |
| dex-detail | G4 連線 | UNREACHABLE | 844 | button.cm-showcase-toggle__option「高清立繪」 不在畫面內 | 已清除 |
| dex-element-chart | G2 裁切 | CLIPPED | 667 | g「土」 被 body 切掉 87% | 已清除 |
| dex-element-chart | G4 連線 | NO_EXIT | 667 | button.cm-element-chart__close「關閉」 不在畫面內 | 已清除 |
| dex-element-chart-closed | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-vs2-action.cm-vs2-database__close「關閉」 伸進右側瀏海安全區 | 已清除 |
| dex-evolution | G1 重疊 | HUD_OVERLAP | 375、667 | overlay（section.cm-showcase__frame「模擬展演 火甲龍 → 熔岩龍 ✕ 進化する 進化」）⟂ status（span.cm-status-bar__season「春季」） | 已清除 |
| dex-evolution | G1 重疊 | HUD_OVERLAP | 375、667 | overlay（section.cm-showcase__frame「模擬展演 火甲龍 → 熔岩龍 ✕ 進化する 進化」）⟂ status（span.cm-status-bar__day「第 1 日」） | 已清除 |
| dex-evolution | G1 重疊 | HUD_OVERLAP | 375、844、667 | overlay（section.cm-showcase__frame「模擬展演 火甲龍 → 熔岩龍 ✕ 進化する 進化」）⟂ status（time.cm-status-bar__time「07:05」） | 已清除 |
| dex-evolution | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-showcase__close「✕」 24×24px < 40px | 已清除 |
| dex-evolution-closed | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-vs2-action.cm-vs2-database__close「關閉」 伸進右側瀏海安全區 | 已清除 |
| dex-exit | G2 裁切 | LABEL_WRAP | 390、375、844 | 「蛋白質」被擠成 2 行 | 已清除 |
| dex-exit | G2 裁切 | LABEL_WRAP | 844 | 「管理」被擠成 2 行 | 已清除 |
| dex-exit | G2 裁切 | LABEL_WRAP | 844、667 | 「商店」被擠成 2 行 | 已清除 |
| dex-exit | G1 重疊 | TEXT_OVERLAP | 844 | 文字互相重疊：span.cm-toolbar__cell-label「蛋白質」 ⟂ span.cm-toolbar__stock「90」 | 已清除 |
| dex-list | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-database__chip「全部階段」 53×24px < 40px | 已清除 |
| dex-list | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action「返回牧場」 66×24px < 40px | 已清除 |
| dex-motion | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-vs2-action.cm-vs2-database__close「關閉」 伸進右側瀏海安全區 | 已清除 |
| dex-motion | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button.cm-showcase-toggle__option「高清立繪」 138×30px < 40px | 已清除 |
| dex-motion | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button.cm-showcase-cta.cm-showcase-cta--evolution「✨ 進化預覽」 107×38px < 40px | 已清除 |
| dex-motion | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button.cm-element-chart-button「屬性相剋表」 104×38px < 40px | 已清除 |
| dex-motion | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button#cm-dex-conditions-1-0-toggle.cm-dex-conditions__toggle「條件」 78×38px < 40px | 已清除 |
| dex-motion | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button#cm-dex-conditions-1-1-toggle.cm-dex-conditions__toggle「條件」 78×38px < 40px | 已清除 |
| dex-motion | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button#cm-dex-conditions-1-2-toggle.cm-dex-conditions__toggle「條件」 78×38px < 40px | 已清除 |
| dex-motion | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button#cm-dex-conditions-1-3-toggle.cm-dex-conditions__toggle「條件」 78×38px < 40px | 已清除 |
| dex-motion | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action.cm-vs2-database__close「關閉」 48×24px < 40px | 已清除 |
| dex-motion | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-showcase-motion__turn「↻ 轉向」 35×22px < 40px | 已清除 |
| dex-motion | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-showcase-motion__action[data-action="stand"]「待機」 28×22px < 40px | 已清除 |
| dex-motion | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-showcase-motion__action[data-action="walk"]「散步」 28×22px < 40px | 已清除 |
| dex-motion | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-showcase-motion__action[data-action="attack"]「攻擊」 28×22px < 40px | 已清除 |
| dex-motion | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-showcase-motion__action[data-action="cheer"]「歡呼」 28×22px < 40px | 已清除 |
| dex-motion | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-showcase-cta.cm-showcase-cta--special「🎬 預覽必殺技」 68×22px < 40px | 已清除 |
| dex-motion | G4 連線 | UNREACHABLE | 844 | button.cm-showcase-motion__action[data-action="stand"]「待機」 不在畫面內 | 已清除 |
| dex-motion | G4 連線 | UNREACHABLE | 844 | button.cm-showcase-motion__action[data-action="walk"]「散步」 不在畫面內 | 已清除 |
| dex-motion | G4 連線 | UNREACHABLE | 844 | button.cm-showcase-motion__action[data-action="attack"]「攻擊」 不在畫面內 | 已清除 |
| dex-motion | G4 連線 | UNREACHABLE | 844 | button.cm-showcase-motion__action[data-action="cheer"]「歡呼」 不在畫面內 | 已清除 |
| dex-motion | G4 連線 | UNREACHABLE | 844 | button.cm-showcase-motion__turn「↻ 轉向」 不在畫面內 | 已清除 |
| dex-special | G1 重疊 | HUD_OVERLAP | 375、667 | overlay（section.cm-showcase__frame「模擬展演 火甲龍 · 烈鎧焰砲 ✕ 訓練標靶 4」）⟂ status（span.cm-status-bar__season「春季」） | 已清除 |
| dex-special | G1 重疊 | HUD_OVERLAP | 375、667 | overlay（section.cm-showcase__frame「模擬展演 火甲龍 · 烈鎧焰砲 ✕ 訓練標靶 4」）⟂ status（span.cm-status-bar__day「第 1 日」） | 已清除 |
| dex-special | G1 重疊 | HUD_OVERLAP | 375、844、667 | overlay（section.cm-showcase__frame「模擬展演 火甲龍 · 烈鎧焰砲 ✕ 訓練標靶 4」）⟂ status（time.cm-status-bar__time「07:05」） | 已清除 |
| dex-special | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-showcase__close「✕」 24×24px < 40px | 已清除 |
| dex-special-closed | G5 溢出／觸控 | SAFE_AREA | 844 | button.cm-vs2-action.cm-vs2-database__close「關閉」 伸進右側瀏海安全區 | 已清除 |
| dex-stage-3 | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-database__chip「全部階段」 53×24px < 40px | 已清除 |
| dex-stage-3 | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action「返回牧場」 66×24px < 40px | 已清除 |
| dex-stage-6 | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-database__chip「全部階段」 53×24px < 40px | 已清除 |
| dex-stage-6 | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action「返回牧場」 66×24px < 40px | 已清除 |

#### S4 狩獵／對戰／Data Arena：修改前偵測到的問題（42 類）

| 畫面狀態 | 關卡 | 代碼 | 視口 | 偵測內容（範例） | 修改後 |
|---|---|---|---|---|---|
| arena-exit | G1 重疊 | TEXT_OVERLAP | 390、375 | 文字互相重疊：span.cm-vs5-match__fee「報名費 5,100 位元幣」 ⟂ span.cm-vs5-match__payout「獎金 200,000 位元幣」 | 已清除 |
| arena-lobby | G4 連線 | STEP_FAILED | 844 | locator.waitFor: Timeout 15000ms exceeded. | 已清除 |
| arena-match | G1 重疊 | HUD_OVERLAP | 667 | resonance（div.cm-resonance-strip.da-hud__resonance「陣營共鳴 心輝守護」）⟂ wheel（button.da-tbtn.da-tbtn--switch「換角 後備」） | 已清除 |
| arena-match | G1 重疊 | TEXT_OVERLAP | 667 | 文字互相重疊：span.cm-resonance-strip__title「陣營共鳴」 ⟂ span.da-tbtn__label「換角」 | 已清除 |
| arena-pause | G4 連線 | NO_EXIT | 667 | button.da-btn.da-btn--quiet「離開競技場」 不在畫面內 | 已清除 |
| battle-brag-card | G4 連線 | NO_EXIT | 1366、667 | button.cm-dialog__action.cm-dialog__action--primary[data-action="done"]「完成」 不在畫面內 | 已清除 |
| battle-exit | G2 裁切 | LABEL_WRAP | 390、375 | 「蛋白質」被擠成 2 行 | 已清除 |
| battle-exit | G2 裁切 | LABEL_WRAP | 667 | 「商店」被擠成 2 行 | 已清除 |
| battle-free | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs5-cube__face「冠軍賽」 50×24px < 40px | 已清除 |
| battle-free | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs5-action.cm-vs5-exit「返回牧場」 66×24px < 40px | 已清除 |
| battle-link-lobby | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs5-action.cm-vs5-action--primary[data-action="create-code"]「產生邀請碼」 194×24px < 40px | 已清除 |
| battle-link-lobby | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs5-action.cm-vs5-action--primary[data-action="start-local"]「已交換通訊碼，開始本機重播」 194×24px < 40px | 已清除 |
| battle-menu | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs5-cube__face「冠軍賽」 50×24px < 40px | 已清除 |
| battle-menu | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs5-action.cm-vs5-exit「返回牧場」 66×24px < 40px | 已清除 |
| battle-menu | G1 重疊 | TEXT_OVERLAP | 390、375 | 文字互相重疊：span.cm-vs5-match__fee「報名費 5,100 位元幣」 ⟂ span.cm-vs5-match__payout「獎金 200,000 位元幣」 | 已清除 |
| battle-password-lobby | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs5-action.cm-vs5-action--primary[data-action="create-password"]「產生密碼」 194×24px < 40px | 已清除 |
| battle-password-lobby | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs5-action.cm-vs5-action--primary「開始密碼對戰」 105×24px < 40px | 已清除 |
| battle-result | G1 重疊 | HUD_OVERLAP | 1920、1366 | brag（button.cm-brag-cta.cm-brag-cta--result[data-online-action="brag-card"]「📸 生成炫耀名片（分享至 FB / Disco」）⟂ next（b | 已清除 |
| battle-result | G1 重疊 | OVERLAP | 1920、1366 | button.cm-brag-cta.cm-brag-cta--result[data-online-action="brag-card"]「📸 生成炫耀名片（分享至 FB / Disco」 ⟂ button.cm-v | 已清除 |
| battle-result-last | G1 重疊 | OVERLAP | 1920、1366 | button.cm-brag-cta.cm-brag-cta--result[data-online-action="brag-card"]「📸 生成炫耀名片（分享至 FB / Disco」 ⟂ button.cm-v | 已清除 |
| battle-result-page | G1 重疊 | OVERLAP | 1920、1366 | button.cm-brag-cta.cm-brag-cta--result[data-online-action="brag-card"]「📸 生成炫耀名片（分享至 FB / Disco」 ⟂ button.cm-v | 已清除 |
| battle-team | G4 連線 | STEP_FAILED | 844 | locator.click: Timeout 15000ms exceeded. | 已清除 |
| battle-team | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs5-action.cm-vs5-action--primary「決定」 105×24px < 40px | 已清除 |
| battle-team | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs5-action「迪吉歐 這隻夥伴還太幼小，暫時無法參賽。」 194×25px < 40px | 已清除 |
| hunt-exit | G2 裁切 | LABEL_WRAP | 390、375、844 | 「蛋白質」被擠成 2 行 | 已清除 |
| hunt-exit | G2 裁切 | LABEL_WRAP | 844 | 「管理」被擠成 2 行 | 已清除 |
| hunt-exit | G2 裁切 | LABEL_WRAP | 844、667 | 「商店」被擠成 2 行 | 已清除 |
| hunt-exit | G1 重疊 | TEXT_OVERLAP | 844 | 文字互相重疊：span.cm-toolbar__cell-label「蛋白質」 ⟂ span.cm-toolbar__stock「90」 | 已清除 |
| hunt-field | G5 溢出／觸控 | TARGET_SMALL | 667 | 繩索切換「⇄」實際觸控熱區 26×23px < 40px | 已清除 |
| hunt-field | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action「手」 28×31px < 40px | 已清除 |
| hunt-field | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action.cm-vs2-hud__exit「返回牧場」 53×24px < 40px | 已清除 |
| hunt-gate-selected | G2 裁切 | LABEL_WRAP | 667 | 「場地列表」被擠成 4 行 | 已清除 |
| hunt-gate-selected | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action「返回牧場」 66×24px < 40px | 已清除 |
| hunt-gate-selected | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action.cm-vs2-action--primary「前往狩獵設定」 121×24px < 40px | 已清除 |
| hunt-gate-selected | G1 重疊 | TEXT_OVERLAP | 667 | 文字互相重疊：button.cm-vs2-action.cm-vs2-gate3d__toggle「場地列表」 ⟂ p.cm-vs2-gate3d__hint「拖曳轉動 · 輕觸地點選擇」 | 已清除 |
| hunt-gates | G2 裁切 | LABEL_WRAP | 667 | 「場地列表」被擠成 4 行 | 已清除 |
| hunt-gates | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action「返回牧場」 66×24px < 40px | 已清除 |
| hunt-gates | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action.cm-vs2-action--primary「前往狩獵設定」 121×24px < 40px | 已清除 |
| hunt-gates | G1 重疊 | TEXT_OVERLAP | 667 | 文字互相重疊：button.cm-vs2-action.cm-vs2-gate3d__toggle「場地列表」 ⟂ p.cm-vs2-gate3d__hint「拖曳轉動 · 輕觸地點選擇」 | 已清除 |
| hunt-loadout | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action「返回選場」 66×24px < 40px | 已清除 |
| hunt-loadout | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-action.cm-vs2-action--primary「開始狩獵」 121×24px < 40px | 已清除 |
| hunt-loadout | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-vs2-loadout__option「基礎捕捉繩 α 耐久度 6」 95×33px < 40px | 已清除 |

#### S5 故事／執照／社群：修改前偵測到的問題（41 類）

| 畫面狀態 | 關卡 | 代碼 | 視口 | 偵測內容（範例） | 修改後 |
|---|---|---|---|---|---|
| friends | G4 連線 | NO_EXIT | 375、844、667 | button.cm-dialog__action.cm-dialog__action--secondary[data-action="close"]「關閉」 不在畫面內 | 已清除 |
| friends | G5 溢出／觸控 | TARGET_SMALL | 375 | button.cm-online__button.cm-online__button--primary「➕ 新增好友」 34×116px < 40px | 已清除 |
| friends-closed | G2 裁切 | LABEL_WRAP | 390、375、844 | 「蛋白質」被擠成 2 行 | 已清除 |
| friends-closed | G2 裁切 | LABEL_WRAP | 844 | 「管理」被擠成 2 行 | 已清除 |
| friends-closed | G2 裁切 | LABEL_WRAP | 844、667 | 「商店」被擠成 2 行 | 已清除 |
| friends-closed | G1 重疊 | TEXT_OVERLAP | 844 | 文字互相重疊：span.cm-toolbar__cell-label「蛋白質」 ⟂ span.cm-toolbar__stock「90」 | 已清除 |
| passport-closed | G2 裁切 | LABEL_WRAP | 390、375、844 | 「蛋白質」被擠成 2 行 | 已清除 |
| passport-closed | G2 裁切 | LABEL_WRAP | 844 | 「管理」被擠成 2 行 | 已清除 |
| passport-closed | G2 裁切 | LABEL_WRAP | 844、667 | 「商店」被擠成 2 行 | 已清除 |
| passport-closed | G1 重疊 | TEXT_OVERLAP | 844 | 文字互相重疊：span.cm-toolbar__cell-label「蛋白質」 ⟂ span.cm-toolbar__stock「90」 | 已清除 |
| story-closed | G2 裁切 | LABEL_WRAP | 390、375、844 | 「蛋白質」被擠成 2 行 | 已清除 |
| story-closed | G2 裁切 | LABEL_WRAP | 844 | 「管理」被擠成 2 行 | 已清除 |
| story-closed | G2 裁切 | LABEL_WRAP | 844、667 | 「商店」被擠成 2 行 | 已清除 |
| story-closed | G1 重疊 | TEXT_OVERLAP | 844 | 文字互相重疊：span.cm-toolbar__cell-label「蛋白質」 ⟂ span.cm-toolbar__stock「90」 | 已清除 |
| story-dialogue | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button.cm-story-vn__control.cm-story-vn__control--log「📜 觀測紀錄」 93×32px < 40px | 已清除 |
| story-dialogue | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button.cm-story-vn__control「自動」 50×32px < 40px | 已清除 |
| story-dialogue | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button.cm-story-vn__control.cm-story-vn__control--skip「⏭ 跳過劇情」 87×32px < 40px | 已清除 |
| story-log | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button.cm-story-vn__control.cm-story-vn__control--log「📜 觀測紀錄」 93×32px < 40px | 已清除 |
| story-log | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button.cm-story-vn__control「自動」 50×32px < 40px | 已清除 |
| story-log | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button.cm-story-vn__control.cm-story-vn__control--skip「⏭ 跳過劇情」 87×32px < 40px | 已清除 |
| story-log | G1 重疊 | TEXT_OVERLAP | 390、375 | 文字互相重疊：p.cm-story-vn__line「飼育籠的午後很安靜。安靜得，有一點不對勁。」 ⟂ p.cm-story-vn__log-title「📜 觀測紀錄」 | 已清除 |
| story-log | G1 重疊 | TEXT_OVERLAP | 390、375 | 文字互相重疊：p.cm-story-vn__line「飼育籠的午後很安靜。安靜得，有一點不對勁。」 ⟂ span.cm-story-vn__log-text「飼育籠的午後很安靜。安靜得，有一點不對勁。」 | 已清除 |
| story-map | G4 連線 | SILENT_REFUSAL | 1920 | 選單「故事章節」點了沒有任何畫面或提示（入口被靜默拒絕） | 已清除 |
| story-map | G5 溢出／觸控 | TARGET_SMALL | 1920、1366、390、375、844、667 | button.cm-story-map__node「幕間 第一次共鳴」 36×36px < 40px | 已清除 |
| story-map | G5 溢出／觸控 | TARGET_SMALL | 844、667 | button.cm-story-map__close「返回牧場」 84×36px < 40px | 已清除 |
| story-play | G4 連線 | REFUSED | 390 | 「開始觀測」被拒絕（星圖顯示提示） | 已清除 |
| tamer | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-screen-back.cm-tamer-back「返回牧場」 67×24px < 40px | 已清除 |
| tamer | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-brag-cta.cm-arcade-key[data-online-action="brag-card"]「📸 生成炫耀名片（分享至 FB / Disco」 194×26px < 40px | 已清除 |
| tamer | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-online__button.cm-online__button--primary[data-online-action="open-friends"]「👥 好友與馴獸師名片」 91×24px <  | 已清除 |
| tamer | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-online__button[data-online-action="open-account"]「☁️ 帳號與雲端同步」 84×24px < 40px | 已清除 |
| tamer | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-online__button.cm-online__button--ghost[data-online-action="copy"]「複製」 34×22px < 40px | 已清除 |
| tamer | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-passport__provider.cm-arcade-key[data-online-action="bind-google"][data-provider="google"]「G 綁定 / 登入 | 已清除 |
| tamer | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-passport__provider.cm-arcade-key[data-online-action="bind-facebook"][data-provider="facebook"]「f 綁定  | 已清除 |
| tamer | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-passport__provider.cm-arcade-key[data-online-action="bind-discord"][data-provider="discord"]「🎮 綁定 / | 已清除 |
| tamer | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-online__button.cm-online__button--primary[data-online-action="transferCode"]「產生 6 碼引繼碼」 72×24px < 40 | 已清除 |
| tamer | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-online__button[data-online-action="redeemCode"]「輸入引繼碼」 56×24px < 40px | 已清除 |
| tamer | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-online__button[data-online-action="signInEmail"]「✉️ Email 驗證碼登入」 92×24px < 40px | 已清除 |
| tamer | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-online__button.cm-online__button--ghost[data-online-action="bindEmail"]「綁定 Email 升級正式帳號」 104×22px <  | 已清除 |
| tamer | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-online__button.cm-online__button--primary[data-online-action="backupNow"]「立即雲端備份」 64×24px < 40px | 已清除 |
| tamer | G5 溢出／觸控 | TARGET_SMALL | 667 | button.cm-online__button[data-online-action="restoreCloud"]「從雲端還原」 56×24px < 40px | 已清除 |
| tamer-brag-card | G4 連線 | NO_EXIT | 1366、844、667 | button.cm-dialog__action.cm-dialog__action--primary[data-action="done"]「完成」 不在畫面內 | 已清除 |

#### 修改後仍存在的項目（1 類）

| 切片 | 畫面狀態 | 代碼 | 視口 | 內容 |
|---|---|---|---|---|
| 1 | opening-story | SAFE_AREA | 844 | button.cm-cutscene__skip「⏭ 跳過序章」 伸進右側瀏海安全區 |

#### 《未被聽見的回聲》分支（只讀掃描，9 類）

| 畫面狀態 | 代碼 | 視口 | 內容 |
|---|---|---|---|
| echoes-dialogue | NO_EXIT | 1920、1366、390、375、844、667 | [data-da-action="skip"] 不存在或不可見 |
| echoes-hub | TEXT_OVERLAP | 1366 | 文字互相重疊：span.cm-da-daily__label「拍檔的小日常」 ⟂ span「艾瑪金屬碎片 ×2」 |
| echoes-chapter | TEXT_OVERLAP | 1366 | 文字互相重疊：span.cm-da-daily__label「拍檔的小日常」 ⟂ span「艾瑪金屬碎片 ×2」 |
| echoes-chapter | UNREACHABLE | 390、375、844、667 | button.cm-da-play「潛入 Data Area」 不在畫面內 |
| echoes-hub | SAFE_AREA | 844 | button.cm-da-hub__close「返回」 伸進右側瀏海安全區 |
| echoes-hub | SAFE_AREA | 844 | button.cm-da-tab「章節」 伸進左側瀏海安全區 |
| echoes-chapter | SAFE_AREA | 844 | button.cm-da-hub__close「返回」 伸進右側瀏海安全區 |
| echoes-chapter | SAFE_AREA | 844 | button.cm-da-tab「章節」 伸進左側瀏海安全區 |
| echoes-dialogue | SAFE_AREA | 844 | button.cm-da-chip「自動」 伸進右側瀏海安全區 |

## 9. 變更檔案

產品（只動版面、樣式與兩處互動時序，不改玩法、存檔、數值）：

| 檔案 | 內容 |
|---|---|
| `src/championship/app/portraitFrame.js` | 新增 `COMPACT_LANDSCAPE_MIN_WIDTH = 640`，橫向選單與設施配置的門檻 720→640px |
| `src/championship/app/huntLayoutResolver.js` | 狩獵橫向版型沿用同一個 640px 門檻 |
| `src/championship/app/raisingHomeP1RView.js` | 夥伴卡出現時，攔下「卡片本身沒被按下」的那一次觸控殘留 click（不使用計時器） |
| `src/championship/app/ranchDiscoveryJournal.js` | 發布 `--cm-journal-clear`，讓桌機夥伴卡從手帳鍵下方起算 |
| `src/championship/app/main.js` | 故事入口與「開始觀測」等待牧場就緒最多 4 秒；仍被拒時顯示提示（不再靜默）；等待後再檢查一次，兩次呼叫不會同時開兩個章節 |
| `src/championship/app/ui/screenLayout.css` | 商店詳情、圖鑑矮橫向雙欄、設施配置、夥伴卡與通知列、牧場選單、對話框黏底按鍵、對戰選單（直向與矮橫向）等 |
| `src/championship/app/ui/arcade.css` | 8 鍵工具列（直向／橫向）、快捷鍵 40px、窄賽事卡分行 |
| `src/championship/app/cyberGacha.css` | 商店徽章、轉蛋機、10 連抽、合成爐、晶片背包的矮橫向與窄螢幕版面 |
| `src/championship/app/onboarding.css` | 執照、孵化器、蛋命名的矮橫向雙欄（序章與信件不變） |
| `src/championship/app/vs2Styles.css` | 橫向隊伍編成名單保留內容高度 |
| `src/championship/app/vs5Styles.css` | 640px 起的橫向手機就用雙欄對戰選單 |
| `src/championship/app/dataArena.css` | 矮橫向暫停面板兩兩一列 |
| `src/championship/app/ui/taxonomy.css` | 相剋表安全區與尺寸、按鈕 40px；陣營共鳴避開換角鍵與瀏海 |
| `src/championship/app/ui/storyTheater.css` | 對話控制鍵 40px、紀錄開啟時隱藏台詞、星圖節點 40px 觸控區 |
| `src/championship/app/ui/juicyShowcase.css` | 展演切換與進化鍵 40px；展演框從狀態列下方開始 |
| `src/championship/app/ui/online.css` | 新增好友列不折行；好友抽屜次要鍵與說明字改用主題墨色 |
| `src/championship/app/ui/social.css` | 結算頁炫耀名片按鍵下方留白 |
| `src/championship/app/intRh2Styles.css` | 夥伴詳情「收合」不折行 |

工具與測試：

| 檔案 | 內容 |
|---|---|
| `scripts/qa/run-full-viewport-health-check.cjs`、`viewport-health-rules.cjs`、`viewport-health-probe.cjs`、`viewport-health-slices.cjs` | 新的六視口健檢腳本 |
| `scripts/qa/title-zero-diff.cjs` | 標題／主選單／開場序章／信件的計算樣式零差異比對；直向與橫向手機套用與健檢相同的瀏海與 Home 條安全區 |
| `docs/contracts/championship/WEB_BUILD_INPUTS.v1.json`、`PUBLIC_RUNTIME_ALLOWLIST.v1.json` | 本批 18 個已發佈檔案的 sha256 改為新位元組（不增減檔案） |
| `docs/coordination/OWNER_DIRECTION.md` | 本批的 Owner 指示紀錄 `FULL_VIEWPORT_HEALTH_CHECK_20261101` |
| `tests/championship-viewport-health-rules-cases.mjs` | 新單元測試（19 項），已登記於 `tests/ci-test-scope.v1.json` |
| `tests/championship-compact-landscape-menu-cases.mjs`、`championship-cage-landscape-cases.mjs`、`championship-desktop-raising-cases.mjs` | 新門檻的邊界案例（640×320、667×375 為橫向；639×320 仍為直向框） |
| `tests/championship-responsive-layout-browser.cjs` | 狩獵橫向門檻算式同步為 640px |
