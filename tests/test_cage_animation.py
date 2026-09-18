"""Regression checks for the bounded Cage animation rebuild; no ROM required."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location("rebuild", ROOT / "scripts/rebuild-cage-animated-frames.py")
rebuild = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rebuild)


class CageAnimationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        original = rebuild.BASELINE
        self.manifest = json.loads(rebuild.MANIFEST.read_text(encoding="utf-8"))
        self.manifest["fields"] = [e for e in self.manifest["fields"] if e["fieldId"] in rebuild.ANIMATED_FIELDS]
        for entry in self.manifest["fields"]:
            field = entry["fieldId"]
            shutil.copytree(original / "fields" / field, self.base / "fields" / field)
        self.path = self.base / "manifest.json"
        self.write_manifest()
        self.cm07 = self.manifest["fields"][0]
        self.anim = self.cm07["animatedLayer"]

    def write_manifest(self):
        self.path.write_text(json.dumps(self.manifest), encoding="utf-8")

    def run_rebuild(self, check=True):
        with patch.object(rebuild, "BASELINE", self.base), patch.object(rebuild, "MANIFEST", self.path), contextlib.redirect_stdout(io.StringIO()):
            return rebuild.rebuild(check)

    def test_current_four_fields_rebuild_and_hash_check(self):
        self.assertEqual(self.run_rebuild(), 0)

    def test_duplicate_output_pixels_are_rejected(self):
        destination = self.base / self.anim["alternateCompositeFrame"]["file"]
        shutil.copyfile(self.base / self.cm07["nativeOriginal"]["file"], destination)
        self.assertEqual(self.run_rebuild(), 1)

    def test_same_pixels_reencoded_with_stale_hash_are_rejected(self):
        destination = self.base / self.anim["alternateCompositeFrame"]["file"]
        with Image.open(destination) as image:
            image.save(destination, compress_level=0)
        self.assertEqual(self.run_rebuild(), 1)

    def test_stale_manifest_hash_is_rejected(self):
        self.anim["alternateFaithfulHd4xFrame"]["sha256"] = "0" * 64
        self.write_manifest()
        self.assertEqual(self.run_rebuild(), 1)

    def test_duplicate_animation_source_is_rejected_before_any_write(self):
        # Fail on the last field, after the other three have been prepared.
        first, second = self.manifest["fields"][-1]["animatedLayer"]["layerFrames"]
        shutil.copyfile(self.base / first["file"], self.base / second["file"])
        second["sha256"] = first["sha256"]
        self.write_manifest()
        before = {p: p.read_bytes() for p in self.base.rglob("*.png")}
        with self.assertRaisesRegex(SystemExit, "NO_MOVING_PIXELS"):
            self.run_rebuild(check=False)
        self.assertTrue(all(p.read_bytes() == data for p, data in before.items()))

    def test_unverified_source_bytes_are_rejected(self):
        source = self.base / self.anim["layerFrames"][1]["file"]
        source.write_bytes(source.read_bytes() + b"changed")
        with self.assertRaisesRegex(SystemExit, "SOURCE_HASH_MISMATCH"):
            self.run_rebuild()

    def test_missing_animated_field_cannot_pass(self):
        self.manifest["fields"].pop()
        self.write_manifest()
        with self.assertRaisesRegex(SystemExit, "FIELD_SET_MISMATCH"):
            self.run_rebuild()


if __name__ == "__main__":
    unittest.main()
