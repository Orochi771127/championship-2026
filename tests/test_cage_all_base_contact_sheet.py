import json,sys,unittest
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from lib.cage_object_animation_contract import sha
OUT=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1/review/catalog-37'

class AllBaseContactSheetTests(unittest.TestCase):
    def test_exactly_37_independent_candidates(self):
        report=json.loads((OUT/'catalog.json').read_text(encoding='utf8'));self.assertEqual(report['count'],37)
        self.assertEqual(len({row['fieldId'] for row in report['fields']}),37)
        for row in report['fields']:
            path=ROOT/row['file'];self.assertTrue(path.is_file());self.assertEqual(sha(path),row['sha256'])
    def test_review_sheet_is_current(self):
        report=json.loads((OUT/'catalog.json').read_text(encoding='utf8'));path=OUT/report['contactSheet']
        self.assertEqual(sha(path),report['contactSheetSha256'])
        with Image.open(path) as image:self.assertGreaterEqual(image.width,1600);self.assertGreaterEqual(image.height,3000)
        self.assertIn('NOT_RUNTIME_OR_FINAL_ART',report['status'])
if __name__=='__main__':unittest.main()
