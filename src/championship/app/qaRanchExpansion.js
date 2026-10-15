// Explicit QA tooling only. Never imported by the normal game entrypoint.
import { CHAMPIONSHIP_MODERN_SAVE_KEY, deserializeChampionshipModernSave,
  serializeChampionshipModernSave } from './championshipStandaloneSave.js';
import { slotCountForTamerRank } from '../cage/cageCatalog.js';
import { NATIVE_RANCH_LAYOUT, RANCH_DECKS_LAYOUT, prototypeRanchExpansion,
  validateRanchLayout } from '../cage/ranchExpansion.js';

/** Preserve every existing save field except the two annex entitlement fields. */
export function createQaRanchExpansionText(previous) {
  deserializeChampionshipModernSave(previous);
  const save = JSON.parse(previous);
  const cage = save.cageEdit;
  if (![NATIVE_RANCH_LAYOUT, RANCH_DECKS_LAYOUT].includes(cage?.layoutVersion)) {
    throw Error('此存檔不是目前的原生牧場格式；未變更進度。');
  }
  const mainUnlocked = slotCountForTamerRank(save.progression.tamerRank);
  if (!validateRanchLayout(cage.placements, { ...cage, mainUnlocked })) {
    throw Error('目前牧場配置無法驗證；未變更進度。');
  }
  if (cage.layoutVersion === RANCH_DECKS_LAYOUT) return previous;
  save.cageEdit = { ...cage, layoutVersion: RANCH_DECKS_LAYOUT, expansion: prototypeRanchExpansion() };
  if (!validateRanchLayout(save.cageEdit.placements, { ...save.cageEdit, mainUnlocked })) {
    throw Error('擴充後配置無法驗證；未變更進度。');
  }
  return serializeChampionshipModernSave(save);
}

/** Caller holds the existing save lock. Backup must succeed before the write. */
export async function applyQaRanchExpansion(storage, backup) {
  const previous = storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY);
  if (!previous) throw Error('目前沒有存檔，請先建立或安裝 QA 存檔。');
  const next = createQaRanchExpansionText(previous);
  if (next === previous) return { changed: false };
  await backup(previous);
  // Do not overwrite progress changed while preparing the backup.
  if (storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY) !== previous) {
    throw Error('存檔已被其他分頁更新，請關閉遊戲分頁後再試；未套用擴充。');
  }
  // Web Storage setItem is atomic: quota/security failure leaves the old value.
  storage.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, next);
  if (storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY) !== next) {
    throw Error('無法確認瀏覽器已保存擴充，請保留備份；未確認套用成功。');
  }
  return { changed: true };
}
