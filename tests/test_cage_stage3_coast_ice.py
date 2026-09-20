"""Batch 2 keeps original surface timing, independent palms and hex boundaries."""
import importlib.util
import unittest
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
qa=load('surface_batch2_qa','scripts/check-cage-stage3.py')
surface=load('surface_geometry','scripts/lib/cage_animated_surface_authoring.py')
hex_qa=load('surface_hex_qa','scripts/check-cage-hex-footprints.py')
proof=qa.seams.proof
FIELDS=('field_cm09_01','field_cm21_01')


class CoastAndIce(unittest.TestCase):
    def test_progress_does_not_equate_base_candidates_with_final_scene(self):
        ledger=proof.read(qa.WORK.parent/'three-stage-progress.json')
        self.assertEqual(len(ledger['fields']),37)
        self.assertFalse(ledger['fullSceneAccepted']);self.assertFalse(ledger['finalPolishAccepted'])
        self.assertFalse(ledger['runtimeEligible']);self.assertFalse(ledger['shippingReady'])
        for fid in FIELDS:
            row=next(r for r in ledger['fields'] if r['fieldId']==fid)
            self.assertEqual(row['status'],'LOCAL_CANDIDATE_VERIFIED_NOT_FINAL_ART')
            self.assertFalse(row['humanApproved'])

    def test_three_inventory_is_bound_to_real_masters_without_claiming_export(self):
        report=proof.read(qa.WORK/'review/stage3-batch2/three-readiness.json')
        self.assertFalse(report['runtimeModified']);self.assertFalse(report['sourceFilesModified'])
        self.assertEqual({r['fieldId'] for r in report['fields']},{'field_cm28_01',*FIELDS})
        for row in report['fields']:
            self.assertEqual(row['sha256'],proof.digest(ROOT/row['source']))
            self.assertGreater(row['evaluatedTriangles'],0)
            self.assertEqual(row['cameraType'],'ORTHO')
            self.assertEqual(row['geometryOwnerIds'],[row['fieldId']])
            self.assertFalse(row['exportedGLB']);self.assertFalse(row['runtimeVerified'])

    def test_each_frame_matches_original_timing_coverage_and_actual_hex_mesh(self):
        for fid in FIELDS:
            pack=qa.WORK/'fields'/fid;pixels=[]
            for index in (0,1):
                manifest,spec,image=proof.compose_modular_pack(pack,index)
                self.assertEqual(manifest['coreFrames'][index]['durationRawTicks'],20)
                self.assertEqual(manifest['coreFrames'][index]['durationMs'],spec['frames'][index]['durationMs'])
                self.assertTrue(proof.modular_ground_coverage(spec,image)['pass'])
                pixels.append(image.tobytes());image.close()
                phase=pack if index==0 else pack/'animation/01'
                row=hex_qa.audit(spec,manifest,proof.read(phase/'render-report.json'))
                self.assertTrue(row['meshMatchesNativeUnion'])
                self.assertGreater((phase/'master.blend').stat().st_size,10000)
            self.assertNotEqual(*pixels)

    def test_two_palms_remain_independent_and_static_between_surface_states(self):
        pack=qa.WORK/'fields/field_cm09_01'
        manifest=proof.read(pack/'modular-manifest.json')
        self.assertEqual(len(manifest['objects']),2)
        self.assertEqual([o['placement'] for o in manifest['objects']],[[33,47],[65,119]])
        for obj in manifest['objects']:
            with Image.open(pack/obj['src']) as a,Image.open(pack/'animation/01'/obj['src']) as b:
                self.assertEqual(a.size,(256,256));self.assertEqual(a.tobytes(),b.tobytes())
                self.assertIsNotNone(a.getchannel('A').getbbox())
        self.assertEqual(proof.read(qa.WORK/'fields/field_cm21_01/modular-manifest.json')['objects'],[])

    def test_clip_preserves_hex_and_rejects_outside_polygon(self):
        cell=[(0,24),(48,0),(96,24),(96,88),(48,112),(0,88)]
        clipped=surface.clip_to_cell([(-10,-10),(110,-10),(110,120),(-10,120)],cell)
        self.assertEqual(set(clipped),set(cell))
        self.assertEqual(surface.clip_to_cell([(100,0),(120,0),(120,10)],cell),[])
        for points in [[(-5,20),(80,20),(80,80),(-5,80)],cell]:
            clipped=surface.clip_to_cell(points,cell)
            for p in clipped:
                for a,b in zip(cell,cell[1:]+cell[:1]):
                    self.assertGreaterEqual((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]),-1e-6)
            self.assertTrue(all(a!=b for a,b in zip(clipped,clipped[1:]+clipped[:1])))

    def test_batch2_placement_report_contains_both_states_and_fresh_composites(self):
        report=proof.read(qa.WORK/'review/stage3-batch2/report.json')
        self.assertEqual(report['status'],'PASS')
        self.assertEqual({r['fieldId'] for r in report['scenarios']},set(FIELDS))
        for fid in FIELDS:
            rows=[r for r in report['scenarios'] if r['fieldId']==fid]
            self.assertEqual({r['frameIndex'] for r in rows},{0,1})
            self.assertTrue(all(r['alphaHoles']==0 for r in rows))
            for frame in report['sources'][fid]:
                self.assertEqual(frame['sha256'],proof.digest(qa.WORK/'fields'/fid/'previews'/f"frame-{frame['index']:02d}.png"))


if __name__=='__main__':unittest.main()
