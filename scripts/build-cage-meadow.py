"""Original cm08 art-only cell bank; retain unequal NANR sequences without a clock."""
import argparse
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import bpy

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from lib.cage_object_animation_contract import extract,assert_unchanged,sha

loader=importlib.util.spec_from_file_location('meadow_garden_source',ROOT/'scripts/build-cage-garden-higgsfield.py')
garden=importlib.util.module_from_spec(loader);sys.modules[loader.name]=garden;loader.loader.exec_module(garden)
d=garden.d
WORK=garden.WORK
OUT=WORK/'opm-meadow-v1'
FID='field_cm08_01'


def meadow(field,driver,cell_id):
    driver.LAYER='base'
    # Low original vegetation, with the open walking floor kept readable.
    for x,y,r in [(22,48,.33),(37,44,.42),(54,49,.36),(73,58,.30),
                  (212,131,.30),(224,140,.31)]:
        driver.foliage('low-meadow-shrub',driver.world(x,y,.20),r,80)
    for x,y in [(107,150),(147,136),(183,165),(64,91)]:
        driver.sphere('flat-meadow-pebble',driver.world(x,y,.035),(.13,.19,.04),'garden-stone')
    for x,y in [(42,75),(68,162),(83,147),(116,135),(133,156),(168,126),(210,168)]:
        for dx in (-1.2,0,1.2):
            driver.curve('short-meadow-grass',[driver.world(x,y,.01),driver.world(x+dx,y-2,.07)],.013,'garden-leaf')
    anchors=[]
    for record in field['objects']:
        driver.LAYER='decor';before=set(bpy.context.scene.objects)
        x,y,w,h=driver.placed_cell_bounds(record)
        garden.plant(x+w/2,y+h/2+2,True,cell_id,driver,name='meadow-flower')
        for obj in set(bpy.context.scene.objects)-before:
            obj['sourceObjectOrdinal']=record['order']
            obj['sourceAnchorNative']=record['placement']
            obj['objectSequenceId']=record['sequenceId']
            obj['sourceCellId']=cell_id
        anchors.append({'sourceOrdinal':record['order'],'role':'meadow-flower','anchorNative':record['placement']})
    driver.LAYER='base'
    bpy.context.scene['natureFeatures']=json.dumps(['native-hex-union','low-edge-shrubs','open-meadow','two-independent-flower-sequences'])
    return anchors


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--samples',type=int,default=16)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    args.parts=True;args.layers=False
    contract=extract(ROOT,FID)
    if [[f['cellId'] for f in o['frames']] for o in contract['objects']]!=[[0,1],[0,1,0]]:
        raise ValueError('CM08_CELL_TIMELINE_DRIFT')
    field=json.loads((WORK/'fields'/FID/'spec.json').read_text(encoding='utf8'))
    dest=OUT/'fields'/FID;dest.mkdir(parents=True,exist_ok=True)
    shutil.copy2(WORK/'fields'/FID/'spec.json',dest/'spec.json')
    (OUT/'object-animation-contract.json').write_text(json.dumps(contract,indent=2)+'\n',encoding='utf8')
    d.OUT=OUT;d.LOOK='seam-v3';d.STAGE3_BATCH1=(FID,)
    d.prepare_animated_surface=garden.prepare;d.build_animated_surface=meadow
    for cell_id in (0,1):
        d.render_field(field,args,cell_id)
        folder=OUT/'seam-v3/fields'/FID
        if cell_id:folder=folder/'animation/01'
        manifest_path=folder/'modular-manifest.json'
        m=json.loads(manifest_path.read_text())
        m['status']='ART_PROPOSAL_OFFLINE_CELL_BANK_ONLY'
        m['sourceCellId']=cell_id
        m['consumer']='Offline frame-to-cell review only; not a surface-animation timeline or runtime loader'
        m['generation'].update({'clockHz':None,'reviewMode':contract['reviewMode'],
          'producerSha256':sha(Path(__file__)),
          'reusedGardenScriptSha256':sha(ROOT/'scripts/build-cage-garden-higgsfield.py'),
          'conceptProvenance':{'reusedJobId':'ae858392-be11-42e3-b90b-d567a957a66e',
              'newGenerationCalls':0,'use':'Reuse authored geometry inspired by prior original concept, no raster texture input'}})
        manifest_path.write_text(json.dumps(m,indent=2)+'\n',encoding='utf8')
    assert_unchanged(ROOT,contract)
    print('MEADOW_CELL_BANK_EXPORTED_CLOCK_UNRESOLVED')


if __name__=='__main__':main()
