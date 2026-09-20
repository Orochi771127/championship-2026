"""Verify cm19/cm22 with their explicit per-frame size and pivot bindings."""
import importlib.util
from pathlib import Path
from lib.cage_object_animation_contract import assert_variable_unchanged

ROOT=Path(__file__).resolve().parents[1]
loader=importlib.util.spec_from_file_location('variable_review',ROOT/'scripts/check-cage-industrial-batch.py')
review=importlib.util.module_from_spec(loader);loader.loader.exec_module(review)
review.OUT=review.WORK/'opm-variable-window-v1';review.FIELDS=('field_cm19_01','field_cm22_01');review.DEFINITIONS=(18,21)
review.CONTRACT_ASSERT=assert_variable_unchanged;review.PER_FRAME_GEOMETRY=True
review.PROVENANCE=(('producerSha256',ROOT/'scripts/build-cage-variable-window-batch.py'),
                   ('variableAuthoringSha256',ROOT/'scripts/lib/cage_variable_window_authoring.py'),
                   ('contractHelperSha256',ROOT/'scripts/lib/cage_object_animation_contract.py'),
                   ('scriptSha256',ROOT/'scripts/build-cage-base3d.py'))
if __name__=='__main__':review.build()
