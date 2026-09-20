import hashlib
import json
import unittest
from pathlib import Path

from PIL import Image


ROOT=Path(__file__).resolve().parents[1]
PACK=ROOT/'docs/art/production/characters/appearance-refresh-v1'
JOBS=PACK/'sheet-jobs-v1'
GENERATED=PACK/'generated/entities'
GOLD={(89,65,29,255),(193,139,38,255),(250,208,101,255)}


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def sha(data):
    return hashlib.sha256(data).hexdigest()


class CharacterBatchJobTests(unittest.TestCase):
    CASES={
        'm003_nyokimon':{'candidate':'candidate-hf-batch-r03','slots':82,'origin':[23,37],
                         'bound':range(26,43),'normal':[13,14,22,*range(48,60)]},
        'm004_bubbmon':{'candidate':'candidate-hf-batch-r03','slots':83,'origin':[24,37],
                       'bound':range(27,44),'normal':[9,10,13,14,23,25,*range(49,61),62,63]},
        'm005_pitchmon':{'candidate':'candidate-hf-batch-r06','slots':83,'origin':[31,38],
                         'bound':range(27,44),'normal':[*range(0,27),*range(49,61),62,63]},
        'm006_punimon':{'candidate':'candidate-hf-batch-r06','slots':83,'origin':[24,38],
                        'bound':range(27,44),'normal':[*range(0,27),*range(49,61),62,63]},
        'm007_botamon':{'candidate':'candidate-hf-batch-r06','slots':83,'origin':[24,42],
                        'bound':range(27,44),'normal':[*range(0,27),*range(49,61),62,63]},
        'm008_poyomon':{'candidate':'candidate-hf-batch-r03','slots':83,'origin':[31,38],
                        'bound':range(27,44),'normal':[*range(0,27),*range(49,61),62,63]},
        'm009_mokumon':{'candidate':'candidate-hf-batch-r06','slots':80,'origin':[28,38],
                        'bound':range(26,43),'normal':[*range(0,26),*range(46,62)]},
        'm010_yukimibotamon':{'candidate':'candidate-hf-batch-r02','slots':83,'origin':[24,42],
                              'bound':range(27,44),'normal':[*range(0,27),45,*range(49,61),62,63]},
        'm011_yuramon':{'candidate':'candidate-hf-batch-r02','slots':82,'origin':[23,42],
                        'bound':range(26,43),'normal':[*range(0,26),*range(43,64)]},
        'm012_petimon':{'candidate':'candidate-hf-batch-r03','slots':82,'origin':[32,45],
                        'bound':range(26,43),'normal':[*range(0,26),*range(43,64)]},
        'm101_caprimon':{'candidate':'candidate-hf-batch-r06','slots':83,'origin':[24,44],
                         'bound':range(27,44),'normal':[*range(0,27),45,*range(49,61),62,63]},
        'm102_koromon':{'candidate':'candidate-hf-batch-r03','slots':82,'origin':[23,38],
                        'bound':range(26,43),'normal':[*range(0,26),*range(43,64)]},
    }

    def bank(self,entity):
        folder=JOBS/entity/self.CASES[entity]['candidate']
        return folder,read(folder/'bank.json')

    def test_complete_binary_banks_preserve_contract(self):
        for entity,expected in self.CASES.items():
            with self.subTest(entity=entity):
                folder,bank=self.bank(entity)
                contract=read(GENERATED/entity/'motion-contract.json')
                source_sequences=[{'side':side,'sequence':sequence,'available':True,'missing':[]}
                                  for side,data in contract['sides'].items() for sequence in data['sequences']]
                self.assertEqual(expected['slots'],len(bank['cells']))
                self.assertEqual(53,len(bank['sequences']))
                self.assertEqual(source_sequences,bank['sequences'])
                self.assertEqual(expected['origin'],bank['sourceOrigin'])
                self.assertFalse(bank['runtimeEligible'])
                self.assertEqual('PENDING',bank['artReview'])
                for key,record in bank['cells'].items():
                    image=Image.open(folder/record['image']).convert('RGBA')
                    self.assertEqual((64,64),image.size,key)
                    self.assertLessEqual(set(image.getchannel('A').get_flattened_data()),{0,255},key)
                    self.assertEqual(sha((folder/record['image']).read_bytes()),record['sha256'],key)

    def test_aliases_are_exact_translations_of_canonical_masters(self):
        for entity in self.CASES:
            folder,bank=self.bank(entity)
            for key,record in bank['cells'].items():
                canonical=bank['cells'][record['canonical']]
                source=Image.open(folder/canonical['image']).convert('RGBA')
                expected=Image.new('RGBA',(64,64))
                expected.alpha_composite(source,tuple(record['translation']))
                actual=Image.open(folder/record['image']).convert('RGBA')
                self.assertEqual(expected.tobytes(),actual.tobytes(),f'{entity} {key}')

    def test_repair_groups_separate_bound_and_normal_semantics(self):
        for entity,expected in self.CASES.items():
            folder,bank=self.bank(entity)
            for cell in expected['bound']:
                key=f'main/cell_{cell:03d}'
                pixels=set(Image.open(folder/bank['cells'][key]['image']).convert('RGBA').get_flattened_data())
                self.assertTrue(pixels & GOLD,f'{entity} {key} missing original restraint prop')
            for cell in expected['normal']:
                key=f'main/cell_{cell:03d}'
                pixels=set(Image.open(folder/bank['cells'][key]['image']).convert('RGBA').get_flattened_data())
                self.assertFalse(pixels & GOLD,f'{entity} {key} leaked restraint prop')

    def test_m004_stone_state_rebuilt_from_repaired_low_pose(self):
        folder,bank=self.bank('m004_bubbmon')
        base=Image.open(folder/bank['cells']['main/cell_010']['image']).convert('RGBA')
        stone=Image.open(folder/bank['cells']['main/cell_061']['image']).convert('RGBA')
        self.assertEqual(base.getchannel('A').tobytes(),stone.getchannel('A').tobytes())
        for red,green,blue,alpha in stone.get_flattened_data():
            if alpha:self.assertEqual((red,red),(green,blue))

    def test_m005_stone_state_preserves_the_proven_base_contour(self):
        folder,bank=self.bank('m005_pitchmon')
        base=Image.open(folder/bank['cells']['main/cell_010']['image']).convert('RGBA')
        stone=Image.open(folder/bank['cells']['main/cell_061']['image']).convert('RGBA')
        self.assertEqual(base.getchannel('A').tobytes(),stone.getchannel('A').tobytes())
        for red,green,blue,alpha in stone.get_flattened_data():
            if alpha:self.assertEqual((red,red),(green,blue))

    def test_m007_special_states_are_deterministic_from_reviewed_poses(self):
        folder,bank=self.bank('m007_botamon')
        idle=Image.open(folder/bank['cells']['main/cell_000']['image']).convert('RGBA')
        short=Image.open(folder/bank['cells']['main/cell_010']['image']).convert('RGBA')
        black=Image.open(folder/bank['cells']['main/cell_048']['image']).convert('RGBA')
        stone=Image.open(folder/bank['cells']['main/cell_061']['image']).convert('RGBA')
        white=Image.open(folder/bank['cells']['main/cell_064']['image']).convert('RGBA')
        self.assertEqual(idle.getchannel('A').tobytes(),black.getchannel('A').tobytes())
        self.assertEqual(short.getchannel('A').tobytes(),stone.getchannel('A').tobytes())
        self.assertEqual(idle.getchannel('A').tobytes(),white.getchannel('A').tobytes())
        self.assertLessEqual({pixel for pixel in black.get_flattened_data() if pixel[3]},
                             {(0,0,0,255),(248,244,232,255)})
        self.assertEqual({pixel for pixel in white.get_flattened_data() if pixel[3]},
                         {(255,255,255,255)})
        for red,green,blue,alpha in stone.get_flattened_data():
            if alpha:self.assertEqual((red,red),(green,blue))

    def test_m008_black_state_preserves_the_reviewed_low_pose_contour(self):
        folder,bank=self.bank('m008_poyomon')
        low=Image.open(folder/bank['cells']['main/cell_005']['image']).convert('RGBA')
        black=Image.open(folder/bank['cells']['main/cell_048']['image']).convert('RGBA')
        self.assertEqual(low.getchannel('A').tobytes(),black.getchannel('A').tobytes())
        self.assertLessEqual({pixel for pixel in black.get_flattened_data() if pixel[3]},
                             {(0,0,0,255),(238,248,222,255)})

    def test_m009_special_states_preserve_reviewed_original_contours(self):
        folder,bank=self.bank('m009_mokumon')
        image=lambda cell:Image.open(folder/bank['cells'][f'main/cell_{cell:03d}']['image']).convert('RGBA')
        for base,derived in [(8,43),(8,44),(0,45),(10,58),(0,61)]:
            self.assertEqual(image(base).getchannel('A').tobytes(),image(derived).getchannel('A').tobytes())
        for cell in (44,45):
            self.assertLessEqual({pixel for pixel in image(cell).get_flattened_data() if pixel[3]},
                                 {(0,0,0,255),(255,255,255,255)})
        self.assertEqual({pixel for pixel in image(61).get_flattened_data() if pixel[3]},
                         {(255,255,255,255)})
        for red,green,blue,alpha in image(58).get_flattened_data():
            if alpha:self.assertEqual((red,red),(green,blue))

    def test_m010_special_state_colors_are_deterministic(self):
        folder,bank=self.bank('m010_yukimibotamon')
        image=lambda cell:Image.open(folder/bank['cells'][f'main/cell_{cell:03d}']['image']).convert('RGBA')
        self.assertEqual(image(8).getchannel('A').tobytes(),image(44).getchannel('A').tobytes())
        self.assertEqual(image(44).tobytes(),image(46).tobytes())
        self.assertEqual(image(8).getchannel('A').tobytes(),image(47).getchannel('A').tobytes())
        for cell in (47,48):
            self.assertLessEqual({pixel for pixel in image(cell).get_flattened_data() if pixel[3]},
                                 {(0,0,0,255),(255,255,255,255)})
        for red,green,blue,alpha in image(61).get_flattened_data():
            if alpha:self.assertEqual((red,red),(green,blue))
        self.assertLessEqual({pixel for pixel in image(64).get_flattened_data() if pixel[3]},
                             {(255,255,255,255)})

    def test_m011_special_state_colors_are_deterministic(self):
        folder,bank=self.bank('m011_yuramon')
        image=lambda cell:Image.open(folder/bank['cells'][f'main/cell_{cell:03d}']['image']).convert('RGBA')
        self.assertEqual(image(8).getchannel('A').tobytes(),image(43).getchannel('A').tobytes())
        self.assertEqual(image(43).tobytes(),image(45).tobytes())
        self.assertEqual(image(8).getchannel('A').tobytes(),image(46).getchannel('A').tobytes())
        for cell in (46,47):
            self.assertLessEqual({pixel for pixel in image(cell).get_flattened_data() if pixel[3]},
                                 {(0,0,0,255),(255,255,255,255)})
        for red,green,blue,alpha in image(60).get_flattened_data():
            if alpha:self.assertEqual((red,red),(green,blue))
        self.assertEqual({pixel for pixel in image(63).get_flattened_data() if pixel[3]},
                         {(255,255,255,255)})

    def test_m012_special_state_colors_are_deterministic(self):
        folder,bank=self.bank('m012_petimon')
        image=lambda cell:Image.open(folder/bank['cells'][f'main/cell_{cell:03d}']['image']).convert('RGBA')
        self.assertEqual(image(8).getchannel('A').tobytes(),image(43).getchannel('A').tobytes())
        self.assertEqual(image(43).tobytes(),image(45).tobytes())
        self.assertEqual(image(8).getchannel('A').tobytes(),image(46).getchannel('A').tobytes())
        self.assertEqual(image(0).getchannel('A').tobytes(),image(47).getchannel('A').tobytes())
        for cell in (46,47):
            self.assertLessEqual({pixel for pixel in image(cell).get_flattened_data() if pixel[3]},
                                 {(0,0,0,255),(255,255,255,255)})
        for red,green,blue,alpha in image(60).get_flattened_data():
            if alpha:self.assertEqual((red,red),(green,blue))
        self.assertEqual({pixel for pixel in image(63).get_flattened_data() if pixel[3]},
                         {(255,255,255,255)})

    def test_m101_special_states_use_original_bases_and_source_proven_translation(self):
        folder,bank=self.bank('m101_caprimon')
        image=lambda cell:Image.open(folder/bank['cells'][f'main/cell_{cell:03d}']['image']).convert('RGBA')
        self.assertEqual(image(8).getchannel('A').tobytes(),image(44).getchannel('A').tobytes())
        self.assertEqual(image(44).tobytes(),image(46).tobytes())
        self.assertEqual(image(8).getchannel('A').tobytes(),image(47).getchannel('A').tobytes())
        self.assertEqual(image(0).getchannel('A').tobytes(),image(48).getchannel('A').tobytes())
        self.assertEqual(image(0).getchannel('A').tobytes(),image(64).getchannel('A').tobytes())
        shifted=Image.new('L',(64,64));shifted.paste(image(63).getchannel('A'),(2,2))
        self.assertEqual(shifted.tobytes(),image(61).getchannel('A').tobytes())
        for cell in (47,48):
            self.assertLessEqual({pixel for pixel in image(cell).get_flattened_data() if pixel[3]},
                                 {(0,0,0,255),(255,255,255,255)})
        for red,green,blue,alpha in image(61).get_flattened_data():
            if alpha:self.assertEqual((red,red),(green,blue))
        self.assertEqual({pixel for pixel in image(64).get_flattened_data() if pixel[3]},
                         {(255,255,255,255)})

    def test_m102_special_states_and_out_of_manifest_panels_are_deterministic(self):
        folder,bank=self.bank('m102_koromon')
        image=lambda cell:Image.open(folder/bank['cells'][f'main/cell_{cell:03d}']['image']).convert('RGBA')
        for base,derived in [(8,43),(8,46),(0,47),(10,60),(0,63)]:
            self.assertEqual(image(base).getchannel('A').tobytes(),image(derived).getchannel('A').tobytes())
        for cell in (46,47):
            self.assertLessEqual({pixel for pixel in image(cell).get_flattened_data() if pixel[3]},
                                 {(0,0,0,255),(255,255,255,255)})
        for red,green,blue,alpha in image(60).get_flattened_data():
            if alpha:self.assertEqual((red,red),(green,blue))
        self.assertEqual({pixel for pixel in image(63).get_flattened_data() if pixel[3]},
                         {(255,255,255,255)})
        self.assertEqual(list(range(40,48)),bank['sourceUnexpectedOccupiedPanels'])
        self.assertEqual(bank['sourceUnexpectedOccupiedPanels'],bank['ignoredOutOfManifestPanels'])
        self.assertEqual([],bank['unexpectedOccupiedPanels'])

    def test_receipts_and_repair_sources_are_hash_bound(self):
        for entity in self.CASES:
            folder,bank=self.bank(entity)
            receipt=read(folder/'receipt.json')
            for relative,digest in receipt['files'].items():
                self.assertEqual(digest,sha((folder/relative).read_bytes()),f'{entity} {relative}')
            repair=JOBS/entity/'repair-batch-r01'
            if not repair.exists():
                continue
            plan=read(repair/'import-plan.json')
            for group in plan['groups']:
                self.assertEqual(group['sourceSha256'],sha((repair/group['source']).read_bytes()))


if __name__=='__main__':
    unittest.main()
