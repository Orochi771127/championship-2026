"""Project observed original Home rebuild checkpoints into numeric evidence.

The observer only used original stylus/frame inputs. RAM and images stay in the
private archive; this receipt keeps profiles, positions, RNG and their ordering.
It is one observed path, not an assertion that every scene rebuild is identical.
"""
import argparse,hashlib,json,struct
from pathlib import Path
ap=argparse.ArgumentParser();ap.add_argument('--private-dir',required=True);ap.add_argument('--out',required=True);a=ap.parse_args()
base=Path(a.private_dir);meta=json.loads((base/'observations.json').read_text(encoding='utf-8'))
assert meta['romSha256']=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
offsets=[*range(0,44,4),0x38,0x40,0x48,0x4c,*range(0x50,0x194,4),*range(0x198,0x1c8,4)]
narrow={0x3c:1,0x3d:1,0x44:1,0x46:2,0x194:2}
constructors=[e for e in meta['events'] if e['address']==0x2111124]
assert len(constructors)==2
def snapshot(name):
    raw=(base/name).read_bytes()
    def get(p,n=4):
        assert 0x2000000<=p<=0x2400000-n,hex(p)
        return int.from_bytes(raw[p-0x2000000:p-0x2000000+n],'little')
    def signed(v):return v if v<0x80000000 else v-0x100000000
    def vec(p):return [signed(get(p+i*4)) for i in range(3)]
    def profile(p):
        name=raw[p+0x2c-0x2000000:p+0x38-0x2000000].decode('utf-16-le').split('\0')[0]
        return dict(version=1,name=name,fields={f'{i:03x}':get(p+i) for i in offsets},narrowFields={f'{i:03x}':get(p+i,n) for i,n in narrow.items()})
    root=get(0x20fba08);pool=get(root+0x84)
    placements=[dict(definitionIndex=get(pool+i*100+4),slotIndex=get(pool+i*100+0x60,1)) for i in range(16) if get(pool+i*100+4)<36]
    profiles=[profile(e['registers'][1]) for e in constructors]
    actors=[];foods=[]
    if name!='hook-02083358-00.ram':
        for e in constructors:
            p=e['registers'][0];body=get(p+0x3c)
            actors.append(dict(poolSlot=get(p+0x46c)-0x26,state=get(p+8,1),positionQ12=vec(body+0x24),flipBits=get(body+0x6dc),angleQ12=signed(get(p+0x148))))
        for i in range(16):
            cage=pool+i*100;f=get(cage+0x48)
            for j in range(get(cage+0x4c)):
                rec=get(f+0x3c)
                foods.append(dict(slot=(rec-get(root+0x8c))//32,cageDefinitionIndex=get(rec),localPositionQ12=vec(rec+4),remaining=get(rec+16),freshness=signed(get(rec+20)),present=bool(get(rec+24)),kind=get(rec+28)))
                f=get(f+0x34)
    waste=[]
    for i in range(40):
        p=get(root+0x9c)+i*24
        if get(p+16):waste.append(dict(slot=i,cageDefinitionIndex=get(p),localPositionQ12=vec(p+4),speciesIndex=get(p+20)))
    seeds=get(0x20bd238);cursors=get(0x20bd234)
    return dict(sha256=hashlib.sha256(raw).hexdigest(),profiles=profiles,actors=actors,placements=placements,foods=foods,waste=waste,
        pendingMinutes=get(root+0xbc),rng=dict(version=1,seeds=[get(seeds+i*4) for i in range(217)],cursors=[get(cursors+i*4) for i in range(217)]))
stages={key:snapshot(name) for key,name in [('before','hook-02083358-00.ram'),('constructed','hook-02083910-00.ram'),('overnight','hook-02083950-00.ram'),('morning','hook-0211cab8-01.ram')]}
first=next(i for i,e in enumerate(meta['events']) if e['address']==0x2083358)
last=max(i for i,e in enumerate(meta['events']) if e['address']==0x211cab8)
trace=[]
for e in meta['events'][first:last+1]:
    if e['address']==0x20431d4:trace.append(dict(kind='rng',tick=e['tick'],channel=e['registers'][0],caller=f'{e["lr"]:08x}'))
    elif e['address']==0x2043230:
        assert trace[-1]['kind']=='rng';trace[-1]['value']=e['registers'][0]
    elif e['address'] in [0x2111124,0x2083910,0x2083950,0x211ca00,0x211cab8]:trace.append(dict(kind='stage',tick=e['tick'],address=f'{e["address"]:08x}'))
out=dict(classification='BOUNDED_NATIVE_REPLAY',romSha256=meta['romSha256'],stateSha256=meta['stateSha256'],actions=meta['actions'],stages=stages,trace=trace,
    observations=['Home constructors precede both overnight passes; Cage records retain order 35,0,1,15.',
      'Adding actor one broadcasts Cage membership to actor zero: 0204FC8C -> 0204FE20 -> 02116B70 consumes channel 38 for field 438 before actor one samples its position.',
      'The rebuilt linked lists begin with the newest pool member, followed by oldest through previous. This order applies to residents and food.',
      'Day-end Save retains root+BC; reconstruction consumes the daytime remainder then 540 night minutes before morning entry.'],
    exclusions=['One two-resident original save and one input path only.','No full-scene parity assertion for the web runtime.','No original audio, art, RAM or executable instructions in this receipt.'])
Path(a.out).write_text(json.dumps(out,separators=(',',':'),ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
print('PASS: projected four original checkpoints and',sum(t['kind']=='rng' for t in trace),'ordered RNG draws')
