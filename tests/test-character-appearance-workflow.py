#!/usr/bin/env python3
"""Negative contract tests and optional live archive witness audit.

Run with --archive-root PATH to additionally check first packet against raw Nitro.
"""
import argparse
import io
import importlib.util
import tempfile
import unittest
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
SCRIPT = HERE / 'build-character-appearance-workflow.py'
if not SCRIPT.exists():
    SCRIPT = HERE.parent / 'scripts/build-character-appearance-workflow.py'
spec = importlib.util.spec_from_file_location('appearance_workflow', SCRIPT)
pipeline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pipeline)
ARCHIVE = None


class MotionTests(unittest.TestCase):
    def setUp(self):
        self.decoded = {'sequenceCount': 1, 'totalFrameCount': 2, 'sequences': [
            {'sequenceId': 0, 'frameCount': 2, 'loopStartFrame': 0, 'rawWordA': 65536, 'rawWordB': 2,
             'frames': [{'frameIndex': i, 'cellId': i, 'rawDurationTicks': i+3, 'rawMarker': 48879} for i in range(2)]}]}
        self.runtime = {'animations': [{'id': 0, 'playbackMode': 2,
            'playback': 'historical_label_is_ignored', 'semanticAlias': 'not_source_truth',
            'frames': [{'cell': i, 'ticks': i+3, 'texture': f'test/main/cell_{i:03d}'} for i in range(2)]}]}

    def normalize(self):
        return pipeline.normalize_sequences('test', 'main', self.runtime, self.decoded, {0, 1})

    def test_raw_ticks_preserved_without_alias_or_hz(self):
        result = self.normalize()
        self.assertEqual([f['ticks'] for f in result[0]['frames']], [3, 4])
        self.assertNotIn('semanticAlias', result[0])
        self.assertNotIn(b'60', pipeline.encoded(result))

    def test_duration_drift_rejected(self):
        self.runtime['animations'][0]['frames'][0]['ticks'] = 4
        with self.assertRaisesRegex(ValueError, 'tick drift'):
            self.normalize()

    def test_cell_reference_drift_rejected(self):
        self.runtime['animations'][0]['frames'][0]['cell'] = 1
        with self.assertRaisesRegex(ValueError, 'reference drift'):
            self.normalize()

    def test_unknown_source_cell_rejected(self):
        self.decoded['sequences'][0]['frames'][0]['cellId'] = 999
        with self.assertRaisesRegex(ValueError, 'Unknown source cell'):
            self.normalize()

    def test_unsupported_mode_rejected(self):
        self.decoded['sequences'][0]['rawWordB'] = 3
        self.runtime['animations'][0]['playbackMode'] = 3
        with self.assertRaisesRegex(ValueError, 'unsupported raw mode'):
            self.normalize()

    def test_mode_drift_rejected(self):
        self.runtime['animations'][0]['playbackMode'] = 1
        with self.assertRaisesRegex(ValueError, 'mode drift'):
            self.normalize()

    def test_loop_start_drift_rejected(self):
        self.decoded['sequences'][0]['loopStartFrame'] = 1
        with self.assertRaisesRegex(ValueError, 'Loop start drift'):
            self.normalize()

    def test_frame_order_drift_rejected(self):
        self.decoded['sequences'][0]['frames'].reverse()
        with self.assertRaisesRegex(ValueError, 'frame index drift'):
            self.normalize()

    def test_signed_oam_coordinates(self):
        self.assertEqual(pipeline.signed(511, 9), -1)
        self.assertEqual(pipeline.signed(237, 8), -19)
        self.assertEqual(pipeline.signed(255, 9), 255)


class OutputTests(unittest.TestCase):
    def test_guide_exact_signed_transform_and_clipping_rejection(self):
        native = Image.new('RGBA', (3, 4), (0, 0, 0, 0))
        native.putpixel((1, 2), (20, 30, 40, 255))
        cell = {'bounds': {'minX': -2, 'minY': -3}}
        proposal = {'sourcePixelScale': 4, 'commonSourceOrigin': [12, 16], 'logicalCanvas': [32, 32]}
        guide = pipeline.source_origin_guide(native, cell, proposal)
        self.assertEqual(guide.getchannel('A').getbbox(), (8, 12, 12, 16))
        with self.assertRaisesRegex(ValueError, 'clipped'):
            pipeline.source_origin_guide(native, cell, {**proposal, 'logicalCanvas': [9, 9]})

    def test_deterministic_utf8_lf(self):
        self.assertEqual(pipeline.encoded({'b': 2, 'a': 'pose'}), pipeline.encoded({'a': 'pose', 'b': 2}))
        self.assertNotIn(b'\r', pipeline.encoded({'a': 'pose'}))
        self.assertTrue(pipeline.encoded({}).endswith(b'\n'))

    def test_refuses_existing_changed_approval_or_generated_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'file.json').write_bytes(b'owner edit')
            with self.assertRaisesRegex(ValueError, 'DRIFT'):
                pipeline.publish({'file.json': b'new', 'other.json': b'no partial write'}, root)
            self.assertEqual((root / 'file.json').read_bytes(), b'owner edit')
            self.assertFalse((root / 'other.json').exists())

    def test_check_detects_drift_without_writes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            pipeline.publish({'a.json': b'one\n'}, root)
            pipeline.publish({'a.json': b'one\n'}, root, check=True)
            with self.assertRaisesRegex(ValueError, 'DRIFT'):
                pipeline.publish({'a.json': b'two\n'}, root, check=True)
            self.assertEqual((root / 'a.json').read_bytes(), b'one\n')

    def test_check_detects_missing_and_extra(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            with self.assertRaisesRegex(ValueError, 'MISSING'):
                pipeline.publish({'a.json': b'one'}, root, check=True)
            (root / 'unexpected.json').write_bytes(b'extra')
            with self.assertRaisesRegex(ValueError, 'UNEXPECTED'):
                pipeline.publish({}, root, check=True)

    def test_rejects_path_escape(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ValueError, 'escapes'):
                pipeline.publish({'../escape.json': b'no'}, Path(tmp))


class ArchiveWitnessTests(unittest.TestCase):
    def test_first_packet_raw_transfer_correspondence(self):
        if ARCHIVE is None:
            self.skipTest('--archive-root enables live original archive comparison')
        base = ARCHIVE / '02_CHARACTERS/use-ready-pixi-hd4x-224'
        entities = pipeline.read(base / 'manifest.json')['entities']
        selected, artifacts = [], {}
        for prefix in pipeline.PRIORITY[:4]:
            entity = next(e for e in entities if e['entityId'].startswith(prefix+'_'))
            with self.subTest(entity=entity['entityId']):
                summary, outputs = pipeline.audit_entity(ARCHIVE, base, entity, 'TEST_WITNESS')
                selected.append(summary)
                artifacts[f"entities/{entity['entityId']}/origin-audit.json"] = pipeline.encoded(outputs['origin-audit.json'])
                self.assertEqual(summary['sourcePixelMismatchCount'], 0)
                self.assertGreater(summary['generic08RendererMismatchSlots'], 0)
                self.assertEqual(summary['motionContractSha256'], pipeline.sha(pipeline.encoded(outputs['motion-contract.json'])))
                proposal = outputs['origin-audit.json']['exportProposal']
                self.assertEqual(proposal['status'], 'GEOMETRIC_PROPOSAL_NOT_APPROVED_EXPORT')
                origin = proposal['commonSourceOrigin']
                for cell in outputs['origin-audit.json']['cells']:
                    if cell['isBlank']:
                        continue
                    scale = proposal['sourcePixelScaleBySide'][cell['side']]
                    native = cell['signedSourceAlphaBounds']
                    target = cell['proposedSpriteSourceSize']
                    self.assertEqual([target['x'] - native[0]*scale, target['y'] - native[1]*scale], origin)
        artifacts['catalog.json'] = pipeline.encoded({'entities': selected})
        guides = pipeline.reference_guides(ARCHIVE, artifacts)
        self.assertEqual(len(guides)-1, sum(e['slotCount'] for e in selected))
        for path, data in guides.items():
            if path.endswith('.png'):
                self.assertEqual(Image.open(io.BytesIO(data)).mode, 'RGBA')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive-root', type=Path)
    args, rest = parser.parse_known_args()
    ARCHIVE = args.archive_root.resolve() if args.archive_root else None
    unittest.main(argv=[__file__, *rest])
