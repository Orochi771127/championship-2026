"""Delivery invariants for the authored native bank; no visual approval inference."""
import hashlib
import json
import unittest
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'docs/art/production/original-character-cage-r1/m001-pipeline-v1'
OUT=WORK/'native-r05/compiled'
def read(path):return json.loads(path.read_text(encoding='utf-8'))

class NativeBankTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bank=read(OUT/'bank.json')
        cls.plan=read(WORK/'generated/preflight.json')
        cls.contract=read(ROOT/'docs/art/production/characters/appearance-refresh-v1/generated/entities/m001_zurumon/motion-contract.json')

    def test_native_rgba_and_palette(self):
        palette={tuple(bytes.fromhex(c[1:]))+(255,) for c in self.bank['palette'][1:]}
        for key,record in self.bank['cells'].items():
            image=Image.open(OUT/record['image'])
            self.assertEqual(image.size,(64,64));self.assertEqual(image.mode,'RGBA')
            self.assertEqual(set(image.getchannel('A').get_flattened_data()),{0,255})
            colors={p for p in image.get_flattened_data() if p[3]}
            self.assertTrue(colors <= ({(255,255,255,255)} if key=='main/cell_064' else palette),key)

    def test_aliases_are_proven_and_bit_identical(self):
        for key,record in self.bank['cells'].items():
            canonical=self.plan['slots'][key]['canonical']
            self.assertEqual(canonical,record['canonical'])
            self.assertEqual(record['sha256'],self.bank['cells'][canonical]['sha256'])
            self.assertEqual(hashlib.sha256((OUT/record['image']).read_bytes()).hexdigest(),record['sha256'])

    def test_no_missing_pose_fallback_or_contract_changes(self):
        self.assertEqual(len(self.bank['sequences']),53)
        available=0
        for entry in self.bank['sequences']:
            expected=next(s for s in self.contract['sides'][entry['side']]['sequences'] if s['id']==entry['sequence']['id'])
            self.assertEqual(entry['sequence'],expected)
            missing=[f"{entry['side']}/cell_{f['cell']:03d}" for f in expected['frames'] if f"{entry['side']}/cell_{f['cell']:03d}" not in self.bank['cells']]
            self.assertEqual(entry['missing'],missing)
            self.assertEqual(entry['available'],not missing)
            available+=not missing
        self.assertEqual(available,12)
        self.assertEqual(self.bank['deliveredSlots'],20)
        self.assertFalse(self.bank['runtimeEligible'])

    def test_expression_and_geometry_survive_without_resampling(self):
        cells=self.bank['cells']
        for key in ('main/cell_011','main/cell_012'):
            source=self.plan['slots'][key]['visibleBounds']
            bounds=[v+self.bank['origin'][i%2] for i,v in enumerate(source)]
            self.assertEqual(cells[key]['alphaBounds'],bounds)
        closed=Image.open(OUT/cells['main/cell_011']['image'])
        opened=Image.open(OUT/cells['main/cell_012']['image'])
        coral=tuple(bytes.fromhex('B84C39'))+(255,)
        self.assertNotIn(coral,list(closed.get_flattened_data()))
        self.assertIn(coral,list(opened.get_flattened_data()))
        self.assertNotEqual(cells['main/cell_000']['sha256'],cells['main/cell_002']['sha256'])

if __name__=='__main__':unittest.main()
