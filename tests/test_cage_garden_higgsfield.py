import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from lib.cage_object_animation_contract import extract,assert_unchanged,sha
OUT=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1/higgsfield-garden-v1'


class GardenHiggsfieldTests(unittest.TestCase):
    def test_numeric_contract(self):
        c=extract(ROOT)
        self.assertEqual(len(c['objects']),7)
        self.assertEqual([r['sequenceId'] for r in c['objects']],[0,0,0,1,1,1,1])
        self.assertIsNone(c['clockHz'])
        self.assertFalse(c['runtimeEligible'])
        for r in c['objects']:
            self.assertEqual(r['size'],[16,16]);self.assertEqual(r['pivot'],[15,5])
            self.assertEqual([f['rawDurationTicks'] for f in r['frames']],[46,46])
            self.assertTrue(all(f['durationMs'] is None for f in r['frames']))

    def test_contract_rejects_clock_and_pivot_edits(self):
        c=extract(ROOT)
        for change in ('clock','pivot','ticks'):
            broken=copy.deepcopy(c)
            if change=='clock':broken['clockHz']=60
            elif change=='pivot':broken['objects'][0]['pivot']=[8,8]
            else:broken['objects'][0]['frames'][0]['rawDurationTicks']=45
            with self.assertRaisesRegex(ValueError,'CONTRACT_DRIFT'):assert_unchanged(ROOT,broken)

    def test_source_locks_and_saved_contract(self):
        saved=json.loads((OUT/'object-animation-contract.json').read_text())
        assert_unchanged(ROOT,saved)
        for path,digest in saved['sourceLocks'].items():self.assertEqual(sha(ROOT/path),digest)

    def test_both_export_states_validate(self):
        loader=importlib.util.spec_from_file_location('garden_check',ROOT/'scripts/check-cage-garden-higgsfield.py')
        mod=importlib.util.module_from_spec(loader);loader.loader.exec_module(mod)
        for invalid in (-1,2,True):
            with self.assertRaisesRegex(ValueError,'UNKNOWN_MANUAL_STATE'):mod.load_state(invalid)
        for state in (0,1):
            spec,core,objects=mod.load_state(state)
            self.assertEqual(len(objects),7);core.close()
            for obj in objects:obj['image'].close()

    def test_review_is_not_completion(self):
        r=json.loads((OUT/'review/report.json').read_text())
        self.assertEqual(r['status'],'PASS_OFFLINE_STATES_ONLY')
        self.assertEqual(r['objectsWithDistinctStates'],7)
        self.assertEqual(len(r['outputs']),4)
        self.assertGreater(len(r['scenarios']),0)
        self.assertTrue(all(x['alphaHoles']==0 for x in r['scenarios']))
        self.assertFalse(r['fullCageCompletion']);self.assertFalse(r['runtimeEligible'])
        for row in r['outputs']:self.assertEqual(sha(OUT/'review'/row['file']),row['sha256'])

    def test_actual_mesh_preserves_single_hex(self):
        base=OUT/'seam-v3/fields/field_cm32_01'
        expected={(0,24),(48,0),(96,24),(96,88),(48,112),(0,88)}
        for folder in (base,base/'animation/01'):
            r=json.loads((folder/'render-report.json').read_text())
            self.assertEqual({tuple(v) for v in r['hexFloorMeshNative']},expected)
            self.assertEqual(r['camera']['elevationDegrees'],52)
            self.assertLess(r['maxProjectionErrorPixels'],0.01)
            self.assertFalse(r['sourceRastersLoaded'])
            self.assertFalse(r['runtimeEligible'])


if __name__=='__main__':unittest.main()
