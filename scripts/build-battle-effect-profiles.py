"""Numeric battle 2D bank/animation/cell contracts, never source pixels."""
import argparse,hashlib,json,struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy import lz10

p=argparse.ArgumentParser();p.add_argument('--rom',required=True);p.add_argument('--out',required=True);p.add_argument('--check',action='store_true');args=p.parse_args()
raw=Path(args.rom).read_bytes();sha=hashlib.sha256(raw).hexdigest()
assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
r=NintendoDSRom(raw);ov=r.loadArm9Overlays()[19];b=bytes(ov.data)
def word(p):return struct.unpack_from('<I',b,p-ov.ramAddress)[0]
def source(name):
 data=bytes(r.files[r.filenames.idOf(name)])
 return (lz10.decompress(data) if data[0]==0x10 else data),hashlib.sha256(data).hexdigest()
banks=[]
for bank in range(1,152):
 ptr=word(word(0x211a3ec)+(bank-1)*4);name=b[ptr-ov.ramAddress:].split(b'\0')[0].decode('ascii')
 a,ah=source('common/'+name+'.nanr');c,ch=source('common/'+name+'.ncer')
 assert a[:4]==b'RNAN' and c[:4]==b'RECN'
 count,total=struct.unpack_from('<HH',a,24);so,fo,ro=struct.unpack_from('<III',a,28)
 sequences=[]
 for i in range(count):
  n,start,kind,mode,fp=struct.unpack_from('<HHIII',a,24+so+i*16);frames=[]
  assert mode in (1,2),(name,mode)
  assert kind==0x10000,(name,hex(kind))
  for j in range(n):
   rp,ticks,marker=struct.unpack_from('<IHH',a,24+fo+fp+j*8);assert marker==0xbeef,(name,i,j,ticks,hex(marker))
   frames.append({'cell':struct.unpack_from('<H',a,24+ro+rp)[0],'ticks':ticks})
  sequences.append({'id':i,'playbackMode':mode,'loopStartFrame':start,'frames':frames})
 cc,attr=struct.unpack_from('<HH',c,24);co=24+struct.unpack_from('<I',c,28)[0]
 assert attr&1,(name,'no box bank')
 cells=[list(struct.unpack_from('<hhhh',c,co+i*16+8)) for i in range(cc)]
 assert sum(len(s['frames']) for s in sequences)==total
 assert all(f['cell']<cc for s in sequences for f in s['frames'])
 banks.append({'id':bank,'name':name,'sourceHashes':{'nanr':ah,'ncer':ch},'sequences':sequences,'boxes':cells})
data={'romSha256':sha,'overlaySha256':hashlib.sha256(b).hexdigest(),'classification':'NUMERIC_BEHAVIOR_CONTRACT_NO_IMAGE_DATA',
 'bankTable':word(0x211a3ec),'extraDemandScripts':[word(0x211a3e0),word(0x211a3e4)],
 'initialDemand':list(struct.unpack_from('<152H',b,word(0x211a3d8)-ov.ramAddress)),'banks':banks}
encoded=(json.dumps(data,separators=(',',':'))+'\n').encode('utf-8')
if args.check:assert Path(args.out).read_bytes()==encoded,'BATTLE_EFFECT_PROFILES_STALE'
else:Path(args.out).write_bytes(encoded)
print(json.dumps({'banks':len(banks),'sequences':sum(len(x['sequences']) for x in banks),'cells':sum(len(x['boxes']) for x in banks)}))
