"""Build Batch C garden/zoo/ranch candidates without replacing base art."""
import argparse,importlib.util,json,shutil,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from lib.cage_object_animation_contract import extract,assert_unchanged,sha
from lib import cage_remaining_fixed_authoring as authoring
WORK=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1';OUT=WORK/'opm-living-refinement-v1'
FIELDS=('field_cm18_01','field_cm25_01','field_cm26_01')
loader=importlib.util.spec_from_file_location('living_refinement_base3d',ROOT/'scripts/build-cage-base3d.py')
d=importlib.util.module_from_spec(loader);sys.modules[loader.name]=d;loader.loader.exec_module(d)

def cells(contract):return sorted({f['cellId'] for o in contract['objects'] for f in o['frames']})
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--samples',type=int,default=8);parser.add_argument('--field',action='append',choices=list(FIELDS));parser.add_argument('--base-only',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []);args.parts=True;args.layers=False
    selected=tuple(args.field or FIELDS);d.OUT=OUT;d.LOOK='seam-v3';d.STAGE3_BATCH1=selected
    d.ANIMATED_SURFACES.update(authoring.SURFACES);d.prepare_animated_surface=authoring.prepare;d.build_animated_surface=authoring.build
    for fid in selected:
        contract=extract(ROOT,fid);field=json.loads((WORK/'fields'/fid/'spec.json').read_text(encoding='utf8'))
        target=OUT/'fields'/fid;target.mkdir(parents=True,exist_ok=True);shutil.copy2(WORK/'fields'/fid/'spec.json',target/'spec.json')
        (target/'object-animation-contract.json').write_text(json.dumps(contract,indent=2)+'\n',encoding='utf8')
        for cell_id in ([0] if args.base_only else cells(contract)):
            d.render_field(field,args,cell_id);folder=OUT/'seam-v3/fields'/fid
            if cell_id:folder=folder/'animation'/f'{cell_id:02d}'
            path=folder/'modular-manifest.json';manifest=json.loads(path.read_text(encoding='utf8'))
            manifest['status']='REFINEMENT_BATCH_C_LIVING_REVIEW_ONLY';manifest['sourceCellId']=cell_id;manifest['consumer']='Full-layout refinement review only; not runtime animation'
            manifest['generation'].update({'clockHz':None,'reviewMode':contract['reviewMode'],'producerSha256':sha(Path(__file__)),
                'remainingFixedAuthoringSha256':sha(ROOT/'scripts/lib/cage_remaining_fixed_authoring.py'),
                'referenceUse':'Functional role and numeric OPM windows only; research rasters not uploaded, loaded, traced, sampled, or exported','newGenerationCalls':0})
            path.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
        assert_unchanged(ROOT,contract);print('LIVING_REFINEMENT_CELL_BANK_EXPORTED',fid,len(cells(contract)))
    print('LIVING_REFINEMENT_BATCH_C_EXPORTED_CLOCK_UNRESOLVED')

if __name__=='__main__':main()
