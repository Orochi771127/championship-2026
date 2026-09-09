// OVL1 0210BC14..0210BDC8 and ARM9 020892B0: the eight-day interstitial.
// Existing calendar and title outcomes are inputs, never another clock/store.
import titles from '../../data/championship/catalogs/battle-title-events.r1.json' with {type:'json'};
export function projectNativeRaisingCalendar({year,season,dayOfSeason,progressCounter,registered=[],won=[],championship=null}) {
  const days=Array.from({length:8},(_,day)=>({day,registered:0,unwon:0}));
  const registeredSet=new Set(registered),wonSet=new Set(won);
  for(const [index,record] of titles.records.slice(0,61).entries()) {
    if(record.field14!==season||record.field10>(progressCounter>>>1))continue;
    // +BC is the player's registration toggle (020895DC/02089600).
    // +C0 is cleared-title history (OVL8 0210D238), not attempts.
    if(registeredSet.has(index))days[record.field18].registered++;
    else if(!wonSet.has(index))days[record.field18].unwon++;
  }
  const stage=championship?.stage??0;
  if(stage>=1&&season===2&&(championship.entry||championship.worldEntry))days[4].registered++;
  let countdown=null;
  if(stage>=1&&Number.isInteger(year)){
    // 0210B904..0210B9C4 uses signed remainder, including controlled out-of-
    // cycle inputs. Do not repair those into an invented positive countdown.
    let cycle=year-3,s=season-2,d=dayOfSeason-4;
    if(cycle<0)cycle+=4;
    if(s<0){s+=4;if(--cycle<0)cycle+=4;}
    if(d<0){d+=8;if(--s<0){s+=4;if(--cycle<0)cycle+=4;}}
    const distance=(128-(cycle*32+s*8+d))%128;
    countdown=(stage===1?(distance<32?32+distance%32:distance%32):distance)||0;
  }
  return Object.freeze({year,season,dayOfSeason,countdown,days:Object.freeze(days.map(Object.freeze))});
}
