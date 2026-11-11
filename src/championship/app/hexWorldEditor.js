// Hex cage world editor board (Owner direction 2026-10-26; one-screen builder 2026-10-27).
//
// Edit mode only: every world position in a pan/zoom viewport, the placed cages
// drawn over their full footprints, a selection, and a live footprint preview
// before anything is placed or moved. Dragging empty space pans and never edits;
// a tap edits. All rules (overlap, 100-cell cap, land, residents, waiting room,
// passages) stay in the runtime and the raising ground; this view only previews
// and forwards intents, so a refused edit leaves the layout as it was.
//
// Layers (2026-10-27). Land is a count, not fixed positions (productRanchGrid):
// while land remains, empty cells touching the land glow as sockets and every
// other empty cell is open but quiet; once the land is used up, empty cells
// wear the Lid. Passages, closed borders and safe exits come from the same
// ground the ranch walks on (hexWorldPassages.js).
import { PRODUCT_RANCH_COLUMNS, PRODUCT_RANCH_ROWS, PRODUCT_RANCH_SLOT_COUNT, productFitPlacement, productGridCell, productGridSlot, productPlacementCells } from '../cage/productRanchGrid.js';
import { cageEditorArtCells, cageUiLidImage, cageUiName, cageUiSummary } from '../presentation/cageUiArt.js';
import { ranchEcologyType } from '../cage/ranchEcology.js';
import { hexWorldPassageGain, hexWorldPassageView } from './hexWorldPassages.js';
import { uiText } from '../text/uiText.js';
import { gachaCurrencyImage, gachaIcon } from './cyberGachaIcons.js';
import { gachaRefusalText } from './cyberGachaView.js';
import { coreRunSeconds, formatRunClock } from '../gacha/ranchAutomation.js';
import { landExpansionPrice } from '../gacha/diamondRewards.js';

const HEX_W = 48, HEX_H = 56;            // editor px of one hex (native 96 × 112 at ÷2)
const MIN_ZOOM = 0.35, MAX_ZOOM = 2.2;
const WORLD_W = 4 + (PRODUCT_RANCH_COLUMNS * 96 + 48) / 2, WORLD_H = ((PRODUCT_RANCH_ROWS - 1) * 88 + 112) / 2;
// The SVG namespace, read from the document's own parser (no URL literal in runtime code).
let svgNs = null;
function svgNamespace(doc) {
  if (svgNs === null && typeof doc.createElementNS === 'function') {
    const probe = doc.createElement('div');
    probe.innerHTML = '<svg></svg>';
    svgNs = probe.firstChild?.namespaceURI ?? false;
  }
  return svgNs || null;
}
const ECOLOGY_LABEL = Object.freeze({ forest:'森林', grassland:'草原', garden:'花園', volcano:'火山', mountain:'高山', beach:'海灘',
  desert:'沙漠', snowfield:'冰原', sports:'運動場', gym:'健身房', infirmary:'保健室' });
const VERDICT_COPY = Object.freeze({ ok: '可放置', blocked: '空間不足', full: '超出可用土地', outside: '超出牧場範圍' });

export function hexWorldEcologyLabel(moduleId) {
  const type = ranchEcologyType(moduleId);
  return type ? ECOLOGY_LABEL[type] ?? '' : '';
}

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** Editor px of a lattice slot's hex top-left (the board's existing cell arithmetic). */
export function hexWorldEditorPoint(slotIndex) {
  const cell = productGridCell(slotIndex);
  return { x: 4 + cell.x / 2, y: cell.y / 2 };
}
/** Editor px of a native point (polygon vertices are native px). */
const editorPoint = (p) => [4 + p[0] / 2, (p[1] + 24) / 2];

/** The six lattice neighbours of a slot (odd rows sit half a column right). */
export function hexWorldNeighbours(slotIndex) {
  const { row, column } = productGridCell(slotIndex), odd = row % 2;
  return [[row, column - 1], [row, column + 1], [row - 1, column - 1 + odd], [row - 1, column + odd], [row + 1, column - 1 + odd], [row + 1, column + odd]]
    .map(([r, c]) => productGridSlot(r, c)).filter((slot) => slot !== null);
}

/** Which look each empty cell gets: 'socket' next to the land, 'open', or 'lid' when no land is left. */
export function hexWorldCellLayers(slots, remainingLand) {
  const filled = new Set(slots.filter((s) => s.moduleId).map((s) => s.slotIndex));
  const frontier = new Set([...filled].flatMap(hexWorldNeighbours).filter((slot) => !filled.has(slot)));
  return new Map(slots.map((s) => [s.slotIndex, filled.has(s.slotIndex) ? 'placed'
    : remainingLand <= 0 ? 'lid' : frontier.has(s.slotIndex) ? 'socket' : 'open']));
}

/** A small hex outline of a cage's fixed footprint, for cards and badges. */
export function hexFootprintIcon(doc, moduleId, size = 30) {
  const cells = productPlacementCells({ moduleId, slotIndex: productGridSlot(10, 10) }) ?? [];
  const holder = el(doc, 'span', 'cm-hexfoot');
  holder.dataset.cells = String(cells.length);
  holder.setAttribute('aria-hidden', 'true');
  const SVG = svgNamespace(doc);
  if (!cells.length || !SVG) return holder;
  const pts = cells.map(hexWorldEditorPoint);
  const minX = Math.min(...pts.map((p) => p.x)), minY = Math.min(...pts.map((p) => p.y));
  const w = Math.max(...pts.map((p) => p.x)) - minX + HEX_W, h = Math.max(...pts.map((p) => p.y)) - minY + HEX_H;
  const svg = doc.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `-2 -2 ${w + 4} ${h + 4}`);
  svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size));
  for (const p of pts) {
    const x = p.x - minX, y = p.y - minY, poly = doc.createElementNS(SVG, 'polygon');
    poly.setAttribute('points', [[24, 0], [48, 12], [48, 44], [24, 56], [0, 44], [0, 12]].map(([a, b]) => `${x + a},${y + b}`).join(' '));
    svg.append(poly);
  }
  holder.append(svg);
  return holder;
}

export function createHexWorldBoard({ source, openLandPurchase, doc = globalThis.document }) {
  const root = el(doc, 'section', 'cm-hexworld');
  root.setAttribute('aria-label', uiText('牧場世界配置'));
  const toolbar = el(doc, 'div', 'cm-hexworld__toolbar');
  const counter = el(doc, 'p', 'cm-hexworld__counter');
  counter.setAttribute('aria-live', 'polite');
  toolbar.append(counter);
  const viewport = el(doc, 'div', 'cm-hexworld__viewport');
  const board = el(doc, 'div', 'cm-vs2-cage-board cm-hexworld__board');
  board.dataset.productGrid = 'true';
  board.setAttribute('role', 'grid');
  board.setAttribute('aria-label', uiText('Ranch hex slots'));
  const ghost = el(doc, 'div', 'cm-hexworld__ghost');
  ghost.setAttribute('aria-hidden', 'true');
  viewport.append(board);
  // Corner keys float over the canvas (Owner 2026-10-27): no row of their own.
  const keys = el(doc, 'div', 'cm-hexworld__keys');
  const zoomOut = el(doc, 'button', 'cm-vs2-action cm-hexworld__zoom', '−');
  const zoomIn = el(doc, 'button', 'cm-vs2-action cm-hexworld__zoom', '＋');
  const fit = el(doc, 'button', 'cm-vs2-action cm-hexworld__zoom', '全覽');
  const revert = el(doc, 'button', 'cm-vs2-action cm-hexworld__revert', '還原');
  for (const [b, label] of [[zoomOut, '縮小'], [zoomIn, '放大'], [fit, '顯示全部設施'], [revert, '還原這次的變更']]) { b.type = 'button'; b.setAttribute('aria-label', uiText(label)); }
  revert.dataset.hexAction = 'revert';
  keys.append(zoomOut, zoomIn, fit, revert);
  const toast = el(doc, 'p', 'cm-hexworld__toast');
  toast.setAttribute('role', 'status');
  toast.hidden = true;
  viewport.append(keys, toast);
  const selection = el(doc, 'div', 'cm-hexworld__selection');
  selection.hidden = true;
  const land = el(doc, 'div', 'cm-hexworld__land');
  root.append(toolbar, viewport, selection, land);

  let cage = null, view = { x: 0, y: 0, zoom: 0.8 }, fitted = false;
  let selected = null, moving = false, hoverSlot = null, mountOpen = false;
  let passages = null, passageKey = null, layers = new Map(), animatedVerdict = null, toastTimer = null;
  // DIAMOND_ECONOMY_20261102: the land last painted, so a purchase plays the gold hex wave once.
  let paintedLand = null, waveTimer = null, wave = null;
  // Inline SVG glyphs where the document can draw them (a test document without SVG gets a plain span).
  const icon = (name, className) => (canDraw ? gachaIcon(name, className, doc) : el(doc, 'span', className));
  const cellNodes = new Map();
  const SVG = svgNamespace(doc), canDraw = Boolean(SVG);

  // ---------------------------------------------------------------- pan / zoom
  const apply = () => {
    board.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
    board.dataset.zoom = view.zoom < 0.6 ? 'far' : 'near';
  };
  const clampZoom = z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
  function zoomAt(factor, cx, cy) {
    const next = clampZoom(view.zoom * factor), k = next / view.zoom;
    view = { x: cx - (cx - view.x) * k, y: cy - (cy - view.y) * k, zoom: next };
    apply();
  }
  function fitTo(slots) {
    const rect = viewport.getBoundingClientRect();
    if (!slots.length || !(rect.width > 0)) return false;
    const pts = slots.map(hexWorldEditorPoint);
    const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x)) + HEX_W;
    const minY = Math.min(...pts.map(p => p.y)) - 12, maxY = Math.max(...pts.map(p => p.y)) + HEX_H;
    const zoom = clampZoom(Math.min((rect.width - 32) / (maxX - minX + HEX_W * 2), (rect.height - 32) / (maxY - minY + HEX_H * 2)));
    view = { zoom, x: rect.width / 2 - (minX + maxX) / 2 * zoom, y: rect.height / 2 - (minY + maxY) / 2 * zoom };
    apply();
    return true;
  }
  const occupiedSlots = () => (cage?.slots ?? []).filter(s => s.moduleId).map(s => s.slotIndex);
  // Until the player pans or zooms, a canvas that changes size refits the land.
  let userMoved = false;
  const View = doc.defaultView;
  const sizeWatch = typeof View?.ResizeObserver === 'function'
    ? new View.ResizeObserver(() => { if (!userMoved && cage) fitted = fitTo(occupiedSlots()); }) : null;
  sizeWatch?.observe(viewport);
  // Pointer positions arrive in screen pixels; the board is laid out in the page's own pixels.
  // The two differ by the desktop interface zoom (portraitFrame.js), so every screen distance
  // is divided by the viewport's on-screen scale before it moves or zooms the board.
  const screenScale = (r = viewport.getBoundingClientRect()) => r.width / (viewport.offsetWidth || r.width || 1) || 1;
  zoomIn.addEventListener('click', () => { userMoved = true; zoomAt(1.25, viewport.clientWidth / 2, viewport.clientHeight / 2); });
  zoomOut.addEventListener('click', () => { userMoved = true; zoomAt(0.8, viewport.clientWidth / 2, viewport.clientHeight / 2); });
  fit.addEventListener('click', () => fitTo(occupiedSlots()));
  revert.addEventListener('click', () => { if (!revert.disabled) { select(null); source.intents.revertCageEdit?.(); } });
  viewport.addEventListener('wheel', e => {
    e.preventDefault();
    userMoved = true;
    const r = viewport.getBoundingClientRect(), k = screenScale(r);
    zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, (e.clientX - r.left) / k, (e.clientY - r.top) / k);
  }, { passive: false });

  // Drag pans; a press that does not move is a tap. Two fingers pinch-zoom.
  const pointers = new Map();
  let drag = null, suppressClick = false, pinch = null;
  const onKey = (target) => target?.closest?.('.cm-hexworld__keys');
  viewport.addEventListener('pointerdown', e => {
    if (onKey(e.target)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom };
      drag = null;
      return;
    }
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
  });
  viewport.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()], r = viewport.getBoundingClientRect(), k = screenScale(r);
      const factor = (pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance) / view.zoom;
      zoomAt(factor, ((a.x + b.x) / 2 - r.left) / k, ((a.y + b.y) / 2 - r.top) / k);
      suppressClick = true; userMoved = true;
      return;
    }
    if (drag && drag.id === e.pointerId) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 8) return;
      if (!drag.moved) { drag.moved = true; userMoved = true; viewport.setPointerCapture?.(e.pointerId); viewport.dataset.panning = 'true'; }
      const k = screenScale();
      view = { ...view, x: drag.vx + dx / k, y: drag.vy + dy / k };
      apply();
    }
  });
  const end = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag?.id === e.pointerId) {
      if (drag.moved) suppressClick = true;
      drag = null;
      delete viewport.dataset.panning;
    }
  };
  viewport.addEventListener('pointerup', end);
  viewport.addEventListener('pointercancel', end);
  viewport.addEventListener('click', e => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; } }, true);

  // ---------------------------------------------------------------- feedback
  function say(text, kind = 'info') {
    toast.textContent = text;
    toast.dataset.kind = kind;
    toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; toastTimer = null; }, 2200);
  }
  function fx(target, kind) {
    const Event = target?.ownerDocument?.defaultView?.CustomEvent ?? globalThis.CustomEvent;
    if (!target?.dispatchEvent || typeof Event !== 'function') return;
    try { target.dispatchEvent(new Event('cm-fx', { bubbles: true, detail: { kind } })); } catch { /* optional */ }
  }

  // ---------------------------------------------------------------- preview
  const draftPlacements = () => (cage?.placements ?? []).map(p => ({ moduleId: p.moduleId, slotIndex: p.slotIndex, instanceId: p.instanceId }));
  // A picked royal card (DIAMOND_ECONOMY_20261102) places its base cage like any tray card.
  const pickedCard = () => cage?.tray?.find(t => t.selected) ?? cage?.royalTray?.find(r => r.selected) ?? null;
  const pickedModule = () => (moving && selected) ? selected.moduleId : pickedCard()?.moduleId ?? null;
  // The tapped hex is always one of the cage's own cells (productFitPlacement):
  // the cage is never pushed a hex away from where the player tapped.
  function fitAt(slotIndex) {
    const moduleId = pickedModule();
    return moduleId ? productFitPlacement(draftPlacements(), moduleId, slotIndex, { ignoreInstanceId: moving && selected ? selected.instanceId : null }) : null;
  }
  function previewAt(slotIndex) {
    hoverSlot = slotIndex;
    for (const node of board.querySelectorAll('[data-preview]')) delete node.dataset.preview;
    paintGhostOverlay(null);
    if (slotIndex === null) return;
    const moduleId = pickedModule();
    if (!moduleId) return;
    const fit = fitAt(slotIndex), cells = fit?.cells ?? null;
    const used = (cage.productGrid?.usedCells ?? 0) + (moving ? 0 : cells?.length ?? 0);
    const tooMany = !moving && used > Math.min(cage.productGrid?.cellCap ?? 100, cage.landCapacity ?? 100);
    const verdict = !fit ? 'outside' : !fit.ok ? 'blocked' : tooMany ? 'full' : 'ok';
    const conflicts = new Set(fit?.conflicts ?? []);
    for (const slot of cells ?? [slotIndex]) {
      const node = cellNodes.get(slot);
      if (node) node.dataset.preview = conflicts.has(slot) ? 'conflict' : verdict === 'outside' ? 'blocked' : verdict;
    }
    let gain = [];
    if (verdict === 'ok') {
      const rest = draftPlacements().filter(p => !(moving && selected && p.instanceId === selected.instanceId));
      gain = hexWorldPassageGain(rest, { moduleId, slotIndex: fit.slotIndex, instanceId: moving && selected ? selected.instanceId : 'cage:instance:preview' }) ?? [];
    }
    paintGhostOverlay({ slotIndex, verdict, gain, cells: cells ?? [], conflicts });
  }
  // A tap whose fit overlaps another cage stays in place: the ghost shows the
  // hexes it would hit, and nothing is sent.
  function refuseFit(slotIndex, fit) {
    const hit = fit ? cage.slots[fit.conflicts[0]] : null;
    fx(cellNodes.get(slotIndex), 'denied');
    say(hit?.moduleId ? uiText('會壓到「{cage}」：換一格試試', { cage: cageUiName(hit.moduleId, hit.displayName) }) : uiText(VERDICT_COPY.outside), 'blocked');
    previewAt(slotIndex);
  }

  // ---------------------------------------------------------------- selection actions
  function select(slot) {
    selected = slot ? { instanceId: slot.instanceId, moduleId: slot.moduleId, slotIndex: slot.slotIndex, fixed: slot.fixed } : null;
    moving = false;
    mountOpen = false;
    paintSelection();
    paintCells();
  }
  function paintSelection() {
    selection.replaceChildren();
    selection.hidden = !selected;
    if (!selected) return;
    const name = cageUiName(selected.moduleId);
    const ecology = hexWorldEcologyLabel(selected.moduleId);
    const title = el(doc, 'p', 'cm-hexworld__selected', moving
      ? uiText('移動「{cage}」：點選新的位置', { cage: name })
      : `${name}${ecology ? ` · ${uiText('生態')}：${uiText(ecology)}` : ''}`);
    selection.append(title);
    if (selected.fixed) { selection.append(el(doc, 'p', 'cm-hexworld__note', uiText('等候室固定在牧場入口。'))); }
    const actions = el(doc, 'div', 'cm-hexworld__actions');
    if (!selected.fixed && !moving) {
      const move = el(doc, 'button', 'cm-vs2-action', '移動');
      move.type = 'button';
      move.dataset.hexAction = 'move';
      move.addEventListener('click', () => { moving = true; paintSelection(); paintCells(); });
      const remove = el(doc, 'button', 'cm-vs2-action cm-hexworld__remove', '收回');
      remove.type = 'button';
      remove.dataset.hexAction = 'remove';
      remove.addEventListener('click', () => { const id = selected.instanceId ?? selected.moduleId; selected = null; source.intents.removeCagePlacement(id); });
      actions.append(move, remove);
    }
    // Owner 2026-11-03: a placed cage takes the bag's feed / clean cores right here.
    const placed = selected.instanceId && cage.placements?.some?.((p) => p.instanceId === selected.instanceId);
    if (!moving && placed && cage.cores?.length) {
      const mount = el(doc, 'button', 'cm-vs2-action cm-hexworld__mount');
      mount.type = 'button';
      mount.append(icon('robot', 'cm-hexworld__mount-icon'), el(doc, 'span', '', uiText('籠舍外掛模組槽')));
      mount.dataset.hexAction = 'mount';
      mount.setAttribute('aria-expanded', String(mountOpen));
      mount.addEventListener('click', () => { mountOpen = !mountOpen; paintSelection(); });
      actions.append(mount);
    }
    const cancel = el(doc, 'button', 'cm-vs2-action', moving ? '取消移動' : '取消選取');
    cancel.type = 'button';
    cancel.dataset.hexAction = 'cancel';
    cancel.addEventListener('click', () => { if (moving) { moving = false; paintSelection(); paintCells(); } else select(null); });
    actions.append(cancel);
    selection.append(actions);
    if (mountOpen && !moving && selected.instanceId) selection.append(mountPicker(selected.instanceId));
  }
  function mountPicker(instanceId) {
    const auto = cage.automation?.[instanceId] ?? null;
    const list = el(doc, 'div', 'cm-hexworld__mounts');
    if (auto?.royal) { list.append(el(doc, 'p', 'cm-hexworld__note', uiText('皇家籠舍已內建全自動功能，不需要再部署。'))); return list; }
    list.append(el(doc, 'p', 'cm-hexworld__note', uiText('每次部署持續 1 小時；運轉中再投入一個可延長 +1 小時（最多 24 小時）。')));
    for (const core of cage.cores ?? []) {
      const left = coreRunSeconds(auto, core);
      const pick = el(doc, 'button', 'cm-vs2-action cm-hexworld__mount-core');
      pick.type = 'button';
      pick.dataset.coreId = core.id;
      pick.dataset.mounted = String(left > 0);
      pick.append(icon('robot', 'cm-hexworld__mount-icon'), el(doc, 'span', '', uiText(core.name)),
        el(doc, 'span', 'cm-hexworld__mount-state', left > 0 ? uiText('運轉中 {time} · 背包 ×{n} · 延長 +1 小時', { time: formatRunClock(left), n: core.owned })
          : uiText('背包 ×{n} · 部署 1 小時', { n: core.owned })));
      pick.disabled = core.owned < 1;
      pick.addEventListener('click', () => {
        source.intents.gachaDeployCore?.(core.id, instanceId);
        const result = source.getFrame()?.cageEdit?.gachaResult;
        if (result && !result.ok) say(gachaRefusalText(result.reason), 'blocked');
        else { say(uiText(left > 0 ? '已延長 +1 小時' : '已部署：機器運轉 1 小時'), 'ok'); fx(cellNodes.get(selected?.slotIndex), 'sparkle'); }
      });
      list.append(pick);
    }
    if (!(cage.cores ?? []).some((core) => core.owned > 0) && !auto?.feed && !auto?.clean)
      list.append(el(doc, 'p', 'cm-hexworld__note', uiText('背包裡還沒有自動餵食機／掃地機器人，到商店的轉蛋機轉轉看！')));
    return list;
  }

  function onCell(slot) {
    if (moving && selected) {
      const fit = fitAt(slot.slotIndex);
      if (!fit?.ok) { refuseFit(slot.slotIndex, fit); return; }
      const id = selected.instanceId;
      moving = false;
      selected = { ...selected, slotIndex: fit.slotIndex };
      hoverSlot = null;
      source.intents.moveCagePlacement(id, fit.slotIndex);
      return;
    }
    if (slot.moduleId) { select(slot); return; }
    if (pickedCard()) {
      // No land left: the Lid stays on. Moving a placed cage still works.
      if (layers.get(slot.slotIndex) === 'lid') {
        fx(cellNodes.get(slot.slotIndex), 'denied');
        say(uiText('🔒 可用土地已用完：開放土地或提升階級，就能放更多設施'), 'locked');
        return;
      }
      const fit = fitAt(slot.slotIndex);
      if (!fit?.ok) { refuseFit(slot.slotIndex, fit); return; }
      hoverSlot = null;
      source.intents.placeCageAt(fit.slotIndex);
      return;
    }
    select(null);
  }

  // ---------------------------------------------------------------- overlay
  const overlay = canDraw ? doc.createElementNS(SVG, 'svg') : null;
  if (overlay) {
    overlay.setAttribute('class', 'cm-hexworld__overlay');
    overlay.setAttribute('viewBox', `0 0 ${WORLD_W} ${WORLD_H}`);
    overlay.setAttribute('width', String(WORLD_W));
    overlay.setAttribute('height', String(WORLD_H));
    overlay.setAttribute('aria-hidden', 'true');
  }
  const ghostLayer = canDraw ? doc.createElementNS(SVG, 'g') : null;
  ghostLayer?.setAttribute('class', 'cm-hexworld__ghost-layer');
  function line(group, a, b, cls) {
    const [x1, y1] = editorPoint(a), [x2, y2] = editorPoint(b), node = doc.createElementNS(SVG, 'line');
    node.setAttribute('x1', x1); node.setAttribute('y1', y1); node.setAttribute('x2', x2); node.setAttribute('y2', y2);
    node.setAttribute('class', cls);
    group.append(node);
    return node;
  }
  function chevron(group, e, cls) {
    const c = e.polygon.reduce((s, p) => [s[0] + p[0] / 6, s[1] + p[1] / 6], [0, 0]);
    const m = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2], d = [m[0] - c[0], m[1] - c[1]], len = Math.hypot(...d) || 1;
    const u = [d[0] / len, d[1] / len], t = [-u[1], u[0]], tip = [m[0] + u[0] * 6, m[1] + u[1] * 6];
    const base = [m[0] - u[0] * 8, m[1] - u[1] * 8];
    const pts = [tip, [base[0] + t[0] * 9, base[1] + t[1] * 9], [base[0] - t[0] * 9, base[1] - t[1] * 9]].map(editorPoint);
    const node = doc.createElementNS(SVG, 'polygon');
    node.setAttribute('points', pts.map(p => p.join(',')).join(' '));
    node.setAttribute('class', cls);
    group.append(node);
  }
  function paintOverlay() {
    if (!overlay) return;
    overlay.replaceChildren();
    if (!passages) { overlay.append(ghostLayer); return; }
    const open = new Set(passages.connections.map(c => c.id));
    // Owner 2026-11-02: one type at one height joins into one map, so its shared
    // edges show no border even where no passage opened (as the ranch draws it).
    const joined = new Set(passages.closed.filter(c => c.reason === 'NO_SAFE_EXIT').map(c => c.id));
    const pick = pickedModule(), pickType = pick ? ranchEcologyType(pick) : null;
    const rims = doc.createElementNS(SVG, 'g'), bridges = doc.createElementNS(SVG, 'g'), exits = doc.createElementNS(SVG, 'g');
    rims.setAttribute('class', 'cm-hexworld__rims');
    for (const outline of passages.outlines) {
      const synergy = pickType !== null && ranchEcologyType(outline.moduleId) === pickType;
      for (const edge of outline.edges) {
        if (open.has(edge.id) || joined.has(edge.id)) continue;
        line(rims, edge.a, edge.b, 'cm-hexworld__rim-shadow');
        line(rims, edge.a, edge.b, synergy ? 'cm-hexworld__rim cm-hexworld__rim--synergy' : 'cm-hexworld__rim');
      }
    }
    for (const c of passages.connections) {
      line(bridges, c.a, c.b, 'cm-hexworld__bridge-glow');
      line(bridges, c.a, c.b, 'cm-hexworld__bridge');
    }
    for (const e of passages.exits) {
      if (joined.has(e.id)) continue;   // inside one joined map: nothing to connect there
      const owner = passages.outlines.find(o => o.instanceId === e.instanceId);
      const synergy = pickType !== null && owner && ranchEcologyType(owner.moduleId) === pickType;
      chevron(exits, e, synergy ? 'cm-hexworld__exit cm-hexworld__exit--synergy' : 'cm-hexworld__exit');
    }
    overlay.append(rims, bridges, exits, ghostLayer);
  }
  function paintGhostOverlay(state) {
    for (const node of board.querySelectorAll?.('.cm-hexworld__verdict') ?? []) node.remove?.();
    ghostLayer?.replaceChildren();
    if (!state) return;
    const p = hexWorldEditorPoint(state.slotIndex);
    const pill = el(doc, 'span', 'cm-hexworld__verdict', uiText(VERDICT_COPY[state.verdict]));
    pill.dataset.verdict = state.verdict;
    if (state.gain.length) pill.textContent = uiText('✨ 可連通 {n} 條通道', { n: state.gain.length });
    pill.style.left = `${p.x + HEX_W / 2}px`;
    pill.style.top = `${p.y - 8}px`;
    board.append(pill);
    if (!ghostLayer) return;
    // Ghost footprint: every hex the cage would cover, the colliding ones marked.
    for (const slot of state.cells) {
      const q = hexWorldEditorPoint(slot), hex = doc.createElementNS(SVG, 'polygon');
      hex.setAttribute('points', [[24, 0], [48, 12], [48, 44], [24, 56], [0, 44], [0, 12]].map(([a, b]) => `${q.x + a},${q.y + b}`).join(' '));
      hex.setAttribute('class', `cm-hexworld__ghost-hex cm-hexworld__ghost-hex--${state.conflicts.has(slot) ? 'conflict' : state.verdict}`);
      hex.dataset.slotIndex = String(slot);
      ghostLayer.append(hex);
    }
    for (const c of state.gain) line(ghostLayer, c.a, c.b, 'cm-hexworld__bridge cm-hexworld__bridge--preview');
  }

  // ---------------------------------------------------------------- paint
  function paintCells() {
    board.replaceChildren();
    cellNodes.clear();
    const used = cage.productGrid?.usedCells ?? 0, cap = cage.productGrid?.cellCap ?? 100, landCap = cage.landCapacity ?? cap;
    layers = hexWorldCellLayers(cage.slots, Math.min(cap, landCap) - used);
    const lid = layers.size && [...layers.values()].includes('lid') ? cageUiLidImage() : null;
    const pick = pickedModule(), pickType = pick ? ranchEcologyType(pick) : null;
    const snapInstance = cage.lastVerdict && cage.lastVerdict !== animatedVerdict && cage.lastVerdict.ok
      && /PLACED|MOVED/.test(cage.lastVerdict.reason ?? '') && Number.isInteger(cage.lastVerdict.slotIndex)
      ? cage.slots[cage.lastVerdict.slotIndex]?.instanceId ?? null : null;
    // Same art arithmetic as the old board: a cage's picture spans its footprint.
    const art = new Map(cageEditorArtCells(cage.slots.filter(s => s.moduleId), undefined, { productGrid: true }).map(c => [c.slotIndex, c]));
    const fragment = doc.createDocumentFragment();
    const badges = new Map();
    for (const slot of cage.slots) {
      const p = hexWorldEditorPoint(slot.slotIndex);
      const cell = el(doc, 'button', 'cm-vs2-cage-slot cm-hexworld__cell');
      cell.type = 'button';
      cell.dataset.slotIndex = String(slot.slotIndex);
      cell.dataset.row = String(slot.row);
      cell.dataset.unlocked = 'true';
      cell.dataset.filled = slot.moduleId ? 'true' : 'false';
      cell.dataset.fixed = slot.fixed ? 'true' : 'false';
      cell.dataset.layer = layers.get(slot.slotIndex) ?? 'open';
      // A repaint during the gold wave rebuilds the cell; it picks the wave up where it was.
      if (wave?.slots.has(slot.slotIndex)) {
        cell.dataset.landWave = 'true';
        cell.style.setProperty('--wave-delay', `${wave.slots.get(slot.slotIndex) - (Date.now() - wave.start)}ms`);
      }
      if (slot.instanceId) cell.dataset.instanceId = slot.instanceId;
      if (selected && slot.instanceId && slot.instanceId === selected.instanceId) cell.dataset.selected = moving ? 'moving' : 'true';
      if (pickType !== null && slot.moduleId && ranchEcologyType(slot.moduleId) === pickType) cell.dataset.synergy = 'true';
      if (snapInstance && slot.instanceId === snapInstance) cell.dataset.snap = 'true';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', slot.moduleId
        ? uiText('第 {n} 格：{cage}。{effect}', { n: slot.slotIndex + 1, cage: cageUiName(slot.moduleId, slot.displayName), effect: cageUiSummary(slot.moduleId, slot.trainingSummary) ?? '' })
        : uiText(`Empty hex ${slot.slotIndex + 1}`));
      cell.style.left = `${p.x}px`;
      cell.style.top = `${p.y}px`;
      const visual = art.get(slot.slotIndex);
      if (visual?.image) {
        cell.style.backgroundImage = `url('${visual.image}')`;
        cell.style.backgroundSize = `${visual.imageWidth}px ${visual.imageHeight}px`;
        cell.style.backgroundPosition = `${visual.imageX}px ${visual.imageY}px`;
      } else if (lid && cell.dataset.layer === 'lid') cell.style.backgroundImage = `url('${lid}')`;
      // A royal cage wears the gold frame; a cage running a core shows what it runs.
      const automation = slot.instanceId ? cage.automation?.[slot.instanceId] : null;
      if (automation?.royal) cell.dataset.royal = automation.edition;
      if (automation && !automation.royal) cell.dataset.automated = [automation.clean ? 'clean' : '', automation.feed ? 'feed' : ''].filter(Boolean).join(' ');
      cell.addEventListener('click', () => onCell(slot));
      cell.addEventListener('pointerenter', () => previewAt(slot.slotIndex));
      cellNodes.set(slot.slotIndex, cell);
      fragment.append(cell);
      // One name badge per placed cage, at its footprint's centre (edges stay clear for the passage marks).
      if (slot.moduleId && slot.instanceId) {
        const seen = badges.get(slot.instanceId);
        badges.set(slot.instanceId, seen ? { ...seen, points: [...seen.points, p] } : { slot, points: [p] });
      }
    }
    board.append(fragment);
    // Owner 2026-10-27: the board shows names only (the suggested count lives on
    // the cartridge), and a badge that would cover a neighbour's steps down a row.
    const taken = [];
    for (const { slot, points } of [...badges.values()].sort((a, b) => Math.min(...a.points.map(q => q.y)) - Math.min(...b.points.map(q => q.y)))) {
      const p = { x: points.reduce((s, q) => s + q.x, 0) / points.length, y: points.reduce((s, q) => s + q.y, 0) / points.length };
      const automation = cage.automation?.[slot.instanceId] ?? null;
      const royalName = automation?.royal ? (cage.royalTray?.find((entry) => entry.edition === automation.edition)?.name
        ?? (automation.edition === 'STELLAR_ZOO' ? '全自動星際動物園' : '全自動皇家牧場')) : null;
      const badge = el(doc, 'span', 'cm-hexworld__badge', royalName ? uiText(royalName) : cageUiName(slot.moduleId, slot.displayName));
      badge.setAttribute('aria-hidden', 'true');
      if (slot.fixed) badge.dataset.fixed = 'true';
      if (royalName) { badge.dataset.royal = automation.edition; badge.prepend(icon('crown', 'cm-hexworld__badge-crown')); }
      else if (automation) badge.append(icon('robot', 'cm-hexworld__badge-core'));
      const x = p.x + HEX_W / 2;
      let y = p.y + HEX_H / 2 - 7;
      board.append(badge);
      const half = (badge.offsetWidth || 48) / 2, h = (badge.offsetHeight || 13) + 1;
      while (taken.some(b => Math.abs(b.x - x) < b.half + half && Math.abs(b.y - y) < h)) y += h;
      taken.push({ x, y, half });
      badge.style.left = `${x}px`;
      badge.style.top = `${y}px`;
    }
    if (overlay) { board.append(overlay); paintOverlay(); }
    if (snapInstance) animatedVerdict = cage.lastVerdict;
    if (hoverSlot !== null) previewAt(hoverSlot);
  }

  function paintCounter() {
    const used = cage.productGrid?.usedCells ?? 0, cap = cage.productGrid?.cellCap ?? 100, landCap = cage.landCapacity ?? cap;
    // DIAMOND_ECONOMY_20261102: the big number is the land (20 → 100 by diamonds); the cells in use sit under it.
    const meter = el(doc, 'span', 'cm-hexworld__land-meter');
    meter.append(el(doc, 'strong', 'cm-hexworld__count', `${Math.min(cap, landCap)}／${cap}`), el(doc, 'span', 'cm-hexworld__land-label', uiText('可用土地')));
    const notes = el(doc, 'span', 'cm-hexworld__notes');
    notes.append(el(doc, 'span', 'cm-hexworld__land-note', landCap < cap ? uiText('可用土地 {n} 格', { n: landCap }) : uiText('全部土地已開放')),
      el(doc, 'span', 'cm-hexworld__used-note', uiText('已使用 {n} 格', { n: used })));
    counter.replaceChildren(meter, notes);
    counter.dataset.full = used >= Math.min(cap, landCap) ? 'true' : 'false';
  }

  /** The diamond land key: +10 cells for the step's price (200 → 2,200); at 100 cells a crowned, closed key. */
  function landKey() {
    const rows = cage.productGrid?.landRows ?? [];
    if (!openLandPurchase && rows.length) return null;
    if (!rows.length) {
      if (!cage.productGrid) return null;
      const done = el(doc, 'button', 'cm-vs2-action cm-hexworld__buy-land cm-land-key');
      done.type = 'button';
      done.disabled = true;
      done.dataset.landMax = 'true';
      done.append(icon('crown', 'cm-land-key__icon'), el(doc, 'span', 'cm-land-key__label', uiText('已達最大 100 格領域')));
      return done;
    }
    const next = rows[0], cost = cage.land?.price || landExpansionPrice(cage.landCapacity) || 1000;
    const buy = el(doc, 'button', 'cm-vs2-action cm-cage-row-lock cm-hexworld__buy-land cm-land-key');
    buy.type = 'button';
    buy.dataset.lockedTestRow = String(next.row);
    buy.setAttribute('aria-haspopup', 'dialog');
    buy.setAttribute('aria-label', uiText('CAGE_TEST_BUY_ROW', { row: next.row + 1, count: next.cells, price: cost }));
    const price = el(doc, 'span', 'cm-land-key__price');
    price.append(gachaCurrencyImage('diamond', 'cm-land-key__diamond', doc), el(doc, 'span', '', cost.toLocaleString('en-US')));
    buy.dataset.landPrice = String(cost);
    buy.append(price, el(doc, 'span', 'cm-land-key__label', uiText('擴充 +{n} 格', { n: next.cells })));
    if ((cage.testDiamonds ?? 0) < cost) buy.dataset.short = 'true';
    buy.addEventListener('click', () => openLandPurchase(next.row));
    return buy;
  }
  let landKeyNode = null;
  function paintLand() {
    land.replaceChildren();
    landKeyNode?.remove();
    landKeyNode = landKey();
    if (landKeyNode) toolbar.append(landKeyNode);
  }

  /**
   * Gold hex wave (DIAMOND_ECONOMY_20261102): after a land purchase, the empty cells nearest the ranch light
   * up ring by ring -- as many as the purchase opened. Land is a count, so these show where it can grow.
   */
  function playLandWave(cells) {
    const filled = cage.slots.filter((s) => s.moduleId).map((s) => s.slotIndex);
    const seen = new Set(filled), order = [];
    let ring = filled;
    for (let depth = 1; ring.length && order.length < cells; depth += 1) {
      const next = [];
      for (const slot of ring) for (const n of hexWorldNeighbours(slot)) {
        if (seen.has(n)) continue;
        seen.add(n); next.push(n);
        if (order.length < cells) order.push({ slot: n, depth });
      }
      ring = next;
    }
    wave = { start: Date.now(), slots: new Map(order.map(({ slot, depth }) => [slot, (depth - 1) * 120 + (slot % 3) * 40])) };
    for (const [slot, delay] of wave.slots) {
      const node = cellNodes.get(slot);
      if (!node) continue;
      node.dataset.landWave = 'true';
      node.style.setProperty('--wave-delay', `${delay}ms`);
    }
    if (waveTimer) clearTimeout(waveTimer);
    waveTimer = setTimeout(() => {
      wave = null;
      for (const node of cellNodes.values()) { delete node.dataset.landWave; node.style.removeProperty('--wave-delay'); }
      waveTimer = null;
    }, 2400);
    say(uiText('可用土地 +{n} 格！', { n: cells }), 'connected');
    return order.map((entry) => entry.slot);
  }

  function refreshPassages() {
    const draft = draftPlacements(), key = JSON.stringify(draft);
    if (key === passageKey) return;
    const before = passages ? new Set(passages.connections.map(c => c.id)) : null;
    passages = hexWorldPassageView(draft);
    passageKey = key;
    // A new passage after a placement or a move: the shared edge just opened.
    const opened = before && passages ? passages.connections.filter(c => !before.has(c.id)) : [];
    if (opened.length && /PLACED|MOVED/.test(cage.lastVerdict?.reason ?? '')) {
      say(uiText('✨ 區域連通！'), 'connected');
      fx(toast, 'sparkle');
    }
  }

  return Object.freeze({
    element: root,
    paint(nextCage) {
      cage = nextCage;
      if (selected) {
        // Keep the selection on the same instance after an edit; drop it when it is gone.
        const slot = cage.slots.find(s => s.instanceId && s.instanceId === selected.instanceId && s.moduleId === selected.moduleId);
        selected = slot ? { ...selected, slotIndex: slot.slotIndex } : null;
        if (!selected) moving = false;
      }
      revert.disabled = !cage.dirty;
      refreshPassages();
      paintCounter();
      paintCells();
      paintSelection();
      paintLand();
      if (!fitted) fitted = fitTo(occupiedSlots());
      apply();
      const landNow = Math.min(cage.productGrid?.cellCap ?? 100, cage.landCapacity ?? 100);
      if (paintedLand !== null && landNow > paintedLand) {
        root.dataset.landWave = String(playLandWave(landNow - paintedLand).length);
        fx(counter, 'sparkle');
      }
      paintedLand = landNow;
    },
    refit() { fitted = fitTo(occupiedSlots()); },
    getView: () => ({ ...view, selected: selected?.instanceId ?? null, moving, passages: passages?.connections.length ?? null }),
    dispose() { if (toastTimer) clearTimeout(toastTimer); if (waveTimer) clearTimeout(waveTimer); sizeWatch?.disconnect(); root.remove(); }
  });
}

export const HEX_WORLD_EDITOR_SLOT_COUNT = PRODUCT_RANCH_SLOT_COUNT;
