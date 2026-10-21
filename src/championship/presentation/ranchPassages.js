// Connections belong to navigation. Owner direction: preserve the original
// water, grass and floor surfaces without painting additional path overlays.
// This also applies to the 2D fallback; original model bridges remain intact.
export async function withRanchPassages({art,connections=[]}) {
  if(!art?.field?.productGrid)return art;
  return Object.freeze({...art,getDiagnostics(){
    return {...art.getDiagnostics(),ranchPassages:connections.length,ranchPassageAppearance:'invisible'};
  }});
}
