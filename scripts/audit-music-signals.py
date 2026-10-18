"""Read-only native stereo signal screening; no noise/harshness diagnosis by FFT."""
import concurrent.futures, json, pathlib, subprocess
import numpy as np

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'reports/music-signal-audit'; OUT.mkdir(parents=True,exist_ok=True)
CUES=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {ORIGINAL_MUSIC_CUES} from './src/championship/presentation/originalMusicCatalog.js';console.log(JSON.stringify(ORIGINAL_MUSIC_CUES))"],cwd=ROOT))
ROWS=json.loads((ROOT/'docs/reports/music-repair-2026-10-18/MEASUREMENTS.json').read_text(encoding='utf-8'))['files']
def db(x):return round(float(20*np.log10(max(float(x),1e-15))),3)
def longest(mask):
 a=np.diff(np.r_[False,mask,False].astype(np.int8)); starts=np.where(a==1)[0];ends=np.where(a==-1)[0]
 return int(max(ends-starts,default=0))
def inspect(row):
 p=ROOT/row['path'];cue_id,cue=next((k,c) for k,c in CUES.items() if './'+row['path'] in [c['path'],c.get('fallbackPath')])
 sr=row['sampleRate'];ch=row['channels'];g=10**(cue['gainDb']/20)
 proc=subprocess.run(['ffmpeg','-v','error','-i',str(p),'-f','f32le','-acodec','pcm_f32le','-'],capture_output=True)
 if proc.returncode:raise RuntimeError(proc.stderr.decode())
 x=np.frombuffer(proc.stdout,dtype='<f4').reshape(-1,ch)
 n=len(x);mag=np.abs(x);delta=np.diff(x,axis=0)
 # Non-overlapping 4096-sample Hann spectra. Ratios and tones are candidates only.
 hop=4096;frames=x[:n//hop*hop].reshape(-1,hop,ch).mean(axis=2)
 spec=np.abs(np.fft.rfft(frames*np.hanning(hop),axis=1))**2;freq=np.fft.rfftfreq(hop,1/sr)
 powers=spec.sum(axis=1);total=spec.sum(axis=0);total_power=max(total.sum(),1e-20)
 ratios={str(lo)+'-'+str(hi):round(float(total[(freq>=lo)&(freq<hi)].sum()/total_power),7) for lo,hi in [(20,250),(250,2000),(2000,5000),(5000,10000),(10000,20000)]}
 hi=(freq>=2000)&(freq<10000);positions=np.where(hi)[0]
 smooth=np.convolve(total,np.ones(31)/31,'same');prominence=10*np.log10(np.maximum(total,1e-30)/np.maximum(smooth,1e-30));order=positions[np.argsort(total[positions])[-5:][::-1]]
 tones=[{'hz':round(float(freq[i]),1),'prominenceDbVs31BinMean':round(float(prominence[i]),2)} for i in order]
 window=max(1,sr//50);rms=np.sqrt(np.mean(x[:n//window*window].reshape(-1,window,ch)**2,axis=(1,2)))
 start=int(round(cue['trimStart']*sr));end=n-int(round(cue['trimEnd']*sr));duration=(end-start)/sr
 seam=None
 if cue['loop']:
  tail=x[max(start,end-sr):end];head=x[start:min(end,start+sr)]
  jump=float(np.max(np.abs(x[end-1]-x[start])))
  fade=min(int(cue['crossfade']*sr),end-start)
  if fade:
   ramp=np.linspace(0,1,fade,endpoint=False,dtype=np.float32)[:,None]
   blend=x[end-fade:end]*(1-ramp)+x[start:start+fade]*ramp
   context=np.concatenate([x[max(start,end-fade-sr//10):end-fade],blend,x[start+fade:min(end,start+fade+sr//10)]])
   boundary_jump=max(float(np.max(np.abs(blend[0]-x[end-fade-1]))) if end-fade>start else 0,float(np.max(np.abs(x[start+fade]-blend[-1]))) if start+fade<end else 0)
   peak=float(np.max(np.abs(context)));jump_after=boundary_jump
  else: peak=max(float(np.max(np.abs(head))),float(np.max(np.abs(tail))));jump_after=jump
  seam={'trimmedDecodedSeconds':round(duration,6),'nativeHardJoinJumpDbfs':db(jump),'crossfadeSeconds':cue['crossfade'],'simulatedBoundaryStepAfterGainDbfs':db(jump_after*g),'simulatedSeamPeakAfterGainDbfs':db(peak*g),'simulation':'Linear 0.8s ramps at exact trim points; not a captured browser render. Native loop when crossfade=0. Jitter/codec buffering need real-browser/device listening.'}
 # A flat run at the exact digital rail is evidence; above-rail decoded lossy samples alone are NOT source clipping proof.
 rail=(mag>=.9999)&(mag<=1.0001)
 flat_runs=[longest(rail[:-1,c]&(np.abs(delta[:,c])<1e-7)) for c in range(ch)]
 loud_index=int(np.argmax(spec[:,hi].sum(axis=1)))*hop/sr
 return {'id':cue_id,'path':row['path'],'sampleRate':sr,'channels':ch,'decodedSamplesPerChannel':n,'sourceSamplePeakDbfs':db(mag.max()),'projectedSamplePeakAfterGainDbfs':db(mag.max()*g),'sourceOverZeroDbfsSamples':int((mag>1).sum()),'nearRailFlatRunSamplesPerChannel':flat_runs,'dcOffsetDbfs':db(np.max(np.abs(x.mean(axis=0)))),'maxSourceAdjacentSampleStepDbfs':db(np.max(np.abs(delta))),'sourceDerivativeP999Dbfs':db(np.quantile(np.abs(delta),.999)),'quiet20msRmsP05Dbfs':db(np.quantile(rms,.05)),'max20msRmsDbfs':db(rms.max()),'spectralEnergyShareNativeMono':ratios,'strongPresenceBins':tones,'strongPresenceExcerptSecond':round(loud_index,3),'loop':seam,'decodeError':None,'listeningCompleted':False,'noiseAssessment':'Unknown: musical tails, intentional distortion and noise textures cannot be separated from unwanted noise by these statistics.','eqDecision':'No automatic EQ or denoise from energy/tonality alone. Retain original until matched-level listening identifies a specific defect.'}

results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for r in pool.map(inspect,ROWS):
  results.append(r)
  (OUT/'signal-audit.json').write_text(json.dumps({'method':'Native stereo float PCM; exact sample/rail, DC, derivative, quiet-window, spectral and trim/crossfade screening. All candidates require listening; no claim to remove baked-in source distortion.','files':results},indent=2)+'\n',encoding='utf-8',newline='\n')
  print(json.dumps({k:r[k] for k in ['id','sourceSamplePeakDbfs','nearRailFlatRunSamplesPerChannel','loop']}),flush=True)
