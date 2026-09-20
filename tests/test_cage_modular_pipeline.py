"""The independent HD adapter must keep using the original placement compositor."""
import importlib.util
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
module=importlib.util.spec_from_file_location('modular_proof',ROOT/'scripts/build-cage-authoring-proof.py')
proof=importlib.util.module_from_spec(module)
module.loader.exec_module(proof)
FIELDS=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1/fields'
SPORTS=FIELDS/'field_cm02_01'
WAITING=FIELDS/'field_cm28_01'


class ModularPipeline(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)

    def copy_pack(self,source=SPORTS):
        destination=self.root/source.name
        destination.mkdir()
        for name in ['spec.json','base.png','modular-manifest.json']:
            shutil.copy2(source/name,destination/name)
        shutil.copytree(source/'object-cells',destination/'object-cells')
        return destination

    def manifest(self,pack,change):
        value=proof.read(pack/'modular-manifest.json')
        change(value)
        (pack/'modular-manifest.json').write_text(proof.dump(value),encoding='utf8')

    def spec_change(self,pack,change):
        value=proof.read(pack/'spec.json'); change(value)
        (pack/'spec.json').write_text(proof.dump(value),encoding='utf8')
        self.manifest(pack,lambda m:m.update(sourceSpecSha256=proof.digest(pack/'spec.json')))

    def test_both_independent_fields_and_ground_coverage(self):
        for pack,size,count in [(WAITING,(960,800),0),(SPORTS,(768,800),5)]:
            with self.subTest(field=pack.name):
                manifest,spec,image=proof.compose_modular_pack(pack)
                self.assertEqual(image.size,size)
                self.assertEqual(len(manifest['objects']),count)
                self.assertEqual(spec['outputContract']['fieldIds'],[pack.name])
                self.assertTrue(proof.modular_ground_coverage(spec,image)['pass'])
                image.close()

    def test_uses_exact_shared_compositor_without_secondary_coordinates(self):
        with patch.object(proof,'composite_rendered_object_placements',wraps=proof.composite_rendered_object_placements) as call:
            _,spec,image=proof.compose_modular_pack(SPORTS)
        self.assertEqual(call.call_count,1)
        for actual,expected in zip(call.call_args.args[1],spec['objects']):
            self.assertEqual(actual['placement'],[v*4 for v in expected['placement']])
            self.assertEqual(actual['pivot'],[v*4 for v in expected['pivot']])
        image.close()

    def test_missing_extra_reordered_and_wrong_binding_rejected(self):
        changes=[('missing',lambda m:m['objects'].pop(),'INCOMPLETE'),
                 ('extra',lambda m:m['objects'].append(m['objects'][0]),'INCOMPLETE'),
                 ('order',lambda m:m['objects'].reverse(),'ORDER_DRIFT'),
                 ('pivot',lambda m:m['objects'][0]['pivot'].__setitem__(0,99),'PIVOT_DRIFT'),
                 ('placement',lambda m:m['objects'][0]['placement'].__setitem__(0,99),'PIVOT_DRIFT'),
                 ('file',lambda m:m['objects'][0].update(src='base.png'),'FILE_BINDING'),
                 ('flip',lambda m:m['objects'][0].update(horizontalFlip=True),'PIVOT_DRIFT')]
        pack=self.copy_pack()
        original=(pack/'modular-manifest.json').read_text(encoding='utf8')
        for label,change,error in changes:
            with self.subTest(label=label):
                (pack/'modular-manifest.json').write_text(original,encoding='utf8')
                self.manifest(pack,change)
                with self.assertRaisesRegex(ValueError,error): proof.compose_modular_pack(pack)

    def test_spec_changes_do_not_override_numeric_authorities(self):
        changes=[('ground',lambda s:s['ground']['runs'][0].__setitem__(2,99),'GROUND_AUTHORITY'),
                 ('pivot',lambda s:s['objects'][0]['pivot'].__setitem__(0,99),'SOURCE_PLACEMENT'),
                 ('canvas',lambda s:s.update(nativeSize=[200,200],worldSize=[800,800]),'CANVAS_AUTHORITY'),
                 ('neighbor',lambda s:s['outputContract'].update(neighborFieldIds=['field_cm28_01']),'ONE_FIELD'),
                 ('crop',lambda s:s['outputContract'].update(sourceCropApplied=True),'ORIGIN_OR_CROP'),
                 ('origin',lambda s:s['outputContract'].update(nativeOrigin=[0,-24]),'ORIGIN_OR_CROP'),
                 ('animation',lambda s:s['objects'][0].update(sequenceFrameCount=2),'ANIMATION_NOT_IMPLEMENTED')]
        pack=self.copy_pack()
        original=(pack/'spec.json').read_text(encoding='utf8')
        for label,change,error in changes:
            with self.subTest(label=label):
                (pack/'spec.json').write_text(original,encoding='utf8')
                self.spec_change(pack,change)
                with self.assertRaisesRegex(ValueError,error): proof.compose_modular_pack(pack)

    def test_approval_hash_and_path_escape_rejected(self):
        pack=self.copy_pack()
        original=(pack/'modular-manifest.json').read_text(encoding='utf8')
        changes=[(lambda m:m.update(humanApproved=True),'APPROVAL'),
                 (lambda m:m.update(runtimeEligible=True),'APPROVAL'),
                 (lambda m:m.update(sourceSpecSha256='0'*64),'SPEC_HASH'),
                 (lambda m:m['core'].update(sha256='0'*64),'IMAGE_HASH'),
                 (lambda m:m['core'].update(src='../escape.png'),'OUTSIDE_PACK')]
        for change,error in changes:
            with self.subTest(error=error):
                (pack/'modular-manifest.json').write_text(original,encoding='utf8')
                self.manifest(pack,change)
                with self.assertRaisesRegex(ValueError,error): proof.compose_modular_pack(pack)

    def test_missing_and_unbound_files_never_fall_back_to_reference(self):
        pack=self.copy_pack()
        obj=pack/'object-cells/obj-000.png'
        obj.rename(pack/'object-cells/unbound.png')
        with self.assertRaisesRegex(ValueError,'EXTRA_OR_MISSING'): proof.compose_modular_pack(pack)

    def test_image_dimension_mode_and_empty_alpha_rejected(self):
        pack=self.copy_pack()
        for image,error in [(Image.new('RGBA',(767,800),(1,2,3,255)),'DIMENSION'),
                            (Image.new('RGB',(768,800)),'RGBA_REQUIRED'),
                            (Image.new('RGBA',(768,800)),'EMPTY_IMAGE')]:
            with self.subTest(error=error):
                image.save(pack/'base.png'); image.close()
                self.manifest(pack,lambda m:m['core'].update(sha256=proof.digest(pack/'base.png')))
                with self.assertRaisesRegex(ValueError,error): proof.compose_modular_pack(pack)

    def test_cache_reuses_outputs_but_rejects_changed_or_corrupt_inputs(self):
        pack=self.copy_pack(); output=pack/'previews'
        first=proof.build_modular_pack(pack,output)
        self.assertEqual(len(first['legalPlacementChecks']),22)
        self.assertFalse(first['cacheHit'])
        mtime=(output/'composite-hd4x.png').stat().st_mtime_ns
        self.assertTrue(proof.build_modular_pack(pack,output)['cacheHit'])
        self.assertEqual(mtime,(output/'composite-hd4x.png').stat().st_mtime_ns)
        obj=pack/'object-cells/obj-000.png'
        with Image.open(obj) as original: changed=original.copy()
        pixel=next((x,y) for y in range(changed.height) for x in range(changed.width) if changed.getpixel((x,y))[3]>200)
        changed.putpixel(pixel,(255,0,255,255)); changed.save(obj); changed.close()
        with self.assertRaisesRegex(ValueError,'IMAGE_HASH'): proof.build_modular_pack(pack,output)
        self.manifest(pack,lambda m:m['objects'][0].update(sha256=proof.digest(obj)))
        updated=proof.build_modular_pack(pack,output)
        self.assertFalse(updated['cacheHit'])
        self.assertNotEqual(first['cacheKey'],updated['cacheKey'])
        self.assertNotEqual(first['outputs']['composite-hd4x.png'],updated['outputs']['composite-hd4x.png'])
        (output/'composite-hd4x.png').write_bytes(b'corrupt output')
        self.assertFalse(proof.build_modular_pack(pack,output)['cacheHit'])

    def test_waiting_room_plans_have_no_spurious_objects(self):
        report=proof.build_modular_pack(WAITING,self.root/'waiting-preview')
        self.assertEqual(report['objectCount'],0)
        self.assertEqual(len(report['legalPlacementChecks']),4)
        self.assertTrue(all(p['cropTopPx']==96 for p in report['legalPlacementChecks']))

    def test_walkable_transparent_hole_is_a_hard_failure_not_cached_success(self):
        pack=self.copy_pack(WAITING); spec=proof.read(pack/'spec.json')
        index=0
        for count,owned,terrain,_ in spec['ground']['runs']:
            if owned and terrain!=1: break
            index+=count
        x=(index%spec['ground']['width'])*32; y=(index//spec['ground']['width'])*32
        with Image.open(pack/'base.png') as original: changed=original.copy()
        changed.paste((0,0,0,0),(x,y,x+32,y+32)); changed.save(pack/'base.png'); changed.close()
        self.manifest(pack,lambda m:m['core'].update(sha256=proof.digest(pack/'base.png')))
        for _ in range(2):
            with self.assertRaisesRegex(ValueError,'GROUND_COVERAGE_FAILED'):
                proof.build_modular_pack(pack,pack/'previews')
        report=proof.read(pack/'previews/modular-proof.json')
        self.assertEqual(report['status'],'GROUND_COVERAGE_FAILED')
        self.assertEqual(report['groundCoverage']['fullyTransparentWalkablePixels'],1024)

    def test_wrong_definition_and_empty_placement_plans_rejected(self):
        for plan,error in [({'fieldId':'field_cm01_01','scenarios':[]},'DEFINITION_BINDING'),
                           ({'fieldId':'field_cm02_01','scenarios':[]},'NO_LEGAL_PLACEMENTS')]:
            with self.subTest(error=error),patch.object(proof.subprocess,'check_output',return_value=proof.dump(plan)):
                with self.assertRaisesRegex(ValueError,error): proof.build_modular_pack(SPORTS,self.root/'bad')

    def test_crop_outside_source_and_wrap_gaps_rejected(self):
        for x,y,width,error in [(1,96,767,'WRAP_GAP_OR_OVERLAP'),(0,801,768,'CROP_OUTSIDE_SOURCE')]:
            plan={'fieldId':'field_cm02_01','scenarios':[{'id':'bad','wrapWidthPx':2688,'heightPx':704,
                  'fragments':[{'fieldId':'field_cm02_01','x':0,'y':0,
                                'sourceRect':{'x':x,'y':y,'width':width,'height':704}}]}]}
            with self.subTest(error=error),patch.object(proof.subprocess,'check_output',return_value=proof.dump(plan)):
                with self.assertRaisesRegex(ValueError,error): proof.build_modular_pack(SPORTS,self.root/'bad')

    def refinement(self):
        generated=self.root/'generated.png'
        Image.new('RGB',(768,800),(20,120,240)).save(generated)
        receipt=self.root/'receipt.json'
        receipt.write_text(proof.dump({'fieldId':'field_cm02_01','part':'core',
            'sourceCoreSha256':proof.digest(SPORTS/'base.png'),'outputSha256':proof.digest(generated),
            'reviewStatus':'SYNTHETIC_TEST_NOT_ART','runtimeEligible':False,'humanApproved':False}),encoding='utf8')
        return generated,receipt

    def test_refinement_keeps_exact_alpha_objects_and_original_pack(self):
        generated,receipt=self.refinement(); variant=self.root/'variant'
        original_hash=proof.digest(SPORTS/'modular-manifest.json')
        result=proof.stage_modular_core_variant(SPORTS,generated,receipt,variant)
        self.assertEqual(result['status'],'ASSEMBLY_PASS_ART_REVIEW_REQUIRED')
        with Image.open(SPORTS/'base.png') as a, Image.open(variant/'base.png') as b:
            self.assertEqual(a.getchannel('A').tobytes(),b.getchannel('A').tobytes())
        for obj in (SPORTS/'object-cells').glob('*.png'):
            self.assertEqual(proof.digest(obj),proof.digest(variant/'object-cells'/obj.name))
        self.assertEqual(original_hash,proof.digest(SPORTS/'modular-manifest.json'))
        (variant/'generation-receipt.json').write_text('{}',encoding='utf8')
        with self.assertRaisesRegex(ValueError,'RECEIPT_HASH'): proof.compose_modular_pack(variant)
        with self.assertRaisesRegex(ValueError,'DESTINATION_EXISTS'):
            proof.stage_modular_core_variant(SPORTS,generated,receipt,variant)

    def test_refinement_wrong_size_and_receipt_fail_before_creating_pack(self):
        generated,receipt=self.refinement(); variant=self.root/'variant'
        Image.new('RGB',(760,800)).save(generated)
        with self.assertRaisesRegex(ValueError,'HASH_DRIFT'):
            proof.stage_modular_core_variant(SPORTS,generated,receipt,variant)
        data=proof.read(receipt); data['outputSha256']=proof.digest(generated)
        receipt.write_text(proof.dump(data),encoding='utf8')
        with self.assertRaisesRegex(ValueError,'DIMENSION_DRIFT'):
            proof.stage_modular_core_variant(SPORTS,generated,receipt,variant)
        self.assertFalse(variant.exists())


if __name__=='__main__':
    unittest.main()
