import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
loader=importlib.util.spec_from_file_location('stage_status',ROOT/'scripts/cage-production-status.py')
status=importlib.util.module_from_spec(loader);loader.loader.exec_module(status)
PACK=status.WORK/'seam-v3/fields/field_cm29_01'


class StageOneTests(unittest.TestCase):
    def test_three_stages_cover_exactly_the_retained_inventory(self):
        fields=status.proof.read(status.WORK/'catalog.json')['fields']
        self.assertEqual(len({f['id'] for f in fields}),37)
        self.assertEqual([sum(status.phase(f)==i for f in fields) for i in (1,2,3)],[5,14,18])
        research=next(f for f in fields if f['id']=='field_cm06_01')
        self.assertEqual(len(research['frames']),1)
        self.assertEqual(status.phase(research),3)

    def test_lid_is_not_a_facility_and_never_authors_walkability(self):
        manifest,spec,image=status.proof.compose_modular_pack(PACK)
        self.assertEqual(spec['role'],'STRUCTURAL_LID')
        self.assertEqual(spec['objects'],[])
        self.assertTrue(all(not run[1] for run in spec['ground']['runs']))
        self.assertEqual(image.size,(384,448))
        counts=image.getchannel('A').histogram()
        self.assertGreater(counts[255],image.width*image.height*.45)
        self.assertGreater(counts[0],image.width*image.height*.08)
        self.assertFalse(manifest['runtimeEligible']);image.close()

    def test_all_lid_instances_include_crop_and_wrapped_fragments(self):
        plans=json.loads(subprocess.check_output(['node','scripts/lib/cage-authoring-geometry.mjs','--definition','36'],cwd=ROOT))
        self.assertEqual(plans['fieldId'],'field_cm29_01')
        self.assertEqual({s['unlockedCount'] for s in plans['scenarios']},{14,16,18,20})
        fragments=[p for s in plans['scenarios'] for p in s['fragments']]
        self.assertEqual({p['sourceRect']['y'] for p in fragments},{0,96})
        self.assertTrue(any('fragmentOfSlot' in p for p in fragments))
        self.assertTrue(all(p['structuralRole']=='LID' and p['moduleId'] is None for p in fragments))

    def test_starting_review_uses_no_legacy_neighbor_frames(self):
        report=status.proof.read(status.WORK/'seam-v3/review/seam-report.json')
        self.assertTrue(status.FIRST.issubset(report['candidateFields']))
        for fid in status.FIRST:self.assertEqual(report['sources'][fid]['role'],'ORIGINAL_CANDIDATE')

    def test_adjacent_lid_rows_have_no_transparent_crack(self):
        with Image.open(PACK/'previews/composite-hd4x.png') as source:
            lid=source.convert('RGBA')
        joined=Image.new('RGBA',(576,704))
        joined.alpha_composite(lid.crop((0,96,384,448)),(0,0))
        joined.alpha_composite(lid,(192,256))
        for step in range(8,184):
            x=384-step;y=256+step/2
            for offset in (-1,0,1):
                self.assertGreaterEqual(joined.getpixel((x,round(y)+offset))[3],250)
        joined.close();lid.close()


if __name__=='__main__':unittest.main()
