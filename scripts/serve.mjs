import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from 'node:crypto';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number.parseInt(process.env.CHAMPIONSHIP_PORT ?? "8732", 10);
const host = process.env.CHAMPIONSHIP_HOST ?? "127.0.0.1";
const rootFlag=process.argv.indexOf('--root');
const servingRoot=rootFlag<0?repoRoot:fs.realpathSync(path.resolve(process.argv[rootFlag+1]??''));
const internalManifest=rootFlag<0?null:JSON.parse(fs.readFileSync(path.join(servingRoot,'internal-build.json'),'utf8'));
const loopbackHosts=['localhost','127.0.0.1','[::1]','::1'];
// Opt-in, loopback-only art review. Substitute explicitly selected independent frames;
// never edit the product manifest, renderer, gameplay or save state.
const cagePacks=process.argv.flatMap((arg,index)=>arg==='--cage-preview'?[process.argv[index+1]]:[]);
const cagePreviews=new Map();
for(const packArgument of cagePacks){
  if(internalManifest||!loopbackHosts.includes(host))throw Error('CAGE_PREVIEW_REQUIRES_LOCAL_SOURCE_SERVER');
  if(!packArgument||packArgument.startsWith('--'))throw Error('CAGE_PREVIEW_PACK_REQUIRED');
  const pack=fs.realpathSync(path.resolve(packArgument));
  const artRoot=path.join(repoRoot,'docs/art/production/original-character-cage-r1');
  if(!pack.startsWith(`${artRoot}${path.sep}`))throw Error('CAGE_PREVIEW_OUTSIDE_ORIGINAL_ART_WORKPACK');
  const manifest=JSON.parse(fs.readFileSync(path.join(pack,'modular-manifest.json'),'utf8'));
  const proof=JSON.parse(fs.readFileSync(path.join(pack,'previews/modular-proof.json'),'utf8'));
  if(manifest.status!=='ART_PROPOSAL'||proof.status!=='ASSEMBLY_PASS_ART_REVIEW_REQUIRED'
    ||proof.fieldId!==manifest.fieldId||!/^field_cm\d{2}_\d{2}$/.test(manifest.fieldId)
    ||[manifest,proof].some(m=>m.runtimeEligible!==false||m.shippingReady!==false||m.humanApproved!==false))
    throw Error('CAGE_PREVIEW_INVALID_REVIEW_STATE');
  const sha=bytes=>createHash('sha256').update(bytes).digest('hex').toUpperCase();
  if(sha(fs.readFileSync(path.join(pack,'modular-manifest.json')))!==proof.sourceManifestSha256)
    throw Error('CAGE_PREVIEW_STALE_MANIFEST');
  const candidate=path.join(pack,'previews/composite-hd4x.png');
  if(fs.realpathSync(candidate)!==candidate)throw Error('CAGE_PREVIEW_SYMLINK_FORBIDDEN');
  const bytes=fs.readFileSync(candidate);
  if(sha(bytes)!==proof.outputs['composite-hd4x.png'])throw Error('CAGE_PREVIEW_HASH_DRIFT');
  const runtime=JSON.parse(fs.readFileSync(path.join(repoRoot,'assets/production/cage/licensed-runtime-v1/manifest.json'),'utf8'));
  const field=runtime.fields.find(f=>f.fieldId===manifest.fieldId);
  if(!field||proof.outputSize[0]!==field.worldWidthPx||proof.outputSize[1]!==field.worldHeightPx)
    throw Error('CAGE_PREVIEW_DIMENSION_OR_FRAME_DRIFT');
  const animated=field.frames.length>1;
  if(animated&&(manifest.coreFrames?.length!==field.frames.length||proof.animationFrames?.length!==field.frames.length))
    throw Error('CAGE_PREVIEW_ANIMATION_INCOMPLETE');
  for(const [index,frame] of field.frames.entries()){
    let frameBytes=bytes;
    if(animated){
      const record=proof.animationFrames[index],core=manifest.coreFrames[index];
      for(const key of ['durationMs','durationRawTicks','durationEvidence']){
        if(record[key]!==frame[key]||core[key]!==frame[key])throw Error('CAGE_PREVIEW_ANIMATION_TIMING_DRIFT');
      }
      const name=`frame-${String(index).padStart(2,'0')}.png`;
      const candidateFrame=path.join(pack,'previews',name);
      if(fs.realpathSync(candidateFrame)!==candidateFrame)throw Error('CAGE_PREVIEW_SYMLINK_FORBIDDEN');
      frameBytes=fs.readFileSync(candidateFrame);
      if(record.index!==index||record.groundCoverage?.pass!==true||sha(frameBytes)!==record.sha256||sha(frameBytes)!==proof.outputs[name])
        throw Error('CAGE_PREVIEW_ANIMATION_HASH_OR_PROOF_DRIFT');
      if(index===0&&!frameBytes.equals(bytes))throw Error('CAGE_PREVIEW_FIRST_FRAME_DRIFT');
    }
    const url=`/${frame.src}`;
    if(cagePreviews.has(url))throw Error('CAGE_PREVIEW_DUPLICATE_FIELD');
    cagePreviews.set(url,{url,bytes:frameBytes,fieldId:manifest.fieldId,sha256:sha(frameBytes)});
  }
}
if(internalManifest&&(internalManifest.target!=='LOCAL_INTERNAL_REVIEW'||internalManifest.loopbackOnly!==true
  ||internalManifest.publicReleasePermitted!==false||!loopbackHosts.includes(host)))throw Error('INTERNAL_REVIEW_REQUIRES_LOOPBACK');
const allowedFiles=internalManifest?new Set([...internalManifest.files.map(r=>r.path),'internal-build.json']):null;
const mime = new Map([
  [".html", "text/html; charset=utf-8"], [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"],
  [".css", "text/css; charset=utf-8"], [".png", "image/png"], [".webp", "image/webp"],
  [".glb", "model/gltf-binary"], [".wav", "audio/wav"], [".svg", "image/svg+xml"]
]);

const server = http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", `http://${host}`).pathname);
    const requested = pathname === "/" ? "/championship.html" : pathname;
    const cagePreview=cagePreviews.get(pathname);
    if(cagePreview){
      const remote=request.socket.remoteAddress;
      const requestHost=new URL(`http://${request.headers.host??''}`).hostname;
      if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote)||!loopbackHosts.includes(requestHost)){
        response.writeHead(403).end('Local original art review only');return;
      }
      response.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store',
        'Cross-Origin-Resource-Policy':'same-origin','X-Championship-Cage-Preview':cagePreview.fieldId,
        'X-Championship-Cage-SHA256':cagePreview.sha256});
      response.end(cagePreview.bytes);return;
    }
    const file = path.resolve(servingRoot, `.${requested}`);
    if (file !== servingRoot && !file.startsWith(`${servingRoot}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    const relative=path.relative(servingRoot,file).replaceAll('\\','/');
    if(allowedFiles&&!allowedFiles.has(relative)) { response.writeHead(404).end('Not found');return; }
    const localBattleReferences = ['battle-effects-v1','battle-audio-v1'].map(name=>path.join(servingRoot, 'assets/production/internal-faithful-baseline',name));
    if (internalManifest||localBattleReferences.some(prefix=>file.startsWith(`${prefix}${path.sep}`))) {
      const remote = request.socket.remoteAddress;
      const requestHost = new URL(`http://${request.headers.host ?? ''}`).hostname;
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)
        || !['localhost', '127.0.0.1', '[::1]'].includes(requestHost)) {
        response.writeHead(403).end('Local research preview only');
        return;
      }
    }
    const stat = fs.statSync(file);
    if (!stat.isFile()) throw new Error("not a file");
    if(internalManifest){
      const real=fs.realpathSync(file);
      if(real!==file){response.writeHead(403).end('Forbidden');return;}
      response.setHeader('X-Championship-Build',internalManifest.buildId);
    }
    response.writeHead(200, {
      "Content-Type": mime.get(path.extname(file).toLowerCase()) ?? "application/octet-stream",
      "Cache-Control": "no-store",
      "Cross-Origin-Resource-Policy": "same-origin"
    });
    fs.createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`Championship 2026: http://${host}:${server.address().port}/championship.html`);
  for(const cagePreview of cagePreviews.values())console.log(`LOCAL_ART_REVIEW_ONLY ${cagePreview.fieldId} ${cagePreview.sha256}`);
});
