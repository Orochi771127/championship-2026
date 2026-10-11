import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const css=read('src/championship/app/mobileTouch.css');
test('scoped gesture guards cover game root plus separately mounted HUD, toolbar and dialogs',()=>{
 assert.match(css,/#cm-root, #cm-title, \.cm-status-bar, \.cm-toolbar, \.cm-dialog, \.cm-sheet, \.cm-settings/);
 assert.equal((css.match(/touch-action\s*:/g)||[]).length,1);
 assert.match(css,/touch-action:\s*manipulation/);
 assert.doesNotMatch(css,/(?:^|\})\s*(?:html|body|\*)\s*[{,]/m);
 assert.doesNotMatch(css,/touch-action:\s*none|!important/);
});
test('editable, readable, help, errors and shared-code selection/callouts have explicit exceptions',()=>{
 for(const term of ['input, textarea','[contenteditable="true"]','[contenteditable="plaintext-only"]','[data-selectable="true"]','.cm-help-shell','.cm-dialog__message','[role="alert"]','[role="status"]'])assert.ok(css.includes(term),term);
 assert.match(css,/-webkit-user-select:\s*text/);assert.match(css,/user-select:\s*text/);assert.match(css,/-webkit-touch-callout:\s*default/);
});
test('stylesheet loads after theme layers without disabling viewport scaling',()=>{
 const html=read('championship.html');assert.ok(html.indexOf('mobileTouch.css')>html.indexOf('nativeUiSkin.css'));
 assert.equal((html.match(/mobileTouch\.css/g)||[]).length,1);
 assert.doesNotMatch(html,/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/);
 assert.match(html,/width=device-width, initial-scale=1, viewport-fit=cover/);
});
