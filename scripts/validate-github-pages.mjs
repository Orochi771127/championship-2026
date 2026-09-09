import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateWebArtifact,PUBLIC_TARGET} from './lib/web-build-artifact.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const result=validateWebArtifact({root,output:path.resolve(process.argv[2]??path.join(root,'dist/github-pages')),target:PUBLIC_TARGET});
console.log(JSON.stringify({fileCount:result.fileCount,buildId:result.buildId,target:result.target}));
