"""Actual split mesh correspondence; numerical geometry bounds are not pixel tolerances."""
import numpy as np
from shapely.geometry import Polygon,box
from shapely.ops import unary_union

def prove_split_correspondence(reference,candidate):
 assert len(reference['parts'])==1 and reference['parts'][0]['role']=='full'
 base=reference['parts'][0];assert base['visible'];assert reference['cameraProjection']==candidate['cameraProjection'];assert reference['cameraInverse']==candidate['cameraInverse']
 assert [x['role'] for x in candidate['parts']]==['lower','upper']
 b=np.array([v['local'] for v in base['vertices']]);uv=np.array([v['uv'] for v in base['vertices']]);assert b.shape==(4,3) and np.all(b[:,2]==0)
 # Original rectangular atlas mapping is affine; fail rather than infer another mapping.
 A=np.column_stack([b[:,0],b[:,1],np.ones(4)]);coef=np.linalg.lstsq(A,uv,rcond=None)[0];assert np.max(np.abs(A@coef-uv))<1e-12
 world=np.array(base['matrixWorld']).reshape(4,4,order='F');projection=np.array(reference['cameraProjection']).reshape(4,4,order='F');inverse=np.array(reference['cameraInverse']).reshape(4,4,order='F');polys=[];maxuv=0;maxprojection=0;partareas={}
 for part in candidate['parts']:
  assert part['matrixWorld']==base['matrixWorld'] and part['map']==base['map'];vertices=part['vertices'];ids=part['indices'];assert bool(vertices)==part['visible'];assert len(ids)%3==0
  for v in vertices:
   x,y,z=v['local'];assert z==0 and -.5<=x<=.5 and -.5<=y<=.5
   expected=np.array([x,y,1])@coef;error=float(np.max(np.abs(expected-v['uv'])));maxuv=max(maxuv,error);assert error<=1.2e-7,('FLOAT32_UV_CORRESPONDENCE',error)
   w=world@np.array([x,y,z,1]);assert np.max(np.abs(w[:3]-v['world']))<=1e-11
   clip=projection@inverse@w;ndc=clip[:3]/clip[3];error=float(np.max(np.abs(ndc-v['ndc'])));maxprojection=max(maxprojection,error);assert error<=1e-11
  area=0
  for i in range(0,len(ids),3):
   assert all(type(j)==int and 0<=j<len(vertices) for j in ids[i:i+3]);p=Polygon([vertices[j]['local'][:2] for j in ids[i:i+3]]);assert p.is_valid and p.area>0;polys.append(p);area+=p.area
  partareas[part['role']]=area
 union=unary_union(polys);assert union.symmetric_difference(box(-.5,-.5,.5,.5)).area<=1e-12;assert abs(sum(p.area for p in polys)-union.area)<=1e-12
 cut=candidate['partition']['cut'];assert -.5<=cut<=.5
 for part in candidate['parts']:
  for v in part['vertices']:assert v['local'][1]>=cut-3e-8 if part['role']=='upper' else v['local'][1]<=cut+3e-8
 return {'status':'ACTUAL_PROJECTED_UNION_AND_AFFINE_UV_CORRESPONDENCE','partAreas':partareas,'unionArea':union.area,'maxFloat32UVError':maxuv,'maxProjectionArithmeticError':maxprojection,'geometryOnlyTolerance':'Float32 UV rounding<=1.2e-7;local polygon area<=1e-12;not pixel/intensity acceptance tolerance'}

def prove_fullquad_correspondence(reference,candidate,buffer_height=844):
 assert len(reference['parts'])==1 and reference['parts'][0]['role']=='full'
 assert reference['cameraProjection']==candidate['cameraProjection'] and reference['cameraInverse']==candidate['cameraInverse']
 assert [p['role'] for p in candidate['parts']]==['lower','upper'];base=reference['parts'][0];partition=candidate['partition'];assert partition['kind']=='FULL_ORIGINAL_QUADS_COMPLEMENTARY_FRAGMENT_DISCARD'
 for part in candidate['parts']:
  for key in ['matrixWorld','attributes','indexState','vertices','indices','map']:assert part[key]==base[key],('FULL_ORIGINAL_POSITION_UV_INDEX_OR_IMAGE_CHANGED',part['role'],key)
  assert part['visible'] is True # Both active: only complementary fragment selection may remove pixels.
 matrix=np.array(base['matrixWorld']).reshape(4,4,order='F');projection=np.array(reference['cameraProjection']).reshape(4,4,order='F');inverse=np.array(reference['cameraInverse']).reshape(4,4,order='F');w=np.array([matrix[0,3],partition['ceiling'],matrix[2,3],1]);clip=projection@inverse@w;expected=(clip[1]/clip[3]+1)*.5*buffer_height;assert abs(expected-partition['physicalScreenY'])<=1e-10
 assert partition['upperVertices']==partition['lowerVertices']==4
 return {'status':'EXACT_ORIGINAL_POSITION_UV_INDEX_IMAGE_BOTH_PARTS','physicalScreenY':partition['physicalScreenY'],'expectedUniformFloat32':float(np.float32(partition['physicalScreenY'])),'scope':'Full duplicated geometry uses shader complementary selection, not geometric union area; reference and knownclear exactness remain separate GPU gates.'}
