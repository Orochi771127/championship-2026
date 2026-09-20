import json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from lib.cage_object_animation_contract import extract,assert_unchanged,sha
OUT=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1/opm-remaining-fixed-v1'
EXPECTED={'field_cm13_01':(8,10),'field_cm14_01':(13,13),'field_cm18_01':(16,8),
          'field_cm24_01':(5,6),'field_cm25_01':(13,12),'field_cm26_01':(11,6)}

class RemainingFixedBatchTests(unittest.TestCase):
    def test_numeric_contracts(self):
        for fid,expected in EXPECTED.items():
            contract=extract(ROOT,fid);actual=(len(contract['objects']),len({f['cellId'] for o in contract['objects'] for f in o['frames']}))
            self.assertEqual(actual,expected);self.assertIsNone(contract['clockHz']);self.assertFalse(contract['runtimeEligible'])
            assert_unchanged(ROOT,json.loads((OUT/'fields'/fid/'object-animation-contract.json').read_text()))
    def test_representative_sequences_preserved(self):
        sequences={fid:{o['sequenceId']:o for o in extract(ROOT,fid)['objects']} for fid in EXPECTED}
        self.assertEqual([f['cellId'] for f in sequences['field_cm13_01'][2]['frames']],[2,3,4,5])
        self.assertEqual([f['cellId'] for f in sequences['field_cm14_01'][4]['frames']],[4,5,6,5])
        self.assertEqual([f['cellId'] for f in sequences['field_cm18_01'][9]['frames']],[2,3,2])
        self.assertEqual([f['cellId'] for f in sequences['field_cm24_01'][0]['frames']],[0,1,2,3])
        self.assertEqual([f['cellId'] for f in sequences['field_cm25_01'][16]['frames']],[16,17,18,17])
        self.assertEqual([f['cellId'] for f in sequences['field_cm26_01'][4]['frames']],[4,5])
    def test_review_is_structural_only(self):
        report=json.loads((OUT/'review/report.json').read_text());self.assertEqual(report['status'],'PASS_OFFLINE_CELL_BANK_ONLY')
        self.assertFalse(report['runtimeEligible']);self.assertFalse(report['fullCageCompletion']);self.assertFalse(report['humanApproved'])
        self.assertEqual(set(report['fields']),set(EXPECTED))
        for fid,(_,cells) in EXPECTED.items():
            row=report['fields'][fid];self.assertEqual(row['cells'],cells);self.assertGreater(row['placementChecks'],0)
            self.assertEqual(sha(OUT/'review'/row['contactSheet']),row['contactSheetSha256'])
            for output in row['selections']:
                self.assertTrue(output['ground']['pass']);self.assertEqual(sha(OUT/'review'/output['file']),output['sha256'])
if __name__=='__main__':unittest.main()
