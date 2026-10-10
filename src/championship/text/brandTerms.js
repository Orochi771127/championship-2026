// Centralized brand and naming terms registry.
// Owner approved these five short game titles on 2026-10-10.
// Other collective/species/egg terms below remain pending; this title decision
// does not change internal identifiers, asset paths, save keys or player names.

export const APPROVED_GAME_TITLES = Object.freeze({
  "zh-Hant": "網線拍檔：錦標賽",
  "en": "Cyber Partner: Tournament",
  "ja": "サイバーパートナー：トーナメント",
  "th": "ไซเบอร์พาร์ตเนอร์: ทัวร์นาเมนต์",
  "vi": "Cyber Partner: Giải đấu"
});

export function getActiveGameTitle(locale = "zh-Hant") {
  return APPROVED_GAME_TITLES[locale] ?? APPROVED_GAME_TITLES["zh-Hant"];
}

export function getTitleEyebrow(locale = "zh-Hant") {
  return getActiveGameTitle(locale).split(/[：:]/)[0];
}

export function getTitleHeadingHtml(locale = "zh-Hant") {
  const [name, tournament] = getActiveGameTitle(locale).split(/[：:]\s*/);
  return `${name}<br><span>${tournament}</span>`;
}

/**
 * Registry of terms pending official Owner confirmation.
 */
export const PENDING_TERMS_REGISTRY = Object.freeze({
  GAME_TITLE: {
    status: "OWNER_APPROVED",
    titles: APPROVED_GAME_TITLES,
    note: "Five short localized titles approved by Owner on 2026-10-10."
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
