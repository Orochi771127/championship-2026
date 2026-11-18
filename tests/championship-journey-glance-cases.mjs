// JOURNEY_GLANCE_20261118 (Owner 2026-11-18: 「這些系統都太多字了太複雜了…直覺的系統不需要這麼多說明」): the Journey's
// purse, patrol pod, star rules and sparring rules read at a glance; the sentences stay as accessible names or
// behind a ? key. No rule changes.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {journeyText} from '../src/championship/text/journeyText.js';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the purse and the patrol pod are icons, a gauge and a tag; their sentences are accessible names', () => {
  const screen = source('src/championship/app/journeyScreen.js');
  assert.match(screen, /crystals\.replaceChildren\(\.\.\.\[tamerEmblem\("exp-crystal", \{ size: 18 \}\)\]\.filter\(Boolean\), el\("b", "", frame\.crystals\.toLocaleString\(\)\)\);/);
  assert.match(screen, /crystals\.setAttribute\("aria-label", t\("crystals", \{ value: frame\.crystals\.toLocaleString\(\) \}\)\);/);
  assert.match(screen, /pod\.setAttribute\("aria-label", `\$\{t\("patrol\.title"\)\}・\$\{t\("patrol\.rate", \{ rate: patrol\.rate\.toLocaleString\(\) \}\)\}`\);/);
  assert.match(screen, /const icon = talentIcon\("trader\.patrol", \{ size: 40 \}\);/);
  assert.match(screen, /top\.append\(gauge, el\("span", "cm-journey__pod-rate", `\+\$\{patrol\.rate\.toLocaleString\(\)\}\/h`\)\);/);
  assert.doesNotMatch(screen, /el\("strong", "cm-journey__pod-title"/, 'no title sentence on the pod');
});

test('the star rules are three short chips, and the sparring rules sit behind a ? key', () => {
  const screen = source('src/championship/app/journeyScreen.js');
  assert.match(screen, /legend\.setAttribute\("aria-label", t\("zone\.rule"\)\);/);
  assert.doesNotMatch(screen, /el\("p", "cm-journey__hint", t\("zone\.rule"\)\)/);
  assert.match(screen, /const ask = button\("cm-journey__ask cm-arcade-key", "\?", \(\) => \{ practiceRulesOpen = !practiceRulesOpen; paint\(\); \}\);/);
  assert.match(screen, /rules\.hidden = !practiceRulesOpen;/);
  for (const locale of ['zh-Hant', 'en', 'ja', 'th', 'vi']) {
    for (const key of ['zone.star1', 'zone.star2', 'zone.star3']) {
      const word = journeyText(key, {}, locale);
      assert.ok(word.length > 0 && word !== key, `${locale} ${key}`);
      assert.ok([...word].length <= 14, `${locale} ${key}: ${word}`);
    }
  }
  assert.deepEqual(['zone.star1', 'zone.star2', 'zone.star3'].map(key => journeyText(key, {}, 'zh-Hant')), ['通關', '90 秒內', '無人倒下']);
  const css = source('src/championship/app/ui/journey.css');
  for (const rule of ['.cm-journey__gauge-label {', '.cm-journey__star-chip {', '.cm-journey__ask {', ':root[data-motion="reduced"] .cm-journey__gauge[data-full="true"] { animation: none; }'])
    assert.ok(css.includes(rule), rule);
  assert.doesNotMatch(css.slice(css.indexOf('JOURNEY_GLANCE_20261118')), /font-size: \d+px/);
});
