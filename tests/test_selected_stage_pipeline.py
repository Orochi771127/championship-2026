"""Guard trailing blank sheet rows and unassigned pixels against silent loss."""
import importlib.util,json,tempfile,unittest
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
sp=importlib.util.spec_from_file_location('stage_layout',ROOT/'scripts/inspect-selected-sheet-layout.py');L=importlib.util.module_from_spec(sp);sp.loader.exec_module(L)
class StageLayoutTests(unittest.TestCase):
 def make(self,root,extra=False):
  keys=[f'main/cell_{n:03}' for n in range(5)]
  (root/'job.json').write_text(json.dumps({'keys':keys,'grid':[3,3]}),encoding='utf-8')
  im=Image.new('RGBA',(96,96));d=ImageDraw.Draw(im)
  for n in range(5):
   x=8+n%3*28;y=8+n//3*28;d.rectangle((x,y,x+10,y+12),fill='white')
  if extra:d.rectangle((76,70,80,74),fill='white')
  im.save(root/'sheet.png')
 def test_unused_last_grid_row_is_valid_and_all_alpha_accounted(self):
  with tempfile.TemporaryDirectory() as td:
   p=Path(td);self.make(p);L.inspect(p,p/'sheet.png',p/'out',5,5,96,220,0,0)
   r=json.loads((p/'out/extraction.json').read_text());self.assertEqual(len(r['panels']),5);self.assertEqual(r['opaquePixelsOutsideCrops'],0);self.assertFalse(r['perFrameFit'])
 def test_extra_opaque_glyph_cannot_be_silently_dropped(self):
  with tempfile.TemporaryDirectory() as td:
   p=Path(td);self.make(p,True)
   with self.assertRaisesRegex(AssertionError,'ROW_COUNT_MISMATCH'):L.inspect(p,p/'sheet.png',p/'out',5,5,96,220,0,0)
   self.assertFalse((p/'out').exists())
 def test_immutable_extraction_cannot_be_replaced(self):
  with tempfile.TemporaryDirectory() as td:
   p=Path(td);self.make(p);(p/'out').mkdir()
   with self.assertRaisesRegex(AssertionError,'IMMUTABLE_OUTPUT_EXISTS'):L.inspect(p,p/'sheet.png',p/'out',5,5,96,220,0,0)
if __name__=='__main__':unittest.main()
