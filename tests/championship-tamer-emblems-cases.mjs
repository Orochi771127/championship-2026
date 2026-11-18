// MECHANICS_AS_GAME_NOT_TEXT_20261118 (Owner 2026-11-18): the crystal feed (R1), the level unlocks (R1b) and the
// evolution level gate (R2) are shown with Codex's emblems, moving gauges and a pay-off moment, not as sentences.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {TAMER_EMBLEM_BASE, TAMER_EMBLEMS, tamerEmblemSrc, tamerEmblem, flyEmblems} from '../src/championship/presentation/tamerEmblemArt.js';
import {uiText} from '../src/championship/text/uiText.js';
import {journeyText} from '../src/championship/text/journeyText.js';
import {setLocale} from '../src/championship/text/locale.js';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const sha = path => createHash('sha256').update(readFileSync(new URL(`../${path}`, import.meta.url))).digest('hex');

test('the emblem bundle: eight stickers, each recorded with its hash, its rights and its inputs', () => {
  const manifest = JSON.parse(source('assets/production/ui/tamer-emblems-r1/manifest.json'));
  assert.deepEqual(manifest.files.map(file => file.key), ['star-on', 'star-off', 'star-burst', 'exp-crystal', 'tamer-level-badge', 'lock-rank', 'lock-level', 'evolve-ready']);
  assert.equal(manifest.rightsStatus, 'ORIGINAL_GENERATED');
  assert.match(manifest.provenance, /Codex .*gpt-6\.1-sol.*briefs\/b001\.md/);
  assert.match(manifest.provenance, /no ROM frame, research-library file or third-party character was an input/);
  let bytes = 0;
  for (const file of manifest.files) {
    assert.equal(sha(file.path), file.sha256, file.path);
    assert.deepEqual(file.size, [96, 96]);
    bytes += readFileSync(new URL(`../${file.path}`, import.meta.url)).length;
  }
  assert.ok(bytes < 80 * 1024, `the whole bundle is ${bytes} bytes`);
  const index = JSON.parse(source('assets/production/ART_PRODUCTION_INDEX.json'));
  const entry = index.entries.find(row => row.assetId === 'art:ui:tamer-emblems:r1');
  assert.deepEqual([entry.count, entry.rightsStatus, entry.runtimeEligible, entry.shippingReady, entry.humanApproved], [8, 'ORIGINAL_GENERATED', true, false, false]);
  assert.equal(entry.manifestSha256, sha('assets/production/ui/tamer-emblems-r1/manifest.json'));
  assert.equal(index.summary.registeredRuntimeBundles, index.entries.length);
  const inputs = JSON.parse(source('docs/contracts/championship/WEB_BUILD_INPUTS.v1.json')), allow = JSON.parse(source('docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json'));
  for (const file of manifest.files) {
    assert.ok(inputs.files.includes(file.path), `${file.path} is a build input`);
    assert.equal(allow.files.find(row => row.path === file.path)?.sha256, file.sha256, `${file.path} is published with this hash`);
  }
  assert.ok(!allow.files.some(row => /tamer-emblems-r1\/(manifest\.json|briefs\/)/.test(row.path)), 'the record and the brief are not published');
  for (const module of ['src/championship/presentation/tamerEmblemArt.js', 'src/championship/presentation/starEmblemArt.js']) assert.ok(inputs.moduleEntries.includes(module), module);
});

test('the emblem module: known kinds only, decoration that removes itself, a flight that never runs without layout', () => {
  assert.deepEqual([...TAMER_EMBLEMS], ['exp-crystal', 'tamer-level-badge', 'lock-rank', 'lock-level', 'evolve-ready']);
  for (const kind of TAMER_EMBLEMS) assert.equal(tamerEmblemSrc(kind), `${TAMER_EMBLEM_BASE}${kind}_96.webp`);
  assert.equal(tamerEmblemSrc('../secret'), null);
  assert.equal(tamerEmblem('nope', {doc: {createElement: () => ({})}}), null);
  assert.equal(tamerEmblem('exp-crystal', {doc: null}), null);
  // a minimal element: the emblem is hidden from assistive tech and removes itself when its image fails
  const listeners = {}; let removed = false;
  const image = tamerEmblem('lock-level', {size: 18, doc: {createElement: () => ({dataset: {}, setAttribute(k, v) { this[k] = v; }, addEventListener(type, run) { listeners[type] = run; }, remove() { removed = true; }})}});
  assert.deepEqual([image.className, image.dataset.emblem, image.width, image.alt, image['aria-hidden'], image.src], ['cm-emblem', 'lock-level', 18, '', 'true', `${TAMER_EMBLEM_BASE}lock-level_96.webp`]);
  listeners.error(); assert.equal(removed, true);
  assert.equal(flyEmblems({from: null, to: null}), 0);
  assert.equal(flyEmblems({from: {getBoundingClientRect: () => ({width: 0})}, to: {getBoundingClientRect: () => ({width: 10})}, doc: {body: {}}}), 0);
  const art = source('src/championship/presentation/tamerEmblemArt.js');
  assert.doesNotMatch(art, /Math\.random/);
  assert.match(art, /prefersReducedMotion\(doc\)\) return 0;/);
  assert.doesNotMatch(art, /https?:/);
});

test('R1: the Journey feed is a pour station with the badge, the gauge, the purse and a moment when it pays off', () => {
  const screen = source('src/championship/app/journeyScreen.js'), css = source('src/championship/app/ui/journey.css'), shared = source('src/championship/app/styles.css');
  assert.match(screen, /const badge = tamerLevelBadge\(\{ level: tamer\.level, size: 56 \}\);/);
  assert.match(screen, /const crystal = tamerEmblem\("exp-crystal", \{ size: 22 \}\);/);
  assert.match(screen, /const icon = tamerEmblem\("lock-level", \{ size: 18 \}\);/);
  assert.match(screen, /unlockToast = playCeremony\(\{ host: stage, kind: "capture", cue: "capture",/);
  assert.doesNotMatch(screen, /requestAnimationFrame/, 'one ticker: the station uses a short timer');
  assert.match(screen, /onDone: \(\) => \{ unlockToast = null; stage\.remove\(\); \} \}\);/);
  for (const rule of ['.cm-journey__pour-gauge {', '.cm-journey__pour-fill {', '.cm-journey__pour-purse {', '.cm-journey__pour-unlock {']) assert.ok(css.includes(rule), rule);
  for (const rule of ['.cm-emblem {', '.cm-emblem--flying {', '.cm-tamer-badge__level {', '.cm-fixed-stage {', ':root[data-motion="reduced"] .cm-tamer-badge[data-pop="true"] { animation: none; }']) assert.ok(shared.includes(rule), rule);
  assert.doesNotMatch(css, /font-size: \d+px/);
});

test('R1b: locks wear the padlock sticker in the shop, at the gates, in the talent panel and the rank overview', () => {
  assert.match(source('src/championship/app/ui/screenLayout.css'),
    /\.cm-vs2-shop__lock\[data-unlock-kind="TAMER_RANK_THRESHOLD"\]::before \{[^}]*url\("\.\.\/\.\.\/\.\.\/\.\.\/assets\/production\/ui\/tamer-emblems-r1\/lock-level_96\.webp"\)/);
  assert.match(source('src/championship/app/vs2Styles.css'),
    /\.cm-vs2-gate-admission\[data-reason="GATE_LOCKED"\]::before \{[^}]*url\("\.\.\/\.\.\/\.\.\/assets\/production\/ui\/tamer-emblems-r1\/lock-level_96\.webp"\)/);
  const gate = source('src/championship/app/vs2Screens.js');
  assert.match(gate, /admissionStatus\.setAttribute\("data-reason", block\.admission\?\.reason \?\? ""\);/);
  assert.match(gate, /uiText\("階級 \{rank\}／Lv\.\{level\}", \{ rank: admission\.unlockParameter, level: admission\.unlockLevel \}\)/);
  assert.doesNotMatch(gate, /tamerEmblemArt|productTamerTalents/, 'the gate screen takes no new import');
  assert.match(source('src/championship/app/tamerTalentPanel.js'), /const lockArt = tamerEmblem\("lock-level", \{ size: 16, doc \}\);/);
  assert.match(source('src/championship/app/tamerInfoScreen.js'), /const levelNoteArt = tamerEmblem\("lock-level", \{ size: 16 \}\);/);
  try {
    for (const locale of ['zh-Hant', 'en', 'ja', 'th', 'vi']) {
      setLocale(locale);
      const line = uiText('階級 {rank}／Lv.{level}', {rank: 3, level: 15});
      assert.match(line, /3.*Lv\.15/, locale);
      assert.ok([...line].length <= 16, `${locale}: ${line}`);
      assert.match(journeyText('feed.opened.chip', {gates: 2, goods: 9}, locale), /2.*9/, locale);
    }
  } finally { setLocale('zh-Hant'); }
});

test('R2: a ready partner waiting for its level shows the evolve-ready emblem and its level gauge', () => {
  const ranch = source('src/championship/app/raisingHomeP1RView.js');
  assert.match(ranch, /const levelChip = node\('span', 'int-rh2-companion__evolve-level'\);/);
  assert.match(ranch, /const ready = tamerEmblem\('evolve-ready', \{ size: 18 \}\);/);
  assert.match(ranch, /starLevelGauge\(\{ level: partner\.evolveLevel\.level, cap: partner\.evolveLevel\.need \}\)\);/);
  assert.match(ranch, /levelChip\.setAttribute\('aria-label', uiText\('進化需 Lv\.\{need\}', \{ need: partner\.evolveLevel\.need \}\)\);/);
  assert.match(source('src/championship/app/cyberGachaView.js'), /const ready = tamerEmblem\("evolve-ready", \{ size: 16 \}\);/);
});
