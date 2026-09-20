"""Original cm32 offline two-state master. Reuses existing camera/parts producer.

No inferred timing, no runtime promotion, no ROM raster inputs. Generated images
are concept references only, NOT image planes or disguised 3D meshes.
"""
import argparse
import importlib.util
import json
import math
from pathlib import Path
import shutil
import sys

import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'scripts'))
from lib.cage_object_animation_contract import extract, assert_unchanged, sha

WORK = ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1'
OUT = WORK/'higgsfield-garden-v1'
FID = 'field_cm32_01'
loader = importlib.util.spec_from_file_location('garden_base3d', ROOT/'scripts/build-cage-base3d.py')
d = importlib.util.module_from_spec(loader)
sys.modules[loader.name] = d
loader.loader.exec_module(d)


def prepare(driver, phase):
    for name, color in [('garden-leaf', (.08,.28,.12)), ('garden-leaf-light', (.22,.45,.19)),
                        ('garden-cool', (.68,.87,.96)), ('garden-warm', (.98,.60,.08)),
                        ('garden-heart', (.41,.18,.025)), ('garden-coral', (.72,.085,.07)),
                        ('garden-bed', (.18,.105,.055)), ('garden-stone', (.53,.47,.34))]:
        if name not in driver.M: driver.material(name, color, .78)


def plant(x, y, warm, phase, driver, name='flower', scale=1.):
    # The entire clump is designed in native screen space inside a 16x16 cell.
    for i, (dx, dy, z) in enumerate([(-2.4,1.4,.25),(0,-.8,.38),(2.6,1.1,.28)]):
        swing = phase * (.55 if i != 1 else -.45) * scale
        cx, cy = x+dx*scale+swing, y+dy*scale
        root = driver.world(x+dx*scale, y+dy*scale, .055)
        driver.curve(name+'-stem', [root, driver.world(cx,cy,z*scale)], .012*scale, 'garden-leaf')
        for k in range(5):
            angle = k*math.tau/5+.32*i
            petal = driver.sphere(name+'-petal', driver.world(cx+math.cos(angle)*1.22*scale,
                                   cy+math.sin(angle)*1.1*scale,z*scale),
                                   (.084*scale,.064*scale,.022*scale),
                                   'garden-warm' if warm else 'garden-cool')
            petal.rotation_euler.z = angle
        driver.sphere(name+'-heart',driver.world(cx,cy,z*scale+.014),
                      (.047*scale,.047*scale,.019*scale),'garden-heart')
    for i in range(5):
        a = i*math.tau/5
        driver.sphere(name+'-leaf',driver.world(x+math.cos(a)*2.7*scale,y+math.sin(a)*1.7*scale,.065),
                      (.15*scale,.065*scale,.035*scale),'garden-leaf-light' if i%2 else 'garden-leaf')


def garden(field, driver, phase):
    driver.LAYER = 'base'
    # Original low oval planting bed; stays art-only and does not create collision.
    ellipse = [(48+math.cos(i*math.tau/48)*30, 51+math.sin(i*math.tau/48)*20) for i in range(48)]
    driver.slab('low-original-garden-bed',ellipse,.005,.035,'garden-bed',0)
    driver.curve('continuous-low-stone-bed-rim',[driver.world(x,y,.06) for x,y in ellipse],
                 .032,'garden-stone',True)
    for x,y in [(44,46),(49,48),(53,45)]:
        driver.sphere('small-coral-center-bloom',driver.world(x,y,.13),(.10,.10,.05),'garden-coral')
    anchors=[]
    for record in field['objects']:
        before=set(bpy.context.scene.objects)
        driver.LAYER='decor'
        # Preserve unusual source pivot (15,5), do not recenter the NCER anchor.
        x,y,w,h=driver.placed_cell_bounds(record)
        plant(x+w/2,y+h/2+2,record['sequenceId']==1,phase,driver)
        for obj in set(bpy.context.scene.objects)-before:
            obj['sourceObjectOrdinal']=record['order']
            obj['sourceAnchorNative']=record['placement']
            obj['objectSequenceId']=record['sequenceId']
            obj['manualStateIndex']=phase
        anchors.append({'sourceOrdinal':record['order'],'role':'warm-flower' if record['sequenceId'] else 'cool-flower',
                        'anchorNative':record['placement']})
    driver.LAYER='base'
    bpy.context.scene['natureFeatures']=json.dumps(['single-native-hex','low-oval-flower-bed','seven-independent-two-state-flower-clumps'])
    return anchors


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--samples',type=int,default=16)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    args.parts=True;args.layers=False
    contract=extract(ROOT,FID)
    if len(contract['objects'])!=7 or any(len(o['frames'])!=2 for o in contract['objects']):
        raise ValueError('THIS_AUTHORING_BATCH_REQUIRES_CM32_SEVEN_TWO_STATE_OBJECTS')
    source=WORK/'fields'/FID/'spec.json'
    field=json.loads(source.read_text(encoding='utf8'))
    dest=OUT/'fields'/FID;dest.mkdir(parents=True,exist_ok=True)
    shutil.copy2(source,dest/'spec.json')
    (OUT/'object-animation-contract.json').write_text(json.dumps(contract,indent=2)+'\n',encoding='utf8')
    concepts=[]
    for name in ('garden-cool-flower','garden-warm-flower'):
        job=json.loads((OUT/(name+'-job.json')).read_text())
        concepts.append({**job,'file':name+'.png','sha256':sha(OUT/(name+'.png'))})
    d.OUT=OUT;d.LOOK='seam-v3';d.STAGE3_BATCH1=(FID,)
    d.prepare_animated_surface=prepare;d.build_animated_surface=garden
    for phase in (0,1):
        d.render_field(field,args,phase)
        folder=OUT/'seam-v3/fields'/FID
        if phase:folder=folder/'animation/01'
        manifest_path=folder/'modular-manifest.json'
        m=json.loads(manifest_path.read_text())
        m['status']='ART_PROPOSAL_OFFLINE_OBJECT_STATE_ONLY'
        m['consumer']='Offline review via original composite_rendered_object_placements; NOT runtime modular loader'
        m['manualStateIndex']=phase
        m['generation']['gardenScriptSha256']=sha(Path(__file__))
        m['generation']['conceptReferences']=concepts
        m['generation']['conceptUse']='Human/agent interpretation into actual mesh geometry; images not loaded as textures'
        m['generation']['animationClockHz']=None
        m['generation']['reviewMode']=contract['reviewMode']
        manifest_path.write_text(json.dumps(m,indent=2)+'\n',encoding='utf8')
    assert_unchanged(ROOT,contract)
    print('GARDEN_TWO_STATE_ART_EXPORTED_CLOCK_UNRESOLVED')


if __name__=='__main__':main()
