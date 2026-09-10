import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('review',ROOT/'scripts/review-character-pixel-settings.py')
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)

class SettingReviewTests(unittest.TestCase):
    def setting(self):
        return {'entityId':'example','designVersion':'r1','palette':['#00000000','#ffffff'],
                'features':['fixed eye'],'faceRules':['one eye'],'ornamentRules':['none'],
                'poses':[{'key':'main/cell_000','nativeBounds':[-1,-1,1,1],'pixels':[[0,1],[1,0]]}]}

    def test_unknown_character_cannot_enter_stage(self):
        with self.assertRaises(ValueError):r.validate_setting(self.setting(),{'different'})

    def test_palette_and_alpha_are_strict(self):
        for invalid in [['#00000000','#ffffff80'],['#000000ff','#ffffff'],['#00000000']+['#ffffff']*16]:
            setting=self.setting();setting['palette']=invalid
            with self.assertRaises(ValueError):r.validate_setting(setting,{'example'})

    def test_grid_native_dimensions_and_index_are_strict(self):
        for grid in [[[1]],[[0,2],[1,0]],[[True,0],[1,0]]]:
            setting=self.setting();setting['poses'][0]['pixels']=grid
            with self.assertRaises(ValueError):r.validate_setting(setting,{'example'})

    def test_duplicate_pose_rejected(self):
        setting=self.setting();setting['poses']*=2
        with self.assertRaises(ValueError):r.validate_setting(setting,{'example'})

    def test_support_positions_include_native_origin(self):
        before=Image.new('RGBA',(2,2));before.putpixel((0,1),(1,2,3,255))
        after=Image.new('RGBA',(2,2));after.putpixel((1,1),(1,2,3,255))
        result=r.compare_pose(before,after,[-10,-20,-8,-18])
        self.assertEqual(result['removedSupport'],[[-10,-19]])
        self.assertEqual(result['addedSupport'],[[-9,-19]])

    def test_pending_stage_cannot_advance(self):
        self.assertFalse(r.stage_review(['example'],[])['mayAdvance'])

    def test_review_is_hash_locked_and_does_not_promote_runtime(self):
        with tempfile.TemporaryDirectory() as tmp:
            paths={name:Path(tmp)/(name+'.json') for name in ['setting','technicalQa','visualQa']}
            setting=self.setting();setting['identityDesign']=self.identity()
            paths['setting'].write_bytes(r.encoded(setting));sha=r.digest(paths['setting'].read_bytes())
            technical={'entityId':'example','settingFileSha256':sha,'technicalStatus':'PASS','poseSamplingStatus':'PASS'}
            visual={'entityId':'example','settingFileSha256':sha,'verdict':'PASS_SETTING_STAGE','reviewer':'root','unresolvedBlockingIssues':[],
                    'identityDirectionVersion':r.IDENTITY_DIRECTION_VERSION,'identityVerdict':'PASS_IDENTITY_DIRECTION'}
            paths['technicalQa'].write_bytes(r.encoded(technical))
            comparison=Path(tmp)/'source-comparison.png';comparison.write_bytes(b'review fixture')
            png=Path(tmp)/'main-cell_000.png';png.write_bytes(r.PIXEL.png_bytes(r.PIXEL.indexed_image([[0,1],[1,0]],r.PIXEL.parse_palette(self.setting()['palette']))))
            receipt=Path(tmp)/'receipt.json';receipt.write_bytes(r.encoded({'files':{p.name:r.digest(p.read_bytes()) for p in [paths['technicalQa'],comparison,png]}}))
            # Receipt uses canonical technical QA filename, matching this fixture.
            paths['technicalQa'].rename(Path(tmp)/'technical-qa.json');paths['technicalQa']=Path(tmp)/'technical-qa.json'
            receipt.write_bytes(r.encoded({'files':{p.name:r.digest(p.read_bytes()) for p in [paths['technicalQa'],comparison,png]}}))
            visual.update({'technicalQaSha256':r.digest(paths['technicalQa'].read_bytes()),'sourceComparisonSha256':r.digest(comparison.read_bytes())})
            paths['visualQa'].write_bytes(r.encoded(visual))
            a={'entityId':'example',**paths};self.assertTrue(r.stage_review(['example'],[a])['mayAdvance'])
            self.assertFalse(r.stage_review(['example'],[a])['runtimePromotionGranted'])
            old_visual=dict(visual);old_visual.pop('identityDirectionVersion')
            paths['visualQa'].write_bytes(r.encoded(old_visual))
            self.assertFalse(r.stage_review(['example'],[a])['mayAdvance'])
            paths['visualQa'].write_bytes(r.encoded(visual))
            original=png.read_bytes();png.unlink()
            self.assertFalse(r.stage_review(['example'],[a])['mayAdvance'])
            png.write_bytes(original+b'corrupt')
            self.assertFalse(r.stage_review(['example'],[a])['mayAdvance'])
            png.write_bytes(original)
            paths['setting'].write_bytes(r.encoded({**setting,'designVersion':'r2'}))
            self.assertFalse(r.stage_review(['example'],[a])['mayAdvance'])

    def identity(self):
        return {'directionVersion':r.IDENTITY_DIRECTION_VERSION,'family':'FELINE',
                'fixedTraits':['short muzzle','cream cheeks','triangle ears'],
                'changedRegions':['face'],'preservedMotion':['feet'],'allowedContourChanges':[]}

    def test_identity_review_is_versioned_and_separate_from_legacy_pass(self):
        visual={'identityDirectionVersion':r.IDENTITY_DIRECTION_VERSION,'identityVerdict':'PASS_IDENTITY_DIRECTION'}
        self.assertEqual(r.identity_review_reason(self.setting(),visual),'IDENTITY_DESIGN_REQUIRED')
        setting=self.setting();setting['identityDesign']=self.identity()
        self.assertIsNone(r.identity_review_reason(setting,visual))
        self.assertEqual(r.identity_review_reason(setting,{}),'IDENTITY_REVIEW_REQUIRED')
        self.assertEqual(r.identity_review_reason(setting,{**visual,'identityVerdict':'REPAIR'}),'IDENTITY_REPAIR_REQUIRED')
        for field,value in [('directionVersion','old'),('family',''),('fixedTraits',['same']*3),
                            ('changedRegions',[]),('preservedMotion',[]),('allowedContourChanges',None)]:
            with self.subTest(field=field):
                invalid={**setting,'identityDesign':{**self.identity(),field:value}}
                self.assertIsNotNone(r.identity_review_reason(invalid,visual))
        # Old sources remain editable and compilable; identity acceptance is a later gate.
        r.validate_setting(self.setting(),{'example'})

    def test_duplicate_review_rejected(self):
        with self.assertRaises(ValueError):r.stage_review(['example'],[{'entityId':'example'}]*2)

    def test_empty_stage_is_not_complete(self):
        with self.assertRaises(ValueError):r.stage_review([],[])

    def test_gallery_requires_exact_roster_and_representatives(self):
        g=r.module('gallery_test','build-character-pixel-setting-gallery.py')
        ids=g.queue_tools.PRIORITY+[f'entity-{i}' for i in range(216)]
        catalog={'entities':[{'entityId':eid} for eid in ids]};queue={'records':catalog['entities']}
        g.validate_roster(queue,catalog)
        for invalid in [[],queue['records'][:-1],queue['records'][:-1]+queue['records'][:1],list(reversed(queue['records']))]:
            with self.assertRaises(ValueError):g.validate_roster({'records':invalid},catalog)

    def test_review_snapshot_pointer_stays_local(self):
        g=r.module('gallery_pointer_test','build-character-pixel-setting-gallery.py')
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp);self.assertEqual(g.review_directory(folder),'review')
            for name in ['../review','https://example.com','review/other','']:
                (folder/'current-review.json').write_bytes(r.encoded({'directory':name}))
                with self.assertRaises(ValueError):g.review_directory(folder)
            (folder/'current-review.json').write_bytes(r.encoded({'directory':'review-r02'}))
            self.assertEqual(g.review_directory(folder),'review-r02')

if __name__=='__main__':unittest.main()
