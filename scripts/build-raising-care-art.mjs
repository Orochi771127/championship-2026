// Independently authored editable SVG artwork. No source pixels, geometry,
// palettes or ROM files are read. Item identity and four amounts are gameplay.
import {mkdir,writeFile} from 'node:fs/promises';
const dir=new URL('../assets/production/raising-care-r1/',import.meta.url);
await mkdir(dir,{recursive:true});
const svg=body=>`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 32 32">${body}</svg>\n`;
const bone='<path d="m10 21-4 4c-3-2-5 1-3 3 1 1 2 1 3 0 1 3 5 2 4-1l5-5" fill="#fff5d6" stroke="#473c35" stroke-width="1.2" stroke-linejoin="round"/><path d="m8 26 6-6" stroke="#d5bb82" stroke-width="1.1"/>';
const meat='<path d="M10 21C6 15 11 7 18 5c6-2 12 3 11 9-1 6-8 11-14 10Z" fill="#ae482c" stroke="#473027" stroke-width="1.3"/><path d="M11 18C9 13 14 8 19 7c4-1 7 2 7 5-1 5-8 9-12 9Z" fill="#df8039"/><path d="M14 12c2-3 5-4 8-3M12 16l2-1" fill="none" stroke="#ffd58b" stroke-width="1.8" stroke-linecap="round"/><path d="m16 18 3-4m1 6 3-4" stroke="#a94b2b" stroke-width="1.3" stroke-linecap="round"/>';
const capsule='<g transform="rotate(42 16 16)"><rect x="10" y="2" width="12" height="28" rx="6" fill="#d7454e" stroke="#303f57" stroke-width="1.3"/><path d="M10 16V8a6 6 0 0 1 12 0v8Z" fill="#bce8f1" stroke="#303f57" stroke-width="1.1"/><path d="M12.5 12V8a3.5 3.5 0 0 1 3.5-3.5" fill="none" stroke="#fffbee" stroke-width="1.8" stroke-linecap="round"/><path d="M12.5 19v4" stroke="#ffaaa4" stroke-width="1.8" stroke-linecap="round"/><path d="M19.5 18v6c0 2-1 3-2 3" fill="none" stroke="#a73248" stroke-width="1.2"/></g>';
const files=[];
async function emit(name,body){await writeFile(new URL(name,dir),svg(body));files.push(name);}
for(const [kind,art] of [['meat',meat],['protein',capsule]])for(let q=0;q<4;q++){
  // Missing portions expose the bone / remove the upper end of the capsule.
  // Deliberately drawn contours, not a scaled copy of a source cell.
  const masks=kind==='meat'?['','<path d="M18 0h14v14c-2-2-4-1-4 2-4-2-6 0-5 3-4-1-5 1-5 3Z" fill="black"/>','<path d="M12 0h20v32H20c1-4-2-4-4-3 2-4-1-5-4-4Z" fill="black"/>','<rect x="0" y="0" width="32" height="32" fill="black"/>']:
    ['', '<path d="M14 0h18v15c-3-2-4 0-4 2-3-2-6-1-6 2-3-1-5 1-5 3Z" fill="black"/>','<path d="M9 0h23v23c-3-1-4 0-4 3-3-2-5 0-5 2L9 16Z" fill="black"/>','<path d="M0 0h32v24H12l-4-5Z" fill="black"/>'];
  await emit(`${kind}-${q}.svg`,`<defs><mask id="amount"><rect width="32" height="32" fill="white"/>${masks[q]}</mask></defs>${kind==='meat'?bone:''}<g mask="url(#amount)">${art}</g>${kind==='meat'&&q===3?'<path d="m12 22 3-4 3 2-3 4Z" fill="#9d432d" stroke="#473027"/>':''}`);
}
await emit('clean.svg','<path d="M5 23c-2-2 0-5 3-5-1-3 1-5 4-5-1-3 1-5 5-7-1 4 4 4 3 8 4 0 6 4 3 6 5 2 5 7 1 8-7 2-17 1-20-1-2-1-1-3 1-4Z" fill="#bf7c36" stroke="#553923" stroke-width="1.3"/><path d="M9 18c3 2 8 2 11 0M6 23c4 3 12 3 17 0M13 13c2 1 4 1 6 0" fill="none" stroke="#ffe6a0" stroke-width="1.5" stroke-linecap="round"/>');
await emit('broom.svg','<path d="m22 3-3 18" stroke="#4d3a2e" stroke-width="4" stroke-linecap="round"/><path d="m22 3-3 18" stroke="#cc8752" stroke-width="2" stroke-linecap="round"/><path d="m15 18 8 1 4 10c-5 2-10 0-14-2Z" fill="#efd481" stroke="#5a4c37" stroke-width="1.2"/><path d="m15 20 8 1" stroke="#66918b" stroke-width="3"/><path d="m17 23-1 4m4-4v5m2-4 1 4" stroke="#b48545" stroke-width="1"/><path d="m2 23 9-2 5 8-10 2Z" fill="#83a39e" stroke="#3d5556" stroke-width="1.2"/><path d="m2 23 5 5 9 1M7 28l4-5" fill="none" stroke="#dce9d3" stroke-width="1.2"/>');
// Celebration food uses the same four remaining-amount frames as ordinary
// food. These drawings are independent art; original food kinds/timing stay
// in the native gameplay module.
const cake='<path d="M5 15h22v12c-6 3-16 3-22 0Z" fill="#edb677" stroke="#503f50" stroke-width="1.2"/><path d="M5 21h22v3H5Z" fill="#ef7187"/><ellipse cx="16" cy="15" rx="11" ry="5" fill="#fff4d9" stroke="#503f50" stroke-width="1.2"/><path d="M6 15v4q2 4 4 0v-1q2 4 4 0v1q2 4 4 0v-1q2 4 4 0v1q2 4 4 0v-4" fill="#fff4d9"/><path d="M15 15V8h2v7" fill="#65b8da" stroke="#38648a" stroke-width=".8"/><path d="M16 8c-3-2-1-4 0-6 0 2 3 4 0 6" fill="#ffc846" stroke="#ca7540" stroke-width=".7"/><circle cx="9" cy="13" r="2" fill="#eb5d71"/><circle cx="23" cy="13" r="2" fill="#eb5d71"/>';
const feast='<ellipse cx="16" cy="26" rx="14" ry="4" fill="#daf0e8" stroke="#3e6259" stroke-width="1.2"/><path d="M7 24c-2-5 1-12 9-14 7-2 13 5 10 12-5 4-12 5-19 2Z" fill="#b6632e" stroke="#513b2c" stroke-width="1.2"/><path d="M9 20c-1-4 4-9 9-8 4 0 6 3 5 6-4 4-9 5-14 2Z" fill="#e8a54e"/><path d="m13 15 3 6m1-8 3 6" stroke="#9a572c" stroke-width="1.2"/><path d="m6 24-2-6 5 3m13 4 5-5 2 5" fill="#6baf68" stroke="#3e7250" stroke-width="1"/>';
for(const [kind,art] of [['cake',cake],['feast',feast]])for(let q=0;q<4;q++){
  const eaten=['','<path d="M20 0h12v32H23c0-3-3-3-3-5 3-2 1-4-2-5 3-1 1-4-1-5Z" fill="black"/>','<path d="M15 0h17v32H17c2-2-2-3-2-5 2-1-1-4-3-4 3-2 0-3-1-4Z" fill="black"/>','<path d="M0 0h32v24H0Z" fill="black"/><path d="M12 24h20v8H12Z" fill="black"/>'];
  await emit(`${kind}-${q}.svg`,`<defs><mask id="amount"><rect width="32" height="32" fill="white"/>${eaten[q]}</mask></defs><ellipse cx="16" cy="28" rx="13" ry="3" fill="#d6e8df" stroke="#53695f" stroke-width="1"/><g mask="url(#amount)">${art}</g>`);
}
await writeFile(new URL('manifest.json',dir),JSON.stringify({id:'raising-care-r1',source:'INDEPENDENTLY_AUTHORED_VECTOR',generator:'scripts/build-raising-care-art.mjs',reference:'Generic item identities: bone-in meat, two-color capsule, waste, broom, dustpan, birthday cake and roast platter. No original asset bytes copied.',files,runtimeEligible:true,scope:'Existing Raising food, celebration gift and Clean presentation',physicalDeviceQA:false,shippingReady:false},null,2)+'\n');
console.log(`Wrote ${files.length} independently authored care SVGs.`);
