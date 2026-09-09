"""Package existing owner-supplied effect PNGs, without redrawing/resampling.
Only the explicit local research bundle is emitted. Native gameplay/timing
remains in battleEffectProfiles; this compiler validates but never rewrites it.
"""
import argparse, hashlib, io, json, math
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/production/internal-faithful-baseline/battle-effects-v1'
REPORT = ROOT / 'docs/art/production/battle-effect-r12/pack-verification.json'
PROFILE = ROOT / 'src/data/championship/battleEffectProfiles.json'

def sha(data): return hashlib.sha256(data).hexdigest()
def json_bytes(data): return (json.dumps(data, ensure_ascii=False, indent=2) + '\n').encode('utf-8')

def build(archive):
    profiles = json.loads(PROFILE.read_text(encoding='utf-8'))
    originals = archive / '08_FULL_FAMILY_CONVERSION/common'
    raw = archive / '07_RAW_NITRO_ART_BY_ROM_DIRECTORY/common'
    sources, banks = [], []
    for bank in profiles['banks']:
        folder = originals / bank['name']
        family = json.loads((folder / 'family.json').read_text(encoding='utf-8'))
        cells = json.loads((folder / 'cells.json').read_text(encoding='utf-8'))
        animations = json.loads((folder / 'animations.json').read_text(encoding='utf-8'))
        assert not family['warnings'], (bank['id'], family['warnings'])
        assert len(cells['cells']) == len(bank['boxes'])
        assert len(animations['sequences']) == len(bank['sequences'])
        hashes = {}
        for file in family['sourceFiles']:
            hashes[Path(file['name']).suffix[1:]] = sha((raw / file['name']).read_bytes())
        for ext, expected in bank['sourceHashes'].items(): assert hashes[ext] == expected, (bank['id'], ext)
        for sequence, original in zip(bank['sequences'], animations['sequences']):
            assert sequence['id'] == original['sequenceId']
            assert sequence['playbackMode'] == original['rawWordB']
            assert sequence['loopStartFrame'] == original['loopStartFrame']
            assert [(f['cell'], f['ticks']) for f in sequence['frames']] == [(f['cellId'], f['rawDurationTicks']) for f in original['frames']]
        banks.append(dict(bankId=bank['id'], name=bank['name'], cells=len(bank['boxes']),
                          sequences=len(bank['sequences']), sourceHashes=hashes))
        for cell, box in zip(cells['cells'], bank['boxes']):
            number = cell['cellIndex']; bounds = cell['bounds']
            assert not any(o['affine'] for o in cell['oamEntries']), (bank['id'], number)
            assert box == [bounds['maxXExclusive'], bounds['maxYExclusive'], bounds['minX'], bounds['minY']]
            file = folder / 'cells' / f'cell-{number:03}.png'
            image = Image.open(file); image.load()
            assert image.mode == 'RGBA'
            assert image.size == (box[0] - box[2], box[1] - box[3])
            sources.append(dict(bankId=bank['id'], cell=number, image=image,
                source=file.relative_to(archive).as_posix(), sourceSha256=sha(file.read_bytes()),
                sourceRgbaSha256=sha(image.tobytes()), origin=[-box[2], -box[3]],
                pixelsPerNativePixel=1, blank=image.getchannel('A').getbbox() is None))

    # Integer-only shelf packing. No mask, scaling, palette change or centering:
    # each copied pixel and each native cell origin is retained exactly.
    width=1024; x=y=row_height=2
    for cell in sorted(sources, key=lambda c: (-c['image'].height, -c['image'].width, c['bankId'], c['cell'])):
        w,h=cell['image'].size
        if x+w+2>width: x=2; y+=row_height+4; row_height=0
        cell['frame']=[x,y,w,h]; x+=w+4; row_height=max(row_height,h)
    height=2**math.ceil(math.log2(y+row_height+2))
    atlas=Image.new('RGBA',(width,height),(0,0,0,0))
    for cell in sources:
        x,y,w,h=cell['frame']; atlas.paste(cell['image'],(x,y))
        assert atlas.crop((x,y,x+w,y+h)).tobytes()==cell['image'].tobytes()
    buffer=io.BytesIO(); atlas.save(buffer,format='PNG',compress_level=9); png=buffer.getvalue()
    output_cells=[{k:v for k,v in c.items() if k!='image'} for c in sorted(sources,key=lambda c:(c['bankId'],c['cell']))]
    manifest=dict(schemaVersion=1,assetId='art:vfx:battle-effects:local-reference:v1',
        runtimeEligible=True,localOnly=True,runtimeScope='LOOPBACK_RESEARCH_ONLY',publicReleasePermitted=False,
        shippingReady=False,humanApproved=False,rightsStatus='ROM_COPYRIGHTED_REFERENCE',
        productionStatus='OWNER_AUTHORIZED_LOCAL_REFERENCE',gameplayBinding='EXTERNAL_EXISTING_RUNTIME',
        visualParity='SOURCE_PNG_PIXELS_AND_NATIVE_ORIGINS_PRESERVED_FULL_GAME_QA_PENDING',
        image=dict(src=DEST.relative_to(ROOT).as_posix()+'/effects.png',width=width,height=height,sha256=sha(png),scaleMode='nearest'),
        cells=output_cells,banks=banks,
        provenance=dict(archive='YDIJ_PRIVATE_ROM_ART_PACK',sourcePolicy='OWNER_SUPPLIED_ORIGINAL_PNG_NO_IMAGE_GENERATION',
            sourceRomSha256=profiles['romSha256'],nativeProfilesSha256=sha(PROFILE.read_bytes()),
            authority='docs/coordination/OWNER_DIRECTION.md#2026-09-08',
            sequenceAuthority='src/data/championship/battleEffectProfiles.json',
            playback='EXISTING_NATIVE_POOL_ONLY_NOT_GIF_PREVIEW'))
    report=dict(banks=len(banks),sequences=sum(b['sequences'] for b in banks),cells=len(sources),
        blankCells=sum(c['blank'] for c in sources),atlasSize=[width,height],decodedBytes=width*height*4,
        cellPixels=sum(c['image'].width*c['image'].height for c in sources),
        sourceRgbaComparisons=len(sources),matchingRgbaComparisons=len(sources),
        rawHashPairsVerified=sum(len(b['sourceHashes']) for b in profiles['banks']),
        nativeOriginMismatches=0,nativeTimelineMismatches=0,generatedImages=0,
        profileSha256=manifest['provenance']['nativeProfilesSha256'],atlasSha256=sha(png),
        localOnly=True,publicReleasePermitted=False,shippingReady=False)
    return {DEST/'effects.png':png,DEST/'manifest.json':json_bytes(manifest),REPORT:json_bytes(report)}

if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--archive',type=Path,required=True);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    outputs=build(args.archive.resolve(strict=True))
    for path,data in outputs.items():
        if args.check: assert path.read_bytes()==data, f'NONDETERMINISTIC:{path}'
        else: path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    print(outputs[REPORT].decode('utf-8'))
