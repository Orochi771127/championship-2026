import { originalShopCageThumbnail } from './originalShopCageArt.js';
// Presentation of the existing production fields and traced editor coordinates.
// The editor's slot ownership is authoritative; no geometry here places a cage.
// The runtime cage fields (Owner 2026-10-06: original opus art replaces the licensed pixels).
import manifest from '../../../assets/production/cage/original-opus-v1/manifest.json' with { type: 'json' };
import { getCageDefinitionByModuleId, listCageDefinitions } from '../cage/cageCatalog.js';
import { productGridCell } from '../cage/productRanchGrid.js';
import { ranchBoardCell } from '../cage/ranchSlotGeometry.js';
import { RANCH_EXPANSION_FIRST_SLOT, isAnnexSlot } from '../cage/ranchExpansion.js';
import { getOriginalCageVisualBinding, ORIGINAL_CAGE_STRUCTURAL_VISUALS } from './originalCageVisualBindings.js';
import { validateRuntimeMapArtBundle } from './runtimeMapArtBundle.js';
import { cageName } from '../text/zhHant.js';
import { uiText } from '../text/uiText.js';

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
  // Each part is resolved on its own, so a translation never has to match
  // the joined line.
  const parts = channels.map(channel=>channelNames[channel.id]).filter(Boolean).map((part)=>uiText(part));
  if (capacity !== null) parts.push(uiText('建議 {count} 隻', { count: capacity }));
  return parts.join(' · ') || uiText('固定待機區');
}
function runtimeFieldFrame(definition) {
  const binding = getOriginalCageVisualBinding(definition?.cageDefinitionIndex);
  return art.fields.find((field) => field.fieldId === binding?.fieldId)?.frames[0]?.src ?? null;
}
/** The blue Lid that covers a bay nothing is built on (the ranch draws the same art). */
export function cageUiLidImage() {
  const lid = ORIGINAL_CAGE_STRUCTURAL_VISUALS.find((entry) => entry.role === 'LID')?.fieldId;
  return art.fields.find((field) => field.fieldId === lid)?.frames[0]?.src ?? null;
}
export function cageUiImage(moduleId, baseUrl) {
  // The runtime field picture comes first, so the editor shows the same cage art as the ranch.
  const definition = getCageDefinitionByModuleId(moduleId);
  return runtimeFieldFrame(definition);
}
export function shopCageUiImage(shopRecordIndex, baseUrl) {
  const original = originalShopCageThumbnail(shopRecordIndex, baseUrl);
  if (original) return original.src;
  const definition = listCageDefinitions().find((entry) => entry.shopRecordIndex === shopRecordIndex);
  return definition ? cageUiImage(definition.moduleId, baseUrl) : null;
}
export function cageEditorArtCells(slots, baseUrl, { productGrid = false } = {}) {
  // An expansion annex slot (20..29) is drawn on its own board with the same
  // traced cell arithmetic as the main board, from its deck-local index.
  const cells = slots.map((slot) => {
    if (productGrid) {
      const cell = productGridCell(slot.slotIndex);
      // This function uses half-size editor coordinates before its final ×2.
      return { ...slot, x: 2 + cell.x / 4, y: 8 + cell.y / 4, deck: 0 };
    }
    const annex = isAnnexSlot(slot.slotIndex);
    const cell = ranchBoardCell(annex ? slot.slotIndex - RANCH_EXPANSION_FIRST_SLOT : slot.slotIndex);
    return { ...slot, ...cell, slotIndex: slot.slotIndex, deck: annex ? 1 : 0 };
  });
  return cells.map((cell) => {
    const peers = cell.moduleId ? cells.filter((other) => other.moduleId === cell.moduleId && other.deck === cell.deck) : [cell];
    const left = Math.min(...peers.map((entry) => entry.x));
    const top = Math.min(...peers.map((entry) => entry.y));
    const width = (Math.max(...peers.map((entry) => entry.x)) - left + 24) * 2;
    const height = (Math.max(...peers.map((entry) => entry.y)) - top + 28) * 2;
    const definition = getCageDefinitionByModuleId(cell.moduleId);
    const image = cageUiImage(cell.moduleId, baseUrl);
    const field = art.fields.find(field=>field.frames[0]?.src === image);
    const sourceWidth = field?.worldWidthPx ?? width;
    const sourceHeight = field?.worldHeightPx ?? height;
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    const imageWidth = sourceWidth * scale;
    const imageHeight = sourceHeight * scale;
    return { slotIndex: cell.slotIndex, deck: cell.deck, x: cell.x * 2, y: (cell.y - 8) * 2,
      image, imageWidth, imageHeight,
      imageX: (left - cell.x) * 2 + (width-imageWidth)/2,
      imageY: (top - cell.y) * 2 + (height-imageHeight)/2 };
  });
}
