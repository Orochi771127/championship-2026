"""Inventory remaining numeric OPM contracts without inferring playback semantics."""
import json
from pathlib import Path
from lib.cage_object_animation_contract import extract

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1'
FIELDS=tuple(f'field_cm{n:02d}_01' for n in (6,8,13,14,15,17,18,19,22,23,24,25,26,32))


def inventory():
    rows=[]
    for fid in FIELDS:
        spec=json.loads((WORK/'fields'/fid/'spec.json').read_text(encoding='utf8'))
        row={'fieldId':fid,'name':spec['name'],'objects':len(spec['objects']),
             'clockHz':None,'runtimeEligible':False}
        try:
            contract=extract(ROOT,fid)
        except ValueError as exc:
            row.update(status='NEEDS_CONTRACT_EXTENSION',reason=str(exc))
        else:
            sequences={o['sequenceId']:o for o in contract['objects']}
            row.update(status='FIXED_WINDOW_NUMERIC_CONTRACT_READY',sourceLocks=contract['sourceLocks'],
                sequences=[{'sequenceId':sid,'cellIds':[f['cellId'] for f in o['frames']],
                            'rawTicks':[f['rawDurationTicks'] for f in o['frames']],
                            'loopStartFrame':o['loopStartFrame'],'rawWordA':o['rawWordA'],
                            'rawWordB':o['rawWordB']} for sid,o in sorted(sequences.items())])
        rows.append(row)
    return {'status':'NUMERIC_INVENTORY_NOT_ART_COMPLETION','fields':rows,
            'clockEvidence':'Existing cage parser preserves raw ticks only; resident character speed evidence does not prove cage OPM update cadence.',
            'evidencePaths':['scripts/lib/cage-original-formats.mjs',
                'docs/research/CHARACTER_ANIMATION_USAGE_ROM_2026-09-09.md'],
            'runtimeEligible':False}


if __name__=='__main__':
    report=inventory();out=WORK/'opm-meadow-v1';out.mkdir(parents=True,exist_ok=True)
    (out/'remaining-opm-inventory.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps([{k:r[k] for k in ('fieldId','status')} for r in report['fields']]))
