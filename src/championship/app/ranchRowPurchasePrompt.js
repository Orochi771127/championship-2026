import { showChoiceDialog } from './uiDialog.js';
import { uiText } from '../text/uiText.js';
import { landExpansionPrice } from '../gacha/diamondRewards.js';

// Presentation only. The existing intent owns validation, atomic save and debit.
export function createRanchRowPurchasePrompt({ source, ask = showChoiceDialog, restoreFocus = () => {} }) {
  const controller = new AbortController();
  let pending = false;
  const current = () => source.getFrame();
  // Hex cage world: land rows are a capacity list; older frames counted locked board cells.
  const lockedCount = (cage, row) => cage?.productGrid?.landRows
    ? cage.productGrid.landRows.find(entry => entry.row === row)?.cells ?? 0
    : cage?.slots?.filter(slot => slot.row === row && !slot.unlocked).length ?? 0;
  return {
    async open(row) {
      const frame = current(), cage = frame?.cageEdit;
      if (pending || controller.signal.aborted || frame?.screen !== 'CAGE_EDIT' || !Number.isInteger(row) || row < 2 || row >= (cage?.productGrid?.rows ?? 5)) return;
      const count = lockedCount(cage, row);
      if (!count) return;
      pending = true;
      try {
        // Owner 2026-11-03: the step's own price (200 → 2,200), quoted from the frame the app recomputes on buy.
        const price = cage.land?.price || landExpansionPrice(cage.landCapacity) || 1000;
        const affordable = (cage.testDiamonds ?? 0) >= price;
        const choice = await ask({
          title: uiText('CAGE_TEST_ROW_TITLE', { row: row + 1 }),
          message: [uiText('CAGE_TEST_ROW_DETAILS', { count, price: price.toLocaleString('en-US') }),
            // DIAMOND_ECONOMY_20261102: what the land becomes and what else grows with it.
            ...(cage.land ? [uiText('可用土地 {before} → {after} 格', { before: cage.land.capacity, after: Math.min(cage.land.cap, cage.land.capacity + count) }),
              uiText('每擴充一階，狩獵記憶卡容量 +{g} G。', { g: 8 })] : []),
            uiText('CAGE_TEST_DIAMOND_BALANCE', { amount: cage.testDiamonds ?? 0 }),
            ...(!affordable ? [uiText('CAGE_TEST_DIAMONDS_INSUFFICIENT')] : [])].join('\n\n'),
          actions: [
            { id: 'cancel', label: uiText('CAGE_TEST_ROW_CANCEL'), tone: 'secondary' },
            { id: 'buy', label: uiText('CAGE_TEST_ROW_BUY'), tone: 'primary', disabled: !affordable }
          ],
          variant: 'ranch-row-purchase', cancelId: 'cancel', focusId: 'cancel', signal: controller.signal
        });
        const latest = current();
        if (choice !== 'buy' || !affordable || controller.signal.aborted || latest?.screen !== 'CAGE_EDIT' || !lockedCount(latest.cageEdit, row)) return;
        // Re-read current state via the authoritative intent, never a cached quote.
        source.intents.buyRanchTestRow?.(row);
      } finally {
        pending = false;
        if (!controller.signal.aborted) restoreFocus(row);
      }
    },
    dispose() { controller.abort(); }
  };
}
