// Read-only full-board scenarios for cage art review.
// Gameplay placement, footprints, cropping and wrapping remain owned by the
// production cage modules imported below.
import fs from 'node:fs';
import { listCageDefinitions } from '../../src/championship/cage/cageCatalog.js';
import {
  NATIVE_RANCH_LAYOUT,
  WAITING_ROOM_MODULE,
  validateNativeRanch
} from '../../src/championship/cage/nativeRanchLayout.js';
import { createRaisingCageArtPlan } from '../../src/championship/presentation/raisingCageArtPlan.js';
import {
  getOriginalCageVisualBinding,
  ORIGINAL_CAGE_STRUCTURAL_VISUALS
} from '../../src/championship/presentation/originalCageVisualBindings.js';

const PREFERRED_SLOTS = [10, 11, 8, 9, 12, 13, 6, 7, 14, 15, 4, 5, 16, 17, 18, 19];

export function cageFullLayoutReviewScenarios() {
  const manifest = JSON.parse(fs.readFileSync('assets/production/cage/licensed-runtime-v1/manifest.json', 'utf8'));
  const definitions = listCageDefinitions();
  const waiting = { moduleId: WAITING_ROOM_MODULE, slotIndex: 0 };
  const unlockedCount = 20;
  const scenarios = [];

  for (const definition of definitions.filter(entry => entry.cageDefinitionIndex < 35)) {
    const slotIndex = PREFERRED_SLOTS.find(slot => validateNativeRanch([
      waiting,
      { moduleId: definition.moduleId, slotIndex: slot }
    ], unlockedCount));
    if (!Number.isInteger(slotIndex)) throw new Error(`NO_REVIEW_SLOT:${definition.cageDefinitionIndex}`);
    const placements = [waiting, { moduleId: definition.moduleId, slotIndex }];
    scenarios.push({
      definitionIndex: definition.cageDefinitionIndex,
      fieldId: getOriginalCageVisualBinding(definition.cageDefinitionIndex).fieldId,
      slotIndex,
      unlockedCount,
      plan: createRaisingCageArtPlan({ manifest, placements, unlockedCount, layoutVersion: NATIVE_RANCH_LAYOUT })
    });
  }

  const waitingPlan = createRaisingCageArtPlan({
    manifest,
    placements: [waiting],
    unlockedCount,
    layoutVersion: NATIVE_RANCH_LAYOUT
  });
  scenarios.push({
    definitionIndex: 35,
    fieldId: getOriginalCageVisualBinding(35).fieldId,
    slotIndex: 0,
    unlockedCount,
    plan: waitingPlan
  });
  scenarios.push({
    definitionIndex: 36,
    fieldId: ORIGINAL_CAGE_STRUCTURAL_VISUALS.find(entry => entry.role === 'LID').fieldId,
    slotIndex: null,
    unlockedCount,
    plan: waitingPlan
  });

  return {
    schemaVersion: 1,
    authority: 'EXISTING_NATIVE_RANCH_VALIDATION_AND_ART_PLAN',
    scenarioCount: scenarios.length,
    scenarios
  };
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/cage-full-layout-review.mjs')) {
  console.log(JSON.stringify(cageFullLayoutReviewScenarios()));
}
