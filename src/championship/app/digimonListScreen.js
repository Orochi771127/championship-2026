import { uiText } from "../text/uiText.js";
import { battleMoveName } from '../text/battleMoveNames.js';
import { moveIcon } from './moveIcons.js';
import { arenaMoveRecordIndex } from '../contracts/productArenaMoves.js';
import { formatList } from "../text/locale.js";
import {generationName,personalityName,specialSkillName,speciesName,cageName} from '../text/zhHant.js';
import {speciesTaxonomy,TAXONOMY_RESISTANCE_AXES} from '../contracts/speciesTaxonomy.js';
import {taxonomyText} from '../text/taxonomyText.js';
import {taxonomyBadgeRow} from '../presentation/taxonomyBadgeArt.js';
import {elementChartButton} from './elementChartModal.js';
import {isKnownSpeciesIndex,productPartnerG} from '../contracts/productSpeciesData.js';
import { createActionPortrait } from "../presentation/juicy/actionPortrait.js";
import { starEmblem, starPips, starMeter, starLevelGauge } from "../presentation/starEmblemArt.js";
import { playCeremony } from "../presentation/ceremony/ceremonyRunner.js";
import { buildStarUp } from "../presentation/ceremony/ceremonyScenes.js";
import { requestArcadeFx } from "./ui/arcadeFx.js";
import {battleStyleOf,isSpecialSkillId,SPECIAL_SKILL_GLYPHS} from '../contracts/productBattleStyle.js';
import {battleStyleText,specialSkillEffect} from '../text/battleStyleText.js';
import {partnerTendencyText} from '../contracts/productPartnerTendency.js';
import {battleGlyph,STYLE_GLYPHS} from './battleGlyphs.js';
import { syncVitalPercent, syncBreakthroughsAt } from "../contracts/productSyncLevel.js";
// The Digimon roster -- the original's ui/digimon_list_* scenes.
//
// STRUCTURE COMES FROM THE ROM SCENES, NOT FROM TASTE
// ---------------------------------------------------
// Three shared NXR scenes describe this screen, and their node tables are the
// blueprint this file follows:
//
//   digimon_list_item (7)  digimon, name_text, new_mark, base,
//                          win_left / win_center / win_right
//   digimon_list_main (21) name_edit_button, delete_button, entry_button,
//                          num_cur0..2, num_limit0..2, slash, cur_unit,
//                          limit_unit, graph
//   digimon_list_sub  (19) name, nickname, HP, TP, ap, size, attack, def, wiz,
//                          spd, sp1, sp2, num_battle, win_rate, family, gen,
//                          mind, digitama, align_icon
//
// WHAT IS FILLED AND WHAT IS LEFT OUT
// -----------------------------------
// ARM9 02088480, its formatting strings and the 17-node binding table now
// close the individual HP/TP, size, combat stats, battle and rebirth counts.
// Remaining untranslated or untraced rows are ABSENT rather than shown as zero. A zero in a
// stat row reads as a real value; an absent row reads as missing, which is true.
//
// The three-digit current/limit counter and its unit labels are likewise not
// drawn: the capacity field is a candidate, not a confirmed reading, so there is
// no honest number to put in it yet.
//
// The name_edit / delete / entry buttons are drawn disabled for the same reason
// the unbuilt submenu entries are: the original has them, this build does not
// implement them, and deleting them would misrepresent the screen.

const GENERATION_EVIDENCE = "VERIFIED_BINARY";
const RESISTANCE_LABELS = Object.freeze({HEAT:'熱',COLD:'寒',THUNDER:'雷',LIGHT:'光',DARK:'闇'});

/** Rows of digimon_list_sub this build can source. Order follows the scene. */
const TRACED_DETAIL_ROWS = Object.freeze([
  { id: "nickname", label: "暱稱", read: (entry) => entry.displayName },
  // The cartridge's own name for the species, as it prints it on screen.
  { id: "species", label: "SPECIES", read: (entry) => entry.identity?.speciesName ?? null },
  // LINE_FUSION_20261117: the partner grade; "—" for one the app reports without a grade record.
  { id: "grade", label: "資質", read: (entry) => entry.grade === undefined ? null : entry.grade ?? "—" },
  { id: "HP", label: "HP", read: (entry) => vital(entry.stats?.currentHp,entry.stats?.maxHp) },
  { id: "TP", label: "TP", read: (entry) => vital(entry.stats?.currentTp,entry.stats?.maxTp) },
  // GACHA_FULL_EFFECTS_20261109: the partner's weight, the G it takes on the memory card and in the ranch.
  { id: "size", label: "容量", read: (entry) => isKnownSpeciesIndex(entry.stats?.speciesIndex) ? `${productPartnerG(entry.stats.speciesIndex)} G`
    : entry.stats?.capacityG == null ? null : `${entry.stats.capacityG} G` },
  { id: "attack", label: "攻擊", read: (entry) => entry.stats?.attack ?? null },
  { id: "def", label: "防禦", read: (entry) => entry.stats?.defense ?? null },
  { id: "wiz", label: "智力", read: (entry) => entry.stats?.wisdom ?? null },
  { id: "spd", label: "速度", read: (entry) => entry.stats?.speed ?? null },
  { id: "sp1", label: "特殊技能Ⅰ", read: (entry) => specialSkillName(entry.stats?.source12C) },
  { id: "sp2", label: "特殊技能Ⅱ", read: (entry) => specialSkillName(entry.stats?.source130) },
  { id: "num_battle", label: "戰鬥次數", read: (entry) => entry.stats?.battleCount ?? null },
  { id: "win_rate", label: "勝率", read: (entry) => entry.stats?.winPercent == null ? null : `${entry.stats.winPercent.toFixed(1)} %` },
  { id: "digitama", label: "退化次數", read: (entry) => entry.stats?.rebirthCount ?? null },
  { id: "gen", label: "GEN.", read: (entry) => generationName(entry.identity?.generationIndex) },
  { id: "mind", label: "性格", read: (entry) => entry.identity?.generationIndex===0?'？？？':personalityName(entry.stats?.personalityIndex) },
  // Owner 2026-10-29: the raw attribute index and family give way to the three-axis taxonomy
  // (faction renames the attribute, race renames the family), drawn as emblems by appendCreatureDetail.
]);

/** Rows the original shows that this build has no traced source for. */
export const UNTRACED_DETAIL_ROWS = Object.freeze([
  "ap"
]);

function vital(current,maximum) {
  return current == null || maximum == null ? null : `${current}/${maximum}`;
}

/** Controls the original carries that this build has not implemented. */
export const UNIMPLEMENTED_CONTROLS = Object.freeze(["delete_button", "entry_button"]);
/** Name edit now uses the product given-name rule the Database already uses. */
export const ROSTER_CONTROLS = Object.freeze(["name_edit_button", ...UNIMPLEMENTED_CONTROLS]);
const ROSTER_NAME_MAX_LENGTH = 24;

function element(tag, className, text, localize = true) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = localize ? uiText(text) : text;
  return node;
}

/**
 * The traced detail rows and the resistance graph for one roster entry.
 * Shared by this screen and the Raising Home detail sheet (2026-09-29), so
 * both read one source and show the same rows in the same order.
 */
// Owner 2026-10-27: the roster reads as a bento of groups. Each label/value
// pair sits in one wrapper (display: contents everywhere except the arcade
// roster), so the shared detail sheet keeps its two-column list unchanged.
const ROW_GROUPS = Object.freeze({
  nickname: "identity", species: "identity", gen: "identity", mind: "identity", family: "identity", align_icon: "identity",
  HP: "vital", TP: "vital", size: "vital",
  attack: "combat", def: "combat", wiz: "combat", spd: "combat",
  style: "skill", sp1: "skill", sp2: "skill",
  num_battle: "record", win_rate: "record", digitama: "record"
});

/**
 * Awakening raising (OWNER_APPROVED_ADAPTATION 2026-11-02): one or two plain hints for a form, never the raw
 * conditions (Owner: the game keeps the full rules; players read what to do next). [{key, values}] for uiText.
 */
export function awakeningHints(form, { formName = speciesName, cageLabel = (definition) => cageName(definition, null) } = {}) {
  if (!form || form.learned) return [];
  if (form.ready) return [{ key: "AWAKENING_HINT_TAP", values: {} }];
  const hints = [];
  if (!form.viaMet && Number.isInteger(form.via)) hints.push({ key: "AWAKENING_HINT_VIA", values: { name: formName(form.via) } });
  const rebirth = (form.gates ?? []).find((row) => row.id === "REBIRTH_COUNT" && !row.met);
  if (rebirth) hints.push({ key: "AWAKENING_HINT_STARS", values: { count: Math.max(1, rebirth.value - rebirth.current) } });
  const open = (form.rows ?? []).filter((row) => !row.met);
  const points = open.filter((row) => Array.isArray(row.cages) && row.cages.length)
    .sort((a, b) => a.current / a.value - b.current / b.value)[0];
  if (points) hints.push({ key: "AWAKENING_HINT_CAGES", values: { cages: points.cages.slice(0, 2).map((cage) => cageLabel(cage.definition)).join("、") } });
  const battles = open.find((row) => row.id === "BATTLE_COUNT");
  if (battles) hints.push({ key: "AWAKENING_HINT_BATTLES", values: { count: battles.value - battles.current } });
  if (open.some((row) => row.id === "EVOLUTION_WIN_PERCENT")) hints.push({ key: "AWAKENING_HINT_WINS", values: {} });
  return hints.slice(0, 2);
}

/** The overdrive training switch with its core heat meter and one plain note. */
export function overdriveBlock(overdrive, onToggle, enabled = true) {
  const block = element("div", "cm-awakening__overdrive");
  block.dataset.on = String(overdrive.on);
  block.dataset.danger = String(overdrive.danger);
  const toggle = element("button", "cm-awakening__btn cm-awakening__overdrive-toggle", overdrive.on ? "OVERDRIVE_ON" : "OVERDRIVE_OFF");
  toggle.type = "button";
  toggle.setAttribute("aria-pressed", String(overdrive.on));
  if (enabled) toggle.addEventListener("click", () => onToggle(!overdrive.on)); else toggle.disabled = true;
  const heat = element("div", "cm-awakening__heat");
  heat.setAttribute("role", "meter"); heat.setAttribute("aria-valuemin", "0"); heat.setAttribute("aria-valuemax", "100");
  heat.setAttribute("aria-valuenow", String(overdrive.heat));
  heat.setAttribute("aria-label", uiText("OVERDRIVE_HEAT"));
  heat.style.setProperty("--heat", `${overdrive.heat}%`);
  heat.style.setProperty("--limit", `${overdrive.backlashAbove}%`);
  heat.append(element("span", "cm-awakening__heat-fill"), element("span", "cm-awakening__heat-text", uiText("OVERDRIVE_HEAT_VALUE", { heat: overdrive.heat }), false));
  const note = overdrive.fatigueSeconds > 0 ? uiText("OVERDRIVE_FATIGUED", { seconds: overdrive.fatigueSeconds })
    : overdrive.danger ? uiText("OVERDRIVE_DANGER", { limit: overdrive.backlashAbove })
    : uiText(overdrive.cooling === "inside" ? "OVERDRIVE_COOLING_INSIDE" : overdrive.cooling === "adjacent" ? "OVERDRIVE_COOLING_ADJACENT" : "OVERDRIVE_COOLING_BASE");
  block.append(toggle, heat, element("p", "cm-awakening__note cm-awakening__overdrive-note",
    `${uiText("OVERDRIVE_ABOUT", { cost: overdrive.costBits, low: overdrive.multiplier.minimum, high: overdrive.multiplier.maximum })} ${note}`, false));
  return block;
}

// The awakening path on a 成熟期's card: each form with one progress bar, a plain state and at most two hints;
// energy items, the core-transcendence star, the battle form and the ranch look are one tap each.
function appendAwakening(detail, entry, onAwakening) {
  const view = entry.awakening;
  const group = element("div", "cm-digimon-stat cm-digimon-burst cm-awakening");
  group.dataset.row = "burst";
  group.dataset.group = "burst";
  const head = element("dt", "cm-digimon-detail__label cm-awakening__head");
  head.append(element("span", "", "AWAKENING_TITLE"));
  if (view.stars > 0) head.append(element("span", "cm-awakening__stars", "★".repeat(view.stars), false));
  group.append(head);
  const cell = element("dd", "cm-digimon-detail__value");
  if (entry.bloodline?.family) {
    const perk = element("p", "cm-awakening__perk", `BLOODLINE_PERK_${entry.bloodline.family}`);
    if (entry.bloodline.color) perk.style.setProperty("--bloodline", entry.bloodline.color);
    cell.append(perk);
  }
  const act = (action, value) => onAwakening?.(action, entry.instanceId, value);
  const button = (className, text, onClick, localize = true) => {
    const node = element("button", className, text, localize);
    node.type = "button";
    if (onAwakening) node.addEventListener("click", onClick); else node.disabled = true;
    return node;
  };
  for (const form of view.forms) {
    const row = element("div", "cm-awakening__form");
    row.dataset.tier = String(form.tier);
    row.dataset.state = form.learned ? "learned" : form.ready ? "ready" : "raising";
    row.dataset.focus = String(view.focus === form.form);
    const title = element("p", "cm-awakening__title");
    title.append(element("strong", "cm-awakening__tier", form.tier === 2 ? "AWAKENING_TIER_2" : "AWAKENING_TIER_1"),
      element("span", "cm-awakening__name", speciesName(form.form), false),
      element("span", "cm-awakening__state", form.learned ? "AWAKENING_STATE_LEARNED" : form.ready ? "AWAKENING_STATE_READY" : "AWAKENING_STATE_RAISING"));
    row.append(title);
    if (!form.learned) {
      const bar = element("div", "cm-awakening__bar");
      bar.setAttribute("role", "meter"); bar.setAttribute("aria-valuemin", "0"); bar.setAttribute("aria-valuemax", "100");
      bar.setAttribute("aria-valuenow", String(form.percent));
      bar.style.setProperty("--percent", `${form.percent}%`);
      bar.append(element("span", "cm-awakening__fill"), element("span", "cm-awakening__percent", `${form.percent}%`, false));
      row.append(bar);
      const hints = awakeningHints(form);
      if (hints.length) row.append(element("p", "cm-awakening__hint", hints.map((hint) => uiText(hint.key, hint.values)).join("・"), false));
      const actions = element("div", "cm-awakening__actions");
      if (view.focus !== form.form && form.viaMet) actions.append(button("cm-awakening__btn", "AWAKENING_SET_TARGET", () => act("target", form.form)));
      if (view.focus === form.form && !form.ready) {
        const full = form.energy >= view.itemCap;
        for (const feed of view.feeds) {
          if (full && !feed.fill) continue;
          const label = uiText(feed.fill ? "AWAKENING_FEED_FILL" : "AWAKENING_FEED_ITEM", { name: feed.name, amount: feed.amount });
          const node = button("cm-awakening__btn cm-awakening__feed", `${label} ×${feed.owned}`, () => act("feed", feed.itemId), false);
          node.dataset.rarity = feed.rarity;
          actions.append(node);
        }
        if (full) actions.append(element("span", "cm-awakening__note", "AWAKENING_ENERGY_FULL"));
        if ((form.gates ?? []).some((gate) => gate.id === "REBIRTH_COUNT" && !gate.met)) {
          if (view.canTranscend) actions.append(button("cm-awakening__btn cm-awakening__transcend", "AWAKENING_TRANSCEND", () => act("transcend", view.transcendItems[0])));
          else actions.append(element("span", "cm-awakening__note", view.bond < view.bondMinimum ? "AWAKENING_TRANSCEND_BOND" : "AWAKENING_TRANSCEND_HINT"));
        }
      }
      if (actions.childElementCount) row.append(actions);
    } else {
      const actions = element("div", "cm-awakening__actions");
      for (const shown of [form.form, ...(form.alternatesUnlocked ?? [])]) {
        if (form.planned === shown) actions.append(element("span", "cm-awakening__note cm-awakening__planned", "出戰形態"));
        else actions.append(button("cm-awakening__btn", "設為爆裂形態", () => act("battle", shown)));
      }
      row.append(actions);
    }
    cell.append(row);
  }
  // Overdrive training (AWAKENING_OVERDRIVE_20261109): one switch, the core heat and where it cools.
  if (view.overdrive?.available && view.forms.some((form) => !form.learned)) cell.append(overdriveBlock(view.overdrive, (on) => act("overdrive", on), Boolean(onAwakening)));
  // The ranch look: the usual 成熟期 or any learned form, switched at any time.
  const learned = view.forms.filter((form) => form.learned).flatMap((form) => [form.form, ...(form.alternatesUnlocked ?? [])]);
  if (learned.length) {
    const looks = element("div", "cm-awakening__looks");
    looks.append(element("span", "cm-awakening__label", "AWAKENING_LOOK"));
    for (const look of [null, ...learned]) {
      const node = button("cm-awakening__btn cm-awakening__look", look === null ? "AWAKENING_LOOK_BASE" : speciesName(look), () => act("look", look), look === null);
      node.setAttribute("aria-pressed", String(view.appearance === look));
      looks.append(node);
    }
    cell.append(looks);
  }
  group.append(cell);
  detail.append(group);
}

/**
 * BATTLE_STYLE_V1 (2026-11-16): the partner's 攻擊／技能／支援 style, read from its species'
 * moves and its two special skills; null for an egg or a species with no moves.
 */
function entryBattleStyle(entry) {
  const stats = entry?.stats;
  if (!stats || !Number.isSafeInteger(stats.speciesIndex)) return null;
  return battleStyleOf({ speciesId: stats.speciesIndex, specialSkills: [stats.source12C, stats.source130].filter(isSpecialSkillId) });
}

/** One special skill: its glyph, its name and one short effect line. */
function specialSkillCell(skillId) {
  const cell = element("dd", "cm-digimon-detail__value cm-skill-cell");
  const info = SPECIAL_SKILL_GLYPHS[skillId];
  if (info) cell.append(battleGlyph(info.glyph));
  cell.append(element("span", "cm-skill-cell__name", specialSkillName(skillId) ?? "", false));
  const effect = info ? specialSkillEffect(info.glyph, info.group) : "";
  if (effect) cell.append(element("span", "cm-skill-cell__effect", effect, false));
  return cell;
}

/**
 * UNIFIED_MOVES_20261118: the 競技招式 row. A partner learns one of its Data Arena element pool's moves for the
 * auto battle (local battles only), or none. Each choice shows the move's icon and name.
 */
export function appendArenaMoveLearning(detail, entry, arenaMoves, rerender) {
  const info = entry?.instanceId ? arenaMoves.get(entry.instanceId) : null;
  if (!info?.options?.length) return;
  const group = element("div", "cm-digimon-stat cm-arena-learn");
  group.dataset.row = "arena-move";
  group.dataset.group = "skill";
  const term = element("dt", "cm-digimon-detail__label", uiText("競技招式"));
  term.setAttribute("data-row", "arena-move");
  const cell = element("dd", "cm-digimon-detail__value cm-arena-learn__choices");
  const choice = (moveId) => {
    const button = element("button", "cm-arena-learn__choice");
    button.type = "button";
    button.dataset.move = moveId ?? "";
    button.setAttribute("aria-pressed", String((info.learned ?? null) === moveId));
    const icon = moveId ? moveIcon(arenaMoveRecordIndex(moveId), "cm-move-icon") : null;
    if (icon) button.append(icon);
    button.append(element("span", "cm-arena-learn__name", moveId ? battleMoveName(arenaMoveRecordIndex(moveId)) ?? moveId : uiText("不帶"), false));
    button.addEventListener("click", () => { const result = arenaMoves.learn(entry.instanceId, moveId); if (result?.ok) rerender(); });
    return button;
  };
  for (const moveId of info.options) cell.append(choice(moveId));
  cell.append(choice(null));
  group.append(term, cell);
  detail.append(group);
}

const ARCHETYPE_EMBLEMS = Object.freeze({
  TANK: "🛡️",
  STRIKER: "🔥",
  CASTER: "✨",
  SPEED: "⚡",
  BALANCED: "🌿"
});

function appendPartnerIdentityCard(detail, entry) {
  const card = entry?.identityCard;
  if (!card) return;
  const wrap = element("div", "cm-partner-identity");
  wrap.dataset.archetype = card.archetype;
  const head = element("div", "cm-partner-identity__head");
  const emblem = ARCHETYPE_EMBLEMS[card.archetype] ?? "🌿";
  head.append(
    element("span", "cm-partner-identity__archetype", `${emblem} ${uiText(`PARTNER_ARCHETYPE_${card.archetype}`)}`, false),
    element("span", "cm-partner-identity__tactic", `PARTNER_TACTIC_${card.tactic}`)
  );
  if (card.mood) {
    const mood = element("span", "cm-partner-identity__mood", `${card.mood.emoji} ${card.mood.label}`, false);
    mood.dataset.tier = card.mood.tier;
    head.append(mood);
  }
  const story = element("p", "cm-partner-identity__story", uiText(card.storyKey ?? "PARTNER_STORY_ROOKIE", {
    trait: uiText(card.traitKey ?? `PARTNER_TRAIT_${card.archetype}`),
    care: uiText(card.careKey ?? "PARTNER_CARE_PHRASE_CLEAN"),
    wins: card.wins,
    battles: card.battles,
    rebirths: card.rebirths
  }), false);
  wrap.append(head, story);
  if (Array.isArray(card.milestones) && card.milestones.length) {
    const badges = element("div", "cm-partner-identity__milestones");
    for (const id of card.milestones) {
      const b = element("span", "cm-partner-identity__badge", `PARTNER_MILESTONE_${id}`);
      b.dataset.milestone = id;
      badges.append(b);
    }
    wrap.append(badges);
  }
  detail.append(wrap);
}

function appendEvolutionCompass(detail, entry, { onToggleEvolutionPin = null } = {}) {
  const compass = entry?.evolutionCompass;
  if (!compass?.branches?.length) return;
  const wrap = element("div", "cm-evolution-compass");
  wrap.dataset.species = String(compass.speciesIndex);
  const head = element("div", "cm-evolution-compass__head");
  head.append(element("span", "cm-evolution-compass__title", "EVOLUTION_COMPASS_TITLE"));
  if (compass.syncGate) {
    head.append(element("span", "cm-evolution-compass__gate", uiText("EVOLUTION_COMPASS_SYNC_GATE", compass.syncGate), false));
  }
  wrap.append(head);
  for (let i = 0; i < compass.branches.length; i++) {
    const branch = compass.branches[i];
    const row = element("div", "cm-evolution-compass__branch");
    row.dataset.ready = String(branch.ready);
    row.dataset.revealed = String(branch.revealed);
    row.dataset.pinned = String(Boolean(branch.pinned));
    const top = element("div", "cm-evolution-compass__row");
    const targetLabel = branch.targetName ?? uiText("EVOLUTION_COMPASS_UNKNOWN", { n: i + 1 });
    top.append(element("span", "cm-evolution-compass__target", targetLabel, false));
    const actions = element("span", "cm-evolution-compass__actions");
    actions.append(element("span", "cm-evolution-compass__badge", branch.ready
      ? uiText("EVOLUTION_COMPASS_READY")
      : uiText("EVOLUTION_COMPASS_PROGRESS", { met: branch.metCount, total: branch.totalCount }), false));
    if (onToggleEvolutionPin && entry?.instanceId) {
      const pinBtn = element("button", "cm-evolution-compass__pin", branch.pinned ? "EVOLUTION_COMPASS_PINNED" : "EVOLUTION_COMPASS_PIN");
      pinBtn.type = "button";
      pinBtn.dataset.branchIndex = String(branch.branchIndex);
      pinBtn.setAttribute("aria-pressed", String(Boolean(branch.pinned)));
      pinBtn.addEventListener("click", () => onToggleEvolutionPin(entry.instanceId, compass.speciesIndex, branch.branchIndex));
      actions.append(pinBtn);
    }
    top.append(actions);
    const bar = element("div", "cm-evolution-compass__bar");
    const fill = element("span", "cm-evolution-compass__fill");
    fill.style.width = `${Math.round(Math.max(0, Math.min(1, branch.ratio)) * 100)}%`;
    bar.append(fill);
    row.append(top, bar);
    if (branch.unmet.length) {
      const gaps = branch.unmet.map((item) => {
        const label = uiText(item.labelKey);
        return item.operator === "LTE"
          ? uiText("EVOLUTION_COMPASS_GAP_LTE", { label, target: item.target, current: item.current })
          : uiText("EVOLUTION_COMPASS_GAP_GTE", { label, gap: item.gap, current: item.current, target: item.target });
      });
      row.append(element("p", "cm-evolution-compass__gaps", gaps.join(" · "), false));
    }
    wrap.append(row);
  }
  detail.append(wrap);
}

function appendTrainingTendencyCard(detail, entry, { onSetTrainingTendency = null, onOpenPracticeFor = null } = {}) {
  if (!entry?.instanceId || (!onSetTrainingTendency && !entry?.trainingTendency)) return;
  const current = entry.trainingTendency ?? null;
  const kind = current?.kind ?? null;
  const wrap = element("div", "cm-partner-tendency");
  wrap.dataset.tendency = kind ?? "NONE";
  const head = element("div", "cm-partner-tendency__head");
  const currentLabel = kind ? partnerTendencyText(`kind.${kind}`) : partnerTendencyText("none");
  const sourceLabel = current?.source === "CAGE_ECO" ? ` · ${partnerTendencyText("sourceCage")}` : current?.source === "RANCH_DRILL" ? ` · ${partnerTendencyText("sourceDrill")}` : "";
  head.append(
    element("span", "cm-partner-tendency__title", partnerTendencyText("title"), false),
    element("span", "cm-partner-tendency__current", partnerTendencyText("current", { label: `${currentLabel}${sourceLabel}` }), false)
  );
  const desc = element("p", "cm-partner-tendency__desc", partnerTendencyText(`desc.${kind ?? "NONE"}`), false);
  wrap.append(head, desc);
  if (onSetTrainingTendency) {
    const actions = element("div", "cm-partner-tendency__actions");
    actions.setAttribute("role", "radiogroup");
    actions.setAttribute("aria-label", partnerTendencyText("title"));
    for (const option of ["ENDURANCE", "SKILL"]) {
      const btn = element("button", "cm-partner-tendency__btn", partnerTendencyText(`kind.${option}`), false);
      btn.type = "button";
      btn.setAttribute("role", "radio");
      btn.dataset.tendencyOption = option;
      btn.setAttribute("aria-checked", String(kind === option));
      btn.addEventListener("click", () => onSetTrainingTendency(entry.instanceId, option));
      actions.append(btn);
    }
    if (kind) {
      const clearBtn = element("button", "cm-partner-tendency__btn cm-partner-tendency__btn--clear", partnerTendencyText("clear"), false);
      clearBtn.type = "button";
      clearBtn.dataset.tendencyOption = "CLEAR";
      clearBtn.addEventListener("click", () => onSetTrainingTendency(entry.instanceId, null));
      actions.append(clearBtn);
    }
    if (onOpenPracticeFor) {
      const sparBtn = element("button", "cm-partner-tendency__spar", partnerTendencyText("sparCta"), false);
      sparBtn.type = "button";
      sparBtn.addEventListener("click", () => onOpenPracticeFor(entry.instanceId));
      actions.append(sparBtn);
    }
    wrap.append(actions);
  }
  detail.append(wrap);
}

export function appendCreatureDetail(detail, entry, { onBurstForm = null, onAwakening = null, onToggleEvolutionPin = null, onSetTrainingTendency = null, onOpenPracticeFor = null } = {}) {
  appendPartnerIdentityCard(detail, entry);
  appendTrainingTendencyCard(detail, entry, { onSetTrainingTendency, onOpenPracticeFor });
  appendEvolutionCompass(detail, entry, { onToggleEvolutionPin });
  const style = entryBattleStyle(entry);
  for (const row of TRACED_DETAIL_ROWS) {
    if (row.id === "sp1" && style) {
      const group = element("div", "cm-digimon-stat cm-digimon-stat--style");
      group.dataset.row = "style";
      group.dataset.group = "skill";
      group.dataset.style = style;
      const term = element("dt", "cm-digimon-detail__label", battleStyleText("label"), false);
      term.setAttribute("data-row", "style");
      const cell = element("dd", "cm-digimon-detail__value cm-skill-cell");
      cell.append(battleGlyph(STYLE_GLYPHS[style]), element("span", "cm-skill-cell__name", battleStyleText(`style.${style}`), false));
      group.append(term, cell);
      detail.append(group);
    }
    const value = row.read(entry);
    if (value === null || value === undefined) continue;
    const skillId = row.id === "sp1" ? entry.stats?.source12C : row.id === "sp2" ? entry.stats?.source130 : null;
    if (isSpecialSkillId(skillId)) {
      const term = element("dt", "cm-digimon-detail__label", row.label);
      term.setAttribute("data-row", row.id);
      const group = element("div", "cm-digimon-stat");
      group.dataset.row = row.id;
      group.dataset.group = "skill";
      group.append(term, specialSkillCell(skillId));
      detail.append(group);
      continue;
    }
    const term = element("dt", "cm-digimon-detail__label", row.label);
    term.setAttribute("data-row", row.id);
    const cell = element("dd", "cm-digimon-detail__value", String(value), row.id !== "nickname");
    const group = element("div", "cm-digimon-stat");
    group.dataset.row = row.id;
    group.dataset.group = ROW_GROUPS[row.id] ?? "identity";
    // Vital bars read their fill from the same numbers the text shows.
    const pair = row.id === "HP" ? [entry.stats?.currentHp, entry.stats?.maxHp] : row.id === "TP" ? [entry.stats?.currentTp, entry.stats?.maxTp] : null;
    if (pair && Number.isFinite(pair[0]) && Number.isFinite(pair[1]) && pair[1] > 0) group.style.setProperty("--fill", String(Math.max(0, Math.min(1, pair[0] / pair[1]))));
    group.append(term, cell);
    detail.append(group);
  }
  const taxonomy = speciesTaxonomy(entry.identity?.recordIndex);
  if (taxonomy) {
    const group = element("div", "cm-digimon-stat cm-digimon-stat--taxonomy");
    group.dataset.row = "taxonomy";
    group.dataset.group = "identity";
    const term = element("dt", "cm-digimon-detail__label", taxonomyText('label.element'), false);
    term.setAttribute("data-row", "taxonomy");
    const cell = element("dd", "cm-digimon-detail__value cm-taxonomy-detail");
    cell.append(taxonomyBadgeRow(taxonomy), elementChartButton(taxonomy.element));
    group.append(term, cell);
    detail.append(group);
  }
  // OWNER_APPROVED_ADAPTATION 2026-11-02: a 成熟期 partner's awakening path (or, without it, its burst forms).
  if (entry.awakening?.forms?.length) appendAwakening(detail, entry, onAwakening);
  else if (Array.isArray(entry.burst) && entry.burst.length) {
    const group = element("div", "cm-digimon-stat cm-digimon-burst");
    group.dataset.row = "burst";
    group.dataset.group = "burst";
    group.append(element("dt", "cm-digimon-detail__label", "DEX_BURST"));
    const cell = element("dd", "cm-digimon-detail__value");
    for (const form of entry.burst) {
      // Each unlocked form, and each unlocked alternate of it, is a choice for the battle burst.
      for (const shown of [form.form, ...(form.unlocked ? form.alternatesUnlocked ?? [] : [])]) {
        const line = element("p", "cm-digimon-burst__form");
        line.dataset.tier = String(form.tier);
        line.dataset.unlocked = String(form.unlocked);
        line.append(element("strong", "", `DEX_BURST_TIER_${form.tier}`), " ", element("span", "", speciesName(shown), false), " ");
        if (!form.unlocked) {
          line.append(element("span", "cm-digimon-burst__state", form.rows.map(row => `${uiText(`DEX_CONDITION_${row.id}`)} ${row.current}/${row.value}`).join("・"), false));
        } else if (form.planned === shown) {
          line.dataset.planned = "true";
          line.append(element("span", "cm-digimon-burst__state", "出戰形態"));
        } else {
          line.append(element("span", "cm-digimon-burst__state", "已解鎖"));
          if (onBurstForm) {
            const choose = element("button", "cm-digimon-burst__choose", "設為爆裂形態");
            choose.type = "button";
            choose.dataset.form = String(shown);
            choose.addEventListener("click", () => onBurstForm(entry.instanceId, shown));
            line.append(" ", choose);
          }
        }
        cell.append(line);
      }
    }
    group.append(cell);
    detail.append(group);
  }
  const graphValues = entry.stats?.resistanceGraph;
  if (Array.isArray(graphValues) && graphValues.length === 5) {
    const graph = element('div', 'cm-digimon-resistance');
    graph.setAttribute('role', 'img');
    graph.setAttribute('aria-label', formatList(graphValues.map(part => `${uiText(RESISTANCE_LABELS[part.id] ?? part.id)} ${part.pixels}`)));
    graph.append(element('span', 'cm-digimon-resistance__title', '抗性'));
    const bar = element('span', 'cm-digimon-resistance__bar');
    for (const part of graphValues) {
      const segment = element('span', `cm-digimon-resistance__segment cm-digimon-resistance__segment--${part.id.toLowerCase()}`);
      segment.style.flexGrow = String(part.pixels);
      segment.title = `${uiText(RESISTANCE_LABELS[part.id] ?? part.id)} ${part.pixels}/78`;
      bar.append(segment);
    }
    graph.append(bar);
    // Each bar keeps its original meaning and also covers one new element (Owner 2026-10-29).
    const axes = element('span', 'cm-digimon-resistance__axes');
    for (const [axis, pair] of Object.entries(TAXONOMY_RESISTANCE_AXES)) {
      const item = element('span', '', `${taxonomyText(`axis.${axis}`)}＝${pair.map(el => taxonomyText(`element.${el}`)).join('／')}`, false);
      item.dataset.axis = axis;
      axes.append(item);
    }
    graph.append(axes);
    detail.append(graph);
  }
}

/**
 * Mount the roster.
 *
 * @param {object} options
 * @param {HTMLElement} options.root
 * @param {Array<object>} options.entries roster entries with displayName, stats, identity
 * @param {() => void} options.onExit
 * @param {(instanceId: string, name: string) => ({ok: boolean, entries?: Array<object>})} [options.onRename]
 * @param {(instanceId: string) => ({ok: boolean, reason?: string, entries?: Array<object>})} [options.onRebirth]
 */
export function createDigimonListView({ root, entries = [], onExit, onRename = null, onRebirth = null, onBurstForm = null, onAwakening = null, onToggleEvolutionPin = null, onSetTrainingTendency = null, onOpenPracticeFor = null, fusion = null, initialInstanceId = null, arenaMoves = null, onGoBattle = null, onGoHunt = null } = {}) {
  if (!root) throw new TypeError("The Digimon list requires a root element");

  root.replaceChildren();
  root.className = "cm-digimon-root";
  root.dataset.uiAuthority = "CHAMPIONSHIP_MODERN_UI_SYSTEM_P1R";
  root.dataset.originalScenes = "ui/digimon_list_main.nxr,ui/digimon_list_sub.nxr,ui/digimon_list_item.nxr";

  const shell = element("section", "cm-digimon-shell");
  shell.append(element("p", "cm-digimon-kicker", "管理"), element("h1", "cm-digimon-title", "ROSTER"));

  const list = element("ul", "cm-digimon-list");
  const detail = element("dl", "cm-digimon-detail");

  // The ranch card's › opens the roster on its own partner (Owner 2026-11-09: one partner page, not two).
  const initial = initialInstanceId === null ? -1 : entries.findIndex((entry) => entry.instanceId === initialInstanceId);
  let selectedIndex = initial >= 0 ? initial : entries.length > 0 ? 0 : -1;

  function renderDetail() {
    detail.replaceChildren();
    const entry = entries[selectedIndex];
    if (!entry) {
      detail.append(element("p", "cm-digimon-empty", "No partner in the roster."));
      return;
    }
    appendCreatureDetail(detail, entry, { onBurstForm: onBurstForm ? (instanceId, form) => {
      const result = onBurstForm(instanceId, form);
      if (result?.ok && Array.isArray(result.entries)) { entries = result.entries; renderDetail(); }
    } : null, onAwakening: onAwakening ? (action, instanceId, value) => {
      const result = onAwakening(action, instanceId, value);
      if (Array.isArray(result?.entries)) { entries = result.entries; renderDetail(); }
      return result;
    } : null, onToggleEvolutionPin: onToggleEvolutionPin ? (instanceId, speciesIndex, branchIndex) => {
      const result = onToggleEvolutionPin(instanceId, speciesIndex, branchIndex);
      if (result?.ok && Array.isArray(result.entries)) { entries = result.entries; renderDetail(); }
    } : null, onSetTrainingTendency: onSetTrainingTendency ? (instanceId, kind) => {
      const result = onSetTrainingTendency(instanceId, kind);
      if (result?.ok && Array.isArray(result.entries)) { entries = result.entries; renderDetail(); renderList(); }
    } : null, onOpenPracticeFor });
    if (arenaMoves) appendArenaMoveLearning(detail, entry, arenaMoves, renderDetail);
    // Say what is missing rather than leaving the panel silently short.
    const note = element("p", "cm-digimon-untraced",
      `${UNTRACED_DETAIL_ROWS.length} further rows the original shows are not traced yet.`);
    note.dataset.untraced = UNTRACED_DETAIL_ROWS.join(",");
    note.hidden = new URLSearchParams(globalThis.location?.search??'').get('presentation') !== 'developer';
    detail.append(note);
  }

  function renderList() {
    list.replaceChildren();
    entries.forEach((entry, index) => {
      const item = element("li", "cm-digimon-item");
      const button = element("button", "cm-digimon-item__button");
      button.type = "button";
      button.dataset.index = String(index);
      button.setAttribute("aria-pressed", String(index === selectedIndex));
      // The partner itself leads the name, held on its first idle cell (Owner 2026-11-12: the
      // encyclopedia's illustration stays in the encyclopedia). Loaded as the row scrolls in.
      const thumb = element("span", "cm-digimon-item__thumb");
      thumb.setAttribute("aria-hidden", "true");
      if (Number.isSafeInteger(entry.identity?.recordIndex)) thumb.append(createActionPortrait({ species: entry.identity.recordIndex, still: true }).element);
      const nameNode = element("span", "cm-digimon-item__name", entry.displayName, false);
      if (entry.bloodline) {
        // Cyber Gachapon metal bloodline badge before the name.
        const badge = element("span", "cm-gacha-badge", `[${entry.bloodline.title}]`, false);
        badge.style.setProperty("--bloodline", entry.bloodline.color);
        nameNode.prepend(badge, " ");
        button.dataset.bloodline = entry.bloodline.family;
      }
      button.append(thumb, nameNode);
      button.addEventListener("click", () => {
        selectedIndex = index;
        closeEditor();
        renderList();
        renderDetail();
        refreshControls();
      });
      item.append(button);
      list.append(item);
    });
    if (entries.length === 0) list.append(element("li", "cm-digimon-empty", "Empty roster."));
  }

  const controls = element("div", "cm-digimon-controls");
  let nameEdit = null;
  for (const id of ROSTER_CONTROLS) {
    const button = element("button", "cm-digimon-control", id.replace("_button", "").replace("_", " ").toUpperCase());
    button.type = "button";
    button.dataset.control = id;
    if (id === "name_edit_button") { nameEdit = button; continue; }
    button.disabled = true;
    button.hidden = true;
    button.dataset.state = "NOT_IMPLEMENTED";
    button.title = uiText("In the original, not yet in this build");
    controls.append(button);
  }
  controls.prepend(nameEdit);
  // OWNER_APPROVED_ADAPTATION 2026-11-02: 成熟期 no longer ages out, so rebirth is the player's choice.
  const rebirth = element("button", "cm-digimon-control", "轉生");
  rebirth.type = "button";
  rebirth.dataset.control = "rebirth_button";
  controls.append(rebirth);
  // Same-line fusion (LINE_FUSION_20261117 P2): saved partners of this partner's own line feed its Sync EXP.
  const fuse = element("button", "cm-digimon-control", "FUSE");
  fuse.type = "button";
  fuse.dataset.control = "fusion_button";
  controls.append(fuse);
  // ROADMAP_R3_20261118: the partner's stars, its level against the cap they give, and the star meter -- drawn
  // (presentation/starEmblemArt.js), not written. The words stay as the strip's accessible name.
  const starLine = element("div", "cm-digimon-star", "", false);
  starLine.hidden = true;
  starLine.setAttribute("role", "img");
  controls.append(starLine); // a row of its own under the keys; the shell's wide grid has no cell to spare
  const starText = (sync) => [uiText("STAR_LINE", { star: sync.star, level: sync.level, cap: sync.cap }),
    sync.starNeed > 0 ? uiText("STAR_METER", { points: sync.starPoints, need: sync.starNeed }) : uiText("STAR_FULL")].join(" · ");
  const fusionStarText = (stars) => !stars ? null : stars.gained > 0 ? uiText("FUSION_STAR_UP", { before: stars.before.star, after: stars.after.star })
    : stars.points > 0 && stars.after.need > 0 ? uiText("STAR_METER", { points: stars.after.points, need: stars.after.need }) : null;
  const meterGroup = (points, need, preview = 0) => {
    const group = element("span", "cm-digimon-star__next", "", false);
    group.append(starEmblem({ on: !(need > 0), size: 14 }), starMeter({ points, need, preview }),
      element("b", "", need > 0 ? `${Math.min(need, points + preview)}/${need}` : uiText("STAR_FULL"), false));
    return group;
  };
  /** Draw the strip for `sync`; `gained` stars stamp in (after a fusion that raised them). */
  function paintStarStrip(sync, { gained = 0 } = {}) {
    const key = [sync.star, sync.level, sync.cap, sync.starPoints, sync.starNeed, sync.capped].join(":");
    if (starLine.dataset.key === key && !gained) return;
    starLine.dataset.key = key;
    starLine.dataset.star = String(sync.star);
    starLine.dataset.capped = String(Boolean(sync.capped));
    starLine.setAttribute("aria-label", starText(sync));
    starLine.title = sync.capped ? uiText("FUSION_CAPPED") : "";
    starLine.replaceChildren(starPips({ star: sync.star, gained, size: 20 }),
      starLevelGauge({ level: sync.level, cap: sync.cap, capped: sync.capped }), meterGroup(sync.starPoints, sync.starNeed));
  }
  // Say why two of the three stay grey instead of leaving a silent row.
  const controlsNote = element("p", "cm-digimon-controls-note", "移除與報名尚未開放。");
  controlsNote.hidden = true;

  // Name edit opens in place under the controls and writes through the
  // existing rename; the starter's name comes from the opening and is fixed.
  const editor = element("form", "cm-digimon-rename");
  editor.hidden = true;
  const editorLabel = element("label", "cm-digimon-rename__label", "新的暱稱");
  const editorInput = element("input", "cm-digimon-rename__input");
  editorInput.type = "text";
  editorInput.maxLength = ROSTER_NAME_MAX_LENGTH;
  editorInput.autocomplete = "off";
  editorInput.spellcheck = false;
  editorInput.setAttribute("aria-label", uiText("新的暱稱"));
  editorLabel.append(editorInput);
  const editorMessage = element("p", "cm-digimon-rename__message");
  editorMessage.setAttribute("role", "status");
  const editorActions = element("div", "cm-digimon-rename__actions");
  const editorCancel = element("button", "cm-screen-back", "取消");
  editorCancel.type = "button";
  const editorSave = element("button", "cm-screen-primary", "儲存名稱");
  editorSave.type = "submit";
  editorActions.append(editorCancel, editorSave);
  editor.append(editorLabel, editorMessage, editorActions);
  // Rebirth asks once in place, like Name Edit, and reports the result under the controls.
  const rebirthPanel = element("div", "cm-digimon-rename cm-digimon-rebirth");
  rebirthPanel.hidden = true;
  const rebirthQuestion = element("p", "cm-digimon-rename__label", "", false);
  const rebirthActions = element("div", "cm-digimon-rename__actions");
  const rebirthCancel = element("button", "cm-screen-back", "取消");
  rebirthCancel.type = "button";
  const rebirthConfirm = element("button", "cm-screen-primary", "轉生");
  rebirthConfirm.type = "button";
  rebirthActions.append(rebirthCancel, rebirthConfirm);
  const rebirthMessage = element("p", "cm-digimon-rename__message");
  rebirthMessage.setAttribute("role", "status");
  rebirthPanel.append(rebirthQuestion, rebirthActions);
  const REBIRTH_REFUSALS = Object.freeze({
    PARTNER_NOT_IN_RANCH: "這隻拍檔不在牧場裡，請先讓牠住進籠舍再轉生。",
    EVOLUTION_RUNNING: "牧場裡正在進化，請稍後再試。",
    NOT_FINAL_STAGE: "只有成熟期的拍檔可以轉生。"
  });
  // The fusion panel: tick up to five same-line partners, read what the base gains, confirm once.
  const fusionPanel = element("div", "cm-digimon-rename cm-digimon-fusion");
  fusionPanel.hidden = true;
  const fusionTitle = element("p", "cm-digimon-rename__label", "", false);
  const fusionList = element("div", "cm-digimon-fusion__list");
  // R3: what the fusion would give, drawn: stars to be gained blink, the meter shows the striped part ahead.
  const fusionViz = element("div", "cm-digimon-fusion__viz", "", false);
  fusionViz.hidden = true;
  fusionViz.setAttribute("aria-hidden", "true");
  const fusionPreview = element("p", "cm-digimon-fusion__preview", "", false);
  fusionPreview.setAttribute("role", "status");
  const fusionActions = element("div", "cm-digimon-rename__actions");
  const fusionCancel = element("button", "cm-screen-back", "取消");
  fusionCancel.type = "button";
  const fusionConfirm = element("button", "cm-screen-primary", "CONFIRM FUSE");
  fusionConfirm.type = "button";
  fusionActions.append(fusionCancel, fusionConfirm);
  fusionPanel.append(fusionTitle, fusionList, fusionViz, fusionPreview, fusionActions);
  const fusionMessage = element("p", "cm-digimon-rename__message");
  fusionMessage.setAttribute("role", "status");
  let fusionPicked = [];
  let starCeremony = null, starUpGained = 0;
  const number = (value) => Number(value).toLocaleString("en-US");
  function closeFusion() { fusionPanel.hidden = true; fusionPicked = []; }
  function renderFusion() {
    const entry = entries[selectedIndex], frame = entry ? fusion?.candidates?.(entry.instanceId) : null;
    fusionList.replaceChildren();
    const usable = (frame?.fodders ?? []).filter((fodder) => !fodder.refusal);
    fusionPicked = fusionPicked.filter((id) => usable.some((fodder) => fodder.instanceId === id));
    fusionTitle.textContent = uiText("FUSION_PICK", { count: fusionPicked.length, max: frame?.max ?? 5 });
    for (const fodder of frame?.fodders ?? []) {
      const row = element("label", "cm-digimon-fusion__row");
      const box = element("input", "cm-digimon-fusion__box");
      box.type = "checkbox";
      box.checked = fusionPicked.includes(fodder.instanceId);
      box.disabled = Boolean(fodder.refusal) || (!box.checked && fusionPicked.length >= (frame?.max ?? 5));
      box.dataset.fusionFodder = fodder.instanceId;
      box.addEventListener("change", () => {
        fusionPicked = box.checked ? [...fusionPicked, fodder.instanceId] : fusionPicked.filter((id) => id !== fodder.instanceId);
        renderFusion();
      });
      const name = element("span", "cm-digimon-fusion__name", "", false);
      name.textContent = fodder.displayName;
      const facts = element("span", "cm-digimon-fusion__facts", "", false);
      facts.textContent = fodder.refusal ? uiText(fodder.refusal)
        : [fodder.grade ?? "—", `Lv.${fodder.level}`, fodder.line < 1 ? "×0.6" : "×1.0"].join(" · ");
      row.append(box, name, facts);
      if (box.checked) for (const warning of fodder.warnings ?? []) {
        const note = element("span", "cm-digimon-fusion__warning", "", false);
        note.textContent = warning.kind === "LEVEL" ? uiText("FUSION_LOSE_LEVEL", { level: warning.level })
          : warning.kind === "STAR" ? uiText("FUSION_LOSE_STAR", { star: warning.star })
          : uiText(warning.kind === "BURST" ? "FUSION_LOSE_BURST" : "FUSION_LOSE_BLOODLINE");
        row.append(note);
      }
      fusionList.append(row);
    }
    if (!(frame?.fodders ?? []).length) fusionList.append(element("p", "cm-digimon-fusion__empty", "FUSION_NO_FODDER"));
    const preview = entry && fusionPicked.length ? fusion?.preview?.(entry.instanceId, fusionPicked) : null;
    fusionConfirm.disabled = !preview;
    fusionViz.hidden = !preview?.stars;
    if (preview?.stars) {
      const { stars, after } = preview, gained = stars.gained > 0;
      fusionViz.replaceChildren(starPips({ star: stars.before.star, ghost: stars.gained, size: 20 }),
        element("span", "cm-digimon-fusion__arrow", "▶", false),
        starLevelGauge({ level: after.level, cap: after.cap, capped: after.capped }),
        gained ? meterGroup(0, stars.after.need, stars.after.points) : meterGroup(stars.before.points, stars.before.need, stars.after.points - stars.before.points));
      fusionViz.dataset.gained = String(stars.gained);
    }
    const unlockedBreakthroughs = preview
      ? syncBreakthroughsAt(preview.after.level).filter((entry) => entry.level > preview.before.level)
      : [];
    const vitalDelta = preview && preview.after.level > preview.before.level
      ? uiText("FUSION_COMBAT_VITAL", { before: syncVitalPercent(preview.before.level), after: syncVitalPercent(preview.after.level) })
      : null;
    fusionPreview.textContent = !preview ? ""
      : [`Lv.${preview.before.level} → Lv.${preview.after.level}`, `+${number(preview.amount)} EXP`,
        vitalDelta,
        ...unlockedBreakthroughs.map((entry) => uiText("FUSION_BREAKTHROUGH_UNLOCK", { level: entry.level })),
        fusionStarText(preview.stars),
        preview.after.capped ? uiText("FUSION_CAPPED") : preview.after.next > 0 ? uiText("FUSION_LEFT", { exp: number(preview.after.next - preview.after.exp) }) : null,
        preview.overflow > 0 ? uiText("FUSION_CRYSTALS", { count: number(preview.overflow) }) : null,
        preview.inherit?.length ? uiText("FUSION_INHERIT", { n: number(preview.inherit.length) }) : null].filter(Boolean).join(" · ");
  }
  function closeRebirth() { rebirthPanel.hidden = true; }
  function closeEditor() { editor.hidden = true; editorMessage.textContent = ""; closeRebirth(); closeFusion(); }
  function refreshControls() {
    const entry = entries[selectedIndex];
    const renameable = Boolean(onRename && entry && entry.renameable !== false);
    nameEdit.disabled = !renameable;
    nameEdit.dataset.state = onRename ? "READY" : "NOT_IMPLEMENTED";
    nameEdit.title = !onRename ? uiText("In the original, not yet in this build")
      : entry?.renameable === false ? uiText("初始夥伴的名字在開場時決定，無法更改。") : "";
    const mature = entry?.identity?.generationIndex === 4;
    rebirth.disabled = !(onRebirth && mature);
    rebirth.dataset.state = onRebirth ? "READY" : "NOT_IMPLEMENTED";
    rebirth.title = onRebirth && !mature ? uiText("只有成熟期的拍檔可以轉生。") : "";
    const fodders = entry && fusion ? fusion.candidates?.(entry.instanceId)?.fodders ?? [] : [];
    const usableCount = fodders.filter((fodder) => !fodder.refusal).length;
    const sync = entry && fusion?.sync ? fusion.sync(entry.instanceId) : null;
    starLine.hidden = !sync;
    if (sync) { paintStarStrip(sync, { gained: starUpGained }); starUpGained = 0; }
    fuse.hidden = !fusion;
    fuse.disabled = usableCount === 0;
    fuse.dataset.ready = String(usableCount > 0);
    fuse.textContent = usableCount > 0 ? uiText("FUSION_READY_COUNT", { count: usableCount }) : uiText("FUSE");
    fuse.title = fusion && fuse.disabled ? uiText("FUSION_NO_FODDER") : "";
  }
  fuse.addEventListener("click", () => {
    if (!entries[selectedIndex] || fuse.disabled) return;
    editor.hidden = true; closeRebirth();
    fusionMessage.textContent = "";
    fusionPicked = [];
    renderFusion();
    fusionPanel.hidden = false;
    fusionPanel.scrollIntoView?.({ block: "center" });
  });
  fusionCancel.addEventListener("click", () => closeFusion());
  fusionConfirm.addEventListener("click", () => {
    const entry = entries[selectedIndex];
    if (!entry || !fusionPicked.length) return;
    const result = fusion?.fuse?.(entry.instanceId, [...fusionPicked]);
    closeFusion();
    if (!result?.ok) { fusionMessage.textContent = uiText(result?.reason === "SAVE_FAILED" ? "FUSION_SAVE_FAILED" : result?.reason ?? "FUSION_NO_FODDER"); return; }
    // 傳承: the receipt names what the base took, as the preview did.
    fusionMessage.textContent = `${entry.displayName ?? ""} Lv.${result.gain.before.level} → Lv.${result.gain.after.level} · +${number(result.gain.amount)} EXP`
      + (fusionStarText(result.gain.stars) ? ` · ${fusionStarText(result.gain.stars)}` : "")
      + (result.inherit?.length ? ` · ${uiText("FUSION_INHERIT", { n: number(result.inherit.length) })}` : "");
    // R3: the moment it pays off. A star gained is a ceremony (the fusion is already saved); otherwise the strip
    // flashes with the level-up or sparkle cue.
    const stars = result.gain.stars, leveled = result.gain.after.level > result.gain.before.level;
    starUpGained = stars?.gained > 0 ? stars.gained : 0;
    if (starUpGained > 0) {
      starCeremony?.dispose();
      const label = `${entry.displayName ?? ""} ${uiText("FUSION_STAR_UP", { before: stars.before.star, after: stars.after.star })}`;
      // The roster scrolls, so the moment plays on a layer pinned to the screen, removed when it ends.
      const stage = element("div", "cm-digimon-starstage", "", false);
      root.append(stage);
      starCeremony = playCeremony({ host: stage, kind: "star-up", cue: "medal", label,
        build: (stage, env) => buildStarUp(stage, env, { kicker: uiText("STAR_UP_KICKER"), title: entry.displayName ?? "",
          meta: uiText("STAR_UP_META", { star: stars.after.star, cap: result.gain.after.cap }),
          species: Number.isSafeInteger(entry.identity?.recordIndex) ? entry.identity.recordIndex : null,
          star: stars.after.star, gained: stars.gained, hint: uiText("輕觸繼續") }),
        onDone: () => { starCeremony = null; stage.remove(); } });
    } else {
      requestArcadeFx(starLine, leveled ? "levelup" : "sparkle");
      starLine.dataset.flash = "true";
      setTimeout(() => { delete starLine.dataset.flash; }, 700);
    }
    if (Array.isArray(result.entries)) {
      entries = result.entries;
      selectedIndex = Math.max(0, entries.findIndex((row) => row.instanceId === entry.instanceId));
    }
    renderList();
    renderDetail();
    refreshControls();
  });
  rebirth.addEventListener("click", () => {
    const entry = entries[selectedIndex];
    if (!entry || rebirth.disabled) return;
    editor.hidden = true;
    rebirthMessage.textContent = "";
    rebirthQuestion.textContent = uiText("讓 {name} 轉生回蛋嗎？轉生次數 +1，下一代的能力會得到加成。", { name: entry.displayName ?? "" });
    rebirthPanel.hidden = false;
    rebirthPanel.scrollIntoView?.({ block: "center" });
  });
  rebirthCancel.addEventListener("click", () => closeRebirth());
  rebirthConfirm.addEventListener("click", () => {
    const entry = entries[selectedIndex];
    if (!entry) return;
    const result = onRebirth?.(entry.instanceId);
    closeRebirth();
    if (!result?.ok) { rebirthMessage.textContent = uiText(REBIRTH_REFUSALS[result?.reason] ?? "現在無法轉生。"); return; }
    rebirthMessage.textContent = uiText("{name} 開始轉生，回到牧場就能看到。", { name: entry.displayName ?? "" });
    if (Array.isArray(result.entries)) entries = result.entries;
    renderList();
    renderDetail();
    refreshControls();
  });
  nameEdit.addEventListener("click", () => {
    const entry = entries[selectedIndex];
    if (!entry || nameEdit.disabled) return;
    editorInput.value = entry.displayName ?? "";
    editorMessage.textContent = "";
    editor.hidden = false;
    // The editor opens under the controls; bring it above the footer.
    editor.scrollIntoView?.({ block: "center" });
    editorInput.focus?.({ preventScroll: true });
  });
  editorCancel.addEventListener("click", () => closeEditor());
  editor.addEventListener("submit", (event) => {
    event?.preventDefault?.();
    const entry = entries[selectedIndex];
    const name = String(editorInput.value ?? "").trim();
    if (!entry || !name || name.length > ROSTER_NAME_MAX_LENGTH) {
      editorMessage.textContent = uiText("名稱需為 1 至 {max} 個字。", { max: ROSTER_NAME_MAX_LENGTH });
      return;
    }
    const result = onRename?.(entry.instanceId, name);
    if (!result?.ok) {
      editorMessage.textContent = result?.reason === "NOT_RENAMEABLE" ? uiText("這隻拍檔的名字無法更改。") : uiText("名稱需為 1 至 {max} 個字。", { max: ROSTER_NAME_MAX_LENGTH });
      return;
    }
    if (Array.isArray(result.entries)) entries = result.entries;
    closeEditor();
    renderList();
    renderDetail();
    refreshControls();
    editorMessage.textContent = "";
  });

  const footer = element("footer", "cm-screen-footer");
  const back = element("button", "cm-screen-back cm-digimon-back", "返回牧場");
  back.type = "button";
  back.addEventListener("click", () => { onExit?.(); });
  footer.append(back);
  if (typeof onGoHunt === "function") {
    const goHunt = element("button", "cm-screen-back cm-digimon-jump", "LOOP_GO_HUNT");
    goHunt.type = "button";
    goHunt.dataset.loopAction = "hunt";
    goHunt.addEventListener("click", () => { onGoHunt(); });
    footer.append(goHunt);
  }
  if (typeof onGoBattle === "function") {
    const goBattle = element("button", "cm-screen-primary cm-digimon-jump", "LOOP_GO_BATTLE");
    goBattle.type = "button";
    goBattle.dataset.loopAction = "battle";
    goBattle.addEventListener("click", () => { onGoBattle(); });
    footer.append(goBattle);
  }

  shell.append(list, controls, controlsNote, editor, rebirthPanel, rebirthMessage, fusionPanel, fusionMessage, detail, footer);
  root.append(shell);
  renderList();
  renderDetail();
  refreshControls();

  return Object.freeze({
    render() {},
    inspect() {
      return Object.freeze({
        entryCount: entries.length,
        tracedRows: TRACED_DETAIL_ROWS.map((row) => row.id),
        untracedRows: UNTRACED_DETAIL_ROWS,
        generationEvidence: GENERATION_EVIDENCE
      });
    },
    dispose() {
      starCeremony?.dispose(); starCeremony = null;
      root.replaceChildren();
      root.className = "";
    }
  });
}
