// Journey (征途) screen -- OWNER_APPROVED_ADAPTATION 2026-11-10.
//
// One prism face holds the product's progression instead of new menu modes:
// the patrol pod, the Sync Tower and crystal feeding (the six zones and story
// nodes come next). DOM only; every number comes from the app through the
// injected host, and every action goes back through it -- this view never
// grants, saves or starts anything itself.

import { journeyText as t } from "../text/journeyText.js";
import { syncText } from "../text/syncLevelText.js";
import { uiText } from "../text/uiText.js";
import { taxonomyText } from "../text/taxonomyText.js";
import { partnerTendencyText } from "../contracts/productPartnerTendency.js";
import { factionResonance, speciesTaxonomyForId } from "../contracts/speciesTaxonomy.js";
import { createActionPortrait } from "../presentation/juicy/actionPortrait.js";
import { tamerEmblem, tamerLevelBadge, flyEmblems } from "../presentation/tamerEmblemArt.js";
import { talentIcon } from "../presentation/talentIconArt.js";
import { playCeremony } from "../presentation/ceremony/ceremonyRunner.js";
import { buildCapture } from "../presentation/ceremony/ceremonyScenes.js";
import { requestArcadeFx } from "./ui/arcadeFx.js";
import { findEvolutionGateCrossings } from "./battleResultDiagnosis.js";
import { tamerRankName } from "../text/zhHant.js";
import { RANK_UNLOCKS } from "./rankUnlocks.js";

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
};
const button = (className, text, onClick) => {
  const node = el("button", className, text);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
};
const portrait = (src, className = "cm-journey__face") => {
  const frame = el("span", className);
  // A species ({species}) stands as its own body on its first idle cell (Owner 2026-11-12).
  if (src && typeof src === "object" && src.species !== undefined) frame.append(createActionPortrait({ species: src.species, still: true }).element);
  else if (src) {
    const image = el("img");
    Object.assign(image, { src, alt: "", decoding: "async", loading: "lazy" });
    image.addEventListener("error", () => image.remove(), { once: true });
    frame.append(image);
  }
  return frame;
};

/**
 * @param {object} host
 * @param {HTMLElement} host.parent           where the overlay mounts
 * @param {() => object} host.frame           app.getJourneyFrame()
 * @param {(floor: number) => object} host.floor   app.getTowerFloor()
 * @param {() => Promise<object[]>} host.candidates  battle party candidates
 * @param {(entry: object) => {name: string, portrait: string|null}} host.describe
 * @param {(speciesIndex: number) => string|null} host.speciesPortrait
 * @param {(id: string) => {level: number, exp: number, next: number}} host.syncOf
 * @param {() => object} host.claimPatrol
 * @param {() => object} host.quickPatrol
 * @param {(id: string, amount: number) => object} host.feed
 * @param {(floor: number, ids: string[]) => Promise<object>} host.challenge
 * @param {() => void} host.onClose
 * @param {() => object} host.campaign                     app.getCampaignFrame()
 * @param {(zone: number, stage: number) => void} host.challengeZone   opens the Data Arena stage
 * @param {(zone: number, stage: number) => object} host.sweep
 * @param {object} [host.practice]   the practice series (TACTIC_PRACTICE_LOOP_20261116): frame/start/end/tacticOf/setTactic/challenge/text/downloadLog
 * @param {{floor?: number, team?: string[], autoStart?: boolean, tab?: string, zone?: number}} [host.prefill]
 */
export function createJourneyScreen(host) {
  const root = el("section", "cm-journey");
  root.dataset.palette = "arcade";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", t("title"));
  let tab = host.prefill?.tab ?? "TOWER", candidates = [], selectedFloor = null, team = [], busy = false, disposed = false;
  let selectedZone = host.prefill?.zone ?? null, selectedStage = null, dismissedWaveRunId = null;

  const head = el("header", "cm-journey__head");
  const back = button("cm-journey__back cm-arcade-key", t("close"), () => close());
  const title = el("h1", "cm-journey__title", t("title"));
  const crystals = el("span", "cm-journey__crystals");
  head.append(back, title, crystals);

  const pod = el("section", "cm-journey__pod");
  const tabs = el("nav", "cm-journey__tabs");
  tabs.setAttribute("role", "tablist");
  const body = el("div", "cm-journey__body");
  const notice = el("p", "cm-journey__notice");
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  const scroll = el("div", "cm-journey__scroll");
  scroll.append(pod, tabs, body);
  root.append(head, scroll, notice);
  host.parent.append(root);

  const say = (text) => { notice.textContent = text ?? ""; notice.dataset.shown = String(Boolean(text)); };

  function paintPod() {
    const frame = host.frame(), patrol = frame.patrol;
    // JOURNEY_GLANCE_20261118: the purse is a crystal and a number; the words are its accessible name.
    crystals.replaceChildren(...[tamerEmblem("exp-crystal", { size: 18 })].filter(Boolean), el("b", "", frame.crystals.toLocaleString()));
    crystals.setAttribute("aria-label", t("crystals", { value: frame.crystals.toLocaleString() }));
    pod.replaceChildren();
    // JOURNEY_GLANCE_20261118: the pod at a glance is its icon, a gauge that carries the crystals it holds and the
    // hourly rate as a tag; the long title and sentences stay as the accessible name and the hover title.
    pod.setAttribute("aria-label", `${t("patrol.title")}・${t("patrol.rate", { rate: patrol.rate.toLocaleString() })}`);
    pod.title = pod.getAttribute("aria-label");
    const top = el("div", "cm-journey__pod-top");
    const icon = talentIcon("trader.patrol", { size: 40 });
    if (icon) top.append(icon);
    const gauge = el("div", "cm-journey__gauge");
    gauge.dataset.full = String(Boolean(patrol.full));
    const fill = el("i", "cm-journey__gauge-fill");
    fill.style.transform = `scaleX(${Math.min(1, patrol.hours / 12)})`;
    const inGauge = el("span", "cm-journey__gauge-label");
    const gem = tamerEmblem("exp-crystal", { size: 16 });
    if (gem) inGauge.append(gem);
    inGauge.append(el("b", "", patrol.crystals.toLocaleString()));
    gauge.append(fill, inGauge);
    gauge.setAttribute("aria-label", patrol.full ? t("patrol.full", { hours: 12 }) : t("patrol.held", { value: patrol.crystals.toLocaleString() }));
    top.append(gauge, el("span", "cm-journey__pod-rate", `+${patrol.rate.toLocaleString()}/h`));
    const held = el("span", "cm-journey__pod-held", patrol.full ? t("patrol.full", { hours: 12 }) : "");
    held.hidden = !patrol.full;
    const actions = el("div", "cm-journey__pod-actions");
    const claim = button("cm-journey__key cm-journey__key--primary cm-arcade-key", patrol.started ? t("patrol.claim") : t("patrol.start"), () => {
      const result = host.claimPatrol();
      if (result?.ok) say(result.crystals > 0 ? t("patrol.got", { value: result.crystals.toLocaleString() }) : "");
      paint();
    });
    claim.dataset.journeyAction = "claim";
    const quick = button("cm-journey__key cm-arcade-key", patrol.quickAvailable ? t("patrol.quick") : t("patrol.quickUsed"), () => {
      const result = host.quickPatrol();
      if (result?.ok) say(t("patrol.got", { value: result.crystals.toLocaleString() }));
      paint();
    });
    quick.disabled = !patrol.quickAvailable;
    quick.dataset.journeyAction = "quick";
    actions.append(claim, quick);
    if (host.tamer && frame.crystals > 0 && tab !== "FEED") {
      const upgrade = button("cm-journey__key cm-arcade-key cm-journey__key--tamer", uiText("TAMER_UPGRADE_SHORT"), () => { tab = "FEED"; paint(); });
      upgrade.dataset.journeyAction = "open-feed";
      actions.append(upgrade);
    }
    pod.append(top, held, actions);
  }

  function paintTabs() {
    // WAVE_RUN_20261118: the two wave modes lead the row; the tower, crystals, zones and sparring stay as they were.
    const entries = [];
    if (host.wave && typeof host.openStory === "function") entries.push(["STORY", host.wave.text("mode.story")]);
    if (host.wave) entries.push(["CHALLENGE", host.wave.text("mode.challenge")]);
    entries.push(["TOWER", t("tower")], ["FEED", t("feed")], ["ZONES", t("zones")]);
    if (host.practice) entries.push(["PRACTICE", host.practice.text("practice.tab")]);
    tabs.replaceChildren(...entries.map(([id, label]) => {
      const key = button("cm-journey__tab", label, () => { tab = id; paint(); });
      key.setAttribute("role", "tab");
      key.setAttribute("aria-selected", String(tab === id));
      key.dataset.tab = id;
      return key;
    }));
  }

  function floorRow(floor, frame) {
    const info = host.floor(floor);
    const row = button("cm-journey__floor", "", () => { selectedFloor = floor; paint(); });
    row.dataset.floor = String(floor);
    row.dataset.state = info.cleared ? "cleared" : info.open ? "open" : "locked";
    row.setAttribute("aria-pressed", String(floor === selectedFloor));
    row.disabled = !info.open;
    const label = el("span", "cm-journey__floor-no", t("tower.floor", { floor }));
    const stage = el("span", "cm-journey__floor-stage", t(`stage.${info.stage}`));
    const foes = el("span", "cm-journey__floor-foes");
    for (const species of info.species) foes.append(portrait(host.speciesPortrait(species), "cm-journey__foe"));
    const marks = el("span", "cm-journey__floor-marks");
    if (info.rewards.guardian) marks.append(el("b", "cm-journey__mark cm-journey__mark--guardian", t("tower.guardian")));
    else if (info.rewards.chest) marks.append(el("b", "cm-journey__mark", t("tower.chest")));
    if (info.cleared) marks.append(el("b", "cm-journey__mark cm-journey__mark--done", t("tower.cleared")));
    row.append(label, stage, foes, marks);
    if (floor === frame.next && !info.cleared) row.dataset.current = "true";
    return row;
  }

  const MOOD_TP_DELTA = Object.freeze({ superb: "+10% TP", good: "+5% TP", low: "-5% TP", awful: "-10% TP" });
  function moodBadge(mood) {
    if (!mood?.emoji) return null;
    const delta = MOOD_TP_DELTA[mood.tier];
    const tag = el("span", "cm-journey__member-mood", delta ? `${mood.emoji} ${delta}` : mood.emoji);
    tag.dataset.tier = mood.tier ?? "normal";
    tag.title = mood.label ?? "";
    return tag;
  }

  function teamResonanceBanner(selectedIds) {
    const picked = selectedIds.map((id) => candidates.find((c) => c.instanceId === id)).filter(Boolean);
    const factions = picked.map((entry) => speciesTaxonomyForId(entry.speciesId)?.faction);
    const active = factionResonance(factions);
    const bar = el("p", "cm-journey__resonance");
    bar.dataset.active = String(active.length > 0);
    if (active.length > 0) {
      bar.textContent = active.map((id) => `${uiText("CHALLENGE_TEAM_RESONANCE", { label: taxonomyText(`resonance.${id}`) })} · ${taxonomyText(`resonance.${id}.desc`)}`).join(" ／ ");
    } else {
      bar.textContent = `${taxonomyText("resonance.title")}：${taxonomyText("resonance.none")}`;
    }
    return bar;
  }

  function squadTacticsStrip(selectedIds) {
    if (!host.practice || !selectedIds.length) return null;
    const p = host.practice, pt = p.text;
    const wrap = el("div", "cm-journey__squad-tactics");
    for (const id of selectedIds) {
      const entry = candidates.find((c) => c.instanceId === id);
      if (!entry) continue;
      const look = host.describe(entry), current = p.tacticOf(id);
      const row = el("div", "cm-journey__squad-tactic");
      row.dataset.instanceId = id;
      row.append(el("span", "cm-journey__squad-tactic-name", look.name));
      const keys = el("div", "cm-journey__squad-tactic-keys");
      for (const value of [0, 1, 2]) {
        const key = button("cm-journey__tactic-pill", pt(`plan.${value}`), () => {
          if (!busy) { p.setTactic(id, value); paint(); }
        });
        key.setAttribute("aria-pressed", String(value === current));
        key.dataset.plan = String(value);
        keys.append(key);
      }
      row.append(keys);
      wrap.append(row);
    }
    return wrap;
  }

  function emptyTeamCard() {
    const box = el("div", "cm-journey__empty-team");
    box.append(el("p", "cm-journey__empty-hint", uiText("JOURNEY_NO_TEAM_HINT")));
    const reasons = candidates
      .filter((c) => c.admission && !c.admission.ok)
      .slice(0, 3)
      .map((c) => {
        const look = host.describe(c);
        return c.admission?.message ? `${look.name}：${c.admission.message}` : look.name;
      });
    for (const line of reasons) box.append(el("p", "cm-journey__empty-reason", line));
    if (typeof host.onGoHunt === "function") {
      const goHunt = button("cm-journey__go cm-arcade-key cm-journey__hunt-cta", uiText("JOURNEY_NO_TEAM_CTA"), () => host.onGoHunt());
      goHunt.dataset.journeyAction = "go-hunt";
      box.append(goHunt);
    }
    return box;
  }

  function paintTower() {
    const frame = host.frame();
    if (selectedFloor === null || selectedFloor > frame.next) selectedFloor = frame.next;
    const panel = el("div", "cm-journey__tower");
    panel.append(el("p", "cm-journey__best", frame.best >= frame.floors ? t("tower.top") : t("tower.best", { floor: frame.best })));
    // A window of the tower round the next floor, top floor first.
    const list = el("div", "cm-journey__floors");
    const highest = Math.min(frame.floors, frame.next + 3), lowest = Math.max(1, frame.next - 5);
    for (let floor = highest; floor >= lowest; floor--) list.append(floorRow(floor, frame));
    panel.append(list);
    const info = host.floor(selectedFloor);
    const detail = el("div", "cm-journey__detail");
    const rewards = el("div", "cm-journey__rewards");
    rewards.append(el("span", "cm-journey__rewards-title", t("tower.rewards")),
      el("span", "cm-journey__reward", t("tower.crystals", { value: info.rewards.crystals.toLocaleString() })));
    if (info.rewards.tickets) rewards.append(el("span", "cm-journey__reward", t("tower.tickets", { value: info.rewards.tickets })));
    if (info.rewards.diamonds) rewards.append(el("span", "cm-journey__reward cm-journey__reward--gem", t("tower.diamonds", { value: info.rewards.diamonds })));
    if (info.cleared) rewards.dataset.claimed = "true";
    detail.append(rewards, el("p", "cm-journey__team-title", t("tower.team")));
    const roster = el("div", "cm-journey__team");
    const eligible = candidates.filter((c) => c.admission?.ok);
    for (const entry of eligible) {
      const look = host.describe(entry), sync = host.syncOf(entry.instanceId);
      const chip = button("cm-journey__member", "", () => {
        team = team.includes(entry.instanceId) ? team.filter((id) => id !== entry.instanceId) : team.length < 3 ? [...team, entry.instanceId] : team;
        paint();
      });
      chip.dataset.instanceId = entry.instanceId;
      chip.setAttribute("aria-pressed", String(team.includes(entry.instanceId)));
      const moodTag = moodBadge(look.mood);
      chip.append(portrait(look.portrait), el("span", "cm-journey__member-name", look.name), ...(look.styleChip ? [look.styleChip] : []),
        ...(moodTag ? [moodTag] : []),
        el("span", "cm-journey__member-lv", sync.next > 0 ? syncText("level", { level: sync.level }) : syncText("level.max")));
      roster.append(chip);
    }
    const go = button("cm-journey__go cm-arcade-key", t("tower.challenge", { floor: selectedFloor }), () => void start(selectedFloor));
    go.dataset.journeyAction = "challenge";
    go.disabled = busy || team.length === 0 || !info.open;
    const tactics = squadTacticsStrip(team);
    if (eligible.length === 0) detail.append(emptyTeamCard(), go);
    else detail.append(roster, teamResonanceBanner(team), ...(tactics ? [tactics] : []), go);
    panel.append(detail);
    body.replaceChildren(panel);
  }

  // ROADMAP_R1_20261118 (Owner 2026-11-18): the crystals raise the tamer. Shown as a pour station, not a line
  // of text (MECHANICS_AS_GAME_NOT_TEXT_20261118): the tamer's level badge, a wide EXP gauge, the crystal purse
  // and one key that pours what the next level still needs. A pour sends crystals flying into the gauge, the
  // gauge fills, a level gained pops the badge with the level-up cue, and a rank it opens is announced.
  let lastPour = null;
  function paintFeed() {
    const frame = host.frame(), tamer = host.tamer?.() ?? null;
    const panel = el("div", "cm-journey__feed");
    panel.append(el("p", "cm-journey__hint", t("feed.hint")));
    if (tamer) {
      const row = el("div", "cm-journey__feed-row cm-journey__pour");
      row.dataset.feedTarget = "tamer";
      const top = tamer.next === 0, need = top ? 0 : tamer.next - tamer.exp, pour = Math.min(need, frame.crystals);
      const ratio = top ? 1 : tamer.exp / tamer.next;
      const badge = tamerLevelBadge({ level: tamer.level, size: 56 });
      const gauge = el("span", "cm-journey__pour-gauge");
      gauge.dataset.top = String(top);
      const fill = el("i", "cm-journey__pour-fill");
      fill.style.transform = `scaleX(${ratio})`;
      gauge.append(fill, el("b", "cm-journey__pour-exp", top ? syncText("level.max") : `${tamer.exp.toLocaleString()} / ${tamer.next.toLocaleString()}`));
      const text = el("span", "cm-journey__feed-text");
      text.append(el("strong", "", t("feed.tamer")), gauge);
      // The next level that opens a shop and gate rank, drawn as a padlock, the level and the rank's name.
      if (tamer.unlock?.nextLevel) {
        const lock = el("span", "cm-journey__pour-unlock");
        const icon = tamerEmblem("lock-level", { size: 18 });
        if (icon) lock.append(icon);
        lock.append(el("b", "", `Lv.${tamer.unlock.nextLevel}`), el("span", "", tamerRankName(tamer.unlock.nextRank) ?? ""));
        text.append(lock);
      }
      const purse = el("span", "cm-journey__pour-purse");
      const crystal = tamerEmblem("exp-crystal", { size: 22 });
      if (crystal) purse.append(crystal);
      purse.append(el("b", "", frame.crystals.toLocaleString()));
      const label = top ? t("feed.max") : pour <= 0 ? t("feed.none") : pour >= need ? `${t("feed.next")}・${need.toLocaleString()}` : `${t("feed.some")}・${pour.toLocaleString()}`;
      const key = button("cm-journey__key cm-arcade-key", label, () => {
        const before = { ratio, level: tamer.level, unlockRank: tamer.unlock?.rank ?? null };
        const result = host.feedTamer?.(pour);
        if (result?.ok) {
          say(t("feed.done", { before: result.gain.before.level, after: result.gain.after.level, spent: result.spent.toLocaleString() }));
          lastPour = { ...before, leveled: result.gain.after.level > result.gain.before.level };
        }
        paint();
      });
      key.disabled = top || pour <= 0;
      key.dataset.journeyAction = "feed";
      key.dataset.feedAmount = String(pour);
      const side = el("span", "cm-journey__pour-side");
      side.append(purse, key);
      row.append(badge, text, side);
      panel.append(row);
      if (lastPour) {
        // The pay-off, on the freshly painted station: crystals fly, the gauge fills from where it stood.
        const pourNow = lastPour; lastPour = null;
        fill.style.transition = "none";
        fill.style.transform = `scaleX(${pourNow.leveled ? 0 : pourNow.ratio})`;
        requestFrame(() => { fill.style.transition = ""; fill.style.transform = `scaleX(${ratio})`; });
        requestFrame(() => flyEmblems({ from: purse, to: gauge, kind: "exp-crystal", count: 8 }));
        if (pourNow.leveled) badge.dataset.pop = "true";
        requestArcadeFx(row, pourNow.leveled ? "levelup" : "sparkle");
        const opened = tamer.unlock?.rank ?? null;
        if (opened !== null && pourNow.unlockRank !== null && opened > pourNow.unlockRank) announceUnlock(opened);
      }
    }
    body.replaceChildren(panel);
  }

  // After the station is painted: a short timer, not a frame callback (the app has one ticker and this is not it).
  const requestFrame = (run) => globalThis.setTimeout(run, 34);
  /** A rank the tamer's level just opened at the shop and the gates: a toast over the page, never a blocker. */
  let unlockToast = null;
  function announceUnlock(rank) {
    const opened = RANK_UNLOCKS[rank];
    if (!opened) return;
    unlockToast?.dispose();
    const stage = el("div", "cm-fixed-stage");
    root.append(stage);
    const goods = opened.shop.cages.length + opened.shop.tools + opened.shop.plugins;
    unlockToast = playCeremony({ host: stage, kind: "capture", cue: "capture", label: t("feed.opened", { rank: tamerRankName(rank) ?? "" }),
      build: (ceremonyStage, env) => buildCapture(ceremonyStage, env, { kicker: t("feed.opened.kicker"), name: tamerRankName(rank) ?? "",
        chip: t("feed.opened.chip", { gates: opened.gates.length, goods }) }),
      onDone: () => { unlockToast = null; stage.remove(); } });
  }

  function stars(n) { return "★".repeat(n) + "☆".repeat(3 - n); }

  function paintZones() {
    const frame = host.campaign();
    if (selectedZone === null) selectedZone = [...frame.zones].reverse().find((z) => z.open)?.zone ?? 1;
    const zone = frame.zones[selectedZone - 1];
    if (selectedStage === null || !zone.stages[selectedStage - 1]?.open) selectedStage = [...zone.stages].reverse().find((st) => st.open)?.stage ?? 1;
    const panel = el("div", "cm-journey__zones");
    panel.append(el("p", "cm-journey__side-tag", uiText("DATA_ARENA_SIDE_TAG")));
    const strip = el("div", "cm-journey__zone-strip");
    strip.setAttribute("role", "tablist");
    for (const z of frame.zones) {
      const chip = button("cm-journey__zone-chip", "", () => { selectedZone = z.zone; selectedStage = null; paint(); });
      chip.dataset.zone = String(z.zone);
      chip.setAttribute("aria-selected", String(z.zone === selectedZone));
      chip.disabled = !z.open;
      chip.append(el("span", "cm-journey__zone-no", t("zone.label", { zone: z.zone })), el("strong", "", t(`zone.${z.zone}`)),
        el("span", "cm-journey__zone-stars", t("zone.stars", { stars: z.stars, total: frame.chestStars })));
      strip.append(chip);
    }
    // JOURNEY_GLANCE_20261118: what earns each star, as three short chips (the sentence is their accessible name).
    const legend = el("p", "cm-journey__stars-legend");
    legend.setAttribute("aria-label", t("zone.rule"));
    for (const [count, key] of [[1, "zone.star1"], [2, "zone.star2"], [3, "zone.star3"]]) {
      const chip = el("span", "cm-journey__star-chip");
      chip.append(el("b", "", "★".repeat(count)), el("span", "", t(key)));
      legend.append(chip);
    }
    panel.append(strip, legend);
    // Story chapters ride along the zones instead of a menu mode of their own.
    if (typeof host.openStory === "function") {
      const story = el("div", "cm-journey__story");
      const text = el("div", "cm-journey__story-text");
      text.append(el("strong", "", t("story.title")), el("span", "", t("story.hint")));
      const open = button("cm-journey__key cm-arcade-key", t("story.open"), () => host.openStory());
      open.dataset.journeyAction = "story";
      story.append(text, open);
      panel.append(story);
    }
    const path = el("div", "cm-journey__path");
    for (const st of zone.stages) {
      const node = button("cm-journey__stage", "", () => { selectedStage = st.stage; paint(); });
      node.dataset.stage = `${zone.zone}-${st.stage}`;
      node.dataset.stars = String(st.stars);
      node.setAttribute("aria-pressed", String(st.stage === selectedStage));
      node.disabled = !st.open;
      if (st.boss) node.dataset.boss = st.stage === 6 ? "zone" : "mid";
      node.append(el("span", "cm-journey__stage-no", `${zone.zone}-${st.stage}`), portrait(host.speciesPortrait(Number(st.lead.slice(8))), "cm-journey__face"),
        el("span", "cm-journey__stage-stars", stars(st.stars)));
      if (st.boss) node.append(el("b", "cm-journey__mark cm-journey__mark--guardian", t(st.stage === 6 ? "stage.boss" : "stage.mid")));
      path.append(node);
    }
    panel.append(path);
    const st = zone.stages[selectedStage - 1];
    const detail = el("div", "cm-journey__detail");
    const rewards = el("div", "cm-journey__rewards");
    rewards.append(el("span", "cm-journey__rewards-title", t("tower.rewards")), el("span", "cm-journey__reward", t("tower.crystals", { value: st.rewards.crystals.toLocaleString() })));
    if (st.rewards.tickets) rewards.append(el("span", "cm-journey__reward", t("tower.tickets", { value: st.rewards.tickets })));
    if (st.stars > 0) rewards.dataset.claimed = "true";
    detail.append(rewards, el("p", "cm-journey__team-title", zone.chest ? t("zone.chestOpen") : t("zone.chest", { diamonds: 150, tickets: 2 })));
    const actions = el("div", "cm-journey__pod-actions");
    const go = button("cm-journey__go cm-arcade-key", t("stage.challenge", { zone: zone.zone, stage: st.stage }), () => host.challengeZone(zone.zone, st.stage));
    go.dataset.journeyAction = "zone";
    go.disabled = !st.open;
    const sweep = button("cm-journey__key cm-arcade-key", `${t("stage.sweep")}・${t("stage.sweepLeft", { n: frame.sweepsLeft })}`, () => {
      const result = host.sweep(zone.zone, st.stage);
      if (result?.ok) say(t("sweep.got", { value: result.crystals.toLocaleString() }));
      paint();
    });
    sweep.dataset.journeyAction = "sweep";
    sweep.disabled = st.stars < 3 || frame.sweepsLeft <= 0;
    actions.append(go, sweep);
    detail.append(actions);
    panel.append(detail);
    body.replaceChildren(panel);
  }

  // Practice series: one partner, three rivals, the battle plan chosen (or kept) between bouts.
  let practicePick = host.prefill?.practiceInstanceId ?? null, practiceRulesOpen = false;
  function paintPractice() {
    const p = host.practice, pt = p.text, current = p.frame();
    const panel = el("div", "cm-journey__practice");
    // JOURNEY_GLANCE_20261118: the rules sit behind a ? key (tap to show, tap again to hide), not as two sentences.
    const rules = el("p", "cm-journey__practice-rule", `${pt("practice.hint")} ${pt("practice.rule")}`);
    rules.hidden = !practiceRulesOpen;
    const ask = button("cm-journey__ask cm-arcade-key", "?", () => { practiceRulesOpen = !practiceRulesOpen; paint(); });
    ask.setAttribute("aria-label", pt("practice.hint"));
    ask.setAttribute("aria-expanded", String(practiceRulesOpen));
    const askRow = el("div", "cm-journey__ask-row");
    askRow.append(el("strong", "cm-journey__team-title", pt("practice.title")), ask);
    panel.append(askRow, rules);
    const series = current?.series ?? null;
    const partnerId = series?.instanceId ?? practicePick;
    panel.append(el("p", "cm-journey__team-title", pt("practice.partner")));
    const roster = el("div", "cm-journey__team");
    const eligible = candidates.filter((c) => c.admission?.ok);
    const speciesCount = new Map();
    for (const entry of eligible) speciesCount.set(entry.speciesId, (speciesCount.get(entry.speciesId) ?? 0) + 1);
    for (const entry of eligible) {
      const look = host.describe(entry);
      const chip = button("cm-journey__member", "", () => {
        if (busy) return;
        if (series && series.instanceId !== entry.instanceId) p.end();
        practicePick = entry.instanceId; paint();
      });
      chip.dataset.instanceId = entry.instanceId;
      chip.setAttribute("aria-pressed", String(entry.instanceId === partnerId));
      const moodTag = moodBadge(look.mood);
      const tendency = p.tendencyOf?.(entry.instanceId)?.kind ?? null;
      const tendencyTag = tendency ? el("span", "cm-journey__tendency", partnerTendencyText(`tag.${tendency}`)) : null;
      const twin = (speciesCount.get(entry.speciesId) ?? 0) > 1;
      const label = twin && look.speciesLabel && look.name !== look.speciesLabel ? `${look.name} (${look.speciesLabel})` : look.name;
      chip.append(portrait(look.portrait), el("span", "cm-journey__member-name", label), ...(tendencyTag ? [tendencyTag] : []), ...(look.styleChip ? [look.styleChip] : []), ...(moodTag ? [moodTag] : []));
      roster.append(chip);
    }
    if (eligible.length === 0) { panel.append(emptyTeamCard()); body.replaceChildren(panel); return; }
    panel.append(roster);
    if (!partnerId) { body.replaceChildren(panel); return; }
    // P2: the TP this partner carries into the next bout (what a skill-heavy plan spends).
    const tp = p.tpOf?.(partnerId);
    if (tp) {
      const meter = el("div", "cm-journey__tp");
      const bar = el("span", "cm-journey__tp-bar");
      const fill = el("i");
      fill.style.transform = `scaleX(${tp.max > 0 ? Math.max(0, Math.min(1, tp.current / tp.max)) : 0})`;
      bar.append(fill);
      meter.append(el("span", "cm-journey__tp-label", pt("practice.tp", { n: tp.current, max: tp.max })), bar);
      panel.append(meter);
    }
    // The plan the next bout will fight with: the partner's own 作戰方針 (the ROM's three rows).
    const plan = p.tacticOf(partnerId);
    const prev = series?.results?.at(-1)?.tactic;
    const planRow = el("div", "cm-journey__plan");
    planRow.setAttribute("role", "radiogroup");
    planRow.setAttribute("aria-label", pt("practice.plan"));
    planRow.append(el("span", "cm-journey__team-title", pt("practice.plan")));
    for (const value of [0, 1, 2]) {
      const key = button("cm-journey__plan-key cm-arcade-key", pt(`plan.${value}`), () => { if (!busy) { p.setTactic(partnerId, value); paint(); } });
      key.setAttribute("role", "radio");
      key.setAttribute("aria-checked", String(value === plan));
      key.dataset.plan = String(value);
      planRow.append(key);
    }
    if (prev !== undefined && prev === plan) planRow.append(el("span", "cm-journey__plan-keep", pt("practice.keep")));
    panel.append(planRow);
    // The three bouts and what happened in each.
    const bouts = series?.bouts ?? null;
    const list = el("ol", "cm-journey__bouts");
    for (let n = 1; n <= 3; n++) {
      const info = bouts?.[n - 1], result = series?.results?.[n - 1];
      const row = el("li", "cm-journey__bout");
      row.dataset.bout = String(n);
      row.dataset.state = result ? (result.won ? "won" : "lost") : current?.nextBout === n ? "next" : "waiting";
      row.append(el("span", "cm-journey__bout-no", pt("practice.round", { n, foe: pt(p.foeKey(info?.kind ?? (n === 3 ? "TEAM" : n === 1 ? "NORMAL_RIVAL" : "SECOND_RIVAL"))) })));
      const foes = el("span", "cm-journey__floor-foes");
      for (const species of info?.species ?? []) foes.append(portrait(host.speciesPortrait(species), "cm-journey__foe"));
      row.append(foes);
      // The trio is the series' last bout: winning it clears the series for a bonus.
      if (n === 3 && !result) row.append(el("span", "cm-journey__bout-clear", pt("practice.clearTag", { clear: current?.clearCrystals ?? 150 })));
      if (result) {
        row.append(el("b", `cm-journey__mark${result.won ? " cm-journey__mark--done" : ""}`, pt(result.won ? "practice.won" : "practice.lost")));
        // The A side of the playtest sees outcomes only: the counts would hand it the B side's causal record.
        if (result.counts && p.variant !== "A") row.append(el("span", "cm-journey__bout-line", pt("practice.boutLine", { plan: pt(`plan.${result.tactic}`), total: result.total, skill: result.counts.skill, seconds: Math.round(result.seconds) })));
      }
      list.append(row);
    }
    panel.append(list);
    // What it remembers: one line per bout where something worth remembering actually happened.
    // Memories are kept either way; the A side sees them only after its comparison (not in this prototype).
    const memories = p.variant === "A" ? [] : (series?.results ?? []).filter((r) => r.memory);
    for (const r of memories) {
      const foe = pt(p.foeKey(r.kind)), planName = pt(`plan.${r.tactic}`);
      panel.append(el("p", "cm-journey__memory", pt("practice.memory", { line: pt(`practice.memory.${r.memory.kind}`, { ...r.memory, plan: planName, foe }) })));
    }
    panel.append(el("p", "cm-journey__hint", pt("practice.reward", { crystals: current?.crystals ?? 150, clear: current?.clearCrystals ?? 150 })));
    const actions = el("div", "cm-journey__pod-actions");
    const next = current?.nextBout ?? null;
    if (series && next === null) {
      panel.append(el("p", "cm-journey__best", pt(current?.cleared ? "practice.cleared" : "practice.done")));
      const again = button("cm-journey__go cm-arcade-key", pt("practice.again"), () => { p.start(partnerId); paint(); });
      again.dataset.journeyAction = "practice-again";
      actions.append(again);
    } else {
      const n = next ?? 1;
      const go = button("cm-journey__go cm-arcade-key", pt("practice.start", { n }), () => void startPractice(partnerId));
      go.dataset.journeyAction = "practice";
      go.disabled = busy;
      actions.append(go);
    }
    if (typeof p.downloadLog === "function") {
      const log = button("cm-journey__key cm-arcade-key", pt("practice.log"), () => p.downloadLog());
      log.dataset.journeyAction = "practice-log";
      actions.append(log);
    }
    panel.append(actions);
    body.replaceChildren(panel);
  }

  // ---- WAVE_RUN_20261118: 故事模式 and 挑戰模式 ----
  const waveArt = (name, className) => { const node = el("img", className); node.src = `${host.wave.artBase}${name}.webp`; node.alt = ""; node.draggable = false; return node; };
  function paintStoryMode() {
    const w = host.wave, panel = el("div", "cm-journey__wave cm-journey__wave--story");
    const card = el("div", "cm-journey__wave-card");
    card.append(waveArt("wave-flag", "cm-journey__wave-art"), el("strong", "cm-journey__wave-title", w.text("mode.story")),
      el("span", "cm-journey__wave-chip", w.text("waveOf", { n: 1, total: 3 })));
    const open = button("cm-journey__go cm-arcade-key", t("story.open"), () => host.openStory());
    open.dataset.journeyAction = "story-mode";
    panel.append(card, open);
    body.replaceChildren(panel);
  }
  function paintChallenge() {
    const w = host.wave, frame = w.frame(), run = frame?.run?.mode === "CHALLENGE" ? frame.run : null;
    const panel = el("div", "cm-journey__wave cm-journey__wave--challenge");
    const card = el("div", "cm-journey__wave-card");
    card.append(waveArt("threat", "cm-journey__wave-art"), el("strong", "cm-journey__wave-title", w.text("mode.challenge")));
    if (w.best?.() > 0) card.append(el("span", "cm-journey__wave-chip", w.text("best", { n: w.best() })));
    panel.append(card);
    const meta = el("div", "cm-journey__wave-meta");
    meta.append(
      el("span", "cm-journey__wave-brief", uiText("CHALLENGE_THREAT_LINE")),
      el("span", "cm-journey__wave-safe", uiText("CHALLENGE_RULE_SAFE"))
    );
    panel.append(meta);
    if (run) {
      // A run saved between waves (a reload or the field's back): its loot, and the same two keys as the rest.
      const loot = el("div", "cm-journey__wave-loot");
      loot.append(waveArt("wave-flag", "cm-journey__wave-icon"), el("b", "", w.text("cleared", { n: run.wave })),
        waveArt("loot-bag", "cm-journey__wave-icon"), el("b", "", String(frame.picked?.bits ?? 0)));
      const keys = el("div", "cm-journey__wave-keys");
      const leave = button("cm-journey__key cm-arcade-key", w.text("leave"), () => {
        const done = w.leave();
        if (done?.ok) say(`${w.text("over.LEFT")} +${done.finished?.bits ?? 0}`);
        paint();
      });
      leave.dataset.journeyAction = "wave-leave";
      leave.disabled = busy || run.status !== "REST";
      const resume = button("cm-journey__go cm-arcade-key", w.text("resume", { n: run.wave + 1 }), () => void startChallenge(null));
      resume.dataset.journeyAction = "wave-resume";
      resume.disabled = busy;
      keys.append(leave, resume);
      panel.append(loot, keys);
      body.replaceChildren(panel);
      return;
    }
    const finished = frame?.finished?.mode === "CHALLENGE" && frame.finished.runId !== dismissedWaveRunId ? frame.finished : null;
    if (finished) {
      const debrief = el("section", "cm-journey__wave-debrief");
      debrief.dataset.status = String(finished.status ?? "");
      const headRow = el("div", "cm-journey__wave-debrief-head");
      const heading = el("strong", "cm-journey__wave-debrief-title", uiText("WAVE_DEBRIEF_TITLE"));
      headRow.append(heading);
      if (finished.waves > 0 && finished.waves >= (w.best?.() ?? 0)) {
        headRow.append(el("span", "cm-journey__wave-debrief-best", uiText("WAVE_DEBRIEF_NEW_BEST")));
      }
      const dismiss = button("cm-journey__wave-debrief-close", "✕", () => {
        dismissedWaveRunId = finished.runId;
        paint();
      });
      dismiss.setAttribute("aria-label", uiText("WAVE_DEBRIEF_DISMISS"));
      headRow.append(dismiss);
      const outcomeLine = el("p", "cm-journey__wave-debrief-status", w.text(`over.${finished.status}`));
      const statsRow = el("div", "cm-journey__wave-debrief-stats");
      statsRow.append(el("span", "cm-journey__wave-debrief-pill", w.text("cleared", { n: finished.waves })));
      statsRow.append(el("span", "cm-journey__wave-debrief-pill cm-journey__wave-debrief-pill--bits", uiText("WAVE_DEBRIEF_BITS", { bits: (finished.bits ?? 0).toLocaleString() })));
      if ((finished.syncBonusPercent ?? 0) > 0) {
        statsRow.append(el("span", "cm-journey__wave-debrief-pill cm-journey__wave-debrief-pill--streak", uiText("WAVE_DEBRIEF_STREAK", { percent: finished.syncBonusPercent })));
      }
      const itemTotal = Object.values(finished.items ?? {}).reduce((sum, n) => sum + (Number(n) || 0), 0);
      if (itemTotal > 0) {
        statsRow.append(el("span", "cm-journey__wave-debrief-pill", uiText("WAVE_DEBRIEF_ITEMS", { count: itemTotal })));
      }
      debrief.append(headRow, outcomeLine, statsRow);
      const syncGains = w.lastSyncGains?.();
      if (finished.waves > 0 && syncGains?.gains?.length) {
        const totalExp = syncGains.gains.reduce((sum, g) => sum + (g.amount ?? 0), 0);
        const notes = [];
        if (totalExp > 0) notes.push(uiText("WAVE_DEBRIEF_SYNC_EXP", { exp: totalExp.toLocaleString() }));
        for (const g of syncGains.gains) {
          const entry = candidates.find((c) => c.instanceId === g.instanceId);
          const name = entry ? host.describe(entry).name : g.instanceId;
          if ((g.after?.level ?? 0) > (g.before?.level ?? 0)) {
            notes.push(uiText("WAVE_DEBRIEF_LEVEL_UP", { name, before: g.before.level, after: g.after.level }));
          } else if (g.capped) {
            notes.push(uiText("WAVE_DEBRIEF_CAPPED", { name }));
          }
        }
        const evoHits = findEvolutionGateCrossings({
          syncGains,
          participants: candidates.map((c) => ({ ...c, displayName: host.describe(c).name }))
        });
        for (const hit of evoHits) {
          notes.push(uiText("DIAG_EVO_GATE_CROSSED", { name: hit.name, level: hit.level }));
        }
        if (notes.length > 0) debrief.append(el("p", "cm-journey__wave-debrief-sync", notes.join(" · ")));
      }
      const nextActions = el("div", "cm-journey__wave-debrief-actions");
      if (typeof host.onGoRoster === "function") {
        const rosterBtn = button("cm-journey__key cm-arcade-key", uiText("LOOP_GO_ROSTER"), () => host.onGoRoster());
        rosterBtn.dataset.journeyAction = "debrief-roster";
        nextActions.append(rosterBtn);
      }
      if (typeof host.onGoHunt === "function") {
        const huntBtn = button("cm-journey__key cm-arcade-key", uiText("LOOP_GO_HUNT"), () => host.onGoHunt());
        huntBtn.dataset.journeyAction = "debrief-hunt";
        nextActions.append(huntBtn);
      }
      if (nextActions.childElementCount > 0) debrief.append(nextActions);
      panel.append(debrief);
    }
    panel.append(el("p", "cm-journey__team-title", w.text("team", { n: `${team.length}/3` })));
    const roster = el("div", "cm-journey__team");
    const eligible = candidates.filter((c) => c.admission?.ok);
    for (const entry of eligible) {
      const look = host.describe(entry), sync = host.syncOf(entry.instanceId);
      const chip = button("cm-journey__member", "", () => {
        team = team.includes(entry.instanceId) ? team.filter((id) => id !== entry.instanceId) : team.length < 3 ? [...team, entry.instanceId] : team;
        paint();
      });
      chip.dataset.instanceId = entry.instanceId;
      chip.setAttribute("aria-pressed", String(team.includes(entry.instanceId)));
      const lvLabel = sync.next > 0 ? `★${sync.star ?? 1} ${syncText("level", { level: sync.level })}` : `★${sync.star ?? 1} ${syncText("level.max")}`;
      const moodTag = moodBadge(look.mood);
      chip.append(portrait(look.portrait), el("span", "cm-journey__member-name", look.name), ...(look.styleChip ? [look.styleChip] : []),
        ...(moodTag ? [moodTag] : []),
        el("span", "cm-journey__member-lv", lvLabel));
      roster.append(chip);
    }
    const go = button("cm-journey__go cm-arcade-key", w.text("start"), () => void startChallenge([...team]));
    go.dataset.journeyAction = "wave-start";
    go.disabled = busy || team.length === 0;
    const tactics = squadTacticsStrip(team);
    if (eligible.length === 0) panel.append(emptyTeamCard(), go);
    else panel.append(roster, teamResonanceBanner(team), ...(tactics ? [tactics] : []), go);
    body.replaceChildren(panel);
  }
  async function startChallenge(ids) {
    if (busy) return;
    busy = true; paint();
    try {
      const result = await host.wave.start(ids);
      if (result?.ok === false && !disposed) say(result.message ?? result.reason ?? "");
    } finally { busy = false; if (!disposed) paint(); }
  }

  async function startPractice(partnerId) {
    if (busy) return;
    const p = host.practice;
    if (!p.frame()?.series) { const begun = p.start(partnerId); if (!begun?.ok) { say(p.text("practice.pick")); return; } }
    busy = true; paint();
    try {
      const result = await p.challenge();
      if (result?.ok === false) say(result.message ?? result.reason ?? "");
    } finally { busy = false; if (!disposed) paint(); }
  }

  function paint() {
    if (disposed) return;
    root.dataset.tab = tab;
    paintPod();
    paintTabs();
    if (tab === "TOWER") paintTower();
    else if (tab === "FEED") paintFeed();
    else if (tab === "PRACTICE" && host.practice) paintPractice();
    else if (tab === "STORY" && host.wave) paintStoryMode();
    else if (tab === "CHALLENGE" && host.wave) paintChallenge();
    else paintZones();
  }

  async function start(floor) {
    if (busy || !team.length) { if (!team.length) say(t("tower.pick")); return; }
    busy = true; paint();
    try {
      const result = await host.challenge(floor, [...team]);
      if (result?.ok === false) say(result.message ?? result.reason ?? "");
    } finally { busy = false; if (!disposed) paint(); }
  }

  function close() { host.onClose?.(); }

  (async () => {
    try { candidates = await host.candidates(); } catch { candidates = []; }
    const frame = host.frame(), usable = new Set(candidates.filter((c) => c.admission?.ok).map((c) => c.instanceId));
    team = (host.prefill?.team ?? frame.team).filter((id) => usable.has(id)).slice(0, 3);
    if (team.length === 0) team = [...usable].slice(0, 3);
    if (Number.isInteger(host.prefill?.floor)) selectedFloor = host.prefill.floor;
    paint();
    if (host.prefill?.autoStart && team.length) void start(selectedFloor ?? frame.next);
  })();
  paint();
  back.focus({ preventScroll: true });

  return Object.freeze({
    node: root,
    refresh: paint,
    dispose() { disposed = true; root.remove(); }
  });
}
