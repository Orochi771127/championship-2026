"""Mechanical art tests, deliberately not an aesthetic acceptance gate."""
import importlib.util
import json
import subprocess
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('environment_pilot', ROOT / 'scripts/build-environment-pilot.py')
pilot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pilot)
BATCH = pilot.BATCH


class EnvironmentPilotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = pilot.read_json(BATCH / 'manifest.json')
        cls.fields = {f['fieldId']: f for f in cls.manifest['fields']}

    def test_no_runtime_or_shipping_approval(self):
        for key in ('runtimeEligible', 'shippingReady', 'ownerApproved'):
            self.assertIs(self.manifest[key], False)
        self.assertEqual(len(self.fields), 8)
        self.assertEqual(sum(len(f['frames']) for f in self.fields.values()), 10)

    def test_exact_dimensions_frames_timing_and_nearest(self):
        for f in self.fields.values():
            runtime = pilot.read_json(ROOT / f'assets/production/{f["family"]}/licensed-runtime-v1/manifest.json')
            old = next(x for x in runtime['fields'] if x['fieldId'] == f['fieldId'])
            self.assertEqual(len(f['frames']), len(old['frames']))
            for i, (frame, original) in enumerate(zip(f['frames'], old['frames'])):
                image = Image.open(BATCH / frame['src']).convert('RGBA')
                native = Image.open(BATCH / 'fields' / f['fieldId'] / f'native-{i:02}.png').convert('RGBA')
                self.assertEqual(image.size, (old['worldWidthPx'], old['worldHeightPx']))
                self.assertEqual(pilot.digest(BATCH / frame['src']), frame['sha256'])
                self.assertTrue(np.array_equal(image, native.resize(image.size, pilot.NEAREST)))
                self.assertEqual(frame.get('durationMs'), original.get('durationMs'))
                self.assertEqual(frame.get('durationRawTicks'), original.get('durationRawTicks'))
                self.assertEqual(pilot.pixel_report(native)['partialAlphaPixels'], 0)

    def test_walk_cells_have_opaque_ground_and_outside_stays_clear(self):
        catalog = pilot.read_json(ROOT / 'src/data/championship/catalogs/raising-ground.r1.json')
        ground = {f['definitionIndex']: f for f in catalog['fields']}
        for f in self.fields.values():
            if f['family'] != 'cage':
                continue
            image = np.asarray(Image.open(BATCH / 'fields' / f['fieldId'] / 'layers/ground.png'))
            g = ground[f['definitionIndex']]
            cells = pilot.expand_ground(g)
            owned = pilot.grid_expand(cells[:, :, 0], g['width'], g['height'], 8).astype(bool)
            self.assertTrue((image[owned, 3] == 255).all())
            if f['definitionIndex'] != 36:
                self.assertTrue((image[~owned, 3] == 0).all())

    def test_source_order_pivots_bounds_and_assembly(self):
        count = 0
        for f in self.fields.values():
            if f['family'] != 'cage':
                continue
            folder = BATCH / 'fields' / f['fieldId']
            objects = pilot.read_json(folder / 'objects.json')
            original = pilot.read_json(pilot.EVIDENCE / f['fieldId'] / 'object-placement.json')['placements']
            self.assertEqual(len(objects), len(original))
            assembled = Image.open(folder / 'layers/ground.png').convert('RGBA')
            if original:
                bank = pilot.read_json(pilot.EVIDENCE / f['fieldId'] / 'object-cell-bank.json')
                cells = {c['cellIndex']: c for c in bank['renderedCells']}
            for obj, source in zip(objects, original):
                count += 1
                cell = cells[source['resolvedFirstFrameCellId']]
                self.assertEqual(obj['order'], source['ordinal'])
                self.assertEqual(obj['placement'], [source['sourceX'], source['sourceY']])
                self.assertEqual(obj['pivot'], [cell['anchorX'], cell['anchorY']])
                self.assertEqual(obj['destination'], [source['sourceX'] - cell['anchorX'], source['sourceY'] - cell['anchorY']])
                sprite = Image.open(folder / obj['src']).convert('RGBA')
                bbox = sprite.getbbox()
                l, t, r, b = obj['safeAlphaBounds']
                self.assertTrue(l <= bbox[0] < bbox[2] <= r and t <= bbox[1] < bbox[3] <= b)
                assembled.alpha_composite(sprite, tuple(obj['destination']))
            expected = Image.open(folder / 'native-00.png').convert('RGBA')
            self.assertTrue(np.array_equal(assembled, expected))
        self.assertEqual(count, 11)

    def test_local_animation_does_not_change_other_pixels_or_alpha(self):
        for field_id in ('field_cm07_01', 'field_hm01_01'):
            folder = BATCH / 'fields' / field_id
            a = np.asarray(Image.open(folder / 'native-00.png'))
            b = np.asarray(Image.open(folder / 'native-01.png'))
            mask = np.asarray(Image.open(folder / 'animation-mask.png')) > 0
            changed = np.any(a != b, axis=2)
            self.assertTrue(changed.any())
            self.assertFalse(changed[~mask].any())
            self.assertTrue(np.array_equal(a[:, :, 3], b[:, :, 3]))
            if field_id == 'field_cm07_01':
                safe = pilot.ndimage.binary_erosion(a[:, :, 3] > 0, iterations=8)
                self.assertFalse(changed[~safe].any())

    def test_assembly_uses_actual_crop_order_and_wrap_fragments(self):
        actual = json.loads(subprocess.check_output(['node', 'scripts/lib/cage-authoring-geometry.mjs'], cwd=ROOT, encoding='utf-8'))
        self.assertEqual(actual, pilot.read_json(BATCH / 'geometry-snapshot.json'))
        self.assertEqual({s['id'] for s in actual['scenarios']}, {'upper-row', 'lower-row', 'wrap-edge', 'starting-ranch'})
        for scenario in actual['scenarios']:
            plan = scenario['plan']
            canvas = Image.new('RGBA', (plan['wrapWidthPx'], plan['residentViewport']['height']))
            self.assertTrue(any('fragmentOfSlot' in p for p in plan['placements']))
            for p in plan['placements']:
                image = Image.open(BATCH / self.fields[p['fieldId']]['frames'][0]['src']).convert('RGBA')
                r = p['sourceRect']
                crop = image.crop((r['x'], r['y'], r['x'] + r['width'], r['y'] + r['height']))
                canvas.alpha_composite(crop, (p['x'], p['y']))
            self.assertTrue(np.array_equal(canvas, Image.open(BATCH / 'assemblies' / (scenario['id'] + '.png'))))

    def test_battle_standing_regions_are_clear_floor(self):
        f = self.fields['field_bm01_01']
        image = np.asarray(Image.open(BATCH / f['frames'][0]['src']))
        palette = {tuple(c) for c in pilot.read_json(BATCH / 'recipe.json')['materials']['clay']['palette']}
        for slot in f['standingSlotsPx'].split(';'):
            x0, y0, x1, y1 = map(int, slot.split(':')[1].split(','))
            area = image[y0:y1, x0:x1]
            self.assertTrue((area[:, :, 3] == 255).all())
            colors = {tuple(c) for c in np.unique(area[:, :, :3].reshape(-1, 3), axis=0)}
            self.assertTrue(colors <= palette)

    def test_geometry_source_locks_still_match(self):
        for name, expected in pilot.read_json(BATCH / 'source-locks.json').items():
            path = Path(name) if Path(name).is_absolute() else ROOT / name
            self.assertEqual(pilot.digest(path), expected, name)

    def test_rejected_raw_not_selected_and_no_more_than_two_attempts(self):
        recipe = pilot.read_json(BATCH / 'recipe.json')
        selected = {j['key'] for j in recipe['jobs'] if j['selected']}
        for p in list(recipe['materials'].values()) + list(recipe['props'].values()):
            self.assertIn(p['job'], selected)
        from collections import Counter
        attempts = Counter(j['key'].replace('_xl', '').replace('_r2', '') for j in recipe['jobs'])
        self.assertLessEqual(max(attempts.values()), 2)
        self.assertEqual(len(recipe['jobs']), 14)

    def test_bad_grid_and_bad_bounds_fail_closed(self):
        with self.assertRaises(ValueError):
            pilot.grid_expand([1, 2, 3], 2, 2, 8)
        with self.assertRaises(ValueError):
            pilot.expand_ground({'width': 2, 'height': 2, 'runs': [[3, 1, 0, 1]]})
        with self.assertRaises(ValueError):
            pilot.fit_prop(Image.new('RGBA', (10, 10)), (8, 8), [-1, 0, 8, 8])
        with self.assertRaises(ValueError):
            pilot.masked(Image.new('RGBA', (8, 8)), np.ones((4, 4), bool))


if __name__ == '__main__':
    unittest.main()
