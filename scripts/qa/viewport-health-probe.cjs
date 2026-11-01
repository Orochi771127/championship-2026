// In-page geometry probe for the full-game viewport health check.
//
// Playwright serialises `healthProbe` into the page, so it must not reference
// anything outside its own body. It only measures; viewport-health-rules.cjs
// decides what a measurement means.
'use strict';

/**
 * @param {object} spec
 * @param {string[]} [spec.scope]   roots whose interactive elements are checked (default: document)
 * @param {string[]} [spec.exclude] selectors never checked (decoration that happens to be a button)
 * @param {Object<string,string>} [spec.groups] named HUD groups that must not collide
 * @param {string[]} [spec.primary] primary buttons, measured for size
 * @param {{selector:string, role?:string}[]} [spec.mustSee] controls that must be on screen and tappable
 * @param {{container:string,item:string,covers?:string[]}[]} [spec.lists] scrolled lists to inspect at their end
 * @param {{hud:string[], bounds?:string}} [spec.stage] HUD pieces subtracted from the stage
 * @param {{baseLayers?:string[]}} [spec.residue] inspect for leftovers after a close
 * @param {string[]} [spec.ignore] selectors whose findings the rules waive (each match is reported with the element)
 * @param {{selector:string, minRatio?:number, minHeightRatio?:number, minHeightPx?:number, maxHeightRatio?:number}[]} [spec.areas] work areas and their size bounds
 * @param {string[]} [spec.centered] overlays that must sit centred and wholly on screen
 */
function healthProbe(spec) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const INTERACTIVE = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="link"], [role="menuitem"], [role="radio"], [role="checkbox"], [role="slider"]';
  const BADGE = '[class*="badge"], [class*="__stock"], [class*="__count"], [class*="-count"], [class*="__dot"], [class*="-dot"]';
  let uidSeq = 0;
  const uids = new WeakMap();
  const uid = el => { if (!uids.has(el)) uids.set(el, ++uidSeq); return uids.get(el); };
  const box = r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  const area = r => r ? Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top) : 0;
  const clip = (a, b) => ({ left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) });
  const clean = r => (r.right <= r.left || r.bottom <= r.top) ? { left: r.left, top: r.top, right: r.left, bottom: r.top } : r;
  const describe = el => {
    if (!el || el.nodeType !== 1) return String(el);
    const id = el.id ? `#${el.id}` : '';
    const classes = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(c => `.${c}`).join('') : '';
    const data = ['data-quick-id', 'data-entry-id', 'data-menu-id', 'data-action', 'data-tab', 'data-filter', 'data-online-action', 'data-provider', 'data-social-id', 'data-icon']
      .map(name => el.getAttribute(name) ? `[${name}="${el.getAttribute(name)}"]` : '').join('');
    return `${el.tagName.toLowerCase()}${id}${classes}${data}`;
  };
  const textOf = el => (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
  const label = el => { const t = textOf(el); return t ? `${describe(el)}「${t.slice(0, 24)}」` : describe(el); };
  const visible = el => {
    if (!el || !el.isConnected) return false;
    const own = getComputedStyle(el);
    if (own.visibility !== 'visible') return false;
    let opacity = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = n === el ? own : getComputedStyle(n);
      if (cs.display === 'none' || cs.contentVisibility === 'hidden') return false;
      if (n.inert) return false;
      // Visually hidden for assistive technology only (clip-path inset(50%) / clip rect(0 0 0 0)).
      if (/inset\(50%/.test(cs.clipPath) || cs.clip === 'rect(0px, 0px, 0px, 0px)') return false;
      opacity *= Number(cs.opacity);
      if (opacity < 0.05) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width >= 4 && r.height >= 4;
  };
  const establishes = cs => cs.position !== 'static' || cs.transform !== 'none' || cs.filter !== 'none' || cs.perspective !== 'none'
    || /paint|layout|strict|content/.test(cs.contain) || /transform|filter/.test(cs.willChange);
  const fixedBlock = cs => cs.transform !== 'none' || cs.filter !== 'none' || cs.perspective !== 'none' || /paint|layout|strict|content/.test(cs.contain);
  // Walk the containing-block chain and intersect with every clipping ancestor.
  function clipInfo(el) {
    const own = box(el.getBoundingClientRect());
    let rect = { ...own }, byHidden = null, byScroll = null, hiddenRect = null;
    const ownPosition = getComputedStyle(el).position;
    let mode = ownPosition === 'fixed' ? 'fixed' : ownPosition === 'absolute' ? 'absolute' : 'flow';
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      const block = mode === 'flow' || (mode === 'absolute' && establishes(cs)) || (mode === 'fixed' && fixedBlock(cs));
      if (!block) continue;
      const clipsX = cs.overflowX !== 'visible', clipsY = cs.overflowY !== 'visible';
      if (clipsX || clipsY) {
        const b = p.getBoundingClientRect();
        const inner = {
          left: b.left + (parseFloat(cs.borderLeftWidth) || 0), top: b.top + (parseFloat(cs.borderTopWidth) || 0),
          right: b.right - (parseFloat(cs.borderRightWidth) || 0), bottom: b.bottom - (parseFloat(cs.borderBottomWidth) || 0)
        };
        const next = clean({
          left: clipsX ? Math.max(rect.left, inner.left) : rect.left, right: clipsX ? Math.min(rect.right, inner.right) : rect.right,
          top: clipsY ? Math.max(rect.top, inner.top) : rect.top, bottom: clipsY ? Math.min(rect.bottom, inner.bottom) : rect.bottom
        });
        if (area(next) < area(rect) - 0.5) {
          const scrolls = /auto|scroll/.test(cs.overflowX + cs.overflowY) || p.scrollWidth > p.clientWidth + 1 || p.scrollHeight > p.clientHeight + 1;
          if (scrolls) byScroll ??= describe(p);
          else { byHidden ??= describe(p); hiddenRect ??= next; }
        }
        rect = next;
      }
      mode = cs.position === 'fixed' ? 'fixed' : cs.position === 'absolute' ? 'absolute' : 'flow';
    }
    const inViewport = clean(clip(rect, { left: 0, top: 0, right: vw, bottom: vh }));
    const ownArea = Math.max(1, area(own));
    return {
      own, visible: inViewport, byHidden, byScroll,
      hiddenFraction: hiddenRect ? area(hiddenRect) / ownArea : 1,
      viewportFraction: area(clean(clip(own, { left: 0, top: 0, right: vw, bottom: vh }))) / ownArea
    };
  }
  const chainOf = el => { const out = []; for (let n = el.parentElement; n; n = n.parentElement) out.push(uid(n)); return out; };
  // The nearest ancestor that actually scrolls now: content in it may pass under fixed chrome.
  const scrollerOf = el => {
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/auto|scroll/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 1) return p;
      if (/auto|scroll/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 1) return p;
    }
    const page = document.scrollingElement;
    return page && page.scrollHeight > page.clientHeight + 1 ? page : null;
  };
  // Content scrolling under chrome is judged at the list end (LIST_CUT), not as an overlap.
  const scrollsUnder = (content, over) => {
    const scroller = scrollerOf(content);
    if (!scroller || content.contains(over) || over.contains(content)) return false;
    if (!scroller.contains(over)) return true;
    // Inside the same scroller only a sticky/fixed bar stays put while the content moves.
    let chromeOver = false, chromeContent = false;
    for (let n = over; n && n !== scroller; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'sticky' || p === 'fixed') { chromeOver = true; break; } }
    for (let n = content; n && n !== scroller; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'sticky' || p === 'fixed') { chromeContent = true; break; } }
    return chromeOver && !chromeContent;
  };
  function coveredBy(el, r) {
    const hits = [];
    let samples = 0;
    const scroller = scrollerOf(el);
    for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.3], [0.75, 0.3], [0.25, 0.7], [0.75, 0.7]]) {
      const x = r.left + (r.right - r.left) * fx, y = r.top + (r.bottom - r.top) * fy;
      if (x < 0 || y < 0 || x >= vw || y >= vh) continue;
      const top = document.elementFromPoint(x, y);
      if (!top || top === el || el.contains(top) || top.contains(el)) continue;
      const host = top.closest('label');
      if (host && (host.control === el || host.contains(el))) continue;
      // Scrolling content passing under fixed chrome (a sticky footer) is not covered: the list end is checked separately.
      if (scroller && scrollsUnder(el, top)) continue;
      samples += 1;
      hits.push(describe(top));
    }
    return { hits: [...new Set(hits)], samples };
  }
  // A label wraps when one run of text breaks over lines. Block parts stacked on purpose
  // (a key's name over its subtitle) are not a wrap, so each text node counts on its own
  // and only text in the element's own inline flow counts together.
  function lines(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const rows = tops => {
      tops.sort((a, b) => a - b);
      let count = 0, last = -1e9;
      for (const top of tops) { if (top - last > 4) { count += 1; last = top; } }
      return count;
    };
    const inFlow = host => {
      for (let n = host; n && n !== el; n = n.parentElement) if (!['inline', 'contents'].includes(getComputedStyle(n).display)) return false;
      return true;
    };
    const flow = [];
    let text = '', most = 0;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const host = n.parentElement;
      if (!host || (host !== el && host.closest(BADGE) && el.contains(host.closest(BADGE)))) continue;
      if (!visible(host)) continue;
      const t = n.textContent.replace(/\s+/g, '');
      if (!t) continue;
      text += t;
      const range = document.createRange();
      range.selectNodeContents(n);
      const tops = [...range.getClientRects()].filter(r => r.width > 0.5 && r.height > 0.5).map(r => r.top);
      most = Math.max(most, rows([...tops]));
      if (inFlow(host)) flow.push(...tops);
    }
    return { text, count: Math.max(most, rows(flow)) };
  }
  // A label that the browser cut with an ellipsis or a line clamp.
  function truncated(el) {
    for (const node of [el, ...el.querySelectorAll('*')]) {
      if (node !== el && !visible(node)) continue;
      const cs = getComputedStyle(node);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
      if (cs.textOverflow === 'ellipsis' && node.scrollWidth > node.clientWidth + 1) return (node.textContent || '').trim();
      if (clamp && node.scrollHeight > node.clientHeight + 1) return (node.textContent || '').trim();
    }
    return null;
  }
  // The emulated safe-area insets (env()), read back through a probe element.
  const inset = (() => {
    const node = document.createElement('div');
    node.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.append(node);
    const cs = getComputedStyle(node);
    const out = { top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0 };
    node.remove();
    return out;
  })();
  // A control counts as inside an inset when it reaches more than 6px into it: a key's
  // 4px drop shadow touching the home-indicator band is not a control placed there.
  const INSET_TOLERANCE = 6;
  const intrusion = r => {
    const parts = [];
    if (inset.bottom && r.bottom > vh - inset.bottom + INSET_TOLERANCE && r.top < vh) parts.push('底部 Home 橫條');
    if (inset.top && r.top < inset.top - INSET_TOLERANCE && r.bottom > 0) parts.push('頂部瀏海');
    if (inset.left && r.left < inset.left - INSET_TOLERANCE && r.right > 0) parts.push('左側瀏海');
    if (inset.right && r.right > vw - inset.right + INSET_TOLERANCE && r.left < vw) parts.push('右側瀏海');
    return parts.join('、') || null;
  };
  const roots = (spec.scope?.length ? spec.scope.flatMap(s => [...document.querySelectorAll(s)]) : [document.documentElement]).filter(r => r === document.documentElement || visible(r));
  const excluded = el => (spec.exclude ?? []).some(s => el.matches(s) || el.closest(s));
  const matchList = el => [...(spec.ignore ?? [])].filter(s => el.matches(s) || el.closest(s));
  const seen = new Set();
  const interactive = [];
  const interactiveNodes = [];
  for (const root of roots) {
    for (const el of root.querySelectorAll(INTERACTIVE)) {
      if (seen.has(el) || !visible(el) || excluded(el)) continue;
      seen.add(el);
      const info = clipInfo(el);
      if (area(info.visible) < 1) continue;
      interactiveNodes.push(el);
      const fully = info.viewportFraction > 0.999 && !info.byScroll;
      const cover = fully ? coveredBy(el, info.visible) : { hits: [], samples: 0 };
      const l = lines(el);
      const shortLabel = /^[㐀-鿿豈-﫿]{2,4}$/.test(l.text);
      interactive.push({
        uid: uid(el), chain: chainOf(el), scroller: scrollerOf(el) ? uid(scrollerOf(el)) : 0, selector: describe(el), label: label(el), text: l.text,
        family: `${el.parentElement ? uid(el.parentElement) : 0}|${typeof el.className === 'string' ? el.className : ''}`,
        visible: info.visible, own: info.own, byHidden: info.byHidden, byScroll: info.byScroll,
        hiddenFraction: info.hiddenFraction, viewportFraction: info.viewportFraction, fullyInViewport: fully,
        coveredBy: cover.hits, coverSamples: cover.samples, lines: l.count, shortLabel, truncated: truncated(el), insetIntrusion: intrusion(info.visible),
        matches: matchList(el), height: info.own.bottom - info.own.top, width: info.own.right - info.own.left
      });
    }
  }
  // Text drawn over other text: the line boxes of two unrelated text holders intersect.
  const textOverlaps = [];
  {
    const holders = [];
    const seenHolders = new Set();
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const host = n.parentElement;
        if (!host || !n.textContent.trim() || seenHolders.has(host) || excluded(host)) continue;
        if (host.closest('svg, script, style, noscript, select, option, [aria-hidden="true"]')) continue;
        // Toasts float over content for a moment by design; they are feedback, not layout.
        if (host.closest('.cm-arcade-toast, .cm-stroll-toast, .cm-hexworld__toast')) continue;
        seenHolders.add(host);
        if (!visible(host)) continue;
        const rects = [];
        for (const child of host.childNodes) {
          if (child.nodeType !== 3 || !child.textContent.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(child);
          for (const r of range.getClientRects()) if (r.width > 2 && r.height > 2) rects.push(box(r));
        }
        if (!rects.length) continue;
        const info = clipInfo(host);
        const shown = rects.map(r => clean(clip(r, info.visible))).filter(r => area(r) > 4);
        if (shown.length) holders.push({ el: host, rects: shown, scroller: scrollerOf(host) });
      }
    }
    for (let i = 0; i < holders.length && textOverlaps.length < 12; i += 1) {
      for (let j = i + 1; j < holders.length && textOverlaps.length < 12; j += 1) {
        const a = holders[i], b = holders[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        if (scrollsUnder(a.el, b.el) || scrollsUnder(b.el, a.el)) continue;
        const hit = a.rects.some(ra => b.rects.some(rb => {
          const r = clean(clip(ra, rb));
          return (r.right - r.left) > 3 && (r.bottom - r.top) > 3;
        }));
        if (hit) textOverlaps.push({ a: label(a.el), b: label(b.el), selector: describe(a.el), other: describe(b.el) });
      }
    }
  }
  // Pairs of interactive elements where one scrolls under the other (exempt from OVERLAP).
  const scrollUnderPairs = [];
  {
    const nodes = interactiveNodes;
    for (let i = 0; i < nodes.length; i += 1) for (let j = i + 1; j < nodes.length; j += 1) {
      if (scrollsUnder(nodes[i], nodes[j]) || scrollsUnder(nodes[j], nodes[i])) scrollUnderPairs.push(`${uid(nodes[i])}|${uid(nodes[j])}`);
    }
  }
  const badges = [];
  for (const root of roots) {
    for (const el of root.querySelectorAll(BADGE)) {
      if (!visible(el) || excluded(el) || el.closest('dialog:not([open])')) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 160 || r.height > 64) continue; // a panel that happens to say "badge", not a badge
      const info = clipInfo(el);
      // Inside a scroller a partly shown card is scroll affordance, not a cut badge.
      if (info.byScroll && !info.byHidden) continue;
      const fraction = Math.min(info.hiddenFraction, info.viewportFraction);
      if (area(info.visible) < 1 && fraction <= 0) continue;
      badges.push({ selector: describe(el), label: label(el), fraction, clipper: info.byHidden ?? (info.viewportFraction < 1 ? '畫面邊緣' : null), matches: matchList(el) });
    }
  }
  const groups = {};
  for (const [name, selector] of Object.entries(spec.groups ?? {})) {
    groups[name] = [...document.querySelectorAll(selector)].filter(visible).map(el => {
      const info = clipInfo(el);
      return { uid: uid(el), chain: chainOf(el), selector: describe(el), label: label(el), visible: info.visible };
    }).filter(item => area(item.visible) >= 1);
  }
  const primary = [];
  for (const selector of spec.primary ?? []) {
    for (const el of document.querySelectorAll(selector)) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      primary.push({ selector: describe(el), label: label(el), width: r.width, height: r.height });
    }
  }
  const mustSee = (spec.mustSee ?? []).map(need => {
    // Any one shown match satisfies the need: prefer the most visible one.
    const candidates = [...document.querySelectorAll(need.selector)].filter(visible)
      .map(node => { const info = clipInfo(node); return { node, info, shown: area(info.visible) / Math.max(1, area(info.own)) }; })
      .sort((a, b) => b.shown - a.shown || area(b.info.visible) - area(a.info.visible));
    const best = candidates[0];
    if (!best) return { selector: need.selector, role: need.role, found: false };
    const inViewport = best.shown > 0.98;
    const cover = inViewport ? coveredBy(best.node, best.info.visible) : { hits: [], samples: 0 };
    return { selector: need.selector, role: need.role, found: true, label: label(best.node), inViewport, shown: best.shown, coveredBy: cover.samples >= 3 ? cover.hits[0] : null };
  });
  const lists = (spec.lists ?? []).map(list => {
    const container = [...document.querySelectorAll(list.container)].find(visible);
    if (!container) return { container: list.container, item: list.item, found: false };
    const items = [...container.querySelectorAll(list.item)].filter(visible);
    const cr = container.getBoundingClientRect(), cs = getComputedStyle(container);
    let limit = Math.min(cr.bottom - (parseFloat(cs.borderBottomWidth) || 0), vh), limitBy = `${describe(container)} 底邊`;
    if (limit === vh) limitBy = '畫面底邊';
    let last = null;
    for (const item of items) { const r = item.getBoundingClientRect(); if (!last || r.bottom > last.bottom) last = box(r); }
    for (const selector of list.covers ?? []) {
      for (const cover of document.querySelectorAll(selector)) {
        if (!visible(cover) || container.contains(cover) && cover === container) continue;
        const r = cover.getBoundingClientRect();
        if (last && r.top < limit && r.bottom > last.top && r.left < last.right && r.right > last.left) { limit = r.top; limitBy = describe(cover); }
      }
    }
    return { container: list.container, item: list.item, found: true, count: items.length, last, limit, limitBy, atEnd: container.scrollHeight - container.clientHeight - container.scrollTop <= 2 };
  });
  let stage = null;
  if (spec.stage) {
    const bounds = spec.stage.bounds ? [...document.querySelectorAll(spec.stage.bounds)].find(visible) : null;
    const b = bounds ? clean(clip(box(bounds.getBoundingClientRect()), { left: 0, top: 0, right: vw, bottom: vh })) : { left: 0, top: 0, right: vw, bottom: vh };
    const rects = (spec.stage.hud ?? []).flatMap(s => [...document.querySelectorAll(s)]).filter(visible).map(el => clipInfo(el).visible).filter(r => area(r) >= 1);
    const step = Math.max(4, Math.round(Math.min(vw, vh) / 120));
    let total = 0, free = 0;
    for (let y = b.top + step / 2; y < b.bottom; y += step) for (let x = b.left + step / 2; x < b.right; x += step) {
      total += 1;
      if (!rects.some(r => x >= r.left && x < r.right && y >= r.top && y < r.bottom)) free += 1;
    }
    stage = { ratio: total ? free / total : 0, hudCount: rects.length };
  }
  const areas = (spec.areas ?? []).map(need => {
    const el = [...document.querySelectorAll(need.selector)].find(visible);
    if (!el) return { selector: need.selector, found: false };
    const info = clipInfo(el);
    const r = info.visible;
    return { selector: need.selector, found: true, ratio: area(r) / (vw * vh), heightRatio: (r.bottom - r.top) / vh,
      height: r.bottom - r.top, minRatio: need.minRatio ?? 0, minHeightRatio: need.minHeightRatio ?? 0,
      minHeightPx: need.minHeightPx ?? 0, maxHeightRatio: need.maxHeightRatio ?? 1 };
  });
  // Overlays that must sit centred and wholly on screen (a showcase, the element chart).
  const centered = (spec.centered ?? []).map(selector => {
    const el = [...document.querySelectorAll(selector)].find(visible);
    if (!el) return { selector, found: false };
    const r = el.getBoundingClientRect();
    return { selector, found: true, offset: Math.abs((r.left + r.right) / 2 - vw / 2) / vw,
      inside: r.top >= -1 && r.bottom <= vh + 1 && r.left >= -1 && r.right <= vw + 1 };
  });
  let residue = null;
  if (spec.residue) {
    const bases = spec.residue.baseLayers ?? [];
    const overlays = [];
    for (const el of document.body.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
      if (bases.some(s => el.matches(s) || el.closest(s))) continue;
      if (!visible(el) || cs.pointerEvents === 'none') continue;
      const r = el.getBoundingClientRect();
      if (area(clean(clip(box(r), { left: 0, top: 0, right: vw, bottom: vh }))) < vw * vh * 0.5) continue;
      const painted = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || cs.backdropFilter !== 'none';
      if (painted) overlays.push(describe(el));
    }
    residue = { overlays: overlays.slice(0, 6), dialogs: document.querySelectorAll('dialog[open]').length };
  }
  return {
    viewport: { width: vw, height: vh, inset },
    document: {
      scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      widest: (() => { let best = null; for (const el of document.body.querySelectorAll('*')) { const r = el.getBoundingClientRect(); if (r.right > vw + 1 && visible(el) && (!best || r.right > best.right)) best = { selector: describe(el), right: Math.round(r.right) }; } return best; })()
    },
    screen: document.getElementById('cm-root')?.dataset.activeScreen ?? null,
    interactive, scrollUnderPairs, textOverlaps, badges, groups, primary, mustSee, lists, stage, areas, centered, residue,
    intervals: Number(window.__vhIntervalCount ?? 0),
    dialogs: [...document.querySelectorAll('dialog[open]')].map(describe)
  };
}

/** Test instrumentation: count live setInterval handles so closes can be checked for orphans. */
function intervalCounterInit() {
  if (window.__vhIntervalCount !== undefined) return;
  const active = new Set();
  const set = window.setInterval, clear = window.clearInterval;
  window.setInterval = function (...args) { const id = set.apply(this, args); active.add(id); return id; };
  window.clearInterval = function (id) { active.delete(id); return clear.call(this, id); };
  Object.defineProperty(window, '__vhIntervalCount', { get: () => active.size, configurable: true });
}

module.exports = { healthProbe, intervalCounterInit };
