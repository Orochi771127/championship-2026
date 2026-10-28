// Reuse all current Battle fields and the existing authored terrain grids.
// The boundary comes from finishBattleHitNotification's native arena clamp:
// x=32..384, y=56+abs(x-208)/11 .. 272-abs(x-208)/11 native px.
// No collision is inferred from illustration alpha or decorative objects.
import terrain from '../../../data/championship/data-arena-relay-maps.v1.json' with {type:'json'};
import { DATA_ARENA_TERRAIN as T, DATA_ARENA_DUEL_MAP } from './dataArenaConfig.js';
import { relayFieldLayout } from './dataArenaRelayArena.js';

export const RELAY_MAP_IDS=Object.freeze(Array.from({length:11},(_,i)=>`field_bm${String(i+1).padStart(2,'0')}_01`));
const terrainById=Object.fromEntries(terrain.fields.map(f=>[f.fieldId,f]));
const legend={'.':T.GROUND,'~':T.SHALLOW,'w':T.WATER,'=':T.WATER,'#':T.SOLID,'L':T.LAVA};
export function relayRotateCell([c,r],rows=34) { return [rows-1-r,c]; }
export function relayRotateRect([c,r,w,h,...tail],rows=34) { return [rows-r-h,c,h,w,...tail]; }

export function relayBattleMap(fieldId,portrait=false) {
  if(!fieldId)return DATA_ARENA_DUEL_MAP;
  if(!RELAY_MAP_IDS.includes(fieldId))throw new RangeError('RELAY_UNKNOWN_FIELD');
  const doc=terrainById[fieldId],rects=[],naturalIce=[],cells=[];
  for(let r=0;r<34;r++) {
    const row=[];
    for(let c=0;c<52;c++) {
      const x=(c+.5)*8,y=(r+.5)*8,slope=Math.abs(x-208)/11;
      const symbol=doc?.grid[r]?.[c]??'.';
      const kind=x<32||x>384||y<56+slope||y>272-slope?T.SOLID:legend[symbol];
      row.push(kind);
      if(symbol==='='&&kind===T.WATER)naturalIce.push([c,r,1,1]);
    }
    cells.push(row);
    for(let c=0;c<52;) { const first=c,kind=row[c++];while(c<52&&row[c]===kind)c++;if(kind!==T.GROUND)rects.push([first,r,c-first,1,kind]); }
  }
  // Both spawns are on dry ground in the same traversable connected component.
  const dry=(c,r)=>cells[r]?.[c]===T.GROUND||cells[r]?.[c]===T.SHALLOW||naturalIce.some(a=>a[0]===c&&a[1]===r);
  const candidates=[];for(let r=10;r<30;r++)for(let c=6;c<46;c++)if(dry(c,r)&&dry(c-1,r)&&dry(c+1,r)&&dry(c,r-1)&&dry(c,r+1))candidates.push([c,r]);
  const nearest=(point,list)=>[...list].sort((a,b)=>Math.hypot(a[0]-point[0],a[1]-point[1])-Math.hypot(b[0]-point[0],b[1]-point[1]))[0];
  const player=nearest([32,19],candidates),seen=new Set([player.join(',')]),queue=[player];
  for(let i=0;i<queue.length;i++)for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]) { const [c,r]=queue[i],p=[c+dc,r+dr],key=p.join(',');if(dry(...p)&&!seen.has(key)){seen.add(key);queue.push(p);} }
  const rival=nearest([19,19],candidates.filter(p=>seen.has(p.join(','))));
  // Stage three (2026-10-28): destructible cover becomes SOLID rects over the
  // walkable grid; natural ice under a block is removed so a broken block
  // leaves plain ground. Zones are cell centres for the timed arena events.
  const layout=relayFieldLayout(fieldId,cells,new Set(naturalIce.map(([c,r])=>`${c},${r}`)),player,rival);
  const covered=new Set(layout.cover.flatMap(([c,r,w,h])=>Array.from({length:w*h},(_,i)=>`${c+i%w},${r+Math.floor(i/w)}`)));
  const ice=naturalIce.filter(([c,r])=>!covered.has(`${c},${r}`));
  const cover=layout.cover.map(block=>({rectIndex:rects.push([...block,T.SOLID])-1,block}));
  const point=p=>portrait?relayRotateCell(p):p;
  const rect=r=>portrait?relayRotateRect(r):r;
  return {battleFieldId:fieldId,portrait,cell:32,cols:portrait?34:52,rows:portrait?52:34,
    rects:rects.map(rect),
    naturalIce:ice.map(rect),
    stage:null,pylons:[],flammable:[],pods:[],beacons:[],fireCores:[],gates:[],
    cover:cover.map(({rectIndex,block})=>({rectIndex,rect:rect(block)})),coverMaterial:layout.theme?.material??null,
    arenaZones:layout.zones.map(point),
    playerSpawn:point(player),mateSpawn:point(player),rivalSpawn:point(rival),bossSpawn:point(rival)};
}
