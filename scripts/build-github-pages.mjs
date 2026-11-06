import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildWebArtifact,PUBLIC_TARGET,PLAYTEST_TARGET} from './lib/web-build-artifact.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),playtest=args.includes('--playtest'),externalCharacters=args.includes('--external-characters');
const positional=args.filter(arg=>!['--playtest','--external-characters'].includes(arg));
if(positional.length>1||positional.some(arg=>arg.startsWith('--')))throw Error('INVALID_BUILD_ARGUMENTS');
const result=buildWebArtifact({root,output:path.resolve(positional[0]??path.join(root,playtest?'dist/github-playtest':'dist/github-pages')),target:playtest?PLAYTEST_TARGET:PUBLIC_TARGET,externalCharacters});
console.log(JSON.stringify({root:result.root,fileCount:result.manifest.fileCount,buildId:result.manifest.buildId,target:result.manifest.target,externalCharacterAssets:result.manifest.externalCharacterAssets??null}));
