import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number.parseInt(process.env.CHAMPIONSHIP_PORT ?? "8732", 10);
const host = process.env.CHAMPIONSHIP_HOST ?? "127.0.0.1";
const rootFlag=process.argv.indexOf('--root');
const servingRoot=rootFlag<0?repoRoot:fs.realpathSync(path.resolve(process.argv[rootFlag+1]??''));
const internalManifest=rootFlag<0?null:JSON.parse(fs.readFileSync(path.join(servingRoot,'internal-build.json'),'utf8'));
const loopbackHosts=['localhost','127.0.0.1','[::1]','::1'];
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
});
