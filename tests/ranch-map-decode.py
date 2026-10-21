"""Read-only CI checkout geometry evidence. Requires numpy and DracoPy==2.2.0.
No renderer or asset rewriting. Run from repository root, or set --repo.
"""
import argparse,collections,hashlib,json,shutil,struct
from pathlib import Path
import DracoPy
import numpy as np
PINNED_BASE_COMMIT='4f64421314f0d0f5d0c04b916d30e821587c1a6a'
ALLOWED={'field_cm02_01': {'path': 'assets/production/cage/three-20261021/field_cm02_01.glb', 'bytes': 1220556, 'sha256': '801927f108317f8d575c2816dd96d4e64788bd707b752345f77ee48b16e8197e'}, 'field_cm12_01': {'path': 'assets/production/cage/three-20261021/field_cm12_01.glb', 'bytes': 1085472, 'sha256': '3df63e095c3dabf9e91f81aff8b4eea61c7993af1a32ef3c347d7c52bfe21f3b'}, 'field_cm18_01': {'path': 'assets/production/cage/three-20261021/field_cm18_01.glb', 'bytes': 1164384, 'sha256': '2b2d24f33f405cc6ac501c6667cdcf603fa9b02a84522afbc30d47678e59bae7'}}
def require(condition,message):
 if not condition:raise ValueError(message)
def pinned_path(repo,relative):
 path=(repo/relative).resolve();require(path.is_relative_to(repo.resolve()),'ASSET_PATH_ESCAPES_CHECKOUT');return path

def parse_glb(b,fid):
 require(len(b)>=28,f'{fid}: GLB_TOO_SHORT')
 magic,version,total=struct.unpack_from('<4sII',b,0);require(magic==b'glTF' and version==2 and total==len(b),f'{fid}: GLB_HEADER_INVALID')
 length,kind=struct.unpack_from('<I4s',b,12);require(kind==b'JSON' and length%4==0 and 20+length+8<=len(b),f'{fid}: GLB_JSON_CHUNK_INVALID')
 binLength,binKind=struct.unpack_from('<I4s',b,20+length);require(binKind==b'BIN\x00' and binLength%4==0 and 28+length+binLength==len(b),f'{fid}: GLB_BIN_CHUNK_INVALID')
 j=json.loads(b[20:20+length]);binary=b[28+length:];require(j.get('asset',{}).get('version')=='2.0',f'{fid}: GLTF_VERSION_INVALID')
 require(len(j.get('buffers',[]))==1 and 'uri' not in j['buffers'][0] and j['buffers'][0]['byteLength']<=binLength and binLength-j['buffers'][0]['byteLength']<=3,f'{fid}: GLTF_BUFFER_INVALID')
 for view in j.get('bufferViews',[]):
  offset=view.get('byteOffset',0);size=view.get('byteLength');require(view.get('buffer',0)==0 and isinstance(offset,int) and isinstance(size,int) and offset>=0 and size>=0 and offset+size<=j['buffers'][0]['byteLength'],f'{fid}: GLTF_BUFFER_VIEW_INVALID')
 return j,binary

ap=argparse.ArgumentParser();ap.add_argument('--repo',default='.');ap.add_argument('--out',default='artifacts/map-glb-decode');ap.add_argument('--fields',nargs='+',choices=sorted(ALLOWED),default=['field_cm02_01','field_cm12_01','field_cm18_01']);args=ap.parse_args();repo=Path(args.repo);out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
require(len(args.fields)==len(set(args.fields)),'DUPLICATE_FIELD_REQUEST')
manifest=json.loads(pinned_path(repo,'assets/production/cage/three-20261021/manifest.json').read_text());specs={f['fieldId']:f for f in manifest['fields']};rows=[]
def local_matrix(n):
 if 'matrix' in n:return np.asarray(n['matrix']).reshape(4,4).T
 x,y,z,w=n.get('rotation',[0,0,0,1]);r=np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])
 m=np.eye(4);m[:3,:3]=r@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0]);return m
for fid in args.fields:
 spec=specs[fid];expected=ALLOWED[fid]
 require(spec.get('url')==expected['path'] and spec.get('bytes')==expected['bytes'] and spec.get('sha256')==expected['sha256'],f'{fid}: PINNED_MANIFEST_MISMATCH')
 source=pinned_path(repo,expected['path']);require(source.stat().st_size==expected['bytes'],f'{fid}: PINNED_SIZE_MISMATCH');b=source.read_bytes();sha=hashlib.sha256(b).hexdigest()
 require(len(b)==expected['bytes'] and sha==expected['sha256'],f'{fid}: PINNED_HASH_MISMATCH')
 j,binary=parse_glb(b,fid)
 (out/(fid+'.metadata.json')).write_text(json.dumps(j,indent=2));alltri=[];nodeRecords=[];clusters=collections.defaultdict(lambda:{'areaWorld2':0.,'triangles':0,'minY':float('inf'),'maxY':float('-inf'),'nodes':set()})
 def visit(ni,parent):
  n=j['nodes'][ni];matrix=parent@local_matrix(n)
  if 'mesh' in n:
   for pi,pr in enumerate(j['meshes'][n['mesh']]['primitives']):
    view=j['bufferViews'][pr['extensions']['KHR_draco_mesh_compression']['bufferView']];offset=view.get('byteOffset',0);decoded=DracoPy.decode(binary[offset:offset+view['byteLength']]);pts=(np.c_[decoded.points,np.ones(len(decoded.points))]@matrix.T)[:,:3];tri=pts[decoded.faces];start=sum(len(t) for t in alltri);alltri.append(tri)
    nodeRecords.append({'nodeIndex':ni,'nodeName':n.get('name'),'meshIndex':n['mesh'],'primitiveIndex':pi,'triangleStartOffset':start,'triangleCount':len(tri),'worldBounds':[pts.min(0).tolist(),pts.max(0).tolist()],'geometryIndexSha256U32LE':hashlib.sha256(np.asarray(decoded.faces,dtype='<u4').tobytes()).hexdigest(),'geometryPositionSha256F32LE':hashlib.sha256(np.asarray(decoded.points,dtype='<f4').tobytes()).hexdigest()})
    area=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)/2;flat=(np.ptp(tri[:,:,1],axis=1)<.002)&(area>1e-7)
    for t,a in zip(tri[flat],area[flat]):
     h=round(float(t[:,1].mean()),3);c=clusters[h];c['areaWorld2']+=float(a);c['triangles']+=1;c['minY']=min(c['minY'],float(t[:,1].min()));c['maxY']=max(c['maxY'],float(t[:,1].max()));c['nodes'].add(n.get('name',''))
  for child in n.get('children',[]):visit(child,matrix)
 for ni in j['scenes'][j.get('scene',0)]['nodes']:visit(ni,np.eye(4))
 np.savez_compressed(out/(fid+'.triangles.npz'),triangles=np.concatenate(alltri));shutil.copyfile(source,out/(fid+'.glb'))
 for ii,im in enumerate(j.get('images',[])):
  if 'bufferView' not in im:continue
  v=j['bufferViews'][im['bufferView']];o=v.get('byteOffset',0);ext={'image/webp':'webp','image/png':'png','image/jpeg':'jpg'}.get(im.get('mimeType'),'bin');(out/f'{fid}.image{ii}.{ext}').write_bytes(binary[o:o+v['byteLength']])
 row={'fieldId':fid,'bytes':len(b),'sha256':sha,'gitBlobSha':hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest(),'status':'DECODED_HASH_VERIFIED_NOT_VISUAL_VALIDATION','nodes':nodeRecords,'horizontalClusters':sorted([{'roundedHeightWorldY':h,**c,'nodes':sorted(c['nodes'])} for h,c in clusters.items()],key=lambda c:-c['areaWorld2'])};rows.append(row)
(out/'decode-summary.json').write_text(json.dumps({'pinnedBaseCommit':PINNED_BASE_COMMIT,'manifestFields':len(specs),'requestedFields':args.fields,'results':rows},indent=2));print(json.dumps([{'fieldId':r['fieldId'],'sha256':r['sha256'],'triangles':sum(n['triangleCount'] for n in r['nodes'])} for r in rows]))
