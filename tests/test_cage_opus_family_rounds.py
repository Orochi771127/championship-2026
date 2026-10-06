"""Batch tests for the opus family rounds r2-r17 (Blender -> layered 2.5D -> hex layout).

They read the exported cell banks, fit tables, check reports and review
reports; they do not render.  Round r1 has its own test module.
"""
import importlib
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

from lib.cage_object_animation_contract import sha  # noqa: E402

WORK = ROOT / 'docs/art/production/original-character-cage-r1/cage-base3d-v1'
FAMILY = ROOT / 'scripts/build-cage-opus-family.py'
SURFACE = ROOT / 'scripts/build-cage-opus-surface.py'
ROUNDS = {
    'opm-opus-r2': ('cage_opus_clinic_authoring', FAMILY, ('field_cm16_01', 'field_cm31_01')),
    'opm-opus-r3': ('cage_opus_sacred_authoring', FAMILY, ('field_cm13_01', 'field_cm14_01', 'field_cm24_01')),
    'opm-opus-r4': ('cage_opus_variable_authoring', FAMILY, ('field_cm19_01', 'field_cm22_01')),
    'opm-opus-r5': ('cage_opus_remaining_authoring', FAMILY, ('field_cm01_01', 'field_cm12_01', 'field_cm27_01')),
    'opm-opus-r6': ('cage_opus_highland_authoring', FAMILY, ('field_cm37_01', 'field_cm40_01')),
    'opm-opus-r7': ('cage_opus_bridge_authoring', FAMILY, ('field_cm10_01',)),
    'opm-opus-r8': ('cage_opus_sports_authoring', FAMILY, ('field_cm02_01', 'field_cm04_01')),
    'opm-opus-r9': ('cage_opus_garden_authoring', FAMILY, ('field_cm18_01', 'field_cm32_01')),
    'opm-opus-r10': ('cage_opus_coast_authoring', SURFACE, ('field_cm09_01', 'field_cm39_01')),
    'opm-opus-r11': ('cage_opus_elemental_authoring', SURFACE, ('field_cm07_01', 'field_cm21_01', 'field_cm35_01')),
    'opm-opus-r12': ('cage_opus_pasture_authoring', FAMILY, ('field_cm11_01', 'field_cm25_01', 'field_cm26_01')),
    'opm-opus-r13': ('cage_opus_gym_desert_authoring', FAMILY, ('field_cm05_01', 'field_cm20_01', 'field_cm34_01')),
    'opm-opus-r14': ('cage_opus_sacred_polish_authoring', FAMILY, ('field_cm13_01',)),
    'opm-opus-r15': ('cage_opus_athletics_authoring', FAMILY, ('field_cm03_01', 'field_cm30_01')),
    'opm-opus-r16': ('cage_opus_toxic_authoring', FAMILY, ('field_cm23_01',)),
    'opm-opus-r17': ('cage_opus_meadow_authoring', FAMILY, ('field_cm08_01',)),
}
# The newest round that holds each field (earlier rounds stay on disk for comparison).
LATEST = {}
for _round, (_module, _producer, _fields) in ROUNDS.items():
    for _field in _fields:
        LATEST[_field] = _round
LATEST.update({'field_cm06_01': 'opm-opus-r1', 'field_cm15_01': 'opm-opus-r1', 'field_cm17_01': 'opm-opus-r1'})
FINAL_REVIEW = WORK / 'review/refinement-opus-r17'


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def round_number(round_name):
    return int(round_name.rsplit('-r', 1)[1])


def folder(round_name, field_id, cell_id):
    base = WORK / round_name / 'seam-v3/fields' / field_id
    return base if cell_id == 0 else base / 'animation' / f'{cell_id:02d}'


def rendered_cells(round_name, field_id):
    return read(WORK / round_name / 'review/report.json')['fixedPlacement'][field_id]['renderedCells']


def provenance(round_name):
    module_name, producer, _ = ROUNDS[round_name]
    module = importlib.import_module('lib.' + module_name)
    containment = getattr(module, 'CONTAINMENT', 'cage_opus_containment')
    pairs = {'producerSha256': producer,
             'familyAuthoringSha256': ROOT / 'scripts/lib' / f'{module_name}.py',
             'containmentSha256': ROOT / 'scripts/lib' / f'{containment}.py',
             'footprintFitSha256': ROOT / 'scripts/lib/cage_footprint_fit.py',
             'scriptSha256': ROOT / 'scripts/build-cage-base3d.py'}
    for dependency in getattr(module, 'DEPENDENCIES', ()):
        pairs[f'dependency:{dependency}'] = ROOT / 'scripts/lib' / f'{dependency}.py'
    return module, pairs


class ProvenanceTests(unittest.TestCase):
    def test_every_cell_is_review_only_and_bound_to_its_frozen_producers(self):
        for round_name, (_, _, fields) in ROUNDS.items():
            module, pairs = provenance(round_name)
            self.assertEqual(tuple(module.FIELDS), fields, round_name)
            table_sha = sha(WORK / round_name / 'fit-table.json')
            status = f'REFINEMENT_OPM_OPUS_R{round_number(round_name)}_REVIEW_ONLY'
            for field_id in fields:
                for cell_id in rendered_cells(round_name, field_id):
                    with self.subTest(round=round_name, field=field_id, cell=cell_id):
                        manifest = read(folder(round_name, field_id, cell_id) / 'modular-manifest.json')
                        self.assertEqual(manifest['status'], status)
                        for flag in ('runtimeEligible', 'shippingReady', 'humanApproved'):
                            self.assertIs(manifest[flag], False, flag)
                        generation = manifest['generation']
                        self.assertIsNone(generation['clockHz'])
                        self.assertEqual(generation['newGenerationCalls'], 0)
                        self.assertIsNone(generation['conceptReference'])
                        self.assertEqual(generation['originalRasterInputs'], [])
                        self.assertEqual(generation['fitTableSha256'].lower(), table_sha)
                        for key, path in pairs.items():
                            self.assertEqual(generation[key].lower(), sha(path), key)

    def test_render_reports_export_parts_without_rasters_or_suppression(self):
        for round_name, (_, _, fields) in ROUNDS.items():
            for field_id in fields:
                for cell_id in rendered_cells(round_name, field_id):
                    with self.subTest(round=round_name, field=field_id, cell=cell_id):
                        render = read(folder(round_name, field_id, cell_id) / 'render-report.json')
                        self.assertTrue(render['independentPartsExported'])
                        self.assertFalse(render['sourceRastersLoaded'])
                        self.assertFalse(render['runtimeEligible'])
                        features = render['natureFeatures'] or []
                        self.assertIn('no-full-frame-suppression', features)
                        self.assertNotIn('outside-anchor-full-frame-suppression-v1', features)

    def test_every_field_keeps_a_reproducible_blender_master(self):
        for round_name, (_, _, fields) in ROUNDS.items():
            for field_id in fields:
                with self.subTest(round=round_name, field=field_id):
                    self.assertTrue((folder(round_name, field_id, 0) / 'master.blend').is_file())


class PlacementTests(unittest.TestCase):
    def test_one_fixed_placement_per_object_and_nothing_shrunk_out_of_legibility(self):
        for round_name, (_, _, fields) in ROUNDS.items():
            table = read(WORK / round_name / 'fit-table.json')['fields']
            for field_id in fields:
                with self.subTest(round=round_name, field=field_id):
                    for key, row in table[field_id].items():
                        self.assertGreaterEqual(row['factor'], .85, key)
                    seen = {}
                    for cell in read(WORK / round_name / 'fields' / field_id / 'footprint-fit.json')['cells']:
                        self.assertLessEqual(cell['base']['coreMaxOutsideNativePx'], .5)
                        self.assertEqual(cell['base']['coreObjectsOutside'], [])
                        for row in cell['objects']:
                            key = str(row['sourceOrdinal'])
                            self.assertEqual(row['placement'], table[field_id][key])
                            self.assertEqual(seen.setdefault(key, row['placement']), row['placement'])
                            self.assertLessEqual(row['worstOutsideNativePx'], .5)

    def test_round_check_reports_pass_with_placement_checks(self):
        for round_name, (module_name, _, fields) in ROUNDS.items():
            with self.subTest(round=round_name):
                report = read(WORK / round_name / 'review/report.json')
                self.assertEqual(report['status'], 'PASS_OFFLINE_CELL_BANK_ONLY')
                self.assertEqual(report['module'], module_name)
                self.assertIs(report['runtimeEligible'], False)
                self.assertIs(report['humanApproved'], False)
                self.assertIsNone(report['clockHz'])
                for field_id in fields:
                    self.assertGreater(report['fields'][field_id]['placementChecks'], 0, field_id)

    def test_shrine_polish_designs_every_object_at_full_size(self):
        table = read(WORK / 'opm-opus-r14/fit-table.json')['fields']['field_cm13_01']
        self.assertEqual({row['factor'] for row in table.values()}, {1.0})
        self.assertLess(read(WORK / 'opm-opus-r3/fit-table.json')['fields']['field_cm13_01']['6']['factor'], .9)


class AnimationTests(unittest.TestCase):
    def test_animated_cores_record_original_timing_and_hashes(self):
        for round_name in ('opm-opus-r10', 'opm-opus-r11'):
            for field_id in ROUNDS[round_name][2]:
                root = folder(round_name, field_id, 0)
                manifest = read(root / 'modular-manifest.json')
                frames = manifest.get('coreFrames') or []
                with self.subTest(round=round_name, field=field_id):
                    for frame in frames:
                        self.assertTrue(frame['durationEvidence'])
                        self.assertGreater(frame['durationRawTicks'], 0)
                        self.assertEqual(sha(root / frame['src']), frame['sha256'].lower())

    def test_gas_chamber_plumes_have_eight_distinct_rendered_poses(self):
        cells = rendered_cells('opm-opus-r16', 'field_cm23_01')
        self.assertEqual(cells, list(range(12)))
        poses = {sha(folder('opm-opus-r16', 'field_cm23_01', cell) / 'frame-00.png') for cell in range(4, 12)}
        self.assertEqual(len(poses), 8)


class LayoutTests(unittest.TestCase):
    def test_final_layout_covers_all_37_with_no_fail_and_no_object_overflow(self):
        layout = read(FINAL_REVIEW / 'full-layout/report.json')
        self.assertEqual(layout['scenarioCount'], 37)
        worst = read(FINAL_REVIEW / 'footprint/worst-of-all.json')
        self.assertEqual(worst['counts']['FAIL'], 0)
        self.assertEqual(sum(worst['counts'].values()), 37)
        for record in worst['records']:
            self.assertEqual(record['objectsOnlySolidOverflowPixels'], 0, record['fieldId'])

    def test_final_layout_uses_the_newest_round_for_every_opus_field(self):
        overrides = read(FINAL_REVIEW / 'full-layout/report.json')['candidateOverrides']
        for field_id, round_name in LATEST.items():
            with self.subTest(field=field_id):
                self.assertIn(f'/{round_name}/', overrides[field_id])

    def test_the_waiting_room_and_structural_lid_stay_untouched(self):
        overrides = read(FINAL_REVIEW / 'full-layout/report.json')['candidateOverrides']
        for field_id in ('field_cm28_01', 'field_cm29_01'):
            self.assertFalse(any(f'/{name}/' in overrides.get(field_id, '') for name in ROUNDS), field_id)

    def test_superseded_rounds_stay_on_disk_for_comparison(self):
        for round_name, (_, _, fields) in ROUNDS.items():
            for field_id in fields:
                self.assertTrue((folder(round_name, field_id, 0) / 'frame-00.png').is_file(), (round_name, field_id))


if __name__ == '__main__':
    unittest.main()
