// The Raising Home's arcade evolution (Owner direction 2026-10-28).
//
// main.js loads this with the Raising view and hands it over as the view's
// `evolutionCinematic`. While the native evolution runs, start() lays the
// CyberMorphEvolutionRunner over the screen in live mode: the native phase
// clock still owns the form write (the view asks the app to play it 2x, or
// faster on a tap), and the real persistent stat change arrives through
// setStats once the form has been written. The classic theme keeps the
// original sequence, and so does a partner that disappears (target < 0).
//
// The stage label and the new special come from the Database catalogs, which
// carry the full move table; they load only when an evolution actually starts
// and fill the plate and badge in place, so Raising Home never pays for them.
import { generationName, speciesName } from "../../text/zhHant.js";
import { juicyText } from "../../text/juicyShowcaseText.js";
import { openingEggChoices } from "../../app/openingEggChoices.js";
import { juicyPortrait, juicyPresentationEnabled, juicySignatureMove } from "./juicyArt.js";
import { playCyberMorphEvolution } from "./cyberMorphEvolutionRunner.js";

export function createRaisingEvolutionCinematic({ doc = globalThis.document, loadDetails = () => Promise.all([
  import("../../database/databaseDisplayCatalog.js"), import("../../database/databaseStories.js")]) } = {}) {
  return Object.freeze({
    enabled: () => juicyPresentationEnabled(doc),
    /** Returns a handle { instanceId, setStats(stats), dispose() }, or null to keep the original. */
    start({ host, instanceId, fromSpecies, toSpecies, fromName = "", onSpeed = null, onDone = null }) {
      if (!host || !Number.isSafeInteger(fromSpecies) || !Number.isSafeInteger(toSpecies) || toSpecies < 0) return null;
      // A target below 8 is an egg: the rebirth plays as "back to an egg".
      const revert = toSpecies < 8;
      const egg = revert ? openingEggChoices().find(choice => choice.speciesIndex === toSpecies) : null;
      // The moment takes the whole screen (HUD included), as the original did.
      const run = playCyberMorphEvolution({ host: doc.body ?? host, doc, mode: "live", fullscreen: true, revert, onSpeed, onDone,
        from: { name: fromName || speciesName(fromSpecies), portrait: juicyPortrait(fromSpecies) },
        to: { name: revert ? (egg?.formalName ?? speciesName(toSpecies)) : speciesName(toSpecies), stageLabel: "",
          portrait: revert ? (egg ? { src: egg.src } : null) : juicyPortrait(toSpecies) } });
      if (!revert) {
        void Promise.resolve().then(loadDetails).then(([display, stories]) => {
          const stage = display.getDatabaseDisplayEntry(toSpecies)?.numberingStageIndex;
          const special = juicySignatureMove(stories.databaseVerifiedData(toSpecies)?.moves);
          run.setDetails({ stageLabel: Number.isInteger(stage) ? generationName(stage) : null, special: special ? { name: special.name } : null });
        }).catch(() => { /* the plate keeps the name alone */ });
      }
      return {
        instanceId,
        setStats: stats => run.setStats(Array.isArray(stats)
          ? stats.map(stat => ({ label: juicyText(`stat.${stat.key}`), before: stat.before, after: stat.after })) : null),
        dispose: () => run.dispose(),
        run
      };
    }
  });
}
