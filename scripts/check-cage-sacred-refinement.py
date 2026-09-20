"""Validate the first sacred/memorial refinement cell banks and placements."""
import importlib.util
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
loader=importlib.util.spec_from_file_location('fixed_review',ROOT/'scripts/check-cage-industrial-batch.py')
review=importlib.util.module_from_spec(loader);loader.loader.exec_module(review)
review.OUT=review.WORK/'opm-sacred-refinement-v1'
review.FIELDS=('field_cm13_01','field_cm14_01','field_cm24_01')
review.DEFINITIONS=(12,13,23)
review.PROVENANCE=(('producerSha256',ROOT/'scripts/build-cage-sacred-refinement.py'),
                   ('remainingFixedAuthoringSha256',ROOT/'scripts/lib/cage_remaining_fixed_authoring.py'),
                   ('scriptSha256',ROOT/'scripts/build-cage-base3d.py'))

if __name__=='__main__':review.build()
