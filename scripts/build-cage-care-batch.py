"""Build cm17 hospital and cm06 laboratory as offline independent cell banks."""
import argparse
import importlib.util
import json
from pathlib import Path
import shutil
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from lib.cage_object_animation_contract import extract,assert_unchanged,sha
from lib import cage_care_authoring as care

WORK=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1'
OUT=WORK/'opm-care-lab-v1'
CONCEPT=WORK/'higgsfield-prop-families-v1/care-lab-family.png'
loader=importlib.util.spec_from_file_location('care_base3d',ROOT/'scripts/build-cage-base3d.py')
d=importlib.util.module_from_spec(loader);sys.modules[loader.name]=d;loader.loader.exec_module(d)


def relevant_cells(contract):
    return sorted({f['cellId'] for o in contract['objects'] for f in o['frames']})


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--samples',type=int,default=8)
    parser.add_argument('--field',action='append',choices=list(care.FIELDS))
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    args.parts=True;args.layers=False
    selected=tuple(args.field or care.FIELDS)
    d.OUT=OUT;d.LOOK='seam-v3';d.STAGE3_BATCH1=selected
    d.ANIMATED_SURFACES.update(care.SURFACES)
    d.prepare_animated_surface=care.prepare;d.build_animated_surface=care.build
    source_hash=sha(CONCEPT)
    for fid in selected:
        contract=extract(ROOT,fid);field=json.loads((WORK/'fields'/fid/'spec.json').read_text(encoding='utf8'))
        dest=OUT/'fields'/fid;dest.mkdir(parents=True,exist_ok=True)
        shutil.copy2(WORK/'fields'/fid/'spec.json',dest/'spec.json')
        (dest/'object-animation-contract.json').write_text(json.dumps(contract,indent=2)+'\n',encoding='utf8')
        for cell_id in relevant_cells(contract):
            d.render_field(field,args,cell_id)
            folder=OUT/'seam-v3/fields'/fid
            if cell_id:folder=folder/'animation'/f'{cell_id:02d}'
            manifest_path=folder/'modular-manifest.json';m=json.loads(manifest_path.read_text())
            m['status']='ART_PROPOSAL_OFFLINE_CELL_BANK_ONLY';m['sourceCellId']=cell_id
            m['consumer']='Offline per-sequence frame selection only; not runtime animation'
            m['generation'].update({'clockHz':None,'reviewMode':contract['reviewMode'],
                'producerSha256':sha(Path(__file__)),'careAuthoringSha256':sha(ROOT/'scripts/lib/cage_care_authoring.py'),
                'conceptReference':{'file':str(CONCEPT.relative_to(ROOT)).replace('\\','/'),'sha256':source_hash,
                    'jobId':'4b4977ff-de22-483d-9cd4-7dedc4aadd70','newGenerationCalls':0,
                    'use':'visual family guide only; raster not loaded by Blender'}})
            manifest_path.write_text(json.dumps(m,indent=2)+'\n',encoding='utf8')
        assert_unchanged(ROOT,contract)
        print('CARE_CELL_BANK_EXPORTED',fid,len(relevant_cells(contract)))
    print('CARE_BATCH_EXPORTED_CLOCK_UNRESOLVED')


if __name__=='__main__':main()
