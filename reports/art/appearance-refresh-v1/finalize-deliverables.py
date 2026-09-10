"""Root-only documentation/provenance finalization; no production promotion."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
PACK = ROOT / 'docs/art/production/characters/appearance-refresh-v1'
if (PACK/'batch-01/owner-selection.json').exists():
    raise SystemExit('Historical first-delivery script: refuses to reset subsequent Owner selections.')
def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')

designs = read(PACK/'batch-01/designs.json')
qa = read(PACK/'batch-01/concept-qa.json')
designs['status'] = 'OWNER_REVIEWABLE_SELECTION_PENDING'
for entry, assessment in zip(designs['entities'], qa['entities']):
    assert entry['entityId'] == assessment['entityId']
    entry['promptFile'] = f"generation/{entry['code'].lower()}-prompt.txt"
    entry['artReviewNotes'] = [assessment['styleAssessment'], *assessment.get('briefReconciliation', [])]
    entry['productionFixes'] = assessment['productionFixes']
designs['entities'][0]['concepts'][1]['title'] = '蜜金圓耳幼獸'
egg = designs['entities'][3]
egg['concepts'][0]['description'] = egg['concepts'][0]['description'].replace('三個平齊', '四個平齊')
egg['concepts'][0]['tokens'] = [s.replace('三個淡灰', '四個淡灰') for s in egg['concepts'][0]['tokens']]
egg['recommendation'] = egg['recommendation'].replace('三點斑', '四點斑')
write(PACK/'batch-01/designs.json', designs)

files = []
for path in sorted((PACK/'batch-01').rglob('*')):
    if path.is_file() and path.suffix in ('.png', '.txt'):
        record = {'path': path.relative_to(PACK).as_posix(), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
        if path.suffix == '.png':
            with Image.open(path) as image:
                record.update(width=image.width, height=image.height, mode=image.mode)
        files.append(record)
write(PACK/'batch-01/generation-receipt.json', {
    'schemaVersion': 1, 'generator': 'builtin image_gen.imagegen',
    'purpose': 'FOUR_ENTITIES_TWO_APPEARANCE_OPTIONS_EACH', 'sourceReferences': 'designs.json referencePaths',
    'generationCount': 5, 'finalBoardCount': 4, 'm201Refinement': 'Initial and targeted refinement both retained',
    'ownerApproved': False, 'motionCompatibility': 'NOT_VALIDATED', 'runtimeEligible': False,
    'shippingReady': False, 'files': files})

program = read(PACK/'program.json')
program.update(currentStage='WORKFLOW_IMPLEMENTED_FIRST_PACKET_OWNER_SELECTION_PENDING',
               evidenceEntityCount=224, conceptBoardCount=4, conceptOptionCount=8,
               fullRedrawnEntityCount=0, approvedDesignCount=0, approvedRuntimeReplacementCount=0)
write(PACK/'program.json', program)

status_path = ROOT/'docs/coordination/CODEX_ART_STATUS.json'
status = read(status_path)
batch = {'id': 'CHARACTER-APPEARANCE-WORKFLOW-2026-09-06',
    'status': 'WORKFLOW_IMPLEMENTED_FIRST_FOUR_CONCEPTS_OWNER_SELECTION_PENDING',
    'report': 'docs/art/production/characters/appearance-refresh-v1/IMPLEMENTATION_REPORT.md',
    'approvedDesignCount': 0, 'activeAppearanceReplacementCount': 0,
    'summary': '224 source contracts,56 packets,10184 nonblank masters; corrected source-origin guide exporter;4 A/B concept boards; guarded existing-roster replacement seam.1040 JS regression and16 Python checks pass. No full entity redraw or new appearance promotion. Canvas adapter, landmarks, owner selections and physical device QA remain pending.'}
if status['latestBoundedBatch']['id'] != batch['id']:
    status.setdefault('previousBoundedBatches', []).insert(0, status['latestBoundedBatch'])
status['latestBoundedBatch'] = batch
write(status_path, status)
delta_path = ROOT/'docs/coordination/CODEX_SYNC_DELTA.json'
delta = read(delta_path)
item = {'deltaId': 'CODEX-CHARACTER-APPEARANCE-WORKFLOW-2026-09-06', **{k:v for k,v in batch.items() if k!='id'},
        'sharedMergePerformed': False, 'candidateIntegration': 'ROOT_SINGLE_WRITER_LOCAL_FILES_ONLY'}
if not any(d['deltaId']==item['deltaId'] for d in delta['supplementalDeltas']):
    delta['supplementalDeltas'].insert(0,item)
write(delta_path,delta)
print(json.dumps({'boards':4,'sourceEntities':224,'ownerApproved':False,'productionPromotions':0}))
