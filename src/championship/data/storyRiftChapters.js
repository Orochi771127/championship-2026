// Story Rift chapters (OWNER_APPROVED_ADAPTATION 2026-10-28): the original
// "noise rift" story for the hybrid story theater. Script drafted with
// Fable 5.1 against the beat schema below and reviewed by hand. Pure data:
// no imports, no ROM evidence, never a save field. Original names only.
//
// Beat schema (HybridStoryDirector reads exactly these):
//   camera    {target:'partner'|'rift'|'center', zoom, ms}
//   spotlight {on, target}
//   rift      {state:'open'|'pulse'|'close', anchor:'edge-left'|'edge-right'|'sky'}
//   echoes    {keys:[textKey]}            floating comment fragments
//   actor     {who:'partner', action:'walk'|'face'|'idle'|'attack'|'hit'|'hop', toward?}
//   emote     {who:'partner', glyph:'!'|'?'|'...'|'💢'|'🎵'|'⚡'}   pops, holds 300 ms, then the next line
//   line      {speaker, motion, key, label?}
//   choice    {key, options:[{key,next}]}
//   wait      {ms, label?}   jump {next}   end
// Text keys resolve in STORY_RIFT_COPY[locale]; {tamer} and {partner} are filled at play time.

export const STORY_RIFT_SCHEMA_VERSION = 1;
export const STORY_RIFT_LOCALES = Object.freeze(["zh-Hant", "en", "ja", "th", "vi"]);
export const STORY_RIFT_BEAT_TYPES = Object.freeze(["camera", "spotlight", "rift", "echoes", "actor", "emote", "line", "choice", "wait", "jump", "end"]);
export const STORY_RIFT_EMOTES = Object.freeze(["!", "?", "...", "💢", "🎵", "⚡"]);
export const STORY_RIFT_PORTRAIT_MOTIONS = Object.freeze(["idle-breathe", "talk-bounce", "shock-shake", "nod", "silhouette", "noise-glitch"]);
export const STORY_RIFT_CHAPTER_IDS = Object.freeze(["prologue","first-resonance","chapter1-first-rift"]);

const freezeDeep = value => {
  if (Array.isArray(value)) { for (const item of value) freezeDeep(item); return Object.freeze(value); }
  if (value && typeof value === "object") { for (const item of Object.values(value)) freezeDeep(item); return Object.freeze(value); }
  return value;
};

/** Speakers by name key in STORY_RIFT_COPY; the partner is the player's own partner. */
export const STORY_RIFT_SPEAKERS = freezeDeep({"navi":{"nameKey":"SPEAKER_NAVI"},"partner":{"nameKey":"SPEAKER_PARTNER"},"echo":{"nameKey":"SPEAKER_ECHO"},"narrator":{"nameKey":"SPEAKER_NARRATOR"}});

export const STORY_RIFT_CHAPTERS = freezeDeep({
  "prologue": {
    titleKey: "TITLE_PROLOGUE",
    beats: [
      {"type":"line","speaker":"narrator","motion":"idle-breathe","key":"PRO_T1_SEA"},
      {"type":"line","speaker":"narrator","motion":"idle-breathe","key":"PRO_T2_WORLD"},
      {"type":"line","speaker":"narrator","motion":"noise-glitch","key":"PRO_T3_NOISE"},
      {"type":"line","speaker":"narrator","motion":"idle-breathe","key":"PRO_T4_INVITE"},
      {"type":"end"}
    ]
  },
  "first-resonance": {
    titleKey: "TITLE_FIRST_RESONANCE",
    beats: [
      {"type":"camera","target":"partner","zoom":1.2,"ms":700},
      {"type":"emote","who":"partner","glyph":"🎵"},
      {"type":"actor","who":"partner","action":"hop","toward":"player"},
      {"type":"line","speaker":"partner","motion":"talk-bounce","key":"FR_PARTNER_HELLO"},
      {"type":"line","speaker":"navi","motion":"talk-bounce","key":"FR_NAVI_WELCOME"},
      {"type":"line","speaker":"navi","motion":"nod","key":"FR_NAVI_BEFORE"},
      {"type":"line","speaker":"navi","motion":"talk-bounce","key":"FR_NAVI_FEED"},
      {"type":"end"}
    ]
  },
  "chapter1-first-rift": {
    titleKey: "TITLE_CHAPTER1",
    beats: [
      {"type":"line","speaker":"narrator","motion":"idle-breathe","key":"C1_NARR_OPEN"},
      {"type":"rift","state":"open","anchor":"edge-left"},
      {"type":"camera","target":"rift","zoom":1.3,"ms":900},
      {"type":"spotlight","on":true,"target":"rift"},
      {"type":"echoes","keys":["C1_ECHO_1","C1_ECHO_2","C1_ECHO_3"]},
      {"type":"line","speaker":"echo","motion":"noise-glitch","key":"C1_ECHO_VOICE"},
      {"type":"actor","who":"partner","action":"face","toward":"rift"},
      {"type":"emote","who":"partner","glyph":"!"},
      {"type":"actor","who":"partner","action":"attack","toward":"rift"},
      {"type":"line","speaker":"partner","motion":"talk-bounce","key":"C1_PARTNER_GROWL"},
      {"type":"line","speaker":"navi","motion":"shock-shake","key":"C1_NAVI_ALARM"},
      {"type":"line","speaker":"navi","motion":"nod","key":"C1_NAVI_EXPLAIN"},
      {"type":"choice","key":"C1_CHOICE_PROMPT","options":[{"key":"C1_OPT_REACH","next":"reach"},{"key":"C1_OPT_GUARD","next":"guard"}]},
      {"type":"line","speaker":"partner","motion":"idle-breathe","key":"C1_REACH_PARTNER","label":"reach"},
      {"type":"line","speaker":"navi","motion":"nod","key":"C1_REACH_NAVI"},
      {"type":"jump","next":"rejoin"},
      {"type":"line","speaker":"partner","motion":"talk-bounce","key":"C1_GUARD_PARTNER","label":"guard"},
      {"type":"line","speaker":"navi","motion":"talk-bounce","key":"C1_GUARD_NAVI"},
      {"type":"wait","ms":400,"label":"rejoin"},
      {"type":"rift","state":"pulse","anchor":"edge-left"},
      {"type":"line","speaker":"echo","motion":"silhouette","key":"C1_ECHO_FADE"},
      {"type":"rift","state":"close","anchor":"edge-left"},
      {"type":"spotlight","on":false,"target":"rift"},
      {"type":"camera","target":"center","zoom":1,"ms":800},
      {"type":"line","speaker":"navi","motion":"talk-bounce","key":"C1_NAVI_DIRECT"},
      {"type":"line","speaker":"partner","motion":"talk-bounce","key":"C1_PARTNER_READY"},
      {"type":"line","speaker":"narrator","motion":"idle-breathe","key":"C1_NARR_CLOSE"},
      {"type":"end"}
    ]
  }
});

/** Scoped five-locale dictionary; scripts/check-locale-coverage.mjs registers it. */
export const STORY_RIFT_COPY = freezeDeep({
  "zh-Hant": {
    "SPEAKER_NAVI": "大會導覽 NAVI",
    "SPEAKER_PARTNER": "{partner}",
    "SPEAKER_ECHO": "雜訊殘響",
    "SPEAKER_NARRATOR": "旁白",
    "TITLE_PROLOGUE": "序章：網線之海",
    "TITLE_FIRST_RESONANCE": "第一次共鳴",
    "TITLE_CHAPTER1": "第一章：初遇裂縫",
    "PRO_T1_SEA": "無數留在網路上的話語——爭吵、嘆息、微弱的期盼——日夜奔流，在暗處匯成一片看不見的海。",
    "PRO_T2_WORLD": "千萬次演算後，這片海在網線最深處結出大地與微風，誕生了會呼吸的「網線拍檔世界」。",
    "PRO_T3_NOISE": "可失控的怨念卻凝成雜訊，撕開次元裂縫。每四年舉辦一次的拍檔錦標賽，再次向馴獸師發出召集令。",
    "PRO_T4_INVITE": "{tamer}，終端亮起了微光。你已取得參賽資格——握緊拍檔的手，去修補這座快被撕裂的世界吧。",
    "FR_PARTNER_HELLO": "{tamer}！{tamer}！你終於來啦！",
    "FR_NAVI_WELCOME": "歡迎進駐專屬飼育籠，{tamer} 馴獸師！從今天起，這裡就是你跟 {partner} 的牧場基地囉！",
    "FR_NAVI_BEFORE": "不過在闖進狩獵場追查裂縫、拚錦標賽之前，有一件事比什麼都急！",
    "FR_NAVI_FEED": "空著肚子的拍檔可打不動架！先點【餵食】工具，給 {partner} 端上第一頓大餐吧！",
    "C1_NARR_OPEN": "牧場的午後靜悄悄的。安靜得……連風吹過草葉的聲音都突然斷了。",
    "C1_ECHO_1": "只要贏過別人就好了吧…",
    "C1_ECHO_2": "為什麼沒有人看見我…",
    "C1_ECHO_3": "明明我也很努力了啊…",
    "C1_ECHO_VOICE": "……沒人看我一眼。要是拿了冠軍，就會有人記住我了嗎……",
    "C1_PARTNER_GROWL": "嗚——！站後面！那股聲音……聽起來好痛、好難過……",
    "C1_NAVI_ALARM": "緊急警報！雜訊飆破臨界值——{tamer}，那是次元裂縫！快退後！",
    "C1_NAVI_EXPLAIN": "那是沒被接住的情緒凝成的雜訊。一旦撕開空間，漏出來的全是人們吞進肚裡的話。",
    "C1_CHOICE_PROMPT": "裂縫裡細碎的哭聲還沒停。你打算怎麼做？",
    "C1_OPT_REACH": "朝那道發抖的聲音伸出手",
    "C1_OPT_GUARD": "和 {partner} 並肩戒備",
    "C1_REACH_PARTNER": "……不抖了。{partner} 也在旁邊。我們陪你把話說完。",
    "C1_REACH_NAVI": "波形居然……安靜下來了？！{tamer}，你這招手冊裡可沒教過啊。",
    "C1_GUARD_PARTNER": "{tamer} 退後，{partner} 頂在前面！誰都別想越過這條線！",
    "C1_GUARD_NAVI": "冷靜的判斷！只要拍檔守著你，雜訊就傷不了人。盯緊它的動向！",
    "C1_ECHO_FADE": "……真的，有人在聽嗎……",
    "C1_NAVI_DIRECT": "裂縫暫時縮回去了，但雜訊源頭還在野外。去狩獵場淨化它、在賽場證明自己吧！",
    "C1_PARTNER_READY": "走吧，{tamer}！順著風，我們把那個聲音找回來！",
    "C1_NARR_CLOSE": "那道暗紫色的裂縫在午後微風裡慢慢合攏。只是你心裡清楚——它絕不會只開這一次。"
  },
  "en": {
    "SPEAKER_NAVI": "Tournament Guide NAVI",
    "SPEAKER_PARTNER": "{partner}",
    "SPEAKER_ECHO": "Noise Echo",
    "SPEAKER_NARRATOR": "Narrator",
    "TITLE_PROLOGUE": "Prologue: The Sea of Wires",
    "TITLE_FIRST_RESONANCE": "First Resonance",
    "TITLE_CHAPTER1": "Chapter 1: The First Rift",
    "PRO_T1_SEA": "Countless words left on the net — arguments, sighs, quiet hopes — stream day and night into an unseen sea.",
    "PRO_T2_WORLD": "Through a billion cycles, that sea condensed into soil and wind deep inside the wires, birthing the living Cyber Partner World.",
    "PRO_T3_NOISE": "Yet runaway resentment hardened into Noise, ripping rifts through space. Once every four years, the Partner Tournament sounds its call again.",
    "PRO_T4_INVITE": "{tamer}, your terminal glows softly. You've earned your entry — take your partner's hand and mend this fraying world.",
    "FR_PARTNER_HELLO": "{tamer}! {tamer}! You came!",
    "FR_NAVI_WELCOME": "Welcome to your private habitat cage, Tamer {tamer}! From today on, this is home base for you and {partner}!",
    "FR_NAVI_BEFORE": "Before you charge into hunting grounds after rifts or sign up for the tournament, one thing comes first!",
    "FR_NAVI_FEED": "No partner fights on an empty stomach! Pick the 【Feed】 tool and serve {partner} its very first feast!",
    "C1_NARR_OPEN": "Afternoon settles quietly over the ranch. So quiet... even the breeze through the grass suddenly cuts off.",
    "C1_ECHO_1": "Just win and it's fine, right...",
    "C1_ECHO_2": "Why does nobody see me...",
    "C1_ECHO_3": "I tried so hard too...",
    "C1_ECHO_VOICE": "...Nobody even looks my way. If I take the trophy, will someone finally remember me...?",
    "C1_PARTNER_GROWL": "Grr—! Get behind me! That voice... it sounds so hurt, so lonely...",
    "C1_NAVI_ALARM": "Red alert! Noise spiking off the charts — {tamer}, that's a dimensional rift! Back up!",
    "C1_NAVI_EXPLAIN": "That's Noise forged from emotions nobody caught. When it tears space open, every swallowed word spills out.",
    "C1_CHOICE_PROMPT": "The trembling sobs inside the rift won't stop. What do you do?",
    "C1_OPT_REACH": "Reach toward the trembling voice",
    "C1_OPT_GUARD": "Stand guard beside {partner}",
    "C1_REACH_PARTNER": "...No more shaking. {partner} is right here too. We'll stay till you say it all.",
    "C1_REACH_NAVI": "Wait — the waveform actually calmed down?! {tamer}, they definitely never taught that move in the manual!",
    "C1_GUARD_PARTNER": "{tamer}, stay back — {partner} has the front! Nothing's crossing this line!",
    "C1_GUARD_NAVI": "Cool head! As long as your partner shields you, the Noise can't touch you. Watch its next move!",
    "C1_ECHO_FADE": "...Wait — is someone really listening...?",
    "C1_NAVI_DIRECT": "The rift drew back for now, but the source is still out in the wild. Purify it on hunts and prove yourself in the arena!",
    "C1_PARTNER_READY": "Come on, {tamer}! Let's follow the wind and bring that voice home!",
    "C1_NARR_CLOSE": "The violet tear slowly stitched itself shut in the afternoon breeze. Still, you knew — it wouldn't be the last."
  },
  "ja": {
    "SPEAKER_NAVI": "大会ナビ NAVI",
    "SPEAKER_PARTNER": "{partner}",
    "SPEAKER_ECHO": "ノイズの残響",
    "SPEAKER_NARRATOR": "ナレーション",
    "TITLE_PROLOGUE": "序章：ネットワークの海",
    "TITLE_FIRST_RESONANCE": "はじめての共鳴",
    "TITLE_CHAPTER1": "第一章：はじめての裂け目",
    "PRO_T1_SEA": "人々がネットに残した言葉——争い、不安、願い——は昼も夜も流れ続け、見えない海になった。",
    "PRO_T2_WORLD": "数えきれない演算を経て、その海はネットワークの奥で結晶し、呼吸する世界が生まれた。ネットワークパートナーの世界だ。",
    "PRO_T3_NOISE": "だが暴走した極端な感情は悪意のノイズとなり、次元の裂け目を引き裂いた。四年に一度のパートナー選手権が、再びテイマーを招集する。",
    "PRO_T4_INVITE": "{tamer}、端末に招待状が灯る。参加資格は手に入れた。パートナーと共に、この世界を繋ぎ直しに行こう。",
    "FR_PARTNER_HELLO": "{tamer}！{tamer}！来てくれた！",
    "FR_NAVI_WELCOME": "飼育ケージへようこそ、テイマー{tamer}！今日からここが、あなたと{partner}の家です。",
    "FR_NAVI_BEFORE": "狩猟場でノイズの裂け目を調査したり、選手権に挑む前に、何より大切なことがあります。",
    "FR_NAVI_FEED": "お腹が空いたパートナーは戦えません！まず【えさ】ツールを選んで、{partner}をしっかり世話してあげましょう。",
    "C1_NARR_OPEN": "飼育ケージの午後は静かだった。少しだけ、静かすぎた。",
    "C1_ECHO_1": "勝てばいいんでしょ…",
    "C1_ECHO_2": "どうして誰も見てくれないの…",
    "C1_ECHO_3": "私だって頑張ったのに…",
    "C1_ECHO_VOICE": "…誰も私を見てくれない。勝ったら、誰かが見てくれるの…",
    "C1_PARTNER_GROWL": "うぅ——！さがって！あの声…すごく、かなしい…",
    "C1_NAVI_ALARM": "警報！ノイズ濃度が急上昇——{tamer}、あれは次元の裂け目です！近づかないで！",
    "C1_NAVI_EXPLAIN": "悪意のノイズは暴走した感情の結晶。空間を引き裂き、そこから漏れ出すのは、人々が言い切れなかった言葉です。",
    "C1_CHOICE_PROMPT": "裂け目の声はまだ続いている。どうする？",
    "C1_OPT_REACH": "その声に手を伸ばす",
    "C1_OPT_GUARD": "{partner}と一緒に身構える",
    "C1_REACH_PARTNER": "…こわくない。{partner}もいる。いっしょに聞いてあげよう。",
    "C1_REACH_NAVI": "ノイズの波形が…和らいだ？{tamer}、今のは教科書に載っていませんよ。",
    "C1_GUARD_PARTNER": "{tamer}はうしろ、{partner}はまえ！だれも通さない！",
    "C1_GUARD_NAVI": "正しい判断です！パートナーに守られた人をノイズは傷つけられません。距離を保ち、よく観察して。",
    "C1_ECHO_FADE": "…誰か聞いてる…？",
    "C1_NAVI_DIRECT": "裂け目は一時退きましたが、ノイズは残っています。狩猟場で浄化し、選手権で己を示す——それがテイマーの仕事です！",
    "C1_PARTNER_READY": "行こう、{tamer}！あの声をさがしに！",
    "C1_NARR_CLOSE": "その日、最初の裂け目は目の前で閉じた。そして君は知っていた——それは必ず、また開く。"
  },
  "th": {
    "SPEAKER_NAVI": "ไกด์การแข่งขัน NAVI",
    "SPEAKER_PARTNER": "{partner}",
    "SPEAKER_ECHO": "เสียงสะท้อนแห่งนอยซ์",
    "SPEAKER_NARRATOR": "ผู้บรรยาย",
    "TITLE_PROLOGUE": "บทนำ: ทะเลแห่งสายเน็ต",
    "TITLE_FIRST_RESONANCE": "การสั่นพ้องครั้งแรก",
    "TITLE_CHAPTER1": "บทที่ 1: รอยแยกแรก",
    "PRO_T1_SEA": "ทุกถ้อยคำที่ผู้คนทิ้งไว้บนโลกออนไลน์ ทั้งการทะเลาะ ความกังวล และความหวัง ไหลรวมกันทั้งวันทั้งคืนเป็นทะเลที่มองไม่เห็น",
    "PRO_T2_WORLD": "ผ่านการคำนวณนับไม่ถ้วน ทะเลนั้นตกผลึกอยู่ลึกในสายเน็ต และโลกที่มีชีวิตก็ถือกำเนิดขึ้น นั่นคือโลกของไซเบอร์พาร์ตเนอร์",
    "PRO_T3_NOISE": "แต่อารมณ์สุดขั้วที่ควบคุมไม่ได้กลั่นตัวเป็นนอยซ์ร้าย ฉีกรอยแยกมิติให้เปิดออก การแข่งขันพาร์ตเนอร์ที่จัดขึ้นทุกสี่ปี เรียกเทมเมอร์กลับมาอีกครั้ง",
    "PRO_T4_INVITE": "{tamer} จดหมายเชิญสว่างขึ้นบนเทอร์มินัลของคุณ คุณได้สิทธิ์เข้าแข่งขันแล้ว พาพาร์ตเนอร์ของคุณไปซ่อมแซมโลกใบนี้กันเถอะ",
    "FR_PARTNER_HELLO": "{tamer}! {tamer}! มาแล้ว!",
    "FR_NAVI_WELCOME": "ยินดีต้อนรับสู่กรงเลี้ยง เทมเมอร์ {tamer}! ตั้งแต่วันนี้ ที่นี่คือบ้านของคุณกับ {partner}",
    "FR_NAVI_BEFORE": "ก่อนจะไปสำรวจรอยแยกนอยซ์ที่สนามล่าหรือลงแข่งขัน มีสิ่งหนึ่งที่สำคัญกว่าอะไรทั้งหมด",
    "FR_NAVI_FEED": "พาร์ตเนอร์ที่หิวสู้ไม่ได้หรอก! เลือกเครื่องมือ【ให้อาหาร】แล้วดูแล {partner} ให้ดีกันเถอะ",
    "C1_NARR_OPEN": "บ่ายวันนั้นในกรงเลี้ยงเงียบสงบ เงียบจนรู้สึกแปลกไปนิดหน่อย",
    "C1_ECHO_1": "แค่ชนะคนอื่นก็พอแล้วใช่ไหม…",
    "C1_ECHO_2": "ทำไมไม่มีใครมองเห็นฉัน…",
    "C1_ECHO_3": "ฉันก็พยายามแล้วนะ…",
    "C1_ECHO_VOICE": "…ไม่มีใครมองเห็นฉัน ถ้าชนะ จะมีใครมองเห็นฉันไหม…",
    "C1_PARTNER_GROWL": "กรร! ถอยไป! เสียงนั้น… เศร้าเหลือเกิน…",
    "C1_NAVI_ALARM": "เตือนภัย! ความเข้มข้นของนอยซ์พุ่งสูง {tamer} นั่นคือรอยแยกมิติ! อย่าเข้าใกล้!",
    "C1_NAVI_EXPLAIN": "นอยซ์ร้ายคือผลึกของอารมณ์สุดขั้วที่ควบคุมไม่ได้ มันฉีกพื้นที่ออก และสิ่งที่รั่วออกมาคือคำพูดที่ผู้คนยังพูดไม่จบ",
    "C1_CHOICE_PROMPT": "เสียงในรอยแยกยังอยู่ คุณจะทำอย่างไร?",
    "C1_OPT_REACH": "ยื่นมือออกไปหาเสียงนั้น",
    "C1_OPT_GUARD": "ตั้งรับไปพร้อมกับ {partner}",
    "C1_REACH_PARTNER": "…ไม่กลัว {partner} อยู่ตรงนี้ด้วย มาฟังมันด้วยกันนะ",
    "C1_REACH_NAVI": "คลื่นนอยซ์… อ่อนลงงั้นเหรอ? {tamer} สิ่งที่คุณเพิ่งทำ ไม่มีในตำราเล่มไหนเลย",
    "C1_GUARD_PARTNER": "{tamer} อยู่ข้างหลัง {partner} อยู่ข้างหน้า! ห้ามใครผ่านมา!",
    "C1_GUARD_NAVI": "ตัดสินใจถูกต้อง! นอยซ์ทำร้ายคนที่มีพาร์ตเนอร์คุ้มกันไม่ได้ รักษาระยะห่างแล้วสังเกตมันให้ดี",
    "C1_ECHO_FADE": "…มีใครฟังอยู่ไหม…",
    "C1_NAVI_DIRECT": "รอยแยกถอยไปชั่วคราว แต่นอยซ์ยังอยู่ ไปชำระล้างมันที่สนามล่า แล้วพิสูจน์ตัวเองในการแข่งขัน นั่นคืองานของเทมเมอร์!",
    "C1_PARTNER_READY": "ไปกันเถอะ {tamer}! ไปตามหาเสียงนั้นกัน!",
    "C1_NARR_CLOSE": "วันนั้น รอยแยกแรกปิดลงต่อหน้าคุณ และคุณรู้ดีว่า มันจะเปิดขึ้นอีกครั้งแน่นอน"
  },
  "vi": {
    "SPEAKER_NAVI": "Hướng dẫn giải đấu NAVI",
    "SPEAKER_PARTNER": "{partner}",
    "SPEAKER_ECHO": "Dư âm Nhiễu",
    "SPEAKER_NARRATOR": "Người dẫn chuyện",
    "TITLE_PROLOGUE": "Mở đầu: Biển Dây Mạng",
    "TITLE_FIRST_RESONANCE": "Cộng hưởng đầu tiên",
    "TITLE_CHAPTER1": "Chương 1: Khe nứt đầu tiên",
    "PRO_T1_SEA": "Mỗi lời người ta để lại trên mạng — mỗi cuộc cãi vã, mỗi nỗi lo, mỗi hy vọng — ngày đêm đổ về, hợp thành một đại dương vô hình.",
    "PRO_T2_WORLD": "Qua vô số lần tính toán, đại dương ấy kết tinh sâu trong lòng dây mạng, và một thế giới biết thở ra đời: thế giới của những Cộng sự Mạng.",
    "PRO_T3_NOISE": "Nhưng cảm xúc cực đoan mất kiểm soát đã ngưng tụ thành Nhiễu độc hại, xé toạc những khe nứt chiều không gian. Giải đấu Cộng sự tổ chức bốn năm một lần lại triệu tập các tamer.",
    "PRO_T4_INVITE": "{tamer}, một thư mời sáng lên trên thiết bị của bạn. Bạn đã giành được quyền tham dự. Hãy cùng cộng sự của mình đi hàn gắn thế giới này.",
    "FR_PARTNER_HELLO": "{tamer}! {tamer}! Bạn đến rồi!",
    "FR_NAVI_WELCOME": "Chào mừng đến lồng nuôi, tamer {tamer}! Từ hôm nay, đây là nhà của bạn và {partner}.",
    "FR_NAVI_BEFORE": "Trước khi đến bãi săn điều tra khe nứt Nhiễu hay thử sức ở giải đấu, có một việc quan trọng hơn tất cả.",
    "FR_NAVI_FEED": "Cộng sự đói bụng thì không chiến đấu được đâu! Hãy chọn công cụ【Cho ăn】và chăm sóc {partner} thật tốt nhé.",
    "C1_NARR_OPEN": "Buổi chiều trong lồng nuôi thật yên tĩnh. Yên tĩnh đến mức có gì đó không ổn.",
    "C1_ECHO_1": "Chỉ cần thắng người khác là được, phải không…",
    "C1_ECHO_2": "Sao chẳng ai nhìn thấy tôi…",
    "C1_ECHO_3": "Tôi cũng đã cố gắng lắm rồi mà…",
    "C1_ECHO_VOICE": "…Chẳng ai nhìn thấy tôi. Nếu thắng, sẽ có người nhìn thấy tôi chứ…",
    "C1_PARTNER_GROWL": "Grừ! Lùi lại! Giọng nói đó… buồn quá…",
    "C1_NAVI_ALARM": "Báo động! Mật độ Nhiễu tăng vọt — {tamer}, đó là khe nứt chiều không gian! Đừng đến gần!",
    "C1_NAVI_EXPLAIN": "Nhiễu độc hại là kết tinh của cảm xúc cực đoan mất kiểm soát. Nó xé rách không gian, và thứ rò ra là những lời con người chưa nói hết.",
    "C1_CHOICE_PROMPT": "Giọng nói trong khe nứt vẫn còn đó. Bạn sẽ làm gì?",
    "C1_OPT_REACH": "Đưa tay về phía giọng nói ấy",
    "C1_OPT_GUARD": "Cùng {partner} cảnh giác",
    "C1_REACH_PARTNER": "…Không sợ. Có {partner} ở đây nữa. Mình cùng lắng nghe nó nhé.",
    "C1_REACH_NAVI": "Dạng sóng Nhiễu… dịu lại rồi sao? {tamer}, điều bạn vừa làm không có trong sách giáo khoa nào đâu.",
    "C1_GUARD_PARTNER": "{tamer} ở sau, {partner} ở trước! Không ai được qua đây!",
    "C1_GUARD_NAVI": "Phán đoán chính xác! Nhiễu không thể làm hại người được cộng sự bảo vệ. Giữ khoảng cách và quan sát nó thật kỹ.",
    "C1_ECHO_FADE": "…có ai đang nghe không…",
    "C1_NAVI_DIRECT": "Khe nứt tạm rút đi, nhưng Nhiễu vẫn còn. Hãy thanh lọc nó ở bãi săn và chứng tỏ mình tại giải đấu — đó là công việc của tamer!",
    "C1_PARTNER_READY": "Đi thôi, {tamer}! Đi tìm giọng nói đó!",
    "C1_NARR_CLOSE": "Ngày hôm ấy, khe nứt đầu tiên khép lại trước mắt bạn. Và bạn biết, nó nhất định sẽ mở ra lần nữa."
  }
});

export function storyRiftChapter(chapterId) {
  return Object.hasOwn(STORY_RIFT_CHAPTERS, chapterId) ? STORY_RIFT_CHAPTERS[chapterId] : null;
}

/** Fills {tamer} / {partner}; a missing key returns null so a caller can refuse. */
export function storyRiftText(key, locale = "zh-Hant", params = {}) {
  const table = STORY_RIFT_COPY[locale] ?? STORY_RIFT_COPY["zh-Hant"];
  const text = table?.[key] ?? STORY_RIFT_COPY["zh-Hant"][key];
  if (typeof text !== "string") return null;
  return text.replace(/{(tamer|partner)}/g, (_, name) => String(params[name] ?? ""));
}

export function storyRiftSpeakerName(speakerId, locale = "zh-Hant", params = {}) {
  const speaker = STORY_RIFT_SPEAKERS[speakerId];
  return speaker ? storyRiftText(speaker.nameKey, locale, params) : null;
}
export function storyRiftChapterTitle(chapterId, locale = "zh-Hant") {
  const chapter = storyRiftChapter(chapterId);
  return chapter ? storyRiftText(chapter.titleKey, locale) : null;
}

/** Structural check used by the unit tests and by the director before play. */
export function validateStoryRiftChapter(chapter) {
  const problems = [];
  if (!chapter || !Array.isArray(chapter.beats) || chapter.beats.length === 0) return ["NO_BEATS"];
  const labels = new Set(chapter.beats.map(beat => beat.label).filter(Boolean));
  chapter.beats.forEach((beat, index) => {
    if (!STORY_RIFT_BEAT_TYPES.includes(beat.type)) problems.push(`BEAT_${index}_TYPE`);
    if (beat.type === "line" && (!STORY_RIFT_SPEAKERS[beat.speaker] || !STORY_RIFT_PORTRAIT_MOTIONS.includes(beat.motion))) problems.push(`BEAT_${index}_LINE`);
    if (beat.type === "emote" && !STORY_RIFT_EMOTES.includes(beat.glyph)) problems.push(`BEAT_${index}_EMOTE`);
    if (beat.type === "jump" && !labels.has(beat.next)) problems.push(`BEAT_${index}_JUMP`);
    if (beat.type === "choice") for (const option of beat.options ?? []) if (!labels.has(option.next)) problems.push(`BEAT_${index}_CHOICE`);
    for (const key of beat.type === "echoes" ? beat.keys ?? [] : beat.type === "choice" ? [beat.key, ...(beat.options ?? []).map(o => o.key)] : beat.key ? [beat.key] : []) {
      for (const locale of STORY_RIFT_LOCALES) if (typeof STORY_RIFT_COPY[locale]?.[key] !== "string") problems.push(`KEY_${key}_${locale}`);
    }
  });
  if (chapter.beats.at(-1)?.type !== "end") problems.push("NO_END");
  return problems;
}
