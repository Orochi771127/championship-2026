"""Build a non-runtime 37-field catalog sheet from the authoritative base candidates."""
import csv,hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1'
OUT=WORK/'review/catalog-37';OUT.mkdir(parents=True,exist_ok=True)
BATCHES={
    'opm-care-lab-v1':{'field_cm06_01','field_cm17_01'},
    'opm-industrial-v1':{'field_cm15_01','field_cm23_01'},
    'opm-remaining-fixed-v1':{'field_cm13_01','field_cm14_01','field_cm18_01','field_cm24_01','field_cm25_01','field_cm26_01'},
    'opm-variable-window-v1':{'field_cm19_01','field_cm22_01'},
    'opm-meadow-v1':{'field_cm08_01'},'higgsfield-garden-v1':{'field_cm32_01'}}

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def candidate(fid):
    for batch,fields in BATCHES.items():
        if fid in fields:return WORK/batch/'seam-v3/fields'/fid/'frame-00.png',batch
    return WORK/'seam-v3/fields'/fid/'frame-00.png','seam-v3'

def build():
    catalog=ROOT.parent/'ART_REFERENCE_LIBRARY/CATALOG_CAGES.csv';rows=[]
    with catalog.open(encoding='utf-8-sig',newline='') as handle:
        for source in csv.DictReader(handle):
            path,batch=candidate(source['fieldId'])
            if not path.exists():continue
            rows.append({'fieldId':source['fieldId'],'definitionIndex':source['cageDefinitionIndex'] or None,
                         'nameZh':source['nameZh'] or ('共用空位蓋板' if source['fieldId']=='field_cm29_01' else ''),
                         'batch':batch,'file':path.relative_to(ROOT).as_posix(),'sha256':sha(path)})
    if len(rows)!=37 or len({row['fieldId'] for row in rows})!=37:raise ValueError(f'EXPECTED_37_FIELDS_GOT_{len(rows)}')
    font_path=Path('C:/Windows/Fonts/msjh.ttc');font=ImageFont.truetype(str(font_path),22) if font_path.exists() else ImageFont.load_default()
    small=ImageFont.truetype(str(font_path),16) if font_path.exists() else ImageFont.load_default()
    cell_w,cell_h,cols=460,350,4;sheet=Image.new('RGB',(cell_w*cols,cell_h*((len(rows)+cols-1)//cols)),(14,23,31));draw=ImageDraw.Draw(sheet)
    for index,row in enumerate(rows):
        source=ROOT/row['file'];image=Image.open(source).convert('RGBA');image.thumbnail((cell_w-28,cell_h-72),Image.Resampling.LANCZOS)
        x=(index%cols)*cell_w+(cell_w-image.width)//2;y=(index//cols)*cell_h+52
        sheet.paste(image,(x,y),image);image.close()
        tx=(index%cols)*cell_w+14;ty=(index//cols)*cell_h+10
        draw.text((tx,ty),f"{row['fieldId']}  {row['nameZh']}",font=font,fill=(235,242,239))
        draw.text((tx,ty+27),row['batch'],font=small,fill=(122,190,210))
    image_path=OUT/'all-37-base-contact-sheet.jpg';sheet.save(image_path,quality=92);sheet.close()
    report={'status':'BASE_ART_CATALOG_COVERED_NOT_RUNTIME_OR_FINAL_ART','count':len(rows),'fields':rows,
            'contactSheet':image_path.name,'contactSheetSha256':sha(image_path),
            'limits':['OPM raw ticks remain unresolved for 14 fields.','Contact sheet is review-only and does not merge field authority.',
                      'No actor occlusion, mobile, final-art, publication or normal-game acceptance.']}
    (OUT/'catalog.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'status':report['status'],'count':report['count'],'contactSheet':str(image_path.relative_to(ROOT))}))
    return report
if __name__=='__main__':build()
