"""Validate Batch B clinical, industrial and power cell banks."""
import importlib.util
from pathlib import Path
from lib.cage_object_animation_contract import assert_variable_unchanged

ROOT=Path(__file__).resolve().parents[1]
loader=importlib.util.spec_from_file_location('batch_b_review',ROOT/'scripts/check-cage-industrial-batch.py')
review=importlib.util.module_from_spec(loader);loader.loader.exec_module(review)

def run(out,fields,definitions,provenance,variable=False):
    review.OUT=review.WORK/out;review.FIELDS=fields;review.DEFINITIONS=definitions;review.PROVENANCE=provenance
    review.CONTRACT_ASSERT=assert_variable_unchanged if variable else review.assert_unchanged
    review.PER_FRAME_GEOMETRY=variable
    return review.build()

if __name__=='__main__':
    run('opm-clinical-refinement-v1',('field_cm06_01','field_cm17_01'),(5,16),
        (('producerSha256',ROOT/'scripts/build-cage-clinical-refinement.py'),('careAuthoringSha256',ROOT/'scripts/lib/cage_care_authoring.py'),('scriptSha256',ROOT/'scripts/build-cage-base3d.py')))
    run('opm-industrial-refinement-v2',('field_cm15_01','field_cm23_01'),(14,22),
        (('producerSha256',ROOT/'scripts/build-cage-industrial-refinement.py'),('industrialAuthoringSha256',ROOT/'scripts/lib/cage_industrial_authoring.py'),('scriptSha256',ROOT/'scripts/build-cage-base3d.py')))
    run('opm-power-refinement-v1',('field_cm22_01',),(21,),
        (('producerSha256',ROOT/'scripts/build-cage-power-refinement.py'),('variableAuthoringSha256',ROOT/'scripts/lib/cage_variable_window_authoring.py'),('contractHelperSha256',ROOT/'scripts/lib/cage_object_animation_contract.py'),('scriptSha256',ROOT/'scripts/build-cage-base3d.py')),True)
