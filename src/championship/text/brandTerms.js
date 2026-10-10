// Centralized brand and naming terms registry.
//
// BRANDING AND NAMING RULES (2026-10-09):
// 1. All legacy commercial brand names visible to players ("數碼獸", "數碼寶貝", "Digimon", "デジモン")
//    are to be removed and replaced.
// 2. The official game title and creature collective term are pending Owner final approval:
//    - Game title candidates:
//        Candidate A: 《網線拍檔：雜訊彼端的錦標賽》
//        Candidate B: 《雜訊拍檔：網線彼端的錦標》
//    - Species / collective term: "拍檔" and "怪獸" are candidates only, NOT approved final terms.
// 3. All strings referencing pending terms are registered here so that once confirmed, they can
//    be systematically applied across all five supported languages without global search-and-replace.
// 4. Internal technical identifiers, asset paths, save keys, and player custom nicknames remain protected.

export const TITLE_CANDIDATE_A = Object.freeze({
  "zh-Hant": "網線拍檔：雜訊彼端的錦標賽",
  "en": "Cyber Partner: Tournament Beyond the Noise",
  "ja": "サイバーパートナー：ノイズの彼方のトーナメント",
  "th": "ไซเบอร์พาร์ตเนอร์: ทัวร์นาเมนต์เหนือสัญญาณรบกวน",
  "vi": "Cyber Partner: Giải Đấu Phía Sau Tạp Âm"
});

export const TITLE_CANDIDATE_B = Object.freeze({
  "zh-Hant": "雜訊拍檔：網線彼端的錦標",
  "en": "Noise Partner: Championship Beyond the Net",
  "ja": "ノイズパートナー：ネットの彼方のチャンピオンシップ",
  "th": "นอยส์พาร์ตเนอร์: แชมเปียนชิปเหนือโครงข่าย",
  "vi": "Noise Partner: Giải Đấu Phía Sau Mạng Lưới"
});

// Active display selection for the pending title (Candidate A by default pending decision).
export let ACTIVE_TITLE_CANDIDATE = "A";

export function setActiveTitleCandidate(candidate) {
  if (candidate === "A" || candidate === "B") {
    ACTIVE_TITLE_CANDIDATE = candidate;
    return true;
  }
  return false;
}

export function getActiveGameTitle(locale = "zh-Hant") {
  const table = ACTIVE_TITLE_CANDIDATE === "B" ? TITLE_CANDIDATE_B : TITLE_CANDIDATE_A;
  return table[locale] ?? table["zh-Hant"];
}

export function getTitleEyebrow(locale = "zh-Hant") {
  return locale === "zh-Hant" ? "網線拍檔" : "CABLE PARTNER";
}

export function getTitleHeadingHtml(locale = "zh-Hant") {
  if (locale === "zh-Hant") {
    return "網線拍檔<br><span>錦標賽</span>";
  } else if (locale === "ja") {
    return "サイバーパートナー<br><span>トーナメント</span>";
  } else if (locale === "th") {
    return "ไซเบอร์พาร์ตเนอร์<br><span>ทัวร์นาเมนต์</span>";
  } else if (locale === "vi") {
    return "Cyber Partner<br><span>Giải Đấu</span>";
  }
  return "Cyber Partner<br><span>Tournament</span>";
}

/**
 * Registry of terms pending official Owner confirmation.
 */
export const PENDING_TERMS_REGISTRY = Object.freeze({
  GAME_TITLE: {
    status: "PENDING_CHOICE",
    candidates: {
      A: TITLE_CANDIDATE_A,
      B: TITLE_CANDIDATE_B
    },
    note: "Pending final selection between Candidate A and Candidate B."
  },
  CREATURE_SPECIES_TERM: {
    status: "PENDING_CONFIRMATION",
    candidates: {
      "zh-Hant": ["拍檔", "怪獸", "生物"],
      "en": ["Partner", "Monster", "Creature"],
      "ja": ["パートナー", "モンスター", "クリーチャー"],
      "th": ["พาร์ตเนอร์", "มอนสเตอร์", "สิ่งมีชีวิต"],
      "vi": ["Bạn đồng hành", "Quái thú", "Sinh vật"]
    },
    note: "'拍檔' and '怪獸' are candidate terms only, not final decisions."
  },
  EGG_TERM: {
    status: "PENDING_CONFIRMATION",
    candidates: {
      "zh-Hant": ["培育蛋", "神秘蛋", "蛋"],
      "en": ["Creature Egg", "Mystery Egg", "Egg"],
      "ja": ["育成タマゴ", "タマゴ"],
      "th": ["ไข่ฟัก", "ไข่"],
      "vi": ["Trứng ấp", "Trứng"]
    },
    note: "Replaces legacy '數碼蛋 / Digi-Egg / デジタマ'."
  },
  WORLD_NETWORK_TERM: {
    status: "PENDING_CONFIRMATION",
    candidates: {
      "zh-Hant": ["世界傳送網路", "生態傳送網路"],
      "en": ["World Destination Network"],
      "ja": ["ワールド転送ネットワーク"],
      "th": ["เครือข่ายเทเลพอร์ตโลก"],
      "vi": ["Mạng Lưới Dịch Chuyển Thế Giới"]
    },
    note: "Replaces legacy '數碼世界傳送網路'."
  }
});

// Opening-only tournament label uses the pending collective term, never a legacy brand.
export function getOpeningBrandTerms(locale = 'zh-Hant') {
  const creature = PENDING_TERMS_REGISTRY.CREATURE_SPECIES_TERM.candidates[locale]?.[0]
    ?? PENDING_TERMS_REGISTRY.CREATURE_SPECIES_TERM.candidates['zh-Hant'][0];
  const tournament = ({'zh-Hant':`${creature}錦標賽`,en:`${creature} Tournament`,ja:`${creature}トーナメント`,
    th:`ทัวร์นาเมนต์${creature}`,vi:`Giải đấu ${creature}`})[locale] ?? `${creature}錦標賽`;
  return {creature,tournament};
}
