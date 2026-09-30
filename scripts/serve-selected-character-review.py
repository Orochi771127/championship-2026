"""Loopback-only immutable asset substitution for the existing m001 review route.

No product source/assets are overwritten. A separate port isolates QA storage.
"""
import argparse
import hashlib
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
REVIEW_FOLDERS = {'m001_zurumon':'m001-r05-anchored','m002_choromon':'m002_choromon-hf-r01',
 'm003_nyokimon':'m003_nyokimon-hf-r03','m004_bubbmon':'m004_bubbmon-hf-r03',
 'm005_pitchmon':'m005_pitchmon-hf-r06','m006_punimon':'m006_punimon-hf-r06',
 'm007_botamon':'m007_botamon-hf-r06','m008_poyomon':'m008_poyomon-hf-r03',
 'm009_mokumon':'m009_mokumon-hf-r06','m010_yukimibotamon':'m010_yukimibotamon-hf-r01',
 'm011_yuramon':'m011_yuramon-hf-r02','m012_petimon':'m012_petimon-hf-r03'}


def serve(bundle, port, extra_bundles=()):
    bundle = bundle.resolve()
    allowed = (ROOT/'assets/production/internal-character-review').resolve()
    if not bundle.is_relative_to(allowed):
        raise ValueError('BUNDLE_OUTSIDE_REVIEW_ART')
    manifest = json.loads((bundle/'manifest.json').read_text(encoding='utf-8'))
    entity=manifest['entityId']
    if entity not in REVIEW_FOLDERS:raise ValueError('UNKNOWN_REVIEW_ENTITY')
    prefix='/assets/production/internal-character-review/'+REVIEW_FOLDERS[entity]+'/'
    if manifest.get('reviewOnly') is not True or manifest.get('runtimeEligible') is not False:
        raise ValueError('NOT_A_REVIEW_BUNDLE')
    for name, digest in manifest['files'].items():
        if hashlib.sha256((bundle/name).read_bytes()).hexdigest() != digest:
            raise ValueError('REVIEW_BUNDLE_DRIFT '+name)
    aliases={prefix:bundle}
    for extra in extra_bundles:
        extra=extra.resolve()
        if not extra.is_relative_to(allowed):raise ValueError('BUNDLE_OUTSIDE_REVIEW_ART')
        record=json.loads((extra/'manifest.json').read_text(encoding='utf-8'))
        if record['entityId'] not in REVIEW_FOLDERS or record.get('reviewOnly') is not True or record.get('runtimeEligible') is not False:raise ValueError('NOT_A_REVIEW_BUNDLE')
        for name,digest in record['files'].items():
            if hashlib.sha256((extra/name).read_bytes()).hexdigest()!=digest:raise ValueError('REVIEW_BUNDLE_DRIFT '+name)
        request='/assets/production/internal-character-review/'+REVIEW_FOLDERS[record['entityId']]+'/'
        if request in aliases:raise ValueError('DUPLICATE_REVIEW_ALIAS')
        aliases[request]=extra

    class Handler(SimpleHTTPRequestHandler):
        extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.mjs':'text/javascript', '.js':'text/javascript'}

        def __init__(self,*args,**kwargs):
            super().__init__(*args,directory=str(ROOT),**kwargs)

        def do_GET(self):
            if self.client_address[0] != '127.0.0.1' or urlsplit('//'+self.headers.get('Host','')).hostname not in ('127.0.0.1','localhost'):
                self.send_error(403); return
            super().do_GET()

        def translate_path(self,path):
            requested=urlsplit(path).path
            for request,directory in aliases.items():
                if requested.startswith(request):
                    relative=requested[len(request):]
                    target=(directory/relative).resolve()
                    if not target.is_relative_to(directory): return str(ROOT/'__forbidden__')
                    return str(target)
            return super().translate_path(path)

        def end_headers(self):
            self.send_header('Cache-Control','no-store')
            self.send_header('X-Championship-Review-Entities',','.join(sorted(REVIEW_FOLDERS[k] for k in REVIEW_FOLDERS if '/assets/production/internal-character-review/'+REVIEW_FOLDERS[k]+'/' in aliases)))
            super().end_headers()

        def log_message(self,format,*args):
            # Hundreds of ES-module requests must not fill the parent pipe.
            if len(args)>1 and str(args[1]).startswith(('4','5')):
                print(format % args,flush=True)

    print(f'LOCAL_SELECTED_ART_REVIEW http://127.0.0.1:{port}/championship.html?characterArtReview={entity.split("_")[0]}',flush=True)
    print(f'IMMUTABLE_BANK {manifest["sourceBankSha256"]}',flush=True)
    class ReviewServer(ThreadingHTTPServer):
        request_queue_size=128
    ReviewServer(('127.0.0.1',port),Handler).serve_forever()


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--bundle',type=Path,required=True);p.add_argument('--port',type=int,default=8766)
    p.add_argument('--extra-bundle',type=Path,action='append',default=[])
    a=p.parse_args();serve(a.bundle,a.port,a.extra_bundle)
