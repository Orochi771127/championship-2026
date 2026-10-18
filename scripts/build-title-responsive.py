"""Reproducible display derivatives; original approved key art is never written."""
import hashlib, json, pathlib, re
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/production/title-responsive-r1'
SPECS={'arena':[480,768,941], 'logo-zh-Hant':[400,720,1080,1774],
       'blaze':[192,384,640,960,1353], 'cloud':[192,384,640,960,1254]}
def build():
    OUT.mkdir(parents=True,exist_ok=True); rows={}
    for name,widths in SPECS.items():
        source=ROOT/f'assets/production/title-morning-r1/{name}.webp'
        image=Image.open(source).convert('RGBA'); variants=[]
        for width in widths:
            height=round(image.height*width/image.width)
            scaled=image.resize((width,height),Image.Resampling.LANCZOS)
            target=OUT/f'{name}-{width}.webp'
            scaled.save(target,'WEBP',quality=92,method=6,alpha_quality=100,exact=True)
            data=target.read_bytes(); variants.append({'src':target.relative_to(ROOT).as_posix(),'width':width,'height':height,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
        rows[name]={'source':source.relative_to(ROOT).as_posix(),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'width':image.width,'height':image.height,'variants':variants}
    (OUT/'manifest.json').write_text(json.dumps({'schemaVersion':1,'assets':rows},ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    # Attribute-only declaration keeps source fallback and the existing lifetime owner.
    html=ROOT/'championship.html'; text=html.read_text(encoding='utf-8')
    text=re.sub(r' data-title-variants="[^"]*"','',text)
    for name,row in rows.items():
        source='./'+row['source']; values=','.join(f"{v['width']}:./{v['src']}" for v in row['variants'])
        text=text.replace(f'"{source}"',f'"{source}" data-title-variants="{values}"')
    html.write_text(text,encoding='utf-8',newline='\n')
    print(json.dumps({name:[(v['width'],v['bytes']) for v in row['variants']] for name,row in rows.items()}))
if __name__=='__main__': build()
