import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('sheet_r03',ROOT/'scripts/m001-full-sheet.py')
M=importlib.util.module_from_spec(spec);spec.loader.exec_module(M)
WORK=M.P.WORK/'full-sheet-r03';OUT=WORK/'compiled-final';BASE=M.P.WORK/'full-sheet-r02/compiled-final'
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def image(p):return Image.open(p).convert('RGBA')

class RepairR03Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bank=read(OUT/'bank.json');cls.base=read(BASE/'bank.json');cls.patch=read(WORK/'repair-final-manifest.json')

    def test_only_the_19_ng_masters_and_aliases_change(self):
        repaired={p['key'] for p in self.patch['panels']};self.assertEqual(len(repaired),19)
        self.assertEqual(len(self.bank['changedSlots']),26)
        for key,record in self.bank['cells'].items():
            self.assertEqual(record['sha256']!=self.base['cells'][key]['sha256'],record['canonical'] in repaired,key)
        self.assertEqual(self.bank['sequences'],self.base['sequences'])
        self.assertFalse(self.bank['runtimeEligible']);self.assertEqual(self.bank['normalGameQa'],'NOT_RUN')
        self.assertEqual(self.bank['cumulativeGenerationCallsForFullSheet'],3)

    def test_full_coverage_rgba_hashes_aliases_and_atlases(self):
        self.assertEqual(len(self.bank['cells']),83);self.assertEqual(len(self.bank['sequences']),53)
        plan=read(M.P.WORK/'generated/preflight.json')
        for key,r in self.bank['cells'].items():
            path=OUT/r['image'];im=image(path)
            self.assertEqual(im.size,(64,64));self.assertEqual(set(im.getchannel('A').get_flattened_data()),{0,255})
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),r['sha256'])
            self.assertEqual(r['translation'],plan['slots'][key]['sourceTranslationFromCanonical'])
            base=image(OUT/self.bank['cells'][r['canonical']]['image']);expected=Image.new('RGBA',(64,64));expected.alpha_composite(base,tuple(r['translation']))
            self.assertEqual(im.tobytes(),expected.tobytes())
            side=key.split('/')[0];n=int(key[-3:]);x,y=n%8*64,n//8*64
            self.assertEqual(image(OUT/f'{side}-atlas.png').crop((x,y,x+64,y+64)).tobytes(),im.tobytes())

    def test_blank_panel_and_native_mouth_eyelid_corrections(self):
        sheet=image(WORK/'repair-sheet.png');w,h=sheet.size
        blank=sheet.crop((round(w*4/5),round(h*3/4),w,h))
        self.assertIsNone(blank.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox())
        palette=M.P.PIXEL.parse_palette(self.bank['palette'])
        for entry in self.patch['panels']:
            im=image(OUT/self.bank['cells'][entry['key']]['image'])
            for x,y,before,after in entry['pixelEdits']:self.assertEqual(im.getpixel((x,y)),palette[after])
        mouth=image(OUT/'cells/main-cell_026.png')
        self.assertEqual(mouth.getpixel((25,37)),palette[9]);self.assertEqual(mouth.getpixel((26,37)),palette[9])

    def test_artifact_rebuild_is_byte_identical(self):
        M.patch_sheet(WORK/'repair-final-manifest.json',check=True)

    def test_wrong_pixel_edit_fails_before_publication(self):
        with tempfile.TemporaryDirectory() as temp:
            patch=json.loads(json.dumps(self.patch));patch['sheet']=str(WORK/'repair-sheet.png')
            patch['panels'][0]['pixelEdits']=[[0,0,6,7]]
            path=Path(temp)/'patch.json';path.write_text(json.dumps(patch),encoding='utf-8')
            with self.assertRaisesRegex(ValueError,'PIXEL_EDIT_SOURCE_DRIFT'):M.patch_sheet(path)
            self.assertFalse((Path(temp)/'compiled-final').exists())

if __name__=='__main__':unittest.main()
