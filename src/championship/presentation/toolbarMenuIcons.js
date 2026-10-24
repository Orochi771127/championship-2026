import manifest from '../../data/championship/toolbar-menu-icons.runtime.r1.json' with { type: 'json' };
import { originalDatabaseIcon } from './completedOriginalUi20261007.js';

const byEntryId = new Map(manifest.entries.map(art => [art.entryId, Object.freeze(art)]));

// Preserve the approved Database/Medals images. Action-only entries have no
// screen, so their original lightweight vector icons bind by entry.id.
export function toolbarMenuEntryIcon(entry, baseUrl) {
  return originalDatabaseIcon(entry.screen, baseUrl) ?? byEntryId.get(entry.id) ?? null;
}
