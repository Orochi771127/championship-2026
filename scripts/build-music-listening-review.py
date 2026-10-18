"""Local, gain-matched review material; original files and runtime unmodified."""
import csv, hashlib, html, json, pathlib, subprocess, wave
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'reports/music-listening-review'
OUT.mkdir(parents=True,exist_ok=True)
CUES=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {ORIGINAL_MUSIC_CUES} from './src/championship/presentation/originalMusicCatalog.js';console.log(JSON.stringify(ORIGINAL_MUSIC_CUES))"],cwd=ROOT))
BASE_TEXT=subprocess.check_output(['git','show','19c91ac8:src/championship/presentation/originalMusicCatalog.js'],cwd=ROOT,text=True)
# The historical catalog's first section is a JSON object, before its routing maps.
BASE=json.loads(BASE_TEXT.split('Object.freeze(',1)[1].split('\n});',1)[0]+'}')
DETAIL=json.loads((ROOT/'docs/reports/music-repair-2026-10-18/SIGNAL_AUDIT.json').read_text())
MEASURES=json.loads((ROOT/'docs/reports/music-repair-2026-10-18/MEASUREMENTS.json').read_text(encoding='utf-8'))['files']
by_path={r['path']:r for r in MEASURES};details={r['path']:r for r in DETAIL['files']}
def pcm(path,ch):
 result=subprocess.run(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-acodec','pcm_f32le','-'],capture_output=True,check=True)
 return np.frombuffer(result.stdout,dtype='<f4').reshape(-1,ch)
def wav(name,data,sr):
 assert float(np.max(np.abs(data)))<1, 'Review preview must not clip: '+name
 with wave.open(str(OUT/name),'wb') as w:
  w.setnchannels(data.shape[1]);w.setsampwidth(2);w.setframerate(sr);w.writeframes((np.clip(data,-1,1)*32767).round().astype('<i2').tobytes())
rows=[]
for key,cue in CUES.items():
 path=cue['path'].removeprefix('./');m=by_path[path];detail=details[path];sr=m['sampleRate'];x=pcm(ROOT/path,m['channels'])
 existed=key in BASE
 before=BASE[key]['gainDb'] if existed else min(0,-3-m['truePeakDbtp'])
 after=cue['gainDb'];base=max(before,after)
 # Review files have at least 3 dBTP projected headroom, independent of HTML volume.
 base=min(base,-3-m['truePeakDbtp'])
 a=min(1,10**((before-base)/20));b=min(1,10**((after-base)/20));matched=min(a,b)
 duration=min(10,len(x)/sr);start=max(0,min(detail['strongPresenceExcerptSecond']-duration/2,len(x)/sr-duration))
 excerpt=x[int(start*sr):int((start+duration)*sr)]*10**(base/20)
 # 10ms edge fades belong only to the short review excerpt, to avoid artificial cuts.
 f=min(int(sr*.01),len(excerpt)//4);ramp=np.linspace(0,1,f)[:,None];excerpt=excerpt.copy();excerpt[:f]*=ramp;excerpt[-f:]*=ramp[::-1]
 aname=key+'_before.wav';bname=aname if before==after else key+'_after.wav'
 wav(aname,excerpt*a,sr)
 if bname!=aname:wav(bname,excerpt*b,sr)
 name=aname if a<=b else bname
 loopname=None
 if cue['loop']:
  first=int(cue['trimStart']*sr);end=len(x)-int(cue['trimEnd']*sr);fade=int(cue['crossfade']*sr)
  pre=x[max(first,end-int(2*sr)-fade):end-fade] if fade else x[max(first,end-int(2*sr)):end]
  if fade:
   fader=np.linspace(0,1,fade,endpoint=False)[:,None];join=x[end-fade:end]*(1-fader)+x[first:first+fade]*fader
   post=x[first+fade:first+fade+int(2*sr)];loop=np.concatenate([pre,join,post])
  else:loop=np.concatenate([pre,x[first:first+int(2*sr)]])
  loop=loop*10**(after/20);loopname=key+'_loop_simulation.wav';wav(loopname,loop,sr)
 rows.append({'id':key,'sourcePath':path,'sourceSha256':m['sha256'],'alreadyIn19c91ac8':existed,'beforeMeaning':'Runtime gain at 19c91ac8' if existed else 'Unprocessed original preview with safe peak attenuation; this track was not registered at baseline','beforeGainDb':before,'afterGainDb':after,'aPreviewPath':aname,'bPreviewPath':bname,'matchedPreviewPath':name,'gainMatchingEncodedInWav':True,'excerptStartSeconds':round(start,3),'excerptSeconds':duration,'previewPath':name,'loopSimulationPath':loopname,'listeningCompleted':False,'eqDenoiseApplied':False})
manifest={'scope':f'{len(CUES)} cues, primary encoding excerpts. {len(MEASURES)} encoding files independently screened. Local review only, not public payload.','method':'Native stereo decoding; safe base gain; 10ms fades only at review excerpt cuts. Default A/B matched to quieter runtime level. Matching cancels pure gain changes: identical tone is expected. No EQ/denoise applied. Loop examples numerically simulate catalog ramps at exact trim positions, not captured browser/device audio.','files':rows}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8',newline='\n')
cards=[]
for r in rows:
 cards.append('<article data-a="'+r['aPreviewPath']+'" data-b="'+r['bPreviewPath']+'" data-match="'+r['matchedPreviewPath']+'"><h2>'+html.escape(r['id'])+'</h2><p>'+('原遊戲增益' if r['alreadyIn19c91ac8'] else '原檔安全參考')+' '+str(r['beforeGainDb'])+' dB → 目前 '+str(r['afterGainDb'])+' dB；取樣 '+str(r['excerptStartSeconds'])+' 秒起。</p><label>A 先前／原檔參考<audio controls preload="none" src="'+r['matchedPreviewPath']+'" class="a"></audio></label><label>B 目前播放增益<audio controls preload="none" src="'+r['matchedPreviewPath']+'" class="b"></audio></label>'+('<details><summary>目前循環接點數值模擬（非真瀏覽器錄音）</summary><audio controls preload="none" src="'+r['loopSimulationPath']+'"></audio></details>' if r['loopSimulationPath'] else '')+'<p>高頻／雜音／失真聽感：待確認。沒有套用 EQ、降噪或去削波。</p></article>')
page='''<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>全曲音樂比較</title><style>body{font:16px/1.65 system-ui;max-width:900px;margin:auto;padding:24px;background:#111827;color:#e5e7eb}header{position:sticky;top:0;padding:14px;background:#111827f2}article{border-top:1px solid #4b5563;padding:16px 0}h1{font-size:24px}h2{font-size:19px}audio{display:block;width:100%;margin:8px 0 16px}label,summary{cursor:pointer}p{color:#cbd5e1}</style><header><h1>全曲比較：音量修復與聽感分開驗收</h1><label><input type="checkbox" id="match" checked>匹配 A/B 音量（預設開啟）</label><p>23 cues／28 編碼檔客觀檢查。A/B 的音色相同是預期結果：目前修復為增益、映射及恢復邏輯，沒有冒稱已消除來源失真或刺耳。音量匹配直接寫入 WAV，無需依賴手機的網頁音量控制。請以舒服音量比較；音量匹配後記錄刺耳時間點、雜音及接縫。</p></header>'''+''.join(cards)+'''<script>function volumes(){for(const card of document.querySelectorAll('article')){for(const side of ['a','b']){const a=card.querySelector('.'+side),src=card.dataset[document.getElementById('match').checked?'match':side];if(a.getAttribute('src')!==src){a.pause();a.setAttribute('src',src);a.load();}}}}document.getElementById('match').addEventListener('change',volumes);document.addEventListener('play',e=>{for(const a of document.querySelectorAll('audio'))if(a!==e.target)a.pause();},true);</script></html>'''
page=page.replace('23 cues／28 編碼檔',f'{len(CUES)} cues／{len(MEASURES)} 編碼檔')
(OUT/'index.html').write_text(page,encoding='utf-8',newline='\n')
referenced={r[k] for r in rows for k in ['aPreviewPath','bPreviewPath','matchedPreviewPath','loopSimulationPath'] if r[k]}
print(json.dumps({'cues':len(rows),'files':len(referenced),'referencedBytes':sum((OUT/p).stat().st_size for p in referenced),'gainMatchingEncodedInWav':True}))
