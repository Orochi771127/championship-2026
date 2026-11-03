// Owner 2026-10-30: Awakened and Ultimate partners were drawn too large and their sizes
// varied widely. Each gets one body size per stage (stage-body-size.v1.json: AW 42, UL 48
// native px of sqrt(height x width) at idle). Owner 2026-11-03: the redrawn Growth/Mature art had
// drifted (a Mature wolf bigger than the dragons beside it), and size should follow each partner's
// species and biology, not its stage. Growth keeps one band (0.8-1.1x its median, 20.2). From
// Mature up every partner has a size class (sizeClass: small 0.75, humanoid 0.88, standard 1,
// large 1.15, giant 1.35 x 40) with a +-5 % personal variation from its original idle cell, so a
// large Mature dragon can stand taller than a humanoid Ultimate. No partner is enlarged more than
// 1.5x beyond its live scale, so none is drawn blurrier than art already live (about 2.1 source px
// per native px at the least). Reviewed art applies it through its
// General display scale; original art through its native cell geometry, so bounds, shadows
// and taps scale with the body.
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
