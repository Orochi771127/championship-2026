"""Offline audit of manually reviewed anatomical bands; no runtime segmentation."""
from pathlib import Path
import hashlib,json
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/reports/character-contact-2026-10-15'
selection=json.loads((ROOT/'src/data/championship/accepted-original-character-selection.r1.json').read_text())
expected={
 'm104_tunomon':'32b9dbbf2141a8e3fc50ced49cef1f5550ad6c11beb0059ebee67ac15545f4c0',
 'm006_punimon':'25eccc707afdcc757837b0fb8aa178b2e37bc0eba16c6c3741e1e4e68af8f480',
 'm203_elecmon':'d125d563dc1199d1dbd93224a8c2b59c43322ccbbcb8ba6788b8fdc95b81b5ed'
}
# These regions were chosen anatomically in enlarged original-coordinate
# pixel views. Alpha threshold measures the chosen bands, not body detection.
regions={
 'm104_tunomon':{0:[[69,132,82,137],[82,132,98,137],[98,132,113,137]],1:[[67,132,80,138],[79,132,94,138],[95,132,111,138]],4:[[74,133,96,138],[101,131,120,137]]},
 'm006_punimon':{0:[[80,148,106,154]],1:[[79,148,108,154]],4:[[80,148,106,154]],5:[[66,148,96,154]],23:[[72,150,113,155]]},
 'm203_elecmon':{0:[[66,147,80,154],[91,149,109,155],[112,145,129,153],[140,147,156,154]],1:[[65,147,82,154],[92,149,110,155],[115,145,133,153],[140,147,157,154]],4:[[49,151,68,158],[84,151,105,158],[103,148,121,156],[129,150,148,158]],5:[[74,150,94,157],[102,152,121,158],[124,148,142,156],[153,146,170,155]]}
}
rows=[]
for entity,cells in regions.items():
 config=next(c for c in selection['characters'] if c['entityId']==entity)
 folder=ROOT/selection['root']/config['folder'];atlas_path=folder/'main.webp';digest=hashlib.sha256(atlas_path.read_bytes()).hexdigest()
 assert digest==expected[entity],entity
 atlas=Image.open(atlas_path).convert('RGBA');metadata=json.loads((folder/'main.json').read_text());runtime=json.loads((folder/'runtime.review.json').read_text())
 for cell,bands in cells.items():
  key=entity+'/main/cell_'+str(cell).zfill(3);f=metadata['frames'][key];rect=f['frame'];trim=f['spriteSourceSize'];geometry=runtime['reviewGeometry']['frames'][key]
  crop=atlas.crop((rect['x'],rect['y'],rect['x']+rect['w'],rect['y']+rect['h']));image=Image.new('RGBA',(256,256));image.paste(crop,(trim['x'],trim['y']));alpha=image.getchannel('A');soles=[]
  for band in bands:
   bounds=alpha.crop(band).point(lambda p:255 if p>=128 else 0).getbbox();assert bounds is not None
   soles.append([bounds[0]+band[0],bounds[1]+band[1],bounds[2]+band[0],bounds[3]+band[1]])
  refs=[{'sequenceId':a['id'],'frameIndex':i,'ticks':raw['ticks']} for a in runtime['sides']['main']['animations'] for i,raw in enumerate(a['frames']) if raw['texture']==key]
  rows.append({'entityId':entity,'speciesId':config['speciesId'],'atlasPath':str(atlas_path.relative_to(ROOT)).replace('\\','/'),'atlasSha256':digest,'sourceBankSha256':config['sourceBankSha256'],'cell':cell,'sequenceFrames':refs,'atlasRect':rect,'geometry':geometry,'alphaThreshold':128,'manualRegions':bands,'soleBands':soles,'pose':'BODY_SUPPORT' if entity=='m006_punimon' and cell==23 else 'GROUND_SUPPORT'})
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'pixel-measurements.json').write_text(json.dumps({'schemaVersion':1,'sourceBase':'b01ed619375641f5578b2bc65883ebfa32ad8914','method':'Human-selected anatomical bands, exclusive right/bottom pixel coordinates; threshold128 offline only. No runtime alpha readback or automatic segmentation.','rows':rows,'knownAirPose':{'entityId':'m104_tunomon','sequenceId':2,'frameIndex':1,'cell':5,'nativeBoundsBottom':-2,'classification':'AIR_POSE_AT_ZERO_WORLD_Z','behavior':'Idle landing footprint retained; body not regrounded.'},'otherPoses':'UNKNOWN; reuse the measured idle landing footprint, no full-body or species-flight acceptance.'},indent=2)+'\n')
print('PASS',len(rows),'reviewed support cells; 3 exact atlas hashes; no art writes')
