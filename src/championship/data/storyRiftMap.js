// Rift observation chart (OWNER_APPROVED_ADAPTATION 2026-10-28): the chapter
// map the story theater opens on. Pure data: the coordinates of each chapter
// node on the chart, which story chapter (if any) it plays, the device-scope
// preference that remembers it was watched, and its copy in the five locales.
// Nodes without a chapter are reserved coordinates for chapters not written
// yet; they show on the chart but never play. No imports, never a save field.
//
// Node schema:
//   id          stable node id
//   chapterId   a STORY_RIFT_CHAPTERS id, or null for a reserved coordinate
//   kind        'prologue' | 'interlude' | 'chapter' | 'unknown'
//   number      chapter number for kind 'chapter'
//   x, y        position on the chart, in percent of its width and height
//   seenKey     preference id that turns true once the chapter was watched or skipped
//   seenWith    'opening' when the new-game opening and tutorial already show it
//   titleKey, summaryKey, sigilKey   keys into STORY_RIFT_MAP_COPY
//   theme       the chart tint around the node: 'sea' | 'ranch' | 'track' | 'oasis' | 'core' | 'void'

export const STORY_RIFT_MAP_SCHEMA_VERSION = 1;
export const STORY_RIFT_MAP_LOCALES = Object.freeze(["zh-Hant", "en", "ja", "th", "vi"]);

const freezeDeep = value => {
  if (Array.isArray(value)) { for (const item of value) freezeDeep(item); return Object.freeze(value); }
  if (value && typeof value === "object") { for (const item of Object.values(value)) freezeDeep(item); return Object.freeze(value); }
  return value;
};

export const STORY_RIFT_MAP_NODES = freezeDeep([
  { id: "prologue", chapterId: "prologue", kind: "prologue", number: 0, x: 22, y: 86, seenKey: null, seenWith: "opening", theme: "sea",
    titleKey: "NODE_PROLOGUE_TITLE", summaryKey: "NODE_PROLOGUE_SUMMARY", sigilKey: "SIGIL_PROLOGUE" },
  { id: "first-resonance", chapterId: "first-resonance", kind: "interlude", number: 0, x: 66, y: 76, seenKey: null, seenWith: "opening", theme: "ranch",
    titleKey: "NODE_RESONANCE_TITLE", summaryKey: "NODE_RESONANCE_SUMMARY", sigilKey: "SIGIL_RESONANCE" },
  { id: "chapter1", chapterId: "chapter1-first-rift", kind: "chapter", number: 1, x: 32, y: 62, seenKey: "storyRiftChapter1Seen", theme: "ranch",
    titleKey: "NODE_C1_TITLE", summaryKey: "NODE_C1_SUMMARY", sigilKey: "SIGIL_C1" },
  { id: "chapter2", chapterId: null, kind: "chapter", number: 2, x: 70, y: 47, seenKey: null, theme: "track",
    titleKey: "NODE_C2_TITLE", summaryKey: "NODE_C2_SUMMARY", sigilKey: "SIGIL_RESERVED" },
  { id: "chapter3", chapterId: null, kind: "chapter", number: 3, x: 28, y: 33, seenKey: null, theme: "oasis",
    titleKey: "NODE_C3_TITLE", summaryKey: "NODE_C3_SUMMARY", sigilKey: "SIGIL_RESERVED" },
  { id: "chapter4", chapterId: null, kind: "chapter", number: 4, x: 64, y: 19, seenKey: null, theme: "core",
    titleKey: "NODE_C4_TITLE", summaryKey: "NODE_C4_SUMMARY", sigilKey: "SIGIL_RESERVED" },
  { id: "beyond", chapterId: null, kind: "unknown", number: 0, x: 38, y: 7, seenKey: null, theme: "void",
    titleKey: "NODE_BEYOND_TITLE", summaryKey: "NODE_BEYOND_SUMMARY", sigilKey: "SIGIL_RESERVED" }
]);

export const STORY_RIFT_MAP_COPY = freezeDeep({
  "zh-Hant": {
    "MAP_KICKER": "裂縫觀測",
    "MAP_TITLE": "裂縫觀測星圖",
    "MAP_SUBTITLE": "沿著相位航線，選一個觀測座標。",
    "MAP_PROGRESS": "已觀測 {seen} / {total}",
    "MAP_CLOSE": "返回牧場",
    "MAP_PLAY": "開始觀測",
    "MAP_REPLAY": "再次觀測",
    "MAP_LOCKED_ACTION": "訊號未接通",
    "MAP_STATUS_CURRENT": "進行中",
    "MAP_STATUS_SEEN": "已觀測",
    "MAP_STATUS_OPEN": "可觀測",
    "MAP_STATUS_LOCKED": "未解鎖",
    "MAP_LABEL_PROGRESS": "觀測進度",
    "MAP_LABEL_CAST": "登場殘響",
    "MAP_LABEL_REWARD": "首通獎勵",
    "MAP_LABEL_UNLOCK": "解鎖條件",
    "MAP_PROGRESS_DONE": "觀測完成",
    "MAP_PROGRESS_NONE": "尚未觀測",
    "MAP_PROGRESS_SIGNAL": "訊號校準中",
    "MAP_REWARD_NOTE": "觀測徽記會點亮星圖上的這個座標。",
    "MAP_UNLOCK_NEXT": "完成上一個座標後，等待新的觀測訊號。",
    "MAP_CAST_UNKNOWN": "？？？",
    "MAP_JUST_SEEN": "觀測徽記已點亮",
    "MAP_REFUSED": "現在無法開始觀測，請回到牧場後再試一次。",
    "NUM_PROLOGUE": "序章",
    "NUM_INTERLUDE": "幕間",
    "NUM_CHAPTER": "第 {n} 章",
    "NUM_UNKNOWN": "未知座標",
    "NODE_PROLOGUE_TITLE": "網線之海",
    "NODE_PROLOGUE_SUMMARY": "人們留在網路上的話語匯成一片看不見的海，在網線深處結晶成拍檔的世界，也凝出撕開裂縫的惡意雜訊。",
    "NODE_RESONANCE_TITLE": "第一次共鳴",
    "NODE_RESONANCE_SUMMARY": "你和拍檔在飼育籠裡的第一次相遇。出發調查裂縫之前，NAVI 有件事要先交代。",
    "NODE_C1_TITLE": "初遇裂縫",
    "NODE_C1_SUMMARY": "安靜的午後，飼育籠邊緣裂開了一道縫。裡面傳出的聲音，像是誰沒說完的話。",
    "NODE_C2_TITLE": "運動場的殘響",
    "NODE_C2_SUMMARY": "運動場的跑道上，殘響一圈又一圈地奔跑，好像在等誰喊它停下。",
    "NODE_C3_TITLE": "綠洲異變",
    "NODE_C3_SUMMARY": "綠洲的水面映出一片不屬於這裡的天空，水底有雜訊在低語。",
    "NODE_C4_TITLE": "心核共鳴",
    "NODE_C4_SUMMARY": "所有殘響的源頭，都指向拍檔的心核。那裡藏著它最初聽見的聲音。",
    "NODE_BEYOND_TITLE": "未知訊號",
    "NODE_BEYOND_SUMMARY": "星圖邊緣還有更遠的座標，訊號太弱，暫時無法解讀。",
    "SIGIL_PROLOGUE": "觀測徽記「網線之海」",
    "SIGIL_RESONANCE": "觀測徽記「初次共鳴」",
    "SIGIL_C1": "觀測徽記「第一道裂縫」",
    "SIGIL_RESERVED": "待公開"
  },
  "en": {
    "MAP_KICKER": "Rift watch",
    "MAP_TITLE": "Rift Observation Chart",
    "MAP_SUBTITLE": "Follow the phase lanes and pick a coordinate to observe.",
    "MAP_PROGRESS": "Observed {seen} / {total}",
    "MAP_CLOSE": "Back to the ranch",
    "MAP_PLAY": "Start observing",
    "MAP_REPLAY": "Observe again",
    "MAP_LOCKED_ACTION": "No signal yet",
    "MAP_STATUS_CURRENT": "In progress",
    "MAP_STATUS_SEEN": "Observed",
    "MAP_STATUS_OPEN": "Open",
    "MAP_STATUS_LOCKED": "Locked",
    "MAP_LABEL_PROGRESS": "Progress",
    "MAP_LABEL_CAST": "Echoes on stage",
    "MAP_LABEL_REWARD": "First-watch reward",
    "MAP_LABEL_UNLOCK": "Unlocks",
    "MAP_PROGRESS_DONE": "Observed",
    "MAP_PROGRESS_NONE": "Not yet observed",
    "MAP_PROGRESS_SIGNAL": "Calibrating signal",
    "MAP_REWARD_NOTE": "The sigil lights this coordinate on the chart.",
    "MAP_UNLOCK_NEXT": "Finish the coordinate before it, then wait for a new signal.",
    "MAP_CAST_UNKNOWN": "???",
    "MAP_JUST_SEEN": "Sigil lit",
    "MAP_REFUSED": "Observation can't start right now. Return to the ranch and try again.",
    "NUM_PROLOGUE": "Prologue",
    "NUM_INTERLUDE": "Interlude",
    "NUM_CHAPTER": "Chapter {n}",
    "NUM_UNKNOWN": "Unknown coordinate",
    "NODE_PROLOGUE_TITLE": "The Sea of Wires",
    "NODE_PROLOGUE_SUMMARY": "The words people leave online flow into an unseen sea. Deep in the wires it crystallized into the partners' world, and into the malicious Noise that tears rifts open.",
    "NODE_RESONANCE_TITLE": "First Resonance",
    "NODE_RESONANCE_SUMMARY": "You and your partner meet for the first time in the cage. Before you set out to investigate the rifts, NAVI has one thing to tell you.",
    "NODE_C1_TITLE": "The First Rift",
    "NODE_C1_SUMMARY": "On a quiet afternoon a crack opens at the edge of the cage. The voice inside sounds like words someone never finished saying.",
    "NODE_C2_TITLE": "Echoes on the Track",
    "NODE_C2_SUMMARY": "On the stadium track an echo runs lap after lap, as if waiting for someone to tell it to stop.",
    "NODE_C3_TITLE": "The Oasis Shift",
    "NODE_C3_SUMMARY": "The oasis water mirrors a sky that does not belong here, and Noise whispers beneath the surface.",
    "NODE_C4_TITLE": "Core Resonance",
    "NODE_C4_SUMMARY": "Every echo leads back to your partner's core, where the first voice it ever heard is kept.",
    "NODE_BEYOND_TITLE": "Unknown Signal",
    "NODE_BEYOND_SUMMARY": "There are farther coordinates at the edge of the chart, but the signal is too weak to read for now.",
    "SIGIL_PROLOGUE": "Sigil: The Sea of Wires",
    "SIGIL_RESONANCE": "Sigil: First Resonance",
    "SIGIL_C1": "Sigil: The First Rift",
    "SIGIL_RESERVED": "To be revealed"
  },
  "ja": {
    "MAP_KICKER": "裂け目観測",
    "MAP_TITLE": "裂け目観測星図",
    "MAP_SUBTITLE": "位相航路をたどって、観測する座標を選ぼう。",
    "MAP_PROGRESS": "観測済み {seen} / {total}",
    "MAP_CLOSE": "牧場にもどる",
    "MAP_PLAY": "観測を始める",
    "MAP_REPLAY": "もう一度観測する",
    "MAP_LOCKED_ACTION": "信号未接続",
    "MAP_STATUS_CURRENT": "進行中",
    "MAP_STATUS_SEEN": "観測済み",
    "MAP_STATUS_OPEN": "観測可能",
    "MAP_STATUS_LOCKED": "未解放",
    "MAP_LABEL_PROGRESS": "観測進度",
    "MAP_LABEL_CAST": "登場する残響",
    "MAP_LABEL_REWARD": "初回報酬",
    "MAP_LABEL_UNLOCK": "解放条件",
    "MAP_PROGRESS_DONE": "観測完了",
    "MAP_PROGRESS_NONE": "未観測",
    "MAP_PROGRESS_SIGNAL": "信号を調整中",
    "MAP_REWARD_NOTE": "観測の紋章が星図のこの座標を照らします。",
    "MAP_UNLOCK_NEXT": "ひとつ前の座標を観測したら、新しい信号を待とう。",
    "MAP_CAST_UNKNOWN": "？？？",
    "MAP_JUST_SEEN": "観測の紋章が灯った",
    "MAP_REFUSED": "いまは観測を始められません。牧場にもどってからもう一度試してください。",
    "NUM_PROLOGUE": "序章",
    "NUM_INTERLUDE": "幕間",
    "NUM_CHAPTER": "第{n}章",
    "NUM_UNKNOWN": "未知の座標",
    "NODE_PROLOGUE_TITLE": "ネットワイヤーの海",
    "NODE_PROLOGUE_SUMMARY": "ネットに残された言葉が見えない海になり、ワイヤーの奥でパートナーの世界として結晶した。裂け目を開く悪意のノイズも、そこで生まれた。",
    "NODE_RESONANCE_TITLE": "はじめての共鳴",
    "NODE_RESONANCE_SUMMARY": "飼育ケージでのパートナーとの出会い。裂け目の調査に出る前に、NAVIから伝えたいことがある。",
    "NODE_C1_TITLE": "はじめての裂け目",
    "NODE_C1_SUMMARY": "静かな午後、飼育ケージの端に裂け目が開いた。中から聞こえる声は、だれかが言いかけた言葉のようだった。",
    "NODE_C2_TITLE": "運動場の残響",
    "NODE_C2_SUMMARY": "運動場のトラックで、残響が何周も走りつづけている。だれかに止めてもらうのを待っているように。",
    "NODE_C3_TITLE": "オアシスの異変",
    "NODE_C3_SUMMARY": "オアシスの水面に、ここにはないはずの空が映る。水の底でノイズがささやいている。",
    "NODE_C4_TITLE": "心核の共鳴",
    "NODE_C4_SUMMARY": "すべての残響の源は、パートナーの心核を指している。そこには最初に聞いた声がしまわれている。",
    "NODE_BEYOND_TITLE": "未知の信号",
    "NODE_BEYOND_SUMMARY": "星図の端にはさらに遠い座標があるが、信号が弱すぎて今はまだ読めない。",
    "SIGIL_PROLOGUE": "観測の紋章「ネットワイヤーの海」",
    "SIGIL_RESONANCE": "観測の紋章「はじめての共鳴」",
    "SIGIL_C1": "観測の紋章「最初の裂け目」",
    "SIGIL_RESERVED": "近日公開"
  },
  "th": {
    "MAP_KICKER": "เฝ้าดูรอยแยก",
    "MAP_TITLE": "แผนที่ดาวสังเกตรอยแยก",
    "MAP_SUBTITLE": "ไปตามเส้นทางเฟส แล้วเลือกพิกัดที่จะสังเกต",
    "MAP_PROGRESS": "สังเกตแล้ว {seen} / {total}",
    "MAP_CLOSE": "กลับฟาร์ม",
    "MAP_PLAY": "เริ่มสังเกต",
    "MAP_REPLAY": "สังเกตอีกครั้ง",
    "MAP_LOCKED_ACTION": "ยังไม่มีสัญญาณ",
    "MAP_STATUS_CURRENT": "กำลังดำเนินอยู่",
    "MAP_STATUS_SEEN": "สังเกตแล้ว",
    "MAP_STATUS_OPEN": "สังเกตได้",
    "MAP_STATUS_LOCKED": "ยังไม่ปลดล็อก",
    "MAP_LABEL_PROGRESS": "ความคืบหน้า",
    "MAP_LABEL_CAST": "เสียงสะท้อนที่ปรากฏ",
    "MAP_LABEL_REWARD": "รางวัลครั้งแรก",
    "MAP_LABEL_UNLOCK": "เงื่อนไขปลดล็อก",
    "MAP_PROGRESS_DONE": "สังเกตครบแล้ว",
    "MAP_PROGRESS_NONE": "ยังไม่ได้สังเกต",
    "MAP_PROGRESS_SIGNAL": "กำลังปรับสัญญาณ",
    "MAP_REWARD_NOTE": "ตราสังเกตจะจุดแสงพิกัดนี้บนแผนที่ดาว",
    "MAP_UNLOCK_NEXT": "สังเกตพิกัดก่อนหน้าให้เสร็จ แล้วรอสัญญาณใหม่",
    "MAP_CAST_UNKNOWN": "???",
    "MAP_JUST_SEEN": "ตราสังเกตสว่างขึ้นแล้ว",
    "MAP_REFUSED": "ตอนนี้ยังเริ่มสังเกตไม่ได้ กลับไปที่ฟาร์มแล้วลองอีกครั้ง",
    "NUM_PROLOGUE": "บทนำ",
    "NUM_INTERLUDE": "บทแทรก",
    "NUM_CHAPTER": "บทที่ {n}",
    "NUM_UNKNOWN": "พิกัดที่ไม่รู้จัก",
    "NODE_PROLOGUE_TITLE": "ทะเลแห่งสายเน็ต",
    "NODE_PROLOGUE_SUMMARY": "ถ้อยคำที่ผู้คนทิ้งไว้บนเน็ตไหลรวมเป็นทะเลที่มองไม่เห็น ตกผลึกลึกในสายเน็ตจนเกิดเป็นโลกของพาร์ตเนอร์ และเกิดนอยซ์ร้ายที่ฉีกรอยแยก",
    "NODE_RESONANCE_TITLE": "การสั่นพ้องครั้งแรก",
    "NODE_RESONANCE_SUMMARY": "การพบกันครั้งแรกของคุณกับพาร์ตเนอร์ในกรง ก่อนออกไปสำรวจรอยแยก NAVI มีเรื่องหนึ่งที่ต้องบอกก่อน",
    "NODE_C1_TITLE": "รอยแยกแรก",
    "NODE_C1_SUMMARY": "บ่ายวันหนึ่งที่เงียบสงบ รอยแยกเปิดออกที่ขอบกรง เสียงจากข้างในเหมือนคำพูดที่ใครบางคนยังพูดไม่จบ",
    "NODE_C2_TITLE": "เสียงสะท้อนในสนามกีฬา",
    "NODE_C2_SUMMARY": "บนลู่วิ่งในสนามกีฬา เสียงสะท้อนวิ่งวนรอบแล้วรอบเล่า ราวกับรอให้ใครสักคนบอกให้หยุด",
    "NODE_C3_TITLE": "โอเอซิสแปรปรวน",
    "NODE_C3_SUMMARY": "ผิวน้ำของโอเอซิสสะท้อนท้องฟ้าที่ไม่ใช่ของที่นี่ และนอยซ์กำลังกระซิบอยู่ใต้น้ำ",
    "NODE_C4_TITLE": "การสั่นพ้องของแกนใจ",
    "NODE_C4_SUMMARY": "ต้นตอของเสียงสะท้อนทั้งหมดชี้ไปที่แกนใจของพาร์ตเนอร์ ที่ซึ่งเก็บเสียงแรกที่มันเคยได้ยินไว้",
    "NODE_BEYOND_TITLE": "สัญญาณที่ไม่รู้จัก",
    "NODE_BEYOND_SUMMARY": "ที่ขอบแผนที่ดาวยังมีพิกัดที่ไกลกว่านี้ แต่สัญญาณอ่อนเกินกว่าจะอ่านได้ในตอนนี้",
    "SIGIL_PROLOGUE": "ตราสังเกต “ทะเลแห่งสายเน็ต”",
    "SIGIL_RESONANCE": "ตราสังเกต “การสั่นพ้องครั้งแรก”",
    "SIGIL_C1": "ตราสังเกต “รอยแยกแรก”",
    "SIGIL_RESERVED": "รอเปิดเผย"
  },
  "vi": {
    "MAP_KICKER": "Quan sát khe nứt",
    "MAP_TITLE": "Bản đồ sao quan sát khe nứt",
    "MAP_SUBTITLE": "Đi theo các tuyến pha và chọn một tọa độ để quan sát.",
    "MAP_PROGRESS": "Đã quan sát {seen} / {total}",
    "MAP_CLOSE": "Về nông trại",
    "MAP_PLAY": "Bắt đầu quan sát",
    "MAP_REPLAY": "Quan sát lại",
    "MAP_LOCKED_ACTION": "Chưa có tín hiệu",
    "MAP_STATUS_CURRENT": "Đang diễn ra",
    "MAP_STATUS_SEEN": "Đã quan sát",
    "MAP_STATUS_OPEN": "Có thể quan sát",
    "MAP_STATUS_LOCKED": "Chưa mở khóa",
    "MAP_LABEL_PROGRESS": "Tiến độ quan sát",
    "MAP_LABEL_CAST": "Tiếng vọng xuất hiện",
    "MAP_LABEL_REWARD": "Phần thưởng lần đầu",
    "MAP_LABEL_UNLOCK": "Điều kiện mở khóa",
    "MAP_PROGRESS_DONE": "Đã quan sát xong",
    "MAP_PROGRESS_NONE": "Chưa quan sát",
    "MAP_PROGRESS_SIGNAL": "Đang hiệu chỉnh tín hiệu",
    "MAP_REWARD_NOTE": "Ấn quan sát sẽ thắp sáng tọa độ này trên bản đồ sao.",
    "MAP_UNLOCK_NEXT": "Hoàn thành tọa độ trước đó rồi chờ tín hiệu mới.",
    "MAP_CAST_UNKNOWN": "???",
    "MAP_JUST_SEEN": "Ấn quan sát đã sáng",
    "MAP_REFUSED": "Hiện chưa thể bắt đầu quan sát. Hãy quay về nông trại rồi thử lại.",
    "NUM_PROLOGUE": "Mở đầu",
    "NUM_INTERLUDE": "Màn chen",
    "NUM_CHAPTER": "Chương {n}",
    "NUM_UNKNOWN": "Tọa độ chưa biết",
    "NODE_PROLOGUE_TITLE": "Biển dây mạng",
    "NODE_PROLOGUE_SUMMARY": "Những lời con người để lại trên mạng hợp thành một biển vô hình, kết tinh sâu trong dây mạng thành thế giới của các bạn đồng hành, và cả thứ Nhiễu ác ý xé toạc khe nứt.",
    "NODE_RESONANCE_TITLE": "Lần cộng hưởng đầu tiên",
    "NODE_RESONANCE_SUMMARY": "Lần đầu bạn và bạn đồng hành gặp nhau trong chuồng. Trước khi đi điều tra khe nứt, NAVI có một điều cần dặn.",
    "NODE_C1_TITLE": "Khe nứt đầu tiên",
    "NODE_C1_SUMMARY": "Một buổi chiều yên tĩnh, mép chuồng nứt ra một khe. Giọng nói bên trong như lời ai đó còn chưa nói hết.",
    "NODE_C2_TITLE": "Tiếng vọng trên sân vận động",
    "NODE_C2_SUMMARY": "Trên đường chạy của sân vận động, một tiếng vọng chạy hết vòng này đến vòng khác, như đang chờ ai đó bảo nó dừng lại.",
    "NODE_C3_TITLE": "Ốc đảo biến dị",
    "NODE_C3_SUMMARY": "Mặt nước ốc đảo phản chiếu một bầu trời không thuộc về nơi này, và Nhiễu đang thì thầm dưới đáy nước.",
    "NODE_C4_TITLE": "Cộng hưởng lõi tim",
    "NODE_C4_SUMMARY": "Mọi tiếng vọng đều dẫn về lõi tim của bạn đồng hành, nơi cất giữ giọng nói đầu tiên nó từng nghe thấy.",
    "NODE_BEYOND_TITLE": "Tín hiệu chưa biết",
    "NODE_BEYOND_SUMMARY": "Ở rìa bản đồ sao còn những tọa độ xa hơn, nhưng tín hiệu quá yếu để đọc được lúc này.",
    "SIGIL_PROLOGUE": "Ấn quan sát “Biển dây mạng”",
    "SIGIL_RESONANCE": "Ấn quan sát “Lần cộng hưởng đầu tiên”",
    "SIGIL_C1": "Ấn quan sát “Khe nứt đầu tiên”",
    "SIGIL_RESERVED": "Sắp công bố"
  }
});

/** Copy for a chart key in a locale, falling back to zh-Hant, with {n}/{seen}/{total} filled. */
export function storyRiftMapText(key, locale = "zh-Hant", params = {}) {
  const table = STORY_RIFT_MAP_COPY[locale] ?? STORY_RIFT_MAP_COPY["zh-Hant"];
  const raw = table[key] ?? STORY_RIFT_MAP_COPY["zh-Hant"][key];
  if (typeof raw !== "string") return null;
  return raw.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(params, name) ? String(params[name]) : match);
}

/**
 * Each node's state from what was watched: a node is `seen` once its chapter
 * was watched or skipped (`isSeen(node)`); the first playable node not yet
 * seen is `current`; other playable nodes are `open`; a reserved coordinate
 * is `locked`.
 */
export function storyRiftMapStates(isSeen = () => false, nodes = STORY_RIFT_MAP_NODES) {
  let current = null;
  return Object.freeze(nodes.map(node => {
    if (!node.chapterId) return Object.freeze({ id: node.id, state: "locked" });
    if (isSeen(node)) return Object.freeze({ id: node.id, state: "seen" });
    if (current === null) { current = node.id; return Object.freeze({ id: node.id, state: "current" }); }
    return Object.freeze({ id: node.id, state: "open" });
  }));
}

/** The node a chapter plays from. */
export function storyRiftMapNodeForChapter(chapterId, nodes = STORY_RIFT_MAP_NODES) {
  return nodes.find(node => node.chapterId === chapterId) ?? null;
}
