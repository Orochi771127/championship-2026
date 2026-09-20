import json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from lib.cage_object_animation_contract import extract,assert_unchanged,sha
OUT=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1/opm-industrial-v1'

class IndustrialBatchTests(unittest.TestCase):
    def test_numeric_contracts(self):
        for fid,expected in {'field_cm15_01':(23,16),'field_cm23_01':(6,12)}.items():
            contract=extract(ROOT,fid);self.assertEqual((len(contract['objects']),len({f['cellId'] for o in contract['objects'] for f in o['frames']})),expected)
            self.assertIsNone(contract['clockHz']);self.assertFalse(contract['runtimeEligible'])
            assert_unchanged(ROOT,json.loads((OUT/'fields'/fid/'object-animation-contract.json').read_text()))
    def test_factory_and_gas_sequences_preserved(self):
        factory={o['sequenceId']:o for o in extract(ROOT,'field_cm15_01')['objects']}
        self.assertEqual([f['cellId'] for f in factory[0]['frames']],[0,1,2,1])
        self.assertEqual([f['cellId'] for f in factory[1]['frames']],[3,4,5,0,5,4,3])
        self.assertEqual([f['cellId'] for f in factory[2]['frames']],[6,7,8,9])
        self.assertEqual([f['cellId'] for f in factory[5]['frames']],[12,13,14,15])
        gas={o['sequenceId']:o for o in extract(ROOT,'field_cm23_01')['objects']}[4]
        self.assertEqual([f['cellId'] for f in gas['frames']],list(range(4,12)))
        self.assertEqual([f['rawDurationTicks'] for f in gas['frames']],[9,9,10,12,14,15,18,125])
    def test_review_is_structural_not_runtime_completion(self):
        report=json.loads((OUT/'review/report.json').read_text());self.assertEqual(report['status'],'PASS_OFFLINE_CELL_BANK_ONLY')
        self.assertFalse(report['runtimeEligible']);self.assertFalse(report['fullCageCompletion']);self.assertFalse(report['humanApproved'])
        for fid,cells in {'field_cm15_01':16,'field_cm23_01':12}.items():
            row=report['fields'][fid];self.assertEqual(row['cells'],cells);self.assertGreater(row['placementChecks'],0)
            self.assertEqual(sha(OUT/'review'/row['contactSheet']),row['contactSheetSha256'])
            for output in row['selections']:
                self.assertTrue(output['ground']['pass']);self.assertEqual(sha(OUT/'review'/output['file']),output['sha256'])

if __name__=='__main__':unittest.main()
