import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateWebArtifact,PLAYTEST_TARGET,PUBLIC_TARGET} from './lib/web-build-artifact.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),release=args.includes('--release');
const output=path.resolve(args.find(arg=>arg!=='--release')??path.join(root,release?'dist/github-pages':'dist/github-playtest'));
const result=validateWebArtifact({root,output,target:release?PUBLIC_TARGET:PLAYTEST_TARGET});
console.log(JSON.stringify({status:'PUBLIC_PAYLOAD_VALIDATED',buildId:result.buildId,fileCount:result.fileCount,authorityIndexIncluded:false}));
