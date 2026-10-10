import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export function compileBrowserBundle(root,input){
  if(!input.browserBundle)return null;
  const result=JSON.parse(execFileSync(process.execPath,[fileURLToPath(new URL('./browser-bundle-worker.mjs',import.meta.url))],
    {cwd:root,input:JSON.stringify({root,files:input.files,recipe:input.browserBundle}),encoding:'utf8',
      maxBuffer:64*1024*1024,windowsHide:true}));
  return {...result,files:result.files.map(file=>({path:file.path,bytes:Buffer.from(file.base64,'base64')}))};
}

export function bundledBrowserHtml(source,metadata){
  const block=/    <!-- modulepreload:[\s\S]*?    <!-- \/modulepreload -->/;
  const script='./src/championship/app/main.js?v=settings-2';
  if(!block.test(source)||!source.includes(script))throw Error('BROWSER_BUNDLE_HTML_ENTRY_MISMATCH');
  const links=metadata.startupModules.filter(file=>file!==metadata.entry)
    .map(file=>`    <link rel="modulepreload" href="./${file}">`).join('\n');
  return source.replace(block,links).replace(script,'./'+metadata.entry);
}
