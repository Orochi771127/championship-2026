import { BATTLE_CHARACTER_PROFILES, BATTLE_SPECIES_ENTITIES } from "../../../data/championship/battleCharacterProfiles.js";
const Q12 = 4096;

// Native Main NCER dimensions, consumed by 0210B924. Use the same numeric
// geometry authority as battle, never sprite padding or a touch-sized circle.
export function nativeHuntActorBounds(speciesIndex) {
  const entityId = BATTLE_SPECIES_ENTITIES[speciesIndex];
  const profile = BATTLE_CHARACTER_PROFILES[entityId];
  const frame = profile?.sequences.find(s => s.id === 0)?.frames[0];
  const bounds = profile?.cells[frame?.cell];
  if (!bounds) throw Error("NATIVE_HUNT_ACTOR_GEOMETRY_REQUIRED");
  const height = bounds[3] - bounds[1], half = (bounds[2] - bounds[0]) >>> 1;
  return Object.freeze({ entityId, rect:[-half - 5, 5 - height, half + 5, 5], area:height * (half * 2) });
}

// 02066538: retain native slot iteration and the record-high-Y condition.
// It appends each qualifying new record; sorting all overlaps changes targets.
export function queryNativeHuntActors(actors, centerQ12, rect) {
  const hits = [];
  let bestY = -Q12;
  for (const actor of actors.slice(0, 32)) {
    if (!actor || !actor.actorActive || actor.hidden) continue;
    const [x,y] = actor.positionQ12;
    if (y <= bestY) continue;
    const box = actor.bounds.rect;
    if ((x >> 12) + box[0] > (centerQ12[0] >> 12) + rect[2]
      || (x >> 12) + box[2] < (centerQ12[0] >> 12) + rect[0]
      || (y >> 12) + box[1] > (centerQ12[1] >> 12) + rect[3]
      || (y >> 12) + box[3] < (centerQ12[1] >> 12) + rect[1]) continue;
    hits.push(actor); bestY = y;
  }
  return hits;
}

// 0210E9F0 / AI8 02111004..021112E8, including the same-row/column exclusions.
export function nativeHuntEscapePosition(positionQ12, environment, nextChannel) {
  const [px,py] = positionQ12.slice(0,2).map(n => Math.trunc((n >> 12) / 8));
  const { width, height } = environment;
  if (px > 0 && py > 0 && px < width && py < height
    && !environment.readDirectionCell(px,py).escapeBoundary) return null;
  let x = nextChannel(0xb3) % width, y = nextChannel(0xb3) % height;
  const interior = px > 0 && py > 0 && px <= width - 1 && py <= height - 1;
  for (let row=0; row<height; row++,y=(y+1)%height) {
    for (let col=0; col<width; col++,x=(x+1)%width) {
      if (!environment.readDirectionCell(x,y).escapeAnchor) continue;
      if (interior && (x === 0 || y === 0 || x === width-1 || y === height-1 || x === px || y === py)) continue;
      return [x * 8 * Q12, y * 8 * Q12, 0];
    }
  }
  return [...positionQ12];
}
