// Test-only mask analysis. Each input pair MUST be same target, camera, pose and dimensions.
export function measureResolvedCoverage(reference, actual, width, height) {
 if (!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||reference.length!==width*height*4||actual.length!==reference.length) throw Error('COVERAGE_DIMENSION_MISMATCH');
 const out={referenceIntensity:0,actualIntensity:0,lostIntensity:0,excessIntensity:0,referenceNonzeroPixels:0,actualNonzeroPixels:0,referenceFullPixels:0,actualFullPixels:0,referencePartialPixels:0,actualPartialPixels:0,deficitPixels:0,excessPixels:0,maxDeficit:0,maxExcess:0,transitions:{},scope:'SAME_TARGET_RESOLVED_RGB_NOT_MATERIAL_ALPHA_OR_CROSS_AA_EQUALITY'};
 for(let i=0;i<reference.length;i+=4){
  const r=reference[i],a=actual[i];
  if(reference[i+1]!==r||reference[i+2]!==r||actual[i+1]!==a||actual[i+2]!==a)throw Error('MASK_NOT_GRAYSCALE');
  out.referenceIntensity+=r;out.actualIntensity+=a;
  if(r>0)out.referenceNonzeroPixels++;if(a>0)out.actualNonzeroPixels++;
  if(r===255)out.referenceFullPixels++;else if(r>0)out.referencePartialPixels++;
  if(a===255)out.actualFullPixels++;else if(a>0)out.actualPartialPixels++;
  if(r>a){out.deficitPixels++;out.lostIntensity+=r-a;out.maxDeficit=Math.max(out.maxDeficit,r-a);}
  if(a>r){out.excessPixels++;out.excessIntensity+=a-r;out.maxExcess=Math.max(out.maxExcess,a-r);}
  if(a!==r){const key=r+'->'+a;out.transitions[key]=(out.transitions[key]??0)+1;}
 }
 if(out.referenceIntensity===0)throw Error('EMPTY_COVERAGE_REFERENCE');
 out.lostFullWhitePixelEquivalent=out.lostIntensity/255;
 out.lostFractionOfReferenceIntensity=out.lostIntensity/out.referenceIntensity;
 out.exactCoverageEqual=out.deficitPixels===0&&out.excessPixels===0;
 return out;
}
