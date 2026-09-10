#!/usr/bin/env python3
"""M201 authored indexed-pixel bank compiler. Source contributes metadata only.

load_source(archive) reads the proven raw decoder in memory and returns JSON-safe
hash/geometry/reuse/timeline evidence, never original pixel arrays. compile_bank
renders only supplied author grids and linked patches. Missing masters stay absent.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import io
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from PIL import Image

ENTITY='m201_agumon'
CANVAS={'width':464,'height':368,'origin':[184,268],'scale':12}
KEY_RE=re.compile(r'^(main|sub)/cell_\d{3}$')


def encoded(value):
    return (json.dumps(value,ensure_ascii=False,sort_keys=True,indent=2)+'\n').encode('utf-8')


def sha(payload):
    return hashlib.sha256(payload).hexdigest()


def require(condition,message):
    if not condition:
        raise ValueError(message)


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def decoder():
    root=next(p for p in Path(__file__).resolve().parents if (p/'.git').exists())
    path=root/'scripts/build-character-appearance-workflow.py'
    spec=importlib.util.spec_from_file_location('verified_character_source_decoder',path)
    module=importlib.util.module_from_spec(spec)
    previous=sys.dont_write_bytecode
    try:
        sys.dont_write_bytecode=True
        spec.loader.exec_module(module)
    finally:
        sys.dont_write_bytecode=previous
    return module,path


def load_source(archive):
    archive=Path(archive).resolve()
    dec,decoder_path=decoder()
    root=archive/'02_CHARACTERS/use-ready-pixi-hd4x-224'
    roster=read(root/'manifest.json')
    entity=next(e for e in roster['entities'] if e['entityId']==ENTITY)
    runtime_path=root/entity['runtime']
    runtime=read(runtime_path)
    source_files={runtime_path.relative_to(archive).as_posix():sha(runtime_path.read_bytes())}
    slots={};masters={};fingerprints={};sides={};rendered={};patches=defaultdict(list);transfers={}
    raw_folder=archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/digimon'
    for side in ('main','sub'):
        family=archive/'08_FULL_FAMILY_CONVERSION/digimon'/f'{ENTITY}_{side}'
        cells=read(family/'cells.json');animations=read(family/'animations.json')
        for path in [family/'cells.json',family/'animations.json',*sorted(raw_folder.glob(f'{ENTITY}_{side}.*'))]:
            source_files[path.relative_to(archive).as_posix()]=sha(path.read_bytes())
        bank=dec.native_bank(raw_folder,f'{ENTITY}_{side}',cells)
        transfers[side]={'bpp':bank['bpp'],'layout':'LINEAR_NCBR' if bank['linear'] else 'TILED_NCGR',
                         'uniqueTransferPairs':len(set(bank['transfers']))}
        sequences=dec.normalize_sequences(ENTITY,side,runtime['sides'][side],animations,{c['cellIndex'] for c in cells['cells']})
        sides[side]={'sequences':sequences}
        for cell in cells['cells']:
            short=f"{side}/cell_{cell['cellIndex']:03d}";key=f'{ENTITY}/{short}'
            image,transfer=dec.render_native(cell,bank)
            box=image.getchannel('A').getbbox()
            require(box is not None,'M201 source unexpectedly contains blank cell')
            crop=image.crop(box);bounds=cell['bounds']
            visible=[bounds['minX']+box[0],bounds['minY']+box[1],bounds['minX']+box[2],bounds['minY']+box[3]]
            fingerprint=sha(encoded(list(crop.size))+crop.tobytes())
            master_id=fingerprints.setdefault(fingerprint,short)
            native_bounds=[bounds['minX'],bounds['minY'],bounds['maxXExclusive'],bounds['maxYExclusive']]
            if master_id not in masters:
                masters[master_id]={'masterId':master_id,'canonicalSlot':key,'canonicalVisibleBounds':visible,
                    'canonicalNcerBounds':native_bounds,'sourceRgbaSha256':sha(crop.tobytes()),
                    'sourcePixelDimensions':list(crop.size),'slots':[]}
            masters[master_id]['slots'].append(key)
            slots[key]={'side':side,'cell':cell['cellIndex'],'masterId':master_id,
                'sourceNativeBounds':visible,'sourceNcerBounds':native_bounds,
                'sourceRgbaSha256':sha(crop.tobytes()),'fullNcerRgbaSha256':sha(image.tobytes()),
                'sourceTransfer':transfer,'oamCount':len(cell['oamEntries'])}
            rendered[short]=crop
            for oam in cell['oamEntries']:
                b={'minX':oam['x'],'minY':oam['y'],'maxXExclusive':oam['x']+oam['width'],'maxYExclusive':oam['y']+oam['height']}
                piece,_=dec.render_native({**cell,'bounds':b,'oamEntries':[oam]},bank)
                fp=sha(encoded(list(piece.size))+piece.tobytes())
                patches[fp].append({'slot':key,'ordinal':oam['ordinal'],'nativeBounds':[b['minX'],b['minY'],b['maxXExclusive'],b['maxYExclusive']],
                                    'rgbaSha256':sha(piece.tobytes()),'size':list(piece.size)})
    lower=next(group for group in patches.values() if any(r['slot']==f'{ENTITY}/main/cell_000' and r['ordinal']==1 for r in group))
    require(len(lower)==9 and all(p['size']==[16,8] for p in lower),'Expected nine-source lower patch proof drift')
    palette_proofs=[]
    for target in ('main/cell_044','main/cell_046'):
        original,new=rendered['main/cell_008'],rendered[target]
        require(original.size==new.size and original.getchannel('A').tobytes()==new.getchannel('A').tobytes(),'Palette proof alpha drift')
        mapping=defaultdict(set)
        for a,b in zip(original.get_flattened_data(),new.get_flattened_data()):
            if a[3]:mapping[a].add(b)
        require(all(len(values)==1 for values in mapping.values()),'Palette variant needs positional mask')
        palette_proofs.append({'source':'main/cell_008','target':target,'proof':'EXACT_SOURCE_RGBA_LOOKUP_AND_ALPHA_EQUAL',
            'lookup':{'#'+''.join(f'{v:02X}' for v in color):'#'+''.join(f'{v:02X}' for v in next(iter(values))) for color,values in mapping.items()},
            'productionDerivation':'REQUIRES_AUTHORED_NEW_PALETTE_RULE_NOT_AUTOMATIC'})
    require(len(slots)==83 and len(masters)==47,'M201 source coverage drift')
    require(sum(len(v['sequences']) for v in sides.values())==53,'M201 sequence count drift')
    motion={'schemaVersion':1,'classification':'RESEARCH_ONLY','entityId':ENTITY,
        'timingPolicy':'RAW_TICKS_ONLY_NO_ASSUMED_HZ','semanticPolicy':'RAW_SEQUENCE_IDS_ONLY',
        'sides':{s:{'frameKeys':[k for k,v in slots.items() if v['side']==s],'sequences':v['sequences']} for s,v in sides.items()}}
    return {'schemaVersion':2,'entityId':ENTITY,'classification':'RESEARCH_ONLY_METADATA_NO_PIXEL_ARRAYS',
        'counts':{'slots':83,'masters':47,'sequences':53,'oamReferences':sum(len(v) for v in patches.values()),'exactOamBlocks':len(patches)},
        'canvas':CANVAS,'slots':slots,'masters':masters,'sides':sides,'sourceFiles':source_files,
        'decoderSha256':sha(decoder_path.read_bytes()),'motionContractSha256':sha(encoded(motion)),
        'transferSummary':transfers,'exactLocalPatchProofs':[{'proofId':'source-lower-16x8-nine','members':lower,
            'anatomicalMeaning':'NONE_HARDWARE_RECTANGLE_NOT_LEG_RIG','productionReuse':'REQUIRES_EXPLICIT_AUTHOR_LINKED_PATCH'}],
        'paletteStateProofs':palette_proofs}


def parse_palette(values):
    require(isinstance(values,list) and 2<=len(values)<=16,'Palette needs transparent plus 1..15 opaque colors')
    palette=[]
    for i,value in enumerate(values):
        require(isinstance(value,str) and re.fullmatch(r'#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?',value),'Invalid palette hex')
        color=tuple(int(value[j:j+2],16) for j in range(1,len(value),2))
        if len(color)==3:color=(*color,255)
        require(color[3]==(0 if i==0 else 255),'Only palette index zero may be transparent')
        palette.append(color)
    return palette


def validate_grid(grid,palette_count,label):
    require(isinstance(grid,list) and grid and isinstance(grid[0],list) and grid[0],f'{label}: empty grid')
    width=len(grid[0])
    require(all(isinstance(row,list) and len(row)==width for row in grid),f'{label}: nonrectangular grid')
    require(all(type(v) is int and 0<=v<palette_count for row in grid for v in row),f'{label}: invalid palette index')
    return [list(row) for row in grid]


def valid_bounds(value,label):
    require(isinstance(value,list) and len(value)==4 and all(type(v) is int for v in value),f'{label}: integer bounds required')
    require(value[2]>value[0] and value[3]>value[1],f'{label}: invalid exclusive bounds')
    return value


def png_bytes(image):
    out=io.BytesIO();image.save(out,format='PNG',optimize=False);return out.getvalue()


def indexed_image(indices,palette):
    image=Image.new('P',(len(indices[0]),len(indices)))
    image.putdata([v for row in indices for v in row])
    rgb=[component for color in palette for component in color[:3]]
    image.putpalette(rgb+[0]*(768-len(rgb)))
    image.info['transparency']=0
    return image


def compile_bank(source,bank,output=None,check=False):
    require(bank.get('schemaVersion')==2,'Unsupported author bank schema')
    require(bank.get('entityId')==source['entityId']==ENTITY,'Entity identity mismatch')
    require(isinstance(bank.get('designVersion'),str) and bank['designVersion'],'Design version required')
    palette=parse_palette(bank.get('palette'))
    definitions=bank.get('masters',{});patch_definitions=bank.get('patches',{})
    require(isinstance(definitions,dict) and isinstance(patch_definitions,dict),'Masters/patches must be objects')
    require(set(definitions).issubset(source['masters']),'Unknown or noncanonical source master ID')
    require(all(isinstance(name,str) and name and isinstance(p,dict) for name,p in patch_definitions.items()),'Invalid named patch definition')
    patch_grids={name:validate_grid(p.get('pixels'),len(palette),f'patch {name}') for name,p in patch_definitions.items()}
    resolved={};visiting=set()
    def resolve(mid):
        if mid in resolved:return resolved[mid]
        require(mid not in visiting,f'Alias cycle at {mid}')
        require(mid in definitions,f'copyFrom missing authored master {mid}')
        visiting.add(mid)
        definition=definitions[mid];evidence=source['masters'][mid]
        require(isinstance(definition,dict),f'{mid}: master definition must be object')
        nb=valid_bounds(definition.get('nativeBounds'),mid)
        allowed=[evidence['canonicalVisibleBounds'],evidence['canonicalNcerBounds']]
        override=definition.get('boundsOverride')
        if nb not in allowed:
            require(isinstance(override,dict) and isinstance(override.get('reason'),str) and override['reason'].strip(),f'{mid}: changed bounds need explicit boundsOverride reason')
        has_pixels='pixels' in definition;has_copy='copyFrom' in definition
        require(has_pixels != has_copy,f'{mid}: exactly one of pixels or copyFrom required')
        inherited=[]
        if has_copy:
            require(isinstance(definition['copyFrom'],str),f'{mid}: copyFrom must name a master')
            parent=resolve(definition['copyFrom']);grid=[row[:] for row in parent['indices']];inherited=list(parent['patchRefs'])
        else:grid=validate_grid(definition['pixels'],len(palette),mid)
        require((len(grid[0]),len(grid))==(nb[2]-nb[0],nb[3]-nb[1]),f'{mid}: grid dimensions mismatch bounds')
        occupied=set();refs=[]
        placements=definition.get('patches',[])
        require(isinstance(placements,list),f'{mid}: patches must be list')
        for placement in placements:
            pid=placement.get('id');require(pid in patch_grids,f'{mid}: unknown patch {pid}')
            at=placement.get('at');require(isinstance(at,list) and len(at)==2 and all(type(v)is int for v in at),f'{mid}: invalid patch position')
            patch=patch_grids[pid];x,y=at;pw,ph=len(patch[0]),len(patch)
            require(0<=x and 0<=y and x+pw<=len(grid[0]) and y+ph<=len(grid),f'{mid}: patch out of bounds')
            mode=placement.get('mode','nonzero');require(mode in ('nonzero','replace'),f'{mid}: invalid patch mode')
            overwrite=placement.get('allowOverwrite',False);require(type(overwrite)is bool,'allowOverwrite must be boolean')
            for py,row in enumerate(patch):
                for px,value in enumerate(row):
                    if mode=='nonzero' and value==0:continue
                    point=(x+px,y+py);old=grid[y+py][x+px]
                    conflict=point in occupied or (old!=0 and old!=value)
                    require(not conflict or overwrite,f'{mid}: patch overlap/overwrite requires explicit allowOverwrite')
                    grid[y+py][x+px]=value;occupied.add(point)
            refs.append({'id':pid,'at':at,'mode':mode,'allowOverwrite':overwrite})
        require(any(v for row in grid for v in row),f'{mid}: authored master is empty')
        visiting.remove(mid)
        result={'masterId':mid,'status':'AUTHORED_QA_PENDING','nativeBounds':nb,'indices':grid,
            'patchRefs':inherited+refs,'copyFrom':definition.get('copyFrom'),'boundsOverride':override,
            'indexedImage':f'masters/{mid}.png','sourceVisibleBounds':evidence['canonicalVisibleBounds'],
            'sourceNcerBounds':evidence['canonicalNcerBounds'],'poseQa':'PENDING'}
        resolved[mid]=result;return result
    for mid in definitions:resolve(mid)
    files={};images={}
    for mid,master in resolved.items():
        image=indexed_image(master['indices'],palette);images[mid]=image.convert('RGBA')
        files[master['indexedImage']]=png_bytes(image)
    slots={};visible_count=0
    for key,evidence in source['slots'].items():
        mid=evidence['masterId'];slot={**evidence,'status':'UNAUTHORED','nativeBounds':None,'rgbaImage':None}
        if mid in resolved:
            master=resolved[mid];canonical=source['masters'][mid]['canonicalVisibleBounds'];own=evidence['sourceNativeBounds']
            dx,dy=own[0]-canonical[0],own[1]-canonical[1]
            nb=master['nativeBounds'];placed=[nb[0]+dx,nb[1]+dy,nb[2]+dx,nb[3]+dy]
            left,top=CANVAS['origin'][0]+placed[0]*12,CANVAS['origin'][1]+placed[1]*12
            width,height=(placed[2]-placed[0])*12,(placed[3]-placed[1])*12
            # Transparent NCER padding may extend outside canvas; visible authored
            # pixels may not. Compare the complete transformed alpha box.
            logical=Image.new('RGBA',(CANVAS['width'],CANVAS['height']))
            enlarged=images[mid].resize((width,height),Image.Resampling.NEAREST)
            logical.alpha_composite(enlarged,(left,top))
            alpha=images[mid].getchannel('A').getbbox()
            expected=(left+alpha[0]*12,top+alpha[1]*12,left+alpha[2]*12,top+alpha[3]*12)
            require(logical.getchannel('A').getbbox()==expected,f'{key}: authored pixels clipped fixed canvas')
            path=f"slots/{evidence['side']}/cell_{evidence['cell']:03d}.png"
            files[path]=png_bytes(logical)
            slot.update({'status':'AUTHORED','nativeBounds':placed,'rgbaImage':path,
                'sourceOriginDeltaFromCanonical':[dx,dy],'logicalAlphaBounds':list(expected)})
            visible_count+=1
        slots[key]=slot
    sequence_status=[]
    for side,content in source['sides'].items():
        for sequence in content['sequences']:
            missing=sorted({f['texture'] for f in sequence['frames'] if slots[f['texture']]['status']=='UNAUTHORED'})
            sequence_status.append({'side':side,'sequenceId':sequence['id'],'status':'ART_FRAMES_PRESENT_QA_PENDING' if not missing else 'INCOMPLETE_UNAUTHORED_FRAMES','missingSlots':missing})
    missing_masters=sorted(set(source['masters'])-set(resolved))
    coverage={'authoredMasters':len(resolved),'totalMasters':len(source['masters']),'authoredSlots':visible_count,'totalSlots':len(slots),
        'totalSequences':len(sequence_status),'sequencesWithAllFramesPresent':sum(not s['missingSlots'] for s in sequence_status),
        'missingMasterIds':missing_masters,'allArtPresent':not missing_masters,'allAnimationQa':'PENDING','runtimeEligible':False}
    preview={'schemaVersion':2,'entityId':ENTITY,'designVersion':bank['designVersion'],'palette':bank['palette'],
        'canvas':CANVAS,'masters':resolved,'slots':slots,'sides':source['sides'],'coverage':coverage,
        'patches':patch_definitions,'sequenceCoverage':sequence_status,'sourceEvidenceSha256':sha(encoded(source))}
    qa={'schemaVersion':2,'status':'TECHNICAL_COMPILE_PASS_ART_QA_PENDING','coverage':coverage,
        'paletteOpaqueColorCount':len(palette)-1,'normalPaletteLimit':15,'noOriginalPixelFallback':True,
        'onlyAuthoredMastersRendered':True,'allSlotOriginsPreserved':True,'noPerFrameFit':True,
        'sourceEvidenceSha256':sha(encoded(source)),'authorBankSha256':sha(encoded(bank)),
        'poseQa':'PENDING','visualQa':'PENDING','shippingReady':False}
    files['source-evidence.json']=encoded(source);files['preview-data.json']=encoded(preview);files['qa.json']=encoded(qa)
    files['receipt.json']=encoded({'schemaVersion':2,'entityId':ENTITY,'designVersion':bank['designVersion'],
        'coverage':coverage,'files':{p:sha(data) for p,data in sorted(files.items())}})
    if output is not None:publish(files,Path(output),check)
    return {'files':files,'preview':preview,'qa':qa}


def publish(files,output,check=False):
    output=output.resolve();issues=[]
    for relative,data in files.items():
        path=(output/relative).resolve()
        require(path.is_relative_to(output),'Output path escape')
        if path.exists() and path.read_bytes()!=data:issues.append(f'CHANGED {relative}')
        if check and not path.exists():issues.append(f'MISSING {relative}')
    if check and output.exists():issues.extend(f'UNEXPECTED {p.relative_to(output)}' for p in output.rglob('*') if p.is_file() and p.relative_to(output).as_posix() not in files)
    require(not issues,'Refusing snapshot drift: '+'; '.join(issues[:10]))
    if not check:
        for relative,data in files.items():
            path=output/relative
            if not path.exists():path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive-root',type=Path,required=True)
    parser.add_argument('--bank',type=Path)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    require(not args.output.resolve().is_relative_to(args.archive_root.resolve()),'Output must not modify source archive')
    source=load_source(args.archive_root)
    if args.bank:
        result=compile_bank(source,read(args.bank),args.output,args.check)
        print(json.dumps({'status':'CHECK_PASS' if args.check else 'COMPILED','coverage':result['qa']['coverage'],'receiptSha256':sha(result['files']['receipt.json'])}))
    else:
        publish({'source-evidence.json':encoded(source)},args.output,args.check)
        print(json.dumps({'status':'SOURCE_CHECK_PASS' if args.check else 'SOURCE_EVIDENCE','counts':source['counts'],'sha256':sha(encoded(source))}))


if __name__=='__main__':main()
