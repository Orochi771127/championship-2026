import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts/build-cage-full-layout-review.py"
SPEC = importlib.util.spec_from_file_location("build_cage_full_layout_review", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class CageFullLayoutReviewTests(unittest.TestCase):
    def test_full_layout_review_uses_all_37_catalog_fields(self):
        original_out = MODULE.OUT
        with tempfile.TemporaryDirectory() as directory:
            MODULE.OUT = Path(directory)
            try:
                report = MODULE.build(out=Path(directory))
            finally:
                MODULE.OUT = original_out
            catalog = json.loads(MODULE.CATALOG_PATH.read_text(encoding="utf-8"))
            self.assertEqual(report["status"], "PASS_FULL_LAYOUT_REVIEW_ARTIFACT_NOT_RUNTIME_ACCEPTANCE")
            self.assertEqual(report["authority"], "EXISTING_NATIVE_RANCH_VALIDATION_AND_ART_PLAN")
            self.assertEqual(report["scenarioCount"], 37)
            self.assertEqual(
                {entry["fieldId"] for entry in report["records"]},
                {entry["fieldId"] for entry in catalog["fields"]},
            )
            self.assertTrue((Path(directory) / "all-37-full-layout-contact-sheet.jpg").exists())
            self.assertEqual(len(list((Path(directory) / "boards").glob("*.png"))), 37)

    def test_review_plan_has_one_unique_definition_per_scenario(self):
        plan = MODULE.load_plan()
        self.assertEqual(plan["scenarioCount"], 37)
        self.assertEqual(sorted(entry["definitionIndex"] for entry in plan["scenarios"]), list(range(37)))
        self.assertTrue(all(entry["unlockedCount"] == 20 for entry in plan["scenarios"]))


if __name__ == "__main__":
    unittest.main()
