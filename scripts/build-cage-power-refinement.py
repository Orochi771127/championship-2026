"""Build the Batch B cm22 power candidate with per-frame OPM geometry."""
import argparse,copy,importlib.util,json,shutil,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from lib.cage_object_animation_contract import extract_variable,assert_variable_unchanged,sha
from lib import cage_variable_window_authoring as authoring
WORK=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1';OUT=WORK/'opm-power-refinement-v1';FIELD='field_cm22_01'
loader=importlib.util.spec_from_file_location('power_refinement_base3d',ROOT/'scripts/build-cage-base3d.py')
d=importlib.util.module_from_spec(loader);sys.modules[loader.name]=d;loader.loader.exec_module(d)

def cells(contract):return sorted({f['cellId'] for o in contract['objects'] for f in o['frames']})
def bind_geometry(field,contract,cell_id):
    bound=copy.deepcopy(field)
    for record,obj in zip(bound['objects'],contract['objects']):
        frame=next((f for f in obj['frames'] if f['cellId']==cell_id),obj['frames'][0])
        record['size']=frame['size'];record['pivot']=frame['pivot'];record['boundCellId']=frame['cellId'];record['variableFrameGeometry']=obj['variableFrameGeometry']
    return bound

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--samples',type=int,default=12);parser.add_argument('--base-only',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []);args.parts=True;args.layers=False
    d.OUT=OUT;d.LOOK='seam-v3';d.STAGE3_BATCH1=(FIELD,);d.ANIMATED_SURFACES.update(authoring.SURFACES)
    d.prepare_animated_surface=authoring.prepare;d.build_animated_surface=authoring.build
    contract=extract_variable(ROOT,FIELD);field=json.loads((WORK/'fields'/FIELD/'spec.json').read_text(encoding='utf8'))
    target=OUT/'fields'/FIELD;target.mkdir(parents=True,exist_ok=True);shutil.copy2(WORK/'fields'/FIELD/'spec.json',target/'spec.json')
    (target/'object-animation-contract.json').write_text(json.dumps(contract,indent=2)+'\n',encoding='utf8')
    for cell_id in ([0] if args.base_only else cells(contract)):
        d.render_field(bind_geometry(field,contract,cell_id),args,cell_id);folder=OUT/'seam-v3/fields'/FIELD
        if cell_id:folder=folder/'animation'/f'{cell_id:02d}'
        path=folder/'modular-manifest.json';manifest=json.loads(path.read_text(encoding='utf8'))
        manifest['status']='REFINEMENT_BATCH_B_POWER_REVIEW_ONLY';manifest['sourceCellId']=cell_id
        manifest['consumer']='Full-layout refinement review with per-frame geometry only; not runtime animation'
        manifest['generation'].update({'clockHz':None,'reviewMode':contract['reviewMode'],'perFrameGeometry':True,'producerSha256':sha(Path(__file__)),
            'variableAuthoringSha256':sha(ROOT/'scripts/lib/cage_variable_window_authoring.py'),
            'contractHelperSha256':sha(ROOT/'scripts/lib/cage_object_animation_contract.py'),
            'artDirectionInputs':['HIGGSFIELD_INDUSTRIAL_CONCEPT'],
            'referenceUse':'Original AI concept board used only as broad modular equipment direction; research rasters not uploaded, loaded, traced, sampled, or exported','newGenerationCalls':0})
        path.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
    assert_variable_unchanged(ROOT,contract);print('POWER_REFINEMENT_CELL_BANK_EXPORTED',FIELD,len(cells(contract)))
    print('POWER_REFINEMENT_BATCH_B_EXPORTED_CLOCK_UNRESOLVED')

if __name__=='__main__':main()
