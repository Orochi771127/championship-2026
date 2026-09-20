import hashlib
import json
import unittest
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'docs/art/production/original-character-cage-r1/m001-pipeline-v1'
OUT=WORK/'full-sheet-r01/compiled-aligned'
def read(p):return json.loads(p.read_text(encoding='utf-8'))

class FullSheetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bank=read(OUT/'bank.json');cls.plan=read(WORK/'generated/preflight.json')

    def test_complete_candidate_coverage_without_art_approval(self):
        self.assertEqual(len(self.bank['cells']),83)
        self.assertEqual(len({v['canonical'] for v in self.bank['cells'].values()}),53)
        self.assertEqual(len(self.bank['sequences']),53)
        self.assertFalse(self.bank['runtimeEligible'])
        self.assertEqual(self.bank['artReview'],'PENDING')
        self.assertEqual(self.bank['unexpectedOccupiedPanels'],[])

    def test_exact_source_sequences_and_main_sub_alias_translations(self):
        contract=read(ROOT/'docs/art/production/characters/appearance-refresh-v1/generated/entities/m001_zurumon/motion-contract.json')
        for entry in self.bank['sequences']:
            self.assertEqual(entry['sequence'],next(s for s in contract['sides'][entry['side']]['sequences'] if s['id']==entry['sequence']['id']))
        for key,record in self.bank['cells'].items():
            slot=self.plan['slots'][key]
            self.assertEqual(record['canonical'],slot['canonical'])
            self.assertEqual(record['translation'],slot['sourceTranslationFromCanonical'])
            base=Image.open(OUT/self.bank['cells'][record['canonical']]['image']).convert('RGBA')
            expected=Image.new('RGBA',(64,64));expected.alpha_composite(base,tuple(record['translation']))
            self.assertEqual(Image.open(OUT/record['image']).tobytes(),expected.tobytes())
        self.assertEqual(self.bank['cells']['main/cell_063']['translation'],[-6,4])

    def test_transparent_native_cells_and_deterministic_states(self):
        for key,record in self.bank['cells'].items():
            path=OUT/record['image'];im=Image.open(path)
            self.assertEqual(im.size,(64,64));self.assertEqual(im.mode,'RGBA')
            self.assertEqual(set(im.getchannel('A').get_flattened_data()),{0,255})
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),record['sha256'])
        for key in ('main/cell_047','main/cell_048'):
            im=Image.open(OUT/self.bank['cells'][key]['image'])
            self.assertEqual({p[:3] for p in im.get_flattened_data() if p[3]},{(0,0,0)})
            base=Image.open(OUT/('base-candidates/'+key.replace('/','-')+'.png'))
            self.assertEqual(im.getchannel('A').tobytes(),base.getchannel('A').tobytes())
        gray=Image.open(OUT/self.bank['cells']['main/cell_061']['image'])
        self.assertTrue(all(p[0]==p[1]==p[2] for p in gray.get_flattened_data() if p[3]))

    def test_existing_masters_retained_and_atlas_cells_exact(self):
        native=read(WORK/'native-r05/compiled/bank.json')
        for key,record in native['cells'].items():
            self.assertEqual(record['sha256'],self.bank['cells'][key]['sha256'])
        for side,count in [('main',65),('sub',18)]:
            atlas=Image.open(OUT/f'{side}-atlas.png')
            for n in range(count):
                x,y=n%8*64,n//8*64
                cell=Image.open(OUT/self.bank['cells'][f'{side}/cell_{n:03d}']['image'])
                self.assertEqual(atlas.crop((x,y,x+64,y+64)).tobytes(),cell.tobytes())

if __name__=='__main__':unittest.main()
