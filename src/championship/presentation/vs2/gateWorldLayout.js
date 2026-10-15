// Owner-approved presentation geography, not a reconstruction of ROM geography.
// Each canonical biome owns its surface, landmark recipe and marker anchor.
// Neighbouring footprints join into four landmasses; their inland centres leave
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

export function sampleGateWorld(point) {
  let nearest = null, distance = Infinity, x = 0, y = 0;
  for (const region of GATE_WORLD_REGIONS) {
    const facing = dot(point, region.direction);
    if (facing <= 0) continue;
    const angle = Math.acos(Math.min(1, facing));
    const scale = angle < 0.00001 ? 1 : angle / Math.sin(angle);
    const localX = dot(point, region.east) * scale;
    const localY = dot(point, region.north) * scale;
    const bearing = Math.atan2(localY, localX);
    const coast = 1 + 0.07 * Math.cos(bearing * 3) + 0.04 * Math.sin(bearing * 5);
    const score = Math.hypot(localX / 0.49, localY / 0.47) / coast;
    if (score < distance) { nearest = region; distance = score; x = localX; y = localY; }
  }
  if (!nearest || distance >= 1) return { biomeId: null, radius: GATE_WORLD_RADIUS, color: 0x245d79, coastDistance: 0 };
  const coastDistance = 1 - distance;
  // Terrain detail is local to its owning biome, and never determines identity.
  let color = nearest.ground;
  const grain = Math.sin(x * 15 + Math.sin(y * 9)) * Math.cos(y * 13);
  color = mixColor(color, nearest.accent, (grain + 1) * 0.23);
  if (coastDistance < 0.08) color = nearest.biomeId === 'Ice' ? 0xb5d9dc : 0xb4b18b;
  if (nearest.biomeId === 'Damp' && Math.sin(x * 29) * Math.cos(y * 24) > 0.45) color = 0x466d64;
  if (nearest.biomeId === 'Oasis' && Math.hypot(x - 0.18, (y - 0.11) * 1.4) < 0.10) color = 0x4c9eaa;
  // A bay opens through Seaside's eastern/southern shore to the outer ocean;
  // its inland marker stays west of the beach, rather than floating in a pool.
  if (nearest.biomeId === 'Seaside' && x > 0.12 + Math.sin(y * 18) * 0.02 && y < 0.04) color = 0x4b9ba9;
  if (nearest.biomeId === 'Sewer' && (Math.abs(x + 0.13) < 0.035 || Math.abs(y - 0.13) < 0.035)) color = 0x3e7770;
  if (nearest.biomeId === 'Volcano' && Math.abs(Math.sin(x * 35 + y * 17)) > 0.96) color = 0xbc5b36;
  const elevation = Math.min(1, coastDistance * 8) * 0.045;
  return { biomeId: nearest.biomeId, radius: GATE_WORLD_RADIUS + elevation, color, coastDistance };
}
