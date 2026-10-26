// Hex cage world editor board (Owner direction 2026-10-26).
//
// Edit mode only: a faint honeycomb of every world position in a pan/zoom
// viewport, the placed cages drawn over their full footprints, a selection, and
// a live footprint preview before anything is placed or moved. Dragging empty
// space pans and never edits; a tap edits. All rules (overlap, 100-cell cap,
// land, residents, waiting room) stay in the runtime; this view only previews
// and forwards intents, so a refused edit leaves the layout as it was.
import { PRODUCT_RANCH_SLOT_COUNT, productGridCell, productPlacementCells } from '../cage/productRanchGrid.js';
import { cageEditorArtCells, cageUiName, cageUiSummary } from '../presentation/cageUiArt.js';
import { ranchEcologyType } from '../cage/ranchEcology.js';
import { uiText } from '../text/uiText.js';

const HEX_W = 48, HEX_H = 56;            // editor px of one hex (native 96 × 112 at ÷2)
const MIN_ZOOM = 0.35, MAX_ZOOM = 2.2;
const ECOLOGY_LABEL = Object.freeze({ forest:'森林', grassland:'草原', garden:'花園', volcano:'火山', mountain:'高山', beach:'海灘',
  desert:'沙漠', snowfield:'冰原', sports:'運動場', gym:'健身房', infirmary:'保健室' });

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

export function createHexWorldBoard({ source, openLandPurchase, doc = globalThis.document }) {
  const root = el(doc, 'section', 'cm-hexworld');
  root.setAttribute('aria-label', uiText('牧場世界配置'));
  const toolbar = el(doc, 'div', 'cm-hexworld__toolbar');
  const counter = el(doc, 'p', 'cm-hexworld__counter');
  counter.setAttribute('aria-live', 'polite');
  const zoomOut = el(doc, 'button', 'cm-vs2-action cm-hexworld__zoom', '−');
  const zoomIn = el(doc, 'button', 'cm-vs2-action cm-hexworld__zoom', '＋');
  const fit = el(doc, 'button', 'cm-vs2-action cm-hexworld__zoom', '全覽');
  for (const [b, label] of [[zoomOut, '縮小'], [zoomIn, '放大'], [fit, '顯示全部設施']]) { b.type = 'button'; b.setAttribute('aria-label', uiText(label)); }
  toolbar.append(counter, zoomOut, zoomIn, fit);
  const viewport = el(doc, 'div', 'cm-hexworld__viewport');
  const board = el(doc, 'div', 'cm-vs2-cage-board cm-hexworld__board');
  board.dataset.productGrid = 'true';
  board.setAttribute('role', 'grid');
  board.setAttribute('aria-label', uiText('Ranch hex slots'));
  const ghost = el(doc, 'div', 'cm-hexworld__ghost');
  ghost.setAttribute('aria-hidden', 'true');
  viewport.append(board);
  const selection = el(doc, 'div', 'cm-hexworld__selection');
  selection.hidden = true;
  const land = el(doc, 'div', 'cm-hexworld__land');
  root.append(toolbar, viewport, selection, land);

  let cage = null, view = { x: 0, y: 0, zoom: 0.8 }, fitted = false;
  let selected = null, moving = false, hoverSlot = null;
  const cellNodes = new Map();

  // ---------------------------------------------------------------- pan / zoom
  const apply = () => { board.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`; };
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
  zoomIn.addEventListener('click', () => { const r = viewport.getBoundingClientRect(); zoomAt(1.25, r.width / 2, r.height / 2); });
  zoomOut.addEventListener('click', () => { const r = viewport.getBoundingClientRect(); zoomAt(0.8, r.width / 2, r.height / 2); });
  fit.addEventListener('click', () => fitTo(occupiedSlots()));
  viewport.addEventListener('wheel', e => {
    e.preventDefault();
    const r = viewport.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  // Drag pans; a press that does not move is a tap. Two fingers pinch-zoom.
  const pointers = new Map();
  let drag = null, suppressClick = false, pinch = null;
  viewport.addEventListener('pointerdown', e => {
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
      const [a, b] = [...pointers.values()], r = viewport.getBoundingClientRect();
      const factor = (pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance) / view.zoom;
      zoomAt(factor, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      suppressClick = true;
      return;
    }
    if (drag && drag.id === e.pointerId) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 8) return;
      if (!drag.moved) { drag.moved = true; viewport.setPointerCapture?.(e.pointerId); viewport.dataset.panning = 'true'; }
      view = { ...view, x: drag.vx + dx, y: drag.vy + dy };
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

  // ---------------------------------------------------------------- preview
  function footprintFor(slotIndex) {
    if (moving && selected) return productPlacementCells({ moduleId: selected.moduleId, slotIndex });
    const pick = cage?.tray?.find(t => t.selected);
    return pick ? productPlacementCells({ moduleId: pick.moduleId, slotIndex }) : null;
  }
  function previewAt(slotIndex) {
    hoverSlot = slotIndex;
    for (const node of board.querySelectorAll('[data-preview]')) delete node.dataset.preview;
    if (slotIndex === null) return;
    const cells = footprintFor(slotIndex);
    if (cells === null && !(moving || cage?.tray?.some(t => t.selected))) return;
    const own = moving && selected ? new Set(cage.slots.filter(s => s.instanceId === selected.instanceId).map(s => s.slotIndex)) : new Set();
    const blocked = !cells || cells.some(slot => { const s = cage.slots[slot]; return s?.moduleId && !own.has(slot); });
    const used = (cage.productGrid?.usedCells ?? 0) + (moving ? 0 : cells?.length ?? 0);
    const tooMany = !moving && used > Math.min(cage.productGrid?.cellCap ?? 100, cage.landCapacity ?? 100);
    const verdict = blocked ? 'blocked' : tooMany ? 'full' : 'ok';
    for (const slot of cells ?? [slotIndex]) {
      const node = cellNodes.get(slot);
      if (node) node.dataset.preview = verdict;
    }
  }

  // ---------------------------------------------------------------- selection actions
  function select(slot) {
    selected = slot ? { instanceId: slot.instanceId, moduleId: slot.moduleId, slotIndex: slot.slotIndex, fixed: slot.fixed } : null;
    moving = false;
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
    const cancel = el(doc, 'button', 'cm-vs2-action', moving ? '取消移動' : '取消選取');
    cancel.type = 'button';
    cancel.dataset.hexAction = 'cancel';
    cancel.addEventListener('click', () => { if (moving) { moving = false; paintSelection(); paintCells(); } else select(null); });
    actions.append(cancel);
    selection.append(actions);
  }

  function onCell(slot) {
    if (moving && selected) {
      const id = selected.instanceId;
      moving = false;
      selected = { ...selected, slotIndex: slot.slotIndex };
      source.intents.moveCagePlacement(id, slot.slotIndex);
      return;
    }
    if (slot.moduleId) { select(slot); return; }
    if (cage.tray.some(t => t.selected)) { source.intents.placeCageAt(slot.slotIndex); return; }
    select(null);
  }

  // ---------------------------------------------------------------- paint
  function paintCells() {
    board.replaceChildren();
    cellNodes.clear();
    // Same art arithmetic as the old board: a cage's picture spans its footprint.
    const art = new Map(cageEditorArtCells(cage.slots.filter(s => s.moduleId), undefined, { productGrid: true }).map(c => [c.slotIndex, c]));
    const fragment = doc.createDocumentFragment();
    for (const slot of cage.slots) {
      const p = hexWorldEditorPoint(slot.slotIndex);
      const cell = el(doc, 'button', 'cm-vs2-cage-slot cm-hexworld__cell');
      cell.type = 'button';
      cell.dataset.slotIndex = String(slot.slotIndex);
      cell.dataset.row = String(slot.row);
      cell.dataset.unlocked = 'true';
      cell.dataset.filled = slot.moduleId ? 'true' : 'false';
      cell.dataset.fixed = slot.fixed ? 'true' : 'false';
      if (slot.instanceId) cell.dataset.instanceId = slot.instanceId;
      if (selected && slot.instanceId && slot.instanceId === selected.instanceId) cell.dataset.selected = moving ? 'moving' : 'true';
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
      }
      cell.addEventListener('click', () => onCell(slot));
      cell.addEventListener('pointerenter', () => previewAt(slot.slotIndex));
      cellNodes.set(slot.slotIndex, cell);
      fragment.append(cell);
    }
    board.append(fragment);
    if (hoverSlot !== null) previewAt(hoverSlot);
  }

  function paintCounter() {
    const used = cage.productGrid?.usedCells ?? 0, cap = cage.productGrid?.cellCap ?? 100, landCap = cage.landCapacity ?? cap;
    counter.replaceChildren(
      el(doc, 'strong', 'cm-hexworld__count', `${used}／${cap}`),
      el(doc, 'span', 'cm-hexworld__land-note', landCap < cap ? uiText('可用土地 {n} 格', { n: landCap }) : uiText('全部土地已開放'))
    );
    counter.dataset.full = used >= Math.min(cap, landCap) ? 'true' : 'false';
  }

  function paintLand() {
    land.replaceChildren();
    const rows = cage.productGrid?.landRows ?? [];
    if (!rows.length || !openLandPurchase) return;
    const next = rows[0];
    const buy = el(doc, 'button', 'cm-vs2-action cm-cage-row-lock cm-hexworld__buy-land');
    buy.type = 'button';
    buy.dataset.lockedTestRow = String(next.row);
    buy.setAttribute('aria-haspopup', 'dialog');
    buy.setAttribute('aria-label', uiText('CAGE_TEST_BUY_ROW', { row: next.row + 1, count: next.cells, price: 1000 }));
    buy.textContent = uiText('開放土地 +{n} 格', { n: next.cells });
    buy.addEventListener('click', () => openLandPurchase(next.row));
    land.append(buy);
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
      paintCounter();
      paintCells();
      paintSelection();
      paintLand();
      if (!fitted) fitted = fitTo(occupiedSlots());
      apply();
    },
    refit() { fitted = fitTo(occupiedSlots()); },
    getView: () => ({ ...view, selected: selected?.instanceId ?? null, moving }),
    dispose() { root.remove(); }
  });
}

export const HEX_WORLD_EDITOR_SLOT_COUNT = PRODUCT_RANCH_SLOT_COUNT;
