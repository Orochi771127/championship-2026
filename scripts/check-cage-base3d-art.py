"""Read-only raster/registration checks; report explicitly does not approve art."""
import json
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1'


def main():
    checks=[]
    for name in ['waiting-sports-lookdev.png','waiting-sports-base.png',
                 'waiting-sports-decor-shadow.png','waiting-sports-refined-candidate.png']:
        path=OUT/name
        if not path.exists():
            checks.append({'file':name,'exists':False,'rasterContractPass':False})
            continue
        with Image.open(path) as image:
            alpha=image.getchannel('A') if image.mode=='RGBA' else None
            extrema=alpha.getextrema() if alpha is not None else None
            histogram=alpha.histogram() if alpha is not None else []
            edges=[]
            if alpha is not None:
                # Opaque edge contact can indicate clipped foliage; it is not proof of clipping.
                edges=[max(alpha.crop(box).getextrema()) for box in
                       [(0,0,image.width,1),(0,image.height-1,image.width,image.height),
                        (0,0,1,image.height),(image.width-1,0,image.width,image.height)]]
            checks.append({'file':name,'exists':True,'size':list(image.size),'mode':image.mode,
                           'alphaExtrema':extrema,'transparentPixels':histogram[0] if histogram else 0,
                           'edgeAlphaMaxTopBottomLeftRight':edges,
                           'rasterContractPass':image.size==(1640,980) and extrema==(0,255)})
    report={'status':'NOT_RUNTIME_APPROVED','expectedSize':[1640,980],'checks':checks,
            'runtimeEligible':False,'visualAcceptance':False,
            'note':'Matching dimensions/alpha is necessary but does not prove silhouette, pivot, depth ordering or style acceptance. AI image remains a flattened paintover, not a changed Blender model.'}
    (OUT/'raster-checks.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print(json.dumps(report))


if __name__=='__main__':
    main()
