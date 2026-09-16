"""Structural/negative cases for the export seam; no new art is published."""
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

if __name__=='__main__': unittest.main()
