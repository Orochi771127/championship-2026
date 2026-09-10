"""Compile explicitly authored pixel glyphs into the editable M201 index bank.

No source image is sampled or recoloured by this authoring document. The source
NCER grid provides placement constraints, not pixels. Glyph edits are creative
pixel edits authorized by the Owner's pixel workflow; output remains candidate.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'docs/art/production/characters/appearance-refresh-v1/pixel-v2/m201-a/pixel-bank.json'
SYMBOLS = '.KSGHCLDWMBR'
PALETTE = ['#00000000', '#573919', '#A16B20', '#E7AC32', '#FFD56A',
           '#F4DDA0', '#FFF2CA', '#251E17', '#FFFDF4', '#909995', '#DDE3DA', '#8C5832']

def grid(rows, width=16):
    assert all(len(row) <= width for row in rows), [(row,len(row)) for row in rows if len(row)>width]
    return [[SYMBOLS.index(c) for c in row.ljust(width, '.')] for row in rows]

HEAD = [
    '................',
    '....K.....K.....',
    '....KGK..KGK....',
    '....KHGKKGHK....',
    '...KHHHGGGHGK...',
    '.KKKHHGWDGHGK...',
    'KDLCCCGWDGGSK...',
    'KDCCCCGDDGGSK...',
    'KCCCCCLGGGGGKK..',
    '.KKCKCLCGGGSK...',
    '.KSGGCCCGGSK....',
    '..KKSGCCGSKK....',
    '....KSCGGGKK....',
]
TORSO = ['...KSGCCGGSKK...', '.KKMMLCCGGSKKKKK', 'KLCSKKCCMLSGGSSK']
LOWER = [
    'KKKK.KCLMLSGGSK.',
    '...KKSGCKSGGGK..',
    '..KLCCGSKKGGGK..',
    '..KKKKKKKLCLKGK.',
    '........KKKKKKK.',
    '................', '................', '................',
]
LOWER_LOW = [
    '.....KSCKSGGSKKK',
    '...KKSGCKSGGGK..',
    '..KLCCGSKKGGGK..',
    '..KKKKKKKLCLKGK.',
    '........KKKKKKK.',
    '................', '................', '................',
]
LOWER_STEP = [
    '....KKSCCCSGGGSK',
    '..KKSGCKKSGGGKK.',
    '.KLCCGSK.KSGGGK.',
    '.KKKKKKK.KLCLKGK',
    '.........KKKKKKK',
    '................', '................', '................',
]

def master(rows, lower, **extra):
    return {'nativeBounds': [-8,-19,8,5], 'pixels': grid(rows + ['.'*16]*8),
            'patches':[{'id':lower,'at':[0,16]}],
            'artReview':'PENDING', 'poseReview':'PENDING', **extra}

def build():
    assert len(HEAD)==13 and len(TORSO)==3
    lowtop = ['.'*16]+HEAD[:12]+['.KKMMLCCGGSK....','KLCSKKCCMLSGGKK.','KKKKKKCLMLSGGGSK']
    bank = {
        'schemaVersion':2,'entityId':'m201_agumon','designVersion':'m201-a-pixel-v2',
        'selectedConcept':'A','productionStatus':'PIXEL_AUTHORING_CANDIDATE',
        'runtimeEligible':False,'shippingReady':False,
        'authoringSource':'reports/art/appearance-refresh-v1/author-m201-pixel-v2.py',
        'authoringPolicy':'EXPLICIT_GLYPH_PIXEL_ART_NO_SOURCE_RGBA_COPY_NO_PER_FRAME_IMAGEGEN',
        'palette':PALETTE,
        'paletteRoles':dict(zip(SYMBOLS,['transparent','warm outline','gold shadow','gold','gold light',
                            'cream','cream light','eye','eye glint','silver','silver light','nose'])),
        'patches':{
            'lower-shared-16x8':{'pixels':grid(LOWER), 'sourceProof':'EXACT_NINE_SLOT_OAM_RGBA',
                                 'review':'CANDIDATE_SEAMS_REQUIRE_VISUAL_REVIEW'},
            'lower-low-16x8':{'pixels':grid(LOWER_LOW),'sourceProof':'AUTHORED_DISTINCT_POSE'},
            'lower-step-16x8':{'pixels':grid(LOWER_STEP),'sourceProof':'AUTHORED_DISTINCT_POSE'},
            'eye-closed':{'pixels':grid(['GGG','KKG'],3),'sourceProof':'MAIN_000_002_SOURCE_DIFFERENCE_REGION_3_BY_2'},
            'eye-narrow':{'pixels':grid(['WGG','DDG','GGG'],3),'sourceProof':'AUTHORED_EXPRESSION_VARIANT'},
        },
        'masters':{
            'main/cell_000':master(HEAD+TORSO,'lower-shared-16x8'),
            'main/cell_001':master(lowtop,'lower-low-16x8'),
            'main/cell_002':{'nativeBounds':[-8,-19,8,5],'copyFrom':'main/cell_000',
                'patches':[{'id':'eye-closed','at':[7,5],'allowOverwrite':True,'mode':'replace'}],
                'artReview':'PENDING','poseReview':'PENDING'},
            'main/cell_003':{'nativeBounds':[-8,-19,8,5],'copyFrom':'main/cell_001',
                'patches':[{'id':'eye-closed','at':[7,6],'allowOverwrite':True,'mode':'replace'}],
                'artReview':'PENDING','poseReview':'PENDING'},
            'main/cell_005':master(lowtop,'lower-step-16x8'),
            'main/cell_011':{'nativeBounds':[-8,-19,8,5],'copyFrom':'main/cell_000',
                'patches':[{'id':'eye-narrow','at':[7,5],'allowOverwrite':True,'mode':'replace'}],
                'artReview':'PENDING','poseReview':'PENDING'},
        },
        'featureRules':[
            'Source top padding accommodates small triangular ears; no independent ear animation.',
            'One visible dark eye; cream muzzle/chest, simplified wrists; no ankle rings.',
            'Lower linked patch includes wrist and staggered feet, not a skeleton limb.',
            'Special silhouettes and unmade source poses remain missing, never source-filled.'
        ]
    }
    return bank

if __name__=='__main__':
    bank=build();OUT.parent.mkdir(parents=True,exist_ok=True)
    payload=(json.dumps(bank,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
    if OUT.exists() and OUT.read_bytes()!=payload:
        raise SystemExit('Historical six-master seed: current editable bank has progressed; refusing overwrite.')
    OUT.write_bytes(payload)
    print(f'Authored {len(bank["masters"])} distinct pixel masters: {OUT}')
