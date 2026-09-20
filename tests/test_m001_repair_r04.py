"""Full bank regression: reuse with translation, native size, unchanged motion."""
import importlib.util
import hashlib
import unittest
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sheet_r04', ROOT/'scripts/m001-full-sheet.py')
M = importlib.util.module_from_spec(spec)
spec.loader.exec_module(M)
WORK = M.P.WORK/'full-sheet-r04'
OUT = WORK/'compiled-final'
BASE = M.P.WORK/'full-sheet-r03/compiled-final'

class RepairR04Tests(unittest.TestCase):
    def test_all_slots_keep_native_canvas_origin_and_alias_translation(self):
        bank = M.P.read(OUT/'bank.json')
        plan = M.P.read(M.P.WORK/'generated/preflight.json')
        self.assertEqual(len(bank['cells']), 83)
        self.assertEqual(len(bank['sequences']), 53)
        for key, r in bank['cells'].items():
            im = Image.open(OUT/r['image']).convert('RGBA')
            self.assertEqual(im.size, (64,64))
            self.assertEqual(set(im.getchannel('A').get_flattened_data()), {0,255})
            self.assertEqual(hashlib.sha256((OUT/r['image']).read_bytes()).hexdigest(), r['sha256'])
            self.assertEqual(r['translation'], plan['slots'][key]['sourceTranslationFromCanonical'])
            expected = Image.new('RGBA', (64,64))
            expected.alpha_composite(Image.open(OUT/bank['cells'][r['canonical']]['image']).convert('RGBA'), tuple(r['translation']))
            self.assertEqual(im.tobytes(), expected.tobytes(), key)
            side = key.split('/')[0]; n = int(key[-3:]); x,y = n%8*64,n//8*64
            self.assertEqual(Image.open(OUT/f'{side}-atlas.png').crop((x,y,x+64,y+64)).tobytes(), im.tobytes())

    def test_only_target_masters_and_all_aliases_change(self):
        bank = M.P.read(OUT/'bank.json'); base = M.P.read(BASE/'bank.json')
        targets = {p['key'] for p in M.P.read(WORK/'repair-final-manifest.json')['panels']}
        self.assertEqual(len(targets),17)
        actual=[]
        for k,r in bank['cells'].items():
            changed=r['sha256'] != base['cells'][k]['sha256']
            self.assertEqual(changed, r['canonical'] in targets, k)
            if changed: actual.append(k)
        self.assertEqual(sorted(actual),sorted(bank['changedSlots']))
        self.assertIn('main/cell_063',actual)
        self.assertEqual(bank['cells']['main/cell_063']['translation'],[-6,4])
        self.assertEqual(bank['sequences'],base['sequences'])
        self.assertFalse(bank['runtimeEligible'])

    def test_native_pixel_cleanup_does_not_change_alpha(self):
        bank=M.P.read(OUT/'bank.json'); pal=M.P.PIXEL.parse_palette(bank['palette'])
        for p in M.P.read(WORK/'repair-final-manifest.json')['panels']:
            path=bank['cells'][p['key']]['image']
            im=Image.open(OUT/path).convert('RGBA')
            self.assertEqual(im.getchannel('A').tobytes(),Image.open(WORK/'compiled'/path).getchannel('A').tobytes())
            for x,y,before,after in p['pixelEdits']: self.assertEqual(im.getpixel((x,y)),pal[after])

    def test_rebuild_is_byte_identical(self):
        M.patch_sheet(WORK/'repair-final-manifest.json',check=True)

if __name__ == '__main__': unittest.main()
