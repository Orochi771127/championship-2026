// Rift observation chart (Owner 2026-10-28, OWNER_APPROVED_ADAPTATION of
// presentation): the story theater opens on a full-screen chapter map instead
// of dropping a dialogue onto the ranch. A night sky in cyber violet and blue,
// a coordinate grid, contour ripples around each chapter's ground and glowing
// phase lanes between the nodes, all drawn here as vector markup; the nodes
// are real buttons. Choosing a node shows its summary, progress, the echoes
// on stage, the first-watch sigil and "start observing"; the app plays the
// chapter and the chart comes back with the sigil lit.
//
// It reads the chapter data and what was watched; it writes nothing. No
// timers or animation frames: motion is CSS (ui/storyTheater.css), dropped
// under reduced motion. The markup is parsed as HTML so no namespace URL
// literal is needed (the runtime firewall forbids remote-looking URLs).

import { STORY_RIFT_CHAPTERS, storyRiftSpeakerName } from "../data/storyRiftChapters.js";
import { STORY_RIFT_MAP_NODES, storyRiftMapText, storyRiftMapStates } from "../data/storyRiftMap.js";

export const STORY_MAP_STAR_COUNT = 46;

// Deterministic sky: the same stars every time, no random stream consumed.
function starfield(count) {
  let seed = 0x2f6b9d;
  const next = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
  return Array.from({ length: count }, (_, i) => ({ x: next() * 100, y: next() * 100, s: 1 + Math.floor(next() * 3), d: (next() * 4).toFixed(2), i }));
}

// A smooth lane through the nodes (Catmull-Rom as cubic Beziers).
function lane(points) {
  if (points.length < 2) return "";
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }, c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x.toFixed(2)} ${c1.y.toFixed(2)} ${c2.x.toFixed(2)} ${c2.y.toFixed(2)} ${p2.x} ${p2.y}`;
  }
  return d;
}
// A wobbly closed contour around a centre, like a height line on a terrain map.
function contour(cx, cy, r, wobble, phase) {
  const steps = 28;
  const pts = Array.from({ length: steps }, (_, k) => {
    const a = (k / steps) * Math.PI * 2, rr = r * (1 + wobble * Math.sin(3 * a + phase) + wobble * 0.5 * Math.sin(5 * a - phase));
    return `${(cx + Math.cos(a) * rr * 1.25).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`;
  });
  return `M${pts.join(" L")} Z`;
}

function chartMarkup(nodes, states) {
  const stateOf = id => states.find(s => s.id === id)?.state ?? "locked";
  const grid = [];
  for (let v = 10; v < 100; v += 10) grid.push(`<path d="M${v} 0V100M0 ${v}H100" />`);
  const rings = nodes.flatMap((node, n) => [0, 1, 2].map(k => `<path data-theme="${node.theme}" d="${contour(node.x, node.y, 5 + k * 3.4, 0.08 + k * 0.02, n * 1.7 + k)}" />`));
  const segments = nodes.slice(1).map((node, i) => {
    const from = nodes[i], lit = stateOf(node.id) !== "locked";
    const mid = { x: (from.x + node.x) / 2 + (i % 2 ? 6 : -6), y: (from.y + node.y) / 2 };
    const d = lane([from, mid, node]);
    return `<path class="cm-story-map__lane" data-lit="${lit}" d="${d}" pathLength="100" />` + (lit ? `<path class="cm-story-map__lane-flow" d="${d}" pathLength="100" />` : "");
  });
  return `<svg class="cm-story-map__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <g class="cm-story-map__grid">${grid.join("")}</g>
    <g class="cm-story-map__contours">${rings.join("")}</g>
    <g class="cm-story-map__lanes">${segments.join("")}</g>
  </svg>`;
}

const NAVI_MARK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l8 4.6v9.8l-8 4.6-8-4.6V7.1z" fill="none" stroke="#56e3c2" stroke-width="2"/><circle cx="12" cy="11" r="2.6" fill="#56e3c2"/><path d="M8.6 15q3.4 2.6 6.8 0" stroke="#eaf5f2" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`;

export function createStoryChapterMap({
  doc = globalThis.document, host = doc.body, locale = "zh-Hant", reducedMotion = false,
  nodes = STORY_RIFT_MAP_NODES, isSeen = () => false, partner = { name: "", portrait: null },
  onPlay = async () => null, onClose = () => {}
} = {}) {
  const t = (key, params) => storyRiftMapText(key, locale, params) ?? key;
  const root = doc.createElement("section");
  root.className = "cm-story-map"; root.hidden = true; root.dataset.storyTheater = "map";
  root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-labelledby", "cm-story-map-title");
  if (reducedMotion) root.dataset.motion = "reduced";

  const sky = doc.createElement("div"); sky.className = "cm-story-map__sky"; sky.setAttribute("aria-hidden", "true");
  for (const star of starfield(reducedMotion ? 24 : STORY_MAP_STAR_COUNT)) {
    const dot = doc.createElement("span"); dot.className = "cm-story-map__star";
    dot.style.setProperty("--x", `${star.x.toFixed(2)}%`); dot.style.setProperty("--y", `${star.y.toFixed(2)}%`);
    dot.style.setProperty("--s", `${star.s}px`); dot.style.setProperty("--d", `${star.d}s`); sky.append(dot);
  }

  const head = doc.createElement("header"); head.className = "cm-story-map__head";
  const kicker = doc.createElement("p"); kicker.className = "cm-story-map__kicker"; kicker.textContent = t("MAP_KICKER");
  const title = doc.createElement("h2"); title.className = "cm-story-map__title"; title.id = "cm-story-map-title"; title.textContent = t("MAP_TITLE");
  const subtitle = doc.createElement("p"); subtitle.className = "cm-story-map__subtitle"; subtitle.textContent = t("MAP_SUBTITLE");
  const progress = doc.createElement("p"); progress.className = "cm-story-map__progress";
  const close = doc.createElement("button"); close.type = "button"; close.className = "cm-story-map__close"; close.dataset.storyMapAction = "close";
  close.textContent = t("MAP_CLOSE"); close.dataset.sfx = "back";
  const copy = doc.createElement("div"); copy.className = "cm-story-map__head-copy"; copy.append(kicker, title, subtitle);
  head.append(copy, progress, close);

  const chart = doc.createElement("div"); chart.className = "cm-story-map__chart";
  const art = doc.createElement("div"); art.className = "cm-story-map__art";
  const nodeLayer = doc.createElement("div"); nodeLayer.className = "cm-story-map__nodes"; nodeLayer.setAttribute("role", "group"); nodeLayer.setAttribute("aria-label", t("MAP_TITLE"));
  chart.append(art, nodeLayer);

  const detail = doc.createElement("aside"); detail.className = "cm-story-map__detail"; detail.setAttribute("aria-live", "polite");
  const notice = doc.createElement("p"); notice.className = "cm-story-map__notice"; notice.hidden = true; notice.setAttribute("role", "status");

  root.append(sky, head, chart, detail, notice);
  host.append(root);

  const buttons = new Map();
  let states = [], selected = null, previousFocus = null, busy = false, disposed = false;
  const life = new AbortController();

  function numberLabel(node) {
    if (node.kind === "prologue") return t("NUM_PROLOGUE");
    if (node.kind === "interlude") return t("NUM_INTERLUDE");
    if (node.kind === "chapter") return t("NUM_CHAPTER", { n: node.number });
    return t("NUM_UNKNOWN");
  }
  const stateLabel = state => t({ current: "MAP_STATUS_CURRENT", seen: "MAP_STATUS_SEEN", open: "MAP_STATUS_OPEN", locked: "MAP_STATUS_LOCKED" }[state]);
  const stateOf = id => states.find(s => s.id === id)?.state ?? "locked";

  // Who speaks in the chapter, in order of entrance; the narrator is not an echo.
  function cast(node) {
    const chapter = node.chapterId ? STORY_RIFT_CHAPTERS[node.chapterId] : null;
    if (!chapter) return [];
    const seen = [];
    for (const beat of chapter.beats) if (beat.type === "line" && beat.speaker !== "narrator" && !seen.includes(beat.speaker)) seen.push(beat.speaker);
    return seen.map(speaker => ({ speaker, name: storyRiftSpeakerName(speaker, locale, { partner: partner.name }) ?? speaker }));
  }
  function castChip(member) {
    const chip = doc.createElement("span"); chip.className = "cm-story-map__cast"; chip.dataset.speaker = member.speaker;
    const face = doc.createElement("span"); face.className = "cm-story-map__cast-face"; face.setAttribute("aria-hidden", "true");
    if (member.speaker === "navi") face.innerHTML = NAVI_MARK;
    else if (partner.portrait?.src) { const img = doc.createElement("img"); img.src = partner.portrait.src; img.alt = ""; img.decoding = "async"; img.draggable = false; face.append(img); }
    else face.textContent = "?";
    const name = doc.createElement("span"); name.className = "cm-story-map__cast-name"; name.textContent = member.name;
    chip.append(face, name); return chip;
  }
  function row(label, ...content) {
    const wrap = doc.createElement("div"); wrap.className = "cm-story-map__row";
    const term = doc.createElement("dt"); term.textContent = label;
    const value = doc.createElement("dd"); value.append(...content);
    wrap.append(term, value); return wrap;
  }

  function paintDetail(node) {
    const state = stateOf(node.id), playable = Boolean(node.chapterId) && state !== "locked";
    detail.dataset.state = state; detail.dataset.nodeId = node.id; detail.dataset.theme = node.theme;
    const top = doc.createElement("p"); top.className = "cm-story-map__detail-top";
    const num = doc.createElement("span"); num.className = "cm-story-map__detail-num"; num.textContent = numberLabel(node);
    const pill = doc.createElement("span"); pill.className = "cm-story-map__pill"; pill.dataset.state = state; pill.textContent = stateLabel(state);
    top.append(num, pill);
    const heading = doc.createElement("h3"); heading.className = "cm-story-map__detail-title"; heading.textContent = t(node.titleKey);
    const summary = doc.createElement("p"); summary.className = "cm-story-map__summary"; summary.textContent = t(node.summaryKey);
    const facts = doc.createElement("dl"); facts.className = "cm-story-map__facts";
    const meter = doc.createElement("span"); meter.className = "cm-story-map__meter"; meter.dataset.value = state === "seen" ? "100" : "0";
    const meterFill = doc.createElement("span"); meterFill.className = "cm-story-map__meter-fill"; meter.append(meterFill);
    const meterText = doc.createElement("span"); meterText.className = "cm-story-map__meter-text";
    meterText.textContent = !node.chapterId ? t("MAP_PROGRESS_SIGNAL") : state === "seen" ? `${t("MAP_PROGRESS_DONE")} · 100%` : `${t("MAP_PROGRESS_NONE")} · 0%`;
    facts.append(row(t("MAP_LABEL_PROGRESS"), meter, meterText));
    const members = cast(node), castList = doc.createElement("span"); castList.className = "cm-story-map__cast-list";
    if (members.length) castList.append(...members.map(castChip));
    else { const unknown = doc.createElement("span"); unknown.className = "cm-story-map__cast cm-story-map__cast--unknown"; unknown.textContent = t("MAP_CAST_UNKNOWN"); castList.append(unknown); }
    facts.append(row(t("MAP_LABEL_CAST"), castList));
    const sigil = doc.createElement("span"); sigil.className = "cm-story-map__sigil"; sigil.dataset.lit = String(state === "seen");
    sigil.textContent = t(node.sigilKey);
    const sigilNote = doc.createElement("span"); sigilNote.className = "cm-story-map__sigil-note"; sigilNote.textContent = node.chapterId ? t("MAP_REWARD_NOTE") : "";
    facts.append(row(t("MAP_LABEL_REWARD"), sigil, sigilNote));
    if (!node.chapterId) { const unlock = doc.createElement("span"); unlock.textContent = t("MAP_UNLOCK_NEXT"); facts.append(row(t("MAP_LABEL_UNLOCK"), unlock)); }
    const play = doc.createElement("button"); play.type = "button"; play.className = "cm-story-map__play"; play.dataset.storyMapAction = "play";
    play.disabled = !playable || busy; play.textContent = playable ? t(state === "seen" ? "MAP_REPLAY" : "MAP_PLAY") : t("MAP_LOCKED_ACTION");
    play.addEventListener("click", () => { if (playable) void start(node); });
    detail.replaceChildren(top, heading, summary, facts, play);
  }

  function select(id, { focus = false } = {}) {
    const node = nodes.find(n => n.id === id) ?? nodes[0];
    selected = node.id;
    for (const [nodeId, button] of buttons) button.setAttribute("aria-pressed", String(nodeId === node.id));
    paintDetail(node);
    if (focus) { try { buttons.get(node.id)?.focus({ preventScroll: true }); } catch { /* not focusable yet */ } }
  }

  function paint() {
    states = storyRiftMapStates(isSeen, nodes);
    art.innerHTML = chartMarkup(nodes, states);
    buttons.clear();
    nodeLayer.replaceChildren(...nodes.map((node, index) => {
      const state = stateOf(node.id);
      const button = doc.createElement("button"); button.type = "button"; button.className = "cm-story-map__node";
      button.dataset.nodeId = node.id; button.dataset.state = state; button.dataset.kind = node.kind; button.dataset.theme = node.theme;
      button.style.setProperty("--x", `${node.x}%`); button.style.setProperty("--y", `${node.y}%`); button.style.setProperty("--i", String(index));
      button.setAttribute("aria-label", `${numberLabel(node)} ${t(node.titleKey)} · ${stateLabel(state)}`);
      const core = doc.createElement("span"); core.className = "cm-story-map__core"; core.setAttribute("aria-hidden", "true");
      const label = doc.createElement("span"); label.className = "cm-story-map__label";
      const num = doc.createElement("span"); num.className = "cm-story-map__num"; num.textContent = numberLabel(node);
      const name = doc.createElement("span"); name.className = "cm-story-map__name"; name.textContent = t(node.titleKey);
      label.append(num, name);
      if (state === "current") { const tag = doc.createElement("span"); tag.className = "cm-story-map__tag"; tag.textContent = stateLabel(state); label.append(tag); }
      button.append(core, label);
      button.addEventListener("click", () => select(node.id));
      buttons.set(node.id, button);
      return button;
    }));
    const playable = states.filter(s => s.state !== "locked");
    progress.textContent = t("MAP_PROGRESS", { seen: playable.filter(s => s.state === "seen").length, total: playable.length });
  }

  async function start(node) {
    if (busy || disposed) return;
    busy = true; hide();
    let result = null;
    try { result = await onPlay(node.chapterId, node); }
    catch { result = { outcome: "aborted" }; }
    finally { busy = false; }
    if (disposed) return;
    const watched = result?.outcome === "completed" || result?.outcome === "skipped";
    show({ focus: node.id, justSeen: watched ? node.id : null, notice: result?.outcome === "refused" ? t("MAP_REFUSED") : watched ? t("MAP_JUST_SEEN") : null });
  }

  function onKey(event) {
    if (root.hidden || busy) return;
    if (event.key === "Escape") { event.preventDefault(); closeMap(); return; }
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const index = nodes.findIndex(n => n.id === selected), step = event.key === "ArrowUp" || event.key === "ArrowRight" ? 1 : -1;
    const next = nodes[Math.max(0, Math.min(nodes.length - 1, index + step))];
    event.preventDefault(); select(next.id, { focus: true });
  }
  doc.addEventListener?.("keydown", onKey, { signal: life.signal });
  close.addEventListener("click", () => closeMap());

  function show({ focus = null, justSeen = null, notice: message = null } = {}) {
    paint();
    const target = focus ?? states.find(s => s.state === "current")?.id ?? nodes[0].id;
    root.hidden = false; root.dataset.phase = "open";
    for (const button of buttons.values()) delete button.dataset.justSeen;
    if (justSeen) { const button = buttons.get(justSeen); if (button) button.dataset.justSeen = "true"; }
    notice.hidden = !message; notice.textContent = message ?? "";
    select(target, { focus: true });
  }
  function hide() { root.hidden = true; root.dataset.phase = "closed"; }
  function closeMap() {
    if (root.hidden) return;
    hide();
    try { previousFocus?.focus?.({ preventScroll: true }); } catch { /* gone */ }
    onClose();
  }

  return Object.freeze({
    element: root,
    get isOpen() { return !root.hidden; },
    get isBusy() { return busy; },
    /** Opens the chart on `focus` (a node id, or the chapter in progress). */
    open({ focus = null, chapterId = null } = {}) {
      if (disposed || busy) return false;
      if (root.hidden) previousFocus = doc.activeElement;
      const fromChapter = chapterId ? nodes.find(n => n.chapterId === chapterId)?.id ?? null : null;
      show({ focus: focus ?? fromChapter });
      return true;
    },
    close: closeMap,
    dispose() { disposed = true; life.abort(); root.remove(); }
  });
}
