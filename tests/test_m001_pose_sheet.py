import importlib.util
import unittest
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('pose_import', ROOT / 'scripts/import-m001-pose-sheet.py')
M = importlib.util.module_from_spec(spec)
spec.loader.exec_module(M)


class PoseSheetTests(unittest.TestCase):
    def test_rgb_and_opaque_backgrounds_rejected(self):
        palette = [(0, 0, 0, 0), (255, 200, 20, 255)]
        for image in (Image.new('RGB', (256, 128)), Image.new('RGBA', (256, 128), (0, 0, 0, 255))):
            with self.assertRaises(ValueError):
                M.normalize_sheet(image, palette)

    def test_shared_sampling_keeps_small_detached_parts_and_relative_offsets(self):
        palette = [(0, 0, 0, 0), (255, 200, 20, 255)]
        image = Image.new('RGBA', (256, 128))
        image.putpixel((10, 10), palette[1])
        image.putpixel((15, 12), palette[1])
        image.putpixel((77, 16), palette[1])
        result = M.normalize_sheet(image, palette)
        self.assertEqual(result.tobytes(), image.tobytes())

    def test_sub_has_no_independent_production_master(self):
        plan = M.P.read(M.P.WORK / 'generated/preflight.json')
        sub = [v for k, v in plan['slots'].items() if k.startswith('sub/')]
        self.assertEqual(len(sub), 18)
        self.assertTrue(all(v['canonical'].startswith('main/') and v['sameAsCell'] for v in sub))
        self.assertEqual(len({v['canonical'] for v in plan['slots'].values()}), 53)

    def test_pair_uses_identical_transform_and_preserves_droplets(self):
        palette = [(0, 0, 0, 0), (255, 200, 20, 255)]
        image = Image.new('RGBA', (64, 32))
        for x in (8, 17, 40, 49):
            image.putpixel((x, 20), palette[1])
        result = M.normalize_sheet(image, palette, (2, 1), 32, (18, 15))
        self.assertEqual(result.size, (128, 64))
        for x in (26, 35, 90, 99):
            self.assertEqual(result.getpixel((x, 35)), palette[1])
        self.assertEqual(result.getpixel((30, 35)), palette[0])
        with self.assertRaises(ValueError):
            M.normalize_sheet(image, palette, (2, 1), 32, (40, 0))


if __name__ == '__main__':
    unittest.main()
