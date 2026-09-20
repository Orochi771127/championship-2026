import importlib.util
import unittest
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('r05',ROOT/'scripts/m001-full-sheet.py');M=importlib.util.module_from_spec(s);s.loader.exec_module(M)
W=M.P.WORK/'full-sheet-r05';OUT=W/'compiled-final';BASE=M.P.WORK/'full-sheet-r04/compiled-final'
class RepairR05Tests(unittest.TestCase):
    def test_only_squeezed_eye_frames_change_without_alpha_or_motion_drift(self):
        b=M.P.read(OUT/'bank.json');old=M.P.read(BASE/'bank.json');changed=[]
        for k,r in b['cells'].items():
            if r['sha256']!=old['cells'][k]['sha256']:changed.append(k)
            im=Image.open(OUT/r['image']);prior=Image.open(BASE/old['cells'][k]['image'])
            self.assertEqual(im.getchannel('A').tobytes(),prior.getchannel('A').tobytes())
        self.assertEqual(changed,['main/cell_021','main/cell_022'])
        self.assertEqual(b['sequences'],old['sequences'])
        for key,coords in [('main/cell_021',[(27,35),(28,35),(29,35)]),('main/cell_022',[(28,34),(29,34),(30,34)])]:
            im=Image.open(OUT/b['cells'][key]['image']);pal=M.P.PIXEL.parse_palette(b['palette'])
            for xy in coords:self.assertEqual(im.getpixel(xy),pal[7])
    def test_rebuild_identical_no_generation(self):
        self.assertEqual(M.P.read(W/'repair-final-manifest.json')['generationCalls'],0)
        M.patch_sheet(W/'repair-final-manifest.json',check=True)
if __name__=='__main__':unittest.main()
