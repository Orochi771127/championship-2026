"""Pack refined cage renders into the polish review (local review 2026-10-19).
Each refined frame keeps its own alpha (same geometry and camera; padded renders show the
full outer walls) and records its padding. Then the generated ambient/foreground layers and
the foreground index are rebuilt for those cages. args: <repo> <fid:padRaster,...>"""
import hashlib, json, os, subprocess, sys
from PIL import Image
REPO = sys.argv[1]; specs = [s.split(':') for s in sys.argv[2].split(',')]
C = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = 'assets/production/cage/polish-review-20261019'
p = os.path.join(REPO, OUT, 'manifest.json'); man = json.load(open(p, encoding='utf-8'))
sha = lambda f: hashlib.sha256(open(f, 'rb').read()).hexdigest()
order = ['fieldId', 'worldWidthPx', 'worldHeightPx', 'nativeWidthPx', 'nativeHeightPx', 'visualRole', 'gameplayBinding', 'gateMapping',
         'collisionBinding', 'rasterPixelsPerNative', 'visualPaddingNative', 'frames']
for fid, pad in specs:
    pad = int(pad)
    i, f = next((i, f) for i, f in enumerate(man['fields']) if f['fieldId'] == fid)
    img = Image.open(os.path.join(C, 'polish', 'batch', f'{fid}-00.png')).convert('RGBA')
    rel = f'{OUT}/fields/{fid}/frame-00.webp'
    os.makedirs(os.path.dirname(os.path.join(REPO, rel)), exist_ok=True)
    img.save(os.path.join(REPO, rel), lossless=True, quality=100, method=6, exact=True)
    assert img.size == (f['worldWidthPx'] + 2 * pad, f['worldHeightPx'] + 2 * pad), (fid, img.size)
    if pad:
        f['rasterPixelsPerNative'] = 4; n = pad // 4
        f['visualPaddingNative'] = {'left': n, 'top': n, 'right': n, 'bottom': n}
    fr = f['frames'][0]; fr.update(src=rel, sha256=sha(os.path.join(REPO, rel)))
    if pad: fr.update(rasterWidthPx=img.size[0], rasterHeightPx=img.size[1])
    man['fields'][i] = {k: f[k] for k in order if k in f} | {k: v for k, v in f.items() if k not in order}
    print(fid, img.size, fr['sha256'][:12])
open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(man, indent=1))
env = dict(os.environ, CAGE_MANIFEST=f'{OUT}/manifest.json', CAGE_REVIEW='polish-20261019')
fids = [s[0] for s in specs]
subprocess.run([sys.executable, os.path.join(C, 'tools', 'build_ambient.py'), os.path.join(C, 'ids-refine'), REPO, ','.join(fids)], env=env, check=True, cwd=C)
gen = [f for f in fids if f not in ('field_cm02_01', 'field_cm03_01')]
if gen:
    subprocess.run([sys.executable, os.path.join(C, 'tools', 'build_foreground.py'), os.path.join(C, 'ids-refine'), REPO, os.path.join(C, 'fg-build-refine'), ','.join(gen)], env=env, check=True, cwd=C)
    ip = os.path.join(REPO, 'assets/production/cage/foreground-review-polish-20261019/index.json'); idx = json.load(open(ip, encoding='utf-8'))
    for new in json.load(open(os.path.join(C, 'fg-build-refine', 'index-build.json'))):
        for e in idx['fields']:
            if e['fieldId'] == new['fieldId']: e.update({k: new[k] for k in ('manifest', 'sourceHash', 'masterHash', 'width', 'height')})
    open(ip, 'w', encoding='utf-8', newline='\n').write(json.dumps(idx, indent=1) + '\n')
print('PACK_REFINE_DONE', fids)
