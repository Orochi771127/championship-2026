"""Validate Batch C garden, zoo and ranch fixed-window candidates."""
import importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
loader=importlib.util.spec_from_file_location('living_review',ROOT/'scripts/check-cage-industrial-batch.py')
review=importlib.util.module_from_spec(loader);loader.loader.exec_module(review)
review.OUT=review.WORK/'opm-living-refinement-v1';review.FIELDS=('field_cm18_01','field_cm25_01','field_cm26_01');review.DEFINITIONS=(17,24,25)
review.PROVENANCE=(('producerSha256',ROOT/'scripts/build-cage-living-refinement.py'),('remainingFixedAuthoringSha256',ROOT/'scripts/lib/cage_remaining_fixed_authoring.py'),('scriptSha256',ROOT/'scripts/build-cage-base3d.py'))
if __name__=='__main__':review.build()
