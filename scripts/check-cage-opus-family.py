"""Validate one opus family round built by ``build-cage-opus-family.py``.

    python -X utf8 scripts/check-cage-opus-family.py --round opm-opus-r2 --module cage_opus_clinic_authoring

The shared batch reviewer proves the numeric contract, cell bank, bindings,
ground coverage and hex-placement seams for every manual selection.  It is run
one field at a time so fixed- and variable-window fields can share a round, and
it is given the field root as its core state when a contract never uses cell 0
(the root is the default state every audit reads).  On top of that this checks
fixed placement across cells, the absence of full-frame suppression, and that
every manifest names the producers that actually made it.
"""
import argparse
import importlib
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.cage_object_animation_contract import assert_unchanged, assert_variable_unchanged, sha

_loader = importlib.util.spec_from_file_location('opus_family_review', ROOT / 'scripts/check-cage-industrial-batch.py')
review = importlib.util.module_from_spec(_loader)
_loader.loader.exec_module(review)


def read(path):
    return json.loads(Path(path).read_text(encoding='utf8'))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--round', required=True)
    parser.add_argument('--module', required=True)
    parser.add_argument('--producer', default='scripts/build-cage-opus-family.py',
                        help='builder whose hash the manifests must carry (surface rounds use build-cage-opus-surface.py)')
    args = parser.parse_args()
    authoring = importlib.import_module('lib.' + args.module)
    containment_name = getattr(authoring, 'CONTAINMENT', 'cage_opus_containment')
    out = review.WORK / args.round
    variable = set(getattr(authoring, 'VARIABLE_WINDOW_FIELDS', ()))
    provenance = [('producerSha256', ROOT / args.producer),
                  ('familyAuthoringSha256', ROOT / 'scripts/lib' / f'{args.module}.py'),
                  ('containmentSha256', ROOT / 'scripts/lib' / f'{containment_name}.py'),
                  ('footprintFitSha256', ROOT / 'scripts/lib/cage_footprint_fit.py'),
                  ('scriptSha256', ROOT / 'scripts/build-cage-base3d.py')]
    provenance += [(f'dependency:{name}', ROOT / 'scripts/lib' / f'{name}.py')
                   for name in getattr(authoring, 'DEPENDENCIES', ())]

    original_load = review.load_field

    def load_field(field_id):
        spec, contract, states = original_load(field_id)
        if not states and not contract['objects']:
            # Core-only cage (no source objects): verify and use the root pack itself.
            from PIL import Image
            folder = review.cell_folder(field_id, 0)
            manifest = read(folder / 'modular-manifest.json')
            core_path = folder / manifest['core']['src']
            core = Image.open(core_path).convert('RGBA')
            if sha(core_path) != manifest['core']['sha256'].lower() or core.size != tuple(spec['worldSize']):
                raise ValueError('CORE_DRIFT:' + field_id)
            if manifest['objects']:
                raise ValueError('OBJECT_COUNT_DRIFT:' + field_id)
            states[0] = (core, [])
        if 0 not in states:
            # Cores are identical across cells here (no object shadows move);
            # the root folder is still verified below as its own state.
            states[0] = states[min(states)]
        return spec, contract, states

    review.load_field = load_field
    review.OUT = out
    merged = {'status': 'PASS_OFFLINE_CELL_BANK_ONLY', 'fields': {}, 'clockHz': None, 'runtimeEligible': False,
              'fullCageCompletion': False, 'humanApproved': False}
    for field_id in authoring.FIELDS:
        spec = read(review.WORK / 'fields' / field_id / 'spec.json')
        review.FIELDS = (field_id,)
        review.DEFINITIONS = (spec['definitionIndex'],)
        review.CONTRACT_ASSERT = assert_variable_unchanged if field_id in variable else assert_unchanged
        review.PER_FRAME_GEOMETRY = field_id in variable
        review.PROVENANCE = tuple(provenance)
        report = review.build()
        merged['fields'][field_id] = report['fields'][field_id]
        merged['limits'] = report['limits']

    table_sha = sha(out / 'fit-table.json')
    table = read(out / 'fit-table.json')['fields']
    summary = {}
    for field_id in authoring.FIELDS:
        record = read(out / 'fields' / field_id / 'footprint-fit.json')
        contract = read(out / 'fields' / field_id / 'object-animation-contract.json')
        cells = sorted({0} | {f['cellId'] for o in contract['objects'] for f in o['frames']}
                       | set(range(record.get('coreFrameCount', 1))))
        seen = {}
        for cell in record['cells']:
            for row in cell['objects']:
                key = str(row['sourceOrdinal'])
                if row['placement'] != table[field_id][key]:
                    raise ValueError(f'PLACEMENT_NOT_FROM_TABLE:{field_id}:{key}')
                if seen.setdefault(key, row['placement']) != row['placement']:
                    raise ValueError(f'PLACEMENT_DRIFT_BETWEEN_CELLS:{field_id}:{key}')
                if row['worstOutsideNativePx'] > .5:
                    raise ValueError(f'OBJECT_OUTSIDE_FIELD:{field_id}:{key}')
        for cell_id in cells:
            folder = out / 'seam-v3/fields' / field_id
            folder = folder if cell_id == 0 else folder / 'animation' / f'{cell_id:02d}'
            manifest = read(folder / 'modular-manifest.json')
            generation = manifest['generation']
            if generation['fitTableSha256'].lower() != table_sha:
                raise ValueError(f'STALE_FIT_TABLE:{field_id}:{cell_id}')
            for key, path in provenance:
                if generation[key].lower() != sha(path):
                    raise ValueError(f'STALE_PRODUCER:{key}:{field_id}:{cell_id}')
            for flag in ('runtimeEligible', 'shippingReady', 'humanApproved'):
                if manifest[flag] is not False:
                    raise ValueError(f'APPROVAL_FLAG_SET:{flag}:{field_id}:{cell_id}')
            features = read(folder / 'render-report.json')['natureFeatures'] or []
            if 'outside-anchor-full-frame-suppression-v1' in features or 'no-full-frame-suppression' not in features:
                raise ValueError(f'SUPPRESSION_STATE_WRONG:{field_id}:{cell_id}')
        factors = [table[field_id][k]['factor'] for k in seen]
        summary[field_id] = {
            'objects': len(seen), 'cells': len(record['cells']), 'renderedCells': cells,
            'untouched': sum(table[field_id][k]['mode'] == 'inside-union' for k in seen),
            'placed': sorted((k, table[field_id][k]['factor']) for k in seen
                             if table[field_id][k]['mode'] != 'inside-union'),
            'minimumScale': min(factors) if factors else None,
            'trayMaxOutsideNativePx': max(c['base']['trayMaxOutsideNativePx'] for c in record['cells']),
            'coreMaxOutsideNativePx': max(c['base']['coreMaxOutsideNativePx'] for c in record['cells']),
        }
    merged['fixedPlacement'] = summary
    merged['round'] = args.round
    merged['module'] = args.module
    merged['limits'] = merged.get('limits', []) + [
        'Containment is proved against the hex authority, not against visual quality.',
        'Manual selections are not every combination; see the state-envelope audit for the bound.',
    ]
    (out / 'review/report.json').write_text(json.dumps(merged, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'status': merged['status'], 'round': args.round,
                      'fields': {k: {'cells': v['cells'], 'selections': len(v['selections']),
                                     'placementChecks': v['placementChecks']} for k, v in merged['fields'].items()},
                      'fixedPlacement': summary}))


if __name__ == '__main__':
    main()
