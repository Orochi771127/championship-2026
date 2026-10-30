// Dex height and weight (Owner 2026-10-30): a height in metres and a "weight" written as a
// digital-world data size -- flavour data only, sized from each partner's drawn body
// (database-body-stats.v1.json; method recorded there).
import table from '../../data/championship/database-body-stats.v1.json' with {type:'json'};

const rows = new Map(table.rows.map(([speciesIndex, heightCm, weightKb]) => [speciesIndex, Object.freeze({heightCm, weightKb})]));
export function databaseBodyStats(speciesIndex) { return rows.get(speciesIndex) ?? null; }
export function formatBodyHeight(heightCm) {
  const metres = heightCm / 100;
  return `${metres < 1 ? metres.toFixed(2) : metres.toFixed(1)} m`;
}
export function formatDataWeight(weightKb) {
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = weightKb, unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value >= 100 ? Math.round(value) : value.toPrecision(3)} ${units[unit]}`;
}
