// Partner battle styles, move classes and status glyphs -- BATTLE_STYLE_V1 (2026-11-16).
//
// OWNER_APPROVED_ADAPTATION (Owner 2026-11-16: "夥伴改成攻擊型、技能型、支援型，招式也分三類，
// 加上特殊狀態"; delegated with 「交給你去處理」). A presentation classification only: it reads
// the cartridge's own data and changes no battle number, AI rule or save field.
//
// What the data already holds (docs/planning/ROLES_AND_SURVIVAL_PLAN_2026-11-16_ZH_TW.md §1):
//   - move kind 0: plain attacks with no SP cost (the AI's bucket 4);
//   - move kind 1 with an SP cost: skills aimed at the other team (buckets 5 and 6);
//   - move records 1..30, kinds 2 and 3: the special skills an individual carries in its two
//     slots (+0x12C, +0x130), set at capture from the species' aiPairs by personality. The AI
//     uses them on the targeted path (state 7): heals, guards, buffs, resistances, revival.
//
// Style of one individual (636 non-egg species x personality pairs: 191 / 266 / 179):
//   SUPPORT  it carries a heal or a revival (special skills 2-7, 28, 29);
//   SKILL    otherwise its species has two or more SP moves;
//   ATTACK   otherwise.
// Evolution can change the style (幼年期 are all ATTACK, 覺醒體 / 究極體 all SKILL), and so can
// personality, through the special skills it was caught with.

import { deepFreeze } from "./championshipContracts.js";
import { getBattleCatalogRecord, listMoveRecordsForSpecies } from "../battle/battleCatalogs.js";
import speciesCatalog from "../../data/championship/catalogs/creature-species.r1.json" with { type: "json" };

export const BATTLE_STYLES = deepFreeze(["ATTACK", "SKILL", "SUPPORT"]);
export const BATTLE_STYLE_EVIDENCE = "OWNER_APPROVED_ADAPTATION";

const HEAL_OR_REVIVE = new Set([2, 3, 4, 5, 6, 7, 28, 29]);

/** Special skill (1..30) -> glyph key, and whether it reaches the whole team. */
export const SPECIAL_SKILL_GLYPHS = deepFreeze({
  1: { glyph: "skill_taunt", group: "SELF" },
  2: { glyph: "skill_heal", group: "ONE" }, 3: { glyph: "skill_heal", group: "ONE" }, 4: { glyph: "skill_heal", group: "ONE" },
  5: { glyph: "skill_heal", group: "ALL" }, 6: { glyph: "skill_heal", group: "ALL" }, 7: { glyph: "skill_heal", group: "ALL" },
  8: { glyph: "skill_cleanse", group: "ONE" }, 9: { glyph: "skill_cleanse", group: "ALL" },
  10: { glyph: "skill_attack_up", group: "ONE" }, 11: { glyph: "skill_attack_up", group: "ALL" },
  12: { glyph: "skill_guard", group: "ONE" }, 13: { glyph: "skill_guard", group: "ALL" },
  14: { glyph: "skill_haste", group: "ONE" }, 15: { glyph: "skill_haste", group: "ALL" },
  16: { glyph: "skill_sense", group: "ONE" }, 17: { glyph: "skill_sense", group: "ALL" },
  18: { glyph: "resist_fire", group: "ONE" }, 19: { glyph: "resist_fire", group: "ALL" },
  20: { glyph: "resist_water", group: "ONE" }, 21: { glyph: "resist_water", group: "ALL" },
  22: { glyph: "resist_thunder", group: "ONE" }, 23: { glyph: "resist_thunder", group: "ALL" },
  24: { glyph: "resist_light", group: "ONE" }, 25: { glyph: "resist_light", group: "ALL" },
  26: { glyph: "resist_dark", group: "ONE" }, 27: { glyph: "resist_dark", group: "ALL" },
  28: { glyph: "skill_revive", group: "ONE" }, 29: { glyph: "skill_revive", group: "ONE" },
  30: { glyph: "skill_courage", group: "SELF" }
});

const toIndex = (value) => {
  if (Number.isSafeInteger(value)) return value;
  const match = /^species-(\d+)$/.exec(String(value ?? ""));
  return match ? Number(match[1]) : null;
};

const skillCountCache = new Map();
/** SP moves (kind 1 with a cost) a species carries; null when it has no battle moves or is an egg (generation 0). */
export function speciesSkillCount(speciesId) {
  const index = toIndex(speciesId);
  if (index === null) return null;
  if (!skillCountCache.has(index)) {
    let records = [];
    // An egg never fights, so it has no style even where the table lists a move for it.
    if (speciesCatalog.records[index]?.generationIndex !== 0) {
      try { records = listMoveRecordsForSpecies(index); } catch { records = []; }
    }
    skillCountCache.set(index, records.length ? records.filter((r) => r.kind === 1 && (r.actionCost ?? 0) > 0).length : null);
  }
  return skillCountCache.get(index);
}

export const isSpecialSkillId = (id) => Number.isSafeInteger(id) && id >= 1 && id <= 30;

/** An individual's style from its species and its two special skills; null for a species with no moves (eggs). */
export function battleStyleOf({ speciesId, specialSkills = [] } = {}) {
  const skills = speciesSkillCount(speciesId);
  if (skills === null) return null;
  if (specialSkills.some((id) => HEAL_OR_REVIVE.has(id))) return "SUPPORT";
  return skills >= 2 ? "SKILL" : "ATTACK";
}

/** The style straight from a native profile (fields 000, 12c, 130). */
export function battleStyleOfProfile(profile) {
  const fields = profile?.fields ?? profile ?? {};
  return battleStyleOf({ speciesId: fields["000"], specialSkills: [fields["12c"], fields["130"]].filter(isSpecialSkillId) });
}

/** A move record's class: ATTACK (kind 0), SKILL (kind 1), SUPPORT (the special skills, kinds 2 and 3). */
export function moveClassOf(moveId) {
  if (!Number.isSafeInteger(moveId) || moveId < 0) return null;
  let record = null;
  try { record = getBattleCatalogRecord("moves", moveId); } catch { return null; } // original characters' moves follow the cartridge table
  if (record.kind === 0) return "ATTACK";
  if (record.kind === 1) return "SKILL";
  if (record.kind === 2 || record.kind === 3) return "SUPPORT";
  return null;
}
