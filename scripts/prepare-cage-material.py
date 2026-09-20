"""Deterministic crop/normalization of an original generated SURFACE, never cage art."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageOps


def prepare(source,output,crop,application='34-percent luminance mix with procedural noise; mirrored shader coordinates'):
    source,output=Path(source),Path(output)
    if source.resolve()==output.resolve():
        raise ValueError('Material normalization must preserve the raw generation')
    with Image.open(source) as image:
        x0,y0,x1,y1=crop
        if not (0<=x0<x1<=image.width and 0<=y0<y1<=image.height):
            raise ValueError('Material crop outside source')
        patch=image.crop(crop).convert('L')
        # Remove generated illumination bias while limiting fine-grain amplitude.
        # No invented geometry, texture upscaling or neural transformation.
        patch=ImageOps.autocontrast(patch,cutoff=1)
        patch=patch.point([112+round(value*32/255) for value in range(256)]).convert('RGB')
        output.parent.mkdir(parents=True,exist_ok=True)
        patch.save(output,optimize=True)
        size=list(patch.size)
    sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
    report={'status':'NORMALIZED_SURFACE_PATCH_NOT_FIELD_ART','sourceFile':source.name,
            'sourceSha256':sha(source),'outputFile':output.name,'outputSha256':sha(output),
            'sourceCrop':list(crop),'outputSize':size,'upscaled':False,
            'normalization':'Luminance; 1-percent autocontrast; remap to [112,144]',
            'application':application,
            'fieldGeometryAuthority':False,'humanApproved':False,'runtimeEligible':False,
            'limits':['Selected patch must be visually reviewed for generated markings',
                      'Mirrored shader continuity is not proof the raw source tiles seamlessly']}
    output.with_suffix('.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path); parser.add_argument('output',type=Path)
    parser.add_argument('--crop',type=int,nargs=4,required=True)
    parser.add_argument('--application',default='34-percent luminance mix with procedural noise; mirrored shader coordinates')
    args=parser.parse_args()
    print(json.dumps(prepare(args.source,args.output,args.crop,args.application),indent=2))
