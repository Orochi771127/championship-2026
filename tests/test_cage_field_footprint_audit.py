import importlib.util
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts/audit-cage-field-footprint.py"
SPEC = importlib.util.spec_from_file_location("audit_cage_field_footprint", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


FOOTPRINT = {
    "nativeSize": [96, 112],
    "outline": [[0, 24], [48, 0], [96, 24], [96, 88], [48, 112], [0, 88]],
}


class CageFieldFootprintAuditTests(unittest.TestCase):
    def test_inside_content_passes(self):
        image = Image.new("RGBA", (384, 448), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        draw.polygon([(x * 4, y * 4) for x, y in FOOTPRINT["outline"]], fill=(40, 120, 180, 255))
        metrics, overlay = MODULE.measure_overflow(image, FOOTPRINT)
        self.assertEqual(metrics["severity"], "PASS")
        self.assertEqual(metrics["solidOverflowPixels"], 0)
        overlay.close()
        image.close()

    def test_large_solid_overhang_fails(self):
        image = Image.new("RGBA", (384, 448), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        draw.polygon([(x * 4, y * 4) for x, y in FOOTPRINT["outline"]], fill=(40, 120, 180, 255))
        draw.rectangle((330, 0, 383, 120), fill=(255, 40, 40, 255))
        metrics, overlay = MODULE.measure_overflow(image, FOOTPRINT)
        self.assertEqual(metrics["severity"], "FAIL")
        self.assertGreater(metrics["solidOverflowPixels"], 0)
        self.assertIsNotNone(metrics["overflowBoundsPx"])
        overlay.close()
        image.close()

    def test_antialias_tolerance_ignores_small_edge_halo(self):
        image = Image.new("RGBA", (384, 448), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        draw.polygon([(x * 4, y * 4) for x, y in FOOTPRINT["outline"]], fill=(40, 120, 180, 255))
        draw.line([(x * 4, y * 4) for x, y in FOOTPRINT["outline"]] + [(0, 96)],
                  fill=(40, 120, 180, 80), width=3)
        metrics, overlay = MODULE.measure_overflow(image, FOOTPRINT, tolerance_px=6)
        self.assertEqual(metrics["severity"], "PASS")
        overlay.close()
        image.close()


if __name__ == "__main__":
    unittest.main()
