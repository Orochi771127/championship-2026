import bpy,json,re,math
from pathlib import Path
from mathutils import Vector
ROOT=Path('R:/Projects/Championship2026/ranch-fixed-art-assets-20261021');K=16/math.sqrt(2);S=math.sin(math.radians(52))
def xy(p):return [round((p.x+p.y)*K,4),round((p.x-p.y)*K*S,4)]
records={}
for folder in sorted((ROOT/'three-masters').iterdir()):
 fid=folder.name;bpy.ops.wm.open_mainfile(filepath=str(folder/'editable.blend'));sc=bpy.context.scene
 groups={};walk_surfaces=[];dg=bpy.context.evaluated_depsgraph_get()
 for o in sc.objects:
  if o.type not in ('MESH','CURVE','SURFACE') or o.hide_render:continue
  conveyor=bool(re.match(r'^factory-\d{2}-belt-',o.name))
  walk=conveyor or o.name.startswith(('shrine-podium-','shrine-landing-','shrine-stair-','shrine-carpet-','shrine-step-tread-','bridge-plank-','temple-cushion'))
  if walk:
   ev=o.evaluated_get(dg);me=ev.to_mesh();me.calc_loop_triangles()
   for triangle in me.loop_triangles:
    ps=[ev.matrix_world@me.vertices[i].co for i in triangle.vertices]
    if (ps[1]-ps[0]).cross(ps[2]-ps[0]).z>1e-7:walk_surfaces.append([[*xy(p),round(p.z,5)] for p in ps])
   ev.to_mesh_clear()
   if not conveyor:continue
  if o.name.startswith(('field_','flush-','shallow-','continuous-','ground-','cm02-lawn','cm30-lawn','coast-sea','factory-safety','factory-lane','factory-belt-guide','factory-drain')):continue
  if o.name in ['pitch-turf','rest-paving','court-apron','bb-court'] or o.name.startswith(('bb-key','bb-line')):continue
  ev=o.evaluated_get(dg);me=ev.to_mesh();pts=[o.matrix_world@v.co for v in me.vertices];ev.to_mesh_clear()
  if not pts:continue
  zmax=max(v.z for v in pts);zmin=min(v.z for v in pts)
  decorative=any(k in o.name for k in ['-tuft-','-grass-','-petal-','-bloom-','-leaf-','-cloud-','-smoke-','-flame-','-spark-'])
  if zmax<(.4 if decorative else .12):continue
  match=re.match(r'^(.*?-\d{2})-',o.name);g=match.group(1) if match else re.sub(r'(\.\d+)+$','',o.name)
  # Explicit assembly for lockers and their attached handles; tree foliage
  # is occupancy geometry but collision remains only the trunk footprint.
  if o.name.startswith('small-gym-locker'):g='small-gym-lockers'
  rec=groups.setdefault(g,{'objects':[],'projection':[],'contact':[],'contactParts':[],'projectionParts':[]})
  projected=list({tuple(xy(v)) for v in pts})
  rec['objects'].append(o.name);rec['projection']+=projected
  rec['projectionParts'].append({'object':o.name,'points':projected})
  soft_ground_cover=o.name.startswith(('meadow-short-','meadow-flower-','jungle-plant-')) or ('-flowers-' in o.name and o.name.startswith('meadow-'))
  if zmin<.75 and not soft_ground_cover and not conveyor:
   contact=list({tuple(xy(v)) for v in pts if v.z<=min(.75,zmin+.15)})
   rec['contact']+=contact
   # Assembly membership controls rigid model edits, not collision filling.
   # Separate fence posts must not become a solid convex wall across a gate.
   if len(contact)>=3:rec['contactParts'].append({'object':o.name,'points':contact})
 records[fid]={'materials':[m.name for m in bpy.data.materials if m.users],'groups':groups,'walkSurfaces':walk_surfaces}
(ROOT/'audit/model-geometry.json').write_text(json.dumps(records));result={k:{'groups':len(v['groups']),'materials':v['materials']} for k,v in records.items()}
(Path('R:/Projects/Championship2026/ranch-fixed-art-polish-20261021/assets/production/cage/three-20261021')/'walk-surfaces.json').write_text(json.dumps({k:v['walkSurfaces'] for k,v in records.items() if v['walkSurfaces']}))
