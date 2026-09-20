import {createNativeCharacterAnimationTimeline} from '/src/championship/presentation/characterAnimationTimeline.js';

const root=document.body;
const entity=root.dataset.entity,folder=root.dataset.folder;
const origin=root.dataset.origin.split(',').map(Number);
try {
  const bank=await (await fetch(folder+'/bank.json')).json();
  const contract=await (await fetch('/docs/art/production/characters/appearance-refresh-v1/generated/entities/'+entity+'/motion-contract.json')).json();
  const images=new Map();
  for(const [key,record] of Object.entries(bank.cells)){
    const image=new Image();image.src=folder+'/'+record.image;await image.decode();images.set(key,image);
  }
  for(const side of ['main','sub']){
    for(const raw of contract.sides[side].frameKeys){
      const key=raw.slice(bank.entityId.length+1),tile=document.createElement('div');tile.className='tile';
      const image=images.get(key);if(image)tile.append(image.cloneNode());
      const label=document.createElement('div');label.textContent=key.split('/')[1];tile.append(label);
      document.querySelector('#'+side).append(tile);
    }
  }
  const selector=document.querySelector('#sequence');
  for(const entry of bank.sequences){
    const source=contract.sides[entry.side].sequences.find(sequence=>sequence.id===entry.sequence.id);
    if(JSON.stringify(entry.sequence)!==JSON.stringify(source))throw Error('MOTION_CONTRACT_DRIFT');
    const option=document.createElement('option');option.value=entry.side+':'+entry.sequence.id;
    option.textContent=entry.side+' sequence '+entry.sequence.id;selector.append(option);
  }
  document.querySelector('#coverage').textContent=Object.keys(bank.cells).length+' 格 · '+bank.sequences.length+' 組 donor sequences · 美術候選待驗收';
  let selected,timeline,timer;
  const stop=()=>{clearInterval(timer);timer=null;};
  function draw(){
    const state=timeline.getSnapshot(),key=selected.side+'/cell_'+String(state.cell).padStart(3,'0'),image=images.get(key);
    if(!image)throw Error('MISSING_FRAME '+key);
    for(const id of ['native','four','large']){
      const canvas=document.querySelector('#'+id),ctx=canvas.getContext('2d'),zoom=canvas.width/64;
      ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
      ctx.strokeStyle='rgba(80,210,255,.6)';ctx.lineWidth=1;ctx.beginPath();
      ctx.moveTo(origin[0]*zoom+.5,0);ctx.lineTo(origin[0]*zoom+.5,canvas.height);
      ctx.moveTo(0,origin[1]*zoom+.5);ctx.lineTo(canvas.width,origin[1]*zoom+.5);ctx.stroke();
    }
    root.dataset.cell=String(state.cell);root.dataset.active=String(state.active);
    document.querySelector('#cell').textContent=key+' · frame '+state.frameIndex+' · elapsed Q12 '+state.elapsedQ12;
    return state;
  }
  function reset(){stop();timeline=createNativeCharacterAnimationTimeline(selected.sequence);draw();}
  function select(){
    selected=bank.sequences.find(entry=>entry.side+':'+entry.sequence.id===selector.value);
    document.querySelector('#timing').textContent=selected.sequence.frames.map(frame=>'cell '+frame.cell+': '+frame.ticks+' ticks').join(' → ');
    reset();
  }
  function step(){timeline.advanceNative(4096);if(!draw().active)stop();}
  selector.onchange=select;selector.value='main:7';select();
  document.querySelector('#play').onclick=()=>{reset();timer=setInterval(step,1000/30);};
  document.querySelector('#step').onclick=()=>{stop();step();};document.querySelector('#reset').onclick=reset;
  selector.disabled=false;for(const id of ['play','step','reset'])document.querySelector('#'+id).disabled=false;
  root.dataset.ready='true';
} catch(error) {
  document.querySelector('#error').textContent=String(error);throw error;
}
