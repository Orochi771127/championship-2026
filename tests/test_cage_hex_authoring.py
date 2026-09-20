import copy
import importlib.util
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
loader=importlib.util.spec_from_file_location('hex_qa',ROOT/'scripts/check-cage-hex-footprints.py')
qa=importlib.util.module_from_spec(loader);loader.loader.exec_module(qa)


class HexFloorArtifacts(unittest.TestCase):
    def test_all_produced_meshes_match_the_native_union(self):
        count=0
        for pack in (qa.WORK/'fields').iterdir():
            if not (pack/'modular-manifest.json').exists():continue
            spec=qa.seams.proof.read(pack/'spec.json');manifest=qa.seams.proof.read(pack/'modular-manifest.json')
            report=qa.seams.proof.read(pack/'render-report.json')
            self.assertTrue(qa.audit(spec,manifest,report)['meshMatchesNativeUnion']);count+=1
            self.assertEqual((pack/'spec.json').read_bytes(),(qa.seams.WORK/'fields'/pack.name/'spec.json').read_bytes())
        self.assertGreaterEqual(count,19)

    def test_extra_corner_or_wrong_shape_declaration_fails(self):
        pack=qa.WORK/'fields/field_cm28_01'
        spec=qa.seams.proof.read(pack/'spec.json');manifest=qa.seams.proof.read(pack/'modular-manifest.json')
        original=qa.seams.proof.read(pack/'render-report.json')
        for change,error in [(lambda r:r['hexFloorMeshNative'][0].__setitem__(0,4),'MESH_DRIFT'),
                             (lambda r:r['hexFloorMeshNative'].append([0,0]),'MESH_DRIFT'),
                             (lambda r:r['hexFootprint'].update(shapeMask=1),'DECLARATION_DRIFT')]:
            report=copy.deepcopy(original);change(report)
            with self.assertRaisesRegex(ValueError,error):qa.audit(spec,manifest,report)


if __name__=='__main__':unittest.main()
