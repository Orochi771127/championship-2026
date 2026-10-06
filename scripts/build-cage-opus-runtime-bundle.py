"""Promote the opus cage art (rounds r1-r17) into a runtime bundle.

    python -X utf8 scripts/build-cage-opus-runtime-bundle.py

Reads the final cumulative review (refinement-opus-r17), copies each field's
latest frame-00.png into assets/production/cage/original-opus-v1/, and writes a
manifest in the same schema as licensed-runtime-v1, so the existing loader,
ranch composition, cropping and collision stay unchanged.  The four fields
whose ground animates (sea, lava, ice) keep two frames with the original
verified durations recorded in their opus manifests.  cm33/cm36/cm38 are
stored, unreferenced original assets and are not carried over.

Frames are written as WebP (quality 92, lossless alpha): a Cycles render at 4x
is about 1 MB as PNG and about 40 KB as WebP with no visible change, which
matters on slow links where the whole ranch loads its tiles on entry.
"""
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'docs/art/production/original-character-cage-r1/cage-base3d-v1'
REVIEW = WORK / 'review/refinement-opus-r17/full-layout/report.json'
LICENSED = ROOT / 'assets/production/cage/licensed-runtime-v1/manifest.json'
OUT_REL = 'assets/production/cage/original-opus-v1'
OUT = ROOT / OUT_REL
ANIMATED = ('field_cm07_01', 'field_cm09_01', 'field_cm21_01', 'field_cm39_01')


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest().upper()


def main():
    review = json.loads(REVIEW.read_text(encoding='utf8'))
    licensed = json.loads(LICENSED.read_text(encoding='utf8'))
    sizes = {f['fieldId']: f for f in licensed['fields']}
    if OUT.exists():
        shutil.rmtree(OUT)
    fields = []
    for record in sorted(review['records'], key=lambda r: r['fieldId']):
        field_id = record['fieldId']
        source = ROOT / record['candidateFile']
        frames_in = [source]
        if field_id in ANIMATED:
            frames_in.append(source.parent / 'animation/01/frame-00.png')
        reference = sizes[field_id]
        target_dir = OUT / 'fields' / field_id
        target_dir.mkdir(parents=True)
        durations = [None]
        if field_id in ANIMATED:
            core = json.loads((source.parent / 'modular-manifest.json').read_text(encoding='utf8'))['coreFrames']
            durations = [frame['durationMs'] for frame in core]
            if len(durations) != 2 or any(not d for d in durations):
                raise ValueError('CORE_FRAME_TIMING_MISSING:' + field_id)
        frames = []
        for index, path in enumerate(frames_in):
            size = Image.open(path).size
            if size != (reference['worldWidthPx'], reference['worldHeightPx']):
                raise ValueError(f'SIZE_MISMATCH:{field_id}:{size}')
            target = target_dir / f'frame-{index:02d}.webp'
            Image.open(path).convert('RGBA').save(target, 'WEBP', quality=92, method=6, alpha_quality=100)
            frames.append({'src': f'{OUT_REL}/fields/{field_id}/frame-{index:02d}.webp', 'sha256': sha(target),
                           'durationMs': durations[index] if len(frames_in) > 1 else None})
        fields.append({'fieldId': field_id, 'worldWidthPx': reference['worldWidthPx'],
                       'worldHeightPx': reference['worldHeightPx'], 'nativeWidthPx': reference['nativeWidthPx'],
                       'nativeHeightPx': reference['nativeHeightPx'], 'visualRole': reference['visualRole'],
                       'gameplayBinding': 'EXTERNAL_EXISTING_RUNTIME',
                       'gateMapping': 'UNBOUND_EXPLICIT_FIELD_ID_REQUIRED',
                       'collisionBinding': 'EXTERNAL_NOT_IN_ART_BUNDLE',
                       'source': record['candidateFile'], 'frames': frames})
    manifest = {
        'schemaVersion': 1,
        'assetId': 'art:cage:original-opus:v1',
        'family': 'CAGE',
        'product': licensed['product'],
        'artifactMaturity': 'ORIGINAL_BLENDER_2_5D_CAGE_FIELDS',
        'productionStatus': 'OWNER_DIRECTED_RUNTIME_REPLACEMENT_2026_10_06',
        'shippingStatus': 'NOT_SHIPPING_READY',
        'humanApproved': True,
        'runtimeEligible': True,
        'shippingReady': False,
        'rightsStatus': 'PROJECT_ORIGINAL',
        'rights': {
            'status': 'PROJECT_ORIGINAL',
            'authority': 'docs/handoff/cage-art-opus-20261005/PROGRESS_OPUS.md',
            'ownerDirective': 'Owner 2026-10-06: replace the old original cage maps with the new versions and publish',
            'sourceRastersLoaded': False,
            'review': 'docs/art/production/original-character-cage-r1/cage-base3d-v1/review/refinement-opus-r17',
            'romDerivedPixels': False,
        },
        'fieldCount': len(fields),
        'defaultPreviewFieldId': 'field_cm01_01',
        'memoryPolicy': licensed['memoryPolicy'],
        'filter': licensed['filter'],
        'fields': fields,
        'notes': [
            'Procedural original Blender renders (opus rounds r1-r17); no ROM pixels.',
            'Collision, walkability, ranch placement and training effects stay in the Cage runtime.',
            'cm07/cm09/cm21/cm39 keep two ground frames with the original verified durations.',
            'cm28 is the Waiting Room, cm29 the LID. cm33/cm36/cm38 (unreferenced) are not carried over.',
        ],
    }
    (OUT / 'manifest.json').write_bytes((json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf8'))
    print(json.dumps({'fields': len(fields), 'out': OUT_REL}))


if __name__ == '__main__':
    main()
