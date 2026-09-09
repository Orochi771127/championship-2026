import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildWebArtifact,INTERNAL_TARGET} from './lib/web-build-artifact.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const result=buildWebArtifact({root,output:path.resolve(process.argv[2]??path.join(root,'dist/internal-review')),target:INTERNAL_TARGET});
console.log(JSON.stringify({root:result.root,fileCount:result.manifest.fileCount,buildId:result.manifest.buildId,target:result.manifest.target}));
