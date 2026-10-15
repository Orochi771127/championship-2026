const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const origin = process.env.CHAMPIONSHIP_QA_ORIGIN || 'http://127.0.0.1:8732';
const key = 'championshipModernSave:v1';
const output = process.env.CHAMPIONSHIP_QA_OUTPUT || '/tmp/championship-qa-ranch-expansion';
fs.mkdirSync(output,{recursive:true});
const fixture=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../qa/championship-full-qa-save.json'),'utf8'));
const original=structuredClone(fixture);original.cageEdit.layoutVersion='NATIVE_ANCHORS_V1';delete original.cageEdit.expansion;
// Simulate changes made since the user installed the old QA fixture.
original.shop.bits=7654321;original.updatedAt='2026-10-15T00:00:00.000Z';
const text=JSON.stringify(original);
(async()=>{
const browser=await chromium.launch(process.env.CHAMPIONSHIP_CHROME_PATH?{executablePath:process.env.CHAMPIONSHIP_CHROME_PATH,headless:true}:{channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
await page.goto(`${origin}/full-qa-save.html`);await page.getByText('QA 存檔已驗證，可以安裝。',{exact:true}).waitFor();
await page.evaluate(([key,text])=>localStorage.setItem(key,text),[key,text]);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
const backupPromise=page.waitForEvent('download');await page.locator('#expand').click();const backup=await backupPromise;
const backupPath=path.join(output,'before-expansion.json');await backup.saveAs(backupPath);assert.equal(fs.readFileSync(backupPath,'utf8'),text);
await page.getByText('20 格擴充區已開放，原有進度與配置已保留。請按「返回遊戲」。',{exact:true}).waitFor();
const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.equal(after.cageEdit.layoutVersion,'NATIVE_DECKS_V1');
assert.deepEqual(after.cageEdit.placements,original.cageEdit.placements);const comparison=structuredClone(after);comparison.cageEdit=original.cageEdit;assert.deepEqual(comparison,original);
assert.equal(await page.evaluate(key=>localStorage.getItem(`${key}:qa-expansion-backup`),key),text);
await page.reload();await page.locator('#expand').click();await page.getByText('擴充區的 20 格已全部開放，原有進度沒有變更。',{exact:true}).waitFor();
await page.screenshot({path:path.join(output,'qa-expanded-mobile.png'),fullPage:true});
// Lock conflict: active game lock must prevent overwrite or download.
const holder=await context.newPage();await holder.goto(`${origin}/full-qa-save.html`);
await holder.evaluate(key=>{window.lockReady=false;navigator.locks.request(key,async()=>{window.lockReady=true;await new Promise(resolve=>window.releaseLock=resolve);});},key);
await holder.waitForFunction(()=>window.lockReady);
await page.locator('#expand').click();await page.getByText(/另一個遊戲分頁正在使用存檔/).waitFor();
assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key),after);
await holder.evaluate(()=>window.releaseLock());await holder.close();
// Fault injection is limited to this isolated test browser. Active save stays intact.
await page.evaluate(([key,text])=>{localStorage.setItem(key,text);Storage.prototype.setItem=function(){throw new DOMException('Quota exhausted','QuotaExceededError');};},[key,text]);
await page.locator('#expand').click();await page.locator('#status[data-state="error"]').waitFor();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),text);
await page.reload();await page.evaluate(()=>localStorage.removeItem('championshipModernSave:v1'));await page.locator('#expand').click();await page.getByText(/目前沒有存檔/).waitFor();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),null);
assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,viewport:'390x844',backupExact:true,progressPreserved:true,reloadIdempotent:true,lockConflictSafe:true,quotaFailureSafe:true,missingSaveSafe:true,pageErrors:errors},null,2));console.log('CHAMPIONSHIP_QA_RANCH_EXPANSION_BROWSER_PASS');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
