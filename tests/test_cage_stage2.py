import importlib.util
import json
from pathlib import Path
import unittest
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
loader=importlib.util.spec_from_file_location('stage2',ROOT/'scripts/check-cage-stage2.py')
stage2=importlib.util.module_from_spec(loader);loader.loader.exec_module(stage2)


class StageTwoBatchTests(unittest.TestCase):
    def test_specs_and_independent_cells_are_unchanged(self):
        for fid,count in zip(stage2.FIELDS,(6,1,3,3)):
            with self.subTest(field=fid):
                pack=stage2.WORK/'fields'/fid
                self.assertEqual((pack/'spec.json').read_bytes(),(stage2.seams.WORK/'fields'/fid/'spec.json').read_bytes())
                manifest,spec,image=stage2.seams.proof.compose_modular_pack(pack)
                self.assertEqual(len(manifest['objects']),count)
                self.assertEqual(image.size,tuple(spec['worldSize']))
                self.assertTrue(stage2.seams.proof.modular_ground_coverage(spec,image)['pass'])
                self.assertFalse(manifest['runtimeEligible'])
                self.assertFalse(manifest['humanApproved'])
                self.assertEqual(manifest['generation']['originalRasterInputs'],[])
                image.close()

    def test_all_native_placements_have_no_internal_alpha_cracks(self):
        report=json.loads((stage2.WORK/'review/stage2-batch1/report.json').read_text(encoding='utf8'))
        self.assertEqual(report['status'],'PASS')
        self.assertEqual(len(report['scenarios']),166)
        self.assertTrue(all(r['alphaHoles']==0 for r in report['scenarios']))
        self.assertEqual({r['fieldId'] for r in report['scenarios']},set(stage2.FIELDS))
        self.assertEqual({int(r['id'].split('-')[2]) for r in report['scenarios']},{14,16,18,20})
        self.assertTrue(any(r['wrap'] for r in report['scenarios']))
        self.assertEqual({r['slotIndex']%2 for r in report['scenarios']},{0,1})
        for fid in stage2.FIELDS:
            self.assertEqual(report['sources'][fid]['sha256'],stage2.seams.sha(stage2.WORK/'fields'/fid/'previews/composite-hd4x.png'))

    def test_prop_roles_are_not_replaced_by_placeholder_blocks(self):
        expected={'field_cm05_01':['weight-bench',*(['exercise-bike']*4),'punching-station'],
                  'field_cm30_01':['hurdle'],
                  'field_cm31_01':['medical-chair','medical-chair','medical-bed'],
                  'field_cm34_01':['compact-wall-cycle','exercise-bike','punching-station']}
        for fid,roles in expected.items():
            report=json.loads((stage2.WORK/'fields'/fid/'render-report.json').read_text(encoding='utf8'))
            self.assertEqual([r['role'] for r in report['objectAnchors']],roles)
            self.assertEqual(report['geometryOwnerIds'],[fid])
            self.assertEqual(report['neighborFieldIds'],[])
            self.assertLess(report['maxProjectionErrorPixels'],.02)
            self.assertFalse(report['sourceRastersLoaded'])

    def test_small_sports_is_clay_not_waiting_room_checker(self):
        with Image.open(stage2.WORK/'fields/field_cm30_01/previews/composite-hd4x.png') as image:
            for x,y in [(30,29),(48,33),(55,75),(47,98)]:
                r,g,b,a=image.getpixel((x*4,y*4))
                self.assertGreater(r,b+35)
                self.assertGreater(r,g+15)
                self.assertEqual(a,255)

    def test_static_export_remains_static_and_editable(self):
        for fid in stage2.FIELDS:
            pack=stage2.WORK/'fields'/fid
            spec=json.loads((pack/'spec.json').read_text(encoding='utf8'))
            self.assertEqual(len(spec['frames']),1)
            self.assertTrue(all(o['sequenceFrameCount']==1 for o in spec['objects']))
            self.assertGreater((pack/'master.blend').stat().st_size,10000)


if __name__=='__main__':unittest.main()
