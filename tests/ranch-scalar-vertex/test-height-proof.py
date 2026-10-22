import copy,importlib.util,math
from pathlib import Path
s=importlib.util.spec_from_file_location('proof',Path(__file__).with_name('height-translation-proof.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
a={'height':0,'nativeFrame':{'cell':4},'nativeZ':8,'nativeXY':[268,156],'nativeScreenPixels':3,'cameraProjection':[1],'cameraInverse':[2],'cssHeight':844,'contactEllipses':[{'x':0,'y':1,'radiusX':3,'radiusY':1}],'rootScreen':[195,520],'shadowScreenCenters':[[195,523]],'parts':[]}
for role in ['lower','upper']:a['parts'].append({'role':role,'attributes':{'position':'exactbytes','uv':'exactbytes'},'indexState':'exactindices','map':{'imageSha':'pinned'},'indices':[0,2,1,2,3,1],'vertices':[{'local':[x,y,0],'uv':[x+.5,y+.5],'ndc':[x,y,0]} for x,y in [(-.5,-.5),(.5,-.5),(-.5,.5),(.5,.5)]]})
b=copy.deepcopy(a);h=.09465029835700989;b['height']=h;delta=-h*16*math.cos(math.radians(52))*3;b['rootScreen'][1]+=delta;b['shadowScreenCenters'][0][1]+=delta
for p in b['parts']:
 for v in p['vertices']:v['ndc'][1]+=-2*delta/844
m.prove_height_translation(a,b,0,h)
mutations=[lambda q:q.update(height=0),lambda q:q.update(nativeZ=0),lambda q:q.update(nativeScreenPixels=2.1),lambda q:q['rootScreen'].__setitem__(0,196),lambda q:q['shadowScreenCenters'][0].__setitem__(1,523),lambda q:q['parts'][0]['vertices'][0]['uv'].__setitem__(0,.1),lambda q:q['parts'][1]['attributes'].update(position='changed'),lambda q:q['parts'][1]['map'].update(imageSha='other')]
for change in mutations:
 q=copy.deepcopy(b);change(q)
 try:m.prove_height_translation(a,q,0,h)
 except AssertionError:pass
 else:raise AssertionError('Mutation wrongly accepted')
print('9 height/pose/UV/shadow proof cases PASS (synthetic numerical tests only)')
