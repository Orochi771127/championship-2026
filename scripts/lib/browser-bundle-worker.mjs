import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as esbuild from 'esbuild';

// Build-only packaging of the existing application. Every source read must be
// present in the already audited public input set; no new runtime authority.
let raw='';for await(const chunk of process.stdin)raw+=chunk;
const {root,files,recipe}=JSON.parse(raw),allowed=new Set(files);
if(recipe.version!==1||recipe.entry!=='src/championship/app/main.js'
  ||recipe.outputDirectory!=='src/championship/app/_bundled'||recipe.toolVersion!==esbuild.version)
  throw Error('BROWSER_BUNDLE_RECIPE_MISMATCH');
const outdir=path.join(root,recipe.outputDirectory),sources=new Map();
const result=await esbuild.build({absWorkingDir:root,entryPoints:[recipe.entry],outdir,
  entryNames:'main-[hash]',chunkNames:'chunk-[hash]',bundle:true,splitting:true,
  format:'esm',platform:'browser',target:'es2022',metafile:true,write:false,
  minifyWhitespace:true,minifySyntax:true,minifyIdentifiers:false,keepNames:true,charset:'utf8',
  external:['node:*'],logLevel:'silent',plugins:[{name:'approved-source-and-module-urls',setup(build){
    build.onLoad({filter:/\.(?:m?js|json)$/},async args=>{
      const file=path.relative(root,args.path).replaceAll('\\','/');
      if(!allowed.has(file))throw Error(`BROWSER_BUNDLE_UNAPPROVED_INPUT: ${file}`);
      const bytes=fs.readFileSync(args.path);sources.set(file,createHash('sha256').update(bytes).digest('hex'));
      let contents=bytes.toString('utf8');const loader=file.endsWith('.json')?'json':'js';
      if(loader==='js'&&contents.includes('import.meta.url')){
        // Parse the replacement instead of changing occurrences inside strings.
        // All emitted chunks share this directory, so original relative asset
        // URLs keep exactly their source-module base after code splitting.
        const original=path.relative(outdir,args.path).replaceAll('\\','/');
        contents=(await esbuild.transform(contents,{loader:'js',format:'esm',target:'esnext',
          sourcefile:file,define:{'import.meta.url':'__cmOriginalModuleURL'},
          banner:`const __cmOriginalModuleURL=new URL(${JSON.stringify(original)},import.meta.url).href;`
        })).code;
      }
      return {contents,loader};
    });
  }}]});
for(const file of Object.keys(result.metafile.inputs))if(!allowed.has(file))throw Error(`BROWSER_BUNDLE_UNAPPROVED_INPUT: ${file}`);
const outputs=result.metafile.outputs,entry=Object.keys(outputs).find(file=>outputs[file].entryPoint===recipe.entry);
if(!entry)throw Error('BROWSER_BUNDLE_ENTRY_MISSING');
const startup=new Set();
function visit(file){if(startup.has(file))return;startup.add(file);for(const item of outputs[file].imports)
  if(item.kind==='import-statement'&&!item.external)visit(item.path);}
visit(entry);
const generated=result.outputFiles.map(file=>({path:path.relative(root,file.path).replaceAll('\\','/'),base64:Buffer.from(file.contents).toString('base64')}));
if(generated.some(file=>!file.path.startsWith(recipe.outputDirectory+'/')||!file.path.endsWith('.js')))
  throw Error('BROWSER_BUNDLE_OUTPUT_BOUNDARY');
process.stdout.write(JSON.stringify({files:generated,metadata:{version:1,tool:'esbuild',toolVersion:esbuild.version,
  entry,startupModules:[...startup].sort(),generatedFiles:generated.map(f=>f.path).sort(),
  inputFiles:[...sources].sort(([a],[b])=>a.localeCompare(b,'en')).map(([file,sha256])=>({path:file,sha256}))},
  warnings:result.warnings.map(w=>({id:w.id,text:w.text,file:w.location?.file}))}));
