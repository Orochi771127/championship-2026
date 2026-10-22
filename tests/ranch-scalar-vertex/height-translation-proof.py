"""Numerical pose proof for intentionally changed authored support height.
Not a pixel tolerance or a substitute for own-reference/foreground GPU masks.
Input is normalized captured evidence; no guessed height or fallback authority.
"""
import math

def prove_height_translation(reference,candidate,expected_reference_height,expected_candidate_height):
 for q,h in [(reference,expected_reference_height),(candidate,expected_candidate_height)]:
  assert math.isfinite(h) and q['height']==h
  assert q['cssHeight']>0 and q['nativeScreenPixels']>0
 for key in ['nativeFrame','nativeZ','nativeXY','nativeScreenPixels','cameraProjection','cameraInverse','cssHeight','contactEllipses']:
  assert reference[key]==candidate[key],('UNCHANGED_NATIVE_POSE_OR_CONTACT_REQUIRED',key)
 delta=-(expected_candidate_height-expected_reference_height)*16*math.cos(math.radians(52))*candidate['nativeScreenPixels']
 def near(a,b):assert abs(a-b)<=1e-8,('NUMERICAL_HEIGHT_PROJECTION_MISMATCH',a,b)
 near(candidate['rootScreen'][0],reference['rootScreen'][0]);near(candidate['rootScreen'][1]-reference['rootScreen'][1],delta)
 assert len(reference['shadowScreenCenters'])==len(candidate['shadowScreenCenters'])
 for a,b in zip(reference['shadowScreenCenters'],candidate['shadowScreenCenters']):near(b[0],a[0]);near(b[1]-a[1],delta)
 assert [p['role'] for p in reference['parts']]==[p['role'] for p in candidate['parts']]==['lower','upper']
 for a,b in zip(reference['parts'],candidate['parts']):
  for key in ['attributes','indexState','map','indices']:assert a[key]==b[key],('ANATOMY_UV_DENSITY_OR_IMAGE_CHANGED',key)
  assert len(a['vertices'])==len(b['vertices'])==4
  for x,y in zip(a['vertices'],b['vertices']):
   assert x['local']==y['local'] and x['uv']==y['uv'];near(y['ndc'][0],x['ndc'][0]);near(y['ndc'][1]-x['ndc'][1],-2*delta/candidate['cssHeight'])
 return {'status':'EXACT_NATIVE_BINDINGS_AND_AUTHORED_HEIGHT_PROJECTION_PROVEN','expectedRootAndShadowDeltaCssY':delta,'numericalGeometryEpsilon':1e-8,'pixelTolerance':None,'scope':'Intentional whole-root height translation; actual masks and foreground occlusion remain independent required gates.'}
