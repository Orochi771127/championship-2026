"""Validate the Batch E footprint-accurate zoo, ranch and forest cell banks.

The shared batch reviewer proves the numeric contract, cell bank, bindings and
hex-placement seams.  On top of that this asks the two questions specific to
this batch: did every animation cell of one prop keep the same size, and did
anything get hidden from the full frame while still being exported as a cell.
"""
import importlib.util
import json
from pathlib import Path

from lib.cage_object_animation_contract import assert_unchanged, sha

ROOT = Path(__file__).resolve().parents[1]
loader = importlib.util.spec_from_file_location('footprint_review',
                                                ROOT / 'scripts/check-cage-industrial-batch.py')
review = importlib.util.module_from_spec(loader)
loader.loader.exec_module(review)

WORK = review.WORK
OUT = WORK / 'opm-footprint-refinement-v1'
FIELDS = ('field_cm11_01', 'field_cm25_01', 'field_cm26_01')
DEFINITIONS = (10, 24, 25)
UPSTREAM = {'field_cm11_01': ROOT / 'scripts/lib/cage_nature_authoring.py',
            'field_cm25_01': ROOT / 'scripts/lib/cage_remaining_fixed_authoring.py',
            'field_cm26_01': ROOT / 'scripts/lib/cage_remaining_fixed_authoring.py'}
PROVENANCE = (('producerSha256', ROOT / 'scripts/build-cage-footprint-refinement.py'),
              ('footprintRefinementSha256', ROOT / 'scripts/lib/cage_footprint_refinement.py'),
              ('footprintFitSha256', ROOT / 'scripts/lib/cage_footprint_fit.py'),
              ('scriptSha256', ROOT / 'scripts/build-cage-base3d.py'))


def read(path):
    return json.loads(Path(path).read_text(encoding='utf8'))


def check_upstream_binding():
    """Each field must name the upstream family it actually wrapped."""
    table = sha(OUT / 'fit-table.json')
    for field_id in FIELDS:
        contract = read(OUT / 'fields' / field_id / 'object-animation-contract.json')
        for cell_id in sorted({f['cellId'] for o in contract['objects'] for f in o['frames']}):
            folder = OUT / 'seam-v3/fields' / field_id
            if cell_id:
                folder = folder / 'animation' / f'{cell_id:02d}'
            generation = read(folder / 'modular-manifest.json')['generation']
            if generation['upstreamAuthoringSha256'].lower() != sha(UPSTREAM[field_id]):
                raise ValueError(f'STALE_UPSTREAM_AUTHORING:{field_id}:{cell_id}')
            if generation['fitTableSha256'].lower() != table:
                raise ValueError(f'STALE_FIT_TABLE:{field_id}:{cell_id}')


def check_scale_is_stable_across_cells():
    """One prop, one size.  A scale that moved between frames would read as a
    prop breathing through its animation, which no source cell asks for."""
    summary = {}
    for field_id in FIELDS:
        record = read(OUT / 'fields' / field_id / 'footprint-fit.json')
        applied = {}
        reduced = shrunk = flagged = 0
        for cell in record['cells']:
            for row in cell['objects']:
                key = row['sourceOrdinal']
                if key in applied and applied[key] != row['appliedScale']:
                    raise ValueError(f'SCALE_DRIFT_BETWEEN_CELLS:{field_id}:{key}')
                applied[key] = row['appliedScale']
        first = record['cells'][0]['objects']
        for row in first:
            reduced += row['authoringWindowReduced']
            shrunk += row['appliedScale'] < 1.0
            flagged += row['belowPreferredScale']
        summary[field_id] = {'objects': len(applied), 'cells': len(record['cells']),
                             'authoringWindowsReduced': reduced, 'objectsScaled': shrunk,
                             'belowPreferredScale': flagged,
                             'minimumScale': min(applied.values())}
    return summary


def check_nothing_is_hidden_from_the_full_frame():
    """The defect this batch removes: a prop absent from the frame but present
    in its exported cell, so the assembled board disagrees with the frame."""
    for field_id in FIELDS:
        for report in read(OUT / 'fields' / field_id / 'footprint-fit.json')['cells']:
            folder = OUT / 'seam-v3/fields' / field_id
            if report['sourceCellId']:
                folder = folder / 'animation' / f"{report['sourceCellId']:02d}"
            features = read(folder / 'render-report.json')['natureFeatures'] or []
            if 'outside-anchor-full-frame-suppression-v1' in features:
                raise ValueError(f'FULL_FRAME_SUPPRESSION_PRESENT:{field_id}')
            if 'no-full-frame-suppression' not in features:
                raise ValueError(f'SUPPRESSION_CLAIM_MISSING:{field_id}')


def build():
    review.OUT = OUT
    review.FIELDS = FIELDS
    review.DEFINITIONS = DEFINITIONS
    review.CONTRACT_ASSERT = assert_unchanged
    review.PER_FRAME_GEOMETRY = False
    review.PROVENANCE = PROVENANCE
    report = review.build()
    check_upstream_binding()
    check_nothing_is_hidden_from_the_full_frame()
    report['footprintFit'] = check_scale_is_stable_across_cells()
    report['limits'] = report['limits'] + [
        'Containment is proved against the hex authority, not against visual quality.',
        'Props whose source anchor lies outside this field stay small by necessity; '
        'the fit record lists them for human review.',
    ]
    (OUT / 'review/report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'status': report['status'], 'footprintFit': report['footprintFit']}))
    return report


if __name__ == '__main__':
    build()
