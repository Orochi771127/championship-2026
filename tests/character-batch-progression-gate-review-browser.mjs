import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import opening from './championship-browser-opening.cjs';

const [entity,revision,gateId]=process.argv.slice(2);
if(!entity||!revision||!gateId)throw Error(
  'usage: node tests/character-batch-progression-gate-review-browser.mjs ENTITY REVISION GATE_ID');
const reviewKey=entity.split('_')[0];
const reportFolder=`docs/art/production/characters/appearance-refresh-v1/sheet-jobs-v1/${entity}/higgsfield-${revision}`;
const renderer=JSON.parse(await fs.readFile(`${reportFolder}/runtime-renderer-validation.json`,'utf8'));
let priorReport={};
try { priorReport=JSON.parse(await fs.readFile(`${reportFolder}/normal-game-browser-validation.json`,'utf8')); } catch {}
assert.equal(renderer.status,'PASS_LOOPBACK_RUNTIME_RENDERER_REVIEW');

const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try{
  await page.clock.install({time:new Date('2026-09-10T12:00:00Z')});
  await page.clock.setFixedTime(new Date('2026-09-10T12:34:56Z'));
  await opening.openFreshGame(page,
    `http://127.0.0.1:8732/championship.html?characterArtReview=${reviewKey}&gateMode=fallback&presentation=developer`);
  await page.waitForSelector(opening.RAISING_HOME,{timeout:20000});
  await opening.openHunt(page);
  const card=page.locator(`.cm-vs2-gates [data-gate-id="${gateId}"]`);
  await card.click();
  assert.equal(await page.locator('.cm-vs2-gates [aria-selected="true"]').getAttribute('data-gate-id'),gateId);
  const primary=page.locator('.cm-vs2-footer .cm-vs2-action--primary');
  assert.equal(await primary.isDisabled(),true,'fresh tamer must not bypass the source gate progression');
  assert.deepEqual(errors,[]);
  const gateEvidence={
    freshTamerPrimaryActionDisabled:true,progressionBypassed:false,
    sourceRoute:'AVAILABLE_AFTER_GATE_PROGRESSION'};
  const hasCapture=String(priorReport.status??'').includes('ISOLATED_CAPTURE');
  const report=hasCapture?{...priorReport,entity,revision,gateId,freshTamerGate:gateEvidence,
    rendererValidation:renderer.status,pageErrors:errors}:{status:'PASS_EXPECTED_SOURCE_PROGRESSION_GATE',entity,revision,gateId,
    ...gateEvidence,rendererValidation:renderer.status,
    normalCaptureSequenceQa:'NOT_RUN_UNTIL_SOURCE_GATE_UNLOCK',defaultRuntimeChanged:false,
    fullCharacterArtAcceptance:false,pageErrors:errors};
  await fs.writeFile(`${reportFolder}/normal-game-browser-validation.json`,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
}finally{
  await browser.close();
}
