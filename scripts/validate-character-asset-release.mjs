import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateCharacterAssetSnapshot} from './lib/external-character-assets.mjs';
import {assertPublicBytes,PUBLIC_RUNTIME_ALLOWLIST_PATH} from './lib/public-runtime-boundary.mjs';
import {assertPagesPayloadSize} from './lib/pages-payload-size.mjs';
const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [directory,expectedManifestSha256,...extra]=process.argv.slice(2);
if(!directory||extra.length||expectedManifestSha256&&!/^[a-f0-9]{64}$/.test(expectedManifestSha256))
 throw Error('Usage: node scripts/validate-character-asset-release.mjs VERSION_DIRECTORY [MANIFEST_SHA256]');
const root=path.resolve(directory),allowlist=JSON.parse(fs.readFileSync(path.join(source,PUBLIC_RUNTIME_ALLOWLIST_PATH),'utf8'));
const result=validateCharacterAssetSnapshot(root,{expectedManifestSha256,assertBytes:assertPublicBytes,allowlist});
const totalBytes=assertPagesPayloadSize([{path:'character-assets',bytes:result.totalBytes},
 {path:'runtime-manifest.json',bytes:fs.statSync(path.join(root,'runtime-manifest.json')).size}]);
console.log(JSON.stringify({status:'EXTERNAL_CHARACTER_SNAPSHOT_VALIDATED',...result,totalSiteBytes:totalBytes}));
