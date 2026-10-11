"""Explicit pixel-art cleanup of the generated StarDrip draft, not a sheet fitter.

The per-pose edit manifest is reviewed art input. Body deformation, particle
positions and facial pixels are separate; the 64px canvas is never centered.
Only original generated pixels are resampled. Donor pixels are not input.
"""
import argparse
import importlib.util
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('selected_reuse', ROOT / 'scripts/selected-character-sheet.py')
S = importlib.util.module_from_spec(spec)
spec.loader.exec_module(S)


def components(im):
    pending = {(x, y) for y in range(im.height) for x in range(im.width) if im.getpixel((x, y))[3]}
    groups = []
    while pending:
        seed = min(pending); pending.remove(seed)
        group, queue = {seed}, [seed]
        while queue:
            x, y = queue.pop()
            for dx, dy in ((-1,0),(1,0),(0,-1),(0,1),(-1,-1),(1,1),(-1,1),(1,-1)):
                point = x+dx, y+dy
                if point in pending:
                    pending.remove(point); group.add(point); queue.append(point)
        groups.append(group)
    return sorted(groups, key=lambda g: (-len(g), min(g)))


def bounds(group):
    xs, ys = zip(*group)
    return [min(xs), min(ys), max(xs)+1, max(ys)+1]


def render(im, row, palette):
    body = components(im)[0]
    source = Image.new('RGBA', im.size)
    for point in body:
        source.putpixel(point, im.getpixel(point))
    rect = row['bodyRect']
    x, y, right, bottom = rect
    w, h = right-x, bottom-y
    # This is an explicit artist-specified pose edit, never an automatic
    # bounding-box fit in the normalizer. The submitted sheet stays immutable.
    body_image = source.crop(bounds(body)).resize((w, h), Image.Resampling.NEAREST)
    original = body_image.copy()
    dark, blue, purple, pale, white, gold, pink, cyan = palette[1:9]
    for by in range(h):
        for bx in range(w):
            color = original.getpixel((bx,by))
            interior = all(0 <= bx+dx < w and 0 <= by+dy < h and original.getpixel((bx+dx,by+dy))[3]
                           for dx,dy in ((-1,0),(1,0),(0,-1),(0,1)))
            if interior and color in (dark, gold, pink, *palette[11:]):
                body_image.putpixel((bx,by), pale if by < h//2 else white)
            if row.get('outline') and color[3] and not interior:
                body_image.putpixel((bx,by), dark)
    def paint(points, color):
        for px, py in points:
            S.P.require(0 <= px < w and 0 <= py < h and body_image.getpixel((px,py))[3], 'FACIAL_PIXEL_OUTSIDE_BODY')
            body_image.putpixel((px,py), color)
    for name, color in (('eyeSurround',white),('eye',dark),('mouth',dark),('tongue',pink),('core',gold),('shine',white)):
        paint(row.get(name, []), color)
    tile = Image.new('RGBA',(64,64)); tile.alpha_composite(body_image,(x,y))
    # Original liquid droplets are authored separately from body contact; they
    # never pull the origin or influence a body scale measurement.
    for px, py in row['droplets']:
        tile.putpixel((px,py),blue)
        tile.putpixel((px+1,py),pale)
        tile.putpixel((px,py+1),purple)
    if row.get('gray'):
        gray = tile.convert('L'); tile = Image.merge('RGBA',(gray,gray,gray,tile.getchannel('A')))
    return tile


def build(jobdir, manifest_path):
    job = S.P.read(jobdir/'job.json'); manifest = S.P.read(manifest_path)
    base = jobdir/manifest['baseDirectory']; output = jobdir/manifest['outputDirectory']
    S.P.require(output.resolve().parent == jobdir.resolve(), 'OUTPUT_OUTSIDE_JOB')
    S.P.require(not output.exists(), 'IMMUTABLE_OUTPUT_EXISTS')
    S.P.require(S.sha(base/'bank.json') == manifest['baseBankSha256'], 'BASE_DRIFT')
    S.P.require(S.sha(jobdir/'job.json') == manifest['jobSha256'], 'JOB_DRIFT')
    S.P.require(set(manifest['poses']) == set(job['keys']), 'POSE_COVERAGE')
    for field in ('selectedConcept','inventory','review','motionContract'):
        S.P.require(S.sha(job[field]['path']) == job[field]['sha256'], 'INPUT_DRIFT_'+field)
    prior = S.P.read(base/'bank.json'); inv = S.P.read(Path(job['inventory']['path']))
    palette = S.P.PIXEL.parse_palette(job['palette'])
    masters, reviews = {}, []
    for key, row in manifest['poses'].items():
        im = Image.open(base/prior['cells'][key]['image']).convert('RGBA')
        S.P.require(S.sha(base/prior['cells'][key]['image']) == prior['cells'][key]['sha256'], 'PIXEL_INPUT_DRIFT')
        if row.get('boundParent'):
            S.P.require(row['boundParent'] in masters, 'BOUND_PARENT_MUST_PRECEDE_CHILD')
            tile = masters[row['boundParent']].copy()
            # Binding locations are original authored overlay pixels. They are
            # not copied from a donor or represented as a sameAsCell alias.
            for x,y in row['bindingPixels']:
                S.P.require(tile.getpixel((x,y))[3] == 255,'BINDING_OUTSIDE_BODY')
                tile.putpixel((x,y),palette[11 + ((x+y) % 2)])
            for x,y in row.get('extraDroplets',[]):
                tile.putpixel((x,y),palette[2]);tile.putpixel((x+1,y),palette[4]);tile.putpixel((x,y+1),palette[3])
            masters[key] = tile
        else:
            masters[key] = render(im,row,palette)
        reviews.append({'key':key,'method':'REVIEWED_PIXEL_ART_EDIT_OF_GENERATED_DRAFT',
                        'poseManifestSha256':S.sha(manifest_path),'artAccepted':False,
                        'poseExpressionRestraintQa':'PENDING_VISUAL_REVIEW'})
    for key, rule in job['derived'].items():
        base_image = masters[rule['base']]
        if rule['operation'] in ('white','black'):
            c = 255 if rule['operation']=='white' else 0
            tile = S.P.derive_silhouette(base_image,(c,c,c,255))
            if not c:
                row = manifest['poses'][rule['base']]
                for px, py in row['eye']:
                    tile.putpixel((row['bodyRect'][0]+px,row['bodyRect'][1]+py),(255,255,255,255))
        else:
            tile = base_image.copy()
            tile.putdata([(0,0,0,0) if not p[3] else (max(60,min(255,int(sum(p[:3])/3*1.3))),int(p[1]*.35),int(p[2]*.2),255)
                          for p in base_image.get_flattened_data()])
        masters[key] = tile
        reviews.append({'key':key,'derived':rule,'artAccepted':False,'poseExpressionRestraintQa':'PENDING_PARENT_REVIEW',
                        'eyeMaskSource':'ORIGINAL_AUTHORED_FACE' if rule['operation']=='black' else None})
    plan = {'slots':{k:{**v,'sourceTranslationFromCanonical':v['translation']} for k,v in inv['slots'].items()}}
    metadata = {**prior,'designVersion':manifest['designVersion'],
                'pixelRepairManifestSha256':S.sha(manifest_path),'artReview':'PENDING_VISUAL_REVIEW',
                'runtimeEligible':False,'normalization':{'operation':'EXPLICIT_POSE_AND_FACE_PIXEL_EDIT','automaticPerFrameFit':False,
                'automaticCentering':False,'originalSheetRetained':True,'origin':job['sourceOrigin']},
                'originalEyeMasks':'DERIVED_FROM_EXPLICIT_NEW_EYE_PIXELS','repairedMasters':list(masters)}
    for k in ('cells','sequences'): metadata.pop(k,None)
    S.F.assemble(masters,plan,prior,{},reviews,metadata,output,manifest)


if __name__ == '__main__':
    p = argparse.ArgumentParser(); p.add_argument('--job',type=Path,required=True);p.add_argument('--manifest',type=Path,required=True)
    a=p.parse_args();build(a.job.resolve(),a.manifest.resolve())
