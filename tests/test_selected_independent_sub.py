"""A unique Sub pose must never become an unverified Main alias."""
import copy,importlib.util,json,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('source_table',ROOT/'scripts/prepare-character-batch-preflight.py');T=importlib.util.module_from_spec(s);s.loader.exec_module(T)
class IndependentSubTests(unittest.TestCase):
 def setUp(self):
  self.profile=T.read(ROOT.parent/'自創腳色/批次開工準備_20260926/profiles/m206_gazimon.json')
  self.inv=T.read(T.PACK/'donor-review-v1/m206_gazimon/inventory.json')
  self.proof={k:self.inv['slots'][k]['sourceRgbaSha256'] for k in ['sub/cell_006','sub/cell_007']}
 def test_default_rejects_unreviewed_unique_pose(self):
  with self.assertRaisesRegex(ValueError,'SUB_EXCEPTION'):T.validate_profile_inventory(self.profile,self.inv)
 def test_reviewed_unique_poses_preserve_self_canonical(self):
  r=T.validate_profile_inventory(self.profile,self.inv,self.proof)
  self.assertEqual(r['independentSubCellsChecked'],list(self.proof));self.assertFalse(r['artAccepted'])
 def test_rejects_hash_drift(self):
  self.proof['sub/cell_006']='wrong'
  with self.assertRaisesRegex(ValueError,'INDEPENDENT_SUB_HASH'):T.validate_profile_inventory(self.profile,self.inv,self.proof)
 def test_rejects_forced_main_alias(self):
  self.inv['slots']['sub/cell_006']['canonical']='main/cell_019'
  with self.assertRaisesRegex(ValueError,'INDEPENDENT_SUB_CANONICAL'):T.validate_profile_inventory(self.profile,self.inv,self.proof)
 def test_rejects_unused_exception(self):
  self.proof['sub/cell_005']='unused'
  with self.assertRaisesRegex(ValueError,'UNUSED_INDEPENDENT_SUB_REVIEW'):T.validate_profile_inventory(self.profile,self.inv,self.proof)
if __name__=='__main__':unittest.main()
