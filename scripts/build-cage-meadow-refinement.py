"""Build a denser original cm08 meadow candidate without replacing its base bank."""
import argparse,importlib.util,json,math,shutil,sys
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from lib.cage_object_animation_contract import extract,assert_unchanged,sha
loader=importlib.util.spec_from_file_location('meadow_refinement_source',ROOT/'scripts/build-cage-garden-higgsfield.py')
garden=importlib.util.module_from_spec(loader);sys.modules[loader.name]=garden;loader.loader.exec_module(garden)
d=garden.d;WORK=garden.WORK;OUT=WORK/'opm-meadow-refinement-v2';FID='field_cm08_01'

def meadow(field,driver,cell_id):
    driver.LAYER='base'
    # The open center remains playable/readable; denser edge ribbons and a
    # stepping trail give the three-hex meadow a deliberate composition.
    for x,y,r in [(22,48,.33),(37,44,.42),(54,49,.36),(73,58,.30),(212,131,.30),(224,140,.31),(196,153,.27)]:
        driver.foliage('low-meadow-shrub',driver.world(x,y,.20),r,80)
    trail=[(62,91),(84,110),(108,126),(136,139),(166,148)]
    for index,(x,y) in enumerate(trail):
        ellipse=[(x+math.cos(i*math.tau/10)*(5+index*.2),y+math.sin(i*math.tau/10)*3.2) for i in range(10)]
        driver.slab(f'meadow-step-{index}',ellipse,.006,.022,'garden-stone',.006)
    bed=[(27+math.cos(i*math.tau/20)*18,67+math.sin(i*math.tau/20)*9) for i in range(20)]
    driver.slab('meadow-edge-flower-bed',bed,.004,.022,'garden-bed',.004)
    driver.curve('meadow-bed-rim',[driver.world(x,y,.05) for x,y in bed],.025,'garden-stone',True)
    for index,(x,y) in enumerate(((18,64),(25,70),(33,64),(204,162),(216,166))):
        garden.plant(x,y,index%2==0,0,driver,name='fixed-meadow-border-flower',scale=.78)
    for x,y in [(42,75),(68,162),(83,147),(116,135),(133,156),(168,126),(210,168),(154,118),(187,157)]:
        for dx in (-1.2,0,1.2):driver.curve('short-meadow-grass',[driver.world(x,y,.01),driver.world(x+dx,y-2,.07)],.013,'garden-leaf')
    anchors=[]
    for record in field['objects']:
        driver.LAYER='decor';before=set(bpy.context.scene.objects);x,y,w,h=driver.placed_cell_bounds(record)
        garden.plant(x+w/2,y+h/2+2,True,cell_id,driver,name='meadow-flower')
        for obj in set(bpy.context.scene.objects)-before:
            obj['sourceObjectOrdinal']=record['order'];obj['sourceAnchorNative']=record['placement'];obj['objectSequenceId']=record['sequenceId'];obj['sourceCellId']=cell_id
        anchors.append({'sourceOrdinal':record['order'],'role':'meadow-flower','anchorNative':record['placement']})
    driver.LAYER='base';bpy.context.scene['natureFeatures']=json.dumps(['native-hex-union','edge-flower-bed','stepping-trail','open-meadow','two-independent-flower-sequences'])
    return anchors

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--samples',type=int,default=8);parser.add_argument('--base-only',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []);args.parts=True;args.layers=False
    contract=extract(ROOT,FID)
    if [[f['cellId'] for f in o['frames']] for o in contract['objects']]!=[[0,1],[0,1,0]]:raise ValueError('CM08_CELL_TIMELINE_DRIFT')
    field=json.loads((WORK/'fields'/FID/'spec.json').read_text(encoding='utf8'));dest=OUT/'fields'/FID;dest.mkdir(parents=True,exist_ok=True)
    shutil.copy2(WORK/'fields'/FID/'spec.json',dest/'spec.json');(OUT/'object-animation-contract.json').write_text(json.dumps(contract,indent=2)+'\n',encoding='utf8')
    d.OUT=OUT;d.LOOK='seam-v3';d.STAGE3_BATCH1=(FID,);d.prepare_animated_surface=garden.prepare;d.build_animated_surface=meadow
    for cell_id in ([0] if args.base_only else (0,1)):
        d.render_field(field,args,cell_id);folder=OUT/'seam-v3/fields'/FID
        if cell_id:folder=folder/'animation/01'
        path=folder/'modular-manifest.json';manifest=json.loads(path.read_text(encoding='utf8'))
        manifest['status']='REFINEMENT_BATCH_C_MEADOW_REVIEW_ONLY';manifest['sourceCellId']=cell_id;manifest['consumer']='Full-layout refinement review only; not runtime animation'
        manifest['generation'].update({'clockHz':None,'reviewMode':contract['reviewMode'],'producerSha256':sha(Path(__file__)),
            'reusedGardenScriptSha256':sha(ROOT/'scripts/build-cage-garden-higgsfield.py'),
            'conceptProvenance':{'reusedJobId':'ae858392-be11-42e3-b90b-d567a957a66e','newGenerationCalls':0,'use':'prior original flower concept as broad form-language only; raster not loaded by Blender'}})
        path.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
    assert_unchanged(ROOT,contract);print('MEADOW_REFINEMENT_BATCH_C_EXPORTED_CLOCK_UNRESOLVED')

if __name__=='__main__':main()
