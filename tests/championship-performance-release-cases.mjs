import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const arena = read('src/championship/presentation/dataArena/dataArenaPixiScene.js');
const ranch = read('src/championship/app/raisingHomeP1RView.js');
const stress = read('tests/championship-mobile-stress-leak-browser.cjs');

function syncCalls(rich, source = arena) {
  const statements = source.match(/if\s*\([^\n;]+\)\s*syncCells\(\);/g);
  assert.equal(statements?.length, 1, 'Locate exactly one production cell-sync cadence');
  return vm.runInNewContext(`let calls=0;const syncCells=()=>calls++;for(let frameCount=1;frameCount<=120;frameCount++){${statements[0]}}calls;`, { rich });
}
for (const rich of [false, true]) {
  test(`Arena visual sync is bounded to 60 calls per 120 frames (rich=${rich})`, () => {
    assert.equal(syncCalls(rich), 60);
  });
}
test('cadence regression probe detects the previous low-quality double scan', () => {
  const old = arena.replace('if (frameCount % 2 === 0) syncCells();', 'if (frameCount % 2 === 0 || !rich) syncCells();');
  assert.notEqual(old, arena, 'Probe must alter the actual production condition');
  assert.equal(syncCalls(false, old), 120);
  assert.equal(syncCalls(true, old), 60);
});

function badgesHarness(initialWidth = 390) {
  const start = ranch.indexOf('  function renderCageBadges(badges,events=[]){');
  const end = ranch.indexOf('    const newest=events.reduce', start);
  assert.ok(start >= 0 && end > start, 'Locate production badge reconciliation, before event effects');
  const source = ranch.slice(start, end) + '\n  }';
  const events = [];
  let width = initialWidth;
  function element() {
    return {
      style: new Proxy({}, { set(obj, key, value) { events.push(`style:${key}`); obj[key] = value; return true; } }),
      dataset: new Proxy({}, { set(obj, key, value) { if (key === 'edge') events.push('edge'); obj[key] = value; return true; } }),
      textContent: '',
      append() { events.push('append'); },
      addEventListener() {},
      setAttribute() {},
      remove() { events.push('remove'); }
    };
  }
  const context = {
    fieldHost: { get clientWidth() { events.push('width'); return width; } },
    cageBadgeLayer: element(), cageBadgeNodes: new Map(), openTag: null,
    node: element, uiText: value => value, runClock: value => String(Math.floor(value)),
    getLocale: () => 'zh-Hant', tagDetail: () => element()
  };
  vm.createContext(context);
  vm.runInContext(source + '\nthis.render=renderCageBadges;', context);
  return { context, events, setWidth(value) { width=value; }, render(tags) { context.render(tags); } };
}
const tag = (id, x=150, y=80) => ({ id, kind:'FEED', seconds:60, x, y, noMeat:false, alert:false, owned:1, extendable:true });

test('ranch reads width once before any badge mutation, even with multiple machines', () => {
  const h=badgesHarness(); h.render([tag('a',50),tag('b',180),tag('c',350)]);
  assert.equal(h.events.filter(x=>x==='width').length, 1);
  assert.equal(h.events[0], 'width');
  assert.equal(h.context.cageBadgeNodes.get('a').node.dataset.edge, 'left');
  assert.equal(h.context.cageBadgeNodes.get('c').node.dataset.edge, 'right');
});
test('stationary machine badges do not rewrite position or edge', () => {
  const h=badgesHarness(), tags=[tag('a'),tag('b',350)]; h.render(tags); h.events.length=0; h.render(tags);
  assert.deepEqual(h.events, ['width']);
});
test('badge positions and edge placement still respond to movement and viewport resize', () => {
  const h=badgesHarness(); h.render([tag('a',350)]);
  h.setWidth(1000); h.render([tag('a',350)]);
  assert.equal(h.context.cageBadgeNodes.get('a').node.dataset.edge, '');
  h.render([tag('a',40.6,110.2)]);
  const node=h.context.cageBadgeNodes.get('a').node;
  assert.equal(node.style.left,'41px'); assert.equal(node.style.top,'110px');
  assert.equal(node.dataset.edge,'left');
});
test('removed machines still remove badges and release the opened detail selection', () => {
  const h=badgesHarness(); h.render([tag('a')]); h.context.openTag='a'; h.render([]);
  assert.equal(h.context.cageBadgeNodes.size,0); assert.equal(h.context.openTag,null);
  assert.ok(h.events.includes('remove'));
});

function runStressAssertions(unhandledRejections=[], baseline=false) {
  const end=stress.lastIndexOf('\n    await context.close();');
  const start=stress.lastIndexOf('    if (!BASELINE_ONLY) {',end);
  assert.ok(start>=0 && end>start, 'Locate actual stress-harness terminal assertions');
  const assertions=stress.slice(start,end);
  assert.match(assertions, /assert\.equal\(unhandledRejections\.length, 0/);
  assert.doesNotMatch(assertions, /\bawait\b/, 'Do not extract earlier asynchronous browser steps');
  vm.runInNewContext(assertions, {
    assert, BASELINE_ONLY:baseline, pageErrors:[], unexpectedTitleDrops:[], unhandledRejections,
    report:{maxCanvasDpr:1.75,contextGrowth:0}, lastLoop:{gpu:{activeContexts:2}}, LOOPS:10
  });
}
test('stress harness accepts a clean run', () => { assert.doesNotThrow(()=>runStressAssertions()); });
test('stress harness rejects an unhandled asynchronous error', () => {
  assert.throws(()=>runStressAssertions(['injected rejection']), /Expected 0 unhandledRejections/);
});
test('baseline-only stress mode remains observational', () => {
  assert.doesNotThrow(()=>runStressAssertions(['injected rejection'],true));
});
