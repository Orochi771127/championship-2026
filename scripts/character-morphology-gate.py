"""Fail closed before paid preparation; IDs and geometry alone cannot approve art."""
import hashlib
import json
from pathlib import Path

CHECKS = ('family', 'bodyProportions', 'limbsAndLocomotion', 'bodyOrientation',
          'faceVisibilityAndExpression', 'contactAndOrigin', 'restraint', 'allPoseCoverage')

def validate(receipt_path, entity, concept, inventory):
    if not receipt_path:
        raise ValueError('MORPHOLOGY_COMPATIBILITY_RECEIPT_REQUIRED')
    receipt_path=Path(receipt_path).resolve()
    r=json.loads(receipt_path.read_text(encoding='utf-8-sig'))
    if r.get('status')!='PASS_MORPHOLOGY_COMPATIBILITY' or r.get('entityId')!=entity:
        raise ValueError('MORPHOLOGY_NOT_ACCEPTED')
    for key,source in (('conceptSha256',concept),('inventorySha256',inventory)):
        if r.get(key)!=hashlib.sha256(Path(source).read_bytes()).hexdigest():
            raise ValueError('MORPHOLOGY_INPUT_DRIFT_'+key)
    for key in CHECKS:
        check=r.get('checks',{}).get(key,{})
        if check.get('pass') is not True or not check.get('evidence'):
            raise ValueError('MORPHOLOGY_CHECK_REQUIRED_'+key)
    if not r.get('reviewer') or not r.get('reviewedAt'):
        raise ValueError('MORPHOLOGY_REVIEW_IDENTITY_REQUIRED')
    return {'path':str(receipt_path),'sha256':hashlib.sha256(receipt_path.read_bytes()).hexdigest()}
