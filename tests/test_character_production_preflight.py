"""Contract boundary tests for offline production preflight (synthetic art only)."""
import copy
import importlib.util
import tempfile
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('preflight', ROOT / 'scripts/prepare-character-production.py')
P = importlib.util.module_from_spec(spec)
spec.loader.exec_module(P)


class PreflightTests(unittest.TestCase):
    def test_timing_cell_order_loop_and_modes_cannot_drift(self):
        base = {'frames': [{'cell': 0, 'ticks': 31}, {'cell': 1, 'ticks': 22}], 'mode': 2, 'loop': 0}
        for field in ('ticks', 'cell', 'order', 'mode', 'loop'):
            candidate = copy.deepcopy(base)
            if field in ('ticks', 'cell'):
                candidate['frames'][0][field] += 1
            elif field == 'order':
                candidate['frames'].reverse()
            else:
                candidate[field] += 1
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, 'MOTION_CONTRACT_DRIFT'):
                P.verify_motion(base, candidate)

    def test_native_origin_preserves_relative_displacement(self):
        _, origin = P.canvas_origin([[-16, -21, 17, 8]])
        palette = [(0, 0, 0, 0), (40, 90, 130, 255)]
        a = {'key': 'main/cell_000', 'nativeBounds': [-2, -1, 0, 1], 'pixels': [[1, 0], [1, 1]]}
        b = {**a, 'nativeBounds': [1, 3, 3, 5]}
        x = P.place_authored(a, palette, origin).getchannel('A').getbbox()
        y = P.place_authored(b, palette, origin).getchannel('A').getbbox()
        self.assertEqual((y[0] - x[0], y[1] - x[1]), (3, 4))

    def test_clipped_visible_pixels_refused(self):
        pose = {'key': 'main/cell_000', 'nativeBounds': [63, 0, 65, 1], 'pixels': [[1, 1]]}
        with self.assertRaisesRegex(ValueError, 'AUTHORED_PIXELS_CLIPPED'):
            P.place_authored(pose, [(0, 0, 0, 0), (1, 1, 1, 255)], [0, 0])

    def test_alpha_match_does_not_prove_palette_map(self):
        source = Image.new('RGBA', (2, 1), (10, 20, 30, 255))
        target = Image.new('RGBA', (2, 1), (1, 2, 3, 255))
        target.putpixel((1, 0), (4, 5, 6, 255))
        self.assertIsNone(P.palette_relation(source, target))

    def test_alpha_fill_is_only_unapproved_proposal(self):
        source = Image.new('RGBA', (2, 1), (10, 20, 30, 255))
        target = Image.new('RGBA', (2, 1), (0, 0, 0, 255))
        relation = P.palette_relation(source, target)
        self.assertEqual(relation['operationClass'], 'SOLID_ALPHA_FILL')
        self.assertFalse(relation['approvedForProduction'])

    def test_white_silhouette_preserves_authored_alpha(self):
        original = Image.new('RGBA', (64, 64))
        original.putpixel((31, 38), (40, 90, 130, 255))
        result = P.derive_silhouette(original, [255, 255, 255, 255])
        self.assertEqual(result.getchannel('A').tobytes(), original.getchannel('A').tobytes())
        self.assertEqual(result.getpixel((31, 38)), (255, 255, 255, 255))
        self.assertEqual(result.getpixel((0, 0)), (0, 0, 0, 0))
        with self.assertRaisesRegex(ValueError, 'UNPROVEN'):
            P.derive_silhouette(original, [100, 100, 100, 255])

    def test_input_drift_and_traversal_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'input.json').write_text('changed')
            with self.assertRaisesRegex(ValueError, 'INPUT_DRIFT'):
                P.verify_lock(root, {'input.json': '0' * 64})
            with self.assertRaisesRegex(ValueError, 'escapes'):
                P.verify_lock(root, {'../outside.json': '0' * 64})

    def test_publish_refuses_overwrite_and_check_writes_nothing(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'new'
            with self.assertRaisesRegex(ValueError, 'MISSING'):
                P.SOURCE.publish({'a': b'a'}, out, check=True)
            self.assertFalse(out.exists())
            P.SOURCE.publish({'a': b'a'}, out)
            with self.assertRaisesRegex(ValueError, 'DRIFT'):
                P.SOURCE.publish({'a': b'b', 'b': b'b'}, out)
            self.assertEqual((out / 'a').read_bytes(), b'a')
            self.assertFalse((out / 'b').exists())


if __name__ == '__main__':
    unittest.main()
