import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1'
sys.path.insert(0,str(ROOT/'scripts'))

def module(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/file)
    result=importlib.util.module_from_spec(spec); spec.loader.exec_module(result); return result

material=module('surface_normalizer','prepare-cage-material.py')
proof=module('daylight_proof','build-cage-authoring-proof.py')


class DaylightTests(unittest.TestCase):
    def test_spec_is_unchanged_not_a_neighbor_or_new_layout(self):
        old=OUT/'fields/field_cm02_01/spec.json'; new=OUT/'daylight-v2/fields/field_cm02_01/spec.json'
        self.assertEqual(old.read_bytes(),new.read_bytes())

    def test_five_objects_keep_every_placement_and_pivot(self):
        old=proof.read(OUT/'fields/field_cm02_01/modular-manifest.json')
        new=proof.read(OUT/'daylight-v2/fields/field_cm02_01/modular-manifest.json')
        self.assertEqual(len(new['objects']),5)
        for a,b in zip(old['objects'],new['objects']):
            for key in ['objectId','sourceOrdinal','sequenceId','placement','pivot','size','horizontalFlip','verticalFlip']:
                self.assertEqual(a[key],b[key])
            self.assertNotEqual(a['sha256'],b['sha256'])

    def test_composition_and_ground_remain_valid(self):
        manifest,spec,image=proof.compose_modular_pack(OUT/'daylight-v2/fields/field_cm02_01')
        self.assertEqual(image.size,(768,800)); self.assertTrue(proof.modular_ground_coverage(spec,image)['pass'])
        self.assertFalse(manifest['runtimeEligible']); self.assertFalse(manifest['humanApproved'])
        image.close()

    def test_material_is_bounded_normalized_patch_not_raw_generation(self):
        path=OUT/'daylight-v2/track-grain.png'; report=proof.read(path.with_suffix('.json'))
        self.assertEqual(proof.digest(path),report['outputSha256'])
        self.assertEqual(report['sourceCrop'],[48,48,208,208])
        with Image.open(path) as image:
            self.assertEqual(image.size,(160,160))
            self.assertEqual(image.mode,'RGB')
            self.assertTrue(all(112<=lo<=hi<=144 for lo,hi in image.getextrema()))
        manifest=proof.read(OUT/'daylight-v2/fields/field_cm02_01/modular-manifest.json')
        self.assertEqual(manifest['generation']['materialInput']['sha256'],report['outputSha256'])

    def test_normalization_repeatable_without_changing_source(self):
        source=OUT/'daylight-v2/track-albedo-dreamshaper8.png'; before=proof.digest(source)
        with tempfile.TemporaryDirectory() as tmp:
            a=Path(tmp)/'a.png'; b=Path(tmp)/'b.png'
            material.prepare(source,a,[48,48,208,208]); material.prepare(source,b,[48,48,208,208])
            self.assertEqual(a.read_bytes(),b.read_bytes())
        self.assertEqual(proof.digest(source),before)

    def test_bad_crop_and_raw_overwrite_refused(self):
        source=OUT/'daylight-v2/track-albedo-dreamshaper8.png'
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ValueError,'outside'): material.prepare(source,Path(tmp)/'a.png',[0,0,900,900])
            with self.assertRaisesRegex(ValueError,'preserve'): material.prepare(source,source,[0,0,64,64])


if __name__=='__main__': unittest.main()
