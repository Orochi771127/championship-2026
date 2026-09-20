import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.argv[2];
const bankFolder = process.argv[3] ?? 'candidate-r03-higgsfield-final';
const reportFolder = process.argv[4] ?? 'higgsfield-r01';
assert.ok(base?.startsWith('docs/art/production/characters/appearance-refresh-v1/sheet-jobs-v1/'));
assert.ok(/^[a-z0-9-]+$/.test(bankFolder) && /^[a-z0-9-]+$/.test(reportFolder));
const sourceBank = JSON.parse(await fs.readFile(`${base}/${bankFolder}/bank.json`, 'utf8'));
const contract = JSON.parse(await fs.readFile(`docs/art/production/characters/appearance-refresh-v1/generated/entities/${sourceBank.entityId}/motion-contract.json`, 'utf8'));
const requiredCells = Object.values(contract.sides).reduce((n, side) => n + side.frameKeys.length, 0);
const requiredSequences = Object.values(contract.sides).reduce((n, side) => n + side.sequences.length, 0);
await fs.mkdir(`${base}/${reportFolder}`, {recursive:true});
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  const page = await browser.newPage({viewport:{width:1100,height:1100}});
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:8732/${base}/review.html`);
  await page.waitForSelector('body[data-ready="true"]');
  const result = await page.evaluate(async ({bankFolder}) => {
    const bank = await (await fetch(`${bankFolder}/bank.json`)).json();
    const selector = document.querySelector('#sequence');
    let checkedTicks = 0;
    for (const entry of bank.sequences) {
      selector.value = `${entry.side}:${entry.sequence.id}`;
      selector.dispatchEvent(new Event('change'));
      const s = entry.sequence, frames = s.frames.slice(s.loopStartFrame);
      const total = frames.reduce((n, f) => n + f.ticks, 0);
      for (let tick = 0; tick <= total + 1; tick++) {
        let residual = s.playbackMode === 2 ? tick % total : Math.min(tick, total - 1);
        let expected = frames.at(-1).cell;
        for (const frame of frames) {
          if (residual < frame.ticks) { expected = frame.cell; break; }
          residual -= frame.ticks;
        }
        const active = s.playbackMode === 1 && tick >= total ? 0 : 1;
        if (Number(document.body.dataset.cell) !== expected || Number(document.body.dataset.active) !== active)
          throw Error(`TIMELINE_MISMATCH ${entry.side}/${s.id} tick ${tick}`);
        document.querySelector('#step').click();
        checkedTicks++;
      }
      document.querySelector('#reset').click();
      if (Number(document.body.dataset.cell) !== frames[0].cell) throw Error('RESTART_MISMATCH');
    }
    return {checkedSequences:bank.sequences.length, checkedTicks,
      loadedCells:[...document.querySelectorAll('.tile img')].filter(x=>x.complete&&x.naturalWidth===64).length,
      nearestSampling:['native','four','large'].every(id=>!document.querySelector('#'+id).getContext('2d').imageSmoothingEnabled)};
  }, {bankFolder});
  assert.equal(result.checkedSequences, requiredSequences);
  assert.equal(result.loadedCells, requiredCells);
  assert.equal(result.nearestSampling, true);
  assert.deepEqual(errors, []);
  await page.locator('#sequence').selectOption('main:16');
  await page.screenshot({path:`${base}/${reportFolder}/browser-bound-review.png`});
  await fs.writeFile(`${base}/${reportFolder}/browser-validation.json`, JSON.stringify({
    ...result, status:'PASS_COMPLETE_SEQUENCE_PREVIEW', pageErrors:errors,
    normalGameQa:'NOT_RUN', fullCharacterArtAcceptance:false, sourceClock:'EXISTING_NATIVE_TIMELINE',
    sourceOrigin:sourceBank.sourceOrigin, scales:[1,4,8]
  },null,2)+'\n');
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
