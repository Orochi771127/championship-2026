"""Batch tests for refinement round opus-r1 (lab, factory, ward).

These read the exported bank and the review reports; they do not render.
"""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

from lib.cage_object_animation_contract import extract, assert_unchanged, sha

WORK = ROOT / 'docs/art/production/original-character-cage-r1/cage-base3d-v1'
OUT = WORK / 'opm-opus-r1'
REVIEW = WORK / 'review/refinement-opus-r1'
FIELDS = ('field_cm06_01', 'field_cm15_01', 'field_cm17_01')


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def folder(field_id, cell_id):
    base = OUT / 'seam-v3/fields' / field_id
    return base if cell_id == 0 else base / 'animation' / f'{cell_id:02d}'


def cells(field_id):
    contract = read(OUT / 'fields' / field_id / 'object-animation-contract.json')
    return sorted({f['cellId'] for o in contract['objects'] for f in o['frames']})


class ContractTests(unittest.TestCase):
    def test_numeric_contracts_are_untouched(self):
        for field_id, expected in {'field_cm06_01': (15, 13), 'field_cm15_01': (23, 16),
                                   'field_cm17_01': (6, 6)}.items():
            contract = extract(ROOT, field_id)
            self.assertEqual((len(contract['objects']), len(cells(field_id))), expected, field_id)
            self.assertIsNone(contract['clockHz'])
            assert_unchanged(ROOT, read(OUT / 'fields' / field_id / 'object-animation-contract.json'))

    def test_every_cell_is_review_only_and_bound_to_its_producers(self):
        producers = {'producerSha256': ROOT / 'scripts/build-cage-opus-r1.py',
                     'facilityAuthoringSha256': ROOT / 'scripts/lib/cage_opus_facility_authoring.py',
                     'containmentSha256': ROOT / 'scripts/lib/cage_opus_containment.py',
                     'footprintFitSha256': ROOT / 'scripts/lib/cage_footprint_fit.py'}
        for field_id in FIELDS:
            for cell_id in cells(field_id):
                manifest = read(folder(field_id, cell_id) / 'modular-manifest.json')
                self.assertEqual(manifest['status'], 'REFINEMENT_OPUS_R1_REVIEW_ONLY')
                for key in ('runtimeEligible', 'shippingReady', 'humanApproved'):
                    self.assertFalse(manifest[key], key)
                self.assertIsNone(manifest['generation']['clockHz'])
                for key, path in producers.items():
                    self.assertEqual(manifest['generation'][key].lower(), sha(path), key)
                render = read(folder(field_id, cell_id) / 'render-report.json')
                self.assertTrue(render['independentPartsExported'])
                self.assertFalse(render['sourceRastersLoaded'])


class ContainmentTests(unittest.TestCase):
    def test_one_fixed_placement_per_object_across_all_cells(self):
        table = read(OUT / 'fit-table.json')['fields']
        for field_id in FIELDS:
            seen = {}
            for cell in read(OUT / 'fields' / field_id / 'footprint-fit.json')['cells']:
                for row in cell['objects']:
                    key = str(row['sourceOrdinal'])
                    self.assertEqual(row['placement'], table[field_id][key])
                    self.assertEqual(seen.setdefault(key, row['placement']), row['placement'])

    def test_no_prop_is_shrunk_out_of_legibility(self):
        table = read(OUT / 'fit-table.json')['fields']
        for field_id in FIELDS:
            for key, row in table[field_id].items():
                self.assertGreaterEqual(row['factor'], .85, f'{field_id}:{key}')

    def test_the_factory_belt_is_one_untouched_continuous_model(self):
        rows = read(OUT / 'fit-table.json')['fields']['field_cm15_01']
        for ordinal in range(15):
            self.assertEqual(rows[str(ordinal)]['mode'], 'inside-union', ordinal)

    def test_nothing_is_hidden_from_the_full_frame(self):
        for field_id in FIELDS:
            for cell_id in cells(field_id):
                features = read(folder(field_id, cell_id) / 'render-report.json')['natureFeatures']
                self.assertIn('no-full-frame-suppression', features)
                self.assertNotIn('outside-anchor-full-frame-suppression-v1', features)

    def test_core_geometry_stays_inside_and_tray_is_reported_apart(self):
        for field_id in FIELDS:
            for cell in read(OUT / 'fields' / field_id / 'footprint-fit.json')['cells']:
                self.assertLessEqual(cell['base']['coreMaxOutsideNativePx'], .5)
                self.assertEqual(cell['base']['coreObjectsOutside'], [])


class ReviewTests(unittest.TestCase):
    def test_all_three_gates_pass_or_review_for_this_batch(self):
        worst = {r['fieldId']: r for r in read(REVIEW / 'footprint/worst-of-all.json')['records']}
        for field_id in FIELDS:
            self.assertIn(worst[field_id]['worstSeverity'], ('PASS', 'REVIEW'), field_id)
            self.assertEqual(worst[field_id]['objectsOnlySolidOverflowPixels'], 0, field_id)

    def test_no_earlier_override_was_dropped(self):
        baseline = read(WORK / 'review/refinement-batch-e-v1/full-layout/report.json')['candidateOverrides']
        layout = read(REVIEW / 'full-layout/report.json')['candidateOverrides']
        for field_id in baseline:
            self.assertIn(field_id, layout)
            if field_id not in FIELDS:
                self.assertTrue(layout[field_id].endswith(baseline[field_id].split('cage-base3d-v1/')[-1]))
        for field_id in FIELDS:
            self.assertIn('opm-opus-r1', layout[field_id])

    def test_the_layout_still_covers_all_37_scenarios(self):
        self.assertEqual(read(REVIEW / 'full-layout/report.json')['scenarioCount'], 37)


if __name__ == '__main__':
    unittest.main()
