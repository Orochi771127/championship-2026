import importlib.util
import json
from pathlib import Path
import unittest
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
loader=importlib.util.spec_from_file_location('nature_qa',ROOT/'scripts/check-cage-stage2.py')
qa=importlib.util.module_from_spec(loader);loader.loader.exec_module(qa)


class CageNatureArtifacts(unittest.TestCase):
    def test_seven_specs_cells_ground_and_static_contracts(self):
        for fid,count in zip(qa.BATCH3_FIELDS,(7,9,7,0,0,0,0)):
            with self.subTest(field=fid):
                pack=qa.WORK/'fields'/fid
                self.assertEqual((pack/'spec.json').read_bytes(),(qa.seams.WORK/'fields'/fid/'spec.json').read_bytes())
                manifest,spec,image=qa.seams.proof.compose_modular_pack(pack)
                self.assertEqual(len(manifest['objects']),count)
                self.assertEqual(image.size,tuple(spec['worldSize']))
                self.assertTrue(qa.seams.proof.modular_ground_coverage(spec,image)['pass'])
                self.assertEqual(manifest['generation']['originalRasterInputs'],[])
                self.assertFalse(manifest['humanApproved']);self.assertFalse(manifest['runtimeEligible'])
                self.assertTrue((pack/'master.blend').stat().st_size>10000)
                self.assertEqual(spec['referenceSpec']['frameCount'],1)
                self.assertTrue(all(o['sequenceFrameCount']==1 for o in spec['objects']))
                image.close()

    def test_three_mountain_flips_roundtrip_byte_exactly(self):
        pack=qa.WORK/'fields/field_cm10_01'
        manifest=json.loads((pack/'modular-manifest.json').read_text(encoding='utf8'))
        flipped=[o for o in manifest['objects'] if o['verticalFlip'] or o['horizontalFlip']]
        self.assertEqual(len(flipped),3)
        for obj in flipped:
            with Image.open(pack/obj['src']) as im:cell=im.convert('RGBA')
            if obj['horizontalFlip']:cell=cell.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            if obj['verticalFlip']:cell=cell.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
            with Image.open(pack/'placed-object-cells'/Path(obj['src']).name) as witness:
                self.assertEqual(cell.tobytes(),witness.convert('RGBA').tobytes())
            cell.close()

    def test_zero_pivot_shrubs_keep_their_original_window(self):
        pack=qa.WORK/'fields/field_cm11_01'
        spec=json.loads((pack/'spec.json').read_text(encoding='utf8'))
        render=json.loads((pack/'render-report.json').read_text(encoding='utf8'))
        for obj,anchor in zip(spec['objects'][6:],render['objectAnchors'][6:]):
            self.assertEqual(obj['pivot'],[0,0])
            self.assertEqual(anchor['effectiveCell'][:2],obj['placement'])
            self.assertEqual(anchor['role'],'foreground-shrub-zero-pivot')

    def test_distinct_semantics_and_single_field_ownership(self):
        expected=['suspended-timber-bridge','six-broadleaf-trees','seven-frond-palms',
                  'wind-rippled-sand','luminous-recessed-crater','bright-snowcap','black-arched-cave-mouth']
        for fid,feature in zip(qa.BATCH3_FIELDS,expected):
            render=json.loads((qa.WORK/'fields'/fid/'render-report.json').read_text(encoding='utf8'))
            self.assertIn(feature,render['natureFeatures'])
            self.assertEqual(render['geometryOwnerIds'],[fid])
            self.assertEqual(render['neighborFieldIds'],[])
            self.assertIsNone(render['ringRopePartition'])
            self.assertLess(render['maxProjectionErrorPixels'],.02)
            self.assertFalse(render['sourceRastersLoaded'])

    def test_all_legal_placements_current_hashes_no_seam_holes(self):
        report=json.loads((qa.WORK/'review/stage2-batch3/report.json').read_text(encoding='utf8'))
        self.assertEqual(report['status'],'PASS')
        self.assertEqual(len(report['scenarios']),236)
        self.assertTrue(all(r['alphaHoles']==0 for r in report['scenarios']))
        self.assertEqual({r['fieldId'] for r in report['scenarios']},set(qa.BATCH3_FIELDS))
        self.assertEqual({int(r['id'].split('-')[2]) for r in report['scenarios']},{14,16,18,20})
        self.assertTrue(any(r['wrap'] for r in report['scenarios']))
        self.assertEqual({r['slotIndex']%2 for r in report['scenarios']},{0,1})
        for fid in qa.BATCH3_FIELDS:
            self.assertEqual(report['sources'][fid]['sha256'],qa.seams.sha(qa.WORK/'fields'/fid/'previews/composite-hd4x.png'))


if __name__=='__main__':unittest.main()
