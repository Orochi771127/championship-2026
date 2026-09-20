import json
import math
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from lib import cage_footprint_fit as fit


HEX = [[0, 24], [48, 0], [96, 24], [96, 88], [48, 112], [0, 88]]
FOOTPRINT = {
    "nativeSize": [96, 112],
    "outline": HEX,
    "cells": [{"bit": 0, "column": 0, "row": 0, "polygon": HEX}],
    "boundaryEdges": [[HEX[i], HEX[(i + 1) % 6]] for i in range(6)],
}


class ProjectionTests(unittest.TestCase):
    def test_round_trip_ground_coordinates(self):
        for x, y in ((0, 0), (37, 11), (240, 200), (96, 112)):
            projected = fit.native_screen(fit.world_point(x, y))
            self.assertAlmostEqual(projected[0], x, places=6)
            self.assertAlmostEqual(projected[1], y, places=6)

    def test_height_lifts_a_point_up_the_screen(self):
        ground = fit.native_screen(fit.world_point(50, 60, 0))
        raised = fit.native_screen(fit.world_point(50, 60, 1.5))
        self.assertAlmostEqual(raised[0], ground[0], places=6)
        self.assertAlmostEqual(ground[1] - raised[1], fit.screen_lift(1.5), places=6)
        self.assertGreater(fit.screen_lift(1.5), 0)

    def test_matches_the_shipped_hex_floor_extraction(self):
        """The authority script measures floor vertices with the same formula."""
        world = fit.world_point(73, 41)
        measured = ((world[0] + world[1]) * fit.UNIT / math.sqrt(2),
                    (world[0] - world[1]) * fit.UNIT * fit.SIN_ELEVATION / math.sqrt(2))
        self.assertAlmostEqual(measured[0], 73, places=6)
        self.assertAlmostEqual(measured[1], 41, places=6)


class ClipTests(unittest.TestCase):
    def test_polygon_inside_is_unchanged_in_area(self):
        square = fit.rectangle(30, 40, 30, 30)
        pieces = fit.clip_to_footprint(square, FOOTPRINT)
        self.assertEqual(len(pieces), 1)
        self.assertAlmostEqual(abs(fit.signed_area(pieces[0])), 900, places=4)

    def test_overhanging_polygon_is_trimmed(self):
        overhang = fit.rectangle(-20, 30, 40, 40)
        pieces = fit.clip_to_footprint(overhang, FOOTPRINT)
        self.assertTrue(pieces)
        self.assertLess(sum(abs(fit.signed_area(piece)) for piece in pieces), 1600)
        planes = fit.half_planes(HEX)
        for piece in pieces:
            for point in piece:
                self.assertGreaterEqual(fit.clearance(point, planes), -1e-6)

    def test_polygon_fully_outside_yields_nothing(self):
        self.assertEqual(fit.clip_to_footprint(fit.rectangle(200, 200, 10, 10), FOOTPRINT), [])

    def test_height_pushes_the_clip_further_in(self):
        flat = fit.clip_to_footprint(fit.rectangle(0, 20, 96, 80), FOOTPRINT, height=0.0)
        tall = fit.clip_to_footprint(fit.rectangle(0, 20, 96, 80), FOOTPRINT, height=0.5)
        self.assertLess(sum(abs(fit.signed_area(p)) for p in tall),
                        sum(abs(fit.signed_area(p)) for p in flat))

    def test_shared_seam_is_not_inset(self):
        """Two hexes sharing an edge must still meet exactly after clipping."""
        left = [[0, 24], [48, 0], [96, 24], [96, 88], [48, 112], [0, 88]]
        right = [[96, 24], [144, 0], [192, 24], [192, 88], [144, 112], [96, 88]]
        footprint = {
            "cells": [{"bit": 0, "polygon": left}, {"bit": 2, "polygon": right}],
            "boundaryEdges": [[left[0], left[1]], [left[1], left[2]], [left[4], left[3]],
                              [left[5], left[4]], [left[0], left[5]],
                              [right[0], right[1]], [right[1], right[2]], [right[2], right[3]],
                              [right[3], right[4]], [right[4], right[5]]],
        }
        band = fit.rectangle(20, 40, 150, 20)
        pieces = fit.clip_to_footprint(band, footprint, inset=2.0)
        self.assertEqual(len(pieces), 2)
        # The band is continuous, so the two pieces must tile it without a gap.
        total = sum(abs(fit.signed_area(piece)) for piece in pieces)
        xs = [point[0] for piece in pieces for point in piece]
        self.assertAlmostEqual(total, 20 * (max(xs) - min(xs)), places=4)


class FitFactorTests(unittest.TestCase):
    def test_object_already_inside_is_left_alone(self):
        planes = fit.half_planes(HEX, 2.0)
        points = [(44, 54), (52, 54), (48, 62)]
        self.assertEqual(fit.fit_factor(points, planes, (48, 56)), 1.0)

    def test_overhanging_object_shrinks_just_enough(self):
        planes = fit.half_planes(HEX, 2.0)
        center = (48, 56)
        points = [(48, -40), (20, 60), (76, 60)]
        factor = fit.fit_factor(points, planes, center)
        self.assertLess(factor, 1.0)
        self.assertGreater(factor, 0.0)
        for x, y in points:
            scaled = (center[0] + (x - center[0]) * factor, center[1] + (y - center[1]) * factor)
            self.assertGreaterEqual(fit.clearance(scaled, planes), -1e-6)

    def test_centre_outside_reports_no_usable_interior(self):
        self.assertEqual(fit.fit_factor([(48, 56)], fit.half_planes(HEX, 2.0), (500, 500)), 0.0)

    def test_precomputed_support_matches_a_full_scan(self):
        planes = fit.half_planes(HEX, 1.0)
        points = [(x * 1.7 - 30, y * 2.3 - 20) for x in range(12) for y in range(12)]
        support = fit.plane_support(points, planes)
        for center in ((48, 56), (40, 70), (60, 45)):
            brute = 1.0
            for (nx, ny, offset) in planes:
                room = nx * center[0] + ny * center[1] - offset
                for x, y in points:
                    reach = -(nx * (x - center[0]) + ny * (y - center[1]))
                    if reach > 1e-9:
                        brute = min(brute, room / reach)
            self.assertAlmostEqual(fit.fit_factor(points, planes, center, support), max(0.0, brute),
                                   places=9)


class PlanTests(unittest.TestCase):
    def test_contained_window_needs_no_change(self):
        plan = fit.plan_object_fit([(40, 50), (56, 66)], fit.rectangle(36, 46, 24, 24),
                                   FOOTPRINT, inset=2.0)
        self.assertEqual(plan["factor"], 1.0)
        self.assertEqual(plan["cellBit"], 0)

    def test_window_straddling_the_edge_still_finds_an_interior(self):
        plan = fit.plan_object_fit([(10, -10), (40, 40)], fit.rectangle(0, -17, 32, 48),
                                   FOOTPRINT, inset=2.0)
        self.assertIsNotNone(plan["center"])
        self.assertGreater(plan["factor"], 0.0)
        self.assertLess(plan["factor"], 1.0)
        planes = fit.half_planes(HEX, 2.0)
        self.assertGreaterEqual(fit.clearance(plan["center"], planes), 0.0)

    def test_window_entirely_outside_is_reported_not_silently_clipped(self):
        plan = fit.plan_object_fit([(300, 300)], fit.rectangle(300, 300, 8, 8), FOOTPRINT, inset=2.0)
        self.assertIsNone(plan["cellBit"])
        self.assertEqual(plan["factor"], 0.0)
        self.assertIn("reason", plan)

    def test_anchor_ignores_object_geometry_so_frames_cannot_drift(self):
        window = fit.rectangle(8, -17, 32, 48)
        first = fit.choose_anchor(window, FOOTPRINT, 1.0, preferred=(24, 30))
        second = fit.choose_anchor(window, FOOTPRINT, 1.0, preferred=(24, 30))
        self.assertEqual(first["center"], second["center"])
        self.assertEqual(first["cellBit"], second["cellBit"])
        thin = fit.plan_object_fit([(10, -12), (38, 20)], window, FOOTPRINT, 1.0, (24, 30))
        wide = fit.plan_object_fit([(-40, -60), (90, 40)], window, FOOTPRINT, 1.0, (24, 30))
        self.assertEqual(thin["center"], wide["center"])
        self.assertGreater(thin["factor"], wide["factor"])

    def test_anchor_picks_the_hex_that_owns_most_of_the_window(self):
        left = [[0, 24], [48, 0], [96, 24], [96, 88], [48, 112], [0, 88]]
        right = [[96, 24], [144, 0], [192, 24], [192, 88], [144, 112], [96, 88]]
        footprint = {"cells": [{"bit": 0, "polygon": left}, {"bit": 2, "polygon": right}],
                     "boundaryEdges": []}
        self.assertEqual(fit.choose_anchor(fit.rectangle(100, 40, 60, 40), footprint, 1.0)["cellBit"], 2)
        self.assertEqual(fit.choose_anchor(fit.rectangle(20, 40, 60, 40), footprint, 1.0)["cellBit"], 0)

    def test_preferred_point_is_respected_when_it_is_deep_enough(self):
        window = fit.rectangle(16, 30, 64, 60)
        plan = fit.plan_object_fit([(40, 50)], window, FOOTPRINT, inset=2.0, preferred=(48, 84))
        self.assertLess(math.dist(plan["center"], (48, 84)), math.dist((48, 56), (48, 84)))


class InscribedRectangleTests(unittest.TestCase):
    def test_rectangle_inside_a_hex_is_actually_inside(self):
        region = fit.clip_to_half_planes(fit.rectangle(8, -17, 32, 48), fit.half_planes(HEX, 1.0))
        rect = fit.inscribed_rectangle(region)
        self.assertIsNotNone(rect)
        planes = fit.half_planes(HEX, 1.0)
        for corner in fit.rectangle(*rect):
            self.assertGreaterEqual(fit.clearance(corner, planes), -1e-6)

    def test_it_keeps_the_full_width_a_uniform_scale_would_throw_away(self):
        """The zoo fences are the case this exists for."""
        window = fit.rectangle(8, -17, 32, 48)
        region = fit.clip_to_half_planes(window, fit.half_planes(HEX, 1.0))
        rect = fit.inscribed_rectangle(region)
        plan = fit.plan_object_fit([(8, -17), (40, 31)], window, FOOTPRINT, 1.0)
        self.assertGreater(rect[2], 32 * plan["factor"])

    def test_a_contained_window_is_returned_whole(self):
        rect = fit.inscribed_rectangle(fit.rectangle(36, 46, 24, 24))
        self.assertAlmostEqual(rect[2], 24, places=4)
        self.assertAlmostEqual(rect[3], 24, places=4)

    def test_degenerate_region_reports_nothing(self):
        self.assertIsNone(fit.inscribed_rectangle([(1, 1), (2, 2)]))

    def test_raster_search_agrees_with_the_exact_convex_solver(self):
        window = fit.rectangle(8, -17, 32, 48)
        region = fit.clip_to_half_planes(window, fit.half_planes(HEX, 1.0))
        exact = fit.inscribed_rectangle(region)
        raster = fit.largest_inside_rectangle(window, FOOTPRINT, 1.0, resolution=0.25)
        self.assertLessEqual(raster[2] * raster[3], exact[2] * exact[3] + 1e-6)
        self.assertGreater(raster[2] * raster[3], exact[2] * exact[3] * 0.85)

    def test_raster_search_spans_a_shared_seam(self):
        """A window straddling two hexes must not be cut down to one half."""
        left = [[0, 24], [48, 0], [96, 24], [96, 88], [48, 112], [0, 88]]
        right = [[96, 24], [144, 0], [192, 24], [192, 88], [144, 112], [96, 88]]
        footprint = {"cells": [{"bit": 0, "polygon": left}, {"bit": 2, "polygon": right}],
                     "boundaryEdges": [[left[0], left[1]], [left[1], left[2]], [left[4], left[3]],
                                       [left[5], left[4]], [left[0], left[5]],
                                       [right[0], right[1]], [right[1], right[2]],
                                       [right[2], right[3]], [right[3], right[4]],
                                       [right[4], right[5]]]}
        window = fit.rectangle(88, 40, 16, 32)
        raster = fit.largest_inside_rectangle(window, footprint, 1.0, resolution=0.25)
        per_hex = max(fit.inscribed_rectangle(region)[2] * fit.inscribed_rectangle(region)[3]
                      for _, region in fit.usable_region(window, footprint, 1.0))
        self.assertGreater(raster[2] * raster[3], per_hex)

    def test_every_sample_of_the_result_is_inside(self):
        window = fit.rectangle(0, -17, 40, 48)
        rect = fit.largest_inside_rectangle(window, FOOTPRINT, 1.0, resolution=0.25)
        planes = fit.footprint_cell_planes(FOOTPRINT, 1.0)
        x, y, w, h = rect
        for i in range(9):
            for j in range(9):
                self.assertTrue(fit.point_inside((x + w * i / 8, y + h * j / 8), planes))


class RealFootprintTests(unittest.TestCase):
    """The production hex authority, not a hand-written fixture."""

    @classmethod
    def setUpClass(cls):
        raw = subprocess.check_output(
            ["node", "scripts/lib/cage-authoring-geometry.mjs", "--hex-footprints"], cwd=ROOT)
        cls.fields = {row["fieldId"]: row for row in json.loads(raw)["fields"]}

    def test_every_hex_cell_is_convex_and_positively_wound(self):
        for field in self.fields.values():
            for cell in field["cells"]:
                polygon = fit.oriented(cell["polygon"])
                planes = fit.half_planes(polygon)
                for point in polygon:
                    self.assertGreaterEqual(fit.clearance(point, planes), -1e-6, field["fieldId"])

    def test_cells_tile_the_declared_outline_area(self):
        for field in self.fields.values():
            cells = sum(abs(fit.signed_area(cell["polygon"])) for cell in field["cells"])
            self.assertAlmostEqual(cells, abs(fit.signed_area(field["outline"])), places=3,
                                   msg=field["fieldId"])

    def test_zoo_windows_that_overhang_are_detected(self):
        """cm25 is the worst offender in the current audit; it must not read as clean."""
        field = self.fields["field_cm25_01"]
        spec = json.loads((ROOT / "docs/art/production/original-character-cage-r1/cage-base3d-v1"
                           "/fields/field_cm25_01/spec.json").read_text(encoding="utf-8"))
        overhanging = 0
        for record in spec["objects"]:
            x, y = record["placement"]
            px, py = record["pivot"]
            w, h = record["size"]
            if record["horizontalFlip"]:
                px = w - px
            if record["verticalFlip"]:
                py = h - py
            window = fit.rectangle(x - px, y - py, w, h)
            covered = sum(abs(fit.signed_area(region)) for _, region in
                          fit.usable_region(window, field))
            if covered < w * h - 1e-6:
                overhanging += 1
        self.assertGreater(overhanging, 0)


if __name__ == "__main__":
    unittest.main()
