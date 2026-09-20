import importlib.util
import json
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from lib.cage_object_animation_contract import extract,assert_unchanged,sha
loader=importlib.util.spec_from_file_location('meadow_check',ROOT/'scripts/check-cage-meadow.py')
check=importlib.util.module_from_spec(loader);loader.loader.exec_module(check)


class MeadowTests(unittest.TestCase):
    def test_unequal_sequences_retain_cells_and_ticks(self):
        c=extract(ROOT,'field_cm08_01')
        self.assertEqual([[f['rawDurationTicks'] for f in o['frames']] for o in c['objects']],[[46,46],[18,46,28]])
        self.assertEqual(check.select_cells(c,(1,2)),[1,0])
        self.assertIsNone(c['clockHz'])
        assert_unchanged(ROOT,check.read(check.OUT/'object-animation-contract.json'))

    def test_invalid_frame_selection(self):
        c=extract(ROOT,'field_cm08_01')
        for selection in ((0,3),(-1,0),(True,0),(0,),(0,0,0)):
            with self.assertRaises(ValueError):check.select_cells(c,selection)

    def test_outputs_and_repeated_cells(self):
        r=check.read(check.OUT/'review/report.json')
        self.assertEqual(r['status'],'PASS_OFFLINE_CELL_BANK_ONLY')
        self.assertEqual(len(r['outputs']),6)
        self.assertGreater(len(r['placements']),0)
        self.assertTrue(all(p['alphaHoles']==0 for p in r['placements']))
        self.assertFalse(r['runtimeEligible']);self.assertFalse(r['fullCageCompletion'])
        for o in r['outputs']:self.assertEqual(sha(check.OUT/'review'/o['file']),o['sha256'])
        rows=r['outputs'];self.assertEqual(rows[0]['sha256'],rows[2]['sha256']);self.assertEqual(rows[3]['sha256'],rows[5]['sha256'])

    def test_remaining_inventory_is_not_completion(self):
        r=check.read(check.OUT/'remaining-opm-inventory.json')
        self.assertEqual(len(r['fields']),14)
        self.assertTrue(all(x['clockHz'] is None and not x['runtimeEligible'] for x in r['fields']))
        pending={x['fieldId'] for x in r['fields'] if x['status']=='NEEDS_CONTRACT_EXTENSION'}
        self.assertEqual(pending,{'field_cm19_01','field_cm22_01'})


if __name__=='__main__':unittest.main()
