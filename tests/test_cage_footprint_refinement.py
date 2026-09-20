import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from lib.cage_object_animation_contract import extract, assert_unchanged, sha
from lib import cage_footprint_fit as fit

WORK = ROOT / "docs/art/production/original-character-cage-r1/cage-base3d-v1"
OUT = WORK / "opm-footprint-refinement-v1"
FIELDS = ("field_cm11_01", "field_cm25_01", "field_cm26_01")
UPSTREAM = {"field_cm11_01": "cage_nature_authoring.py",
            "field_cm25_01": "cage_remaining_fixed_authoring.py",
            "field_cm26_01": "cage_remaining_fixed_authoring.py"}


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def cell_folder(field_id, cell_id):
    folder = OUT / "seam-v3/fields" / field_id
    return folder if cell_id == 0 else folder / "animation" / f"{cell_id:02d}"


class FootprintRefinementBatchTests(unittest.TestCase):
    def test_numeric_contracts_are_untouched(self):
        for field_id, expected in {"field_cm11_01": (9, 2), "field_cm25_01": (13, 12),
                                   "field_cm26_01": (11, 6)}.items():
            contract = extract(ROOT, field_id)
            cells = {f["cellId"] for o in contract["objects"] for f in o["frames"]}
            self.assertEqual((len(contract["objects"]), len(cells)), expected, field_id)
            self.assertIsNone(contract["clockHz"])
            self.assertFalse(contract["runtimeEligible"])
            assert_unchanged(ROOT, read(OUT / "fields" / field_id / "object-animation-contract.json"))

    def test_review_is_structural_not_runtime_completion(self):
        report = read(OUT / "review/report.json")
        self.assertEqual(report["status"], "PASS_OFFLINE_CELL_BANK_ONLY")
        for key in ("runtimeEligible", "fullCageCompletion", "humanApproved"):
            self.assertFalse(report[key])
        for field_id in FIELDS:
            self.assertGreater(report["fields"][field_id]["placementChecks"], 0)
            for output in report["fields"][field_id]["selections"]:
                self.assertTrue(output["ground"]["pass"])

    def test_every_cell_stays_review_only_and_off_the_runtime(self):
        for field_id in FIELDS:
            for cell in read(OUT / "fields" / field_id / "footprint-fit.json")["cells"]:
                folder = cell_folder(field_id, cell["sourceCellId"])
                manifest = read(folder / "modular-manifest.json")
                self.assertEqual(manifest["status"], "REFINEMENT_BATCH_E_FOOTPRINT_REVIEW_ONLY")
                self.assertFalse(manifest["runtimeEligible"])
                self.assertIsNone(manifest["generation"]["clockHz"])
                self.assertEqual(manifest["generation"]["newGenerationCalls"], 0)
                render = read(folder / "render-report.json")
                self.assertTrue(render["independentPartsExported"])
                self.assertFalse(render["runtimeEligible"])
                self.assertFalse(render["sourceRastersLoaded"])

    def test_each_field_records_the_upstream_family_it_wrapped(self):
        for field_id in FIELDS:
            generation = read(cell_folder(field_id, 0) / "modular-manifest.json")["generation"]
            self.assertEqual(generation["upstreamAuthoringSha256"].lower(),
                             sha(ROOT / "scripts/lib" / UPSTREAM[field_id]), field_id)


class FootprintFitRecordTests(unittest.TestCase):
    def test_a_prop_keeps_one_size_through_its_whole_sequence(self):
        for field_id in FIELDS:
            applied = {}
            for cell in read(OUT / "fields" / field_id / "footprint-fit.json")["cells"]:
                for row in cell["objects"]:
                    key = row["sourceOrdinal"]
                    self.assertEqual(applied.setdefault(key, row["appliedScale"]),
                                     row["appliedScale"], f"{field_id}:{key}")

    def test_applied_scale_never_exceeds_what_was_measured(self):
        for field_id in FIELDS:
            for cell in read(OUT / "fields" / field_id / "footprint-fit.json")["cells"]:
                for row in cell["objects"]:
                    self.assertLessEqual(row["appliedScale"], row["measuredScale"] + 1e-9)
                    self.assertGreater(row["appliedScale"], 0.0)

    def test_source_anchors_and_windows_are_never_rewritten(self):
        """Authoring may move inside a window; the numeric source may not move."""
        for field_id in FIELDS:
            spec = read(WORK / "fields" / field_id / "spec.json")
            windows = {}
            for record in spec["objects"]:
                x, y = record["placement"]
                px, py = record["pivot"]
                w, h = record["size"]
                if record["horizontalFlip"]:
                    px = w - px
                if record["verticalFlip"]:
                    py = h - py
                windows[record["order"]] = ([x - px, y - py, w, h], record["placement"])
            for cell in read(OUT / "fields" / field_id / "footprint-fit.json")["cells"]:
                for row in cell["objects"]:
                    window, anchor = windows[row["sourceOrdinal"]]
                    self.assertEqual(row["sourceWindowNative"], window)
                    self.assertEqual(row["anchorNative"], anchor)

    def test_an_authoring_window_stays_inside_its_source_window(self):
        for field_id in FIELDS:
            for cell in read(OUT / "fields" / field_id / "footprint-fit.json")["cells"]:
                for row in cell["objects"]:
                    sx, sy, sw, sh = row["sourceWindowNative"]
                    ax, ay, aw, ah = row["authoringWindowNative"]
                    self.assertGreaterEqual(ax, sx - 1e-6)
                    self.assertGreaterEqual(ay, sy - 1e-6)
                    self.assertLessEqual(ax + aw, sx + sw + 1e-6)
                    self.assertLessEqual(ay + ah, sy + sh + 1e-6)

    def test_reduced_authoring_windows_lie_inside_the_hex_union(self):
        for field_id in FIELDS:
            footprint = read(cell_folder(field_id, 0) / "render-report.json")["hexFootprint"]
            planes = fit.footprint_cell_planes(footprint, 0.0)
            for row in read(OUT / "fields" / field_id / "footprint-fit.json")["cells"][0]["objects"]:
                if not row["authoringWindowReduced"]:
                    continue
                x, y, w, h = row["authoringWindowNative"]
                for corner in fit.rectangle(x, y, w, h):
                    self.assertTrue(fit.point_inside(corner, planes),
                                    f"{field_id}:{row['sourceOrdinal']}:{corner}")

    def test_nothing_is_suppressed_from_the_full_frame(self):
        """A prop hidden from the frame but exported as a cell is exactly the
        disagreement between the two audits that this batch removes."""
        for field_id in FIELDS:
            for cell in read(OUT / "fields" / field_id / "footprint-fit.json")["cells"]:
                features = read(cell_folder(field_id, cell["sourceCellId"])
                                / "render-report.json")["natureFeatures"]
                self.assertIn("no-full-frame-suppression", features)
                self.assertNotIn("outside-anchor-full-frame-suppression-v1", features)

    def test_only_the_core_of_the_fixed_family_is_clipped(self):
        for field_id in FIELDS:
            record = read(OUT / "fields" / field_id / "footprint-fit.json")["cells"][0]
            self.assertEqual(record["coreClipped"], field_id != "field_cm11_01")


class FootprintContainmentTests(unittest.TestCase):
    """The rendered result, measured against the same hex authority."""

    def test_both_audits_agree_and_no_longer_fail(self):
        base = WORK / "review/field-footprint-audit-v2"
        frame = {row["fieldId"]: row for row in read(base / "report.json")["records"]}
        composite = {row["fieldId"]: row for row in read(base / "composite-report.json")["records"]}
        for field_id in FIELDS:
            self.assertIn(frame[field_id]["severity"], ("PASS", "REVIEW"), field_id)
            self.assertIn(composite[field_id]["worstSeverity"], ("PASS", "REVIEW"), field_id)
            self.assertFalse(composite[field_id]["frameHidesCompositeOverflow"], field_id)
            # No suppression means the frame and the reassembly see the same art.
            self.assertEqual(frame[field_id]["solidOverflowPixels"],
                             composite[field_id]["compositeSolidOverflowPixels"], field_id)

    def test_the_other_thirty_four_fields_were_not_touched(self):
        before = {row["fieldId"]: row["candidateSha256"]
                  for row in read(WORK / "review/field-footprint-audit-v1/report.json")["records"]}
        after = {row["fieldId"]: row["candidateSha256"]
                 for row in read(WORK / "review/field-footprint-audit-v2/report.json")["records"]}
        changed = {field for field in after if before[field] != after[field]}
        self.assertEqual(changed, set(FIELDS))


if __name__ == "__main__":
    unittest.main()
