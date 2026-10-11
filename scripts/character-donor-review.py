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

def prepare(entity, frame_packing=False, canvas_extent=64):
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
    if canvas_extent is None:
        extent=max(max(r["visibleBounds"][2]-r["visibleBounds"][0],r["visibleBounds"][3]-r["visibleBounds"][1]) for r in slots.values())
        canvas_extent=max(64,((extent+31)//32)*32)
    P.require(type(canvas_extent) is int and 64<=canvas_extent<=256 and canvas_extent%32==0,"INVALID_REVIEW_CANVAS")
    P.require(frame_packing or canvas_extent==64,"EXTENDED_CANVAS_REQUIRES_PACKING")
    if frame_packing:
        # Transparent hardware-tile padding is not character extent. An actor's
        # motion union may exceed 64 even though every individual pose fits.
        # Preserve native world coordinates with explicit packing origins; no
        # rescaling, recentering of the actor, or motion edits are involved.
        bounds=[r['visibleBounds'] for r in slots.values() if not r['blank']]
        union=[min(b[0] for b in bounds),min(b[1] for b in bounds),max(b[2] for b in bounds),max(b[3] for b in bounds)]
        origin=[(canvas_extent-union[2]+union[0])//2-union[0],(canvas_extent-union[3]+union[1])//2-union[1]]
        for row in slots.values():
            b=row['visibleBounds']
            P.require(b[2]-b[0]<=canvas_extent and b[3]-b[1]<=canvas_extent,'INDIVIDUAL_POSE_EXCEEDS_REVIEW_CANVAS')
            row['canvasOrigin']=[max(-b[0],min(origin[0],canvas_extent-b[2])),max(-b[1],min(origin[1],canvas_extent-b[3]))]
    else:
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
          'sourceOrigin':origin,'nativeBoundsUnion':union,'canvas':[canvas_extent,canvas_extent],'nativeScale':1,
          'slots':slots,'sequences':contract['sides'],
          'counts':{'slots':len(slots),'masters':len(groups),'sequences':sum(len(s['sequences']) for s in contract['sides'].values())},
          'prohibitions':['NO_NEW_ACTION_SEMANTICS','NO_BBOX_RECENTER','NO_PER_CELL_AUTOFIT','NO_SOURCE_PIXELS_IN_OUTPUT',
                          'NO_UNIVERSAL_BOUND_CELL_RANGE','NO_INTERPOLATED_TIMING','NO_NEW_LIMBS']}
    if frame_packing:
        data['packingPolicy']='EXPLICIT_PER_SLOT_ORIGIN_NATIVE_WORLD_COORDINATES_UNCHANGED'
    P.SOURCE.publish({'inventory.json':P.encoded(data)},BASE/entity,False)
    # All source images stay in a research directory outside the Git product.
    research=ROOT.parent/'_archive/character-donor-review-v1'/entity
    files={};canvases={}
    for key,row in slots.items():
        packed_origin=row.get('canvasOrigin',origin)
        canvas=Image.new('RGBA',(canvas_extent,canvas_extent));canvas.alpha_composite(images[key],(packed_origin[0]+row['nativeBounds'][0],packed_origin[1]+row['nativeBounds'][1]));canvases[key]=canvas
        P.require(sum(canvas.getchannel('A').get_flattened_data())==sum(images[key].getchannel('A').get_flattened_data()),'SOURCE_CANVAS_CLIPS_VISIBLE_PIXELS '+key)
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
