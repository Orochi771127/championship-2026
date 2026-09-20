import importlib.util
import json
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from lib.cage_object_animation_contract import extract,assert_unchanged,sha
OUT=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1/opm-care-lab-v1'


class CareBatchTests(unittest.TestCase):
    def test_numeric_contracts(self):
        expected={'field_cm17_01':(6,6),'field_cm06_01':(15,13)}
        for fid,(objects,cells) in expected.items():
            c=extract(ROOT,fid);self.assertEqual(len(c['objects']),objects)
            self.assertEqual(len({f['cellId'] for o in c['objects'] for f in o['frames']}),cells)
            self.assertIsNone(c['clockHz']);self.assertFalse(c['runtimeEligible'])
            assert_unchanged(ROOT,json.loads((OUT/'fields'/fid/'object-animation-contract.json').read_text()))

    def test_lab_five_frame_sequences_preserved(self):
        c=extract(ROOT,'field_cm06_01')
        seq={o['sequenceId']:o for o in c['objects']}
        self.assertEqual([f['cellId'] for f in seq[6]['frames']],[8,9,10,11,12])
        self.assertEqual([f['cellId'] for f in seq[7]['frames']],[12,8,9,10,11])
        self.assertEqual([f['rawDurationTicks'] for f in seq[6]['frames']],[12,12,12,12,50])
        self.assertEqual([f['rawDurationTicks'] for f in seq[7]['frames']],[37,12,12,12,12])

    def test_review_is_structural_not_runtime_completion(self):
        r=json.loads((OUT/'review/report.json').read_text())
        self.assertEqual(r['status'],'PASS_OFFLINE_CELL_BANK_ONLY')
        self.assertFalse(r['runtimeEligible']);self.assertFalse(r['fullCageCompletion']);self.assertFalse(r['humanApproved'])
        self.assertEqual(set(r['fields']),{'field_cm17_01','field_cm06_01'})
        self.assertEqual(r['fields']['field_cm17_01']['cells'],6)
        self.assertEqual(r['fields']['field_cm06_01']['cells'],13)
        for row in r['fields'].values():
            self.assertGreater(row['placementChecks'],0)
            self.assertEqual(sha(OUT/'review'/row['contactSheet']),row['contactSheetSha256'])
            for output in row['selections']:
                self.assertTrue(output['ground']['pass'])
                self.assertEqual(sha(OUT/'review'/output['file']),output['sha256'])


if __name__=='__main__':unittest.main()
