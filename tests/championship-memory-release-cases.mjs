// Memory release audit (2026-11-17). A three-round soak of ranch -> hunt -> battle
// -> Data Arena -> Dex -> shop -> story, measured after forced GC in Chrome:
// - every Data Arena match left ~364 GPU textures and ~420 canvases behind (its
//   effect owners were only released when construction rolled back, never on leave;
//   Pixi's Texture.from(canvas) keeps canvas + texture in its global cache until
//   destroyed), and the zone sigils painted one sheet twice and never freed either;
// - Three.js r185's page-wide DFG lookup texture kept every disposed WebGLRenderer
//   (old ranch scenes, battle-select prisms with their whole menu) reachable;
// - the post-battle Sync EXP panel's partner idle loops (Web Animations) kept the
//   removed panel alive.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as THREE from '../node_modules/three/build/three.module.js';
import {disposeThreeRenderer, releaseThreeSharedTextures, threeSharedTextureListeners}
  from '../src/championship/presentation/threeRendererRelease.js';
import {buildSyncGainPanel} from '../src/championship/app/ui/syncGainPanel.js';
import {releaseDetachedActionPortraits, setActionPortraitsSuspended} from '../src/championship/presentation/juicy/actionPortrait.js';
import {createSpriteMotion} from '../src/championship/presentation/juicy/spriteMotionPlayer.js';

const source = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const between = (text, from, to) => { const a = text.indexOf(from); assert.ok(a >= 0, `missing ${from}`); const b = text.indexOf(to, a + from.length); return text.slice(a, b < 0 ? undefined : b); };

test('the page-wide DFG table lets go of every renderer once one is disposed', () => {
  // A stand-in for WebGLPrograms' getDFGLUT() table and two renderers that uploaded it.
  const lut = new THREE.DataTexture(new Uint16Array(16 * 16 * 2), 16, 16, THREE.RGFormat, THREE.HalfFloatType);
  lut.name = 'DFG_LUT';
  const released = [];
  const listener = name => function onTextureDispose(event) { released.push(name); event.target.removeEventListener('dispose', this === undefined ? onTextureDispose : onTextureDispose); };
  const a = listener('ranch'), b = listener('prism');
  lut.addEventListener('dispose', a);
  lut.addEventListener('dispose', b);
  assert.equal(threeSharedTextureListeners(), 2, 'the table is noticed when a renderer registers on it');
  const calls = [];
  disposeThreeRenderer({dispose: () => calls.push('dispose'), forceContextLoss: () => calls.push('lose')});
  assert.deepEqual(calls, ['dispose', 'lose']);
  assert.deepEqual(released.sort(), ['prism', 'ranch'], 'every renderer listener ran once');
  assert.equal(threeSharedTextureListeners(), 0, 'nothing keeps a disposed renderer reachable');
  // A renderer still drawing simply registers again on its next upload.
  lut.addEventListener('dispose', a);
  const borrowed = [];
  disposeThreeRenderer({dispose: () => borrowed.push('dispose'), forceContextLoss: () => borrowed.push('lose')}, {loseContext: false});
  assert.deepEqual(borrowed, ['dispose'], 'a borrowed context is not lost');
  assert.equal(threeSharedTextureListeners(), 0);
  // Other textures are not touched by the watch.
  const other = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  let otherDisposed = false;
  other.addEventListener('dispose', () => { otherDisposed = true; });
  releaseThreeSharedTextures();
  assert.equal(otherDisposed, false);
  assert.doesNotThrow(() => disposeThreeRenderer(null));
});

test('every private Three renderer is released through disposeThreeRenderer', () => {
  for (const file of [
    'src/championship/presentation/ranchThreeScene.js',
    'src/championship/presentation/vs2/createGateSelectThreePresentation.js',
    'src/championship/presentation/vs5/createBattleSelectThreePresentation.js',
    'src/championship/presentation/vs5/createBattleVfxThreeOverlay.js',
    'src/championship/presentation/highlight/createHighlightBurstThree.js',
    'src/championship/presentation/medals/medalThreePresentation.js'
  ]) {
    const text = source(file);
    assert.match(text, /disposeThreeRenderer\(renderer\)/, file);
    assert.doesNotMatch(text, /renderer\.dispose\(\)/, `${file} disposes its renderer only through the helper`);
  }
});

test('a Data Arena scene releases its effect owners and sigil sheets on every leave', () => {
  const scene = source('src/championship/presentation/dataArena/dataArenaPixiScene.js');
  const dispose = between(scene, '    dispose() {\n      if (disposed) return;', '\n    }\n  });');
  for (const call of ['elementFx?.dispose()', 'statusFx?.dispose()', 'burstShell.dispose()'])
    assert.ok(dispose.includes(call), `dispose() calls ${call}`);
  assert.ok(dispose.indexOf('elementFx?.dispose()') < dispose.indexOf('root.destroy('), 'effects go before their layers');
  assert.match(dispose, /for \(const value of sigilSheets\.values\(\)\) for \(const sheet of \[value\?\.body, value\?\.light\]\) for \(const texture of sheet\?\.textures \?\? \[\]\) texture\.destroy\(true\);/);
  const sigil = between(scene, '  function sigilSheet(color) {', '  function zoneSigil(').replace(/^\s*\/\/.*$/gm, '');
  assert.equal([...sigil.matchAll(/paint\(false\)/g)].length, 1, 'the body sheet is painted once');
});

test('the move-effect kit caches its drawn-sigil fallback so dispose() frees it', () => {
  const kit = source('src/championship/presentation/vfx/moveVfxKit.js');
  const fallback = between(kit, 'const canvas = paintMoveVfxSigil(', 'return entry;');
  assert.match(fallback, /sheets\.set\(id, entry\);/);
  assert.match(kit, /for \(const entry of sheets\.values\(\)\) for \(const texture of entry\.textures\) texture\.destroy\(true\);/);
});

function fakeDocument() {
  const doc = {};
  const make = tag => {
    const node = {tagName: tag.toUpperCase(), className: '', children: [], dataset: {}, parentNode: null, attributes: {}, hidden: false, textContent: '',
      style: {props: {}, setProperty(k, v) { this.props[k] = v; }},
      setAttribute(k, v) { this.attributes[k] = String(v); },
      addEventListener() {}, removeEventListener() {},
      append(...kids) { for (const kid of kids) { if (typeof kid !== 'object') continue; kid.parentNode = this; this.children.push(kid); } },
      replaceChildren(...kids) { for (const kid of this.children) kid.parentNode = null; this.children = []; this.append(...kids); },
      remove() { if (this.parentNode) { this.parentNode.children = this.parentNode.children.filter(c => c !== this); this.parentNode = null; } },
      get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === doc.body; },
      get ownerDocument() { return doc; }};
    return node;
  };
  doc.createElement = make;
  doc.body = make('body');
  return doc;
}

test('the Sync EXP panel retires its partners\' idle loops with itself', () => {
  const previous = globalThis.document;
  globalThis.document = fakeDocument();
  try {
    const gain = {instanceId: 'championship:2026:instance:1', amount: 120, overflow: 0, breakthroughs: [], vitalPercent: {after: 100},
      before: {level: 3, exp: 10, next: 100}, after: {level: 3, exp: 40, next: 100}};
    const panel = buildSyncGainPanel({gains: [gain], portraitOf: () => ({species: 'species-054'}), reducedMotion: true});
    const row = panel.node.children[0];
    const face = row.children.find(child => String(child.className).includes('cm-sync-row__face'));
    assert.ok(face, 'the partner body is in its row');
    panel.dispose();
    assert.equal(face.parentNode, null, 'dispose() disposes the partner body too');
  } finally { globalThis.document = previous; }
});

test('every screen change retires partner bodies a view dropped without disposing', () => {
  assert.equal(typeof releaseDetachedActionPortraits, 'function');
  assert.doesNotThrow(() => releaseDetachedActionPortraits());
  const main = source('src/championship/app/main.js');
  const mounted = between(main, '    mountedScreen = target;\n', 'screenChangedAt = performance.now();');
  assert.match(mounted, /releaseDetachedActionPortraits\(\);/);
});

test('one per-frame callback that throws no longer stops the shared ticker (the game froze)', async () => {
  const {Ticker} = await import('../node_modules/pixi.js/lib/ticker/Ticker.mjs');
  const {TickerListener} = await import('../node_modules/pixi.js/lib/ticker/TickerListener.mjs');
  const {isolateTickerListenerFailures} = await import('../src/championship/presentation/championshipPixiStage.js');
  const reports = [];
  assert.equal(isolateTickerListenerFailures({TickerListener}, {report: error => reports.push(error.message)}), true);
  assert.equal(isolateTickerListenerFailures({TickerListener}), false, 'installed once');
  const ticker = new Ticker(); ticker.autoStart = false;
  let after = 0, onceCalls = 0;
  const broken = () => { throw new RangeError('Hunt field art/world mismatch: field_hm05_02'); };
  ticker.add(broken);
  ticker.addOnce(() => { onceCalls += 1; throw new Error('once'); });
  ticker.add(() => { after += 1; });
  let now = performance.now();
  for (let frame = 0; frame < 3; frame += 1) { now += 17; assert.doesNotThrow(() => ticker.update(now)); }
  assert.equal(after, 3, 'the listeners after the failing one still run every frame');
  assert.equal(onceCalls, 1, 'a once listener that throws is still removed');
  assert.deepEqual(reports, ['Hunt field art/world mismatch: field_hm05_02', 'once'], 'each failing listener is reported once');
  ticker.remove(broken);
  ticker.destroy();
});

test('destroying the texture a shared bind group last drew no longer kills that group (the next Hunt froze)', async () => {
  const {BindGroup} = await import('../node_modules/pixi.js/lib/rendering/renderers/gpu/shader/BindGroup.mjs');
  const {Texture} = await import('../node_modules/pixi.js/lib/rendering/renderers/shared/texture/Texture.mjs');
  const {TextureSource} = await import('../node_modules/pixi.js/lib/rendering/renderers/shared/texture/sources/TextureSource.mjs');
  const {keepBindGroupsWhenTexturesGo} = await import('../src/championship/presentation/championshipPixiStage.js');
  // Pixi 8.19 as shipped: the mesh renderer's shared group dies with the rope braid it last drew.
  const before = new BindGroup({0: new TextureSource({width: 8, height: 8})});
  before.resources[0].destroy();
  assert.equal(before.resources, null, 'the unpatched group is destroyed');
  assert.equal(keepBindGroupsWhenTexturesGo({BindGroup, Texture}), true);
  assert.equal(keepBindGroupsWhenTexturesGo({BindGroup, Texture}), false, 'installed once');
  const braid = new TextureSource({width: 8, height: 8});
  const shared = new BindGroup({0: braid, 1: braid.style});
  braid.destroy();
  assert.ok(shared.resources, 'the shared group survives');
  assert.equal(shared.resources[0], Texture.EMPTY.source, 'the slot falls back to the empty texture');
  const next = new TextureSource({width: 4, height: 4});
  assert.doesNotThrow(() => shared.setResource(next, 0), 'the next mesh can set its texture (was: reading \'0\' of null)');
  assert.equal(shared.resources[0], next);
  // Any other destroyed resource keeps Pixi's own behaviour.
  const other = {destroyed: false, _resourceType: 'uniformGroup', _resourceId: 99, on() {}, off() {}};
  const group = new BindGroup({0: other});
  other.destroyed = true; group.onResourceChange(other);
  assert.equal(group.resources, null);
});

test('a failed Hunt field mount takes its ticker callback and listeners back off', () => {
  const hunt = source('src/championship/presentation/vs2/createHuntFieldPixiPresentation.js');
  assert.match(hunt, /try \{ render\(\); \}\n  catch \(error\) \{ teardown\(false\); throw error; \}\n  return presentation;/);
  const teardown = between(hunt, '  function teardown(releaseOwned) {', '\n  }\n}');
  for (const step of ['app.ticker.remove(advance);', 'globalThis.removeEventListener?.("blur", cancelPointer);', 'app.stage.off("pointerdown", onPointerDown);', 'ropeVfx.destroy();'])
    assert.ok(teardown.includes(step), step);
  assert.match(teardown, /if \(releaseOwned\) \{\n      void fieldArt\?\.dispose\(\);/, 'the caller keeps the bundles of a failed mount');
});

test('a lost GPU context that never comes back saves and reloads once instead of freezing', () => {
  const main = source('src/championship/app/main.js');
  assert.match(main, /const CONTEXT_RESTORE_GRACE_MS = 6000;/);
  const arm = between(main, 'function armContextLossReload() {', '\nasync function ensurePixiStage(');
  assert.match(arm, /if \(!pixiStage\?\.contextLost\) return;/, 'a restored context cancels the reload');
  assert.match(arm, /document\.visibilityState !== 'visible'/, 'a hidden page waits for the player');
  assert.match(arm, /if \(performance\.now\(\) < CONTEXT_LOSS_MIN_UPTIME_MS\) return;/, 'a page just reloaded never reloads itself again');
  assert.match(main, /const CONTEXT_LOSS_MIN_UPTIME_MS = 60000;/);
  assert.doesNotMatch(arm, /setItem/, 'no storage write outside the persistent save port');
  assert.ok(arm.indexOf('autosaveOnHide();') < arm.indexOf('location.reload();'), 'the save is written before the reload');
  assert.match(main, /pixiStage\.onContextLost\(\(\) => \{[^\n]*armContextLossReload\(\);\}\);/);
  assert.match(between(main, 'pixiStage.onContextRestored(() => {', '});'), /disarmContextLossReload\(\);/);
});

test('the idle ranch HUD writes only what changed (it repainted everything ~17 times a second)', () => {
  // Measured 2026-11-17 on an idle ranch: ~1,000 replaced text nodes and ~2,700 attribute
  // writes in 10 s before; 2 and ~170 (the 3D canvas frame counter) after.
  const view = source('src/championship/app/raisingHomeP1RView.js');
  for (const helper of ['writeText', 'writeHidden', 'writeData', 'writeVar'])
    assert.ok(view.includes(`const ${helper} = (el, `), helper);
  const render = between(view, '  function render(frame) {', '\n    field.render(frame);');
  assert.match(render, /writeText\(companionLocation, /);
  assert.match(render, /if \(nameKey !== lastNameKey\) \{/, 'the name and bloodline badge are rebuilt only on a change');
  assert.match(render, /writeHidden\(mailIcon,/);
  assert.doesNotMatch(render, /companionName\.textContent = resident\?\.displayName/);
  const meters = between(view, '  function paintMeters(set, resident) {', '\n  }');
  assert.doesNotMatch(meters, /\.textContent = /);
  const mood = between(view, '  function paintPartnerMood(partner) {', '\n  function paintDetail(');
  assert.match(mood, /if \(heartsChanged\) moodHearts\.replaceChildren\(/);
  // The always-hidden story badge and the journal no longer force a layout every frame.
  const badge = source('src/championship/app/ranchStoryBadge.js');
  assert.match(between(badge, '  function update(frame) {', '\n  }'), /if \(!button\.hidden\) place\(\);/);
  const journal = source('src/championship/app/ranchDiscoveryJournal.js');
  assert.match(between(journal, '  function update(frame){', '\n  }'), /if\(changed\|\|placedOnce!==true\)\{placedOnce=true;place\(\);\}/);
});

test('iOS polish: hidden portraits suspend, background 3D stops under Story, wide battle canvas bitmaps close, and auto-resume avoids title flash', () => {
  assert.equal(typeof setActionPortraitsSuspended, 'function');
  // Unit-check spriteMotionPlayer suspend/resume releases backgroundImage & animation and restores on resume.
  const doc = fakeDocument();
  let canceled = 0, animated = 0;
  const origMake = doc.createElement;
  doc.createElement = tag => {
    const node = origMake(tag);
    node.animate = () => { animated += 1; return { playState: 'running', pause() { this.playState = 'paused'; }, play() { this.playState = 'running'; }, cancel() { canceled += 1; }, finished: Promise.resolve() }; };
    return node;
  };
  const motion = {
    bounds: { left: -20, right: 20, top: -40, bottom: 0 },
    density: 4,
    sequences: new Map([[0, [
      { x: 0, y: 0, w: 40, h: 40, ox: -20, oy: -40, ticks: 6, url: 'https://example.test/a.webp', pageWidth: 256, pageHeight: 256 },
      { x: 40, y: 0, w: 40, h: 40, ox: -20, oy: -40, ticks: 6, url: 'https://example.test/a.webp', pageWidth: 256, pageHeight: 256 }
    ]]])
  };
  const sprite = createSpriteMotion({ doc, motion, scale: 1 });
  sprite.play(0);
  const body = sprite.element.children[0];
  assert.equal(animated, 1);
  assert.match(body.style.backgroundImage, /a\.webp/);
  sprite.suspend();
  assert.equal(canceled, 1);
  assert.equal(body.style.backgroundImage, 'none');
  sprite.resume();
  assert.equal(animated, 2);
  assert.match(body.style.backgroundImage, /a\.webp/);
  sprite.dispose();

  const ranch = source('src/championship/presentation/ranchThreeScene.js');
  assert.match(ranch, /\.cm-vn:not\(\[hidden\]\), \.cm-story-map:not\(\[hidden\]\)/);
  assert.match(ranch, /if\(document\.hidden\|\|storyCovering\)\{wasHidden=true;return true;\}/);

  const battleSelectThree = source('src/championship/presentation/vs5/createBattleSelectThreePresentation.js');
  assert.match(battleSelectThree, /!host\.isConnected \|\| host\.closest\?\.\("\[hidden\]"\)/);

  const ambient = source('src/championship/presentation/battleFieldAmbient.js');
  assert.match(ambient, /canvasSources\.map\(src => unloadClosingBitmap\(PIXI\.Assets, src\)\)/);

  const main = source('src/championship/app/main.js');
  assert.match(main, /setActionPortraitsSuspended\(root, true\)/);
  assert.match(main, /setActionPortraitsSuspended\(root, false\)/);
  assert.match(main, /preBootCheckpoint[\s\S]*titleScreen\.hidden = true;/);
  assert.doesNotMatch(main, /openingFilm\?\.stop\?\.\(\)/);
  assert.match(main, /openingFilm\?\.sync\?\.\(\)/);
  assert.match(main, /resumeOverlay === "story"/);
  assert.match(main, /resumeOverlay === "journey"/);
});
