import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const repairR05=process.argv.includes('--repair-r05');
const repairR04=process.argv.includes('--repair-r04');
const repairR03=process.argv.includes('--repair-r03');
const repaired=repairR05||repairR04||repairR03||process.argv.includes('--repair-r02');
const fullSheet=repaired||process.argv.includes('--full-sheet');
const nativeReview=fullSheet||process.argv.includes('--native-r05');
const base='docs/art/production/original-character-cage-r1/m001-pipeline-v1/'+(repairR05?'full-sheet-r05':repairR04?'full-sheet-r04':repairR03?'full-sheet-r03':repaired?'full-sheet-r02':fullSheet?'full-sheet-r01':nativeReview?'native-r05':'expression-review-r02');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1100,height:1100}}),errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.goto(`http://127.0.0.1:8732/${base}/review.html`);
 await page.waitForSelector('body[data-ready="true"]');
 const snapshot=()=>page.locator('body').evaluate(el=>({cell:Number(el.dataset.cell),active:Number(el.dataset.active)}));
 assert.deepEqual(await snapshot(),{cell:11,active:1});
 for(let i=0;i<14;i++)await page.locator('#step').click();
 assert.deepEqual(await snapshot(),{cell:11,active:1});
 await page.locator('#step').click();
 assert.deepEqual(await snapshot(),{cell:12,active:1});
 for(let i=0;i<36;i++)await page.locator('#step').click();
 assert.deepEqual(await snapshot(),{cell:12,active:1});
 await page.locator('#step').click();
 assert.deepEqual(await snapshot(),{cell:12,active:0});
 await page.locator('#step').click();
 assert.deepEqual(await snapshot(),{cell:12,active:0});
 await page.screenshot({path:`${base}/review-open.png`});
 await page.locator('#reset').click();
 assert.deepEqual(await snapshot(),{cell:11,active:1});
 await page.screenshot({path:`${base}/review-closed.png`});
 await page.locator('#rate').fill('120');await page.locator('#play').click();
 await page.waitForSelector('body[data-active="0"]');
 assert.deepEqual(await snapshot(),{cell:12,active:0});
 let checkedSequences=1;
 if(nativeReview){
  const bank=JSON.parse(await fs.readFile(`${base}/${repaired?'compiled-final':fullSheet?'compiled-aligned':'compiled'}/bank.json`,'utf8'));
  checkedSequences=0;
  for(const entry of bank.sequences.filter(s=>s.available)){
   await page.locator('#sequence').selectOption(entry.side+':'+entry.sequence.id);
   const s=entry.sequence,frames=s.frames.slice(s.loopStartFrame);
   const total=frames.reduce((n,f)=>n+f.ticks,0);
   for(let tick=0;tick<=total+1;tick++){
    let residual=s.playbackMode===2?tick%total:Math.min(tick,total-1),expected=frames.at(-1).cell;
    for(const frame of frames){if(residual<frame.ticks){expected=frame.cell;break;}residual-=frame.ticks;}
    assert.deepEqual(await snapshot(),{cell:expected,active:s.playbackMode===1&&tick>=total?0:1},`${entry.side}/${s.id} tick ${tick}`);
    await page.locator('#step').evaluate(button=>button.click());
   }
   checkedSequences++;
  }
  assert.equal(await page.locator('#sequence option:disabled').count(),bank.requiredSequences-bank.availableSequences);
  assert.equal(await page.locator('.tile img').count(),bank.deliveredSlots);
  assert.equal(await page.locator('.missing').count(),bank.requiredSlots-bank.deliveredSlots);
  await page.locator('#sequence').selectOption('main:7');
  await page.locator('#background').click();await page.screenshot({path:`${base}/review-light.png`});
 }
 assert.deepEqual(errors,[]);
 await fs.writeFile(`${base}/browser-validation.json`,JSON.stringify({scope:fullSheet?'COMPLETE_CANDIDATE_BANK_TIMELINE_ONLY':nativeReview?'NATIVE_AUTHORED_AVAILABLE_SEQUENCES':'CANDIDATE_SEQUENCE_7_REVIEW_ONLY',checkedSequences,nativeTimelineReused:true,sourceSequence:7,cells:[11,12],ticks:[15,37],playbackMode:1,loopStartFrame:0,boundaryChecks:[14,15,51,52,53],result:'PASS',pageErrors:errors,normalGameIntegration:'NOT_RUN',fullMotionValidation:'INCOMPLETE',humanApproval:false},null,2)+'\n');
 console.log('PASS: native tick boundaries, stop, restart, image loads; normal game NOT_RUN');
}finally{await browser.close();}
