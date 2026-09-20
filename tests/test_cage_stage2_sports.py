import importlib.util
import json
from pathlib import Path
import sys
import unittest
from PIL import Image, ImageChops

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from lib.cage_authoring_coordinates import placed_cell_bounds, partition_segment
loader=importlib.util.spec_from_file_location('sports_qa',ROOT/'scripts/check-cage-stage2.py')
qa=importlib.util.module_from_spec(loader);loader.loader.exec_module(qa)


class CageSportsCoordinates(unittest.TestCase):
    def test_flip_adjusts_pivot_not_source_authority(self):
        for horizontal in (False,True):
            for vertical in (False,True):
                record={'placement':[101,74],'pivot':[27,27],'size':[32,48],
                        'horizontalFlip':horizontal,'verticalFlip':vertical}
                original=json.dumps(record,sort_keys=True)
                self.assertEqual(placed_cell_bounds(record),[101-(5 if horizontal else 27),74-(21 if vertical else 27),32,48])
                self.assertEqual(json.dumps(record,sort_keys=True),original)

    def test_rope_partition_preserves_full_path_including_unowned_bridges(self):
        record={'placement':[0,0],'pivot':[0,0],'size':[10,10],
                'horizontalFlip':False,'verticalFlip':False}
        parts=partition_segment((-5,5),(15,5),[(2,record)],margin=1)
        self.assertEqual([p['owner'] for p in parts],[None,2,None])
        self.assertEqual(parts[0]['a'],[-5,5]);self.assertEqual(parts[-1]['b'],[15,5])
        self.assertAlmostEqual(sum(p['t1']-p['t0'] for p in parts),1)
        for a,b in zip(parts,parts[1:]):self.assertEqual(a['b'],b['a'])

    def test_rope_window_priority_does_not_duplicate_overlapping_geometry(self):
        record={'placement':[0,0],'pivot':[0,0],'size':[10,10],
                'horizontalFlip':False,'verticalFlip':False}
        parts=partition_segment((2,5),(8,5),[(9,record),(10,record)])
        self.assertEqual(len(parts),1);self.assertEqual(parts[0]['owner'],9)


class CageSportsArtifacts(unittest.TestCase):
    def test_specs_cells_and_ground_are_unchanged(self):
        for fid,count in zip(qa.BATCH2_FIELDS,(6,3,12)):
            pack=qa.WORK/'fields'/fid
            self.assertEqual((pack/'spec.json').read_bytes(),(qa.seams.WORK/'fields'/fid/'spec.json').read_bytes())
            manifest,spec,image=qa.seams.proof.compose_modular_pack(pack)
            self.assertEqual(len(manifest['objects']),count)
            self.assertEqual(image.size,tuple(spec['worldSize']))
            self.assertTrue(qa.seams.proof.modular_ground_coverage(spec,image)['pass'])
            self.assertEqual(manifest['generation']['originalRasterInputs'],[])
            self.assertFalse(manifest['humanApproved']);self.assertFalse(manifest['runtimeEligible'])
            render=json.loads((pack/'render-report.json').read_text(encoding='utf8'))
            if fid!='field_cm27_01':self.assertIsNone(render['ringRopePartition'])
            image.close()

    def test_flipped_exports_roundtrip_to_placed_render_exactly(self):
        pack=qa.WORK/'fields/field_cm27_01'
        manifest=json.loads((pack/'modular-manifest.json').read_text(encoding='utf8'))
        flipped=[o for o in manifest['objects'] if o['horizontalFlip'] or o['verticalFlip']]
        self.assertEqual(len(flipped),5)
        for obj in flipped:
            with self.subTest(ordinal=obj['sourceOrdinal']):
                with Image.open(pack/obj['src']) as im:cell=im.convert('RGBA')
                if obj['horizontalFlip']:cell=cell.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                if obj['verticalFlip']:cell=cell.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
                with Image.open(pack/'placed-object-cells'/Path(obj['src']).name) as witness:
                    self.assertEqual(cell.tobytes(),witness.convert('RGBA').tobytes())
                cell.close()

    def test_legal_neighbor_assemblies_have_no_internal_holes(self):
        report=json.loads((qa.WORK/'review/stage2-batch2/report.json').read_text(encoding='utf8'))
        self.assertEqual(report['status'],'PASS')
        self.assertEqual(len(report['scenarios']),76)
        self.assertTrue(all(r['alphaHoles']==0 for r in report['scenarios']))
        self.assertEqual({r['fieldId'] for r in report['scenarios']},set(qa.BATCH2_FIELDS))
        self.assertTrue(report['ringRopeJoinReview']['pass'])
        self.assertGreater(report['ringRopeJoinReview']['sampleCount'],20)
        for fid in qa.BATCH2_FIELDS:
            self.assertEqual(report['sources'][fid]['sha256'],qa.seams.sha(qa.WORK/'fields'/fid/'previews/composite-hd4x.png'))

    def test_exported_ring_rope_chains_are_continuous(self):
        report=json.loads((qa.WORK/'fields/field_cm27_01/render-report.json').read_text(encoding='utf8'))
        chains=report['ringRopePartition']
        self.assertEqual(len(chains),12)
        owners=set()
        for chain in chains:
            parts=chain['pieces']
            self.assertEqual(parts[0]['t0'],0);self.assertEqual(parts[-1]['t1'],1)
            self.assertAlmostEqual(sum(p['t1']-p['t0'] for p in parts),1)
            for a,b in zip(parts,parts[1:]):self.assertEqual(a['b'],b['a'])
            owners.update(p['owner'] for p in parts if p['owner'] is not None)
        self.assertTrue({1,2,3,4,7,8}.issubset(owners))


if __name__=='__main__':unittest.main()
