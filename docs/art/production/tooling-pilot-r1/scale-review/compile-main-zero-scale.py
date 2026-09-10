"""Compact verified metadata for the current static Main cell_000 roster seam."""
import hashlib
import json
from pathlib import Path
ROOT = Path('R:/Projects/Championship2026/championship-2026')
HERE = Path(__file__).resolve().parent
PROD = ROOT/'assets/production/internal-faithful-baseline/characters-v1'
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p, v): p.write_text(json.dumps(v, ensure_ascii=False, sort_keys=True, indent=2)+'\n',encoding='utf-8',newline='\n')
all_data = read(HERE/'character-native-scale-candidates.json')
manifest = read(PROD/'manifest.json')
assert sha(PROD/'manifest.json') == all_data['summary']['sourceManifestSha256']
records = {r['entityId']: r for r in manifest['records']}
compact = []
all_indexed_hashes = 0
for entity in all_data['entities']:
    eid = entity['entityId']
    record = records[eid]
    for f in record['files']:
        assert sha(PROD/f['path']).lower() == f['sha256'].lower(), (eid, f['path'], 'manifest hash mismatch')
        all_indexed_hashes += 1
    audit_path = ROOT/'docs/art/production/characters/appearance-refresh-v1/generated/entities'/eid/'origin-audit.json'
    old_audit = read(audit_path)
    prior = {r['texture']: r for r in old_audit['cells']}
    runtime_path = PROD/record['runtime']
    runtime = read(runtime_path)
    sides = {}
    for side in ('main','sub'):
        key = f'{eid}/{side}/cell_000'
        native = next(r for r in entity['frames'] if r['texture'] == key)
        previous = prior[key]
        assert not native['isBlank'], (key,'blank cell zero')
        assert previous['decodedPixelsMatchCurrent'] is True
        assert previous['signedSourceAlphaBounds'] == native['nativeAlphaBounds']
        assert previous['effectiveSourcePixelScale'] == native['packedPixelsPerNativePixel']
        assert previous['inferredCurrentSourceOrigin'] == native['packedSourceOrigin']
        assert runtime['sides'][side]['animations'][0]['id'] == 0
        assert runtime['sides'][side]['animations'][0]['frames'][0]['texture'] == key
        sides[side] = {k:native[k] for k in ('texture','nativeCellBounds','nativeCellSize','nativeAlphaBounds',
                    'nativeVisibleSize','packedPixelsPerNativePixel','packedSourceOrigin','packedSourceSize',
                    'packedTrim','packedFrame','packedAnchor','atlasResolution','atlasJson','atlasPng',
                    'sourceOriginAnchorForUnmodifiedTexture','spriteScalePerWorldUnitPerNativePixel')}
        sides[side]['atlasJsonSha256'] = sha(ROOT/native['atlasJson'])
        sides[side]['atlasPngSha256'] = sha(ROOT/native['atlasPng'])
        sides[side]['verifiedPixelMatch'] = True
        sides[side]['sourceOamAffineCount'] = native['sourceOamAffineCount']
    compact.append({'entityId':eid,'kind':record['kind'],'baselineRuntimePath':str(runtime_path.relative_to(ROOT)),
                    'baselineRuntimeSha256':sha(runtime_path),'sourceOriginAuditPath':str(audit_path.relative_to(ROOT)),
                    'sourceOriginAuditSha256':sha(audit_path),'sides':sides,
                    'perFramePackedScaleVariants':entity['packedScaleVariants'],
                    'staticOnly':'These Main/Sub cell_000 records do not normalize later frames.'})
assert len(compact)==224 and len({r['entityId'] for r in compact})==224
summary={'entityCount':224,'sideZeroCount':448,'indexedFileHashesVerified':all_indexed_hashes,
         'missingOrBlankCellZero':0,'exceptions':[],
         'sourceFullMappingSha256':sha(HERE/'character-native-scale-candidates.json'),
         'currentManifestSha256':sha(PROD/'manifest.json'),
         'allCurrentAtlasResolutionValues':sorted({s['atlasResolution'] for r in compact for s in r['sides'].values()}),
         'classification':'RESEARCH_ONLY_CANDIDATE_METADATA_NO_PIXELS',
         'runtimeIntegrated':False,'sourceOamFlagsAreNotLiveRaisingAffineEvidence':True}
write(HERE/'character-main-zero-scale-candidates.json',{'schemaVersion':1,'summary':summary,'records':compact})
print(json.dumps(summary))
for eid in ('e000_digitama','m001_zurumon','m201_agumon','m226_hagurumon','m222_patamon','m228_gabumon','m352_greymon','m431_whamon'):
    r=next((r for r in compact if r['entityId']==eid),None)
    if r:
        s=r['sides']['main']
        print(eid,s['nativeCellSize'],s['nativeVisibleSize'],s['packedPixelsPerNativePixel'],s['packedSourceOrigin'])
