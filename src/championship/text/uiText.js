// Display-only PRODUCT_AUTHORED copy. Never translate identifiers or saved input.
import { formatNumber, getLocale, pluralCategory } from "./locale.js";
import { growthStageUiAlias } from "./growthStageTerms.js";
import { PATTERNS_EN, TEXT_EN, UI_COPY_EN, UNTRANSLATED_PROPER_NOUNS } from "./uiText.en.js";
import { PATTERNS_JA, TEXT_JA, UI_COPY_JA } from "./uiText.ja.js";
import { PATTERNS_TH, TEXT_TH, UI_COPY_TH } from "./uiText.th.js";
import { PATTERNS_VI, TEXT_VI, UI_COPY_VI } from "./uiText.vi.js";

export const UI_COPY = Object.freeze({
  "RANCH_JOURNAL_TITLE": "探索手帳",
  "RANCH_JOURNAL_ABOUT": "搭檔會沿相通的步道散步。全牧場每 2 小時累積 1 份發現，最多保留 12 份；離線照樣累積，已找到的東西不會過期。地塊與搭檔數量不增加產出速度。",
  "RANCH_JOURNAL_EMPTY": "搭檔正在慢慢探索，等牠有發現再回來看看。",
  "RANCH_JOURNAL_NONE": "有孵化後的搭檔住進牧場後，就會開始累積發現。",
  "RANCH_JOURNAL_FULL": "背包或錢包滿的物品會留在這裡，稍後再領就好。",
  "RANCH_JOURNAL_COLLECT": "收下發現",
  "RANCH_JOURNAL_CLOSE": "繼續散步",
  "RANCH_JOURNAL_FOOD": "食物 ×2",
  "RANCH_JOURNAL_HERB": "草藥 ×1",
  "RANCH_JOURNAL_BITS": "金幣 ×20",
  "RANCH_JOURNAL_RARE": "稀有發現：營養補給 ×1",
  "RANCH_JOURNAL_PARTNER": "搭檔",
  "RANCH_JOURNAL_PATH": "條通路已接通",
  "RANCH_JOURNAL_BLOCKED": "處同類接邊仍有障礙",
  "RANCH_JOURNAL_SAVED": "已收下發現",
  "RANCH_JOURNAL_FAILED": "保存失敗，發現仍保留，請稍後重試。",
  "Zoom out ranch (overview)": "縮小育成地圖（總覽）",
  "Zoom in ranch (detail)": "放大育成地圖（近看）",
  "Pinch or scroll over the ranch to zoom": "雙指捏合或在地圖上滾動滑鼠，可切換近看與總覽",
  "輕觸夥伴查看": "輕觸夥伴查看",
  "野生夥伴": "野生夥伴",
  "Save failed. Your partner is still on the memory card. Return Home again to retry.": "儲存失敗，夥伴仍在記憶卡中。請再次返回育成基地以重試。",
  "Your home roster is full. Your partner remains on the memory card.": "育成夥伴名單已滿，夥伴仍在記憶卡中。",
  "No partner in the roster.": "目前沒有夥伴。",
  "One cage per hex. Rank opens 14–20. Overfill is allowed; extra partners stress more easily.": "每個六角格可放一座設施，隨階級開放 14 至 20 格。可以超過建議容納數，但夥伴較容易累積壓力。",
  "RANCH_PREFETCH_PLANNING": "正在準備目前夥伴的圖像…",
  "RANCH_PREFETCH_COMPLETE": "目前夥伴的圖像已預先下載",
  "RANCH_PREFETCH_PARTIAL": "部分圖像將在繼續遊戲時補載",
  "RANCH_PREFETCH_PROGRESS": "預先下載夥伴圖像：{done}/{files} · {mib} MiB",

  "MODULE_LOAD_ERROR": "畫面程式未能載入，可能是遊戲剛更新或連線中斷。請保存並重新載入遊戲；不需要清除存檔。",
  "SCREEN_LOAD_ERROR": "畫面未能載入。請保存並重新載入遊戲，或保存並返回標題。",
  "CAGE_SLOT_RANK_LOCKED": "第 {n} 格尚未開放，馴獸師階級達到 {rank} 後開放。",
  // Static system backgrounds; display copy only.
  "SYSTEM_BACKGROUND_LABEL": "系統背景",
  "SYSTEM_BACKGROUND_HINT": "關閉設定後，從「系統」開啟商店、圖鑑或說明；圖片顯示在卡片外圍與空隙。標題、牧場與戰鬥場景不變。",
  "SYSTEM_BACKGROUND_DEFAULT": "預設",
  "SYSTEM_BACKGROUND_DEFAULT_HINT": "保留原本的介面背景。",
  "SYSTEM_BACKGROUND_CUSTOM": "自選",
  "SYSTEM_BACKGROUND_CUSTOM_HINT": "選擇會自動保存；請到商店、圖鑑或說明查看背景。",
  "SYSTEM_BACKGROUND_RANDOM": "隨機",
  "SYSTEM_BACKGROUND_RANDOM_HINT": "下次進入系統頁時選一張，停留期間不更換。",
  "SYSTEM_BACKGROUND_PICK": "自選圖片（點選即套用）",
  "SYSTEM_BACKGROUND_RESONANCE": "共鳴網路",
  "SYSTEM_BACKGROUND_GROWTH": "成長紀錄",
  "SYSTEM_BACKGROUND_GLORY": "榮耀結果",

  // Display-only evolution thresholds. PRODUCT_AUTHORED, 2026-10-14.
  "DEX_CONDITIONS": "條件",
  "DEX_CONDITIONS_TOGGLE": "第 {branch} 分支的條件",
  "DEX_CONDITIONS_RULES_ONLY": "規則門檻，尚未比對個體；符合門檻不保證進化。",
  "DEX_CONDITIONS_LIFETIME": "僅在壽命判定時檢查。",
  "DEX_CONDITIONS_NO_NUMERIC": "未列額外數值門檻，仍受進化流程限制。",
  "DEX_CONDITIONS_LIMITS": "分支順序、馴獸師階級、容量、判定時機與血統可能影響結果。",
  "DEX_CONDITIONS_GTE": "至少 {value}",
  "DEX_CONDITIONS_LTE": "至多 {value}",
  "DEX_CONDITIONS_PERCENT": "{value}%",
  "DEX_CONDITIONS_BATTLES": "{value} 場",
  "DEX_CONDITIONS_TIMES": "{value} 次",
  "DEX_CONDITION_VACCINE_ATTRIBUTE": "疫苗屬性值",
  "DEX_CONDITION_DATA_ATTRIBUTE": "資料屬性值",
  "DEX_CONDITION_VIRUS_ATTRIBUTE": "病毒屬性值",
  "DEX_CONDITION_DRAGON_ATTRIBUTE": "龍屬性值",
  "DEX_CONDITION_BEAST_ATTRIBUTE": "獸屬性值",
  "DEX_CONDITION_AQUATIC_ATTRIBUTE": "水屬性值",
  "DEX_CONDITION_BIRD_ATTRIBUTE": "鳥屬性值",
  "DEX_CONDITION_INSECT_PLANT_ATTRIBUTE": "昆蟲植物屬性值",
  "DEX_CONDITION_HOLY_ATTRIBUTE": "聖屬性值",
  "DEX_CONDITION_DARK_ATTRIBUTE": "暗黑屬性值",
  "DEX_CONDITION_MACHINE_ATTRIBUTE": "機械屬性值",
  "DEX_CONDITION_MAX_HP": "最大生命值（HP）",
  "DEX_CONDITION_MAX_TP": "最大技力（TP）",
  "DEX_CONDITION_ATTACK": "攻擊",
  "DEX_CONDITION_DEFENSE": "防禦",
  "DEX_CONDITION_WISDOM": "智力",
  "DEX_CONDITION_SPEED": "速度",
  "DEX_CONDITION_HEAT_RESISTANCE": "耐熱",
  "DEX_CONDITION_COLD_RESISTANCE": "耐寒",
  "DEX_CONDITION_LIGHT_RESISTANCE": "耐光",
  "DEX_CONDITION_DARK_RESISTANCE": "耐暗",
  "DEX_CONDITION_THUNDER_RESISTANCE": "耐雷",
  "DEX_CONDITION_BATTLE_COUNT": "戰鬥次數",
  "DEX_CONDITION_EVOLUTION_WIN_PERCENT": "進化判定勝率",
  "DEX_CONDITION_REBIRTH_COUNT": "退化次數",
  "DEX_CONDITION_CARE_MISTAKE_VALUE": "照護失誤值",
  "DEX_EVOLUTION": "進化候選",
  "DEX_ROUTE_RECORDED": "已有完成紀錄",
  "DEX_ROUTE_UNRECORDED": "尚無完成紀錄",
  "DEX_ROUTE_UNKNOWN": "紀錄未能確認",
  "DEX_NO_ROUTES": "此物種沒有候選路線。",
  "DEX_IMAGE_MISSING": "圖像暫缺",
  "DEX_STAGE": "成長階段",
  "DEX_ALL": "全部階段",
  "DEX_EGG_INDEX": "蛋內容索引；未記錄永久取得歷史，不計入常規圖鑑登錄。",
  "DIAGNOSTIC_TITLE": "重啟診斷",
  "DIAGNOSTIC_DOWNLOAD": "下載診斷紀錄",
  "DIAGNOSTIC_HINT": "只保留本機最近 32 筆／8 KiB 技術事件，不含玩家或存檔資料，也不會自動上傳。重啟後可在標題設定下載；若瀏覽器封鎖儲存，僅能匯出本次開啟的紀錄。",
  "DIAGNOSTIC_READY": "診斷檔已準備，請在瀏覽器的下載項目查看。",
  "DIAGNOSTIC_FAILED": "無法下載診斷紀錄，請再試一次。",
  "HUD_CURRENCIES": "貨幣",
  "HUD_PREVIEW": "預覽",
  "HUD_DIAMOND_TITLE": "鑽石預覽",
  "HUD_DIAMOND_OPEN": "查看鑽石預覽；目前尚未開放儲值",
  "HUD_DIAMOND_UNAVAILABLE": "目前尚未開放鑽石儲值。此處僅為介面預覽，不會購買、扣款或變更位元幣。",

  "ENTER_GAME": "進入遊戲",
  "OPENING_ART_PENDING": "插圖尚未就緒，可以先閱讀故事。",
  "OPENING_TEXT_FIRST": "先閱讀文字",
  "OPENING_RETURN": "返回標題",
  "FIELD_LOAD_START": "正在準備牧場…",
  "FIELD_LOAD_ART": "正在載入牧場與夥伴…",
  "FIELD_LOAD_RETRY": "重新載入牧場",
  "FIELD_LOAD_CANCEL": "取消載入",
  "FIELD_LOAD_RETURN": "保存並返回標題",
  "FIELD_LOAD_RELOAD": "保存並重新載入遊戲",
  "FIELD_LOAD_TIMEOUT": "載入時間過長。請重試，或保存並重新載入遊戲。",
  "FIELD_LOAD_CANCELLED": "載入已取消，遊戲進度仍保留。",
  "FIELD_LOAD_ERROR": "牧場未能載入。請重試，或保存並重新載入遊戲。",
  "FIELD_LOAD_SAVE_FAILED": "保存未完成，已留在目前畫面。請重試或匯出進度。",
  "FIELD_LOAD_STALLED": "下載已停止回應。請重試，或保存並重新載入遊戲。",
  "HUNT_FEEDBACK_FALLBACK_NOTICE": "道具外觀素材未就緒，已切換為簡易圖形。",
  "HUNT_FEEDBACK_RETRY_BUTTON": "重試載入",
  "HUNT_FEEDBACK_RETRYING": "正在重試…",
  "LOAD_PROGRESS_LABEL": "載入進度",
  "LOAD_STEP_ENGINE": "畫面引擎",
  "LOAD_STEP_FACILITIES": "牧場設施",
  "LOAD_STEP_PARTNERS": "夥伴",
  "LOAD_STEP_SCENE": "準備場景",
  "LOAD_STEP_ARENA": "對戰場地",
  "LOAD_STEP_FIGHTERS": "參賽夥伴",
  "LOAD_STEP_EFFECTS": "招式特效",
  "LOAD_PROGRESS_STEPS": "{done}／{total} 項完成",
  "LOAD_FILES": "已載入 {count} 個檔案",
  "LOAD_SLOW": "網路較慢，仍在下載中。",
  "EXPANSION_TITLE": "牧場擴充",
  "EXPANSION_LEAD": "在牧場下方再開兩排，共 10 格設施空間。",
  "EXPANSION_MAP_CURRENT": "目前牧場",
  "EXPANSION_MAP_ANNEX": "擴充區 +10 格",
  "EXPANSION_POINT_RULES": "沿用所有設施的形狀與放置規則，競技場等大型設施也放得下。",
  "EXPANSION_POINT_TRAINING": "夥伴可以搬運進出，進入設施時照常觸發訓練。",
  "EXPANSION_POINT_CAPACITY": "收容上限維持 16 隻；多出的是設施空間，夥伴分散後比較不擁擠。",
  "EXPANSION_POINT_MORE": "其餘的鎖定格保留給之後的擴充；開放的數量與方式尚未決定。",
  "EXPANSION_STATUS_TITLE": "取得方式：尚未開放",
  "EXPANSION_STATUS_NOTE": "價格與取得方式確定後才會開放。你現在的牧場配置與存檔都不會改變。",
  "EXPANSION_UNAVAILABLE": "尚未開放",
  "EXPANSION_CLOSE": "關閉",
  "EXPANSION_VIEW": "查看擴充",
  "EXPANSION_VIEW_BADGE": "+10 格",
  "EXPANSION_VIEW_LABEL": "查看牧場擴充：下方 10 格尚未開放",
  "EXPANSION_EDIT_LOCKED_LABEL": "擴充區 · 尚未開放",
  "EXPANSION_EDIT_LOCKED_GRID": "擴充區格位（尚未開放）",

  "CODE_PASTE": "貼上代碼",
  "CODE_PASTED": "已貼上代碼。",
  "CODE_PASTE_MANUAL": "請長按代碼欄位，使用貼上指令。",
  "CODE_PASTE_EMPTY": "剪貼簿沒有文字；可以在代碼欄位手動貼上。",
  "CODE_COPY": "複製通訊碼",
  "CODE_COPIED": "已複製通訊碼。",
  "CODE_COPY_MANUAL": "無法自動複製，已選取通訊碼；請長按或使用複製指令。",
  "TEAM_PICK_HINT": "請選擇 1 至 3 隻夥伴。",
  "TEAM_SELECTED": "目前選擇的隊伍",
  "TEAM_LOCKED": "此通訊碼鎖定的我方隊伍",
  "TEAM_OPPONENT_LOCKED": "此通訊碼鎖定的對方隊伍",
  "TEAM_EXCHANGE_RESET": "隊伍或邀請已更改，舊通訊碼已從此畫面清除。請重新交換雙方通訊碼。",
  "LINK_LOCAL_ONLY": "交換通訊碼後，各自在本機重播對戰；這裡沒有即時連線房間。",
  "LINK_STEP_1": "邀請方選隊，產生並分享邀請碼。",
  "LINK_STEP_2": "加入方貼上邀請碼、選隊，產生並分享回覆碼。",
  "LINK_STEP_3": "邀請方讀取回覆碼；雙方確認鎖定隊伍後，各自開始本機重播。",
  "LINK_READ_REPLY": "讀取回覆並確認隊伍",
  "LINK_START_LOCAL": "已交換通訊碼，開始本機重播",
  "PASSWORD_LOCAL_STEPS": "選擇自己的夥伴並產生密碼，會自動填入 A 隊。把朋友的密碼貼到 B 隊，即可在本機重播對戰。密碼記錄產生當時的隊伍狀態。",
  "PASSWORD_TEAM_LOCKED": "A 隊密碼中的我方隊伍",
  "BACKUP_DOWNLOAD": "下載存檔備份",
  "BACKUP_HINT": "下載上次成功保存的完整存檔；若保存失敗，則下載最近一次未寫入的完整進度。正在等待保存的變更不會因此寫入。請自行保管下載檔案。",
  "BACKUP_PENDING_READY": "未寫入的完整進度已驗證，已交由瀏覽器下載。原本存檔未變更。",
  "BACKUP_STORED_READY": "上次成功保存的完整存檔已驗證，已交由瀏覽器下載。",
  "BACKUP_FAILED": "備份無法下載，或目前沒有可通過驗證的完整存檔。原本存檔未變更。",
  "SAVE_LAST_SUCCESS": "上次成功保存：{time}。",
  "SAVE_NO_SUCCESS": "本次尚無成功保存的時間。",
  "SAVE_PENDING": "正在等待保存到本機…",
  "SAVE_SIZE_USAGE": "存檔大小：{used} KB／上限 {budget} KB。",
  "SAVE_SIZE_HIGH": "存檔已接近容量上限，請先下載備份並回報開發者。",
  "STORAGE_PERSISTED": "瀏覽器已同意長期保存這個網站的資料；這不保證永不遺失，仍建議定期下載存檔備份。",
  "STORAGE_NOT_PERSISTED": "瀏覽器可能在空間不足或長期未使用時清除網站資料，建議定期下載存檔備份；加入主畫面後通常較不易被清除。",

  "MUSIC_RAISING_PICK": "育成場景 BGM",
  "MUSIC_RAISING_PICK_HINT": "用於育成首頁與飼育場編輯；教學也使用此選擇。",
  "MUSIC_BATTLE_PICK": "對戰場景 BGM",
  "MUSIC_BATTLE_PICK_HINT": "用於一般對戰、決賽與資料競技場；勝敗結果音樂不變。",
  "MUSIC_SCENE_DEFAULT": "依場景預設",
  "MUSIC_SCENE_DEFAULT_HINT": "保留原本各場景的配樂安排。",
  "MUSIC_SCENE_PICK_NOTE": "選擇會自動保存。目前場景立即換曲，其他場景在進入時套用；不會解除靜音。",
  "MUSIC_TEST_SFX": "試聽音效",
  "MUSIC_VOLUME": "背景音樂",
  "MUSIC_VOLUME_HINT": "首頁、育成、探索與對戰音樂。",
  "MUSIC_GESTURE_NOTE": "點擊或按鍵後播放音樂；切到背景時暫停。",
  "TITLE_BACKGROUND_LOADING": "背景載入中，您仍可開始遊戲。",
  "TITLE_BACKGROUND_ERROR": "背景未能載入，您仍可開始遊戲。",
  "TITLE_BACKGROUND_RETRY": "重試背景",
  "RESIDENT_ART_LOADING": "正在載入夥伴外觀…",
  "RESIDENT_ART_ERROR": "夥伴外觀載入失敗，遊戲資料仍保留。",
  "RESIDENT_ART_RETRY": "重試外觀",
  "OPENING_COMIC_LOADING": "正在載入故事…",
  "輕觸數碼獸查看": "輕觸夥伴查看",
  "野生數碼獸": "野生夥伴",

  "SWIPE TO VIEW": "滑動查看場地", "Waiting Room": "待機區",
  "Moonwell Pool": "月井池", "Quiet Hollow": "靜謐谷地",
  "TAMER RANK": "馴獸師階級", "ENTRY FEE": "報名費",
  "durability": "耐久度", "length": "長度",
  "HP 分析": "生命值分析",
  "ON MEMORY CARD": "已收入記憶卡", "MEMORY CARD": "記憶卡",
  "RELEASE": "放生", "CANCEL": "取消", "CONFIRM RELEASE": "確認放生", "NAME THIS ONE": "命名", "NAMING": "命名中",
  "Memory card and Home roster": "記憶卡與育成夥伴名單", "Confirm release": "確認放生",
  "Release is not yet available for this resident.": "目前尚無法放生這隻夥伴。",
  "Save failed. Your Digimon is still on the memory card. Return Home again to retry.": "儲存失敗，夥伴仍在記憶卡中。請再次返回育成基地以重試。",
  "Your home roster is full. Your Digimon remains on the memory card.": "育成夥伴名單已滿，夥伴仍在記憶卡中。",
  "FRIENDS_MEDAL_PREVIEW_NOTICE": "測試期間：後期徽章為外觀預覽，不計入實際勝利；前期徽章請透過遊戲取得。",
  "FRIENDS_MEDAL_PREVIEW_BADGE": "測試預覽",
  "CAGE_PUBLIC_TEST_GRID_HINT": "連續牧場 · 起始 20 格，最多 100 格 · 每排 10 格，測試價 1000 鑽；不涉及真實付款。",
  "CAGE_TEST_ROW_TITLE": "解鎖第 {row} 排",
  "CAGE_TEST_ROW_DETAILS": "開放 {count} 個格位，需花費 {price} 測試鑽石。沒有真實付款。",
  "CAGE_TEST_ROW_BUY": "購買",
  "CAGE_TEST_ROW_CANCEL": "取消",
  "CAGE_TEST_BUY_ROW": "購買第 {row} 排（{count} 格 · {price} 測試鑽）",
  "CAGE_TEST_ROW_PURCHASED": "已扣除 1000 測試鑽，本排已開放。",
  "CAGE_TEST_ROW_UNAVAILABLE": "目前無法購買此排。",
  "CAGE_TEST_ROW_ALREADY_OPEN": "本排已開放，不會重複扣鑽。",
  "CAGE_TEST_DIAMONDS_INSUFFICIENT": "測試鑽不足，尚未扣鑽或開放格位。",
  "CAGE_TEST_ROW_SAVE_FAILED": "存檔失敗，未扣鑽或開放格位。",
  "CAGE_TEST_DIAMOND_BALANCE": "測試鑽：{amount}",
  "The full cage footprint must fit in free, unlocked cells.": "設施占用的所有格位都必須為已開放的空格。",
  "Waiting Room stays at the ranch entrance.": "待機區固定在育成區入口。",
  "Exploration field. Drag empty ground to look around. Touch a creature to select it.": "狩獵場地。拖曳空地移動視野，點選夥伴進行選取。",
  "Rotatable world destination view": "可旋轉的世界目的地視圖", "World destination nodes": "世界目的地節點",
  "DIGIMON CHAMPIONSHIP · 2026": "網線拍檔：雜訊彼端的錦標賽 · 2026",
  "RAISING HOME": "育成基地", "Raising Home": "育成基地", "Training": "育成",
  "Spring": "春季", "Summer": "夏季", "Autumn": "秋季", "Winter": "冬季",
  "SPRING": "春季", "SUMMER": "夏季", "AUTUMN": "秋季", "WINTER": "冬季",
  "Day": "日", "END DAY": "結束今天", "End the day": "結束今天",
  "SAVE": "儲存", "BACK": "返回", "RETURN HOME": "返回牧場", "RETURN TO RANCH": "返回牧場", "CONTINUE": "繼續",
  "NEXT": "下一頁", "LEAVE": "離開", "CONFIRM": "確認", "LIST": "列表",
  "SHOP": "商店", "Shop": "商店", "HUNT": "狩獵", "Hunt": "狩獵",
  "Battle": "對戰", "Battle result": "對戰結果", "DATABASE": "圖鑑", "Database": "圖鑑",
  "HOME": "育成", "CAGE": "設施配置", "CAGES": "育成設施", "GOODS": "育成用品",
  "PLUGINS": "外掛程式", "EGG": "培育蛋", "EGGS": "培育蛋", "REGULAR": "一般物種",
  "SPECIES": "物種", "REGISTERED": "已登錄", "STARTER": "初始夥伴", "NEW": "新品",
  "HELD": "已達上限", "BUY": "購買", "Undiscovered": "尚未發現", "Unknown gate": "未知傳送門",
  "GIVEN NAME": "暱稱", "Given name": "暱稱", "NAME": "名稱", "FAMILY": "種族",
  "GEN.": "世代", "ATTR. INDEX": "屬性編號", "none set": "未設定",
  "HP": "生命值", "TP": "技力", "DIGIMON": "夥伴", "Digimon": "夥伴",
  "ROSTER": "夥伴名單", "NAME EDIT": "更改名稱", "DELETE": "移除", "ENTRY": "報名",
  "TAMER": "馴獸師", "Tamer": "馴獸師", "TAMER INFO": "馴獸師資料",
  "SCHEDULE": "賽程", "Schedule": "賽程", "TITLE MATCHES": "頭銜賽", "RECORD": "編號",
  "HELP": "說明", "Help": "說明", "Cage Edit": "設施配置", "End Day": "結束今天",
  "Save & Quit": "儲存並離開", "MANAGE": "管理", "SYSTEM": "選單", "Settings": "設定",
  "Retry": "重試", "Saving...": "保存中…",
  "HAND": "手掌", "FEED": "餵食", "CLEAN": "清潔", "MED": "藥品", "WOUND": "傷藥", "PROTEIN": "蛋白質",
  "Move a resident, or stroke it": "移動或撫摸夥伴", "Place food beside a resident": "在夥伴身旁放置食物",
  "Clear droppings and leftovers": "清除排泄物與剩餘食物", "Cure sickness": "治療疾病",
  "Heal injury": "治療傷勢", "Raise attack for a time": "暫時提升攻擊力",
  "Contextual toolbar": "目前場景工具列", "In the original, not yet in this build": "此功能尚未開放",
  "Changes are waiting to be saved.": "有尚未儲存的變更。", "Raising Home is up to date.": "育成狀態已更新。",
  "Raising Home saved.": "育成狀態已儲存。", "Raising Home restored from save.": "已讀取育成存檔。",
  "The last safe Raising Home state was recovered.": "已復原最近一次有效的育成狀態。",
  "Save did not complete. You can try again.": "儲存未完成，請再試一次。",
  "Raising Home status updated.": "育成狀態已更新。", "Raising Home is ready.": "育成基地準備完成。",
  "Saved game restored.": "已讀取存檔。", "Raising Home is ready. Tap a creature to look after them.": "育成基地準備完成，點選夥伴查看狀態。",
  "Raising Home time": "育成時間", "Playable Raising field": "育成活動場地",
  "LIVE HABITAT": "育成場地", "FIELD ONLINE": "場地已就緒", "COMPANION LINK": "夥伴狀態",
  "SELECT A RESIDENT": "選擇夥伴", "Touch a resident in the habitat.": "點選場地中的夥伴。",
  "TAP A RESIDENT": "點夥伴看狀態",
  "Original toolbar structure, commands unverified": "工具列結構，指令尚待確認",
  "TRAINING TOOLBAR · MODE 1": "育成工具列 · 模式一", "8-SLOT SHELL · ROM VERIFIED": "八格工具列 · 結構已驗證",
  "Commands, icons, submenu membership, enable mask and slot 7 identity remain unverified.": "指令、圖示、子選單歸屬、啟用條件與第八格用途仍待確認。",
  "No Digimon in the roster.": "目前沒有夥伴。", "Empty roster.": "夥伴名單是空的。",
  "No topic selected.": "尚未選擇說明主題。", "No fixture selected.": "尚未選擇賽事。",
  "The original draws this field; this build has no traced source for it": "此欄位的資料來源尚待確認",
  "Buy goods, hunt gear, plugins and cages.": "購買育成用品、狩獵裝備、外掛程式與設施。",
  "Shop categories": "商品分類", "Purchased.": "購買成功。", "Not enough Bits.": "持有金額不足。",
  "You already hold the maximum.": "持有數量已達上限。", "That item is not for sale.": "此商品尚未開放購買。",
  "That quantity cannot be bought.": "無法購買此數量。", "Nothing listed in this category yet.": "此分類目前沒有商品。",
  "224 encyclopedia slots. Unlock filters remain untraced.": "圖鑑共有 224 格；解鎖篩選條件尚待確認。",
  "Database families": "圖鑑分類", "Return to Raising Home": "返回牧場", "Return to database list": "返回圖鑑列表",
  "This slot is in the 224-entry book. Unlock/filter logic is untraced.": "此格屬於 224 格圖鑑，解鎖與篩選條件尚待確認。",
  "Registered by the opening partner. No Hunt instance yet.": "由初始夥伴登錄，尚無狩獵帶回的個體。",
  "Cage editor": "設施配置", "One cage per hex. Rank opens 14–20. Overfill is allowed; extra Digimon stress more easily.": "每個六角格可放一座設施，隨階級開放 14 至 20 格。可以超過建議容納數，但夥伴較容易累積壓力。",
  "Ranch hex slots": "育成區六角格", "Owned cages": "持有的設施", "Keep this ranch layout": "保留目前設施配置",
  "Lower stand-in rank until title matches write it": "降低目前測試階級", "Raise stand-in rank until title matches write it": "提高目前測試階級",
  "Placed.": "已放置。", "Removed from the ranch.": "已從育成區移除。",
  "Layout kept. Save on Home to write it to disk.": "已保留配置，請返回育成基地儲存。",
  "Select a cage first.": "請先選擇設施。", "That cage is already on the ranch.": "此設施已在育成區中。",
  "That hex already has a cage.": "此格已有設施。", "That hex is outside the ranch.": "此格不在育成區內。",
  "That hex is still locked.": "此格尚未開放。", "You do not own that cage.": "尚未持有此設施。",
  "Every owned cage is on the ranch.": "所有持有的設施都已放入育成區。",
  "GATE SELECT": "選擇傳送門", "Rotate the world and focus a biome node.": "旋轉世界，選擇想前往的地區。",
  "WORLD DESTINATION NETWORK": "世界傳送網路", "WORLD MODE": "世界視圖", "16 BIOME LINKS": "16 個地區連結",
  "LIST VIEW": "列表視圖", "WORLD VIEW": "世界視圖", "DRAG TO ROTATE · TAP A NODE TO FOCUS": "拖曳旋轉 · 點選地區",
  "SELECT A BIOME": "選擇地區", "DESTINATION NODE --": "目的地 --", "STANDBY": "等待選擇", "READY": "已就緒",
  "DESTINATION INFORMATION": "目的地資訊", "DESTINATION": "目的地", "ACCESSIBLE DESTINATION LIST": "目的地列表",
  "LOW GRAPHICS / DEVELOPER FALLBACK": "低圖形需求模式", "Biome destinations": "可前往的地區",
  "HUNT LOADOUT": "狩獵整備", "EXPEDITION CONFIGURATION": "出發準備", "Equip your tools and fit your plugins.": "選擇裝備並安裝外掛程式。",
  "Equipment classes": "裝備種類", "Plugin positions": "外掛程式欄位", "None owned": "尚未持有", "BEGIN HUNT": "開始狩獵",
  "ROPE": "繩索", "SHOT": "射擊器", "WIRE": "攔阻線", "ENTRAP": "誘捕裝置", "DAMAGE TRAP": "傷害陷阱",
  "DURABILITY": "耐久度", "Durability": "耐久度", "Length": "長度", "LENGTH": "長度", "AMMO": "彈藥", "QUANTITY": "數量",
  "Hunt field": "狩獵場地", "Exploration field. Touch a creature to draw a circle. Empty ground moves you.": "狩獵場地。點選夥伴後畫圈，點選空地則會移動。",
  "TOUCH A CREATURE AND DRAW A CIRCLE. EMPTY GROUND MOVES YOU.": "點選夥伴後畫圈，點選空地則會移動。",
  "Unavailable contextual controls": "尚未開放的場景控制", "CONTEXT BAR": "場景工具列",
  "HUNT RESULT": "狩獵結果", "BROUGHT HOME": "已帶回育成基地", "EXPEDITION": "狩獵",
  "Name them, then return home. They will be waiting in the habitat.": "取好名字後返回牧場，牠會在牧場等你。",
  "Match clock": "對戰時間", "Match record": "對戰紀錄", "Health": "生命值", "Action resource": "行動資源",
  "Battle field. The match runs on its own.": "對戰場地，比賽會自動進行。", "THE MATCH IS RUNNING.": "對戰進行中。",
  "YOUR TEAM": "我方獲勝", "OPPONENT": "對手獲勝", "LEVEL": "雙方平手", "UNDECIDED": "尚未分出勝負",
  "IN PROGRESS": "進行中", "TIME UP": "時間到", "TEAM DOWN": "一方全員倒下", "NEITHER SIDE WAS AHEAD.": "雙方都未取得領先。",
  "PRIZE": "獎金", "Payout from the title-event record.": "此賽事設定的獎金。",
  "ROM VERIFIED": "原作資料已驗證", "PRODUCT AUTHORED": "本作設定",
  "NORMAL": "一般場地", "GRASS": "草原", "COLOSSEUM": "競技場", "CYBERSPACE": "電腦空間", "DESERT": "沙漠",
  "DOMESTADIUM": "室內競技場", "HELL": "地獄", "ISLAND": "島嶼", "SOUTHPOLE": "南極", "STADIUM": "體育場", "VOLCANO": "火山",
  "A saved game was found but could not be read. You can start a new game.": "找到存檔，但無法讀取。你仍可開始新遊戲。",
  "That saved game could not be opened. Start a new game.": "無法開啟此存檔，請開始新遊戲。",
  "The live field view is unavailable. Screen controls and save remain available.": "目前無法顯示場地，仍可使用畫面控制與儲存功能。"
});

/**
 * Display text for `value` in the current language.
 *
 * `value` is either one of the English design keys above or a zh-Hant source
 * string (the language every product string is written in). A string may
 * carry `{name}` placeholders, filled from `params`; a numeric param is
 * formatted for the language. English comes from uiText.en.js. A string with
 * no English yet falls back to its zh-Hant source -- never to undefined and
 * never to a key -- and is recorded for the coverage report.
 */
// Exact authored-label aliases. Resolve before filling parameters so a player's
// nickname is never rewritten. Other locales retain their existing dictionaries.
const PARTNER_LABELS_ZH = Object.freeze({
  // Exact authored-source aliases for entry eligibility and system fallbacks.
  "數碼獸冠軍賽 — 2026": "網線拍檔：雜訊彼端的錦標賽 — 2026",
  "從現在起，你也是數碼獸馴獸師了。\n與夥伴一起，朝冠軍賽優勝邁進吧！\n贈禮應該就快送到了。": "從現在起，你也是馴獸師了。\n與夥伴一起，朝冠軍賽優勝邁進吧！\n贈禮應該就快送到了。",
  "每四年舉辦一次的\n數碼獸冠軍賽。": "每四年舉辦一次的\n冠軍賽。",
  "取得參賽資格，\n正是身為真正數碼獸馴獸師的證明。": "取得參賽資格，\n正是身為真正馴獸師的證明。",
  "而今天，你也迎來了\n參加數碼獸冠軍賽的機會。\n\n奪下勝利吧！\n數碼獸冠軍賽！": "而今天，你也迎來了\n參加冠軍賽的機會。\n\n奪下勝利吧！\n冠軍賽！",
  "已登錄的數碼獸": "已登錄的夥伴",
  "前往傳送門捕捉數碼獸": "前往傳送門捕捉夥伴",
  "點選數碼獸查看狀態・左右滑動查看牧場": "點選夥伴查看狀態・左右滑動查看牧場",
  "選取的數碼獸": "選取的夥伴",
  "上一隻數碼獸": "上一隻夥伴",
  "下一隻數碼獸": "下一隻夥伴",
  "這隻數碼獸的詳細資料暫時無法顯示。": "這隻夥伴的詳細資料暫時無法顯示。",
  "數碼獸消失了。": "夥伴消失了。",
  "這隻數碼獸的個體資料尚未完整。": "這隻夥伴的個體資料尚未完整。",
  "這隻數碼獸還太幼小，暫時無法參賽。": "這隻夥伴還太幼小，暫時無法參賽。",
  "這隻數碼獸目前的身體狀況無法參賽。": "這隻夥伴目前的身體狀況無法參賽。",
  "這隻數碼獸不符合本場比賽的參賽條件。": "這隻夥伴不符合本場比賽的參賽條件。",
  "密碼中沒有可參戰的數碼獸。": "密碼中沒有可參戰的夥伴。",
  "密碼中含有目前不能參戰的數碼獸。": "密碼中含有目前不能參戰的夥伴。",
  "這隻數碼獸還不能密碼化。": "這隻夥伴還不能密碼化。",
  "輸入兩組隊伍密碼。每組密碼可還原最多 3 隻數碼獸。": "輸入兩組隊伍密碼。每組密碼可還原最多 3 隻夥伴。",
  "拖曳地面移動視野 · 輕觸數碼獸選取": "拖曳地面移動視野 · 輕觸夥伴選取",
  "選擇參賽數碼獸": "選擇參賽拍檔",
  "目前沒有符合這場比賽條件的數碼獸。": "目前沒有符合這場比賽條件的拍檔。",
  "將自己培育的數碼獸分成兩隊，每隊最多 3 隻。": "將自己培育的拍檔分成兩隊，每隊最多 3 隻。",
  "練習對戰需要至少兩隻可以參賽的數碼獸。": "練習對戰需要至少兩隻可以參賽的拍檔。",
  "選擇最多 3 隻自己的數碼獸，產生可以分享給朋友的密碼。密碼保存的是現在的狀態。": "選擇最多 3 隻自己的拍檔，產生可以分享給朋友的密碼。密碼保存的是現在的狀態。",
  "目前沒有可以密碼化的數碼獸。": "目前沒有可以密碼化的拍檔。",
  "選擇參賽數碼獸（1 至 3 隻）": "選擇參賽拍檔（1 至 3 隻）",
  "參賽數碼獸": "參賽拍檔",
  "選擇本輪參賽數碼獸；確認後抽出對手。": "選擇本輪參賽拍檔；確認後抽出對手。",
  "目前沒有可以參賽的數碼獸。": "目前沒有可以參賽的拍檔。",
  "數碼獸圖鑑": "拍檔圖鑑",
  "尚未登錄這隻數碼獸。": "尚未登錄這隻拍檔。",
  "這隻數碼獸的名字無法更改。": "這隻拍檔的名字無法更改。",
  "數碼獸物種名稱與初始夥伴的自動名稱在英文正式名稱核定前，沿用已核定的繁體中文名稱；你取的名字不會被翻譯。": "拍檔物種名稱與初始夥伴的自動名稱在英文正式名稱核定前，沿用已核定的繁體中文名稱；你取的名字不會被翻譯。",
  "同一隻數碼獸只能加入一隊。": "同一隻拍檔只能加入一隊。",
  "通訊碼內含不能參戰的數碼獸。": "通訊碼內含不能參戰的拍檔。",
  "請選擇 1 至 3 隻數碼獸。": "請選擇 1 至 3 隻拍檔。",
  "請選擇 1 至 {limit} 隻符合條件的數碼獸。": "請選擇 1 至 {limit} 隻符合條件的拍檔。",
  "選擇的數碼獸已不在目前名冊。": "選擇的拍檔已不在目前名冊。",
});

export function uiText(value, params) {
  if (typeof value !== "string") return value;
  const loc = getLocale();
  const stageAlias=growthStageUiAlias(value,loc);
  if(stageAlias!==null)return stageAlias;
  if (loc === "en") return englishText(value, params);
  if (loc === "ja") return localizedText(value, params, UI_COPY_JA, TEXT_JA, PATTERNS_JA);
  if (loc === "th") return localizedText(value, params, UI_COPY_TH, TEXT_TH, PATTERNS_TH);
  if (loc === "vi") return localizedText(value, params, UI_COPY_VI, TEXT_VI, PATTERNS_VI);
  if (Object.hasOwn(PARTNER_LABELS_ZH, value)) return fillTemplate(PARTNER_LABELS_ZH[value], params);
  if (Object.hasOwn(UI_COPY, value)) return fillTemplate(UI_COPY[value], params);
  for (const [pattern, format] of PATTERNS) {
    const match = value.match(pattern);
    if (match) return format(...match.slice(1));
  }
  return fillTemplate(value, params);
}

function localizedText(value, params, uiCopyTable, textTable, patternsTable) {
  if (Object.hasOwn(UI_COPY, value)) {
    return fillTemplate(select(uiCopyTable?.[value] ?? UI_COPY[value] ?? value, params), params);
  }
  const contextual = params?.context ? `${params.context}|${value}` : null;
  if (contextual && Object.hasOwn(textTable, contextual)) {
    return fillTemplate(select(textTable[contextual], params), params);
  }
  if (Object.hasOwn(textTable, value)) {
    return fillTemplate(select(textTable[value], params), params);
  }
  for (const [pattern, format] of patternsTable) {
    const match = value.match(pattern);
    if (match) return format(...match.slice(1));
  }
  return fillTemplate(value, params);
}

const HAN = /[㐀-鿿豈-﫿]/;
const missing = new Set();

function englishText(value, params) {
  if (Object.hasOwn(UI_COPY, value)) {
    // An English design key: its English display, else the key itself.
    return fillTemplate(select(UI_COPY_EN[value] ?? value, params), params);
  }
  // A word with two meanings (「關閉」 Close / Off) is told apart by an
  // optional params.context, looked up as "context|source" first.
  const contextual = params?.context ? `${params.context}|${value}` : null;
  if (contextual && Object.hasOwn(TEXT_EN, contextual)) return fillTemplate(select(TEXT_EN[contextual], params), params);
  if (Object.hasOwn(TEXT_EN, value)) return fillTemplate(select(TEXT_EN[value], params), params);
  for (const [pattern, format] of PATTERNS_EN) {
    const match = value.match(pattern);
    if (match) return format(...match.slice(1));
  }
  if (HAN.test(value) && !UNTRANSLATED_PROPER_NOUNS.has(value)) missing.add(value);
  return fillTemplate(value, params);
}

/** An English entry may be `{ one, other }`; `params.count` (or `n`) picks. */
function select(entry, params) {
  if (typeof entry === "string") return entry;
  const count = params?.count ?? params?.n;
  return entry[pluralCategory(count)] ?? entry.other ?? Object.values(entry)[0];
}

/** Replace `{name}` with params.name; numbers are formatted for the language. */
export function fillTemplate(template, params) {
  if (!params || typeof template !== "string" || !template.includes("{")) return template;
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (whole, name) => {
    if (!Object.hasOwn(params, name)) return whole;
    const value = params[name];
    if (value === null || value === undefined) return "";
    return typeof value === "number" ? String(formatNumber(value)) : String(value);
  });
}

/**
 * The text before and after one placeholder of a template, in the current
 * language: templateParts("第 {n} 日") is ["第", "日"] in zh-Hant and
 * ["Day", ""] in English. For layouts that style the value on its own.
 */
export function templateParts(template, name = "n") {
  const marker = "\u0000";
  const text = uiText(template, { [name]: marker });
  const at = text.indexOf(marker);
  if (at < 0) return [text.trim(), ""];
  return [text.slice(0, at).trim(), text.slice(at + marker.length).trim()];
}

/** zh-Hant strings shown in English this session without an English entry. */
export function listMissingTranslations() {
  return [...missing].sort();
}

// ---- Relabelling long-lived chrome after a language switch -------------------
//
// Screens are rebuilt when they mount, so they pick up the language by
// themselves. The chrome that outlives screens (status bar, toolbar, the Home
// view, the title) records which key produced each label, and retranslate()
// re-applies them in place: the page, its selection and its scroll stay put.

const I18N = Symbol.for("championship.i18n");

function remember(node, slot, key, params) {
  if (!node) return;
  (node[I18N] ??= {})[slot] = { key, params: params ?? null };
}

/** Set a node's text from a key and remember it for retranslate(). */
export function setText(node, key, params) {
  if (!node) return node;
  node.textContent = uiText(key, params);
  remember(node, "textContent", key, params);
  return node;
}

/** Set an attribute (aria-label, title, placeholder) from a key and remember it. */
export function setLabel(node, attribute, key, params) {
  if (!node) return node;
  node.setAttribute(attribute, uiText(key, params));
  remember(node, attribute, key, params);
  return node;
}

/** Re-apply every remembered label under `root` in the current language. */
export function retranslate(root) {
  if (!root?.querySelectorAll) return 0;
  let count = 0;
  for (const node of [root, ...root.querySelectorAll("*")]) {
    const labels = node[I18N];
    if (!labels) continue;
    for (const [slot, { key, params }] of Object.entries(labels)) {
      const text = uiText(key, params);
      if (slot === "textContent") {
        // A labelled node that later gained child elements keeps them: only
        // its own first text run is replaced.
        if (node.childElementCount === 0) node.textContent = text;
        else {
          const run = [...node.childNodes].find((child) => child.nodeType === 3);
          if (run) run.data = text;
        }
      } else node.setAttribute(slot, text);
      count += 1;
    }
  }
  return count;
}

const PATTERNS = [
  [/^ID:([A-Z0-9]+)$/, code => `代碼：${code}`],
  [/^Release (.+)\?$/, name => `要放生「${name}」嗎？`],
  [/^Release (.+)$/, name => `放生${name}`],
  [/^Select (.+) biome destination$/, name => `選擇目的地：${name}`],
  [/^Record (\d+)$/, n => `賽事 ${n}`],
  [/^(Spring|Summer|Autumn|Winter) — Day (\d+)$/, (season, day) => `${uiText(season)} · 第 ${day} 日`],
  [/^Required tamer rank: (\d+)\. Check the Battle menu for matches available today\.$/, rank => `需要馴獸師階級 ${rank}。請在對戰選單查看今日開放的賽事。`],
  [/^(\d+) scheduled fixtures across four seasons\.$/, n => `四季合計安排 ${n} 場賽事。`],
  [/^Entry (\d+) — title string (\d+), body string (\d+)\.$/, (entry, title, body) => `條目 ${entry}：標題編號 ${title}，內文編號 ${body}。`],
  [/^Saved game found: (.+)\.$/, name => `找到存檔：${name}。`],
  [/^Could not start a new game: .+$/, () => "無法開始新遊戲，請重新載入後再試一次。"],
  [/^Could not load your saved game: .+$/, () => "無法讀取存檔，請重新載入後再試一次。"],
  [/^Championship 2026 could not start: .+$/, () => "遊戲無法啟動，請重新載入後再試一次。"],
  [/^A saved game was found but this build cannot open it: .+ Start a new game\.$/, () => "找到存檔，但目前版本無法開啟。請開始新遊戲。"],
  [/^Living in (.+)$/, name => `目前位於${uiText(name)}`],
  [/^DESTINATION NODE (\d+)$/, n => `目的地 ${n}`],
  [/^PLUGIN (\d+)$/, n => `外掛程式 ${n}`],
  [/^MATCH (\d+)$/, n => `對戰 ${n}`],
  [/^SLOT (\d+)$/, n => `位置 ${n}`],
  [/^RAW_SLOT_(\d+)$/, n => `未設定欄位 ${n}`],
  [/^RAW (\d+)$/, n => `欄位 ${n}`],
  [/^Unavailable field control (\d+)$/, n => `尚未開放的場地控制 ${n}`],
  [/^RAW_SLOT_(\d+), unbound placeholder$/, n => `欄位 ${n}，尚未設定`],
  [/^([\d,]+) (?:BITS|Bits|bit)$/, n => `${n} 位元幣`],
  [/^Buy (.+)$/, name => `購買${uiText(name)}`],
  [/^Undiscovered slot (\d+)$/, n => `尚未發現的圖鑑位置 ${n}`],
  [/^(REGULAR|EGG) · (.+)$/, (kind, state) => `${uiText(kind)} · ${uiText(state)}`],
  [/^RANK (\d+) · (.+) HEX$/, (rank, n) => `階級 ${rank} · ${n} 格`],
  [/^Empty hex (\d+)$/, n => `空格 ${n}`],
  [/^Locked hex (\d+)$/, n => `尚未開放的格位 ${n}`],
  [/^(.+) on hex (\d+)\. (.*)$/, (name,n,effect) => `第 ${n} 格：${name}。${effect}`],
  [/^Select (.+)\. (.*)$/, (name,effect) => `選擇${name}。${effect}`],
  [/^(\d+) further rows the original shows are not traced yet\.$/, n => `另有 ${n} 個原作欄位的資料來源尚待確認。`],
  [/^(.+) payout, from the title-event record\.$/, name => `${uiText(name)}的設定獎金。`],
  [/^Training Goods (\d+)$/, n => `育成用品 ${n}`],
  [/^Hunt Item (\d+)$/, n => `狩獵道具 ${n}`],
  [/^Plugin (\d+)$/, n => `外掛程式 ${n}`],
  [/^Cage (\d+)$/, n => `育成設施 ${n}`],
  [/^(Tether|Hold Shot|Line|Snare|Charge) (I{1,3})$/, (kind,tier) => `${({Tether:'繩索','Hold Shot':'定身射擊器',Line:'攔阻線',Snare:'誘捕裝置',Charge:'傷害陷阱'})[kind]} ${tier.length}`],
  [/^Card (\d+)G$/, n => `記憶卡 ${n} 容量`],
  [/^(Hp|Tp|Attack|Defense|Speed|Wisdom|Full) Analyzer$/, key => `${({Hp:'生命值',Tp:'技力',Attack:'攻擊',Defense:'防禦',Speed:'速度',Wisdom:'智力',Full:'完整'})[key]}分析器`],
  [/^(.+) Checker$/, key => `${({Full:'完整',Generation:'世代',Alignment:'屬性',Family:'種族',Size:'體型',Capacity:'容量',Resistance:'抗性',Personality:'個性'})[key] ?? '狀態'}檢查器`],
  [/^(Stage Radar|Attribute Radar|Capacity Readout)$/, key => ({'Stage Radar':'世代雷達','Attribute Radar':'屬性雷達','Capacity Readout':'容量顯示器'})[key]],
  [/^(durability|Durability|DURABILITY|length|Length|LENGTH|AMMO|QUANTITY) (.+)$/, (key,n) => `${uiText(key)} ${n}`],
  [/^x(\d+)$/, n => `數量 ${n}`]
];

const TAMER_FIELD_LABELS_ZH = Object.freeze({
  title: '頭銜完成度', guid: '圖鑑完成度', map: '地圖完成度', battle: '對戰次數', win: '勝率',
  name: '名稱', rank: '階級', money: '持有金額', time: '遊玩時間', license: '育成執照', have: '收納容量', cage: '設施格數'
});

export const TAMER_FIELD_LABELS = new Proxy(TAMER_FIELD_LABELS_ZH, {
  get(target, prop) {
    if (typeof prop !== "string") return target[prop];
    const zh = target[prop];
    return zh ? uiText(zh) : undefined;
  }
});



