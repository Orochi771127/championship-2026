// Documentation-only inventory. Reads existing metadata, never source pixels or ROM.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '../../../..');
const sources = new Map();
function read(relative) {
  const bytes = fs.readFileSync(path.join(root, relative));
  sources.set(relative, crypto.createHash('sha256').update(bytes).digest('hex'));
  return JSON.parse(bytes);
}
function csv(name, rows) {
  assert(rows.length > 0);
  const keys = Object.keys(rows[0]);
  const cell = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  fs.writeFileSync(path.join(out, name), [keys.map(cell).join(','), ...rows.map(r => keys.map(k => cell(r[k])).join(','))].join('\n') + '\n');
}
const base = 'docs/art/production/characters/appearance-refresh-v1';
const progress = read(`${base}/pixel-v2/setting-progress.json`);
const characters = [];
const actions = new Map();
const ids = fs.readdirSync(path.join(root, base, 'generated/entities')).filter(id => fs.existsSync(path.join(root, base, 'generated/entities', id, 'source-reuse.json'))).sort();
for (const id of ids) {
  const reuse = read(`${base}/generated/entities/${id}/source-reuse.json`);
  const motion = read(`${base}/generated/entities/${id}/motion-contract.json`);
  assert.equal(reuse.entityId, id);
  assert.equal(motion.entityId, id);
  const egg = id.startsWith('e');
  const main = motion.sides.main.sequences, sub = motion.sides.sub.sequences;
  assert.equal(main.length, egg ? 2 : 40);
  assert.equal(sub.length, egg ? 2 : 13);
  const slots = new Map(reuse.slots.map(s => [s.texture, s]));
  assert.equal(slots.size, reuse.slots.length);
  const masters = new Set(reuse.masters.map(m => m.masterId));
  assert(reuse.slots.every(s => (s.isBlank && s.masterId === null) || masters.has(s.masterId)));
  characters.push({entityId:id,kind:egg?'EGG':'CREATURE',mainSequences:main.length,subSequences:sub.length,slots:reuse.slots.length,exactRgbaMasters:reuse.masters.length,blankSlots:reuse.slots.filter(s=>s.isBlank).length,motionContract:`${base}/generated/entities/${id}/motion-contract.json`,status:'COST_REFERENCE_NOT_ORIGINAL_ART_COMPLETION'});
  if (!egg) for (const [side, sequences] of Object.entries(motion.sides)) for (const seq of sequences.sequences) {
    const key = `${side}:${seq.id}`;
    if (!actions.has(key)) actions.set(key, {side,sequenceId:seq.id,frames:[],ticks:[],masters:[]});
    const row = actions.get(key);
    for (const frame of seq.frames) assert(slots.has(frame.texture), `${id}:${frame.texture}`);
    row.frames.push(seq.frames.length);
    row.ticks.push(seq.frames.reduce((n,f)=>n+f.ticks,0));
    row.masters.push(new Set(seq.frames.map(f=>slots.get(f.texture).masterId).filter(id=>id!==null)).size);
  }
}
const regular = characters.filter(r=>r.kind==='CREATURE');
assert.equal(characters.length,224); assert.equal(regular.length,216); assert.equal(actions.size,53);
const sum = xs => xs.reduce((a,b)=>a+b,0);
const mean = xs => Number((sum(xs)/xs.length).toFixed(2));
const actionRows = [...actions.values()].map(a=>{
  assert.equal(a.frames.length,216);
  return {side:a.side,sequenceId:a.sequenceId,entities:216,minFrames:Math.min(...a.frames),maxFrames:Math.max(...a.frames),meanFrames:mean(a.frames),minTicks:Math.min(...a.ticks),maxTicks:Math.max(...a.ticks),meanTicks:mean(a.ticks),meanExactRgbaMastersWithinSequence:mean(a.masters),semanticStatus:'RAW_SEQUENCE_IDS_ONLY'};
});
const manifest = read('assets/production/cage/licensed-runtime-v1/manifest.json');
const definitions = read('src/data/championship/catalogs/cage-definitions.r1.json');
const ground = read('src/data/championship/catalogs/raising-ground.r1.json');
const start = new Map([[35,0],[0,8],[1,4],[15,7]]);
const cages = manifest.fields.map(f=>{
  const definition = definitions.records.find(d=>d.fieldId===f.fieldId);
  const role = f.fieldId==='field_cm29_01'?'STRUCTURAL_LID':definition?.cageIndex===35?'WAITING_ROOM':definition?'SHOP_CAGE':'UNREFERENCED';
  const floor = definition && ground.fields.find(g=>g.definitionIndex===definition.cageIndex);
  return {fieldId:f.fieldId,cageDefinitionIndex:definition?.cageIndex??'',role,firstPlayableBatch:definition?start.has(definition.cageIndex):false,startingAnchor:definition?start.get(definition.cageIndex)??'':'',nativeWidthPx:f.nativeWidthPx,nativeHeightPx:f.nativeHeightPx,groundWidthCells:floor?.width??'',groundHeightCells:floor?.height??'',capacity:definition?.capacity??'',effectKind:definition?.effect.kind??'',effectTarget:definition?.effect.target??'',originalReplacementStatus:role==='UNREFERENCED'?'NOT_A_GAMEPLAY_REQUIREMENT':'NOT_ACCEPTED_AS_ORIGINAL_REPLACEMENT'};
});
assert.equal(cages.length,40); assert.equal(cages.filter(c=>c.role==='SHOP_CAGE').length,35);
assert.equal(cages.filter(c=>c.role==='WAITING_ROOM').length,1); assert.equal(cages.filter(c=>c.role==='UNREFERENCED').length,3);
assert.equal(cages.filter(c=>c.firstPlayableBatch).length,4);
csv('character-cost.csv',characters); csv('action-cost.csv',actionRows); csv('cage-replacement.csv',cages);
const receipt = {
  schemaVersion:1, classification:'METADATA_PRODUCTION_PLANNING_ONLY',
  inspectedHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  characterSummary:{entities:characters.length,regular:regular.length,eggs:characters.length-regular.length,exactRgbaMasters:sum(regular.map(r=>r.exactRgbaMasters)),minMasters:Math.min(...regular.map(r=>r.exactRgbaMasters)),maxMasters:Math.max(...regular.map(r=>r.exactRgbaMasters)),meanMasters:mean(regular.map(r=>r.exactRgbaMasters)),slotsIncludingBlanks:sum(regular.map(r=>r.slots)),blankSlots:sum(regular.map(r=>r.blankSlots)),nonblankSlots:sum(regular.map(r=>r.slots-r.blankSlots)),rawActions:actionRows.length},
  recordedLegacyDesignProgress:progress.counts,
  cageSummary:{visualFields:40,shopDefinitions:35,waitingRooms:1,structuralLids:1,unreferencedVisuals:3,firstBatchDefinitions:[35,0,1,15]},
  limitations:['No source pixels or ROM were read by this inventory.','Exact RGBA reuse is not a count of necessary original poses.','Prior remix/setting review is not original-commercial approval.','No runtime art promoted; no gameplay/browser/device/shipping acceptance performed.'],
  sourceHashes:Object.fromEntries([...sources].sort(([a],[b])=>a.localeCompare(b)))
};
fs.writeFileSync(path.join(out,'inventory.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({characters:receipt.characterSummary,cages:receipt.cageSummary}));
