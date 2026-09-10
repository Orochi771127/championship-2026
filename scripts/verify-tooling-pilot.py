"""Read-only artifact checks for the offline tooling and bright UI pilot."""
import hashlib
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
pilot = root / 'docs/art/production/tooling-pilot-r1'
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

original_path = root / 'docs/art/production/characters/appearance-refresh-v1/pixel-v2/m201-a/build-r02/masters/main/cell_023.png'
export_path = pilot / 'aseprite/m201-main-023-roundtrip.png'
with Image.open(original_path) as original, Image.open(export_path) as exported:
    assert exported.mode == 'P'
    assert original.size == exported.size == (32, 16)
    assert original.convert('RGBA').tobytes() == exported.convert('RGBA').tobytes()
    colors = {color for count, color in exported.convert('RGBA').getcolors(256)}
    assert len(colors) <= 16 and {c[3] for c in colors} == {0, 255}

receipt = json.loads((pilot / 'blender/receipt.json').read_text(encoding='utf-8'))
assert receipt['runtimeEligible'] is False
assert sha(pilot / 'blender' / receipt['blend']['path']) == receipt['blend']['sha256']
assert all(abs(a-b) < .01 for a,b in zip(receipt['camera']['projectedSourceOrigin'], [184,268]))
render_checks = []
for render in receipt['renders']:
    file = pilot / 'blender' / render['path']
    assert sha(file) == render['sha256']
    with Image.open(file) as img:
        assert img.mode == 'RGBA' and img.size == (464, 368)
        box = img.getchannel('A').getbbox()
        assert box and box[0] > 0 and box[1] > 0 and box[2] < 464 and box[3] < 368, box
        render_checks.append({'cell': render['cell'], 'alphaBounds': box, 'clipped': False})

manifest_path = root / 'assets/production/ui/tooling-pilot-r1/manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
texture = root / manifest['texture']['src']
assert texture.stat().st_size == manifest['texture']['bytes']
assert sha(texture) == manifest['texture']['sha256']
assert sha(root / manifest['authoring']['source']) == manifest['authoring']['sourceSha256']
assert manifest['rightsStatus'] == 'ORIGINAL_CREATED'
assert manifest['publicReleasePermitted'] is False
with Image.open(texture) as image:
    assert image.size == (1536, 1024)

icons = manifest['iconAtlas']
assert sha(root / icons['src']) == icons['sha256']
assert sha(root / icons['source']) == icons['sourceSha256']
with Image.open(root / icons['src']) as image:
    assert image.size == (1254, 1254)
    assert image.mode == 'RGB', 'opaque ivory atlas, not fake transparency'

report = {'schemaVersion': 1, 'status': 'PASS', 'aseprite': {
    'pixelExactRoundtrip': True, 'size': [32,16], 'rgbaColorCountIncludingTransparent': len(colors),
    'newMasterAuthored': False}, 'blender': {'fixedSourceOrigin': [184,268],
    'hashesVerified': True, 'renders': render_checks, 'poseParityAccepted': False},
    'ui': {'hashesVerified': True, 'materialBytes': texture.stat().st_size,
           'iconAtlasBytes': icons['bytes'], 'originalToolbarSlots': 8}}
(pilot / 'qa/artifact-checks.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps(report))
