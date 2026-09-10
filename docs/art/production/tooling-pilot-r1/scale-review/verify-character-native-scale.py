"""Read raw NCER/graphics and current atlas PNGs; write metadata only in this folder."""
import sys
sys.dont_write_bytecode = True
import hashlib
import importlib.util
import json
from collections import Counter
from pathlib import Path
from PIL import Image

ROOT = Path('R:/Projects/Championship2026/championship-2026')
ARCHIVE = Path('R:/Projects/Championship2026/YDIJ_PRIVATE_ROM_ART_PACK')
OUT = ROOT / 'docs/art/production/tooling-pilot-r1/scale-review'
PROD = ROOT / 'assets/production/internal-faithful-baseline/characters-v1'
SPEC = importlib.util.spec_from_file_location('existing_source_auditor', ROOT / 'scripts/build-character-appearance-workflow.py')
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def write(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n', encoding='utf-8', newline='\n')

manifest = read(PROD / 'manifest.json')
entities = []
scales = Counter()
affine_count = 0
slot_count = 0
blank_count = 0
verified = 0
for index, record in enumerate(manifest['records']):
    eid = record['entityId']
    runtime_path = PROD / record['runtime']
    runtime = read(runtime_path)
    hashes = {str(runtime_path.relative_to(ROOT)): sha(runtime_path)}
    frame_rows = []
    first = {}
    for side in ('main', 'sub'):
        stem = f'{eid}_{side}'
        cells_path = ARCHIVE / '08_FULL_FAMILY_CONVERSION/digimon' / stem / 'cells.json'
        cells = read(cells_path)
        raw_root = ARCHIVE / '07_RAW_NITRO_ART_BY_ROM_DIRECTORY/digimon'
        bank = AUDIT.native_bank(raw_root, stem, cells)
        hashes[str(cells_path)] = sha(cells_path)
        for path in raw_root.glob(f'{stem}.*'):
            hashes[str(path)] = sha(path)
        textures = {}
        sheets = []
        for atlas in runtime['sides'][side]['atlases']:
            json_path = runtime_path.parent / atlas['data']
            image_path = runtime_path.parent / atlas['image']
            data = read(json_path)
            img = Image.open(image_path).convert('RGBA')
            sheets.append(img)
            hashes[str(json_path.relative_to(ROOT))] = sha(json_path)
            hashes[str(image_path.relative_to(ROOT))] = sha(image_path)
            resolution = float(data['meta'].get('scale', 1))
            for key, value in data['frames'].items():
                assert key not in textures
                textures[key] = (value, img, resolution, str(json_path.relative_to(ROOT)), str(image_path.relative_to(ROOT)))
        for cell in cells['cells']:
            slot_count += 1
            key = f"{eid}/{side}/cell_{cell['cellIndex']:03d}"
            frame, sheet, resolution, atlas_json, atlas_png = textures[key]
            assert not frame['rotated']
            affine_count += sum(bool(o['rawAttr0'] & 0x100) for o in cell['oamEntries'])
            native, transfer = AUDIT.render_native(cell, bank)
            native_box = native.getchannel('A').getbbox()
            packed_rect = frame['frame']
            crop = sheet.crop((packed_rect['x'], packed_rect['y'], packed_rect['x'] + packed_rect['w'], packed_rect['y'] + packed_rect['h']))
            blank = crop.getchannel('A').getbbox() is None
            assert blank == (native_box is None), (key, 'blank mismatch')
            b = cell['bounds']
            bounds = [b['minX'], b['minY'], b['maxXExclusive'], b['maxYExclusive']]
            row = {'texture': key, 'side': side, 'cell': cell['cellIndex'], 'nativeCellBounds': bounds,
                   'nativeCellSize': [native.width, native.height], 'isBlank': blank,
                   'packedSourceSize': frame['sourceSize'], 'packedTrim': frame['spriteSourceSize'],
                   'packedFrame': packed_rect, 'packedAnchor': frame.get('anchor', runtime['artProfile']['anchor']),
                   'atlasResolution': resolution, 'atlasJson': atlas_json, 'atlasPng': atlas_png,
                   'nativeSourceTransfer': transfer, 'sourceOamAffineCount': sum(bool(o['rawAttr0'] & 0x100) for o in cell['oamEntries'])}
            if blank:
                blank_count += 1
                row.update({'nativeAlphaBounds': None, 'packedPixelsPerNativePixel': None, 'packedSourceOrigin': None, 'scaleStatus': 'BLANK_NO_VISIBLE_SCALE'})
            else:
                alpha = [bounds[0]+native_box[0], bounds[1]+native_box[1], bounds[0]+native_box[2], bounds[1]+native_box[3]]
                ncrop = native.crop(native_box)
                sx, sy = crop.width/ncrop.width, crop.height/ncrop.height
                assert sx == sy and sx >= 1 and sx.is_integer(), (key, sx, sy)
                scale = int(sx)
                assert AUDIT.visible_equal(ncrop.resize(crop.size, Image.Resampling.NEAREST), crop), (key, 'native/atlas pixel mismatch')
                trim = frame['spriteSourceSize']
                origin = [trim['x'] - alpha[0]*scale, trim['y'] - alpha[1]*scale]
                row.update({'nativeAlphaBounds': alpha, 'nativeVisibleSize': [alpha[2]-alpha[0], alpha[3]-alpha[1]],
                            'packedPixelsPerNativePixel': scale, 'packedSourceOrigin': origin,
                            'sourceOriginAnchorForUnmodifiedTexture': [origin[0]/frame['sourceSize']['w'], origin[1]/frame['sourceSize']['h']],
                            'spriteScalePerWorldUnitPerNativePixel': resolution/scale,
                            'scaleStatus': 'RAW_TRANSFER_DECODE_PIXEL_EQUALITY_VERIFIED'})
                scales[scale] += 1
                verified += 1
                if side not in first:
                    first[side] = row
            frame_rows.append(row)
        for image in sheets:
            image.close()
    entities.append({'entityId': eid, 'runtimePath': str(runtime_path.relative_to(ROOT)),
                     'sourceHashes': hashes, 'firstVisibleFrameBySide': first,
                     'packedScaleVariants': sorted({r['packedPixelsPerNativePixel'] for r in frame_rows if not r['isBlank']}),
                     'packedOriginVariants': sorted({tuple(r['packedSourceOrigin']) for r in frame_rows if not r['isBlank']}),
                     'frames': frame_rows})
    if (index + 1) % 32 == 0:
        print(f'Verified {index+1} entities / {slot_count} slots', flush=True)

summary = {'schemaVersion': 1, 'classification': 'RESEARCH_ONLY_METADATA_NO_SOURCE_PIXELS',
           'source': 'RAW_NCER_TRANSFER_AWARE_NATIVE_DECODE_VS_CURRENT_RUNTIME_ATLAS_PNG',
           'sourceManifestSha256': sha(PROD/'manifest.json'), 'verifierSha256': sha(Path(__file__)),
           'existingDecoderSha256': sha(ROOT/'scripts/build-character-appearance-workflow.py'),
           'entityCount': len(entities), 'slotCount': slot_count, 'verifiedVisibleSlots': verified,
           'blankSlots': blank_count, 'sourceOamAffineCount': affine_count,
           'packedScaleHistogram': dict(sorted(scales.items())),
           'entitiesWithPerFrameScaleVariation': sum(len(e['packedScaleVariants']) > 1 for e in entities),
           'entitiesWithPerFrameOriginVariation': sum(len(e['packedOriginVariants']) > 1 for e in entities),
           'runtimeRaisingFinalOamTransform': 'UNKNOWN_REQUIRES_LIVE_OAM_OR_RENDER_CALL_TRACE',
           'formula': 'nativeCoordinate=(packedLogicalCoordinate-packedSourceOrigin)/packedPixelsPerNativePixel',
           'scaleFormula': 'spriteScale=worldUnitsPerNativePixel*atlasResolution/packedPixelsPerNativePixel',
           'anchorFormula': 'spriteAnchor=packedSourceOrigin/packedSourceSize',
           'worldUnitsPerNativePixel': 'SCENE_CONTRACT_INPUT_NOT_CHOSEN_HERE',
           'originMeaning': 'NCER_SOURCE_ORIGIN_NOT_ASSERTED_GROUND_OR_GAMEPLAY_POSITION',
           'runtimeModified': False, 'assetPixelsModified': False, 'shippingReady': False}
write('character-native-scale-candidates.json', {'summary': summary, 'entities': entities})
write('character-native-scale-summary.json', summary)
print(json.dumps(summary, ensure_ascii=False), flush=True)
