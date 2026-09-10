import { createNativeCharacterAnimationTimeline } from "../../../../../../../src/championship/presentation/characterAnimationTimeline.js";

function requireData(condition, message) { if (!condition) throw new Error(`PIXEL_REVIEW_${message}`); }
const isInt = (n) => Number.isSafeInteger(n);
const SIDES = ["main", "sub"];

export function resolvePreviewUrl(input, baseUrl) {
  const base = new URL(baseUrl);
  const rootMarker = "/docs/art/production/characters/appearance-refresh-v1/";
  const rootAt = base.pathname.indexOf(rootMarker);
  requireData(rootAt >= 0 && typeof input === "string" && input.length > 0, "INVALID_BASE_OR_PATH");
  requireData(!/[\\%?#]/.test(input) && !/^[a-z][a-z0-9+.-]*:/i.test(input) && !input.startsWith("//"), "INVALID_MANIFEST_PATH");
  const resolved = new URL(input, base);
  const programRoot = base.pathname.slice(0, rootAt + rootMarker.length);
  requireData(resolved.origin === base.origin && resolved.pathname.startsWith(programRoot)
    && resolved.pathname.endsWith("/preview-data.json"), "MANIFEST_OUTSIDE_PROGRAM");
  return resolved.href;
}

export function parsePaletteColor(value, index) {
  if (index === 0) return [0, 0, 0, 0];
  requireData(typeof value === "string" && /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value), "INVALID_PALETTE_COLOR");
  const parts = value.slice(1).match(/../g).map((pair) => parseInt(pair, 16));
  requireData(parts.length === 3 || parts[3] === 255, "OPAQUE_PALETTE_REQUIRED");
  return [...parts.slice(0, 3), 255];
}

export function isAuthoredSlot(data, slot) {
  return slot?.status === "AUTHORED" && Array.isArray(data.masters[slot.masterId]?.indices);
}

export function validatePreviewData(data) {
  requireData(data?.schemaVersion === 2 && /^[em]\d{3}_[a-z0-9_]+$/.test(data.entityId ?? ""), "INVALID_SCHEMA");
  requireData(Array.isArray(data.palette) && data.palette.length >= 2 && data.palette.length <= 16, "INVALID_PALETTE");
  requireData(data.palette[0] === "#00000000", "TRANSPARENT_INDEX_ZERO_REQUIRED");
  data.palette.forEach(parsePaletteColor);
  const canvas = data.canvas;
  requireData(canvas && [canvas.width, canvas.height, canvas.scale].every(isInt)
    && canvas.width > 0 && canvas.height > 0 && canvas.width <= 2048 && canvas.height <= 2048
    && canvas.scale > 0 && canvas.scale <= 64 && Array.isArray(canvas.origin) && canvas.origin.length === 2
    && canvas.origin.every(isInt) && canvas.origin[0] >= 0 && canvas.origin[0] <= canvas.width
    && canvas.origin[1] >= 0 && canvas.origin[1] <= canvas.height, "INVALID_CANVAS");
  requireData(data.masters && typeof data.masters === "object" && !Array.isArray(data.masters)
    && data.slots && typeof data.slots === "object" && !Array.isArray(data.slots), "INVALID_BANK");
  for (const [key, slot] of Object.entries(data.slots)) {
    requireData(SIDES.includes(slot.side) && isInt(slot.cell) && slot.cell >= 0
      && key === `${data.entityId}/${slot.side}/cell_${String(slot.cell).padStart(3, "0")}`
      && typeof slot.masterId === "string" && ["AUTHORED", "UNAUTHORED"].includes(slot.status), "INVALID_SLOT");
    if (slot.status !== "AUTHORED") continue;
    const master = data.masters[slot.masterId];
    requireData(Array.isArray(master?.indices) && master.indices.length > 0 && master.indices.length <= 256, "AUTHORED_PIXELS_MISSING");
    const width = master.indices[0]?.length;
    requireData(isInt(width) && width > 0 && width <= 256 && master.indices.every((row) => Array.isArray(row)
      && row.length === width && row.every((n) => isInt(n) && n >= 0 && n < data.palette.length)), "INVALID_INDEXED_PIXELS");
    const b = slot.nativeBounds;
    requireData(Array.isArray(b) && b.length === 4 && b.every(isInt) && b[2] - b[0] === width
      && b[3] - b[1] === master.indices.length, "INVALID_NATIVE_BOUNDS");
    requireData(master.indices.every((row, y) => row.every((index, x) => index === 0
      || (canvas.origin[0] + (b[0] + x) * canvas.scale >= 0 && canvas.origin[1] + (b[1] + y) * canvas.scale >= 0
        && canvas.origin[0] + (b[0] + x + 1) * canvas.scale <= canvas.width
        && canvas.origin[1] + (b[1] + y + 1) * canvas.scale <= canvas.height))), "PIXELS_OUTSIDE_NATIVE_CANVAS");
  }
  for (const side of SIDES) {
    const sequences = data.sides?.[side]?.sequences;
    requireData(Array.isArray(sequences) && sequences.length > 0 && new Set(sequences.map((seq) => seq.id)).size === sequences.length, "INVALID_SEQUENCES");
    for (const sequence of sequences) {
      requireData(isInt(sequence.id) && sequence.id >= 0, "INVALID_SEQUENCE_ID");
      createNativeCharacterAnimationTimeline(sequence);
      for (const frame of sequence.frames) requireData(data.slots[frame.texture]?.side === side
        && data.slots[frame.texture].cell === frame.cell, "SEQUENCE_SLOT_MISMATCH");
    }
  }
  return data;
}

export function collectCoverage(data) {
  const slots = Object.values(data.slots);
  const masterIds = [...new Set(slots.map((slot) => slot.masterId))].sort();
  const authoredIds = masterIds.filter((id) => slots.some((slot) => slot.masterId === id && isAuthoredSlot(data, slot)));
  return { authoredMasters: authoredIds.length, totalMasters: masterIds.length,
    authoredSlots: slots.filter((slot) => isAuthoredSlot(data, slot)).length, totalSlots: slots.length,
    totalSequences: SIDES.reduce((sum, side) => sum + data.sides[side].sequences.length, 0), masterIds };
}

export function masterMembers(data, masterId) {
  return Object.entries(data.slots).filter(([, slot]) => slot.masterId === masterId).map(([key]) => key);
}

export function patchConsumers(data) {
  const consumers = new Map();
  for (const [masterId, master] of Object.entries(data.masters)) for (const reference of master.patchRefs ?? []) {
    const id = typeof reference === "string" ? reference : reference.id;
    if (typeof id !== "string") continue;
    if (!consumers.has(id)) consumers.set(id, new Set());
    consumers.get(id).add(masterId);
  }
  return [...consumers].map(([id, masters]) => ({ id, masters: [...masters],
    slots: [...new Set([...masters].flatMap((masterId) => masterMembers(data, masterId)))] }));
}

export function rasterizeSlot(data, key, palette = data.palette) {
  const { width, height, origin, scale } = data.canvas;
  const rgba = new Uint8ClampedArray(width * height * 4);
  const slot = data.slots[key];
  if (!isAuthoredSlot(data, slot)) return { width, height, rgba, authored: false, slot };
  const master = data.masters[slot.masterId];
  const colors = palette.map(parsePaletteColor);
  master.indices.forEach((row, y) => row.forEach((index, x) => {
    if (index === 0) return;
    const left = origin[0] + (slot.nativeBounds[0] + x) * scale;
    const top = origin[1] + (slot.nativeBounds[1] + y) * scale;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) rgba.set(colors[index], ((top + dy) * width + left + dx) * 4);
  }));
  return { width, height, rgba, authored: true, slot, master };
}

/** Review scheduler calls one exact source unit at a time; it does not claim a gameplay frequency. */
export function createPixelReviewPlayer(data, side, sequenceId) {
  const sequence = data.sides[side].sequences.find((seq) => seq.id === sequenceId);
  requireData(sequence, "UNKNOWN_SEQUENCE");
  let native = createNativeCharacterAnimationTimeline(sequence);
  let units = 0;
  const snapshot = () => ({ ...native.getSnapshot(), units,
    frameTicks: sequence.frames[native.getSnapshot().frameIndex].ticks,
    authored: isAuthoredSlot(data, data.slots[native.getSnapshot().texture]),
    authoredFrameReferences: sequence.frames.filter((frame) => isAuthoredSlot(data, data.slots[frame.texture])).length,
    totalFrameReferences: sequence.frames.length });
  return Object.freeze({ getSnapshot: snapshot, sequence,
    stepUnit() { native.advanceNative(4096); units++; return snapshot(); },
    reset() { native = createNativeCharacterAnimationTimeline(sequence); units = 0; return snapshot(); },
    stepFrame() {
      const start = native.getSnapshot();
      if (!start.active) return snapshot();
      const remaining = sequence.frames[start.frameIndex].ticks - Math.floor(start.elapsedQ12 / 4096);
      for (let n = 0; n < remaining; n++) { native.advanceNative(4096); units++; }
      return snapshot();
    }
  });
}
