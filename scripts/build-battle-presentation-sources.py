"""R13: existing ROM sound samples and numeric presentation tables.
No synthesized/replacement sounds. Output is a loopback research bundle.
"""
import argparse, hashlib, io, json, struct, wave
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.soundArchive import SDAT

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'assets/production/internal-faithful-baseline/battle-audio-v1'
STEPS=(7,8,9,10,11,12,13,14,16,17,19,21,23,25,28,31,34,37,41,45,50,55,60,66,73,80,88,97,107,118,130,143,157,173,190,209,230,253,279,307,337,371,408,449,494,544,598,658,724,796,876,963,1060,1166,1282,1411,1552,1707,1878,2066,2272,2499,2749,3024,3327,3660,4026,4428,4871,5358,5894,6484,7132,7845,8630,9493,10442,11487,12635,13899,15289,16818,18500,20350,22385,24623,27086,29794,32767)
INDEX=(-1,-1,-1,-1,2,4,6,8)
def sha(b): return hashlib.sha256(b).hexdigest()
def encoded(j): return (json.dumps(j,ensure_ascii=False,indent=2)+'\n').encode('utf-8')

def pcm16(data,kind):
    if kind==0: return struct.pack('<'+'h'*len(data),*((v if v<128 else v-256)<<8 for v in data))
    if kind==1: return data
    assert kind==2
    # NDS ADPCM: low nibble first; single integer product/8 (not IMA's
    # separately rounded partial sums). Header occupies eight sample clocks.
    value,index=struct.unpack_from('<hB',data); index&=127
    assert index<=88 and value==0, 'Nonzero predictor needs separate original playback verification'
    samples=[0]*8
    for byte in data[4:]:
        for nibble in (byte&15,byte>>4):
            delta=((2*(nibble&7)+1)*STEPS[index])//8
            value=max(-32768,min(32767,value+(-delta if nibble&8 else delta)))
            index=max(0,min(88,index+INDEX[nibble&7]));samples.append(value)
    return struct.pack('<'+'h'*len(samples),*samples)

def build(raw):
    assert sha(raw)=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    rom=NintendoDSRom(raw);ov=rom.loadArm9Overlays()[19];data=bytes(ov.data)
    word=lambda p:struct.unpack_from('<I',data,p-ov.ramAddress)[0]
    sound=list(struct.unpack_from('<29H',data,0x212ffb8-ov.ramAddress))
    depth=list(struct.unpack_from('<5i',data,word(0x211a91c)-ov.ramAddress))
    sdatRaw=bytes(rom.files[rom.filenames.idOf('sound_data.sdat')]);sdat=SDAT(sdatRaw)
    out={};sounds=[]
    def emit(soundId,name,pcm,rate,channels,source,loop=False):
        stream=io.BytesIO()
        with wave.open(stream,'wb') as w:
            w.setnchannels(channels);w.setsampwidth(2);w.setframerate(rate);w.writeframes(pcm)
        file=f'{soundId:04x}.wav';payload=stream.getvalue();out[DEST/file]=payload
        sounds.append(dict(soundId=soundId,name=name,src=DEST.relative_to(ROOT).as_posix()+'/'+file,
            sampleRate=rate,channels=channels,sampleFrames=len(pcm)//2//channels,loop=loop,
            sha256=sha(payload),pcmSha256=sha(pcm),source=source))
    # All battle streams; 0 is the original dummy and is suppressed by EA30.
    for index,(name,s) in enumerate(sdat.streams):
        if not name.startswith('STRM_BATTLE_'): continue
        assert s.waveType.value==0 and len(s.channels)==1 and not s.isLooped
        original=b''.join(s.channels[0]);pcm=pcm16(original,0)
        emit(0xff00|index,name,pcm,s.sampleRate,1,dict(kind='SDAT_STRM',index=index,sourceBytesSha256=sha(original)))
    archive=sdat.sequenceArchives[2][1];archive.parse();bank=sdat.banks[2][1]
    for index,(name,seq) in enumerate(archive.sequences):
        start=archive.events.index(seq.firstEvent);events=archive.events[start:start+3]
        assert [type(e).__name__ for e in events]==['InstrumentSwitchSequenceEvent','NoteSequenceEvent','EndTrackSequenceEvent']
        switch,note,_=events;instrument=bank.instruments[index];n=instrument.noteDefinition
        assert (seq.bankID,seq.volume,seq.playerID)==(2,127,1)
        assert switch.instrumentID==index and note.pitch==n.pitch==60 and note.velocity==127 and note.duration==0
        assert (n.attack,n.decay,n.sustain,n.release,n.pan)==(127,127,127,125,64)
        waveId=n.waveID;waveArchive=bank.waveArchiveIDs[n.waveArchiveIDID];sw=sdat.waveArchives[waveArchive][1].waves[waveId]
        assert not sw.isLooped and sw.waveType.value==2
        pcm=pcm16(sw.data,2)
        emit(0x200|index,name,pcm,sw.sampleRate,1,dict(kind='SDAT_SSAR_ONE_SHOT',archive=2,sequence=index,bank=2,
            waveArchive=waveArchive,waveId=waveId,sourceBytesSha256=sha(sw.data),timer=sw.time,
            pitch=60,velocity=127,attack=127,decay=127,sustain=127,release=125,pan=64))
    common=dict(localOnly=True,runtimeEligible=True,runtimeScope='LOOPBACK_RESEARCH_ONLY',publicReleasePermitted=False,
        shippingReady=False,humanApproved=False,rightsStatus='ROM_COPYRIGHTED_REFERENCE')
    out[DEST/'manifest.json']=encoded(dict(schemaVersion=1,assetId='art:audio:battle:local-reference:v1',**common,
        sounds=sounds,provenance=dict(romSha256=sha(raw),sdatSha256=sha(sdatRaw),
        decoderReference='https://github.com/TASEmulators/desmume/blob/master/desmume/src/SPU.cpp',
        classification='SOURCE_SAMPLES_NO_SOUND_GENERATION',scope='BATTLE_STRM_AND_SINGLE_NOTE_SSAR_NOT_MUSIC')))
    players=[dict(id=i,**{k:v for k,v in vars(p).items() if isinstance(v,(int,str,bool))}) for i,(name,p) in enumerate(sdat.sequencePlayers) if p]
    out[ROOT/'src/data/championship/battlePresentationProfiles.json']=encoded(dict(schemaVersion=1,romSha256=sha(raw),
        soundTableAddress=0x212ffb8,soundTable=sound,impactDepthBiasQ12=depth,sequencePlayers=players,
        preludeTintTable=list(struct.unpack_from('<11H',data,0x2131bdc-ov.ramAddress)),
        hitSoundTable=list(struct.unpack_from('<21H',data,0x212ff2c-ov.ramAddress)),
        hitPauseTable=list(struct.unpack_from('<3I',data,word(0x021156a0)-ov.ramAddress)),
        knockoutSlowdownTable=list(struct.unpack_from('<3I',data,word(0x02112770)-ov.ramAddress)),
        knockoutSlowdownIndices=list(struct.unpack_from('<3I',data,word(0x0211276c)-ov.ramAddress)),
        classification='NUMERIC_ORIGINAL_PRESENTATION_TABLES'))
    assert all(x in (0,0xff00) or any(s['soundId']==x for s in sounds) for x in sound)
    return out

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--rom',type=Path,required=True);p.add_argument('--check',action='store_true');a=p.parse_args()
    outputs=build(a.rom.read_bytes())
    for path,data in outputs.items():
        if a.check: assert path.read_bytes()==data, f'STALE:{path}'
        else: path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    print(json.dumps({'files':len(outputs),'audioFiles':len(outputs)-2,'bytes':sum(map(len,outputs.values()))}))
