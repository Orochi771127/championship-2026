"""Per-character motion preflight. Offline; reuses the audited Nitro decoder.

No generation, no model dependency, no source pixels in the product repository.
Reviews bind to exact source/contract/design hashes and cover every canonical cell.
"""
import argparse
import importlib.util
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('donor_preflight',ROOT/'scripts/prepare-character-production.py')
P=importlib.util.module_from_spec(spec);spec.loader.exec_module(P)
BASE=P.PACK/'donor-review-v1'
REQUIRED=('morphology','locomotion','faceAndExpression','appendages','restraint','specialStates','contactAndOrigin')

def prepare(entity):
    folder=P.PACK/'generated/entities'/entity
    P.require(folder.is_dir() and folder.parent==P.PACK/'generated/entities','UNKNOWN_ENTITY')
    archive=ROOT.parent/'YDIJ_PRIVATE_ROM_ART_PACK'
    evidence=P.read(folder/'source-evidence.json');P.verify_lock(archive,evidence['files'])
    contract=P.read(folder/'motion-contract.json');audit=P.read(folder/'origin-audit.json')
    roster_root=archive/'02_CHARACTERS/use-ready-pixi-hd4x-224'
    entity_row=next(r for r in P.read(roster_root/'manifest.json')['entities'] if r['entityId']==entity)
    summary,fresh=P.SOURCE.audit_entity(archive,roster_root,entity_row,audit['summary']['structure'])
    P.verify_motion(contract,fresh['motion-contract.json'])
    P.require(summary['sourcePixelMismatchCount']==0,'SOURCE_DECODE_DRIFT')
    slots={};groups={};images={}
    for side in ('main','sub'):
        bank_name=f'{entity}_{side}'
        doc=P.read(archive/'08_FULL_FAMILY_CONVERSION/digimon'/bank_name/'cells.json')
        bank=P.SOURCE.native_bank(archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/digimon',bank_name,doc)
        for cell in doc['cells']:
            key=f"{side}/cell_{cell['cellIndex']:03d}"
            im,_=P.SOURCE.render_native(cell,bank);box=im.getbbox();b=cell['bounds']
            bounds=[b['minX'],b['minY'],b['maxXExclusive'],b['maxYExclusive']]
            crop=im.crop(box) if box else Image.new('RGBA',(1,1))
            digest=P.sha(P.encoded(list(crop.size))+crop.tobytes())
            canonical=groups.setdefault(digest,key)
            visible=[bounds[0]+box[0],bounds[1]+box[1],bounds[0]+box[2],bounds[1]+box[3]] if box else bounds
            slots[key]={'canonical':canonical,'nativeBounds':bounds,'visibleBounds':visible,'blank':box is None,'sourceRgbaSha256':digest}
            images[key]=im
    union,origin=P.canvas_origin([r['nativeBounds'] for r in slots.values()])
    for row in slots.values():
        parent=slots[row['canonical']]['visibleBounds'];v=row['visibleBounds']
        row['translation']=[v[0]-parent[0],v[1]-parent[1]]
    species_doc=ROOT/'src/data/championship/catalogs/creature-species.r1.json'
    species=next(r for r in P.read(species_doc)['records'] if r['lookupKey']==entity)
    setting=P.PACK/'pixel-v2/settings'/entity/'setting.json'
    data={'schemaVersion':1,'entityId':entity,'sourceFiles':evidence['files'],
          'motionContractSha256':P.sha((folder/'motion-contract.json').read_bytes()),
          'speciesCatalogSha256':P.sha(species_doc.read_bytes()),'species':species,
          'designSha256':P.sha(setting.read_bytes()) if setting.exists() else None,
          'sourceOrigin':origin,'nativeBoundsUnion':union,'canvas':[64,64],'nativeScale':1,
          'slots':slots,'sequences':contract['sides'],
          'counts':{'slots':len(slots),'masters':len(groups),'sequences':sum(len(s['sequences']) for s in contract['sides'].values())},
          'prohibitions':['NO_NEW_ACTION_SEMANTICS','NO_BBOX_RECENTER','NO_PER_CELL_AUTOFIT','NO_SOURCE_PIXELS_IN_OUTPUT',
                          'NO_UNIVERSAL_BOUND_CELL_RANGE','NO_INTERPOLATED_TIMING','NO_NEW_LIMBS']}
    P.SOURCE.publish({'inventory.json':P.encoded(data)},BASE/entity,False)
    # All source images stay in a research directory outside the Git product.
    research=ROOT.parent/'_archive/character-donor-review-v1'/entity
    files={};canvases={}
    for key,row in slots.items():
        canvas=Image.new('RGBA',(64,64));canvas.alpha_composite(images[key],(origin[0]+row['nativeBounds'][0],origin[1]+row['nativeBounds'][1]));canvases[key]=canvas
    for side in ('main','sub'):
        keys=[k for k in slots if k.startswith(side+'/')];sheet=Image.new('RGBA',(8*160,((len(keys)+7)//8)*160),(233,235,238,255));draw=ImageDraw.Draw(sheet)
        for n,key in enumerate(keys):
            x=n%8*160;y=n//8*160;sheet.alpha_composite(canvases[key].resize((128,128),Image.Resampling.NEAREST),(x+16,y+8));draw.text((x+4,y+142),key,fill='black')
        files[side+'-all-cells.png']=P.PIXEL.png_bytes(sheet)
        seqs=contract['sides'][side]['sequences']
        for start in range(0,len(seqs),8):
            page=seqs[start:start+8];columns=max(len(s['frames']) for s in page)
            sheet=Image.new('RGBA',(200+columns*160,len(page)*170),(233,235,238,255));draw=ImageDraw.Draw(sheet)
            for n,s in enumerate(page):
                draw.text((5,n*170+5),f"{side} seq{s['id']}\nmode {s['playbackMode']}\nloop {s['loopStartFrame']}",fill='black')
                for f,frame in enumerate(s['frames']):
                    key=f"{side}/cell_{frame['cell']:03d}";x=200+f*160;y=n*170
                    sheet.alpha_composite(canvases[key].resize((128,128),Image.Resampling.NEAREST),(x,y))
                    draw.text((x,y+140),f"cell{frame['cell']} {frame['ticks']}ticks",fill='black')
            files[f'{side}-sequences-{start//8+1}.png']=P.PIXEL.png_bytes(sheet)
    P.SOURCE.publish(files,research,False)
    template=BASE/entity/'review.json'
    if not template.exists():
        P.SOURCE.publish({'review.json':P.encoded({'schemaVersion':1,'entityId':entity,'inventorySha256':P.sha(P.encoded(data)),
            'status':'PENDING_VISUAL_REVIEW','reviewer':None,'researchImagesReviewed':[],
            'character':{k:None for k in REQUIRED},'cellObservations':{k:None for k,r in slots.items() if k==r['canonical']},
            'unresolvedBlockingIssues':['Full donor visual review required before original design or generation'],
            'unknownActionNamesPolicy':'PRESERVE_RAW_SEQUENCE_IDS_NO_GUESSED_LABELS'})},BASE/entity,False)
    print(f'{entity}: {len(slots)} slots, {len(groups)} masters; source origin {origin}; review {template}')
    return data

def validate(entity):
    data=prepare(entity);review=P.read(BASE/entity/'review.json')
    P.require(review['entityId']==entity and review['inventorySha256']==P.sha(P.encoded(data)),'STALE_DONOR_REVIEW')
    P.require(review['status']=='PASS_DONOR_REVIEW' and review['reviewer'],'DONOR_REVIEW_REQUIRED')
    P.require(not review['unresolvedBlockingIssues'],'DONOR_REVIEW_BLOCKED')
    P.require(all(isinstance(review['character'].get(k),str) and review['character'][k].strip() for k in REQUIRED),'INCOMPLETE_CHARACTER_ANALYSIS')
    expected={k for k,r in data['slots'].items() if k==r['canonical']}
    P.require(set(review['cellObservations'])==expected,'CELL_REVIEW_COVERAGE_DRIFT')
    P.require(all(isinstance(v,str) and v.strip() for v in review['cellObservations'].values()),'CELL_REVIEW_REQUIRED')
    required={f'{s}-all-cells.png' for s in ('main','sub')}
    required|={f'{side}-sequences-{i//8+1}.png' for side,bank in data['sequences'].items() for i in range(0,len(bank['sequences']),8)}
    P.require(required<=set(review['researchImagesReviewed']),'FULL_SEQUENCE_REVIEW_REQUIRED')
    print('PASS_DONOR_REVIEW: hash-bound complete source review; not a generated-art acceptance')


def bind_design(entity):
    """Bind a later original identity lock to an already reviewed donor.

    Donor analysis deliberately happens before design.  This atomic metadata
    update makes that sequencing explicit without regenerating source evidence
    or weakening the review hash.
    """
    inventory_path=BASE/entity/'inventory.json';review_path=BASE/entity/'review.json'
    setting=P.PACK/'pixel-v2/settings'/entity/'setting.json'
    P.require(inventory_path.is_file() and review_path.is_file(),'DONOR_REVIEW_REQUIRED')
    P.require(setting.is_file(),'ORIGINAL_DESIGN_SETTING_REQUIRED')
    data=P.read(inventory_path);review=P.read(review_path)
    P.require(review['inventorySha256']==P.sha(P.encoded(data)),'STALE_DONOR_REVIEW')
    P.require(review['status']=='PASS_DONOR_REVIEW' and not review['unresolvedBlockingIssues'],'DONOR_REVIEW_NOT_PASSED')
    data['designSha256']=P.sha(setting.read_bytes())
    review['inventorySha256']=P.sha(P.encoded(data))
    for path,payload in ((inventory_path,P.encoded(data)),(review_path,P.encoded(review))):
        temporary=path.with_suffix(path.suffix+'.tmp');temporary.write_bytes(payload);temporary.replace(path)
    print('BOUND_ORIGINAL_DESIGN',entity,data['designSha256'])

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('entity');parser.add_argument('--validate',action='store_true')
    parser.add_argument('--bind-design',action='store_true');args=parser.parse_args()
    P.require(not (args.validate and args.bind_design),'ONE_ACTION_REQUIRED')
    (bind_design if args.bind_design else validate if args.validate else prepare)(args.entity)
