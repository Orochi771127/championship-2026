import { showChoiceDialog } from './uiDialog.js';
import { uiText } from '../text/uiText.js';

// Presentation only. The existing intent owns validation, atomic save and debit.
export function createRanchRowPurchasePrompt({ source, ask = showChoiceDialog, restoreFocus = () => {} }) {
  const controller = new AbortController();
  let pending = false;
  const current = () => source.getFrame();
  const lockedCount = (cage, row) => cage?.slots?.filter(slot => slot.row === row && !slot.unlocked).length ?? 0;
  return {
    async open(row) {
      const frame = current(), cage = frame?.cageEdit;
      if (pending || controller.signal.aborted || frame?.screen !== 'CAGE_EDIT' || ![2, 3, 4].includes(row)) return;
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
