import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('m001_sheet',ROOT/'scripts/m001-full-sheet.py')
M=importlib.util.module_from_spec(spec);spec.loader.exec_module(M)
WORK=M.P.WORK/'full-sheet-r02';OUT=WORK/'compiled-final';BASE=M.WORK/'compiled-aligned'

def read(p):return json.loads(p.read_text(encoding='utf-8'))
def image(path):return Image.open(path).convert('RGBA')

class RepairTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bank=read(OUT/'bank.json');cls.prior=read(BASE/'bank.json');cls.patch=read(WORK/'repair-final-manifest.json')

    def test_only_repaired_masters_and_their_aliases_change(self):
        repaired=set(self.bank['repairedMasters'])
        self.assertEqual(repaired,{f'main/cell_{n:03d}' for n in [8,44,47,48,51,52,61]})
        changed=[]
        for key,r in self.bank['cells'].items():
            different=r['sha256']!=self.prior['cells'][key]['sha256']
            self.assertEqual(different,r['canonical'] in repaired,key)
            if different:changed.append(key)
        self.assertEqual(changed,self.bank['changedSlots'])
        self.assertEqual(self.bank['sequences'],self.prior['sequences'])
        self.assertFalse(self.bank['runtimeEligible']);self.assertEqual(self.bank['artReview'],'PENDING')

    def test_all_83_cells_atlases_hashes_and_translated_aliases(self):
        self.assertEqual(len(self.bank['cells']),83);self.assertEqual(len(self.bank['sequences']),53)
        for key,r in self.bank['cells'].items():
            data=(OUT/r['image']).read_bytes();im=image(OUT/r['image'])
            self.assertEqual(im.size,(64,64));self.assertEqual(set(im.getchannel('A').get_flattened_data()),{0,255})
            self.assertEqual(hashlib.sha256(data).hexdigest(),r['sha256'])
            canonical=image(OUT/self.bank['cells'][r['canonical']]['image'])
            expected=Image.new('RGBA',(64,64));expected.alpha_composite(canonical,tuple(r['translation']))
            self.assertEqual(im.tobytes(),expected.tobytes())
            side,num=key.split('/');n=int(num[-3:]);x,y=n%8*64,n//8*64
            self.assertEqual(image(OUT/f'{side}-atlas.png').crop((x,y,x+64,y+64)).tobytes(),im.tobytes())

    def test_silhouettes_keep_opaque_white_eyes_and_original_pose(self):
        for entry in self.patch['derived']:
            if entry['operation']!='dark_silhouette_white_eye_mask':continue
            im=image(OUT/self.bank['cells'][entry['key']]['image']);base=image(OUT/self.bank['cells'][entry['base']]['image'])
            self.assertEqual(im.getchannel('A').tobytes(),base.getchannel('A').tobytes())
            white={tuple(p) for p in entry['whiteEyePixels']}
            for y in range(64):
                for x in range(64):
                    if im.getpixel((x,y))[3]:self.assertEqual(im.getpixel((x,y)),(255,255,255,255) if (x,y) in white else (0,0,0,255))

    def test_petrification_derived_from_colored_repaired_pose(self):
        base=image(OUT/'base-candidates/main-cell_061.png');gray=image(OUT/'cells/main-cell_061.png')
        self.assertTrue(any(r!=g for r,g,b,a in base.get_flattened_data() if a))
        channel=base.convert('L');expected=Image.merge('RGBA',(channel,channel,channel,base.getchannel('A')))
        self.assertEqual(gray.tobytes(),expected.tobytes())

    def test_rebuild_is_byte_identical(self):
        M.patch_sheet(WORK/'repair-final-manifest.json',check=True)

    def test_flash_sequence_reuses_one_pose_across_all_states(self):
        frames=next(s['sequence']['frames'] for s in self.bank['sequences'] if s['side']=='main' and s['sequence']['id']==26)
        self.assertEqual([(f['cell'],f['ticks']) for f in frames],[(44,6),(45,3),(46,9),(47,9)])
        base=image(OUT/'cells/main-cell_008.png')
        for frame in frames:
            im=image(OUT/f"cells/main-cell_{frame['cell']:03d}.png")
            self.assertEqual(im.getchannel('A').tobytes(),base.getchannel('A').tobytes())
        lut=self.patch['derived'][0]['paletteIndexMap'];palette=M.P.PIXEL.parse_palette(self.bank['palette'])
        expected=[palette[lut[palette.index(p)]] for p in base.get_flattened_data()]
        self.assertEqual(list(image(OUT/'cells/main-cell_044.png').get_flattened_data()),expected)

    def test_source_drift_and_invalid_eye_mask_fail_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            manifest=Path(temp)/'patch.json'
            patch={**self.patch,'sheet':str(WORK/'repair-sheet.png'),'sheetSha256':'0'*64}
            manifest.write_text(json.dumps(patch),encoding='utf-8')
            with self.assertRaisesRegex(ValueError,'REPAIR_SHEET_DRIFT'):M.patch_sheet(manifest)
            patch['sheetSha256']=self.patch['sheetSha256'];patch['derived']=[{**self.patch['derived'][1],'whiteEyePixels':[[0,0]]}]
            manifest.write_text(json.dumps(patch),encoding='utf-8')
            with self.assertRaisesRegex(ValueError,'WHITE_EYE_MASK_NOT_ORIGINAL_CREAM'):M.patch_sheet(manifest)
            self.assertFalse((Path(temp)/'compiled-final').exists())

if __name__=='__main__':unittest.main()
