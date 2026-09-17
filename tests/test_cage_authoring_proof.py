"""Structural/negative cases for the baseline and complete candidate export seams."""
import copy
import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'scripts'))
spec = importlib.util.spec_from_file_location('proof', ROOT/'scripts/build-cage-authoring-proof.py')
proof = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proof)

class CageAuthoringProof(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract = proof.read(proof.CONTRACT)

    def test_native_and_hd_reference_equality(self):
        image = proof.compose(self.contract)
        for name in ['native-original.png','static-composite-native.png']:
            self.assertEqual(proof.diff_count(image,Image.open(proof.SOURCE/name)),0)
        hd=image.resize((384,448),Image.Resampling.NEAREST)
        self.assertEqual(proof.diff_count(hd,Image.open(proof.SOURCE/'faithful-hd4x.png')),0)

    def test_two_builds_are_byte_stable(self):
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            self.assertEqual(proof.build(self.contract,Path(a)),proof.build(self.contract,Path(b)))

    def test_missing_duplicate_reordered_and_wrong_binding_refused(self):
        for change in ['missing','duplicate','order','binding','pivot','placement','geometry','source']:
            with self.subTest(change=change):
                value=copy.deepcopy(self.contract)
                if change=='missing': value['objects'].pop()
                elif change=='duplicate': value['objects'].append(value['objects'][0])
                elif change=='order': value['objects'].reverse()
                elif change=='binding': value['objects'][0]['cellId']=0
                elif change=='pivot': value['objects'][0]['pivot'][0]+=1
                elif change=='placement': value['objects'][0]['placement'][1]+=1
                elif change=='geometry': value['geometry']['shapeMask']=5
                else: value['sourceLocks'][next(iter(value['sourceLocks']))]='0'*64
                with self.assertRaisesRegex(ValueError,'DRIFT'): proof.compose(value)

    def test_export_dimensions_unknown_id_empty_and_new_overflow_refused(self):
        o=self.contract['objects'][0]; im=Image.open(ROOT/o['sourceImage']).convert('RGBA')
        outside=im.copy(); outside.putpixel((0,0),(255,0,0,255))
        cases=[({o['objectId']: im.resize((im.width+1,im.height))},'DIMENSION'),
            ({'unknown':im},'UNKNOWN'),({o['objectId']:Image.new('RGBA',im.size)},'EMPTY')]
        # Use a pixel demonstrably outside the stored safe alpha rectangle.
        allowed=o['safeAlphaBounds']
        if allowed[0]>0 or allowed[1]>0: cases.append(({o['objectId']:outside},'ALPHA'))
        else:
            narrow=copy.deepcopy(self.contract); narrow['objects'][0]['safeAlphaBounds']=[1,1,im.width-1,im.height-1]
            with self.assertRaisesRegex(ValueError,'ALPHA'): proof.load_export(narrow,{o['objectId']:outside})
        for exports,error in cases:
            with self.subTest(error=error),self.assertRaisesRegex(ValueError,error): proof.compose(self.contract,exports)

    def test_palette_only_replacement_keeps_alpha_and_placement(self):
        exports={}
        for o in self.contract['objects']:
            old=Image.open(ROOT/o['sourceImage']).convert('RGBA')
            new=Image.new('RGBA',old.size,(160,90,210,0));new.putalpha(old.getchannel('A'));exports[o['objectId']]=new
        old=proof.compose(self.contract);new=proof.compose(self.contract,exports)
        self.assertEqual(old.getchannel('A').tobytes(),new.getchannel('A').tobytes())
        self.assertGreater(proof.diff_count(old,new),0)

    def test_padding_with_explicit_pivot_preserves_pixels_without_magic_offsets(self):
        base=Image.new('RGBA',(30,30));cell=Image.new('RGBA',(7,9),(255,0,0,255))
        for horizontal in [False,True]:
            for vertical in [False,True]:
                original={'image':cell,'placement':[12,14],'pivot':[2,6],'horizontalFlip':horizontal,'verticalFlip':vertical}
                padded=Image.new('RGBA',(15,19));padded.alpha_composite(cell,(3,4))
                exported={**original,'image':padded,'pivot':[5,10]}
                self.assertEqual(proof.diff_count(proof.composite_rendered_object_placements(base,[original]),
                    proof.composite_rendered_object_placements(base,[exported])),0)

    def test_fractional_coordinates_refused(self):
        with self.assertRaisesRegex(ValueError,'INTEGER'):
            proof.composite_rendered_object_placements(Image.new('RGBA',(8,8)),[
                {'image':Image.new('RGBA',(1,1)),'placement':[1.5,2],'pivot':[0,0]}])

    def test_complete_candidate_package_loads_without_geometry_drift(self):
        candidate=ROOT/'docs/art/production/original-character-cage-r1/cage-field-cm01-breeze-meadow-v1'
        image=proof.compose_candidate(self.contract,candidate)
        self.assertEqual(image.size,(96,112))
        self.assertEqual(image.mode,'RGBA')
        self.assertGreater(image.getchannel('A').getbbox()[2],0)

    def test_incomplete_candidate_never_falls_back_to_reference_objects(self):
        source=ROOT/'docs/art/production/original-character-cage-r1/cage-field-cm01-breeze-meadow-v1'
        with tempfile.TemporaryDirectory() as folder:
            candidate=Path(folder)
            (candidate/'object-cells').mkdir()
            (candidate/'manifest.json').write_bytes((source/'manifest.json').read_bytes())
            (candidate/'core-native.png').write_bytes((source/'core-native.png').read_bytes())
            for relative in ['source/core-generated.png','prompts/core.prompt.txt']:
                target=candidate/relative; target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes((source/relative).read_bytes())
            for object_id in ['obj-000','obj-001','obj-002','obj-003']:
                for relative in [f'source/{object_id}-generated.png',f'prompts/{object_id}.prompt.txt']:
                    target=candidate/relative; target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes((source/relative).read_bytes())
            for object_id in ['obj-000','obj-001','obj-002']:
                (candidate/'object-cells'/f'{object_id}.png').write_bytes((source/'object-cells'/f'{object_id}.png').read_bytes())
            with self.assertRaisesRegex(ValueError,'OBJECT_EXPORT_SET_INCOMPLETE'):
                proof.compose_candidate(self.contract,candidate)

    def test_candidate_source_hash_drift_is_refused(self):
        source=ROOT/'docs/art/production/original-character-cage-r1/cage-field-cm01-breeze-meadow-v1'
        with tempfile.TemporaryDirectory() as folder:
            candidate=Path(folder)
            for relative in ['manifest.json','prompts/core.prompt.txt',
                *[f'prompts/obj-{index:03d}.prompt.txt' for index in range(4)],
                *[f'source/obj-{index:03d}-generated.png' for index in range(4)]]:
                target=candidate/relative; target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes((source/relative).read_bytes())
            target=candidate/'source/core-generated.png'; target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes((source/'source/core-generated.png').read_bytes()+b'changed')
            with self.assertRaisesRegex(ValueError,'CANDIDATE_SOURCE_HASH_MISMATCH'):
                proof.candidate_manifest(self.contract,candidate)

if __name__=='__main__': unittest.main()
