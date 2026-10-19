// Functional initial scene data. Raw model/ATR/ESC files stay offline.
import source from "../../../data/championship/catalogs/hunt-scene.r1.json" with { type: "json" };
import { deepFreeze } from "../../contracts/championshipContracts.js";
import { selectNativeHuntGateVariant } from "./nativeHuntGateVariant.js";

function expand(runs, length, max) {
  const cells = new Uint8Array(length);
  let offset = 0;
  for (const [count, value] of runs) {
    if (!Number.isInteger(count) || count < 1 || offset + count > length
      || !Number.isInteger(value) || value < 0 || value > max) throw Error("HUNT_SCENE_GRID_INVALID");
    cells.fill(value, offset, offset + count); offset += count;
  }
  if (offset !== length) throw Error("HUNT_SCENE_GRID_INCOMPLETE");
  return cells;
}
if (source.schemaVersion !== 1 || source.contract !== "HUNT_SCENE_SOURCES.v1"
  || source.gates.length !== 16 || source.fields.length !== 32) throw Error("HUNT_SCENE_SOURCE_INVALID");
deepFreeze(source);

// Owner 2026-10-19 (local review): hunt fields may grow their exploration
// area. An expansion keeps the original grid at the origin and appends tiles
// east/south, so no original coordinate moves; it is used only when supplied.
import { validateCaveGroups } from "./nativeHuntCavePassage.js";
export const NATIVE_HUNT_EXPANSION_ADAPTATION = 'OWNER_APPROVED_HUNT_EXPANSION_REVIEW_20261019';
export function resolveNativeHuntEnvironment(fieldId, { expansion = null } = {}) {
  const expanded = expansion?.adaptation === NATIVE_HUNT_EXPANSION_ADAPTATION ? expansion.environments?.[fieldId] : null;
  return createNativeHuntEnvironment(expanded ?? source.environments[fieldId]);
}

export function createNativeHuntEnvironment(data) {
  const expanded = data?.adaptation === NATIVE_HUNT_EXPANSION_ADAPTATION && data.base?.widthTiles === 128 && data.base?.heightTiles === 128
    && data.base?.originTile?.[0] === 0 && data.base?.originTile?.[1] === 0
    && Number.isInteger(data.width) && Number.isInteger(data.height) && data.width >= 128 && data.height >= 128 && data.width <= 256 && data.height <= 256;
  if (!data || (!expanded && (data.width !== 128 || data.height !== 128)) || data.wrap !== false) throw Error("HUNT_SCENE_ENVIRONMENT_REQUIRED");
  const length = data.width * data.height;
  const terrain = expand(data.terrainRuns, length, 4);
  const direction = expand(data.directionRuns, length, data.directionPalette.length - 1);
  const outside = (x,y) => x < 0 || y < 0 || x >= data.width || y >= data.height;
  const validate = (x,y) => {
    if (!Number.isInteger(x) || !Number.isInteger(y)) throw Error("HUNT_SCENE_TILE_REQUIRED");
  };
  // 02087F30 returns byte zero out of bounds; retain its consumed semantics.
  const outsideDirection = deepFreeze({ targetQ12:[0,-4096,0], blendQ12:0xcd });
  const readTerrain = (x,y) => { validate(x,y); return outside(x,y) ? 1 : terrain[y * data.width + x]; };
  return Object.freeze({ width:data.width, height:data.height, wrap:false, readTerrain,
    ...(expanded ? { adaptation:NATIVE_HUNT_EXPANSION_ADAPTATION } : {}),
    ...(expanded && data.caveGroups ? { caveGroups:validateCaveGroups(data.caveGroups, data.width, data.height) } : {}),
    isBlocked:(x,y) => readTerrain(x,y) === 1,
    readDirectionCell(x,y) {
      validate(x,y);
      return outside(x,y) ? outsideDirection : data.directionPalette[direction[y * data.width + x]];
    }
  });
}

export function resolveNativeHuntSceneSources({ biomeId, hour, season, expansion = null } = {}) {
  const gate = source.gates.find(row => row.biomeId === biomeId);
  if (!gate) throw Error("HUNT_SCENE_GATE_REQUIRED");
  if (!Number.isInteger(season) || season < 0 || season > 3) throw Error("HUNT_SCENE_SEASON_REQUIRED");
  const variant = selectNativeHuntGateVariant({ positionQ12:gate.positionQ12, hour });
  const nativeHuntIndex = variant.night ? gate.nightIndex : gate.dayIndex;
  const field = source.fields[nativeHuntIndex];
  if (field.nativeHuntIndex !== nativeHuntIndex) throw Error("HUNT_SCENE_FIELD_ORDER_INVALID");
  return Object.freeze({ biomeId, biomeIndex:nativeHuntIndex >> 1, nativeHuntIndex,
    fieldId:field.fieldId, season, hour, variant,
    environment:resolveNativeHuntEnvironment(field.fieldId, { expansion }), sceneEffect:field.sceneEffects[season] });
}
