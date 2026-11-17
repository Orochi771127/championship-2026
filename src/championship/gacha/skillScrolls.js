// Skill imprint scrolls -- OWNER_APPROVED_ADAPTATION 2026-11-17 (SKILL_IMPRINT_SCROLL_PLAN_2026-11-17_ZH_TW.md).
//
// Every individual carries two special-skill words, +0x12C and +0x130 (`12c` / `130`): a capture fills them
// from the species' candidate pairs by personality (hunt/capture/nativeHuntIndividual.js), the partner list
// shows them as 特殊技能Ⅰ/Ⅱ, and the battle appends them to the species' own moves (OVL19 02113E04..48) and
// files ids 1..30 into the AI's candidate buckets (battle/battleCandidateBuckets.js, VERIFIED_BINARY).
//
// A blank scroll copies one of those skills off partner A -- A is untouched -- and an imprinted scroll writes it
// into one of partner B's two words. Only the thirty shared special skills (move records 1..30) can be copied;
// a species' own moves stay with the species. Written values are always inside the native 1..30 domain.
// Password, link and online battles rebuild both words from species and personality, so an engraved skill
// is local play only. Pure: state and profiles in, state and profiles out.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const SKILL_SCROLL_SLOTS = Object.freeze(["12c", "130"]);
export const SKILL_SCROLL_SKILL_MIN = 1;
export const SKILL_SCROLL_SKILL_MAX = 30;
/** The standard scroll copies these thirteen; the holo scroll copies all thirty. */
export const SKILL_SCROLL_BASIC_SKILLS = Object.freeze([1, 2, 3, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26]);
const BASIC = new Set(SKILL_SCROLL_BASIC_SKILLS);
/** Share of the premium machine's SR and SSR tiers, after automation and the jackpot slot. */
export const SKILL_SCROLL_PREMIUM_SHARE = 0.12;

const ART = "assets/production/items/skill-scrolls-r1/";
export const SKILL_SCROLL_GRADES = deepFreeze({
  SR: { grade: "SR", rarity: "SR", name: "拓印卷", blankArt: `${ART}imprint_scroll_blank_160.webp`,
    imprintedArt: `${ART}imprint_scroll_imprinted_160.webp` },
  SSR: { grade: "SSR", rarity: "SSR", name: "全息拓印卷", blankArt: `${ART}holo_imprint_scroll_blank_160.webp`,
    imprintedArt: `${ART}holo_imprint_scroll_imprinted_160.webp` }
});

export const blankScrollId = (grade) => `scroll:blank:${grade}`;
export const imprintedScrollId = (grade, skill) => `scroll:${grade}:${skill}`;
const isSkill = (n) => Number.isInteger(n) && n >= SKILL_SCROLL_SKILL_MIN && n <= SKILL_SCROLL_SKILL_MAX;

/** Can a scroll of `grade` hold `skill`? */
export function scrollCanHold(grade, skill) {
  if (!Object.hasOwn(SKILL_SCROLL_GRADES, grade) || !isSkill(skill)) return false;
  return grade === "SSR" || BASIC.has(skill);
}

/** Every scroll id the save may hold: two blanks, 13 standard imprints and 30 holo imprints. */
export const SKILL_SCROLLS = deepFreeze([
  ...Object.values(SKILL_SCROLL_GRADES).map((g) => ({ id: blankScrollId(g.grade), grade: g.grade, rarity: g.rarity,
    skill: null, name: g.name, art: g.blankArt })),
  ...Object.values(SKILL_SCROLL_GRADES).flatMap((g) => Array.from({ length: SKILL_SCROLL_SKILL_MAX }, (_, i) => i + 1)
    .filter((skill) => scrollCanHold(g.grade, skill))
    .map((skill) => ({ id: imprintedScrollId(g.grade, skill), grade: g.grade, rarity: g.rarity, skill, name: g.name, art: g.imprintedArt })))
]);
const BY_ID = new Map(SKILL_SCROLLS.map((scroll) => [scroll.id, scroll]));
export const SKILL_SCROLL_IDS = Object.freeze(new Set(BY_ID.keys()));
export const getSkillScroll = (id) => BY_ID.get(id) ?? null;

/** The badge family a skill draws on its scroll. */
export function skillScrollCategory(skill) {
  if (!isSkill(skill)) return null;
  if (skill <= 9) return skill === 1 ? "OTHER" : skill >= 8 ? "CLEANSE" : "HEAL";
  if (skill <= 17) return "BUFF";
  if (skill <= 27) return "RESIST";
  return skill === 30 ? "OTHER" : "REVIVE";
}

const word = (profile, slot) => profile?.fields?.[slot] | 0;

/**
 * The skill a blank scroll of `grade` would copy off `profile`. With no `slot`, the only filled one; a
 * partner with two skills needs the slot named.
 */
export function resolveImprint(profile, { grade, slot = null } = {}) {
  if (!Object.hasOwn(SKILL_SCROLL_GRADES, grade)) return deepFreeze({ ok: false, reason: "UNKNOWN_SCROLL" });
  if (!profile?.fields) return deepFreeze({ ok: false, reason: "UNKNOWN_INDIVIDUAL" });
  if (slot !== null && !SKILL_SCROLL_SLOTS.includes(slot)) return deepFreeze({ ok: false, reason: "INVALID_SLOT" });
  const filled = SKILL_SCROLL_SLOTS.filter((s) => isSkill(word(profile, s)));
  if (!filled.length) return deepFreeze({ ok: false, reason: "NO_SPECIAL_SKILL" });
  const from = slot ?? (filled.length === 1 ? filled[0] : null);
  if (from === null) return deepFreeze({ ok: false, reason: "CHOOSE_SLOT" });
  const skill = word(profile, from);
  if (!isSkill(skill)) return deepFreeze({ ok: false, reason: "SLOT_EMPTY" });
  if (!scrollCanHold(grade, skill)) return deepFreeze({ ok: false, reason: "NEEDS_HOLO", skill });
  return deepFreeze({ ok: true, slot: from, skill, scrollId: imprintedScrollId(grade, skill) });
}

/**
 * Where an imprinted scroll would write on `profile`: the named slot, else the first empty one. A partner
 * whose two slots are both filled needs the slot named, and one that already has the skill refuses.
 */
export function resolveEngrave(profile, { scrollId, slot = null } = {}) {
  const scroll = getSkillScroll(scrollId);
  if (!scroll || scroll.skill === null) return deepFreeze({ ok: false, reason: "UNKNOWN_SCROLL" });
  if (!profile?.fields) return deepFreeze({ ok: false, reason: "UNKNOWN_INDIVIDUAL" });
  if (slot !== null && !SKILL_SCROLL_SLOTS.includes(slot)) return deepFreeze({ ok: false, reason: "INVALID_SLOT" });
  if (SKILL_SCROLL_SLOTS.some((s) => word(profile, s) === scroll.skill)) {
    return deepFreeze({ ok: false, reason: "SKILL_DUPLICATE", skill: scroll.skill });
  }
  const to = slot ?? SKILL_SCROLL_SLOTS.find((s) => !isSkill(word(profile, s))) ?? null;
  if (to === null) return deepFreeze({ ok: false, reason: "CHOOSE_SLOT" });
  const replaced = isSkill(word(profile, to)) ? word(profile, to) : null;
  return deepFreeze({ ok: true, slot: to, skill: scroll.skill, replaced });
}

/** The profile with `skill` written into `slot`; every other word is untouched. */
export function engraveProfile(profile, { slot, skill }) {
  if (!SKILL_SCROLL_SLOTS.includes(slot) || !isSkill(skill)) throw new TypeError("INVALID_SKILL_ENGRAVE");
  const next = structuredClone(profile);
  next.fields[slot] = skill >>> 0;
  return next;
}
