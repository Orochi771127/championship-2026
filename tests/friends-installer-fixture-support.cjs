// Private test transport only: never write QA tooling into the public artifact.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function createInstallerFixtures(repo){
 const html=fs.readFileSync(path.join(repo,'full-qa-save.html'),'utf8');
 const scripts=[...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,1,'The original QA installer must have exactly one module script');
 // Bundle the unchanged installer code and its actual save/expansion helpers.
 // No private src tree is exposed, no localStorage injection, no fixture edits.
 const result=await require('esbuild').build({
  stdin:{contents:scripts[0][1],resolveDir:repo,sourcefile:'full-qa-save.html.js',loader:'js'},
  bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',metafile:true
 });
 assert.equal(result.outputFiles.length,1,'Installer must be one self-contained module');
 assert.ok(Object.values(result.metafile.outputs).every(output=>output.imports.length===0),'Installer cannot expose source-module requests');
 const seedText=fs.readFileSync(path.join(repo,'qa/championship-full-qa-save.json'),'utf8');
 const seed=JSON.parse(seedText);
 const routes=new Map([
  ['/full-qa-save.html',{contentType:'text/html',body:html.replace(scripts[0][0],'<script type="module" src="./__friends-fixtures/installer.js"></script>')}],
  ['/__friends-fixtures/installer.js',{contentType:'text/javascript',body:result.outputFiles[0].text}],
  ['/qa/championship-full-qa-save.json',{contentType:'application/json',body:seedText}]
 ]);
 return {seed,route:pathname=>routes.get(pathname)};
}
module.exports={createInstallerFixtures};
