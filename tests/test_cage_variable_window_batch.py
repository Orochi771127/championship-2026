import json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from lib.cage_object_animation_contract import extract_variable,assert_variable_unchanged,sha
OUT=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1/opm-variable-window-v1'

class VariableWindowBatchTests(unittest.TestCase):
    def test_contract_preserves_per_frame_geometry(self):
        hot=extract_variable(ROOT,'field_cm19_01');power=extract_variable(ROOT,'field_cm22_01')
        self.assertEqual((hot['schemaVersion'],power['schemaVersion']),(2,2));self.assertTrue(hot['perFrameGeometry']);self.assertTrue(power['perFrameGeometry'])
        hot_seq={o['sequenceId']:o for o in hot['objects']}[11]
        self.assertEqual([(f['cellId'],f['size'],f['pivot']) for f in hot_seq['frames']],[(12,[224,96],[104,94]),(13,[8,8],[3,6])])
        power_seq={o['sequenceId']:o for o in power['objects']}[5]
        self.assertEqual([(f['cellId'],f['size'],f['pivot']) for f in power_seq['frames']],
                         [(5,[48,96],[31,91]),(6,[48,96],[31,91]),(7,[48,96],[31,91]),(8,[16,16],[7,11])])
        for contract in (hot,power):self.assertIsNone(contract['clockHz']);self.assertFalse(contract['runtimeEligible'])
    def test_written_contracts_are_current(self):
        for fid in ('field_cm19_01','field_cm22_01'):
            assert_variable_unchanged(ROOT,json.loads((OUT/'fields'/fid/'object-animation-contract.json').read_text()))
    def test_review_is_structural_only(self):
        report=json.loads((OUT/'review/report.json').read_text());self.assertEqual(report['status'],'PASS_OFFLINE_CELL_BANK_ONLY')
        self.assertFalse(report['runtimeEligible']);self.assertFalse(report['fullCageCompletion']);self.assertFalse(report['humanApproved'])
        for fid,cells in {'field_cm19_01':14,'field_cm22_01':6}.items():
            row=report['fields'][fid];self.assertEqual(row['cells'],cells);self.assertGreater(row['placementChecks'],0)
            self.assertEqual(sha(OUT/'review'/row['contactSheet']),row['contactSheetSha256'])
            for output in row['selections']:
                self.assertTrue(output['ground']['pass']);self.assertEqual(sha(OUT/'review'/output['file']),output['sha256'])
if __name__=='__main__':unittest.main()
