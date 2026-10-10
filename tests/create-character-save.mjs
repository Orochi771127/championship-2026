import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createSaveForSpecies(speciesIndex, displayName) {
  const baseSave = fs.readFileSync(path.join(__dirname, 'm301-test-save.json'), 'utf-8');
  const doc = JSON.parse(baseSave);

  const speciesId = `species-${String(speciesIndex).padStart(3, '0')}`;
  doc.creature.speciesId = speciesId;
  doc.creature.displayName = displayName;
  doc.creature.nativeProfile.name = displayName;
  doc.creature.nativeProfile.fields['000'] = speciesIndex;
  doc.creature.nativeProfile.fields['008'] = speciesIndex;
  doc.progression.registeredSpecies = [speciesIndex];

  return JSON.stringify(doc);
}

if (process.argv[2]) {
  const idx = parseInt(process.argv[2], 10);
  const name = process.argv[3] || 'TEST';
  const outPath = process.argv[4] || path.join(__dirname, `test-save-${idx}.json`);
  fs.writeFileSync(outPath, createSaveForSpecies(idx, name), 'utf-8');
  console.log(`Saved to ${outPath}`);
}
