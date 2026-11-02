// Presentation of the existing production fields and traced editor coordinates.
// The editor's slot ownership is authoritative; no geometry here places a cage.
// The runtime cage fields (Owner 2026-10-06: original opus art replaces the licensed pixels).
import manifest from '../../../assets/production/public-runtime/cage-ui.map.v1.json' with { type: 'json' };
// Owner 2026-11-02: the shop and the facility editor show each cage as the ranch draws it.
// Renders of the 3D cage models (ranchThreeScene, layout view 52°, 4 px per native px,
// the field's own world rect), so a frame covers exactly the rect the old field art did.
import threeManifest from '../../../assets/production/public-runtime/cage-ui-three.v1.json' with { type: 'json' };
import { getCageDefinitionByModuleId, listCageDefinitions } from '../cage/cageCatalog.js';
import { PRODUCT_CAGE_CHANNEL_OVERRIDES } from '../cage/cageEffects.js';
import { productGridCell } from '../cage/productRanchGrid.js';
import { ranchBoardCell } from '../cage/ranchSlotGeometry.js';
import { RANCH_EXPANSION_FIRST_SLOT, isAnnexSlot } from '../cage/ranchExpansion.js';
import { getOriginalCageVisualBinding, ORIGINAL_CAGE_STRUCTURAL_VISUALS } from './originalCageVisualBindings.js';
import { validateRuntimeMapArtBundle } from './runtimeMapArtBundle.js';
import { cageName } from '../text/zhHant.js';
import { uiText } from '../text/uiText.js';

const art = validateRuntimeMapArtBundle(manifest);
const THREE_UI_DIR = 'assets/production/cage/ui-three-20261102/';
const imageRow = (row, width, height) => row && Object.keys(row).sort().join() === 'height,sha256,src,width'
  && typeof row.src === 'string' && row.src.startsWith(THREE_UI_DIR) && row.src.endsWith('.webp') && !row.src.includes('..')
  && /^[a-f0-9]{64}$/.test(row.sha256) && (width === undefined || (row.width === width && row.height === height));
/** The 3D cage UI renders, checked field by field against the runtime field sizes. */
export function validateCageThreeUi(candidate) {
  const fail = (reason) => { throw new Error('CAGE_THREE_UI_INVALID:' + reason); };
  if (candidate?.schemaVersion !== 1 || candidate.assetId !== 'art:cage:ui-three:20261102' || !Array.isArray(candidate.fields)) fail('SCHEMA');
  const seen = new Set();
  for (const row of candidate.fields) {
    const field = art.fields.find((entry) => entry.fieldId === row?.fieldId);
    if (!field || seen.has(row.fieldId) || !/^[a-f0-9]{64}$/.test(row.modelSha256)) fail('FIELD');
    if (!imageRow(row.frame, field.worldWidthPx, field.worldHeightPx) || !imageRow(row.thumbnail, 256, 192)) fail('IMAGE');
    seen.add(row.fieldId);
  }
  if (seen.size !== art.fields.length) fail('COUNT');
  return candidate;
}
const threeUi = new Map(validateCageThreeUi(threeManifest).fields.map((row) => [row.fieldId, row]));
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
  // DIAMOND_ECONOMY_20261102: the shop's zoo and ranch train the beast family instead of feeding and cleaning.
  const channels = PRODUCT_CAGE_CHANNEL_OVERRIDES[definition.cageDefinitionIndex] ?? definition.training.channels;
  const {capacity} = definition.training;
  // Each part is resolved on its own, so a translation never has to match
  // the joined line.
  const parts = channels.map(channel=>channelNames[channel.id]).filter(Boolean).map((part)=>uiText(part));
  if (capacity !== null) parts.push(uiText('建議 {count} 隻', { count: capacity }));
  return parts.join(' · ') || uiText('固定待機區');
}
const fieldIdOf = (definition) => getOriginalCageVisualBinding(definition?.cageDefinitionIndex)?.fieldId ?? null;
function runtimeFieldFrame(definition) {
  const fieldId = fieldIdOf(definition);
  return threeUi.get(fieldId)?.frame.src ?? art.fields.find((field) => field.fieldId === fieldId)?.frames[0]?.src ?? null;
}
/** The blue Lid that covers a bay nothing is built on (the ranch draws the same art). */
export function cageUiLidImage() {
  const lid = ORIGINAL_CAGE_STRUCTURAL_VISUALS.find((entry) => entry.role === 'LID')?.fieldId;
  return threeUi.get(lid)?.frame.src ?? art.fields.find((field) => field.fieldId === lid)?.frames[0]?.src ?? null;
}
/** The 256x192 card picture of a cage (the whole render, fitted and centred), or null. */
export function cageUiThumbnail(moduleId) {
  return threeUi.get(fieldIdOf(getCageDefinitionByModuleId(moduleId)))?.thumbnail.src ?? null;
}
export function cageUiImage(moduleId, baseUrl) {
  // The runtime field picture comes first, so the editor shows the same cage art as the ranch.
  const definition = getCageDefinitionByModuleId(moduleId);
  return runtimeFieldFrame(definition);
}
export function shopCageUiImage(shopRecordIndex, baseUrl) {
  const definition = listCageDefinitions().find((entry) => entry.shopRecordIndex === shopRecordIndex);
  const three = definition ? cageUiThumbnail(definition.moduleId) : null;
  return three ?? (definition ? cageUiImage(definition.moduleId, baseUrl) : null);
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
    const peers = cell.moduleId ? cells.filter((other) => (cell.instanceId?other.instanceId===cell.instanceId:other.moduleId===cell.moduleId) && other.deck === cell.deck) : [cell];
    const left = Math.min(...peers.map((entry) => entry.x));
    const top = Math.min(...peers.map((entry) => entry.y));
    const width = (Math.max(...peers.map((entry) => entry.x)) - left + 24) * 2;
    const height = (Math.max(...peers.map((entry) => entry.y)) - top + 28) * 2;
    const definition = getCageDefinitionByModuleId(cell.moduleId);
    const image = cageUiImage(cell.moduleId, baseUrl);
    const field = definition ? art.fields.find((entry) => entry.fieldId === fieldIdOf(definition)) : null;
    const sourceWidth = field?.worldWidthPx ?? width;
    const sourceHeight = field?.worldHeightPx ?? height;
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    // A 3D render covers exactly the world rect; older field art may carry padding.
    const padding=(threeUi.get(field?.fieldId)?.frame.src===image?null:field?.visualPaddingNative)??{};
    const unit=field?.nativePixelWorldScale??4;
    const padX=(padding.left??0)*unit,padY=(padding.top??0)*unit;
    const imageWidth = (sourceWidth+padX+(padding.right??0)*unit) * scale;
    const imageHeight = (sourceHeight+padY+(padding.bottom??0)*unit) * scale;
    return { slotIndex: cell.slotIndex, deck: cell.deck, x: cell.x * 2, y: (cell.y - 8) * 2,
      image, imageWidth, imageHeight,
      imageX: (left - cell.x) * 2 + (width-sourceWidth*scale)/2-padX*scale,
      imageY: (top - cell.y) * 2 + (height-sourceHeight*scale)/2-padY*scale };
  });
}
