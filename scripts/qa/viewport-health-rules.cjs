// Pure rules for the full-game viewport health check
// (scripts/qa/run-full-viewport-health-check.cjs).
//
// The in-page probe (viewport-health-probe.cjs) only measures: rectangles,
// clipping ancestors, hit-test samples and line counts. Everything that turns a
// measurement into a pass or a finding lives here, so the thresholds are unit
// tested (tests/championship-viewport-health-rules-cases.mjs) without a browser.
'use strict';

/** The six representative viewports of the 2026-11-01 Owner brief. */
const VIEWPORTS = Object.freeze([
  Object.freeze({ id: 'desktop-fhd', width: 1920, height: 1080, kind: 'desktop', label: '電腦版 FHD 1920×1080' }),
  Object.freeze({ id: 'desktop-laptop', width: 1366, height: 768, kind: 'desktop', label: '筆電 1366×768' }),
  // iPhone 14/15/16 Pro as a home-screen web app: notch on top, home indicator below.
  Object.freeze({ id: 'portrait-pro', width: 390, height: 844, kind: 'portrait', label: '手機直向 390×844', safeArea: Object.freeze({ top: 47, right: 0, bottom: 34, left: 0 }) }),
  Object.freeze({ id: 'portrait-se', width: 375, height: 667, kind: 'portrait', label: '小手機直向 375×667' }),
  Object.freeze({ id: 'landscape-pro', width: 844, height: 390, kind: 'landscape', label: '手機橫向 844×390', safeArea: Object.freeze({ top: 0, right: 47, bottom: 21, left: 47 }) }),
  Object.freeze({ id: 'landscape-se', width: 667, height: 375, kind: 'landscape', label: '小手機橫向 667×375' })
]);

/** The five health gates of the brief, in its order. */
const GATES = Object.freeze({
  OVERLAP: 1,     // zero HUD / element overlap
  CLIPPING: 2,    // zero clipping or cut-off (badges, list ends, labels)
  ADAPTIVE: 3,    // landscape / desktop adaptive layout (stage area)
  WIRING: 4,      // every screen reachable, every overlay closable, no residue
  TOUCH: 5        // no horizontal overflow, touch targets >= 40 px
});

const THRESHOLDS = Object.freeze({
  minOverlapPx: 2,            // an intersection must exceed this on both axes
  minOverlapAreaPx: 9,
  sameFamilyOverlapRatio: 0.3, // tessellated siblings (hex cells) may share bounding boxes
  minVisibleFraction: 0.9,    // an interactive element cut by more than 10 % is clipped
  minBadgeFraction: 0.95,
  minTargetPx: 40,
  landscapeStageRatio: 0.55,
  overflowTolerancePx: 1,
  listGapTolerancePx: 1,
  maxTruncatedLabel: 8        // labels this short must be read whole
});

const area = r => r ? Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top) : 0;

function intersect(a, b) {
  if (!a || !b) return null;
  const left = Math.max(a.left, b.left), top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right), bottom = Math.min(a.bottom, b.bottom);
  if (right <= left || bottom <= top) return null;
  return { left, top, right, bottom };
}

/** A real collision: more than a hairline on both axes. */
function overlaps(a, b, t = THRESHOLDS) {
  const i = intersect(a, b);
  if (!i) return false;
  return (i.right - i.left) > t.minOverlapPx && (i.bottom - i.top) > t.minOverlapPx && area(i) > t.minOverlapAreaPx;
}

/**
 * Fraction of `bounds` not covered by any of `rects`, sampled on a grid. A grid
 * keeps the union of many overlapping HUD rectangles honest without a polygon
 * union, and `step` bounds its cost.
 */
function uncoveredRatio(bounds, rects, step = 6) {
  if (!bounds || area(bounds) <= 0) return 0;
  let total = 0, free = 0;
  for (let y = bounds.top + step / 2; y < bounds.bottom; y += step) {
    for (let x = bounds.left + step / 2; x < bounds.right; x += step) {
      total += 1;
      if (!rects.some(r => x >= r.left && x < r.right && y >= r.top && y < r.bottom)) free += 1;
    }
  }
  return total ? free / total : 0;
}

const finding = (gate, code, detail, extra = {}) => Object.freeze({ gate, code, detail, ...extra });

/**
 * Turn one probe result into findings.
 *
 * @param {object} raw the probe's measurements
 * @param {{viewport:object, spec?:object}} context
 */
function evaluateState(raw, { viewport, spec = {} } = {}, t = THRESHOLDS) {
  const out = [];
  if (!raw || raw.error) {
    out.push(finding(GATES.WIRING, 'PROBE_FAILED', raw?.error ?? 'no measurement'));
    return out;
  }
  const vw = raw.viewport.width;
  // Gate 5: no horizontal page overflow.
  const widest = Math.max(raw.document.scrollWidth, raw.document.bodyScrollWidth);
  if (widest > vw + t.overflowTolerancePx) {
    out.push(finding(GATES.TOUCH, 'OVERFLOW_X', `頁面寬 ${widest}px > 視口 ${vw}px`, { widest: raw.document.widest }));
  }
  const ignored = new Set(spec.ignore ?? []);
  const skip = item => item.matches?.some(m => ignored.has(m));
  // Gate 1: interactive elements never sit on top of one another.
  const items = (raw.interactive ?? []).filter(item => !skip(item));
  const underPairs = new Set(raw.scrollUnderPairs ?? []);
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i], b = items[j];
      if (a.chain.includes(b.uid) || b.chain.includes(a.uid)) continue;
      // Content scrolling under fixed chrome is judged at the list end (LIST_CUT), not here.
      if (underPairs.has(`${a.uid}|${b.uid}`) || underPairs.has(`${b.uid}|${a.uid}`)) continue;
      const ra = a.visible, rb = b.visible;
      if (!overlaps(ra, rb, t)) continue;
      if (a.family && a.family === b.family) {
        const shared = area(intersect(ra, rb)) / Math.max(1, Math.min(area(ra), area(rb)));
        if (shared < t.sameFamilyOverlapRatio) continue;
      }
      out.push(finding(GATES.OVERLAP, 'OVERLAP', `${a.label} ⟂ ${b.label}`, { a: a.selector, b: b.selector }));
    }
  }
  for (const item of items) {
    // Gate 1: something else takes the tap.
    if (item.coveredBy?.length && item.fullyInViewport && !item.byScroll && item.coverSamples >= 3) {
      out.push(finding(GATES.OVERLAP, 'COVERED', `${item.label} 被 ${item.coveredBy[0]} 蓋住`, { a: item.selector, b: item.coveredBy[0] }));
    }
    // Gate 2: cut by a non-scrolling container, or by the screen edge.
    if (item.byHidden && item.hiddenFraction < t.minVisibleFraction) {
      out.push(finding(GATES.CLIPPING, 'CLIPPED', `${item.label} 被 ${item.byHidden} 切掉 ${Math.round((1 - item.hiddenFraction) * 100)}%`, { a: item.selector, b: item.byHidden }));
    }
    if (!item.byScroll && item.viewportFraction < t.minVisibleFraction && item.viewportFraction > 0) {
      out.push(finding(GATES.CLIPPING, 'OFFSCREEN', `${item.label} 超出畫面 ${Math.round((1 - item.viewportFraction) * 100)}%`, { a: item.selector }));
    }
    // Gate 5: a control inside the home-indicator or notch inset fights the system gesture.
    if (item.insetIntrusion && !item.byScroll && !item.scroller) {
      out.push(finding(GATES.TOUCH, 'SAFE_AREA', `${item.label} 伸進${item.insetIntrusion}安全區`, { a: item.selector }));
    }
    // Gate 2: a two-to-four character label broken over two lines.
    if (item.shortLabel && item.lines > 1) {
      out.push(finding(GATES.CLIPPING, 'LABEL_WRAP', `「${item.text}」被擠成 ${item.lines} 行`, { a: item.selector }));
    }
    // Gate 2: a short label cut with an ellipsis (a long name may be, a tab or key may not).
    if (item.truncated && [...item.truncated.replace(/\s+/g, '')].length <= t.maxTruncatedLabel) {
      out.push(finding(GATES.CLIPPING, 'TEXT_TRUNCATED', `「${item.truncated}」被截斷成省略號`, { a: item.selector }));
    }
  }
  // Gate 1: no text is drawn over other text.
  for (const hit of raw.textOverlaps ?? []) {
    if ((spec.ignore ?? []).some(s => hit.selector.includes(s) || hit.other.includes(s))) continue;
    out.push(finding(GATES.OVERLAP, 'TEXT_OVERLAP', `文字互相重疊：${hit.a} ⟂ ${hit.b}`, { a: hit.selector, b: hit.other }));
  }
  // Gate 2: badges are never cut in half.
  for (const badge of raw.badges ?? []) {
    if (skip(badge)) continue;
    if (badge.fraction < t.minBadgeFraction) {
      out.push(finding(GATES.CLIPPING, 'BADGE_CUT', `${badge.label} 只露出 ${Math.round(badge.fraction * 100)}%（${badge.clipper ?? '畫面邊緣'}）`, { a: badge.selector, b: badge.clipper }));
    }
  }
  // Gate 1: named HUD groups never collide.
  const allowed = new Set((spec.allowOverlap ?? []).map(pair => [...pair].sort().join('|')));
  const groups = Object.entries(raw.groups ?? {});
  for (let i = 0; i < groups.length; i += 1) {
    for (let j = i + 1; j < groups.length; j += 1) {
      const [nameA, listA] = groups[i], [nameB, listB] = groups[j];
      if (allowed.has([nameA, nameB].sort().join('|'))) continue;
      for (const a of listA) for (const b of listB) {
        if (a.chain.includes(b.uid) || b.chain.includes(a.uid)) continue;
        if (overlaps(a.visible, b.visible, t)) {
          out.push(finding(GATES.OVERLAP, 'HUD_OVERLAP', `${nameA}（${a.label}）⟂ ${nameB}（${b.label}）`, { a: a.selector, b: b.selector }));
        }
      }
    }
  }
  // Gate 5: primary buttons are thumb-sized.
  for (const target of raw.primary ?? []) {
    if (target.height < t.minTargetPx || target.width < t.minTargetPx) {
      out.push(finding(GATES.TOUCH, 'TARGET_SMALL', `${target.label} ${Math.round(target.width)}×${Math.round(target.height)}px < ${t.minTargetPx}px`, { a: target.selector }));
    }
  }
  // Gate 4: required controls (entries, back, close) are on screen and tappable.
  for (const need of raw.mustSee ?? []) {
    if (!need.found) out.push(finding(GATES.WIRING, need.role === 'exit' ? 'NO_EXIT' : 'UNREACHABLE', `${need.selector} 不存在或不可見`, { a: need.selector }));
    else if (!need.inViewport) out.push(finding(GATES.WIRING, need.role === 'exit' ? 'NO_EXIT' : 'UNREACHABLE', `${need.label} 不在畫面內`, { a: need.selector }));
    else if (need.coveredBy) out.push(finding(GATES.WIRING, need.role === 'exit' ? 'NO_EXIT' : 'UNREACHABLE', `${need.label} 被 ${need.coveredBy} 擋住`, { a: need.selector, b: need.coveredBy }));
  }
  // Gate 2: the end of every scrolling list clears the fixed footer.
  for (const list of raw.lists ?? []) {
    if (!list.found) { out.push(finding(GATES.CLIPPING, 'LIST_MISSING', `${list.container} 找不到`, { a: list.container })); continue; }
    if (!list.last) continue;
    if (list.last.bottom > list.limit + t.listGapTolerancePx) {
      out.push(finding(GATES.CLIPPING, 'LIST_CUT', `${list.container} 最後一項底部 ${Math.round(list.last.bottom)} 超過可見底線 ${Math.round(list.limit)}（${list.limitBy}）`, { a: list.item, b: list.limitBy }));
    }
  }
  // Gate 3: a short landscape screen still leaves the stage most of the room.
  if (raw.stage && viewport?.kind === 'landscape' && raw.stage.ratio < (spec.stageMin ?? t.landscapeStageRatio)) {
    out.push(finding(GATES.ADAPTIVE, 'STAGE_SMALL', `主舞台可視 ${Math.round(raw.stage.ratio * 100)}% < ${Math.round((spec.stageMin ?? t.landscapeStageRatio) * 100)}%`));
  }
  // Gate 3: a working surface (the hex grid, a battle field) keeps its room.
  for (const need of raw.areas ?? []) {
    if (!need.found) { out.push(finding(GATES.ADAPTIVE, 'AREA_MISSING', `${need.selector} 不可見`, { a: need.selector })); continue; }
    if (need.ratio < need.minRatio || need.heightRatio < need.minHeightRatio || (need.height ?? Infinity) < (need.minHeightPx ?? 0)) {
      out.push(finding(GATES.ADAPTIVE, 'AREA_SMALL', `${need.selector} 只佔畫面 ${Math.round(need.ratio * 100)}%（高 ${Math.round(need.heightRatio * 100)}%，${Math.round(need.height ?? 0)}px）`, { a: need.selector }));
    }
    // Gate 3: an overlay that must leave the scene visible (a dialogue box over the actors).
    if (need.heightRatio > (need.maxHeightRatio ?? 1)) {
      out.push(finding(GATES.ADAPTIVE, 'AREA_TOO_TALL', `${need.selector} 佔畫面高度 ${Math.round(need.heightRatio * 100)}% > ${Math.round(need.maxHeightRatio * 100)}%`, { a: need.selector }));
    }
  }
  // Gate 3: a showcase or chart sits centred and wholly on screen.
  for (const need of raw.centered ?? []) {
    if (!need.found) { out.push(finding(GATES.ADAPTIVE, 'AREA_MISSING', `${need.selector} 不可見`, { a: need.selector })); continue; }
    if (!need.inside) out.push(finding(GATES.ADAPTIVE, 'OFF_CENTRE', `${need.selector} 超出畫面邊界`, { a: need.selector }));
    else if (need.offset > 0.05) out.push(finding(GATES.ADAPTIVE, 'OFF_CENTRE', `${need.selector} 偏離中線 ${Math.round(need.offset * 100)}%`, { a: need.selector }));
  }
  // Gate 4: nothing left behind after closing.
  if (raw.residue) {
    for (const node of raw.residue.overlays ?? []) out.push(finding(GATES.WIRING, 'RESIDUE', `關閉後殘留遮罩 ${node}`, { a: node }));
    if (raw.residue.dialogs > (spec.allowDialogs ?? 0)) out.push(finding(GATES.WIRING, 'RESIDUE', `關閉後仍有 ${raw.residue.dialogs} 個 dialog 開著`));
    if (spec.expectScreen && raw.screen !== spec.expectScreen) out.push(finding(GATES.WIRING, 'WRONG_RETURN', `關閉後畫面是 ${raw.screen}，應回到 ${spec.expectScreen}`));
    if (Number.isFinite(spec.intervalBaseline) && raw.intervals > spec.intervalBaseline) {
      out.push(finding(GATES.WIRING, 'ORPHAN_TIMER', `關閉後 setInterval 由 ${spec.intervalBaseline} 增為 ${raw.intervals}`));
    }
  }
  return dedupe(out);
}

function dedupe(list) {
  const seen = new Set();
  return list.filter(item => {
    const key = `${item.code}|${item.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Totals per gate and per slice for the report. */
function summarize(results) {
  const byGate = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const bySlice = {};
  let states = 0;
  for (const result of results) {
    states += 1;
    bySlice[result.slice] ??= { states: 0, findings: 0 };
    bySlice[result.slice].states += 1;
    for (const item of result.findings) {
      byGate[item.gate] += 1;
      bySlice[result.slice].findings += 1;
    }
  }
  const findings = Object.values(byGate).reduce((sum, n) => sum + n, 0);
  return { states, findings, byGate, bySlice, pass: findings === 0 };
}

module.exports = { VIEWPORTS, GATES, THRESHOLDS, area, intersect, overlaps, uncoveredRatio, evaluateState, summarize };
