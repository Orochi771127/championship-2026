// Journey (征途) screen -- OWNER_APPROVED_ADAPTATION 2026-11-10.
//
// One prism face holds the product's progression instead of new menu modes:
// the patrol pod, the Sync Tower and crystal feeding (the six zones and story
// nodes come next). DOM only; every number comes from the app through the
// injected host, and every action goes back through it -- this view never
// grants, saves or starts anything itself.

import { journeyText as t } from "../text/journeyText.js";
import { syncText } from "../text/syncLevelText.js";

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
  if (src) {
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
 * @param {{floor?: number, team?: string[], autoStart?: boolean, tab?: string, zone?: number}} [host.prefill]
 */
export function createJourneyScreen(host) {
  const root = el("section", "cm-journey");
  root.dataset.palette = "arcade";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", t("title"));
  let tab = host.prefill?.tab ?? "TOWER", candidates = [], selectedFloor = null, team = [], busy = false, disposed = false;
  let selectedZone = host.prefill?.zone ?? null, selectedStage = null;

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
    crystals.textContent = t("crystals", { value: frame.crystals.toLocaleString() });
    pod.replaceChildren();
    const top = el("div", "cm-journey__pod-top");
    top.append(el("strong", "cm-journey__pod-title", t("patrol.title")), el("span", "cm-journey__pod-rate", t("patrol.rate", { rate: patrol.rate.toLocaleString() })));
    const gauge = el("div", "cm-journey__gauge");
    const fill = el("i", "cm-journey__gauge-fill");
    fill.style.transform = `scaleX(${Math.min(1, patrol.hours / 12)})`;
    gauge.append(fill);
    const held = el("span", "cm-journey__pod-held", patrol.full ? t("patrol.full", { hours: 12 }) : t("patrol.held", { value: patrol.crystals.toLocaleString() }));
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
    pod.append(top, gauge, held, actions);
  }

  function paintTabs() {
    tabs.replaceChildren(...[["TOWER", t("tower")], ["FEED", t("feed")], ["ZONES", t("zones")]].map(([id, label]) => {
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
    for (const entry of candidates.filter((c) => c.admission?.ok)) {
      const look = host.describe(entry), sync = host.syncOf(entry.instanceId);
      const chip = button("cm-journey__member", "", () => {
        team = team.includes(entry.instanceId) ? team.filter((id) => id !== entry.instanceId) : team.length < 3 ? [...team, entry.instanceId] : team;
        paint();
      });
      chip.dataset.instanceId = entry.instanceId;
      chip.setAttribute("aria-pressed", String(team.includes(entry.instanceId)));
      chip.append(portrait(look.portrait), el("span", "cm-journey__member-name", look.name),
        el("span", "cm-journey__member-lv", sync.next > 0 ? syncText("level", { level: sync.level }) : syncText("level.max")));
      roster.append(chip);
    }
    const go = button("cm-journey__go cm-arcade-key", t("tower.challenge", { floor: selectedFloor }), () => void start(selectedFloor));
    go.dataset.journeyAction = "challenge";
    go.disabled = busy || team.length === 0 || !info.open;
    detail.append(roster, go);
    panel.append(detail);
    body.replaceChildren(panel);
  }

  function paintFeed() {
    const frame = host.frame();
    const panel = el("div", "cm-journey__feed");
    panel.append(el("p", "cm-journey__hint", t("feed.hint")));
    for (const entry of candidates) {
      const look = host.describe(entry), sync = host.syncOf(entry.instanceId);
      const row = el("div", "cm-journey__feed-row");
      row.dataset.instanceId = entry.instanceId;
      const bar = el("span", "cm-journey__feed-bar");
      const fill = el("i");
      fill.style.transform = `scaleX(${sync.next > 0 ? sync.exp / sync.next : 1})`;
      bar.append(fill);
      const text = el("span", "cm-journey__feed-text");
      text.append(el("strong", "", look.name), el("span", "cm-journey__member-lv", sync.next > 0 ? syncText("level", { level: sync.level }) : syncText("level.max")), bar);
      const need = sync.next > 0 ? sync.next - sync.exp : 0;
      const key = button("cm-journey__key cm-arcade-key", sync.next === 0 ? t("feed.max") : frame.crystals >= need ? `${t("feed.next")}・${need.toLocaleString()}` : t("feed.none"), () => {
        const result = host.feed(entry.instanceId, need);
        if (result?.ok) say(syncText("levelUp.range", { before: result.gain.before.level, after: result.gain.after.level }));
        paint();
      });
      key.disabled = sync.next === 0 || frame.crystals < need;
      key.dataset.journeyAction = "feed";
      row.append(portrait(look.portrait), text, key);
      panel.append(row);
    }
    body.replaceChildren(panel);
  }

  function stars(n) { return "★".repeat(n) + "☆".repeat(3 - n); }

  function paintZones() {
    const frame = host.campaign();
    if (selectedZone === null) selectedZone = [...frame.zones].reverse().find((z) => z.open)?.zone ?? 1;
    const zone = frame.zones[selectedZone - 1];
    if (selectedStage === null || !zone.stages[selectedStage - 1]?.open) selectedStage = [...zone.stages].reverse().find((st) => st.open)?.stage ?? 1;
    const panel = el("div", "cm-journey__zones");
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
    panel.append(strip, el("p", "cm-journey__hint", t("zone.rule")));
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

  function paint() {
    if (disposed) return;
    root.dataset.tab = tab;
    paintPod();
    paintTabs();
    if (tab === "TOWER") paintTower();
    else if (tab === "FEED") paintFeed();
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
