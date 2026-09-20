"""Build fixed-window factory and gas-room cell banks from one original family."""
import argparse,importlib.util,json,shutil,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from lib.cage_object_animation_contract import extract,assert_unchanged,sha
from lib import cage_industrial_authoring as industrial
WORK=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1';OUT=WORK/'opm-industrial-v1'
CONCEPT=WORK/'higgsfield-prop-families-v1/industrial-family.png'
loader=importlib.util.spec_from_file_location('industrial_base3d',ROOT/'scripts/build-cage-base3d.py')
d=importlib.util.module_from_spec(loader);sys.modules[loader.name]=d;loader.loader.exec_module(d)


def cells(contract):return sorted({f['cellId'] for o in contract['objects'] for f in o['frames']})


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--samples',type=int,default=8);parser.add_argument('--field',action='append',choices=list(industrial.FIELDS))
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []);args.parts=True;args.layers=False
    selected=tuple(args.field or industrial.FIELDS);d.OUT=OUT;d.LOOK='seam-v3';d.STAGE3_BATCH1=selected
    d.ANIMATED_SURFACES.update(industrial.SURFACES);d.prepare_animated_surface=industrial.prepare;d.build_animated_surface=industrial.build
    for fid in selected:
        contract=extract(ROOT,fid);field=json.loads((WORK/'fields'/fid/'spec.json').read_text())
        target=OUT/'fields'/fid;target.mkdir(parents=True,exist_ok=True);shutil.copy2(WORK/'fields'/fid/'spec.json',target/'spec.json')
        (target/'object-animation-contract.json').write_text(json.dumps(contract,indent=2)+'\n')
        for cell_id in cells(contract):
            d.render_field(field,args,cell_id);folder=OUT/'seam-v3/fields'/fid
            if cell_id:folder=folder/'animation'/f'{cell_id:02d}'
            path=folder/'modular-manifest.json';m=json.loads(path.read_text());m['status']='ART_PROPOSAL_OFFLINE_CELL_BANK_ONLY';m['sourceCellId']=cell_id
            m['consumer']='Offline per-sequence frame selection only; not runtime animation'
            m['generation'].update({'clockHz':None,'reviewMode':contract['reviewMode'],'producerSha256':sha(Path(__file__)),
                'industrialAuthoringSha256':sha(ROOT/'scripts/lib/cage_industrial_authoring.py'),
                'conceptReference':{'file':str(CONCEPT.relative_to(ROOT)).replace('\\','/'),'sha256':sha(CONCEPT),
                'jobId':'62739b46-2ebd-4e5f-9526-d1f4703ec657','newGenerationCalls':0,'use':'visual family guide only; raster not loaded by Blender'}})
            path.write_text(json.dumps(m,indent=2)+'\n')
        assert_unchanged(ROOT,contract);print('INDUSTRIAL_CELL_BANK_EXPORTED',fid,len(cells(contract)))
    print('INDUSTRIAL_BATCH_EXPORTED_CLOCK_UNRESOLVED')


if __name__=='__main__':main()
