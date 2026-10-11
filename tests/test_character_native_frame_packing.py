"""Coordinate regression coverage for art-only per-cell canvas packing."""
import contextlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


F = module('packing_full_sheet', 'm001-full-sheet.py')
B = module('packing_source', 'character-batch-job.py')


class NativeFramePackingTests(unittest.TestCase):
    def assemble(self, origins=None, delta=(3, 2)):
        master = Image.new('RGBA', (64, 64))
        master.putpixel((2, 20), (23, 41, 67, 255))
        master.putpixel((3, 21), (111, 181, 219, 255))
        slots = {
            'main/cell_000': {'canonical': 'main/cell_000', 'sourceTranslationFromCanonical': [0, 0]},
            'main/cell_001': {'canonical': 'main/cell_000', 'sourceTranslationFromCanonical': list(delta)},
            'sub/cell_000': {'canonical': 'main/cell_000', 'sourceTranslationFromCanonical': [0, 0]},
        }
        if origins:
            for key, origin in zip(slots, origins):
                slots[key]['canvasOrigin'] = list(origin)
        contract = {'sides': {'main': {'sequences': [{'id': 7, 'playbackMode': 1,
            'loopStartFrame': 1, 'frames': [{'cell': 0, 'ticks': 3}, {'cell': 1, 'ticks': 9}]}]},
            'sub': {'sequences': [{'id': 0, 'playbackMode': 0, 'loopStartFrame': 0,
                'frames': [{'cell': 0, 'ticks': 5}]}]}}}
        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / 'bank'
            with patch.object(F.P, 'read', return_value=contract), contextlib.redirect_stdout(io.StringIO()):
                F.assemble({'main/cell_000': master}, {'slots': slots},
                    {'entityId': 'synthetic', 'sourceOrigin': [32, 50]}, {}, [], {}, out, {})
            bank = json.loads((out / 'bank.json').read_text('utf8'))
            pixels = {key: Image.open(out / row['image']).convert('RGBA').copy()
                for key, row in bank['cells'].items()}
        return master, bank, pixels, contract

    def test_native_world_translation_survives_different_storage_origins(self):
        _, bank, images, _ = self.assemble([(32, 50), (40, 50), (32, 45)], (-10, 5))
        row = bank['cells']['main/cell_001']
        self.assertEqual([-2, 5], row['translation'])
        self.assertEqual([-10, 5], row['sourceTranslationFromCanonical'])
        self.assertEqual([40, 50], row['canvasOrigin'])
        self.assertEqual((23, 41, 67, 255), images['main/cell_001'].getpixel((0, 25)))
        self.assertEqual((-10, 5), ((0 - 40) - (2 - 32), (25 - 50) - (20 - 50)))
        self.assertEqual((23, 41, 67, 255), images['sub/cell_000'].getpixel((2, 15)))

    def test_legacy_common_origin_retains_old_pixel_translation_and_schema(self):
        _, bank, images, _ = self.assemble()
        row = bank['cells']['main/cell_001']
        self.assertEqual([3, 2], row['translation'])
        self.assertNotIn('canvasOrigin', row)
        self.assertNotIn('sourceTranslationFromCanonical', row)
        self.assertEqual((23, 41, 67, 255), images['main/cell_001'].getpixel((5, 22)))

    def test_alias_clipping_is_rejected_before_publish(self):
        with self.assertRaisesRegex(ValueError, 'TRANSLATED_PIXELS_CLIPPED'):
            self.assemble([(32, 50), (32, 50), (32, 50)], (-3, 0))

    def test_sequence_order_ticks_and_loop_survive_packing(self):
        _, bank, _, contract = self.assemble([(32, 50), (40, 50), (32, 45)], (-10, 5))
        self.assertEqual([{'side': side, 'sequence': seq, 'available': True, 'missing': []}
            for side, data in contract['sides'].items() for seq in data['sequences']], bank['sequences'])
        self.assertFalse(bank['runtimeEligible'])

    def test_source_decode_uses_slot_origin_without_discarding_visible_pixels(self):
        native = Image.new('RGBA', (4, 3)); native.putpixel((0, 0), (12, 34, 56, 255))
        inv = {'sourceOrigin': [0, 0], 'slots': {f'{side}/cell_000': {
            'nativeBounds': [-2, -1, 2, 2], 'canvasOrigin': [2, 1]}
            for side in ('main', 'sub')}}
        with patch.object(B.P, 'read', return_value={'cells': [{'cellIndex': 0}]}), \
                patch.object(B.P.SOURCE, 'native_bank', return_value={}), \
                patch.object(B.P.SOURCE, 'render_native', return_value=(native, None)):
            rendered = B.source_images('synthetic', inv)
        for image in rendered.values():
            self.assertEqual((12, 34, 56, 255), image.getpixel((0, 0)))
            self.assertEqual(255, sum(image.getchannel('A').get_flattened_data()))

    def test_source_decode_rejects_visible_content_outside_canvas(self):
        native = Image.new('RGBA', (4, 3), (12, 34, 56, 255))
        inv = {'sourceOrigin': [0, 0], 'slots': {f'{side}/cell_000': {
            'nativeBounds': [-2, -1, 2, 2]} for side in ('main', 'sub')}}
        with patch.object(B.P, 'read', return_value={'cells': [{'cellIndex': 0}]}), \
                patch.object(B.P.SOURCE, 'native_bank', return_value={}), \
                patch.object(B.P.SOURCE, 'render_native', return_value=(native, None)):
            with self.assertRaisesRegex(ValueError, 'SOURCE_CANVAS_CLIPS_VISIBLE_PIXELS'):
                B.source_images('synthetic', inv)


if __name__ == '__main__':
    unittest.main()
