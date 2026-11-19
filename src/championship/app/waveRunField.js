// The wave run over the battle field (WAVE_RUN_20261118, Owner 2026-11-18): a wave chip (wave number, foes left), the
// drops beaten foes leave where they fell, the tap (or magnet) that picks them up, and after a won wave either one
// forward key (story) or the challenge's rest panel with its two keys: leave with the loot, or fight on.
//
// DOM and Web Animations only: no canvas, no frame callback (the magnet steps on a timer and stops with the field).
// Every pick goes through the one authority the app gives (collect); the field never pays anything itself.
import {waveRunText} from '../text/waveRunText.js';
import {uiText} from '../text/uiText.js';
import {waveSyncBonusPercent} from '../contracts/productWaveRun.js';
import {GACHA_GOODS} from '../gacha/cyberGacha.js';
import {GACHA_CURRENCY_ART} from './cyberGachaIcons.js';
import {prefersReducedMotion} from '../presentation/presentationPreferences.js';
import {requestArcadeFx} from './ui/arcadeFx.js';

export const WAVE_RUN_ART_BASE = 'assets/production/ui/wave-run-r1/';
export const WAVE_RUN_ART = Object.freeze({
  coins: `${WAVE_RUN_ART_BASE}drop-coins.webp`, heap: `${WAVE_RUN_ART_BASE}drop-coin-heap.webp`, bag: `${WAVE_RUN_ART_BASE}loot-bag.webp`,
  threat: `${WAVE_RUN_ART_BASE}threat.webp`, leave: `${WAVE_RUN_ART_BASE}key-leave.webp`, go: `${WAVE_RUN_ART_BASE}key-continue.webp`,
  flag: `${WAVE_RUN_ART_BASE}wave-flag.webp`
});
/** A press that moves farther than this (px) is a drag, never a pick. */
export const WAVE_DROP_DRAG_PX = 12;
/** Drops stay this far (px) inside the field's edges so every one is reachable with a thumb. */
export const WAVE_DROP_EDGE_PX = 30;
/** A second press on 「帶著戰利品離場」 within this time leaves when drops still lie on the ground. */
export const WAVE_LEAVE_CONFIRM_MS = 2600;
/** Story: once nothing is left to pick, the next wave comes after this pause. */
export const WAVE_STORY_AUTO_NEXT_MS = 900;

const itemArt = record => GACHA_GOODS.find(row => row.shopRecordIndex === record)?.art ?? GACHA_CURRENCY_ART.bits.src;

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function img(doc, src, className) {
  const node = el(doc, 'img', className);
  node.src = src; node.alt = ''; node.draggable = false; node.decoding = 'async';
  return node;
}

/**
 * Where the drops of one foe lie: around its stand point, each pile on its own spoke (golden angle by its index, so
 * neighbours never cover each other), the centre kept far enough inside the field that every pile stays reachable.
 */
export function placeWaveDrop(drop, anchor, box, edge = WAVE_DROP_EDGE_PX) {
  const index = Number(String(drop.id ?? '').split(':').at(-1)) || 0;
  const angle = index * 2.4 + drop.x * 0.6, radius = 30 + index * 16 + drop.y * 6;
  const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
  const top = edge + 40, bottom = Math.max(top, box.height - edge - 96), left = edge, right = Math.max(edge, box.width - edge);
  const base = anchor ?? {x: box.width * (0.2 + drop.x * 0.6), y: box.height * (0.35 + drop.y * 0.35)};
  // the spokes' centre moves inward first, so a foe that fell at the edge still gets its piles spread out
  const reach = 30 + 3 * 16 + 6; // the widest spoke (a foe drops at most four piles)
  const cx = clamp(base.x, left + reach, right - reach), cy = clamp(base.y, top + reach * 0.85, bottom - reach * 0.85);
  return {x: clamp(cx + Math.cos(angle) * radius, left, right), y: clamp(cy + Math.sin(angle) * radius * 0.85, top, bottom)};
}

/**
 * @param {object} o
 * @param {HTMLElement} o.host                 the battle screen
 * @param {() => object|null} o.frame           app.getWaveRun
 * @param {(id: string) => object} o.collect   app.collectWaveDrop (the one authority)
 * @param {(stand: {x:number,y:number}) => ({x:number,y:number}|null)} o.project  stand point -> canvas px
 * @param {() => DOMRect|null} o.canvasRect     the battle canvas on screen
 * @param {() => Array<{name:string,ratio:number,down:boolean}>} o.partners
 * @param {(choice: 'NEXT'|'LEAVE'|'FINISH'|'BACK') => void} o.choose
 * @param {number} [o.localTeam]
 */
export function mountWaveRunField({host, frame, collect, project = () => null, canvasRect = () => null, partners = () => frame?.()?.team ?? [], choose,
  localTeam = 0, doc = globalThis.document, timers = globalThis} = {}) {
  const first = frame?.();
  if (!host || !first?.run) return null;
  const reduced = prefersReducedMotion();
  const root = el(doc, 'div', 'cm-wave-run');
  root.dataset.mode = first.run.mode;
  const chip = el(doc, 'div', 'cm-wave-run__chip');
  chip.setAttribute('role', 'status');
  const chipWave = el(doc, 'b', 'cm-wave-run__wave'), chipFoes = el(doc, 'span', 'cm-wave-run__foes');
  chip.append(img(doc, WAVE_RUN_ART.flag, 'cm-wave-run__flag'), chipWave, chipFoes);
  const bag = el(doc, 'div', 'cm-wave-run__bag');
  const bagCount = el(doc, 'b', 'cm-wave-run__bag-count');
  bag.append(img(doc, WAVE_RUN_ART.bag, 'cm-wave-run__bag-art'), bagCount);
  const layer = el(doc, 'div', 'cm-wave-run__drops');
  const toast = el(doc, 'p', 'cm-wave-run__toast');
  toast.setAttribute('role', 'status');
  const dock = el(doc, 'div', 'cm-wave-run__dock');
  dock.hidden = true;
  root.append(chip, bag, layer, toast, dock);
  host.append(root);

  const anchors = new Map();   // foe slot of the wave just won -> point in the field
  const buttons = new Map();   // drop id -> button
  let settled = false, disposed = false, busy = false, magnetTimer = null, autoTimer = null, leaveArmedAt = 0, toastTimer = null;
  const later = (fn, ms) => timers.setTimeout(fn, ms);

  function say(text, kind = '') {
    toast.textContent = text; toast.dataset.kind = kind; toast.hidden = false;
    if (toastTimer) timers.clearTimeout(toastTimer);
    toastTimer = later(() => { toast.hidden = true; }, 1400);
  }
  function ground() {
    const run = frame()?.run;
    return run ? run.drops.filter(drop => drop.state === 'GROUND') : [];
  }
  function paintChip(view) {
    const run = frame()?.run;
    if (!run) return;
    const n = Math.min(run.wave + (run.status === 'FIGHTING' ? 1 : 0), run.waves ?? Infinity) || 1;
    chipWave.textContent = run.mode === 'STORY' && run.waves ? waveRunText('waveOf', {n, total: run.waves}) : waveRunText('wave', {n});
    const foes = view ? view.combatants.filter(c => c.present && c.team !== localTeam && !c.down).length : null;
    chipFoes.textContent = foes === null || settled ? '' : waveRunText('foesLeft', {n: foes});
    const picked = frame()?.picked;
    bagCount.textContent = String(run.mode === 'STORY' ? frame()?.settled?.bits ?? 0 : picked?.bits ?? 0);
  }
  /** Lay the ground drops out (the wave just won around its foes; earlier waves' unpicked drops where they were). */
  function paintDrops() {
    const box = root.getBoundingClientRect();
    const size = {width: box.width || 390, height: box.height || 700};
    const lying = ground();
    const shownMax = frame()?.rules?.dropsShownMax ?? 24;
    // More piles than can be shown merge into heaps (one tap picks the whole heap; the value never changes).
    const groups = lying.length <= shownMax ? lying.map(drop => [drop])
      : [...lying.slice(0, shownMax - 1).map(drop => [drop]), lying.slice(shownMax - 1)];
    const keep = new Set(groups.map(group => group[0].id));
    for (const [id, button] of buttons) if (!keep.has(id)) { button.remove(); buttons.delete(id); }
    for (const group of groups) {
      const drop = group[0];
      let button = buttons.get(drop.id);
      if (!button) {
        button = el(doc, 'button', 'cm-wave-drop');
        button.type = 'button';
        button.dataset.dropId = drop.id;
        button.dataset.kind = drop.kind;
        const merged = group.length > 1;
        if (merged) button.dataset.heap = JSON.stringify(group.map(d => d.id));
        button.append(img(doc, drop.kind === 'ITEM' ? itemArt(drop.record) : merged || drop.amount >= 20 ? WAVE_RUN_ART.heap : WAVE_RUN_ART.coins, 'cm-wave-drop__art'));
        const amount = merged ? group.reduce((sum, d) => sum + (d.kind === 'BITS' ? d.amount : 0), 0) : drop.amount;
        if (drop.kind === 'BITS' || merged) button.append(el(doc, 'span', 'cm-wave-drop__amount', String(amount)));
        button.setAttribute('aria-label', drop.kind === 'ITEM' ? '+1' : `+${amount}`);
        bindPick(button, () => group.map(d => d.id));
        layer.append(button);
        buttons.set(drop.id, button);
        if (!reduced) button.animate([{transform: 'translate(-50%, -120%) scale(.4)', opacity: 0}, {transform: 'translate(-50%, -50%) scale(1.15)', opacity: 1, offset: .7},
          {transform: 'translate(-50%, -50%) scale(1)', opacity: 1}], {duration: 380, delay: Math.round(drop.y * 160), easing: 'cubic-bezier(.2,.9,.3,1.3)', fill: 'backwards'});
      }
      // Placed every paint: a foe's stand is known once its wave is judged, and the same drop lands on the same spot.
      if (!button.disabled) {
        const point = placeWaveDrop(drop, anchors.get(`${drop.wave}:${drop.slot}`) ?? null, size);
        button.style.left = `${Math.round(point.x)}px`;
        button.style.top = `${Math.round(point.y)}px`;
      }
    }
    root.dataset.ground = String(lying.length);
  }
  /** A press picks only when it ends where it began (a drag over the field is never a pick) and never reaches the field. */
  function bindPick(button, ids) {
    let start = null;
    button.addEventListener('pointerdown', event => { event.stopPropagation(); start = {x: event.clientX, y: event.clientY, id: event.pointerId}; });
    button.addEventListener('pointerup', event => {
      event.stopPropagation();
      if (!start || start.id !== event.pointerId) return;
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      start = null;
      if (moved > WAVE_DROP_DRAG_PX) return;
      event.preventDefault();
      pick(ids(), button);
    });
    button.addEventListener('pointercancel', () => { start = null; });
    // Keyboard and assistive activation (a click with no pointer press before it).
    button.addEventListener('click', event => { event.stopPropagation(); if (event.detail === 0) pick(ids(), button); });
  }
  function pick(ids, button, {magnet = false} = {}) {
    let got = 0, full = false, failed = false;
    for (const id of ids) {
      const result = collect(id);
      if (result?.ok) { got += 1; if (result.full) full = true; }
      else if (result?.reason === 'SAVE_FAILED') { failed = true; break; }
    }
    if (failed) { say(waveRunText('saveFailed'), 'warn'); if (!reduced) button.animate([{marginLeft: '0'}, {marginLeft: '-6px'}, {marginLeft: '6px'}, {marginLeft: '0'}], {duration: 240}); return false; }
    if (!got) return false;
    if (full) say(waveRunText('full'), 'warn');
    requestArcadeFx(magnet ? 'snap' : 'purchase');
    flyToBag(button);
    paintChip(null);
    after();
    return true;
  }
  function flyToBag(button) {
    buttons.delete(button.dataset.dropId);
    if (reduced) { button.remove(); return; }
    const from = button.getBoundingClientRect(), to = bag.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2);
    button.disabled = true;
    const flight = button.animate([{transform: 'translate(-50%, -50%) scale(1)', opacity: 1},
      {transform: `translate(calc(-50% + ${dx * .45}px), calc(-50% + ${dy * .45 - 40}px)) scale(1.1)`, opacity: 1, offset: .45},
      {transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.35)`, opacity: .2}], {duration: 420, easing: 'cubic-bezier(.5,0,.6,1)'});
    flight.onfinish = () => { button.remove(); bag.animate([{transform: 'scale(1)'}, {transform: 'scale(1.18)'}, {transform: 'scale(1)'}], {duration: 220}); };
    later(() => button.remove(), 700);
  }
  function after() {
    const run = frame()?.run;
    root.dataset.ground = String(ground().length);
    if (!run || !settled) return;
    paintDock();
    // Story: nothing left to pick, so the next wave comes on its own (the challenge never goes on by itself).
    if (run.mode === 'STORY' && (run.status === 'REST' || run.status === 'CLEARED') && !ground().length && !autoTimer)
      autoTimer = later(() => { autoTimer = null; if (!disposed && !ground().length) decide(frame()?.run?.status === 'CLEARED' ? 'FINISH' : 'NEXT'); }, WAVE_STORY_AUTO_NEXT_MS);
  }
  function magnetStep() {
    magnetTimer = null;
    if (disposed || !settled || !frame()?.magnet) return;
    const next = ground()[0];
    if (!next) return;
    // A merged heap is picked whole by the magnet too.
    const button = buttons.get(next.id);
    if (button) pick(button.dataset.heap ? JSON.parse(button.dataset.heap) : [next.id], button, {magnet: true});
    else { collect(next.id); paintChip(null); paintDrops(); after(); }
    magnetTimer = later(magnetStep, frame()?.rules?.magnetEveryMs ?? 160);
  }
  function decide(choice) {
    if (busy || disposed) return;
    busy = true;
    dock.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try { choose?.(choice); } finally { later(() => { busy = false; }, 400); }
  }
  function keyButton(className, art, label, onPress) {
    const button = el(doc, 'button', `cm-wave-run__key ${className}`);
    button.type = 'button';
    if (art) button.append(img(doc, art, 'cm-wave-run__key-art'));
    const text = el(doc, 'span', 'cm-wave-run__key-label', label);
    button.append(text);
    button.addEventListener('pointerdown', event => event.stopPropagation());
    button.addEventListener('click', event => { event.stopPropagation(); onPress(button, text); });
    return button;
  }
  /** Leaving with drops still on the ground warns on the key itself; a second press leaves (never a modal). */
  function guardedLeave(choice, label) {
    return (button, text) => {
      const lying = ground().length;
      const now = Date.now();
      if (lying && now - leaveArmedAt > WAVE_LEAVE_CONFIRM_MS) {
        leaveArmedAt = now;
        text.textContent = `${waveRunText('unpicked', {n: lying})} · ${waveRunText('again')}`;
        button.dataset.armed = 'true';
        later(() => { if (!disposed) { text.textContent = label; delete button.dataset.armed; } }, WAVE_LEAVE_CONFIRM_MS);
        return;
      }
      decide(choice);
    };
  }
  function paintDock() {
    const f = frame(), run = f?.run;
    dock.replaceChildren();
    if (!run && f?.finished) {
      // The run ended under the field (a lost wave): what it kept, and one key back.
      const over = f.finished, panel = el(doc, 'div', 'cm-wave-rest cm-wave-rest--over');
      panel.dataset.reason = over.reason;
      const stats = el(doc, 'div', 'cm-wave-rest__stats');
      const title = el(doc, 'div', 'cm-wave-rest__stat cm-wave-rest__title');
      title.append(img(doc, WAVE_RUN_ART.threat, 'cm-wave-rest__icon'), el(doc, 'b', '', waveRunText(`over.${over.status}`)));
      const waves = el(doc, 'div', 'cm-wave-rest__stat');
      waves.append(img(doc, WAVE_RUN_ART.flag, 'cm-wave-rest__icon'), el(doc, 'b', '', waveRunText('cleared', {n: over.waves})));
      const kept = el(doc, 'div', 'cm-wave-rest__stat cm-wave-rest__loot');
      kept.append(img(doc, WAVE_RUN_ART.bag, 'cm-wave-rest__icon'), el(doc, 'b', '', String(over.earned?.bits ?? over.bits ?? 0)));
      stats.append(title, waves, kept);
      const keys = el(doc, 'div', 'cm-wave-rest__keys');
      keys.append(keyButton('cm-wave-run__key--back', null, waveRunText('back'), () => decide('BACK')));
      panel.append(stats, keys);
      dock.append(panel);
      dock.hidden = false;
      return;
    }
    if (!run) { dock.hidden = true; return; }
    if (run.mode === 'STORY') {
      if (run.status === 'REST') dock.append(keyButton('cm-wave-run__key--next', WAVE_RUN_ART.go, waveRunText('next'), () => decide('NEXT')));
      else if (run.status === 'CLEARED') dock.append(keyButton('cm-wave-run__key--next', WAVE_RUN_ART.go, waveRunText('finish'), guardedLeave('FINISH', waveRunText('finish'))));
      dock.hidden = !dock.childElementCount;
      return;
    }
    if (run.status !== 'REST') { dock.hidden = true; return; }
    // The challenge's rest: what was won, who is still standing, what comes next, and the two keys.
    const panel = el(doc, 'div', 'cm-wave-rest');
    const stats = el(doc, 'div', 'cm-wave-rest__stats');
    const cleared = el(doc, 'div', 'cm-wave-rest__stat');
    cleared.append(img(doc, WAVE_RUN_ART.flag, 'cm-wave-rest__icon'), el(doc, 'b', '', waveRunText('cleared', {n: run.wave})));
    const loot = el(doc, 'div', 'cm-wave-rest__stat cm-wave-rest__loot');
    loot.append(img(doc, WAVE_RUN_ART.bag, 'cm-wave-rest__icon'), el(doc, 'b', '', String(f.picked?.bits ?? 0)));
    for (const [record, count] of Object.entries(f.picked?.items ?? {})) {
      const item = el(doc, 'span', 'cm-wave-rest__item');
      item.append(img(doc, itemArt(Number(record)), 'cm-wave-rest__item-art'), el(doc, 'small', '', `×${count}`));
      loot.append(item);
    }
    const threat = el(doc, 'div', 'cm-wave-rest__stat cm-wave-rest__threat');
    threat.append(img(doc, WAVE_RUN_ART.threat, 'cm-wave-rest__icon'));
    const next = f.next;
    if (next) {
      const pips = el(doc, 'span', 'cm-wave-rest__pips');
      for (let i = 0; i < next.presets.length; i++) pips.append(el(doc, 'i', 'cm-wave-rest__pip'));
      threat.append(pips);
      if (next.foeBoostPercent > 0) threat.append(el(doc, 'b', 'cm-wave-rest__boost', waveRunText('stronger', {n: next.foeBoostPercent})));
    }
    const nowMult = ((100 + waveSyncBonusPercent(run.wave)) / 100).toFixed(1);
    const nextMult = ((100 + waveSyncBonusPercent(run.wave + 1)) / 100).toFixed(1);
    const streak = el(doc, 'div', 'cm-wave-rest__stat cm-wave-rest__streak');
    streak.append(el(doc, 'b', '', uiText('WAVE_STREAK_NEXT', { now: nowMult, next: nextMult })));
    stats.append(cleared, loot, threat, streak);
    const team = el(doc, 'div', 'cm-wave-rest__team');
    for (const partner of partners()) {
      const row = el(doc, 'div', 'cm-wave-rest__partner');
      row.dataset.down = String(Boolean(partner.down));
      const bar = el(doc, 'span', 'cm-wave-rest__hp');
      const fill = el(doc, 'i', 'cm-wave-rest__hp-fill');
      fill.style.width = `${Math.round(Math.max(0, Math.min(1, partner.ratio)) * 100)}%`;
      bar.append(fill);
      row.append(el(doc, 'span', 'cm-wave-rest__name', partner.name), bar);
      team.append(row);
    }
    const keys = el(doc, 'div', 'cm-wave-rest__keys');
    keys.append(keyButton('cm-wave-run__key--leave', WAVE_RUN_ART.leave, waveRunText('leave'), guardedLeave('LEAVE', waveRunText('leave'))),
      keyButton('cm-wave-run__key--go', WAVE_RUN_ART.go, waveRunText('continue'), () => decide('NEXT')));
    panel.append(stats, team, keys);
    dock.append(panel);
    dock.hidden = false;
    if (!reduced) panel.animate([{transform: 'translateY(40px)', opacity: 0}, {transform: 'none', opacity: 1}], {duration: 260, easing: 'cubic-bezier(.2,.9,.3,1)'});
  }

  paintChip(null);
  paintDrops();
  return Object.freeze({
    root,
    /** A battle frame: the chip's foe count. */
    update(view) { if (!disposed && !settled) paintChip(view); },
    /** The wave was judged: drops fall where the beaten foes stood; the rest (or the forward key) shows. */
    settled(view) {
      if (disposed || settled) return;
      settled = true;
      root.dataset.phase = 'rest';
      const canvas = canvasRect(), box = root.getBoundingClientRect();
      const run = frame()?.run;
      const wave = run ? Math.max(0, run.wave - 1) : 0;
      if (canvas && view) {
        const foes = view.combatants.filter(c => c.present && c.team !== localTeam).sort((a, b) => a.slot - b.slot);
        foes.forEach((foe, index) => {
          const point = project(foe.stand);
          if (point) anchors.set(`${wave}:${index}`, {x: canvas.left - box.left + point.x * (canvas.width / (point.viewport?.width || canvas.width)),
            y: canvas.top - box.top + point.y * (canvas.height / (point.viewport?.height || canvas.height))});
        });
      }
      paintChip(view);
      paintDrops();
      paintDock();
      if (frame()?.magnet) magnetTimer = later(magnetStep, 420);
      after();
    },
    /** The run ended under the field (a defeat): the drops left on the ground are gone with it. */
    refresh() { if (!disposed) { paintChip(null); paintDrops(); paintDock(); } },
    /** The next wave arrives on the same field: clear rest state, hide the dock, keep unpicked ground drops & bag. */
    beginWave() {
      if (disposed) return;
      settled = false;
      busy = false;
      leaveArmedAt = 0;
      delete root.dataset.phase;
      if (magnetTimer) { timers.clearTimeout(magnetTimer); magnetTimer = null; }
      if (autoTimer) { timers.clearTimeout(autoTimer); autoTimer = null; }
      dock.hidden = true;
      dock.replaceChildren();
      paintChip(null);
      paintDrops();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const timer of [magnetTimer, autoTimer, toastTimer]) if (timer) timers.clearTimeout(timer);
      root.remove();
      buttons.clear(); anchors.clear();
    }
  });
}

/** A short full-width banner between waves (「第 2 波」), over whatever screen is showing; it removes itself. */
export function showWaveBanner(text, {boss = false, doc = globalThis.document, timers = globalThis, ms = 1500} = {}) {
  const banner = el(doc, 'div', 'cm-wave-banner');
  banner.dataset.boss = String(boss);
  banner.setAttribute('role', 'status');
  banner.append(img(doc, boss ? WAVE_RUN_ART.threat : WAVE_RUN_ART.flag, 'cm-wave-banner__art'), el(doc, 'b', 'cm-wave-banner__text', text));
  if (boss) banner.append(el(doc, 'span', 'cm-wave-banner__boss', waveRunText('boss')));
  doc.body.append(banner);
  if (!prefersReducedMotion()) banner.animate([{transform: 'translateX(-100%)', opacity: 0}, {transform: 'none', opacity: 1, offset: .2},
    {transform: 'none', opacity: 1, offset: .8}, {transform: 'translateX(100%)', opacity: 0}], {duration: ms, easing: 'cubic-bezier(.3,.8,.4,1)'});
  timers.setTimeout(() => banner.remove(), ms);
  return banner;
}
