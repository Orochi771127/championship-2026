# 中英術語表（設定回合，2026-09-29）

本表直接讀取遊戲內的對照表產生（`src/championship/text/zhHant.js`、`gameText.en.js`、`uiText.js`、`uiText.en.js`；最後更新 2026-10-04），內容與出貨程式一致。英文是 `PRODUCT_AUTHORED` 譯文，尚未經英文母語編輯審稿。

## 原則

- **來源字串就是鍵。** 介面以繁中原文為鍵查英文（gettext 式）；同一個繁中字在不同位置意思不同時用語境鍵 `語境|原文`，例如 `state|關閉` → Off、`menu|資料` → Reference、`chip|頭銜賽` → Titles。
- **專有名詞保留核可的繁中名稱。** 數碼寶貝種名、起始角色的自動名、人名「浩司」「惠子」，以及引號中的隊伍名與人名，目前沒有核可的英文形式，英文介面照樣顯示繁中名稱（`UNTRANSLATED_PROPER_NOUNS`），不算缺譯。
- **世代名稱採字面直譯，待 Owner 決定。** Digi-Egg／Baby I／Baby II／Child／Adult／Perfect／Ultimate 是日文原名的直譯；系列另有 In-Training／Rookie／Champion／Ultimate／Mega 等慣例，選哪一套是 Owner 的決定，本輪不代為選擇。
- **地名依片假名轉寫。** 傳送門與地圖名稱由原作片假名轉寫為英文（例如 Dyna Grassland、Dolbi Plant、Critical Ruins），不另創新名。
- **數字與日期依語系格式化。** 英文用 en-GB 日期與千分位，繁中用 zh-Hant-TW；英文複數用 `{one, other}`。
- **缺譯一律退回繁中並記錄。** 執行時查不到英文會顯示繁中原文並記入 `listMissingTranslations()`，不顯示鍵名或空白。覆蓋率由 `node scripts/check-locale-coverage.mjs` 檢查。


## 遊戲用語


### 世代

| # | 繁中 | English |
|---|---|---|
| 0 | 數碼蛋 | Digi-Egg |
| 1 | 幼年期Ⅰ | Baby I |
| 2 | 幼年期Ⅱ | Baby II |
| 3 | 成長期 | Child |
| 4 | 成熟期 | Adult |
| 5 | 完全體 | Perfect |
| 6 | 究極體 | Ultimate |

### 個性

| # | 繁中 | English |
|---|---|---|
| 0 | 坦率 | Honest |
| 1 | 任性 | Selfish |
| 2 | 急躁 | Impatient |
| 3 | 悠閒 | Easygoing |
| 4 | 熱血 | Passionate |
| 5 | 冷靜 | Calm |
| 6 | 大膽 | Bold |
| 7 | 膽小 | Timid |
| 8 | ？？？ | ??? |

### 系別（名冊）

| # | 繁中 | English |
|---|---|---|
| 0 | 無 | None |
| 1 | 獸 | Beast |
| 2 | 機械 | Machine |
| 3 | 昆蟲植物 | Insect & Plant |
| 4 | 鳥 | Bird |
| 5 | 龍 | Dragon |
| 6 | 水 | Aquatic |
| 7 | 聖 | Holy |
| 8 | 暗黑 | Dark |

### 馴獸師階級

| # | 繁中 | English |
|---|---|---|
| 0 | 綠階 | Green |
| 1 | 藍階 | Blue |
| 2 | 紅階 | Red |
| 3 | 白階 | White |
| 4 | 青銅 | Bronze |
| 5 | 白銀 | Silver |
| 6 | 黃金 | Gold |
| 7 | 白金 | Platinum |
| 8 | 冠軍 | Champion |
| 9 | 大師 | Master |

### 特殊技能

| # | 繁中 | English |
|---|---|---|
| 0 | 無 | None |
| 1 | 挑釁 | Taunt |
| 2 | 治癒 α | Heal α |
| 3 | 治癒 β | Heal β |
| 4 | 治癒 γ | Heal γ |
| 5 | 全體治癒 α | Heal All α |
| 6 | 全體治癒 β | Heal All β |
| 7 | 全體治癒 γ | Heal All γ |
| 8 | 淨化 | Cleanse |
| 9 | 全體淨化 | Cleanse All |
| 10 | 強化攻擊 | Power Up |
| 11 | 全體強化攻擊 | Power Up All |
| 12 | 防護 | Guard |
| 13 | 全體防護 | Guard All |
| 14 | 加速 | Speed Up |
| 15 | 全體加速 | Speed Up All |
| 16 | 感知 | Sense |
| 17 | 全體感知 | Sense All |
| 18 | 耐火 | Fireproof |
| 19 | 全體耐火 | Fireproof All |
| 20 | 耐水 | Waterproof |
| 21 | 全體耐水 | Waterproof All |
| 22 | 耐雷 | Thunderproof |
| 23 | 全體耐雷 | Thunderproof All |
| 24 | 耐光 | Lightproof |
| 25 | 全體耐光 | Lightproof All |
| 26 | 耐暗 | Darkproof |
| 27 | 全體耐暗 | Darkproof All |
| 28 | 復活 α | Revive α |
| 29 | 復活 β | Revive β |
| 30 | 勇氣 | Courage |

### 模式

| 鍵 | 繁中 | English |
|---|---|---|
| RAISING | 育成 | Raising |
| BATTLE | 對戰 | Battle |
| HUNT | 狩獵 | Hunt |
| SHOP | 商店 | Shop |

### 能力值

| 鍵 | 繁中 | English |
|---|---|---|
| HP | 生命值 | HP |
| TP | 技力 | TP |
| ATTACK | 攻擊 | Attack |
| DEFENSE | 防禦 | Defense |
| WISDOM | 智力 | Wisdom |
| SPEED | 速度 | Speed |

### 抗性

| 原作鍵 | 繁中 | English |
|---|---|---|
| ねつ | 耐熱 | Heat resistance |
| さむさ | 耐寒 | Cold resistance |
| かみなり | 耐雷 | Thunder resistance |
| ひかり | 耐光 | Light resistance |
| やみ | 耐暗 | Dark resistance |

### 屬性與系別標籤

| 原作鍵 | 繁中 | English |
|---|---|---|
| ワクチン | 疫苗 | Vaccine |
| データ | 資料 | Data |
| リュウ | 龍 | Dragon |
| ケモノ | 獸 | Beast |
| ミズ | 水 | Aquatic |
| トリ | 鳥 | Bird |
| キカイ | 機械 | Machine |
| セイ | 聖 | Holy |
| ムシクサ | 蟲草 | Insect & Plant |
| アンコク | 暗黑 | Dark |
| ウイルス | 病毒 | Virus |

### 設施

| # | 繁中 | English |
|---|---|---|
| 0 | 空地 | Vacant Lot |
| 1 | 運動場 | Sports Ground |
| 2 | 競技場 | Arena |
| 3 | 道場 | Dojo |
| 4 | 健身房 | Gym |
| 5 | 研究所 | Laboratory |
| 6 | 火山 | Volcano |
| 7 | 草原 | Grassland |
| 8 | 海灘 | Beach |
| 9 | 高山 | Mountain |
| 10 | 森林 | Forest |
| 11 | 叢林 | Jungle |
| 12 | 神殿 | Sanctuary |
| 13 | 墓地 | Graveyard |
| 14 | 工廠 | Factory |
| 15 | 小保健室 | Mini Infirmary |
| 16 | 醫院 | Hospital |
| 17 | 花園 | Flower Garden |
| 18 | 溫泉 | Hot Spring |
| 19 | 沙漠 | Desert |
| 20 | 冰原 | Ice Field |
| 21 | 發電廠 | Power Plant |
| 22 | 毒氣室 | Gas Room |
| 23 | 寺廟 | Temple |
| 24 | 動物園 | Zoo |
| 25 | 牧場 | Ranch |
| 26 | 擂台 | Ring |
| 27 | 小運動場 | Mini Sports Ground |
| 28 | 保健室 | Infirmary |
| 29 | 小花園 | Mini Garden |
| 30 | 小健身房 | Mini Gym |
| 31 | 小火山 | Mini Volcano |
| 32 | 小高山 | Mini Mountain |
| 33 | 小海灘 | Mini Beach |
| 34 | 洞窟 | Cave |
| 35 | 等候室 | Waiting Room |

### 設施效果

| 鍵 | 繁中 | English |
|---|---|---|
| STAT_UP:HP | 生命值上升 | HP up |
| STAT_UP:TP | 技力上升 | TP up |
| STAT_UP:ATTACK | 攻擊上升 | Attack up |
| STAT_UP:DEFENSE | 防禦上升 | Defense up |
| STAT_UP:SPEED | 速度上升 | Speed up |
| STAT_UP:WISDOM | 智力上升 | Wisdom up |
| STAT_UP:BATTLE_COUNT | 對戰次數上升 | Battle count up |
| RECOVER:HP_AND_STRESS | 回復生命值與壓力 | Recovers HP and stress |
| AUTO_CARE:FOOD_AND_DROPPINGS | 自動餵食與清潔 | Feeds and cleans automatically |

### 傳送門與地圖

| # | 繁中 | English |
|---|---|---|
| 0 | 戴納草原 | Dyna Grassland |
| 1 | 驅動莽原 | Drive Savanna |
| 2 | 模組之森 | Module Forest |
| 3 | 啟動叢林 | Boot Jungle |
| 4 | 黏滑沼澤 | Slimy Swamp |
| 5 | 波浪海岸 | Wave Coast |
| 6 | 南橋峽谷 | Southbridge Valley |
| 7 | 克隆礦坑 | Clone Mines |
| 8 | 杜比工廠 | Dolbi Plant |
| 9 | 下水道路 | Sewer Road |
| 10 | 雪之國度 | Snowland |
| 11 | 裂岩地帶 | Crack Rocks |
| 12 | 岩漿山脈 | Magma Mountain |
| 13 | 灼熱沙漠 | Scorching Desert |
| 14 | 澄澈綠洲 | Clear Oasis |
| 15 | 臨界遺跡 | Critical Ruins |
| 16 | 教學關卡 | Tutorial |

### 戰鬥選單與指令

| 鍵 | 繁中 | English |
|---|---|---|
| menu | 對戰選單 | Battle menu |
| kicker | 對戰 | Battle |
| chooseMatch | 選擇對戰 | Choose a match |
| faceNotice | 拖曳立方體或使用左右方向鍵選擇模式，再選擇參加的對戰。 | Drag the cube or use the left and right arrow keys to pick a mode, then choose a match to enter. |
| availableMatches | 目前可用的對戰 | Available matches |
| noMatch | 目前沒有開放的對戰。 | No matches are open right now. |
| match | 對戰 | Match |
| noPayout | 無獎金 | No prize |
| returnHome | 返回牧場 | Back to ranch |
| conference | 多輪賽事 | Multi-round events |
| CHAMPIONSHIP | 冠軍賽 | Championship |
| TITLE_MATCH | 頭銜賽 | Title Match |
| FREE_BATTLE | 自由對戰 | Free Battle |
| LINK_BATTLE | 通訊對戰 | Link Battle |
| PASSWORD_BATTLE | 密碼對戰 | Password Battle |
| PRACTICE_BATTLE | 練習對戰 | Practice Battle |

## 介面固定用語

| 繁中 | English |
|---|---|
| 滑動查看場地 | Swipe to look around |
| 待機區 | Waiting Room |
| 月井池 | Moonwell Pool |
| 靜謐谷地 | Quiet Hollow |
| 馴獸師階級 | Tamer rank |
| 報名費 | Entry fee |
| 耐久度 | Durability |
| 長度 | Length |
| 生命值分析 | HP analysis |
| 已收入記憶卡 | On the memory card |
| 記憶卡 | Memory card |
| 放生 | Release |
| 取消 | Cancel |
| 確認放生 | Confirm release |
| 記憶卡與育成夥伴名單 | Memory card and ranch partners |
| 確認放生 | Confirm release |
| 目前尚無法放生這隻數碼獸。 | This Digimon cannot be released yet. |
| 儲存失敗，數碼獸仍在記憶卡中。請再次返回育成基地以重試。 | Save failed. Your Digimon is still on the memory card. Head back to the ranch again to retry. |
| 育成夥伴名單已滿，數碼獸仍在記憶卡中。 | Your ranch is full. The Digimon stays on the memory card. |
| 設施占用的所有格位都必須為已開放的空格。 | Every hex a cage covers must be open and free. |
| 待機區固定在育成區入口。 | The Waiting Room stays at the ranch entrance. |
| 狩獵場地。拖曳空地移動視野，點選數碼獸進行選取。 | Hunt field. Drag open ground to look around. Tap a Digimon to select it. |
| 可旋轉的世界目的地視圖 | Rotatable world map |
| 世界目的地節點 | World regions |
| 數碼獸冠軍賽 · 2026 | Digimon Championship · 2026 |
| 育成基地 | Raising Home |
| 育成基地 | Raising Home |
| 育成 | Raising |
| 春季 | Spring |
| 夏季 | Summer |
| 秋季 | Autumn |
| 冬季 | Winter |
| 春季 | Spring |
| 夏季 | Summer |
| 秋季 | Autumn |
| 冬季 | Winter |
| 日 | Day |
| 結束今天 | End day |
| 結束今天 | End the day |
| 儲存 | Save |
| 返回 | Back |
| 返回牧場 | Back to ranch |
| 返回牧場 | Back to ranch |
| 繼續 | Continue |
| 下一頁 | Next |
| 離開 | Leave |
| 確認 | Confirm |
| 列表 | List |
| 商店 | Shop |
| 商店 | Shop |
| 狩獵 | Hunt |
| 狩獵 | Hunt |
| 對戰 | Battle |
| 對戰結果 | Battle result |
| 圖鑑 | Database |
| 圖鑑 | Database |
| 育成 | Raising |
| 設施配置 | Cage layout |
| 育成設施 | Cages |
| 育成用品 | Raising goods |
| 外掛程式 | Plug-ins |
| 數碼蛋 | Egg |
| 數碼蛋 | Eggs |
| 一般物種 | Regular species |
| 物種 | Species |
| 已登錄 | Registered |
| 初始夥伴 | Starter partner |
| 新品 | New |
| 已達上限 | Max held |
| 購買 | Buy |
| 尚未發現 | Undiscovered |
| 未知傳送門 | Unknown gate |
| 暱稱 | Nickname |
| 暱稱 | Nickname |
| 名稱 | Name |
| 種族 | Family |
| 世代 | Generation |
| 屬性編號 | Attribute no. |
| 未設定 | Not set |
| 生命值 | HP |
| 技力 | TP |
| 數碼獸 | Digimon |
| 數碼獸 | Digimon |
| 夥伴名單 | Partners |
| 更改名稱 | Rename |
| 移除 | Remove |
| 報名 | Enter |
| 馴獸師 | Tamer |
| 馴獸師 | Tamer |
| 馴獸師資料 | Tamer info |
| 賽程 | Schedule |
| 賽程 | Schedule |
| 頭銜賽 | Title matches |
| 編號 | No. |
| 說明 | Help |
| 說明 | Help |
| 設施配置 | Cage layout |
| 結束今天 | End day |
| 儲存並離開 | Save & quit |
| 管理 | Manage |
| 選單 | Menu |
| 設定 | Settings |
| 重試 | Retry |
| 保存中… | Saving… |
| 手掌 | Hand |
| 餵食 | Feed |
| 清潔 | Clean |
| 藥品 | Meds |
| 傷藥 | Salve |
| 蛋白質 | Protein |
| 移動或撫摸數碼獸 | Move a Digimon, or pet it |
| 在數碼獸身旁放置食物 | Put food next to a Digimon |
| 清除排泄物與剩餘食物 | Clear droppings and leftovers |
| 治療疾病 | Cure sickness |
| 治療傷勢 | Heal an injury |
| 暫時提升攻擊力 | Raise attack for a while |
| 目前場景工具列 | Toolbar |
| 此功能尚未開放 | Not available yet |
| 有尚未儲存的變更。 | Changes are waiting to be saved. |
| 育成狀態已更新。 | Raising is up to date. |
| 育成狀態已儲存。 | Raising saved. |
| 已讀取育成存檔。 | Raising loaded from your save. |
| 已復原最近一次有效的育成狀態。 | The last safe raising state was recovered. |
| 儲存未完成，請再試一次。 | The save did not finish. Please try again. |
| 育成狀態已更新。 | Raising updated. |
| 育成基地準備完成。 | Raising Home is ready. |
| 已讀取存檔。 | Saved game loaded. |
| 育成基地準備完成，點選數碼獸查看狀態。 | Raising Home is ready. Tap a Digimon to see how it is doing. |
| 育成時間 | Raising time |
| 育成活動場地 | Raising field |
| 育成場地 | Habitat |
| 場地已就緒 | Field ready |
| 夥伴狀態 | Partner status |
| 選擇數碼獸 | Select a Digimon |
| 點選場地中的數碼獸。 | Tap a Digimon in the habitat. |
| 點數碼獸看狀態 | Tap a Digimon to see its status |
| 工具列結構，指令尚待確認 | Toolbar layout; commands not yet confirmed |
| 育成工具列 · 模式一 | Raising toolbar · Mode 1 |
| 八格工具列 · 結構已驗證 | 8-slot toolbar · layout verified |
| 指令、圖示、子選單歸屬、啟用條件與第八格用途仍待確認。 | Commands, icons, submenu membership, enable conditions and the eighth slot are not yet confirmed. |
| 目前沒有數碼獸。 | No Digimon yet. |
| 夥伴名單是空的。 | Your partner list is empty. |
| 尚未選擇說明主題。 | No topic selected. |
| 尚未選擇賽事。 | No event selected. |
| 此欄位的資料來源尚待確認 | The source of this field is not yet confirmed |
| 購買育成用品、狩獵裝備、外掛程式與設施。 | Buy raising goods, hunt gear, plug-ins and cages. |
| 商品分類 | Shop categories |
| 購買成功。 | Purchased. |
| 持有金額不足。 | Not enough Bits. |
| 持有數量已達上限。 | You already hold the maximum. |
| 此商品尚未開放購買。 | That item is not on sale yet. |
| 無法購買此數量。 | That quantity cannot be bought. |
| 此分類目前沒有商品。 | Nothing in this category yet. |
| 圖鑑共有 224 格；解鎖篩選條件尚待確認。 | 224 entries in the Database. Unlock filters are not yet confirmed. |
| 圖鑑分類 | Database categories |
| 返回牧場 | Back to ranch |
| 返回圖鑑列表 | Back to the Database list |
| 此格屬於 224 格圖鑑，解鎖與篩選條件尚待確認。 | This entry is part of the 224-entry Database. Its unlock and filter conditions are not yet confirmed. |
| 由初始夥伴登錄，尚無狩獵帶回的個體。 | Registered through your starter partner. None brought back from a hunt yet. |
| 設施配置 | Cage layout |
| 每個六角格可放一座設施，隨階級開放 14 至 20 格。可以超過建議容納數，但數碼獸較容易累積壓力。 | One cage per hex. Your rank opens 14 to 20 hexes. You may go over the suggested capacity, but Digimon then build up stress more easily. |
| 育成區六角格 | Ranch hexes |
| 持有的設施 | Owned cages |
| 保留目前設施配置 | Keep this layout |
| 降低目前測試階級 | Lower the test rank |
| 提高目前測試階級 | Raise the test rank |
| 已放置。 | Placed. |
| 已從育成區移除。 | Removed from the ranch. |
| 已保留配置，請返回育成基地儲存。 | Layout kept. Head back to the ranch to save it. |
| 請先選擇設施。 | Select a cage first. |
| 此設施已在育成區中。 | That cage is already on the ranch. |
| 此格已有設施。 | That hex already has a cage. |
| 此格不在育成區內。 | That hex is outside the ranch. |
| 此格尚未開放。 | That hex is still locked. |
| 尚未持有此設施。 | You do not own that cage yet. |
| 所有持有的設施都已放入育成區。 | Every cage you own is on the ranch. |
| 選擇傳送門 | Choose a gate |
| 旋轉世界，選擇想前往的地區。 | Rotate the world and pick where to go. |
| 數碼世界傳送網路 | Digital World gate network |
| 世界視圖 | World view |
| 16 個地區連結 | 16 regions |
| 列表視圖 | List view |
| 世界視圖 | World view |
| 拖曳旋轉 · 點選地區 | Drag to rotate · Tap a region |
| 選擇地區 | Choose a region |
| 目的地 -- | Destination -- |
| 等待選擇 | Waiting |
| 已就緒 | Ready |
| 目的地資訊 | Destination info |
| 目的地 | Destination |
| 目的地列表 | Destinations |
| 低圖形需求模式 | Low-graphics mode |
| 可前往的地區 | Regions you can visit |
| 狩獵整備 | Hunt loadout |
| 出發準備 | Getting ready |
| 選擇裝備並安裝外掛程式。 | Choose your gear and fit your plug-ins. |
| 裝備種類 | Gear types |
| 外掛程式欄位 | Plug-in slots |
| 尚未持有 | None owned |
| 開始狩獵 | Start hunt |
| 繩索 | Rope |
| 射擊器 | Shooter |
| 攔阻線 | Wire |
| 誘捕裝置 | Lure |
| 傷害陷阱 | Damage trap |
| 耐久度 | Durability |
| 耐久度 | Durability |
| 長度 | Length |
| 長度 | Length |
| 彈藥 | Ammo |
| 數量 | Quantity |
| 狩獵場地 | Hunt field |
| 狩獵場地。點選數碼獸後畫圈，點選空地則會移動。 | Hunt field. Tap a Digimon, then draw a circle around it. Tap open ground to move. |
| 點選數碼獸後畫圈，點選空地則會移動。 | Tap a Digimon, then draw a circle. Tap open ground to move. |
| 尚未開放的場景控制 | Controls not available yet |
| 場景工具列 | Toolbar |
| 狩獵結果 | Hunt result |
| 已帶回育成基地 | Brought home |
| 狩獵 | Hunt |
| 取好名字後返回牧場，牠會在牧場等你。 | Give it a name, then head home. It will be waiting at the ranch. |
| 對戰時間 | Match time |
| 對戰紀錄 | Match record |
| 生命值 | HP |
| 行動資源 | Action gauge |
| 對戰場地，比賽會自動進行。 | Battle field. The match plays out on its own. |
| 對戰進行中。 | Match in progress. |
| 我方獲勝 | Your team wins |
| 對手獲勝 | Opponent wins |
| 雙方平手 | Draw |
| 尚未分出勝負 | Undecided |
| 進行中 | In progress |
| 時間到 | Time up |
| 一方全員倒下 | A team is down |
| 雙方都未取得領先。 | Neither side was ahead. |
| 獎金 | Prize |
| 此賽事設定的獎金。 | The prize set for this event. |
| 原作資料已驗證 | Verified from the original |
| 本作設定 | Set by this game |
| 一般場地 | Standard arena |
| 草原 | Grassland |
| 競技場 | Colosseum |
| 電腦空間 | Cyberspace |
| 沙漠 | Desert |
| 室內競技場 | Dome stadium |
| 地獄 | Inferno |
| 島嶼 | Island |
| 南極 | South Pole |
| 體育場 | Stadium |
| 火山 | Volcano |
| 找到存檔，但無法讀取。你仍可開始新遊戲。 | A saved game was found, but it could not be read. You can still start a new game. |
| 無法開啟此存檔，請開始新遊戲。 | That saved game could not be opened. Please start a new game. |
| 目前無法顯示場地，仍可使用畫面控制與儲存功能。 | The field view is unavailable right now. Screen controls and saving still work. |

## 介面詞彙（短詞）

從 `TEXT_EN` 取出六個字以內、不含標點的條目；完整句子不列於此。

| 繁中（含語境鍵） | English |
|---|---|
| 位元幣 | Bits |
| 返回牧場 | Back to ranch |
| 關閉 | Close |
| state\|關閉 | Off |
| 開啟 | On |
| state\|開啟 | On |
| 取消 | Cancel |
| 確認 | OK |
| 決定 | Confirm |
| 是 | Yes |
| 否 | No |
| 完成 | Done |
| 設定 | Settings |
| 管理 | Manage |
| 對戰 | Battle |
| 獎金 | Prize |
| 資料 | Data |
| menu\|資料 | Reference |
| 無 | None |
| 繁體中文 | 繁體中文 |
| 頭銜賽 | Title matches |
| chip\|頭銜賽 | Titles |
| 開始新遊戲 | New game |
| 繼續遊戲 | Continue |
| 開啟信件 | Open the letter |
| 信件 | Letter |
| 數位競技場 | Digital Arena |
| 保存中 | Saving |
| 已存到本機 | Saved on this device |
| 保存失敗 | Save failed |
| 遊戲狀態 | Game status |
| 再試一次 | Try again |
| 存檔狀態 | Save status |
| 知道了 | Got it |
| 夥伴與牧場 | Partners & ranch |
| 紀錄 | Records |
| 出發 | Go |
| 春季 | Spring |
| 夏季 | Summer |
| 秋季 | Autumn |
| 冬季 | Winter |
| 選取的數碼獸 | Selected Digimon |
| 詳細 | Details |
| 上一隻數碼獸 | Previous Digimon |
| 下一隻數碼獸 | Next Digimon |
| 取消選取 | Deselect |
| 收合詳細資料 | Close details |
| 收合 | Close |
| 夥伴名單 | Partners |
| 結束今天 | End today |
| 病毒 | Virus |
| 疫苗 | Vaccine |
| 龍 | Dragon |
| 獸 | Beast |
| 水 | Aquatic |
| 鳥 | Bird |
| 機械 | Machine |
| 聖 | Holy |
| 昆蟲植物 | Insect & Plant |
| 暗 | Dark |
| 耐熱 | Heat res. |
| 耐寒 | Cold res. |
| 耐雷 | Thunder res. |
| 耐暗 | Dark res. |
| 耐光 | Light res. |
| 飽足 | Fullness |
| 壓力 | Stress |
| 親密 | Affection |
| 友情 | Friendship |
| 疲勞 | Fatigue |
| 進化!! | Evolution!! |
| 熱 | Heat |
| 寒 | Cold |
| 雷 | Thunder |
| 光 | Light |
| 闇 | Dark |
| 暱稱 | Nickname |
| 容量 | Capacity |
| 攻擊 | Attack |
| 防禦 | Defense |
| 智力 | Wisdom |
| 速度 | Speed |
| 特殊技能Ⅰ | Special skill I |
| 特殊技能Ⅱ | Special skill II |
| 戰鬥次數 | Battles |
| 勝率 | Win rate |
| 退化次數 | Returns to Digi-Egg |
| 性格 | Personality |
| 抗性 | Resistance |
| 新的暱稱 | New nickname |
| 儲存名稱 | Save name |
| 系統 | System |
| 說明 | Help |
| 說明內容 | Help text |
| 未確認欄位 | Unconfirmed field |
| 賽事詳細 | Event details |
| 不限 | Any |
| 參賽階級 | Required rank |
| 持有金額 | Bits held |
| 已獲勝 | Won |
| 取消登錄 | Cancel registration |
| 登錄比賽 | Register |
| 登錄冠軍賽 | Register for the Championship |
| 世界大會 | World Championship |
| 冠軍大會 | Championship |
| 多輪賽事 | Multi-round events |
| 返回對戰選單 | Back to the Battle menu |
| 賽事結束 | Event over |
| 勝 | Won |
| 敗 | Lost |
| 結束賽事 | End event |
| 單隻對戰 | Single battle |
| 三隻對戰 | Three-Digimon battle |
| 通訊對戰 | Link Battle |
| 密碼對戰 | Password Battle |
| 練習對戰 | Practice Battle |
| 自由對戰 | Free Battle |
| 返回賽事 | Back to the event |
| 對戰模式 | Battle modes |
| 對戰場地 | Arena |
| 隨機場地 | Random arena |
| 返回賽事選擇 | Back to match selection |
| 開始練習 | Start practice |
| 開始密碼對戰 | Start Password Battle |
| 我的隊伍密碼 | My team password |
| 產生密碼 | Make password |
| 複製密碼 | Copy password |
| 建立邀請 | Create invite |
| 加入邀請 | Join invite |
| 邀請碼 | Invite code |
| 對方回覆碼 | Their reply code |
| 產生邀請碼 | Make invite code |
| 對方邀請碼 | Their invite code |
| 回覆碼 | Reply code |
| 產生回覆碼 | Make reply code |
| 進行中 | In progress |
| 時間到 | Time up |
| 一方全員倒下 | A team is down |
| 尚未分出勝負 | Undecided |
| 我方獲勝 | Your team wins |
| 對手獲勝 | Opponent wins |
| 雙方平手 | Draw |
| 對戰進行中 | Battle in progress |
| 離開對戰 | Leave battle |
| 繼續觀戰 | Keep watching |
| 獎金 + | Prize + |
| 馴獸師升階 | Tamer rank up |
| 取得頭銜 | Title earned |
| 戰績 | Record |
| 對戰場次 | Battles |
| 頭銜數 | Titles |
| 新解鎖 | Newly unlocked |
| 下一頁 | Next |
| 參賽數碼獸 | Participating Digimon |
| 輕觸畫面略過 | Tap to skip |
| 選擇狩獵場 | Choose a hunting ground |
| 場地列表 | List of grounds |
| 狩獵場資訊 | Hunting ground info |
| 請選擇目的地 | Choose a destination |
| 入場費 | Entry fee |
| 選擇目的地 | Destination |
| 前往狩獵設定 | Go to hunt setup |
| 返回地球 | Back to the globe |
| 狩獵設定 | Hunt setup |
| 目的地 | Destination |
| 返回選場 | Back to grounds |
| 開始狩獵 | Start hunt |
| 繩索 | Rope |
| 射擊 | Shooter |
| 鋼索 | Wire |
| 誘引道具 | Lure |
| 傷害陷阱 | Damage trap |
| 尚未持有 | None owned |
| 狩獵目標資訊 | Target info |
| 世代 | Generation |
| 種族 | Family |
| 屬性 | Attribute |
| 記憶卡容量 | Memory card capacity |
| 狩獵雷達 | Hunt radar |
| 狩獵工具 | Hunt gear |
| 野生數碼獸 | Wild Digimon |
| 繩索斷了 | The rope broke |
| 已收入記憶卡 | Stored on the memory card |
| 道具已用完 | Out of this item |
| 按住目標射擊 | Hold on the target to shoot |
| 輕觸放置炸彈 | Tap to place a bomb |
| 手 | Hand |
| 普通射擊 α | Standard Shot α |
| 普通射擊 β | Standard Shot β |
| 連發射擊 α | Rapid Shot α |
| 連發射擊 β | Rapid Shot β |
| 睡眠射擊 α | Sleep Shot α |
| 睡眠射擊 β | Sleep Shot β |
| 麻痺射擊 α | Stun Shot α |
| 麻痺射擊 β | Stun Shot β |
| 散彈 α | Scatter Shot α |
| 散彈 β | Scatter Shot β |
| 麻痺散彈 α | Stun Scatter Shot α |
| 麻痺散彈 β | Stun Scatter Shot β |
| 阻擋鋼索 α | Barrier Wire α |
| 阻擋鋼索 β | Barrier Wire β |
| 磁力鋼索 α | Magnet Wire α |
| 磁力鋼索 β | Magnet Wire β |
| 電擊鋼索 α | Shock Wire α |
| 電擊鋼索 β | Shock Wire β |
| 肉餌 | Meat Bait |
| 大型肉餌 | Large Meat Bait |
| 毒肉餌 | Poison Meat Bait |
| 麻痺肉餌 | Stun Meat Bait |
| 誘導玩具 | Decoy Toy |
| 強化誘導玩具 | Enhanced Decoy Toy |
| 黃色誘引燈 | Yellow Lure Light |
| 藍色誘引燈 | Blue Lure Light |
| 爆破彈 | Blast Bomb |
| 睡眠彈 | Sleep Bomb |
| 麻痺彈 | Stun Bomb |
| 閃光彈 | Flash Bomb |
| 地雷 | Mine |
| 大型地雷 | Large Mine |
| 捕捉陷阱 | Capture Trap |
| 強化捕捉陷阱 | Enhanced Capture Trap |
| 世代分析 | Generation analysis |
| 種族分析 | Family analysis |
| 屬性分析 | Attribute analysis |
| HP 分析 | HP analysis |
| 性格分析 | Personality analysis |
| 容量分析 | Capacity analysis |
| 完整分析 | Full analysis |
| 射擊數量 | Shot count |
| 鋼索數量 | Wire count |
| 誘引道具數量 | Lure count |
| 傷害陷阱數量 | Damage trap count |
| 全部道具數量 | All item counts |
| 幼年期雷達 | Baby radar |
| 成長期雷達 | Child radar |
| 成熟期雷達 | Adult radar |
| 完全體雷達 | Perfect radar |
| 疫苗屬性雷達 | Vaccine attribute radar |
| 病毒屬性雷達 | Virus attribute radar |
| 龍族雷達 | Dragon radar |
| 獸族雷達 | Beast radar |
| 鳥族雷達 | Bird radar |
| 水族雷達 | Aquatic radar |
| 聖族雷達 | Holy radar |
| 暗黑族雷達 | Dark radar |
| 昆蟲植物雷達 | Insect & Plant radar |
| 機械族雷達 | Machine radar |
| 數碼蛋 | Digi-Egg |
| 幼年期 I | Baby I |
| 幼年期 II | Baby II |
| 幼年期Ⅰ | Baby I |
| 幼年期Ⅱ | Baby II |
| 成長期 | Child |
| 成熟期 | Adult |
| 完全體 | Perfect |
| 究極體 | Ultimate |
| 昆蟲／植物 | Insect & Plant |
| 暗黑 | Dark |
| 自由 | Free |
| 坦率 | Honest |
| 任性 | Selfish |
| 急躁 | Impatient |
| 悠閒 | Easygoing |
| 熱血 | Passionate |
| 冷靜 | Calm |
| 大膽 | Bold |
| 膽小 | Timid |
| 養成用品 | Raising goods |
| 外掛 | Plug-ins |
| 籠子設施 | Cages |
| 用品 | Goods |
| 工具 | Gear |
| 設施 | Cage |
| 商店 | Shop |
| 商品分類 | Item categories |
| 上一項商品 | Previous item |
| 商品選擇 | Items |
| 下一項商品 | Next item |
| 購買 | Buy |
| 商品 | Item |
| 已持有 | Owned |
| 已達上限 | Max held |
| 數碼獸圖鑑 | Digimon Database |
| 已登錄 | Registered |
| 設施配置 | Cage layout |
| 已放置設施 | Placed cages |
| 確認配置 | Confirm layout |
| 繼續編輯 | Keep editing |
| 放棄變更 | Discard changes |
| 套用並返回 | Apply and return |
| 可放置 | Available |
| 尚未開放 | Locked |
| 飼料 | Feed |
| 蛋白質 | Protein |
| 傷藥 | Salve |
| 藥品 | Medicine |
| 防禦上升 | Defense up |
| 生命值上升 | HP up |
| 技力上升 | TP up |
| 攻擊上升 | Attack up |
| 速度上升 | Speed up |
| 智力上升 | Wisdom up |
| 對戰次數上升 | Battle count up |
| 資料屬性上升 | Data up |
| 龍屬性上升 | Dragon up |
| 獸屬性上升 | Beast up |
| 水棲屬性上升 | Aquatic up |
| 鳥屬性上升 | Bird up |
| 蟲草屬性上升 | Insect & Plant up |
| 暗黑屬性上升 | Dark up |
| 機械屬性上升 | Machine up |
| 疫苗屬性上升 | Vaccine up |
| 聖屬性上升 | Holy up |
| 病毒屬性上升 | Virus up |
| 光耐性上升 | Light resistance up |
| 熱耐性上升 | Heat resistance up |
| 冷耐性上升 | Cold resistance up |
| 雷耐性上升 | Thunder resistance up |
| 闇耐性上升 | Dark resistance up |
| 固定待機區 | Fixed Waiting Room |
| 戴納草原 | Dyna Grassland |
| 驅動莽原 | Drive Savanna |
| 模組之森 | Module Forest |
| 啟動叢林 | Boot Jungle |
| 黏滑沼澤 | Slimy Swamp |
| 波浪海岸 | Wave Coast |
| 南橋峽谷 | Southbridge Valley |
| 克隆礦坑 | Clone Mines |
| 杜比工廠 | Dolbi Plant |
| 下水道路 | Sewer Road |
| 雪之國度 | Snowland |
| 裂岩地帶 | Crack Rocks |
| 岩漿山脈 | Magma Mountain |
| 灼熱沙漠 | Scorching Desert |
| 澄澈綠洲 | Clear Oasis |
| 臨界遺跡 | Critical Ruins |
| 教學關卡 | Tutorial |
| 頭銜完成度 | Titles completed |
| 圖鑑完成度 | Database completed |
| 地圖完成度 | Maps completed |
| 對戰次數 | Battles |
| 名稱 | Name |
| 階級 | Rank |
| 遊玩時間 | Play time |
| 育成執照 | Raising license |
| 收納容量 | Capacity |
| 設施格數 | Cage hexes |
| 外觀與顯示 | Appearance & display |
| 畫面品質 | Graphics quality |
| 聲音 | Sound |
| 語言 | Language |
| 操作與輔助 | Controls & accessibility |
| 資料與帳號 | Data & account |
| 深色夜景 | Night |
| 藍白清爽 | Clear Blue |
| 經典暖黃 | Classic Warm |
| 復古藍金 | Retro Blue & Gold |
| 跟隨系統 | Match system |
| 標準 | Standard |
| 較大 | Larger |
| 大 | Large |
| 精簡 | Compact |
| 自動 | Auto |
| 省電 | Power saving |
| 平衡 | Balanced |
| 高品質 | High |
| 柔和 | Soft |
| 完整 | Full |
| 此裝置 | This device |
| 帳號偏好 | Account |
| 靜音 | Muted |
| 存檔只在本機 | Save kept on this device only |
| 主題 | Theme |
| 深色 | dark |
| 淺色 | light |
| 文字大小 | Text size |
| 資訊密度 | Information density |
| 畫質 | Quality |
| 立即生效 | Applies now |
| 抗鋸齒 | Anti-aliasing |
| 高光碎片數 | Highlight shards |
| 模糊與光暈 | Blur and glow |
| 全部靜音 | Mute all |
| 總音量 | Master volume |
| 遊戲音效 | Game sounds |
| 試聽 | Test sound |
| 顯示語言 | Display language |
| 減少動態 | Reduce motion |
| 完整動態 | Full motion |
| 閃光強度 | Flash intensity |
| 高光演出 | Highlight presentation |
| 存檔 | Save |
| 帳號 | Account |
| 偏好設定 | Preferences |
| 恢復全部設定 | Restore all settings |
| 恢復預設 | Restore defaults |
| 返回設定分類 | Back to settings sections |
| 關閉設定 | Close settings |
| 設定分類 | Settings sections |

## 刻意保留繁中

237 個專有名詞（種名、起始角色自動名、浩司、惠子）在英文介面維持繁中，清單見 `src/championship/text/uiText.en.js` 的 `UNTRANSLATED_PROPER_NOUNS`。
