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

export function resolveNativeHuntEnvironment(fieldId) {
  const data = source.environments[fieldId];
  if (!data || data.width !== 128 || data.height !== 128 || data.wrap !== false) throw Error("HUNT_SCENE_ENVIRONMENT_REQUIRED");
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
    isBlocked:(x,y) => readTerrain(x,y) === 1,
    readDirectionCell(x,y) {
      validate(x,y);
      return outside(x,y) ? outsideDirection : data.directionPalette[direction[y * data.width + x]];
    }
  });
}

export function resolveNativeHuntSceneSources({ biomeId, hour, season } = {}) {
  const gate = source.gates.find(row => row.biomeId === biomeId);
  if (!gate) throw Error("HUNT_SCENE_GATE_REQUIRED");
  if (!Number.isInteger(season) || season < 0 || season > 3) throw Error("HUNT_SCENE_SEASON_REQUIRED");
  const variant = selectNativeHuntGateVariant({ positionQ12:gate.positionQ12, hour });
  const nativeHuntIndex = variant.night ? gate.nightIndex : gate.dayIndex;
  const field = source.fields[nativeHuntIndex];
  if (field.nativeHuntIndex !== nativeHuntIndex) throw Error("HUNT_SCENE_FIELD_ORDER_INVALID");
  return Object.freeze({ biomeId, biomeIndex:nativeHuntIndex >> 1, nativeHuntIndex,
    fieldId:field.fieldId, season, hour, variant,
    environment:resolveNativeHuntEnvironment(field.fieldId), sceneEffect:field.sceneEffects[season] });
}
