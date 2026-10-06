import json
import subprocess
import sys
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

from lib import cage_footprint_fit as fit
from lib import cage_opus_containment as containment


def footprints():
    raw = subprocess.check_output(['node', 'scripts/lib/cage-authoring-geometry.mjs', '--hex-footprints'], cwd=ROOT)
    return {row['fieldId']: row for row in json.loads(raw)['fields']}


class UnionDepthTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.factory = footprints()['field_cm15_01']

    def test_a_shared_seam_is_deep_inside_not_an_edge(self):
        """The factory belt crosses the seam between two hexes of one field."""
        depth = containment._union_depth(np.array([[72.0, 100.0]]), self.factory)
        self.assertGreater(depth[0], 20)

    def test_outer_edge_distance_is_signed(self):
        depth = containment._union_depth(np.array([[1.0, 60.0], [-2.0, 60.0]]), self.factory)
        self.assertAlmostEqual(depth[0], 1.0, places=6)
        self.assertAlmostEqual(depth[1], -2.0, places=6)

    def test_outside_is_the_worst_point(self):
        points = np.array([[72.0, 100.0], [-3.0, 60.0]])
        self.assertAlmostEqual(containment._union_outside(points, self.factory), 3.0, places=6)


class WindowTests(unittest.TestCase):
    def test_touching_the_window_edge_is_allowed_and_crossing_is_not(self):
        source = (64, 84, 16, 32)
        touching = np.array([[64.0, 90.0], [80.0, 100.0]])
        crossing = np.array([[63.5, 90.0]])
        self.assertLessEqual(containment._window_outside(touching, source), containment.WINDOW_TOUCH_TOLERANCE)
        self.assertGreater(containment._window_outside(crossing, source), containment.WINDOW_TOUCH_TOLERANCE)


class PlacementTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.lab = footprints()['field_cm06_01']

    def _solve(self, points, source, anchor):
        best = (0.0, None)
        for container in containment.containers(self.lab, source, 1.0):
            support = containment._support(np.asarray(points, dtype=float), container['planes'], anchor)
            q, factor = containment.solve_container(container, support, anchor)
            if q is not None and factor > best[0]:
                best = (factor, q, container)
        return best

    def test_a_prop_that_fits_where_it_was_designed_is_not_moved(self):
        source = (113, 89, 32, 32)
        anchor = (129.0, 116.0)
        points = [(124.0, 112.0), (134.0, 120.0), (129.0, 109.0)]
        factor, q, _ = self._solve(points, source, anchor)
        self.assertEqual(factor, 1.0)
        self.assertEqual(tuple(q), anchor)

    def test_translation_keeps_a_prop_at_full_size_where_scaling_alone_would_shrink_it(self):
        """The cart window hugs the field's right corner; moving beats shrinking."""
        source = (306, 82, 32, 32)
        anchor = (322.0, 86.0)
        points = [(316.0, 82.5), (328.0, 92.0), (322.0, 80.0)]
        factor, q, container = self._solve(points, source, anchor)
        fixed_center = fit.plan_object_fit(points, fit.rectangle(*source), self.lab, 1.0, anchor)['factor']
        self.assertGreater(factor, fixed_center)
        moved = [(q[0] + factor * (x - anchor[0]), q[1] + factor * (y - anchor[1])) for x, y in points]
        for point in moved:
            self.assertGreaterEqual(fit.clearance(point, container['planes']), -1e-6)

    def test_a_window_with_no_interior_is_reported_not_hidden(self):
        decision = containment.authoring_window('field_cm06_01', self.lab, {
            'order': 999, 'placement': [400, 400], 'pivot': [0, 0], 'size': [8, 8],
            'horizontalFlip': False, 'verticalFlip': False})
        self.assertEqual(decision['conflict'], 'NO_LEGIBLE_RECTANGLE_INSIDE_FIELD')


class PhaseTests(unittest.TestCase):
    def test_revisited_cells_map_to_one_pose(self):
        obj = {'frames': [{'cellId': 0}, {'cellId': 1}, {'cellId': 2}, {'cellId': 1}]}
        self.assertEqual(containment.phase_for(obj, 1), (1, 3))
        self.assertEqual(containment.phase_for(obj, 9), (0, 3))


if __name__ == '__main__':
    unittest.main()
