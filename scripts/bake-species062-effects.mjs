// Candidate-only technical Canvas bake; never loaded by the application.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const [base,out='.tmp/browser-qa/species062-effect-bake']=process.argv.slice(2);
assert.ok(base&&['localhost','127.0.0.1'].includes(new URL(base).hostname));
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();await page.goto(new URL('tests/fixtures/species062-effect-bake/index.html',base).href);
 const result=await page.evaluate(async()=>{
  const fail=(x,m)=>{if(!x)throw Error(m)};const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const prefix='tests/fixtures/species062-effect-bake/';const manifest=await (await fetch('/'+prefix+'manifest.json')).json();
  fail(JSON.stringify(manifest.originRaster)==='[112,148]'&&manifest.density===4,'CONTRACT');
  const canvas=()=>{const c=document.createElement('canvas');c.width=c.height=256;return c;};
  const read=async blob=>{const b=await createImageBitmap(blob);fail(b.width===256&&b.height===256,'SIZE');const c=canvas(),ctx=c.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;ctx.drawImage(b,0,0);b.close();return{c,ctx,data:ctx.getImageData(0,0,256,256)}};
  const alpha=d=>Uint8Array.from({length:65536},(_,i)=>d[i*4+3]);
  const bases={};for(const s of manifest.sources){const bytes=await(await fetch('/'+prefix+s.file)).arrayBuffer();fail(await hash(bytes)===s.sha256,'BASE_HASH');const b=await read(new Blob([bytes]));fail(await hash(alpha(b.data.data))===s.alphaSha256,'BASE_DECODED_ALPHA');bases[s.cell]=b;}
  const outputs=[];
  for(const r of manifest.recipes){
   const b=bases[r.baseCell],c=canvas(),ctx=c.getContext('2d',{willReadFrequently:true});const d=new ImageData(new Uint8ClampedArray(b.data.data),256,256);let eyePixels=0;
   for(let i=0;i<65536;i++){
    const o=i*4,a=b.data.data[o+3];if(!a){d.data[o]=d.data[o+1]=d.data[o+2]=0;continue;}
    let rgb;
    if(r.effect==='white')rgb=[255,255,255];
    else if(r.effect==='dark-eye'){
     rgb=[32,32,32];const e=r.eyeMask,dx=(i%256+.5-e.center[0]),dy=(Math.floor(i/256)+.5-e.center[1]);const cs=Math.cos(e.rotationRadians),sn=Math.sin(e.rotationRadians);const x=(dx*cs+dy*sn)/e.radii[0],y=(-dx*sn+dy*cs)/e.radii[1];
     if(x*x+y*y<=1){rgb=[255,255,255];eyePixels++;}
    }else{
     const lum=(.2126*b.data.data[o]+.7152*b.data.data[o+1]+.0722*b.data.data[o+2])/255;
     const t=lum*(r.palette.length-1),j=Math.min(Math.floor(t),r.palette.length-2),f=t-j;
     rgb=r.palette[j].map((v,k)=>Math.round(v*(1-f)+r.palette[j+1][k]*f));
    }
    d.data[o]=rgb[0];d.data[o+1]=rgb[1];d.data[o+2]=rgb[2];d.data[o+3]=a;
   }
   if(r.eyeMask)fail(eyePixels>=3&&eyePixels<=12,'BOUNDED_CURRENT_EYE_MASK');
   ctx.putImageData(d,0,0);const url=c.toDataURL('image/png');const decoded=await read(await(await fetch(url)).blob());
   fail(await hash(alpha(decoded.data.data))===await hash(alpha(b.data.data)),'EXPORTED_ALPHA_EXACT');
   outputs.push({cell:r.cell,baseCell:r.baseCell,png:url.split(',')[1],alphaSha256:await hash(alpha(decoded.data.data)),alphaExact:true,eyePixels});
  }
  const sheet=document.createElement('canvas');sheet.width=5*256;sheet.height=2*292;const sc=sheet.getContext('2d');sc.font='14px sans-serif';
  for(let row=0;row<2;row++)for(let col=0;col<outputs.length;col++){
   const x=col*256,y=row*292;sc.fillStyle=row?'#233241':'#ece9e2';sc.fillRect(x,y,256,292);sc.fillStyle=row?'#ffffff':'#222222';sc.fillText(`${String(outputs[col].cell).padStart(3,'0')} candidate / base ${outputs[col].baseCell}`,x+10,y+20);
   const img=await createImageBitmap(await(await fetch('data:image/png;base64,'+outputs[col].png)).blob());sc.drawImage(img,x,y+32);img.close();
  }
  return{outputs,sheet:sheet.toDataURL('image/png').split(',')[1],manifest,status:'ALPHA_EXACT_CANDIDATES_PENDING_VISUAL_REVIEW',productionChanged:false,renderer:'Browser Canvas2D ImageData effect bake; no resizing or source mutation'};
 });
 for(const o of result.outputs){const bytes=Buffer.from(o.png,'base64');await fs.writeFile(`${out}/main-cell_${String(o.cell).padStart(3,'0')}-effect-candidate-density4.png`,bytes);o.sha256=crypto.createHash('sha256').update(bytes).digest('hex');delete o.png;}
 await fs.writeFile(`${out}/EFFECT_CANDIDATES_ACTUAL256_LIGHT_DARK.png`,Buffer.from(result.sheet,'base64'));delete result.sheet;
 assert.equal(result.outputs.length,5);assert.ok(result.outputs.every(x=>x.alphaExact));await fs.writeFile(`${out}/BAKE_REPORT.json`,JSON.stringify(result,null,2));
} catch(error){await fs.writeFile(`${out}/FAILURE.json`,JSON.stringify({error:String(error),stack:error.stack},null,2));throw error;}finally{await browser.close();}
