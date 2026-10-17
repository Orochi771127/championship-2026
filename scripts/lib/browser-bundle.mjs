import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Compilation inputs retain their approved hashes. Only the deterministic
// compiled program is published; explicit runtime script URLs keep their files.
export function compiledPublicArtifactPlan(source,bundle){
  if(!bundle)return {...source,generatedFiles:[],omittedCompiledScripts:[]};
  const approved=new Map(source.allowlist.files.map(row=>[row.path,row.sha256]));
  const runtime=new Set(bundle.metadata.runtimeScriptFiles??[]);
  for(const row of source.runtime?.assets??[])if(row.src)runtime.add(row.src);
  const omitted=new Set();
  for(const row of bundle.metadata.inputFiles){
    if(approved.get(row.path)!==row.sha256)throw Error('PUBLIC_COMPILED_SOURCE_HASH: '+row.path);
    if(/\.m?js$/.test(row.path)&&!runtime.has(row.path))omitted.add(row.path);
  }
  const generatedFiles=bundle.metadata.generatedFiles;
  return {...source,files:source.files.filter(file=>!omitted.has(file)),
    moduleEntries:[...source.moduleEntries.filter(file=>!omitted.has(file)),...generatedFiles],generatedFiles,
    importMap:Object.fromEntries(Object.entries(source.importMap??{}).filter(([,file])=>!omitted.has(file.replace(/^\.\//,'')))),
    omittedCompiledScripts:[...omitted].sort()};
}

export function compileBrowserBundle(root,input){
  if(!input.browserBundle)return null;
  const result=JSON.parse(execFileSync(process.execPath,[fileURLToPath(new URL('./browser-bundle-worker.mjs',import.meta.url))],
    {cwd:root,input:JSON.stringify({root,files:input.files,recipe:input.browserBundle,importMap:input.importMap}),encoding:'utf8',
      maxBuffer:64*1024*1024,windowsHide:true}));
  return {...result,files:result.files.map(file=>({path:file.path,bytes:Buffer.from(file.base64,'base64')}))};
}

export function bundledBrowserHtml(source,metadata,importMap){
  const block=/    <!-- modulepreload:[\s\S]*?    <!-- \/modulepreload -->/;
  const script='./src/championship/app/main.js?v=settings-2';
  if(!block.test(source)||!source.includes(script))throw Error('BROWSER_BUNDLE_HTML_ENTRY_MISMATCH');
  // The HTML inserts its module script dynamically. Preload that entry first so
  // it does not start behind decorative title images on a cold connection.
  const links=[metadata.entry,...metadata.startupModules.filter(file=>file!==metadata.entry)]
    .map(file=>`    <link rel="modulepreload" href="./${file}"${file===metadata.entry?' fetchpriority="high"':''}>`).join('\n');
  let html=source.replace(block,links).replace(script,'./'+metadata.entry);
  if(importMap){
    const map=/<script\s+type="importmap">[\s\S]*?<\/script>/g;
    if([...html.matchAll(map)].length!==1)throw Error('BROWSER_BUNDLE_IMPORT_MAP_MISMATCH');
    html=html.replace(map,`<script type="importmap">${JSON.stringify({imports:importMap})}</script>`);
  }
  return html;
}
