import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
loader=importlib.util.spec_from_file_location('seam_qa',ROOT/'scripts/check-cage-seams.py')
qa=importlib.util.module_from_spec(loader); loader.loader.exec_module(qa)
PACK=qa.WORK/'seam-v3'
IDS=['field_cm28_01','field_cm02_01','field_cm01_01','field_cm16_01']


class SeamTests(unittest.TestCase):
    def test_checker_lattice_repeats_at_native_offsets_not_arbitrary_fits(self):
        for dx,dy in [(0,-24),(96,0),(48,88),(48,64),(672,0),(960,0)]:
            for x in [i+.17 for i in range(-48,193,3)]:
                for y in [i+.31 for i in range(0,201,5)]:
                    self.assertEqual(qa.checker_parity(x,y),qa.checker_parity(x+dx,y+dy))
        self.assertNotEqual(qa.checker_parity(3,9),qa.checker_parity(3,13))

    def test_every_field_preserves_source_spec_and_native_props(self):
        for fid in IDS:
            pack=PACK/'fields'/fid
            self.assertEqual((pack/'spec.json').read_bytes(),(qa.WORK/'fields'/fid/'spec.json').read_bytes())
            manifest,spec,image=qa.proof.compose_modular_pack(pack)
            self.assertEqual(manifest['generation']['look'],'seam-v3')
            self.assertEqual(len(manifest['objects']),len(spec['objects']))
            self.assertTrue(qa.proof.modular_ground_coverage(spec,image)['pass']); image.close()

    def test_shared_edge_no_background_punctures(self):
        with Image.open(PACK/'review/waiting-sports-assembled-review.png') as image:
            result=qa.contact_samples(image)
            self.assertGreater(result['sampleCount'],2000)
            self.assertEqual(result['minimumAlpha'],255)
            self.assertTrue(result['pass'])

    def test_deliberate_gap_is_detected(self):
        with Image.open(PACK/'review/waiting-sports-assembled-review.png') as original:
            image=original.copy()
        image.putpixel((768,100),(0,0,0,0))
        self.assertFalse(qa.contact_samples(image)['pass']);image.close()

    def test_owner_corrected_lower_sports_area_is_clay_not_waiting_checker(self):
        # Representative clean pixels below the track and above the three nets.
        # Reject the earlier blue-white apron without changing source placement.
        with Image.open(PACK/'fields/field_cm02_01/base.png') as image:
            for x,y in [(64,132),(80,132),(96,132),(112,132),(128,132),(80,148),(112,148)]:
                r,g,b,a=image.getpixel((x*4,y*4))
                self.assertEqual(a,255)
                self.assertGreater(r,b+35)
                self.assertGreater(r,g+15)

    def test_review_plan_exercises_crop_lower_row_and_wrap(self):
        geo=json.loads(subprocess.check_output(['node','scripts/lib/cage-authoring-geometry.mjs','--seam-review'],cwd=ROOT))
        self.assertEqual(len(geo['scenarios']),130)
        parts=[p for s in geo['scenarios'] for p in s['plan']['placements'] if p['fieldId'] in IDS]
        self.assertTrue(any('fragmentOfSlot' in p for p in parts))
        self.assertEqual({p['sourceRect']['y'] for p in parts},{0,96})

    def test_sources_are_bound_and_not_promoted(self):
        report=qa.proof.read(PACK/'review/seam-report.json')
        self.assertTrue(set(IDS).issubset(report['candidateFields']))
        self.assertEqual(report['checkerPhaseFailures'],[])
        for fid in IDS:
            src=report['sources'][fid]
            self.assertEqual(qa.sha(ROOT/src['path']),src['sha256'])
            manifest=qa.proof.read(PACK/'fields'/fid/'modular-manifest.json')
            self.assertEqual(manifest['generation']['originalRasterInputs'],[])
            for flag in ['runtimeEligible','shippingReady','humanApproved']:self.assertIs(manifest[flag],False)


if __name__=='__main__':unittest.main()
