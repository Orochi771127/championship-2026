// Owner 2026-10-30: Awakened and Ultimate partners were drawn too large and their sizes
// varied widely. Each gets one body size per stage (stage-body-size.v1.json: AW 42, UL 48
// native px of sqrt(height x width) at idle, against Mature's measured 37); Growth and
// Mature are unchanged. Reviewed art applies it through its General display scale; original
// art through its native cell geometry, so bounds, shadows and taps scale with the body.
import table from '../../data/championship/stage-body-size.v1.json' with {type:'json'};

const scales = new Map(table.rows);
export function stageBodyScale(speciesId) {
  return scales.get(String(speciesId ?? '').replace(/^championship:creature:/, '')) ?? 1;
}
export function scaleNativeGeometry(geometry, k) {
  if (!geometry?.frames || k === 1) return geometry;
  return {...geometry, frames: Object.fromEntries(Object.entries(geometry.frames).map(([key, g]) => [key, g.blank ? g
    : {...g, scale: g.scale / k, ...(Array.isArray(g.nativeBounds) ? {nativeBounds: g.nativeBounds.map(v => v * k)} : {})}]))};
}
