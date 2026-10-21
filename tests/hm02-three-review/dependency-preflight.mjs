// Run in the EXACT staged repo used for CI, before any browser/harness launch.
// No installation, network, browser, or application/storage initialization.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
const root=path.resolve(process.argv[2]??process.cwd());
const json=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const pkg=json('package.json'),lock=json('package-lock.json');
for(const [name,version]of [['three','0.185.1'],['pixi.js','8.19.0']]){
 assert.equal(pkg.dependencies[name],version);assert.equal(lock.packages[`node_modules/${name}`].version,version);
 assert.equal(json(`node_modules/${name}/package.json`).version,version);
}
const html=fs.readFileSync(path.join(root,'championship.html'),'utf8');
const imports=JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
assert.equal(path.resolve(root,imports.three),path.join(root,'node_modules/three/build/three.module.js'));
const helper=path.join(root,'src/championship/presentation/vs2/loadHM02ThreePilot.mjs');
const addon=path.resolve(path.dirname(helper),'../../../../node_modules/three/examples/jsm/loaders/GLTFLoader.js');
assert.equal(addon,path.join(root,'node_modules/three/examples/jsm/loaders/GLTFLoader.js'));
const THREE=await import(pathToFileURL(path.resolve(root,imports.three)).href);
const {GLTFLoader}=await import(pathToFileURL(addon).href);
const PIXI=await import(pathToFileURL(path.join(root,'assets/production/public-runtime/vendor-pixi.mjs')).href);
assert.equal(THREE.REVISION,'185');assert.equal(PIXI.VERSION,'8.19.0');assert.equal(typeof GLTFLoader,'function');
const files=[imports.three,'node_modules/three/examples/jsm/loaders/GLTFLoader.js','assets/production/public-runtime/vendor-pixi.mjs'];
console.log(JSON.stringify({status:'PASS',root,three:'0.185.1',pixi:'8.19.0',rawCallerImportMapResolved:true,addonRelativeImportResolved:true,files:files.map(p=>({path:p,sha256:createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')})),gpu:false},null,2));
