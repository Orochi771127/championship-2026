// Owner-approved presentation geography, not a reconstruction of ROM geography.
// Each canonical biome owns its surface, landmark recipe and marker anchor.
// Neighbouring footprints join into authored landmasses; their inland centres leave
// room for the marker even where a region has pools, channels or a coastline.
export const GATE_WORLD_RADIUS = 2.08;

const definitions = {
  Canyon:  [-164, -25, 0xb17651, 0xd69e6a, 'terraces'],
  Crag:    [-162,  15, 0xa7a08e, 0xbfb8a6, 'crags'],
  Damp:    [  12, -14, 0x64774b, 0x8c9860, 'wetland'],
  Desert:  [  94,  34, 0xcba25f, 0xe5c382, 'dunes'],
  Factory: [ -78,  16, 0x737d7e, 0xa2a79b, 'works'],
  Forest:  [ -30,  34, 0x497d43, 0x82a85c, 'woodland'],
  Grass:   [   4,  24, 0x8cae64, 0xb0c67c, 'meadow'],
  Ice:     [ 168,  52, 0xc9e0df, 0xeaf3e8, 'icebergs'],
  Jungle:  [ -24, -15, 0x376f46, 0x66944e, 'canopy'],
  Mine:    [-113,  29, 0x777266, 0x9a8a70, 'quarry'],
  Oasis:   [  94,  -7, 0xc7b48a, 0xded0a7, 'spring'],
  Ruins:   [-114, -15, 0x8f9670, 0xb6b18b, 'columns'],
  Savanna: [  56,  22, 0xa5ad62, 0xc5ba80, 'acacias'],
  Seaside: [  53, -20, 0xc7b68a, 0xe2d4a4, 'shore'],
  Sewer:   [ -78, -24, 0x657572, 0x93998a, 'channels'],
  Volcano: [ 157, -23, 0x696462, 0x938575, 'caldera']
};

export const GATE_WORLD_REGIONS = Object.freeze(Object.entries(definitions).map(([biomeId, def]) => {
  const [longitude, latitude, ground, accent, landmark] = def;
  const lon = longitude * Math.PI / 180, lat = latitude * Math.PI / 180;
  const direction = Object.freeze([Math.sin(lon) * Math.cos(lat), Math.sin(lat), Math.cos(lon) * Math.cos(lat)]);
  const east = Object.freeze([Math.cos(lon), 0, -Math.sin(lon)]);
  const north = Object.freeze([-Math.sin(lon) * Math.sin(lat), Math.cos(lat), -Math.cos(lon) * Math.sin(lat)]);
  return Object.freeze({ biomeId, longitude, latitude, ground, accent, landmark, direction, east, north });
}));
const regionsByBiome = new Map(GATE_WORLD_REGIONS.map(region => [region.biomeId, region]));
export function gateWorldRegion(biomeId) { return regionsByBiome.get(biomeId) ?? null; }
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function mixColor(a, b, amount) {
  return [16, 8, 0].reduce((hex, shift) => hex | (Math.round(((a >> shift) & 255) * (1 - amount) + ((b >> shift) & 255) * amount) << shift), 0);
}

export function gateWorldPoint(region, east = 0, north = 0) {
  const point = region.direction.map((value, i) => value + region.east[i] * east + region.north[i] * north);
  const length = Math.hypot(...point);
  return point.map(value => value / length);
}

// A shared, smoothly joined coastline replaces sixteen isolated round stamps.
// Region ownership is still the closest authored footprint: anchors never move.
const smoothstep = (low, high, value) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};
function smoothMinimum(a, b, width) {
  const h = Math.max(width - Math.abs(a - b), 0) / width;
  return Math.min(a, b) - h * h * width * 0.25;
}

export function sampleGateWorld(point) {
  let nearest = null, runnerUp = null, distance = Infinity, secondDistance = Infinity;
  let coastField = 2, x = 0, y = 0;
  // World-space contours are continuous across region and longitude seams.
  const contour = 0.065 * Math.sin(point[0] * 13 + point[1] * 7)
    + 0.045 * Math.sin(point[2] * 17 - point[1] * 11)
    + 0.025 * Math.cos(point[0] * 29 + point[2] * 19);
  for (const region of GATE_WORLD_REGIONS) {
    const facing = dot(point, region.direction);
    if (facing <= 0) continue;
    const angle = Math.acos(Math.min(1, facing));
    const scale = angle < 0.00001 ? 1 : angle / Math.sin(angle);
    const localX = dot(point, region.east) * scale;
    const localY = dot(point, region.north) * scale;
    const tilt = Math.sin(region.longitude * Math.PI / 90) * 0.35;
    const u = localX * Math.cos(tilt) - localY * Math.sin(tilt);
    const v = localX * Math.sin(tilt) + localY * Math.cos(tilt);
    const width = 0.50 + 0.055 * Math.sin(region.latitude * Math.PI / 45);
    const score = Math.hypot(u / width, v / 0.43);
    coastField = smoothMinimum(coastField, score + contour, 0.30);
    if (score < distance) {
      runnerUp = nearest; secondDistance = distance;
      nearest = region; distance = score; x = localX; y = localY;
    } else if (score < secondDistance) { runnerUp = region; secondDistance = score; }
  }
  const coastDistance = 1 - coastField;
  const deepOcean = 0x214f68, shelfOcean = 0x397a88;
  if (!nearest || coastDistance <= 0) {
    const shelf = smoothstep(-0.18, 0, coastDistance);
    return { biomeId: null, radius: GATE_WORLD_RADIUS, color: mixColor(deepOcean, shelfOcean, shelf * 0.72), coastDistance: 0 };
  }
  // Soft ecotones keep distinct biome centres without hard polygon patches.
  const grain = Math.sin(point[0] * 21 + Math.sin(point[2] * 13)) * Math.cos(point[1] * 19);
  let color = mixColor(nearest.ground, nearest.accent, 0.16 + grain * 0.07);
  if (runnerUp) {
    const blend = (1 - smoothstep(0, 0.28, secondDistance - distance)) * 0.5;
    color = mixColor(color, mixColor(runnerUp.ground, runnerUp.accent, 0.16 + grain * 0.07), blend);
  }
  const beach = nearest.biomeId === 'Ice' ? 0xc1dcdb : 0xb8b493;
  color = mixColor(beach, color, smoothstep(0, 0.11, coastDistance));
  if (nearest.biomeId === 'Damp') {
    const wetness = Math.sin(x * 23 + Math.sin(y * 11) * 1.7) + Math.sin(y * 31 + x * 7) * 0.45;
    const pools = smoothstep(0.85, 1.3, wetness);
    color = mixColor(color, 0x496f65, pools * 0.65);
  }
  if (nearest.biomeId === 'Oasis') {
    const pool = 1 - smoothstep(0.075, 0.115, Math.hypot(x - 0.18, (y - 0.11) * 1.4));
    color = mixColor(color, 0x4c929c, pool);
  }
  // The bay, channels and landmarks remain in their existing owning biome.
  if (nearest.biomeId === 'Seaside') {
    const bay = smoothstep(0.10, 0.15, x - Math.sin(y * 18) * 0.02) * (1 - smoothstep(0.01, 0.06, y));
    color = mixColor(color, shelfOcean, bay);
  }
  if (nearest.biomeId === 'Sewer') {
    const channel = 1 - smoothstep(0.022, 0.045, Math.min(Math.abs(x + 0.13), Math.abs(y - 0.13)));
    color = mixColor(color, 0x426f68, channel * 0.75);
  }
  if (nearest.biomeId === 'Volcano') {
    const craterDistance = Math.hypot(x + 0.12, y - 0.12);
    const fissures = Math.cos(Math.atan2(y - 0.12, x + 0.12) * 3 + craterDistance * 9);
    const lava = smoothstep(0.96, 1, fissures) * (1 - smoothstep(0.18, 0.35, craterDistance));
    color = mixColor(color, 0xa86643, lava * 0.55);
  }
  const elevation = smoothstep(0, 0.20, coastDistance) * (0.035 + (grain + 1) * 0.005);
  return { biomeId: nearest.biomeId, radius: GATE_WORLD_RADIUS + elevation, color, coastDistance };
}
