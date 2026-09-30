"""Reject costly production requests when independent source records disagree."""
import copy
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('table_preflight', Path(__file__).resolve().parents[1]/'scripts/prepare-character-batch-preflight.py')
P = importlib.util.module_from_spec(spec); spec.loader.exec_module(P)


class SourceTableTests(unittest.TestCase):
    def setUp(self):
        cell = {'cell':'0', 'blank':'False', 'boundsFromOrigin':'-1 -2 2 1', 'nativeWidth':'3', 'nativeHeight':'3', 'csvGeometryMatch':'True', 'reuseVerified':'True'}
        seq = {'sequence':'0', 'frames':'1', 'cells':'0', 'ticks':'31', 'mode':'2', 'loopStart':'0', 'csvRawMatch':'True', 'refsValid':'True'}
        self.profile = {'entityId':'test', 'sourceCellCounts':{'main':1, 'sub':1},
            'cells':[{**cell,'side':s} for s in ('main','sub')],
            'sequences':[{**seq,'side':s} for s in ('main','sub')],
            'subAliases':[{'subCell':'0','matchedMainCell':'0','classification':'EXACT_PIXELS_AND_ORIGIN','offsetDx':'0','offsetDy':'0'}]}
        slot = {'blank':False,'visibleBounds':[-1,-2,2,1],'canonical':'main/cell_000','translation':[0,0]}
        sequence = {'id':0,'frames':[{'cell':0,'ticks':31}], 'playbackMode':2,'loopStartFrame':0}
        self.inventory = {'entityId':'test','slots':{s+'/cell_000':copy.deepcopy(slot) for s in ('main','sub')},
                          'sequences':{s:{'sequences':[copy.deepcopy(sequence)]} for s in ('main','sub')}}

    def test_source_match_never_means_art_acceptance(self):
        result = P.validate_profile_inventory(self.profile,self.inventory)
        self.assertEqual(result['sequencesChecked'],2)
        self.assertFalse(result['artAccepted'])

    def test_single_tick_drift_is_blocked(self):
        self.inventory['sequences']['sub']['sequences'][0]['frames'][0]['ticks']=30
        with self.assertRaisesRegex(ValueError,'TIMING_MISMATCH'):
            P.validate_profile_inventory(self.profile,self.inventory)

    def test_origin_relative_bounds_drift_is_blocked(self):
        self.inventory['slots']['main/cell_000']['visibleBounds']=[0,-2,3,1]
        with self.assertRaisesRegex(ValueError,'BOUNDS_MISMATCH'):
            P.validate_profile_inventory(self.profile,self.inventory)

    def test_alias_offset_drift_is_blocked(self):
        self.inventory['slots']['sub/cell_000']['translation']=[1,0]
        with self.assertRaisesRegex(ValueError,'ALIAS_OFFSET'):
            P.validate_profile_inventory(self.profile,self.inventory)

    def test_unreviewed_palette_reuse_is_blocked(self):
        self.profile['subAliases'][0]['classification']='PALETTE_MAP'
        with self.assertRaisesRegex(ValueError,'SUB_EXCEPTION'):
            P.validate_profile_inventory(self.profile,self.inventory)

    def test_dropped_sub_sequence_is_blocked(self):
        self.profile['sequences'].pop()
        with self.assertRaisesRegex(ValueError,'SEQUENCE_COVERAGE'):
            P.validate_profile_inventory(self.profile,self.inventory)


if __name__ == '__main__':
    unittest.main()
