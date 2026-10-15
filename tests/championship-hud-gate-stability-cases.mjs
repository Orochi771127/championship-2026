import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { uiText } from '../src/championship/text/uiText.js';
import { LOCALES, setLocale } from '../src/championship/text/locale.js';
const read=n=>fs.readFileSync(new URL('../src/championship/app/'+n,import.meta.url),'utf8');
const source=read('vs2Screens.js'), css=read('vs2Styles.css'), hud=read('intRh2Styles.css');
const block=selector=>{const start=css.indexOf(selector+' {');assert.ok(start>=0,selector);return css.slice(start,css.indexOf('}',start)+1);};
function element(tag,className='',textContent=''){return {tag,className,textContent,children:[],attributes:{},append(...children){this.children.push(...children);},setAttribute(k,v){this.attributes[k]=v;}};}
test('real preview construction puts condition beside name, never in a new card row',()=>{
 const start=source.indexOf('  const previewCopy ='),end=source.indexOf('  body.append(preview, worldPanel, fallbackPanel);',start);
 const context={element,preview:element('section'),previewImage:element('img'),uiText};
 vm.runInNewContext(source.slice(start,end)+';globalThis.copy=previewCopy;globalThis.heading=previewHeading;globalThis.status=admissionStatus;',context);
 assert.equal(context.heading.children[0].className,'cm-vs2-preview__name');
 assert.equal(context.heading.children[1],context.status);assert.equal(context.status.tag,'span');
 assert.equal(context.copy.children.length,2);assert.equal(context.copy.children[0],context.heading);
 assert.equal(context.status.attributes.role,'status');
});
test('real render publishes full translated accessible labels in all five locales',()=>{
 const start=source.indexOf('    admissionStatus.textContent ='),end=source.indexOf('    worldPresentation?.render',start);
 for(const locale of LOCALES){setLocale(locale);for(const message of ['',uiText('取得對應比賽勝利後開放。'),uiText('馴獸師階級達到 {rank} 後開放。',{rank:9})]){
 const context={uiText,gateAdmissionMessage:()=>message,block:{admission:{}},admissionStatus:element('span'),previewName:element('strong','',uiText('請選擇目的地'))};
 vm.runInNewContext(source.slice(start,end),context);
 const s=context.admissionStatus;assert.equal(s.hidden,!message);assert.equal(s.title,message);assert.equal(s.attributes['aria-label'],message);
 assert.equal(context.previewName.title,context.previewName.textContent);
 }}
});
test('CSS locks title row geometry and constrains both long labels, not their string lengths',()=>{
 const h=block('.cm-vs2-preview__heading');assert.match(h,/display: flex/);assert.match(h,/flex-wrap: nowrap/);assert.match(h,/height: 24px/);assert.match(h,/min-width: 0/);assert.match(h,/overflow: hidden/);
 const s=block('.cm-vs2-preview__heading .cm-vs2-gate-admission');for(const rule of ['max-width: 58%','margin: 0','white-space: nowrap','overflow: hidden','text-overflow: ellipsis','line-height: 18px'])assert.ok(s.includes(rule));
 assert.match(block('.cm-vs2-preview__heading .cm-vs2-preview__name'),/min-width: 0/);
 assert.ok(source.includes('worldHost.append(dragHint);'));assert.ok(!source.includes('previewCopy.append(admissionStatus)'));
});
test('Raising-only HUD strips plate not glyph opacity or button geometry',()=>{
 const added=hud.slice(hud.indexOf('/* Raising HUD:'));assert.ok(added);assert.match(added,/border-bottom: 0/);assert.match(added,/background: transparent/);assert.match(added,/border-color: transparent/);assert.match(added,/text-shadow:/);assert.match(added,/drop-shadow/);
 assert.doesNotMatch(added,/\bopacity\s*:|pointer-events\s*:|min-height\s*:|min-width\s*:|padding\s*:/);
 for(const rule of added.split('}').filter(s=>s.includes('{')))assert.ok(rule.includes('data-active-screen="RAISING_HOME"'));
});
