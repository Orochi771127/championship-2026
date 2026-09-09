// Presentation of the existing production fields and traced editor coordinates.
// The editor's slot ownership is authoritative; no geometry here places a cage.
import manifest from '../../../assets/production/cage/licensed-runtime-v1/manifest.json' with { type: 'json' };
import { getCageDefinitionByModuleId, listCageDefinitions } from '../cage/cageCatalog.js';
import { ranchBoardCell } from '../cage/ranchSlotGeometry.js';
import { getOriginalCageVisualBinding } from './originalCageVisualBindings.js';
import { validateRuntimeMapArtBundle } from './runtimeMapArtBundle.js';
import { cageName } from '../text/zhHant.js';

const art = validateRuntimeMapArtBundle(manifest);
export function cageUiName(moduleId, fallback = '') {
  const definition = getCageDefinitionByModuleId(moduleId);
  return cageName(definition?.cageDefinitionIndex, fallback);
}
export function shopCageUiName(shopRecordIndex, fallback) {
  const definition = listCageDefinitions().find((entry) => entry.shopRecordIndex === shopRecordIndex);
  return cageName(definition?.cageDefinitionIndex, fallback);
}
const channelNames = { DEFENSE:'防禦上升', HP:'生命值上升', TP:'技力上升', ATTACK:'攻擊上升', SPEED:'速度上升', WISDOM:'智力上升', RECOVER_HP_STRESS:'回復生命值與壓力', AUTO_CARE:'自動餵食與清潔', BATTLE_COUNT:'對戰次數上升', FAMILY_DATA:'資料屬性上升', FAMILY_DRAGON:'龍屬性上升', FAMILY_BEAST:'獸屬性上升', FAMILY_WATER:'水棲屬性上升', FAMILY_BIRD:'鳥屬性上升', FAMILY_INSECT_PLANT:'蟲草屬性上升', FAMILY_DARK:'暗黑屬性上升', FAMILY_MACHINE:'機械屬性上升', FAMILY_VACCINE:'疫苗屬性上升', FAMILY_HOLY:'聖屬性上升', FAMILY_VIRUS:'病毒屬性上升', RESIST_LIGHT:'光耐性上升', RESIST_HEAT:'熱耐性上升', RESIST_COLD:'冷耐性上升', RESIST_THUNDER:'雷耐性上升', RESIST_DARK:'闇耐性上升' };
export function cageUiSummary(moduleId, fallback = '') {
  const definition = getCageDefinitionByModuleId(moduleId);
  if (!definition) return fallback;
  const {channels, capacity} = definition.training;
  const parts = channels.map(channel=>channelNames[channel.id]).filter(Boolean);
  if (capacity !== null) parts.push(`建議 ${capacity} 隻`);
  return parts.join(' · ') || '固定待機區';
}
export function cageUiImage(moduleId) {
  const definition = getCageDefinitionByModuleId(moduleId);
  const binding = getOriginalCageVisualBinding(definition?.cageDefinitionIndex);
  return art.fields.find((field) => field.fieldId === binding?.fieldId)?.frames[0]?.src ?? null;
}
export function shopCageUiImage(shopRecordIndex) {
  const definition = listCageDefinitions().find((entry) => entry.shopRecordIndex === shopRecordIndex);
  return definition ? cageUiImage(definition.moduleId) : null;
}
export function cageEditorArtCells(slots) {
  const cells = slots.map((slot) => ({ ...slot, ...ranchBoardCell(slot.slotIndex) }));
  return cells.map((cell) => {
    const peers = cell.moduleId ? cells.filter((other) => other.moduleId === cell.moduleId) : [cell];
    const left = Math.min(...peers.map((entry) => entry.x));
    const top = Math.min(...peers.map((entry) => entry.y));
    const width = (Math.max(...peers.map((entry) => entry.x)) - left + 24) * 2;
    const height = (Math.max(...peers.map((entry) => entry.y)) - top + 28) * 2;
    const image = cageUiImage(cell.moduleId);
    const field = art.fields.find(field=>field.frames[0]?.src === image);
    const scale = field ? Math.min(width / field.worldWidthPx, height / field.worldHeightPx) : 1;
    const imageWidth = field ? field.worldWidthPx * scale : width;
    const imageHeight = field ? field.worldHeightPx * scale : height;
    return { slotIndex: cell.slotIndex, x: cell.x * 2, y: (cell.y - 8) * 2,
      image, imageWidth, imageHeight,
      imageX: (left - cell.x) * 2 + (width-imageWidth)/2,
      imageY: (top - cell.y) * 2 + (height-imageHeight)/2 };
  });
}
