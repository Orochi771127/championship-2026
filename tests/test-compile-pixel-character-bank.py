#!/usr/bin/env python3
import argparse
import copy
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from PIL import Image

HERE=Path(__file__).resolve().parent
SCRIPT=HERE/'compile-pixel-character-bank.py'
if not SCRIPT.exists():SCRIPT=HERE.parent/'scripts/compile-pixel-character-bank.py'
spec=importlib.util.spec_from_file_location('pixel_compiler',SCRIPT)
compiler=importlib.util.module_from_spec(spec);spec.loader.exec_module(compiler)
ARCHIVE=None;AUTHOR_BANK=None


def synthetic_source():
    masters={
        'main/cell_000':{'canonicalVisibleBounds':[0,0,2,2],'canonicalNcerBounds':[-1,-1,3,3],'slots':['m201_agumon/main/cell_000','m201_agumon/sub/cell_000']},
        'main/cell_001':{'canonicalVisibleBounds':[0,0,2,2],'canonicalNcerBounds':[-1,-1,3,3],'slots':['m201_agumon/main/cell_001']}}
    slots={
        'm201_agumon/main/cell_000':{'side':'main','cell':0,'masterId':'main/cell_000','sourceNativeBounds':[0,0,2,2],'sourceNcerBounds':[-1,-1,3,3]},
        'm201_agumon/main/cell_001':{'side':'main','cell':1,'masterId':'main/cell_001','sourceNativeBounds':[0,0,2,2],'sourceNcerBounds':[-1,-1,3,3]},
        'm201_agumon/sub/cell_000':{'side':'sub','cell':0,'masterId':'main/cell_000','sourceNativeBounds':[3,-2,5,0],'sourceNcerBounds':[2,-3,6,1]}}
    def sequence(side,cell):return {'id':cell,'playbackMode':2,'loopStartFrame':0,'frames':[{'frameIndex':0,'cell':cell,'ticks':7,'texture':f'm201_agumon/{side}/cell_{cell:03d}'}]}
    return {'entityId':'m201_agumon','masters':masters,'slots':slots,'sides':{'main':{'sequences':[sequence('main',0),sequence('main',1)]},'sub':{'sequences':[sequence('sub',0)]}}}


def synthetic_bank():
    return {'schemaVersion':2,'entityId':'m201_agumon','designVersion':'synthetic-qa-only',
        'palette':['#00000000','#FFFFFF','#000000'],'patches':{},
        'masters':{'main/cell_000':{'nativeBounds':[0,0,2,2],'pixels':[[1,0],[0,2]]}}}


class CompilerTests(unittest.TestCase):
    def setUp(self):self.source=synthetic_source();self.bank=synthetic_bank()
    def compile(self):return compiler.compile_bank(self.source,self.bank)
    def test_partial_coverage_and_missing_never_filled(self):
        result=self.compile();coverage=result['qa']['coverage']
        self.assertEqual((coverage['authoredMasters'],coverage['authoredSlots']),(1,2))
        self.assertEqual(coverage['missingMasterIds'],['main/cell_001'])
        self.assertFalse(coverage['runtimeEligible'])
        missing=result['preview']['slots']['m201_agumon/main/cell_001']
        self.assertEqual(missing['status'],'UNAUTHORED');self.assertIsNone(missing['rgbaImage'])
        self.assertNotIn('slots/main/cell_001.png',result['files'])
    def test_native_png_indexed_and_transparent(self):
        result=self.compile();png=Image.open(io.BytesIO(result['files']['masters/main/cell_000.png']))
        self.assertEqual(png.mode,'P');self.assertEqual(png.info['transparency'],0)
        self.assertEqual(png.size,(2,2));self.assertEqual(list(png.get_flattened_data()),[1,0,0,2])
    def test_each_reused_slot_keeps_own_source_origin(self):
        result=self.compile();slots=result['preview']['slots']
        main=slots['m201_agumon/main/cell_000'];sub=slots['m201_agumon/sub/cell_000']
        self.assertEqual(main['nativeBounds'],[0,0,2,2]);self.assertEqual(sub['nativeBounds'],[3,-2,5,0])
        self.assertEqual(sub['logicalAlphaBounds'][0]-main['logicalAlphaBounds'][0],36)
        self.assertEqual(sub['logicalAlphaBounds'][1]-main['logicalAlphaBounds'][1],-24)
        self.assertEqual(Image.open(io.BytesIO(result['files'][sub['rgbaImage']])).size,(464,368))
    def test_full_ncer_padding_supported(self):
        self.bank['masters']['main/cell_000']={'nativeBounds':[-1,-1,3,3],'pixels':[[0,0,0,0],[0,1,0,0],[0,0,2,0],[0,0,0,0]]}
        self.assertEqual(self.compile()['preview']['masters']['main/cell_000']['nativeBounds'],[-1,-1,3,3])
    def test_palette_limit_and_transparency_rules(self):
        self.bank['palette']=['#00000000']+['#FFFFFF']*16
        with self.assertRaisesRegex(ValueError,'15 opaque'):self.compile()
        self.bank['palette']=['#00000000','#FFFFFF00']
        with self.assertRaisesRegex(ValueError,'Only palette index zero'):self.compile()
    def test_bad_grids_rejected(self):
        for grid in [[[1],[1,2]],[[1,99],[1,2]],[[True,1],[1,2]]]:
            self.bank['masters']['main/cell_000']['pixels']=grid
            with self.assertRaises(ValueError):self.compile()
    def test_alias_cycle_and_missing_copy_rejected(self):
        self.bank['masters']={mid:{'nativeBounds':[0,0,2,2],'copyFrom':other} for mid,other in [('main/cell_000','main/cell_001'),('main/cell_001','main/cell_000')]}
        with self.assertRaisesRegex(ValueError,'Alias cycle'):self.compile()
        del self.bank['masters']['main/cell_001']
        with self.assertRaisesRegex(ValueError,'missing authored'):self.compile()
    def test_patch_position_and_unknown_ref_rejected(self):
        self.bank['patches']={'dot':{'pixels':[[2]]}}
        self.bank['masters']['main/cell_000']['patches']=[{'id':'dot','at':[2,0]}]
        with self.assertRaisesRegex(ValueError,'out of bounds'):self.compile()
        self.bank['masters']['main/cell_000']['patches']=[{'id':'missing','at':[0,0]}]
        with self.assertRaisesRegex(ValueError,'unknown patch'):self.compile()
    def test_patch_overwrite_requires_explicit_flag(self):
        self.bank['patches']={'dot':{'pixels':[[2]]}}
        ref={'id':'dot','at':[0,0]};self.bank['masters']['main/cell_000']['patches']=[ref]
        with self.assertRaisesRegex(ValueError,'explicit allowOverwrite'):self.compile()
        ref['allowOverwrite']=True
        self.assertEqual(self.compile()['preview']['masters']['main/cell_000']['indices'][0][0],2)
    def test_replace_zero_erases_only_explicitly(self):
        self.bank['patches']={'erase':{'pixels':[[0]]}}
        ref={'id':'erase','at':[0,0]};self.bank['masters']['main/cell_000']['patches']=[ref]
        self.assertEqual(self.compile()['preview']['masters']['main/cell_000']['indices'][0][0],1)
        ref.update(mode='replace',allowOverwrite=True)
        self.assertEqual(self.compile()['preview']['masters']['main/cell_000']['indices'][0][0],0)
    def test_explicit_new_bounds_and_clipping(self):
        master=self.bank['masters']['main/cell_000'];master['nativeBounds']=[0,-1,2,1]
        with self.assertRaisesRegex(ValueError,'boundsOverride'):self.compile()
        master['boundsOverride']={'reason':'Synthetic contour test'}
        self.assertEqual(self.compile()['qa']['poseQa'],'PENDING')
        master['nativeBounds']=[100,0,102,2]
        with self.assertRaisesRegex(ValueError,'clipped fixed canvas'):self.compile()
    def test_deterministic_snapshot_and_refusal_to_overwrite(self):
        a=self.compile();b=self.compile();self.assertEqual(a['files'],b['files'])
        with tempfile.TemporaryDirectory() as tmp:
            compiler.publish(a['files'],Path(tmp));compiler.publish(b['files'],Path(tmp),check=True)
            altered={**a['files'],'qa.json':b'changed'}
            with self.assertRaisesRegex(ValueError,'snapshot drift'):compiler.publish(altered,Path(tmp))
            self.assertEqual((Path(tmp)/'qa.json').read_bytes(),a['files']['qa.json'])
    def test_unknown_canonical_master_and_conflicting_sources(self):
        self.bank['masters']['main/cell_004']=self.bank['masters'].pop('main/cell_000')
        with self.assertRaisesRegex(ValueError,'noncanonical'):self.compile()
        self.bank=synthetic_bank();self.bank['masters']['main/cell_000']['copyFrom']='main/cell_001'
        with self.assertRaisesRegex(ValueError,'exactly one'):self.compile()


class ActualM201Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not ARCHIVE or not AUTHOR_BANK:raise unittest.SkipTest('--archive-root and --bank enable actual M201 proof')
        cls.source=compiler.load_source(ARCHIVE);cls.bank=compiler.read(AUTHOR_BANK)
        cls.base=compiler.compile_bank(cls.source,cls.bank)
    def test_source_full_counts_no_original_pixel_arrays(self):
        self.assertEqual(self.source['counts'],{'slots':83,'masters':47,'sequences':53,'oamReferences':206,'exactOamBlocks':104})
        self.assertEqual(self.source['motionContractSha256'],'0f7b37e5972f47cf56e151bfcb71fcee77f60b142266f59908baa9ac127c7c3b')
        self.assertNotIn(b'"pixels":',compiler.encoded(self.source));self.assertNotIn(b'"indices":',compiler.encoded(self.source))
        self.assertEqual(len(self.source['exactLocalPatchProofs'][0]['members']),9)
        self.assertEqual(len(self.source['paletteStateProofs']),2)
    def test_real_bank_partial_counts(self):
        coverage=self.base['qa']['coverage']
        self.assertEqual((coverage['authoredMasters'],coverage['authoredSlots'],coverage['sequencesWithAllFramesPresent']),(7,17,8))
        self.assertEqual(len(coverage['missingMasterIds']),40)
        self.assertEqual(sum(path.endswith('.png') for path in self.base['files']),24)
    def test_shared_lower_patch_edit_propagates_exact_nine_slots(self):
        changed=copy.deepcopy(self.bank);patch=changed['patches']['lower-shared-16x8']['pixels']
        old=patch[0][0];patch[0][0]=2 if old!=2 else 3
        after=compiler.compile_bank(self.source,changed)
        changed_slots={key for key,slot in self.base['preview']['slots'].items() if slot['rgbaImage'] and self.base['files'][slot['rgbaImage']]!=after['files'][slot['rgbaImage']]}
        expected={member['slot'] for member in self.source['exactLocalPatchProofs'][0]['members']}
        self.assertEqual(changed_slots,expected);self.assertEqual(len(changed_slots),9)
    def test_eye_closed_three_by_two_never_changes_lower_body(self):
        patch=self.bank['patches']['eye-closed']['pixels'];self.assertEqual((len(patch[0]),len(patch)),(3,2))
        for target,parent,top in [('main/cell_002','main/cell_000',5),('main/cell_003','main/cell_001',6)]:
            actual=self.base['preview']['masters'][target]['indices'];base=self.base['preview']['masters'][parent]['indices']
            self.assertEqual(actual[16:24],base[16:24])
            differences={(x,y) for y in range(24) for x in range(16) if actual[y][x]!=base[y][x]}
            self.assertTrue(differences);self.assertTrue(all(7<=x<10 and top<=y<top+2 for x,y in differences))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--archive-root',type=Path);parser.add_argument('--bank',type=Path)
    args,rest=parser.parse_known_args();ARCHIVE=args.archive_root;AUTHOR_BANK=args.bank
    unittest.main(argv=[__file__,*rest])
