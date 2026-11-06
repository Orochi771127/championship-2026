// Narrow lossless decoder for the hash-pinned QA sheet. Not a general image parser.
// Decode the 8-bit RGBA, non-interlaced PNG directly so Canvas colour management
// cannot alter the bytes before the candidate crop hash is checked.
export async function decodeSnapshotQaPng(input) {
  const bytes = new Uint8Array(input), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fail = () => { throw Error('SNAPSHOT_QA_PNG_FORMAT'); };
  if (bytes.length < 33 || [137,80,78,71,13,10,26,10].some((v,i)=>bytes[i]!==v)) fail();
  let width, height, offset=8, ended=false;
  const parts=[];
  while (offset+12<=bytes.length) {
    const length=view.getUint32(offset), kind=String.fromCharCode(...bytes.subarray(offset+4,offset+8));
    if (offset+12+length>bytes.length) fail();
    const data=bytes.subarray(offset+8,offset+8+length);
    if (kind==='IHDR') {
      if (offset!==8 || length!==13) fail();
      width=view.getUint32(offset+8); height=view.getUint32(offset+12);
      if (!width || !height || width>4096 || height>4096 || data[8]!==8 || data[9]!==6 || data[10]!==0 || data[11]!==0 || data[12]!==0) fail();
    } else if (kind==='IDAT') { if (!width) fail(); parts.push(data); }
    else if (kind==='IEND') { if (length!==0) fail(); ended=true; offset+=12; break; }
    else if ((bytes[offset+4]&32)===0) fail();
    offset+=12+length;
  }
  if (!ended || offset!==bytes.length || !parts.length) fail();
  const reader=new Blob(parts).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
  const expected=height*(width*4+1), filtered=new Uint8Array(expected);
  let used=0;
  try {
    while (true) { const {done,value}=await reader.read(); if(done)break;
      if(used+value.length>expected){await reader.cancel();fail();}
      filtered.set(value,used);used+=value.length;
    }
  } finally { reader.releaseLock(); }
  if(used!==expected)fail();
  const stride=width*4, rgba=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++) {
    const filter=filtered[y*(stride+1)];if(filter>4)fail();
    for(let x=0;x<stride;x++) {
      const i=y*stride+x, a=x>=4?rgba[i-4]:0, b=y?rgba[i-stride]:0, c=y&&x>=4?rgba[i-stride-4]:0;
      let prediction=0;
      if(filter===1)prediction=a;
      if(filter===2)prediction=b;
      if(filter===3)prediction=Math.floor((a+b)/2);
      if(filter===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);prediction=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
      rgba[i]=(filtered[y*(stride+1)+x+1]+prediction)&255;
    }
  }
  return {width,height,rgba};
}

export function snapshotQaCrop(image, rect) {
  const [x,y,w,h]=rect;
  if(!rect.every(Number.isSafeInteger)||x<0||y<0||w<=0||h<=0||x+w>image.width||y+h>image.height)throw Error('SNAPSHOT_QA_CROP_RANGE');
  const out=new Uint8Array(w*h*4);
  for(let row=0;row<h;row++)out.set(image.rgba.subarray(((y+row)*image.width+x)*4,((y+row)*image.width+x+w)*4),row*w*4);
  return out;
}

export function snapshotQaPremultiply(rgba) {
  // GPU upload representation only. Never mutate the verified straight RGBA.
  const out=new Uint8Array(rgba);
  for(let i=0;i<out.length;i+=4)for(let k=0;k<3;k++)out[i+k]=Math.round(out[i+k]*out[i+3]/255);
  return out;
}
