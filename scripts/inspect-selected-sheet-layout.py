"""Offline, fail-closed extraction of separated generated sprite islands.

Writes a proposal, never an accepted layout or a production bank. Projection
thresholds and gap sizes are explicit job inputs. No frame is resized or fitted.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def runs(values, minimum, gap):
    groups = []
    for pos, count in enumerate(values):
        if count <= minimum:
            continue
        if not groups or pos - groups[-1][1] > gap:
            groups.append([pos, pos])
        else:
            groups[-1][1] = pos
    return groups


def inspect(jobdir, sheet, output, row_gap, column_gap, sample_side, alpha_threshold=128,
            row_minimum=8, column_minimum=2):
    job = json.loads((jobdir/'job.json').read_text(encoding='utf-8'))
    assert not output.exists(), 'IMMUTABLE_OUTPUT_EXISTS'
    image = Image.open(sheet).convert('RGBA')
    assert image.width == image.height, 'SQUARE_SHEET_REQUIRED'
    assert type(alpha_threshold) is int and 1 <= alpha_threshold <= 255, 'INVALID_ALPHA_THRESHOLD'
    mask = image.getchannel('A').point(lambda p: 255 if p >= alpha_threshold else 0)
    pixels = mask.load()
    row_ranges = runs([sum(pixels[x,y] > 0 for x in range(image.width))
                       for y in range(image.height)], row_minimum, row_gap)
    # Trailing transparent rows have no alpha projection. Count occupied rows,
    # while retaining the declared canvas/grid in the immutable generation job.
    expected_rows = (len(job['keys']) + job['grid'][0] - 1) // job['grid'][0]
    assert len(row_ranges) == expected_rows, 'ROW_COUNT_MISMATCH'
    rects = []
    for row, (top, bottom) in enumerate(row_ranges):
        columns = runs([sum(pixels[x,y] > 0 for y in range(top,bottom+1))
                        for x in range(image.width)], column_minimum, column_gap)
        expected = min(job['grid'][0], len(job['keys']) - row * job['grid'][0])
        assert len(columns) == expected, f'ROW_{row}_COLUMN_COUNT_MISMATCH'
        for left, right in columns:
            # Add only a small guard within the verified empty gap, then trim
            # the alpha. A crop touches no other cell and cannot hide a clip.
            rect = [max(0,left-3),max(0,top-3),min(image.width,right+4),min(image.height,bottom+4)]
            b = mask.crop(rect).getbbox()
            assert b, 'EMPTY_GLYPH'
            rects.append([rect[0]+b[0],rect[1]+b[1],rect[0]+b[2],rect[1]+b[3]])
    assert len(rects) == len(job['keys']), 'PANEL_COVERAGE'
    # Exact integer-ratio sampling is optional; the single nearest sample is
    # shared by every panel. The full-resolution original remains immutable.
    sampled = image.resize((sample_side,sample_side), Image.Resampling.NEAREST)
    sampled.putalpha(sampled.getchannel('A').point(lambda p:255 if p>=alpha_threshold else 0))
    rows = {}
    preview = Image.new('RGB', (7*240, max(1, (len(job['keys'])+6)//7)*192), '#e8edf2')
    draw = ImageDraw.Draw(preview)
    covered = Image.new('L', image.size)
    cover_draw = ImageDraw.Draw(covered)
    for index, (key, rect) in enumerate(zip(job['keys'], rects)):
        # Expand sampling rectangles by one sample pixel. Translation is left
        # unset, requiring a separate explicit artist landmark choice.
        sr = [max(0,int(rect[0]*sample_side/image.width)-1),
              max(0,int(rect[1]*sample_side/image.height)-1),
              min(sample_side,int(rect[2]*sample_side/image.width)+2),
              min(sample_side,int(rect[3]*sample_side/image.height)+2)]
        crop = sampled.crop(sr)
        box = crop.getbbox()
        assert box, 'SAMPLING_LOST_GLYPH'
        rows[key] = {'rawRect':rect,'sampleRect':sr,'sampleVisibleBounds':list(box),
                     'visibleSize':[box[2]-box[0],box[3]-box[1]],'offset':None}
        x,y = index%7*240, index//7*192
        draw.text((x+8,y+6),key,fill='#17202c')
        glyph = crop.crop(box).resize(((box[2]-box[0])*6,(box[3]-box[1])*6),Image.Resampling.NEAREST)
        preview.paste(glyph,(x+8,y+32),glyph)
        cover_draw.rectangle((rect[0],rect[1],rect[2]-1,rect[3]-1),fill=255)
    from PIL import ImageChops
    unassigned = ImageChops.subtract(mask,covered)
    assert not unassigned.getbbox(), 'UNASSIGNED_OPAQUE_PIXELS_REVIEW_REQUIRED'
    proposal = {'schemaVersion':1,'status':'EXTRACTION_ONLY_ANCHORS_NOT_REVIEWED',
                'sourceSha256':sha(sheet),'jobSha256':sha(jobdir/'job.json'),
                'wholeSheetSampleSize':[sample_side,sample_side],'perFrameFit':False,
                'alphaThreshold':alpha_threshold,'rowGap':row_gap,'columnGap':column_gap,
                'rowMinimum':row_minimum,'columnMinimum':column_minimum,
                'opaquePixelsOutsideCrops':0,'panels':rows,'runtimeEligible':False}
    output.mkdir(parents=True)
    (output/'extraction.json').write_text(json.dumps(proposal,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    preview.save(output/'isolated-poses-6x.png')
    print(json.dumps({'status':proposal['status'],'panels':len(rows),'output':str(output)}))


if __name__ == '__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--job',type=Path,required=True);p.add_argument('--sheet',type=Path,required=True)
    p.add_argument('--output',type=Path,required=True);p.add_argument('--row-gap',type=int,default=22)
    p.add_argument('--column-gap',type=int,default=18);p.add_argument('--sample-side',type=int,default=205)
    p.add_argument('--alpha-threshold',type=int,default=128)
    p.add_argument('--row-minimum',type=int,default=8);p.add_argument('--column-minimum',type=int,default=2)
    a=p.parse_args();inspect(a.job.resolve(),a.sheet.resolve(),a.output.resolve(),a.row_gap,a.column_gap,a.sample_side,a.alpha_threshold,a.row_minimum,a.column_minimum)
