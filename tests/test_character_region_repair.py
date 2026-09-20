"""Protection checks for generated paint, independent of successful art review."""
import importlib.util
import unittest
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('region_repair', ROOT/'scripts/import-character-region-repair.py')
R = importlib.util.module_from_spec(spec)
spec.loader.exec_module(R)


class RegionRepairTests(unittest.TestCase):
    def test_generated_halo_shape_and_face_cannot_replace_original(self):
        base = Image.new('RGBA', (64, 64))
        base.putpixel((25, 30), (90, 70, 40, 255))
        face = (36, 86, 91, 255)
        base.putpixel((26, 30), face)
        base.putpixel((24, 30), (90, 70, 40, 255))
        generated = Image.new('RGBA', (64, 64), (220, 155, 30, 255))
        gold = (214, 155, 38, 255)
        out, edits = R.apply_region(base, generated, [25, 29, 30, 33], [gold], [face])
        self.assertEqual(out.getpixel((25, 30)), gold)
        self.assertEqual(out.getpixel((26, 30)), face)
        self.assertEqual(out.getpixel((24, 30)), base.getpixel((24, 30)))
        self.assertEqual(out.getpixel((27, 30)), (0, 0, 0, 0))
        self.assertEqual(out.getchannel('A').tobytes(), base.getchannel('A').tobytes())
        self.assertEqual(len(edits), 1)

    def test_semtransparent_glow_and_nonbinding_colors_are_ignored(self):
        base = Image.new('RGBA', (64, 64), (90, 70, 40, 255))
        generated = Image.new('RGBA', (64, 64), (250, 250, 240, 255))
        generated.putpixel((25, 30), (220, 155, 30, 30))
        out, edits = R.apply_region(base, generated, [25, 29, 30, 33], [(214, 155, 38, 255)], [])
        self.assertEqual(out.tobytes(), base.tobytes())
        self.assertEqual(edits, [])

    def test_bad_grid_and_bounds_fail_closed(self):
        for size, region in [((63, 64), [0, 0, 2, 2]), ((64, 64), [-1, 0, 2, 2])]:
            with self.assertRaises(Exception):
                R.apply_region(Image.new('RGBA', (64, 64)), Image.new('RGBA', size), region, [(1, 1, 1, 255)], [])


if __name__ == '__main__':
    unittest.main()
