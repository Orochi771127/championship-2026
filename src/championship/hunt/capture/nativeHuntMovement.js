// OVL0 0210D8B4, bounded modes 2/3 with no follow target. This is a movement
// host, not an encounter initializer or complete AI state machine. Original
// terrain/controller ports are mandatory; prototype collision is not a port.
import { nativeNormalizeQ12, nativeVectorLengthQ12 } from "./nativeCapturePhases.js";

const freeze = Object.freeze;
const Q12 = 4096;
const s32 = (n) => Number(BigInt.asIntN(32, BigInt(n)));
const mulQ12 = (a, b) => Number(BigInt.asIntN(32, (BigInt(a) * BigInt(b) + 2048n) >> 12n));
const vector = (v) => {
  if (!Array.isArray(v) || v.length !== 3 || v.some((n) => !Number.isInteger(n) || n < -0x80000000 || n > 0x7fffffff)) {
    throw new TypeError("NATIVE_MOVEMENT_Q12_VECTOR_REQUIRED");
  }
  return [...v];
};

// 02088048: unsigned bounds; attribute lookup returns zero out of bounds.
export function readNativeDirectionAttribute(grid, x, y) {
  validateGrid(grid, x, y);
  return x < 0 || y < 0 || x >= grid.width || y >= grid.height ? 0 : grid.bytes[y * grid.width + x];
}
function validateGrid(grid, x, y) {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !grid
    || !Number.isSafeInteger(grid.width) || grid.width < 1
    || !Number.isSafeInteger(grid.height) || grid.height < 1
    || !(grid.bytes instanceof Uint8Array) || grid.bytes.length !== grid.width * grid.height) {
    throw new TypeError("NATIVE_MOVEMENT_GRID_REQUIRED");
  }
}

// ARM9 0207C9E8 / 0207CA74. Bit tests are ordered, not a generic mask value.
export function readNativeTerrainType(grid, x, y) {
  validateGrid(grid, x, y);
  if (grid.wrap !== true && grid.wrap !== false) throw new TypeError("NATIVE_TERRAIN_WRAP_REQUIRED");
  if (grid.wrap) { x = ((x % grid.width) + grid.width) % grid.width; y = ((y % grid.height) + grid.height) % grid.height; }
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return 1;
  const b = grid.bytes[y * grid.width + x];
  if (b & 1) return 1;
  if (b & 2) return 2;
  if (b & 4) return 3;
  return b & 6 ? 4 : 0; // Preserve original final test, even though prior tests cover it.
}

// Low nibble vectors from 0210D9E4..0210DAD0 instruction/literal pairs.
// These are not sin/cos rounded at runtime: Nitro uses these exact integers.
const DIRECTIONS = freeze([
  [0, -4096], [2633, -3138], [3138, -2633], [4096, 0],
  [3138, 2633], [2633, 3138], [0, 4096], [-2633, 3138],
  [-3138, 2633], [-4096, 0], [-3138, -2633], [-2633, -3138],
].map(freeze));
export function nativeMovementTile(positionQ12) {
  return positionQ12.slice(0, 2).map((n) => Math.trunc((n >> 12) / 8) || 0);
}

// The dispatch at 0210D9AC only covers low nibbles 0..11. For 12..15 the
// original falls through 0210D9B0 to 0210DAD4 without storing either direction
// component, so it blends toward whatever the caller left at entry SP-0x30 and
// SP-0x2C; only Z is re-zeroed, at 0210DADC. The live producer traced on
// 2026-09-09 leaves X = the actor object address and Y = the animation return
// address ARM9 02047D5C pushes. Running the original normalize 02002A6C over
// sampled EWRAM pointers and ARM9 code addresses, all three blend rates and
// incoming table directions puts those 9,216 samples in one down-right cone of
// 38.94..45.86 degrees — narrower than the 30-degree step of the original's own
// table, so the branch is bounded even though no original heap address is
// reconstructible here. Shipped maps only reach it through attributes 0x0E,
// 0x0F and 0x8F, all at blend rate 0xcd.
// docs/research/HUNT_DIRECTION_UNASSIGNED_2026-09-10.json
// A bounded direction cone does not identify the actor's exact scratch words.
// Replay callers may supply captured words; normal play must not borrow a
// different encounter's heap address. The field owns graceful interruption.
export function steerNativeHuntDirection(before, attribute, scratchQ12=null) {
  if (!Number.isInteger(attribute) || attribute < 0 || attribute > 255) throw new TypeError("NATIVE_DIRECTION_BYTE_REQUIRED");
  const target2 = DIRECTIONS[attribute & 15];
  return steerNativeHuntDirectionCell(before, {
    ...(target2?{targetQ12:[...target2,0]}:{unknownDirection:attribute&15,scratchQ12}),
    blendQ12:attribute & 0x20 ? Q12 : attribute & 0x40 ? 0x59a : 0xcd });
}

// Production readers expose consumed steering fields, not raw ESC bytes.
export function steerNativeHuntDirectionCell(before, cell) {
  const direction = vector(before);
  if(cell?.unknownDirection!==undefined&&!cell.scratchQ12)throw Error('NATIVE_DIRECTION_UNASSIGNED_BRANCH_REQUIRES_TRACE');
  const target = cell?.unknownDirection !== undefined
    ? [...vector(cell.scratchQ12).slice(0,2),0] : vector(cell?.targetQ12);
  const rate = cell.blendQ12;
  if (![Q12,0x59a,0xcd].includes(rate)) throw Error("NATIVE_DIRECTION_BLEND_REQUIRED");
  if (rate === Q12) return freeze(target);
  return freeze(direction.map((n, i) => s32(n + mulQ12(s32(target[i] - n), rate))));
}

export function stepNativeHuntMovement(state, mode, environment) {
  if (![0, 1, 2, 3].includes(mode)) throw new TypeError("NATIVE_MOVEMENT_MODE_REQUIRED");
  if ((state.followFlag !== 0 || state.followTarget !== 0) && typeof environment?.resolveFollow !== "function") {
    throw new Error("NATIVE_FOLLOW_MOVEMENT_REQUIRES_TRACE");
  }
  for (const name of ["readTerrain", "queryControllers"]) {
    if (typeof environment?.[name] !== "function") throw new TypeError(`NATIVE_MOVEMENT_${name}_PORT_REQUIRED`);
  }
  if (typeof environment?.readDirectionCell !== "function" && typeof environment?.readAttribute !== "function") {
    throw new TypeError("NATIVE_MOVEMENT_readAttribute_PORT_REQUIRED");
  }
  if (!Number.isInteger(environment.width) || environment.width <= 0
    || !Number.isInteger(environment.height) || environment.height <= 0) throw new TypeError("NATIVE_MOVEMENT_BOUNDS_REQUIRED");
  const position = vector(state.positionQ12);
  let destination = vector(state.destinationQ12);
  let direction = vector(state.directionQ12);
  if (!Number.isInteger(state.speedQ12) || state.speedQ12 < 0 || state.speedQ12 > 0x7fffffff
    || ![0, 1].includes(state.pull13)) throw new TypeError("NATIVE_MOVEMENT_SPEED_AND_PULL_REQUIRED");
  let attribute = null;
  if (mode === 3) {
    if (environment.readDirectionCell) {
      direction = [...steerNativeHuntDirectionCell(direction, environment.readDirectionCell(...nativeMovementTile(position)))];
    } else {
      attribute = environment.readAttribute(...nativeMovementTile(position));
      direction = [...steerNativeHuntDirection(direction, attribute)];
    }
  } else if (state.followFlag || state.followTarget) {
    const follow = environment.resolveFollow(state, mode);
    destination = vector(follow.destinationQ12);
    direction = vector(follow.directionQ12);
    state = { ...state, ...follow };
  } else direction = destination.map((n, i) => s32(n - position[i]));
  if (direction.some((n) => n !== 0)) direction = nativeNormalizeQ12(direction);
  const delta = [...direction];
  for (let i = 0; i < 2; i++) {
    delta[i] = mode === 2 ? mulQ12(direction[i], 3 * Q12) : s32(mulQ12(direction[i], state.speedQ12) * (mode === 0 ? 1 : 2));
    if (mode === 0 && (state.drowsy || state.poisoned)) delta[i] = Math.trunc(delta[i] / 3) || 0;
    if (mode !== 2 && state.pull13 === 1) delta[i] = Math.trunc(delta[i] / 2) || 0;
  }
  const candidate = position.map((n, i) => s32(n + delta[i]));
  const tile = nativeMovementTile(candidate);
  const terrain = environment.readTerrain(...tile);
  if (!Number.isInteger(terrain) || terrain < 0 || terrain > 4) throw new TypeError("NATIVE_TERRAIN_TYPE_REQUIRED");
  const controllers = environment.queryControllers(freeze([...candidate]));
  // 0210EAD0 / 0210EEF8 / 0210EF28 include tool/trap side effects. The bounded
  // port requires explicit results and refuses unclosed side effects.
  if (![0,1,2,3].includes(controllers?.obstacle) || typeof controllers.secondaryBlocked !== 'boolean'
    || controllers.sideEffectsClosed !== true) throw new Error("NATIVE_MOVEMENT_CONTROLLER_BRANCH_REQUIRES_TRACE");
  const next = { ...state, directionQ12: freeze(direction), destinationQ12: freeze(destination),
    positionQ12: freeze(candidate), facing: mode === 2 ? state.facing : delta[0] < 0 ? 0 : 1,
    terrainPose: ({ 0: 7, 2: 18, 3: 28 })[terrain] ?? state.terrainPose };
  if (tile[0] < 0 || tile[1] < 0 || tile[0] >= environment.width || tile[1] >= environment.height) {
    next.positionQ12 = freeze([-0x40000, -0x40000, 0]);
    next.actorActive = 0; next.wildActive = 0;
  } else if(controllers.obstacle!==0){
    next.positionQ12=freeze(position);
    if(controllers.destinationQ12)next.destinationQ12=freeze(vector(controllers.destinationQ12));
  } else if (terrain === 1 || controllers.secondaryBlocked) {
    next.positionQ12 = freeze(position); next.destinationQ12 = freeze([...position]);
    next.followTarget=0;next.followTicks=0;
  }
  // Distance/sound accumulator is handled independently of position acceptance.
  // Camera coordinates are original whole pixels, not a browser viewport.
  if (!Array.isArray(environment.camera) || environment.camera.length !== 2
    || environment.camera.some((n) => !Number.isInteger(n))) throw new TypeError("NATIVE_MOVEMENT_CAMERA_REQUIRED");
  let distance = state.distanceAccumulatorQ12;
  if (!Number.isInteger(distance) || distance < 0 || distance > 0x7fffffff) throw new TypeError("NATIVE_MOVEMENT_DISTANCE_REQUIRED");
  const relative = candidate.slice(0, 2).map((n, i) => n - environment.camera[i] * Q12);
  let footstep = false;
  if (relative[0] > -0x50000 && relative[0] < 0x150000 && relative[1] > -0x50000 && relative[1] < 0x110000) {
    distance = s32(distance + nativeVectorLengthQ12(delta));
    if (distance > 0xC000) { distance = 0; footstep = true; }
  }
  next.distanceAccumulatorQ12 = distance;
  return freeze({ state: freeze(next), deltaQ12: freeze(delta), candidateQ12: freeze(candidate),
    tile: freeze(tile), attribute, terrain, footstep, forcedAi:controllers.nextAi??null });
}
