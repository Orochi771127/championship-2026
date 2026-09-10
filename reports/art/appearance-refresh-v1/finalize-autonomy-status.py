"""Single-writer status update; preserve other current batches and fail on drift."""
import hashlib
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
PACK=ROOT/'docs/art/production/characters/appearance-refresh-v1'
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def encode(value): return (json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
def change(path, mutate):
    before=path.read_bytes()
    data=json.loads(before.decode('utf-8-sig'))
    mutate(data)
    payload=encode(data)
    temp=path.with_name(path.name+'.appearance-refresh.tmp')
    temp.write_bytes(payload)
    if path.read_bytes()!=before: raise RuntimeError('ABORT_AND_REREAD '+str(path))
    temp.replace(path)
    return {'path':path.relative_to(ROOT).as_posix(),'before':hashlib.sha256(before).hexdigest(),'after':hashlib.sha256(payload).hexdigest()}
changes=[]
def program(data):
    data.update(selectedDesignCount=8,ownerSelectedDesignCount=4,artDirectorSelectedBriefCount=4,
      currentStage='M201_A_POSE_ALPHA_REPAIR_AND_GEOMETRY_IMPLEMENTED',
      fullRedrawnEntityCount=0,approvedRuntimeReplacementCount=0,
      nextPacketDecision='batch-02/design-decisions.json')
changes.append(change(PACK/'program.json',program))
batch={'id':'CHARACTER-AUTONOMOUS-SELECTION-M201-2026-09-06',
 'status':'OWNER_CHOICES_RECORDED_DELEGATED_BRIEFS_SELECTED_GEOMETRY_PASS_ART_REPAIR_REQUIRED',
 'report':'docs/art/production/characters/appearance-refresh-v1/AUTONOMOUS_PRODUCTION_UPDATE.md',
 'summary':'Owner firstfour A/B/B/A preserved; later low-error design selection and production delegated. Packet02 A/A/B/A briefs selected. M201 setting plus12 high-risk source poses;3 generated RGB candidates rejected for pose/alpha. Optional hash-locked common-origin M201 adapter preserves baseline reference and83 source offsets. Focused85/full1080 pass. No new art promotion.',
 'ownerSelectedDesignCount':4,'delegatedSelectedBriefCount':4,'acceptedTransparentMasters':0,
 'activeNewAppearanceCount':0,'shippingReady':False}
def status(data):
    if data.get('latestBoundedBatch',{}).get('id')!=batch['id']:
        data.setdefault('previousBoundedBatches',[]).insert(0,data['latestBoundedBatch'])
    data['latestBoundedBatch']=batch
changes.append(change(ROOT/'docs/coordination/CODEX_ART_STATUS.json',status))
def delta(data):
    item={'deltaId':'CODEX-'+batch['id'],**batch,'sharedMergePerformed':False,
      'remaining':'M201 precise redraw and true alpha output; full47 masters/83 slots/53 sequences; normal new-art and device QA. Gameplay owners unchanged.'}
    if not any(d.get('deltaId')==item['deltaId'] for d in data['supplementalDeltas']):data['supplementalDeltas'].insert(0,item)
changes.append(change(ROOT/'docs/coordination/CODEX_SYNC_DELTA.json',delta))
(ROOT/'reports/art/appearance-refresh-v1/autonomy-status-receipt.json').write_bytes(encode({'changes':changes,'sourceOfAuthority':'OWNER_CHAT','runtimePromotions':0}))
print('Autonomy status written with concurrent-drift checks; previous batches preserved.')
