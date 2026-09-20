import importlib.util
import shutil
import tempfile
import unittest
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
loader=importlib.util.spec_from_file_location('surface_qa',ROOT/'scripts/check-cage-stage3.py')
qa=importlib.util.module_from_spec(loader);loader.loader.exec_module(qa)
proof=qa.seams.proof


class SurfaceAnimation(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.pack=Path(self.temp.name)/'volcano';self.pack.mkdir()
        source=qa.WORK/'fields/field_cm07_01'
        for name in ('spec.json','base.png','modular-manifest.json'):shutil.copy2(source/name,self.pack/name)
        (self.pack/'animation/01').mkdir(parents=True)
        shutil.copy2(source/'animation/01/base.png',self.pack/'animation/01/base.png')
        (self.pack/'object-cells').mkdir()

    def change(self,fn):
        manifest=proof.read(self.pack/'modular-manifest.json');fn(manifest)
        (self.pack/'modular-manifest.json').write_text(proof.dump(manifest),encoding='utf8')

    def test_both_surfaces_have_two_distinct_ground_complete_frames(self):
        for fid,ticks,count in [('field_cm07_01',50,0),('field_cm39_01',20,1)]:
            pack=qa.WORK/'fields'/fid;fingerprints=[]
            for index in range(2):
                manifest,spec,image=proof.compose_modular_pack(pack,index)
                self.assertEqual(manifest['coreFrames'][index]['durationRawTicks'],ticks)
                self.assertEqual(len(manifest['objects']),count)
                self.assertTrue(proof.modular_ground_coverage(spec,image)['pass'])
                fingerprints.append(image.tobytes());image.close()
                master=pack/'master.blend' if index==0 else pack/'animation/01/master.blend'
                self.assertGreater(master.stat().st_size,10000)
            self.assertNotEqual(*fingerprints)

    def test_missing_frame_and_altered_timing_fail_closed(self):
        original=(self.pack/'modular-manifest.json').read_text(encoding='utf8')
        for change,error in [(lambda m:m['coreFrames'].pop(),'INCOMPLETE'),
                             (lambda m:m['coreFrames'][1].update(durationMs=100),'TIMING_DRIFT'),
                             (lambda m:m['coreFrames'][1].update(sha256='0'*64),'IMAGE_HASH_DRIFT')]:
            (self.pack/'modular-manifest.json').write_text(original,encoding='utf8');self.change(change)
            with self.assertRaisesRegex(ValueError,error):proof.compose_modular_pack(self.pack,0)

    def test_second_frame_hole_is_not_hidden_by_good_first_frame(self):
        path=self.pack/'animation/01/base.png'
        with Image.open(path) as source:im=Image.new('RGBA',source.size)
        im.putpixel((0,0),(255,255,255,255));im.save(path);im.close()
        self.change(lambda m:m['coreFrames'][1].update(sha256=proof.digest(path)))
        with self.assertRaisesRegex(ValueError,'GROUND_COVERAGE_FAILED'):
            proof.build_modular_pack(self.pack,self.pack/'previews')

    def test_duplicate_frames_do_not_count_as_animation(self):
        self.change(lambda m:m['coreFrames'][1].update(src=m['core']['src'],sha256=m['core']['sha256']))
        with self.assertRaisesRegex(ValueError,'ANIMATION_FROZEN'):
            proof.build_modular_pack(self.pack,self.pack/'previews')

    def test_all_placements_include_each_frame_and_current_hashes(self):
        report=proof.read(qa.WORK/'review/stage3-batch1/report.json')
        self.assertEqual(report['status'],'PASS')
        self.assertEqual({r['frameIndex'] for r in report['scenarios']},{0,1})
        self.assertEqual({r['fieldId'] for r in report['scenarios']},set(qa.FIELDS))
        self.assertTrue(all(r['alphaHoles']==0 for r in report['scenarios']))
        for fid,frames in report['sources'].items():
            for frame in frames:
                path=qa.WORK/'fields'/fid/'previews'/f"frame-{frame['index']:02d}.png"
                self.assertEqual(frame['sha256'],proof.digest(path))


if __name__=='__main__':unittest.main()
