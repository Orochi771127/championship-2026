// TALENT_TREE_20261118 (Owner 2026-11-18: 「為什麼你連天賦都做成好像文字版啊？而不是那種樹狀圖…有圖片人家點一下會發亮這樣，
// 然後按著才會顯示那個天賦的功能作用」 and 「太多字了太複雜了…直覺的系統」): the talent screen is a tree of icons.
// The rules of TAMER_TALENTS_20261117 are untouched; this is how they are shown.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {TALENT_NODES, TALENT_KEYSTONES, TALENT_LINES} from '../src/championship/contracts/productTamerTalents.js';
import {TALENT_ICON_BASE, talentIconSrc, talentIcon} from '../src/championship/presentation/talentIconArt.js';
import {TALENT_HOLD_MS, talentNodeState} from '../src/championship/app/tamerTalentPanel.js';
import {talentText} from '../src/championship/text/tamerTalentText.js';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const sha = path => createHash('sha256').update(readFileSync(new URL(`../${path}`, import.meta.url))).digest('hex');

test('every talent, every keystone and every line has its icon, recorded with its hash, its rights and its inputs', () => {
  const manifest = JSON.parse(source('assets/production/ui/talent-icons-r1/manifest.json'));
  const wanted = [...TALENT_LINES.map(line => `line-${line}`), ...TALENT_NODES.map(node => node.id), ...TALENT_KEYSTONES.map(key => key.id)];
  assert.equal(wanted.length, 48);
  assert.deepEqual(manifest.files.map(file => file.key).sort(), [...wanted].sort());
  assert.equal(manifest.rightsStatus, 'ORIGINAL_GENERATED');
  assert.match(manifest.provenance, /no ROM frame, research-library file or third-party character was an input/);
  let bytes = 0;
  for (const file of manifest.files) {
    assert.equal(file.path, `${TALENT_ICON_BASE}${file.key}_96.webp`);
    assert.equal(sha(file.path), file.sha256, file.path);
    bytes += readFileSync(new URL(`../${file.path}`, import.meta.url)).length;
  }
  assert.ok(bytes < 520 * 1024, `the whole bundle is ${bytes} bytes`);
  const index = JSON.parse(source('assets/production/ART_PRODUCTION_INDEX.json'));
  const entry = index.entries.find(row => row.assetId === 'art:ui:talent-icons:r1');
  assert.deepEqual([entry.count, entry.rightsStatus, entry.runtimeEligible, entry.shippingReady, entry.humanApproved], [48, 'ORIGINAL_GENERATED', true, false, false]);
  assert.equal(entry.manifestSha256, sha('assets/production/ui/talent-icons-r1/manifest.json'));
  assert.equal(index.summary.registeredRuntimeBundles, index.entries.length);
  const inputs = JSON.parse(source('docs/contracts/championship/WEB_BUILD_INPUTS.v1.json')), allow = JSON.parse(source('docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json'));
  for (const file of manifest.files) {
    assert.ok(inputs.files.includes(file.path), `${file.path} is a build input`);
    assert.equal(allow.files.find(row => row.path === file.path)?.sha256, file.sha256, `${file.path} is published with this hash`);
  }
  assert.ok(!allow.files.some(row => /talent-icons-r1\/(manifest\.json|briefs\/)/.test(row.path)), 'the record and the briefs are not published');
  assert.ok(inputs.moduleEntries.includes('src/championship/presentation/talentIconArt.js'));
});

test('the icon module: ids only, a drawn gem when the image cannot load', () => {
  assert.equal(talentIconSrc('hunter.breath'), `${TALENT_ICON_BASE}hunter.breath_96.webp`);
  assert.equal(talentIconSrc('line-trader'), `${TALENT_ICON_BASE}line-trader_96.webp`);
  for (const bad of ['../x', 'hunter', 'hunter.breath/..', '', null, 7]) assert.equal(talentIconSrc(bad), null, String(bad));
  const made = [];
  const doc = {createElement: tag => { const node = {tag, dataset: {}, listeners: {}, setAttribute(k, v) { this[k] = v; }, addEventListener(type, run) { this.listeners[type] = run; },
    replaceWith(other) { this.replaced = other; }}; made.push(node); return node; }};
  const icon = talentIcon('breeder.care', {size: 44, doc});
  assert.deepEqual([icon.tag, icon.className, icon.dataset.icon, icon.width, icon.alt, icon['aria-hidden'], icon.src], ['img', 'cm-talent-icon', 'breeder.care', 44, '', 'true', `${TALENT_ICON_BASE}breeder.care_96.webp`]);
  icon.listeners.error();
  assert.deepEqual([icon.replaced.tag, icon.replaced.className], ['span', 'cm-talent-icon cm-talent-icon--drawn']);
  assert.equal(talentIcon('nope', {doc}).className, 'cm-talent-icon cm-talent-icon--drawn', 'an unknown id is the drawn gem, never an empty node');
  assert.doesNotMatch(source('src/championship/presentation/talentIconArt.js'), /https?:/);
});

test('three layers: a glance of art, a tap that lights, a hold that reads', () => {
  assert.ok(TALENT_HOLD_MS >= 250 && TALENT_HOLD_MS <= 450, 'long enough not to be a tap, short enough not to feel stuck');
  const cases = [[{open: false, rank: 0, max: 3, refusal: 'TALENT_NOT_OPEN'}, 'soon'], [{open: true, rank: 0, max: 3, refusal: null}, 'ready'],
    [{open: true, rank: 1, max: 3, refusal: null}, 'lit-ready'], [{open: true, rank: 2, max: 3, refusal: 'TALENT_NO_POINTS'}, 'lit'],
    [{open: true, rank: 3, max: 3, refusal: 'TALENT_MAX'}, 'max'], [{open: true, rank: 0, max: 3, refusal: 'TALENT_TIER_LOCKED'}, 'locked']];
  for (const [node, state] of cases) assert.equal(talentNodeState(node), state);
  const panel = source('src/championship/app/tamerTalentPanel.js');
  // the first layer carries no sentence: names and effects are written only into the reading bar and accessible names
  assert.doesNotMatch(panel, /cm-talents__learn|cm-talents__line-title|talentText\("tier",/);
  assert.match(panel, /key\.append\(talentIcon\(node\.id, \{ size: node\.keystone \? 52 : 44, doc \}\)\);/);
  assert.match(panel, /holdTimer = setTimer\(\(\) => \{ held = true; read\(node\); requestArcadeFx\(key, "open"\); \}, TALENT_HOLD_MS\);/);
  assert.match(panel, /if \(held\) \{ held = false; return; \}/, 'the release of a hold is not a tap');
  assert.match(panel, /if \(state !== "ready" && state !== "lit-ready"\) \{ requestArcadeFx\(key, "denied"\); key\.dataset\.shake = "true"; read\(node\); return; \}/);
  assert.match(panel, /requestArcadeFx\(Array\.from\(root\.querySelectorAll\("button"\)\)\.find\(\(fresh\) => fresh\.dataset\?\.learn === node\.id\) \?\? root, node\.rank \+ 1 >= node\.max \? "levelup" : "sparkle"\);/);
  assert.match(panel, /key\.addEventListener\("contextmenu", \(event\) => event\?\.preventDefault\?\.\(\)\);/, 'a long press never opens the browser menu');
  assert.match(panel, /key\.addEventListener\("focus", \(\) => read\(node\)\);/, 'the keyboard reads a node by focusing it');
  assert.doesNotMatch(panel, /requestAnimationFrame/);
  const css = source('src/championship/app/styles.css');
  for (const rule of ['.cm-talents__tree::before {', '.cm-talents__row::before {', '.cm-talents__node[data-state="soon"] > .cm-talent-icon {', '.cm-talents__node[data-lit="now"]::after {',
    '@keyframes cm-talent-ready', '.cm-talents__reading {', '.cm-talents__gate-fill {', '-webkit-touch-callout: none;',
    ':root[data-motion="reduced"] :is(.cm-talents__node > .cm-talent-icon, .cm-talents__node::after, .cm-talents__orb) { animation: none; }']) assert.ok(css.includes(rule), rule);
  // what loops is a glow, never a move: a node a player presses does not travel under the finger
  const ready = /@keyframes cm-talent-ready \{[^@]*\}/.exec(css)[0];
  assert.doesNotMatch(ready, /transform/);
});

test('the only new words are a hint, a choice mark and the gate label, in five languages and short', () => {
  for (const locale of ['zh-Hant', 'en', 'ja', 'th', 'vi']) {
    for (const key of ['hint', 'either']) assert.ok(talentText(key, null, locale).length > 0, `${locale} ${key}`);
    assert.match(talentText('tier.gate', {spent: 2, gate: 6}, locale), /2 \/ 6/, locale);
  }
  assert.ok([...talentText('hint', null, 'zh-Hant')].length <= 12);
  assert.equal(talentText('either', null, 'zh-Hant'), '二選一');
});
