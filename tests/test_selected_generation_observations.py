"""Regression guards for conflicting generation/state instructions and alpha loss."""
import importlib.util
import unittest
from pathlib import Path
from PIL import Image

spec=importlib.util.spec_from_file_location('selected_preparation',Path(__file__).resolve().parents[1]/'scripts/prepare-selected-character-sheet.py')
P=importlib.util.module_from_spec(spec);spec.loader.exec_module(P)

class GenerationObservationTests(unittest.TestCase):
    def test_state_text_cannot_be_appended_to_normal_color_request(self):
        key='main/cell_063'; review={'cellObservations':{key:'White silhouette of spread-leaf seed.'}}
        cfg={'postprocessStates':{key:'white'}}
        with self.assertRaisesRegex(ValueError,'NORMAL_COLOR_POSE_DESCRIPTION_REQUIRED'):
            P.generation_observation(cfg,review,key)
        cfg['normalColorPoseObservations']={key:'White silhouette of spread-leaf seed.'}
        with self.assertRaisesRegex(ValueError,'PALETTE_STATE_IN_GEOMETRY_DESCRIPTION'):
            P.generation_observation(cfg,review,key)
        cfg['normalColorPoseObservations'][key]='Distinct spread-leaf seed contour at the source pose position.'
        result=P.generation_observation(cfg,review,key)
        self.assertIn('opaque character interior',result)
        self.assertNotIn('silhouette',result.lower())
        self.assertEqual(review['cellObservations'][key],'White silhouette of spread-leaf seed.')

    def test_normal_pose_semantics_are_not_rewritten(self):
        observation='Side pose, hidden face, restraint around body.'
        self.assertEqual(P.generation_observation({'postprocessStates':{}},{'cellObservations':{'p':observation}},'p'),observation)

    def test_special_reference_keeps_every_alpha_pixel_and_origin(self):
        source=Image.new('RGBA',(64,64))
        source.putpixel((23,37),(255,255,255,255));source.putpixel((25,36),(240,20,10,128))
        original=source.tobytes();tile=P.geometry_guide_tile(source,True)
        self.assertEqual(tile.size,source.size)
        self.assertEqual(tile.getchannel('A').tobytes(),source.getchannel('A').tobytes())
        self.assertEqual(tile.getpixel((23,37)),(110,120,140,255))
        self.assertEqual(source.tobytes(),original)
        self.assertEqual(P.geometry_guide_tile(source,False).tobytes(),original)

if __name__=='__main__': unittest.main()
