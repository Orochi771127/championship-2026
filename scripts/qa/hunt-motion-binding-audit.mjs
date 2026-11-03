#!/usr/bin/env node
// Hunt motion binding audit (Owner 2026-11-03, hunt four fixes, Phase 4).
// For every one of the 232 partners, which drawings play while it walks, runs
// or struggles in Hunt, before and after the hunt-motion fixes:
//  - SINGLE_DRAWING: the clip that plays has one drawing (ice-skating).
//  - TRUNCATED_LOOP: a reviewed loop longer than the native loop it was clocked
//    by, so only its first drawings ever showed.
//  - NO_HUNT_BODY: no battle entity, so the partner cannot appear in Hunt.
// After the fix a moving sequence is ANIMATED (two or more drawings, on its own
// clock), HOP (a walk still on one drawing: the presentation hop/squash takes
// over) or SHAKE (a bound pose on one drawing: the struggle shake takes over).
//
//   node scripts/qa/hunt-motion-binding-audit.mjs [--json out.json] [--md out.md]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SPECIES_TAXONOMY } from '../../src/championship/contracts/speciesTaxonomy.js';
import { BATTLE_CHARACTER_PROFILES, BATTLE_SPECIES_ENTITIES } from '../../src/data/championship/battleCharacterProfiles.js';
import { reviewedNumericClip, reviewedHuntMotionClip, reviewedClipDrawings,
  HUNT_MOVE_SEQUENCES, HUNT_STRUGGLE_SEQUENCES } from '../../src/championship/presentation/reviewedCharacterAnimation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SELECTION = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/championship/reviewed-animation-selection.v1.json'), 'utf8'));
// Hunt requests that move the body or fight the rope (resolveNativeHuntCharacterSequence).
export const AUDITED_SEQUENCES = Object.freeze([...HUNT_MOVE_SEQUENCES, ...HUNT_STRUGGLE_SEQUENCES].sort((a, b) => a - b));
const SEQUENCE_NAMES = Object.freeze({ 2: 'walk', 3: 'run', 12: 'weak walk', 18: 'bound walk', 19: 'bound run',
  20: 'bound bounce', 21: 'bound struggle/escape', 22: 'bound weak walk' });

const nativeLoopTicks = (sequence) => sequence.frames.slice(sequence.loopStartFrame ?? 0).reduce((n, f) => n + f.ticks, 0);
const clipMs = (clip) => (clip?.frames ?? []).reduce((n, f) => n + f.durationMs, 0);

function reviewedDocument(speciesId) {
  const entry = SELECTION.characters.find((c) => c.speciesId === speciesId);
  if (!entry) return null;
  const file = path.join(ROOT, entry.path);
  return fs.existsSync(file) ? { entry, document: JSON.parse(fs.readFileSync(file, 'utf8')) } : { entry, document: null };
}

export function auditHuntMotionBindings() {
  const rows = [];
  for (const taxon of SPECIES_TAXONOMY.entries) {
    const speciesId = `species-${String(taxon.speciesIndex).padStart(3, '0')}`;
    const entityId = BATTLE_SPECIES_ENTITIES[taxon.speciesIndex] ?? null;
    const profile = entityId ? BATTLE_CHARACTER_PROFILES[entityId] : null;
    const reviewed = reviewedDocument(speciesId);
    const row = { displayCode: taxon.displayCode, speciesId, entityId, art: reviewed?.document ? 'REVIEWED' : 'NATIVE',
      reviewedCode: reviewed?.entry.displayCode ?? null, sequences: [], issues: [], status: null };
    if (!profile) { row.status = 'NO_HUNT_BODY'; row.issues.push('NO_HUNT_BODY'); rows.push(row); continue; }
    for (const id of AUDITED_SEQUENCES) {
      const sequence = profile.sequences.find((s) => s.id === id);
      if (!sequence) { row.sequences.push({ id, name: SEQUENCE_NAMES[id], missing: true }); continue; }
      const nativeDrawings = new Set(sequence.frames.map((f) => f.cell)).size;
      const record = { id, name: SEQUENCE_NAMES[id], playbackMode: sequence.playbackMode,
        nativeLoopMs: Math.round(nativeLoopTicks(sequence) * 1000 / 60), nativeDrawings };
      if (reviewed?.document) {
        const before = reviewedNumericClip(reviewed.document, 'main', id);
        const after = reviewedHuntMotionClip(reviewed.document, 'main', id);
        record.before = before ? { clip: before.clip.id, drawings: reviewedClipDrawings(before.clip), ms: Math.round(clipMs(before.clip)),
          loop: before.clip.loop === true } : { clip: 'NATIVE', drawings: nativeDrawings };
        record.after = after ? { clip: after.clip.id, drawings: reviewedClipDrawings(after.clip), alias: after.mappingEvidence } : { clip: 'NATIVE', drawings: nativeDrawings };
        if (record.before.drawings < 2) row.issues.push(`SINGLE_DRAWING:${id}`);
        if (before && before.clip.loop && sequence.playbackMode === 2 && clipMs(before.clip) > record.nativeLoopMs + 1)
          row.issues.push(`TRUNCATED_LOOP:${id}`);
      } else {
        record.before = record.after = { clip: 'NATIVE', drawings: nativeDrawings };
        if (nativeDrawings < 2) row.issues.push(`SINGLE_DRAWING:${id}`);
      }
      record.result = record.after.drawings >= 2 ? 'ANIMATED' : HUNT_STRUGGLE_SEQUENCES.includes(id) ? 'SHAKE' : 'HOP';
      row.sequences.push(record);
    }
    const present = row.sequences.filter((s) => !s.missing);
    row.status = present.every((s) => s.result === 'ANIMATED') ? 'ANIMATED' : 'ANIMATED_WITH_FALLBACK';
    rows.push(row);
  }
  const count = (fn) => rows.filter(fn).length;
  const summary = {
    partners: rows.length,
    huntBodies: count((r) => r.status !== 'NO_HUNT_BODY'),
    reviewed: count((r) => r.art === 'REVIEWED'),
    beforeSingleDrawing: count((r) => r.issues.some((i) => i.startsWith('SINGLE_DRAWING'))),
    beforeTruncatedLoop: count((r) => r.issues.some((i) => i.startsWith('TRUNCATED_LOOP'))),
    afterAnimated: count((r) => r.status === 'ANIMATED'),
    afterUsesFallback: count((r) => r.status === 'ANIMATED_WITH_FALLBACK'),
    afterHopOnWalk: count((r) => r.sequences.some((q) => q.result === 'HOP')),
    noHuntBody: count((r) => r.status === 'NO_HUNT_BODY')
  };
  return { schema: 'HUNT_MOTION_BINDING_AUDIT.v1', sequences: AUDITED_SEQUENCES.map((id) => ({ id, name: SEQUENCE_NAMES[id] })), summary, rows };
}

function markdown(report) {
  const s = report.summary, lines = ['# Hunt motion binding audit', '',
    `- Partners: ${s.partners} (${s.huntBodies} with a Hunt body, ${s.reviewed} on reviewed art)`,
    `- Before: ${s.beforeSingleDrawing} with a one-drawing move/struggle, ${s.beforeTruncatedLoop} with a reviewed loop cut short by the native loop`,
    `- After: ${s.afterAnimated} fully animated, ${s.afterUsesFallback} use a presentation fallback on at least one sequence (${s.afterHopOnWalk} hop on a walk), ${s.noHuntBody} cannot appear in Hunt`, '',
    '| Code | Art | Before | After |', '|---|---|---|---|'];
  for (const r of report.rows) {
    if (!r.issues.length && r.status === 'ANIMATED') continue;
    const fallback = r.sequences.filter((q) => ['HOP', 'SHAKE'].includes(q.result)).map((q) => `${q.id} ${q.name} ${q.result.toLowerCase()}`).join(', ');
    lines.push(`| ${r.displayCode} | ${r.art} | ${r.issues.join(', ') || '-'} | ${r.status}${fallback ? ` (${fallback})` : ''} |`);
  }
  return lines.join('\n') + '\n';
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const report = auditHuntMotionBindings();
  const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
  if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(report, null, 2) + '\n');
  if (arg('--md')) fs.writeFileSync(arg('--md'), markdown(report));
  console.log(JSON.stringify(report.summary, null, 2));
}
