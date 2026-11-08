// Loopback static server that answers like GitHub Pages for cache purposes:
// Cache-Control max-age=600, strong ETag, Last-Modified, 304 revalidation and
// gzip for text. Every request is logged server-side, which also captures the
// requests made from Pixi's decode workers that page resource timing misses.
// Test/diagnostic support only; never used by the product.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),zlib=require('node:zlib'),crypto=require('node:crypto');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8',
  '.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4','.mp3':'audio/mpeg',
  '.ogg':'audio/ogg','.m4a':'audio/mp4','.woff2':'font/woff2','.glb':'model/gltf-binary','.webmanifest':'application/manifest+json','.wav':'audio/wav'};
const TEXT=new Set(['.html','.js','.mjs','.json','.css','.svg','.webmanifest']);

// fallbacks: [{prefix,root}] serve paths missing from the artifact from another
// tree -- e.g. assets/production/characters/ for a --external-characters build,
// whose public bytes live in a separate immutable release.
function createPagesLikeServer({root,basePath='/championship-2026/',maxAge=600,now=()=>performance.now(),fallbacks=[]}){
  root=path.resolve(root);fallbacks=fallbacks.map(f=>({prefix:f.prefix,root:path.resolve(f.root)}));
  const log=[],gzipCache=new Map(),etagCache=new Map();
  const server=http.createServer((req,res)=>{
    const started=now(),url=new URL(req.url,'http://pages.local');
    const entry={t:started,method:req.method,path:url.pathname,status:0,bytes:0,conditional:Boolean(req.headers['if-none-match']||req.headers['if-modified-since'])};
    log.push(entry);
    const done=(status,headers,body)=>{entry.status=status;entry.bytes=body?.length??0;entry.ms=now()-started;res.writeHead(status,headers);res.end(body);};
    if(!url.pathname.startsWith(basePath))return done(404,{},null);
    let rel=decodeURIComponent(url.pathname.slice(basePath.length));if(rel===''||rel.endsWith('/'))rel+='index.html';
    let file=path.resolve(root,rel),inside=file.startsWith(root+path.sep);
    if(inside&&!fs.existsSync(file))for(const f of fallbacks){
      if(!rel.startsWith(f.prefix))continue;
      const candidate=path.resolve(f.root,rel);if(candidate.startsWith(f.root+path.sep)&&fs.existsSync(candidate)){file=candidate;entry.fallback=true;break;}
    }
    if(!inside||!fs.existsSync(file)||!fs.statSync(file).isFile())return done(404,{'Cache-Control':`max-age=${maxAge}`},null);
    const stat=fs.statSync(file),ext=path.extname(file);
    let etag=etagCache.get(file);
    if(!etag){etag=`"${crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0,16)}"`;etagCache.set(file,etag);}
    const headers={'Content-Type':MIME[ext]??'application/octet-stream','Cache-Control':`max-age=${maxAge}`,ETag:etag,
      'Last-Modified':stat.mtime.toUTCString(),'Access-Control-Allow-Origin':'*',Vary:'Accept-Encoding'};
    if(req.headers['if-none-match']===etag)return done(304,headers,null);
    let body=fs.readFileSync(file);
    if(TEXT.has(ext)&&/\bgzip\b/.test(req.headers['accept-encoding']??'')){
      if(!gzipCache.has(file))gzipCache.set(file,zlib.gzipSync(body));
      body=gzipCache.get(file);headers['Content-Encoding']='gzip';
    }
    headers['Content-Length']=body.length;
    done(200,headers,req.method==='HEAD'?null:body);
  });
  return {
    server,log,
    async listen(port=0){await new Promise(r=>server.listen(port,'127.0.0.1',r));return `http://127.0.0.1:${server.address().port}${basePath}`;},
    close(){return new Promise(r=>server.close(()=>r()));}
  };
}
module.exports={createPagesLikeServer};
