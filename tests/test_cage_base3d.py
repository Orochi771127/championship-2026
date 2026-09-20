"""Numeric-authority and workpack tests, not visual acceptance tests."""
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1'
spec=importlib.util.spec_from_file_location('prepare_cage_base3d',ROOT/'scripts/prepare-cage-base3d.py')
prep=importlib.util.module_from_spec(spec)
spec.loader.exec_module(prep)


class BoundaryTests(unittest.TestCase):
    def test_rectangle(self):
        self.assertEqual(prep.simplify(prep.boundary([1]*6,3,2),.01),[[0,0],[24,0],[24,16],[0,16]])

    def test_corner_touch_does_not_drop_directed_edges(self):
        result=prep.boundary([1,0,0,1],2,2)
        self.assertEqual(len(result),4)
        area=abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(result,result[1:]+result[:1])))/2
        self.assertEqual(area,64)

    def test_l_shape_retains_concavity(self):
        result=prep.simplify(prep.boundary([1,1,1,0],2,2),.01)
        self.assertIn([8,8],result)
        self.assertEqual(len(result),6)

    def test_hole_returns_outer_envelope_only(self):
        result=prep.simplify(prep.boundary([1,1,1,1,0,1,1,1,1],3,3),.01)
        self.assertEqual(len(result),4)
        self.assertIn([24,24],result)

    def test_empty_rejected(self):
        with self.assertRaisesRegex(ValueError,'Empty'):
            prep.boundary([0]*4,2,2)


class CatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog=json.loads((OUT/'catalog.json').read_text(encoding='utf8'))

    def test_complete_unique_catalog(self):
        fields=self.catalog['fields']
        self.assertEqual(len(fields),37)
        self.assertEqual(len({f['definitionIndex'] for f in fields}),37)
        self.assertEqual(len({f['id'] for f in fields}),37)
        self.assertEqual(sum(len(f['frames']) for f in fields),41)
        self.assertTrue(set(self.catalog['excludedUnused']).isdisjoint(f['id'] for f in fields))

    def test_numeric_locks_unchanged(self):
        locks=json.loads((OUT/'source-locks.json').read_text(encoding='utf8'))
        self.assertGreater(len(locks),90)
        for path,digest in locks.items():
            with self.subTest(path=path):
                self.assertEqual(hashlib.sha256((ROOT/path).read_bytes()).hexdigest(),digest)
                self.assertTrue(path.endswith('.json'))

    def test_no_shipping_promotion(self):
        self.assertFalse(self.catalog['runtimeEligible'])
        self.assertFalse(self.catalog['shippingReady'])
        for field in self.catalog['fields']:
            self.assertFalse(field['runtimeEligible'])
            self.assertEqual(field['status'],'NUMERIC_SPEC_COMPLETE_ART_NOT_ACCEPTED')

    def test_walkability_is_exact_copy_of_existing_authority(self):
        ground=json.loads((ROOT/'src/data/championship/catalogs/raising-ground.r1.json').read_text(encoding='utf8'))
        source={f['definitionIndex']:f for f in ground['fields']}
        for field in self.catalog['fields']:
            self.assertEqual(field['ground'],source[field['definitionIndex']])

    def test_sizes_and_polygons_are_bounded(self):
        for field in self.catalog['fields']:
            w,h=field['nativeSize']
            self.assertEqual(field['worldSize'],[w*4,h*4])
            self.assertGreaterEqual(len(field['outlineNative']),3)
            for x,y in field['outlineNative']:
                self.assertTrue(0<=x<=w and 0<=y<=h,field['id'])
            self.assertIn('APPROXIMATION',field['outlineAuthority'])

    def test_one_field_per_work_order(self):
        self.assertEqual(self.catalog['productionUnit'],'ONE_FIELD_ID_PER_ASSET')
        for field in self.catalog['fields']:
            contract=field['outputContract']
            self.assertEqual(contract['fieldIds'],[field['id']])
            self.assertEqual(contract['neighborFieldIds'],[])
            self.assertEqual(contract['nativeOrigin'],[0,0])
            self.assertEqual(contract['canvasPx'],field['worldSize'])
            self.assertFalse(contract['sourceCropApplied'])
            spec=json.loads((OUT/contract['directory']/'spec.json').read_text(encoding='utf8'))
            self.assertEqual(spec,field)

    def test_each_work_order_links_its_own_pack_map(self):
        for field in self.catalog['fields']:
            ref=field['referenceSpec']
            self.assertEqual(ref['fieldId'],field['id'])
            self.assertIn(field['id'],ref['researchFrames'])
            self.assertIn(field['id'],ref['maskImage'])
            self.assertTrue(Path(ref['maskImage']).exists())
            self.assertTrue(Path(ref['researchFrames']).is_dir())
            self.assertEqual(ref['frameCount'],len(field['frames']))


class IndependentRenderTests(unittest.TestCase):
    def test_each_render_contains_only_its_field(self):
        for fid,size in [('field_cm28_01',[960,800]),('field_cm02_01',[768,800])]:
            report=json.loads((OUT/'fields'/fid/'render-report.json').read_text(encoding='utf8'))
            self.assertEqual(report['fields'],[fid])
            self.assertEqual(report['geometryOwnerIds'],[fid])
            self.assertEqual(report['neighborFieldIds'],[])
            self.assertEqual(report['renderSize'],size)
            self.assertFalse(report['sourceCropApplied'])
            self.assertLess(report['maxProjectionErrorPixels'],.02)
            self.assertFalse(report['runtimeEligible'])

    def test_independent_object_counts_and_anchors_match_metadata(self):
        for fid in ['field_cm28_01','field_cm02_01']:
            directory=OUT/'fields'/fid
            report=json.loads((directory/'render-report.json').read_text(encoding='utf8'))
            field=json.loads((directory/'spec.json').read_text(encoding='utf8'))
            self.assertEqual(len(report['objectAnchors']),len(field['objects']))
            for actual,source in zip(report['objectAnchors'],field['objects']):
                self.assertEqual(actual['anchorNative'],source['placement'])
                self.assertEqual(actual['sourceOrdinal'],source['order'])
                self.assertEqual(actual['sequenceId'],source['sequenceId'])


if __name__=='__main__':
    unittest.main()
