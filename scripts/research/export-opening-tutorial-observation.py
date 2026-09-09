"""Publish numeric input/text-event provenance; keep RAM, states and art private."""
import argparse,hashlib,json
from pathlib import Path

ap=argparse.ArgumentParser();ap.add_argument('--private-root',required=True);ap.add_argument('--out',required=True)
a=ap.parse_args();base=Path(a.private_root).resolve();traces=[]
for name in ['title-observe','tutorial-recheck','tutorial-gate-hunt']:
    folder=base/name;path=folder/'observations.json';raw=path.read_bytes();data=json.loads(raw)
    assert data['romSha256']=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    inputs=[{k:v for k,v in action.items() if k in ['tick','touch','release','buttons','frames','reload','checkpoint']}
            for action in data['actions'] if any(k in action for k in ['touch','release','buttons','frames','reload','checkpoint'])]
    texts=[{'tick':event['tick'],'textId':event['registers'][1],'caller':hex(event['lr'])}
           for event in data['events'] if event.get('address')==0x207d234 and 1495<=event['registers'][1]<=1566]
    traces.append({'privateTrace':name,'sourceObservationsSha256':hashlib.sha256(raw).hexdigest(),
                   'startStateSha256':data['stateSha256'],'finalFrame':data['sequence'],'emulatedFrames':data['tick'],
                   'inputs':inputs,'observedTextEvents':texts})
out={'evidenceClass':'BOUNDED_NATIVE_REPLAY','romSha256':data['romSha256'],'traces':traces,
     'additionalVisualObservations':[
       {'privateTrace':'tutorial-gate-hunt','frame':1,'textId':1527,'meaning':'Select a Gate by touching twice'},
       {'privateTrace':'tutorial-gate-hunt','frame':12,'textId':1528,'meaning':'Hand-selected Hunt scrolling'},
       {'privateTrace':'tutorial-gate-hunt','frame':117,'textId':1548,'meaning':'Placed food; Shot stops movement'}],
     'resumeCheckpoint':'PRIVATE tutorial-gate-hunt/tutorial-hunt-stun-followup.dst',
     'observedScope':['Raising teaching through Gate entry','Gate double selection and dedicated Hunt field',
                     'Hunt camera search and capture demonstration','first manual enclosure, pull and hand capture',
                     'Koromon escape, return, guided food placement and Shot stun'],
     'remaining':['second post-stun capture completion','Hunt exit and battle teaching','full interactive tutorial runtime'],
     'limits':['Only the recorded inputs are observed. Absent text events are not proof that a message is absent.',
               'Observation hooks were toggled; visuals and numeric events have separate provenance.',
               'The tutorial uses scripted actors and hit regions; it is not an ordinary wild-encounter fixture.',
               'No original RAM, save-state, image or text-bank payload is copied into runtime.']}
Path(a.out).write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'traces':len(traces),'inputActions':sum(len(t['inputs']) for t in traces),'tutorialEvents':sum(len(t['observedTextEvents']) for t in traces)}))
