import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateWebArtifact,PUBLIC_TARGET,PLAYTEST_TARGET} from './lib/web-build-artifact.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),playtest=args.includes('--playtest');
const result=validateWebArtifact({root,output:path.resolve(args.find(arg=>arg!=='--playtest')??path.join(root,playtest?'dist/github-playtest':'dist/github-pages')),target:playtest?PLAYTEST_TARGET:PUBLIC_TARGET});
console.log(JSON.stringify({fileCount:result.fileCount,buildId:result.buildId,target:result.target}));
