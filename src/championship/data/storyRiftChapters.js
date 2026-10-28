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
    "PRO_T1_SEA": "人們在網路上留下的每一句話——爭吵、焦慮、期盼——日夜不停，匯成了一片看不見的海。",
    "PRO_T2_WORLD": "經過無數次演算，這片海在網線深處結晶，誕生了會呼吸的世界——網線拍檔的世界。",
    "PRO_T3_NOISE": "但失控的極端情緒凝結成惡意雜訊，撕開次元裂縫。每四年舉辦一次的拍檔錦標賽，再次召集馴獸師。",
    "PRO_T4_INVITE": "{tamer}，邀請函在你的終端亮起。你已取得參賽資格——帶著你的拍檔，去修補這個世界吧。",
    "FR_PARTNER_HELLO": "{tamer}！{tamer}！你來啦！",
    "FR_NAVI_WELCOME": "歡迎來到飼育籠，{tamer} 馴獸師！從今天起，這裡是你和 {partner} 的家。",
    "FR_NAVI_BEFORE": "在前往狩獵場調查雜訊裂縫、挑戰錦標賽之前，有件事比什麼都重要。",
    "FR_NAVI_FEED": "餓著肚子的拍檔可沒辦法戰鬥！先選擇【餵食】工具，好好照顧 {partner} 吧。",
    "C1_NARR_OPEN": "飼育籠的午後很安靜。安靜得，有一點不對勁。",
    "C1_ECHO_1": "只要贏過別人就好了吧…",
    "C1_ECHO_2": "為什麼沒有人看見我…",
    "C1_ECHO_3": "我也很努力了啊…",
    "C1_ECHO_VOICE": "…沒有人看見我。如果贏了，就會有人看見我嗎…",
    "C1_PARTNER_GROWL": "嗚——！退後！那個聲音…好難過…",
    "C1_NAVI_ALARM": "警報！雜訊濃度急升——{tamer}，那是次元裂縫！請勿靠近！",
    "C1_NAVI_EXPLAIN": "惡意雜訊是失控的極端情緒結晶。它會撕開空間，漏出來的，是人們沒說完的話。",
    "C1_CHOICE_PROMPT": "裂縫裡的聲音還在。你要怎麼做？",
    "C1_OPT_REACH": "向那道聲音伸出手",
    "C1_OPT_GUARD": "與 {partner} 一起戒備",
    "C1_REACH_PARTNER": "…不怕。{partner} 也在。我們一起聽它說。",
    "C1_REACH_NAVI": "雜訊波形…變柔和了？{tamer}，你剛才做的事，教科書上可沒寫。",
    "C1_GUARD_PARTNER": "{tamer} 在後面，{partner} 在前面！誰都別想過來！",
    "C1_GUARD_NAVI": "正確判斷！雜訊無法傷害有拍檔守護的人。保持距離，仔細觀察它。",
    "C1_ECHO_FADE": "…有人在聽嗎…",
    "C1_NAVI_DIRECT": "裂縫暫時退去了，但雜訊還在。到狩獵場淨化它，在錦標賽證明自己——這就是馴獸師的工作！",
    "C1_PARTNER_READY": "走吧，{tamer}！去找那個聲音！",
    "C1_NARR_CLOSE": "那天，第一道裂縫在你面前合上。而你知道，它一定會再次打開。"
  },
  "en": {
    "SPEAKER_NAVI": "Tournament Guide NAVI",
    "SPEAKER_PARTNER": "{partner}",
    "SPEAKER_ECHO": "Noise Echo",
    "SPEAKER_NARRATOR": "Narrator",
    "TITLE_PROLOGUE": "Prologue: The Sea of Wires",
    "TITLE_FIRST_RESONANCE": "First Resonance",
    "TITLE_CHAPTER1": "Chapter 1: The First Rift",
    "PRO_T1_SEA": "Every word people leave online — every argument, every worry, every hope — flows night and day into an unseen sea.",
    "PRO_T2_WORLD": "Run through countless computations, that sea crystallized deep within the wires, and a living world was born: the world of cyber partners.",
    "PRO_T3_NOISE": "But runaway extreme emotion condensed into malicious Noise and tore open dimensional rifts. The Partner Tournament, held once every four years, calls its tamers once more.",
    "PRO_T4_INVITE": "{tamer}, an invitation lights up your terminal. You have earned your place in the tournament. Take your partner, and go mend this world.",
    "FR_PARTNER_HELLO": "{tamer}! {tamer}! You came!",
    "FR_NAVI_WELCOME": "Welcome to the habitat cage, Tamer {tamer}! From today, this is home for you and {partner}.",
    "FR_NAVI_BEFORE": "Before you investigate Noise rifts at the hunting grounds or enter the tournament, one thing matters more than anything.",
    "FR_NAVI_FEED": "A hungry partner can't fight! Pick the 【Feed】 tool and take good care of {partner}.",
    "C1_NARR_OPEN": "The afternoon in the habitat cage is quiet. A little too quiet.",
    "C1_ECHO_1": "Just win and it's fine, right...",
    "C1_ECHO_2": "Why does nobody see me...",
    "C1_ECHO_3": "I tried so hard too...",
    "C1_ECHO_VOICE": "...Nobody sees me. If I win... will someone finally see me...",
    "C1_PARTNER_GROWL": "Grr! Stay back! That voice... it hurts so much...",
    "C1_NAVI_ALARM": "Alert! Noise density spiking! {tamer}, that's a dimensional rift! Don't go near it!",
    "C1_NAVI_EXPLAIN": "Malicious Noise is crystallized runaway emotion. It tears space open, and what leaks out is everything people never finished saying.",
    "C1_CHOICE_PROMPT": "The voice in the rift is still there. What will you do?",
    "C1_OPT_REACH": "Reach out to the voice",
    "C1_OPT_GUARD": "Stand guard with {partner}",
    "C1_REACH_PARTNER": "...Not scared. {partner} is here too. Let's listen to it together.",
    "C1_REACH_NAVI": "The Noise waveform is... softening? {tamer}, what you just did isn't in any textbook.",
    "C1_GUARD_PARTNER": "{tamer} behind, {partner} in front! Nobody gets past!",
    "C1_GUARD_NAVI": "Good call! Noise can't harm someone guarded by a partner. Keep your distance and watch it closely.",
    "C1_ECHO_FADE": "...is anyone listening...",
    "C1_NAVI_DIRECT": "The rift has pulled back for now, but the Noise remains. Purify it at the hunting grounds and prove yourself in the tournament. That's a tamer's job!",
    "C1_PARTNER_READY": "Let's go, {tamer}! Let's find that voice!",
    "C1_NARR_CLOSE": "That day, the first rift closed before your eyes. And you knew it would open again."
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
