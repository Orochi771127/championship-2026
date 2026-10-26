import { showChoiceDialog } from './uiDialog.js';
import { uiText } from '../text/uiText.js';

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
        const affordable = (cage.testDiamonds ?? 0) >= 1000;
        const choice = await ask({
          title: uiText('CAGE_TEST_ROW_TITLE', { row: row + 1 }),
          message: [uiText('CAGE_TEST_ROW_DETAILS', { count, price: 1000 }),
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
