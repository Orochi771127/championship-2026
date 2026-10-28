import {showChoiceDialog} from './uiDialog.js';
import {uiText} from '../text/uiText.js';
import {formatNumber} from '../text/locale.js';
import {shopItemName} from '../text/zhHant.js';
import {shopGoodsPresentation} from '../presentation/shopGoodsUiArt.js';
import {RANCH_DISCOVERY_REWARDS} from '../raising/ranchDiscoveries.js';
import {STROLL_REWARDS} from '../raising/ranchPartnerLife.js';
import {getCageDefinition} from '../cage/cageCatalog.js';
import {cageName,localizeSpeciesCodes} from '../text/zhHant.js';
import {formatWorldClockTime} from '../time/championshipWorldClock.js';
const copy=()=>Object.fromEntries(["title", "about", "empty", "none", "full", "collect", "close", "food", "herb", "bits", "rare", "partner", "path", "blocked", "saved", "failed"].map(key=>[key,uiText(`RANCH_JOURNAL_${key.toUpperCase()}`)]));
const BITS_ICON=new URL('../../../assets/production/public-media-clean-20261017/currency-hud-r1/bits-48.png',import.meta.url).href;
// Opens the journal from the System menu as well as from its badge.
export const RANCH_JOURNAL_OPEN_EVENT='cm-open-ranch-journal';

/** What a find really is: the shop record (or gold) the collect step credits. */
export function ranchDiscoveryReward(kind){
  const reward=RANCH_DISCOVERY_REWARDS[kind];
  if(!reward)return null;
  if(reward.bits)return {kind,bits:reward.bits,quantity:reward.bits,name:'金幣',src:BITS_ICON};
  let src=null;try{src=shopGoodsPresentation(reward.record)?.src??null;}catch{src=null;}
  return {kind,record:reward.record,quantity:reward.quantity,name:shopItemName(reward.record)??`${reward.record}`,src};
}
/** Totals per reward, in first-seen order, for a list of finds. */
export function ranchDiscoveryTotals(entries){
  const totals=new Map();
  for(const entry of entries){
    const reward=ranchDiscoveryReward(entry.kind);if(!reward)continue;
    const key=reward.bits?'bits':`record:${reward.record}`;
    const seen=totals.get(key);totals.set(key,seen?{...seen,quantity:seen.quantity+reward.quantity}:reward);
  }
  return [...totals.values()];
}
function rewardRow(doc,reward,label){
  const row=doc.createElement('p');row.className='int-rh2-discovery-item';row.dataset.kind=reward.kind;
  const art=doc.createElement('span');art.className='int-rh2-discovery-item__art';
  if(reward.src){const img=doc.createElement('img');img.src=reward.src;img.alt='';art.append(img);}
  const text=doc.createElement('span');text.className='int-rh2-discovery-item__text';text.textContent=label;
  const count=doc.createElement('strong');count.className='int-rh2-discovery-item__count';count.textContent=`×${formatNumber(reward.quantity)}`;
  row.append(art,text,count);return row;
}

// 逛街手札 (Owner 2026-10-28): what partners found on their strolls and who met
// whom, newest first, read from the saved stroll log. A name saved by an older
// build as an internal code ("SPECIES 084") reads as its catalog name.
const STROLL_SEASONS=['春季','夏季','秋季','冬季'];
const STROLL_TOOL_SLOTS={feed:'餵食',protein:'蛋白質',medicine:'藥品',woundMedicine:'傷藥'};
const strollName=name=>localizeSpeciesCodes(name)??'';
// Stand-ins for the names while the sentence is localized, so each name can be
// drawn as its own chip wherever the language puts it.
const NAME_MARKS={a:'⁣A⁣',b:'⁣B⁣'};
function strollLogParts(entry,names){
  const when=uiText('{season} 第{day}日 {time}',{season:uiText(STROLL_SEASONS[entry.season]??''),day:entry.day+1,time:formatWorldClockTime(entry.minute)});
  const place=Number.isInteger(entry.cage)?cageName(entry.cage,getCageDefinition(entry.cage)?.displayName??null):null;
  const item=uiText('【{item} ×{n}】',{item:uiText(STROLL_REWARDS[entry.reward]?.label??entry.reward),n:entry.quantity});
  const slot=STROLL_TOOL_SLOTS[entry.reward];
  const stored=slot?uiText('（已放入{slot}欄）',{slot:uiText(slot)}):uiText('（已存入錢包）');
  const what=entry.kind==='greeting'
    ?uiText(place?'{a} 和 {b} 在{place}相遇打招呼，一起找到了{item}':'{a} 和 {b} 相遇打招呼，一起找到了{item}',{a:names.a,b:names.b,place:uiText(place??''),item})
    :uiText(place?'{name}在{place}散步，找到了{item}':'{name}散步時找到了{item}',{name:names.a,place:uiText(place??''),item});
  return {when,what,stored,item};
}
export function strollLogLine(entry){
  const {when,what,stored}=strollLogParts(entry,{a:strollName(entry.partnerName),b:strollName(entry.partnerBName)});
  return `${when} — ${what}${stored}`;
}
function strollLogRow(doc,entry){
  const row=doc.createElement('li');row.dataset.kind=entry.kind;row.dataset.reward=entry.reward;
  if(entry.relation)row.dataset.relation=entry.relation;
  const {when,what,stored,item}=strollLogParts(entry,NAME_MARKS);
  const time=doc.createElement('span');time.className='int-rh2-stroll-log__when';time.textContent=when;
  const text=doc.createElement('span');text.className='int-rh2-stroll-log__text';
  const names={[NAME_MARKS.a]:strollName(entry.partnerName),[NAME_MARKS.b]:strollName(entry.partnerBName)};
  for(const piece of `${what}${stored}`.split(/(⁣[AB]⁣)/u)){
    if(!piece)continue;
    if(Object.hasOwn(names,piece)){
      const chip=doc.createElement('span');chip.className='int-rh2-stroll-log__name';chip.dataset.role=piece===NAME_MARKS.a?'a':'b';
      chip.textContent=names[piece];text.append(chip);continue;
    }
    const at=piece.indexOf(item);
    if(at<0){text.append(doc.createTextNode(piece));continue;}
    if(at>0)text.append(doc.createTextNode(piece.slice(0,at)));
    const pill=doc.createElement('span');pill.className='int-rh2-stroll-log__item';pill.textContent=item;text.append(pill);
    if(at+item.length<piece.length)text.append(doc.createTextNode(piece.slice(at+item.length)));
  }
  row.setAttribute('aria-label',strollLogLine(entry));
  row.append(time,text);return row;
}
function strollSection(doc,log){
  const section=doc.createElement('section');section.className='int-rh2-stroll-log';
  const head=doc.createElement('h3');head.className='int-rh2-stroll-log__title';head.textContent=uiText('逛街手札');section.append(head);
  const entries=[...(log?.entries??[])].reverse().slice(0,12);
  if(!entries.length){const empty=doc.createElement('p');empty.className='int-rh2-stroll-log__empty';empty.textContent=uiText('拍檔散步時找到的東西會記在這裡。');section.append(empty);return section;}
  const list=doc.createElement('ol');list.className='int-rh2-stroll-log__list';
  for(const entry of entries)list.append(strollLogRow(doc,entry));
  section.append(list);return section;
}

export function mountRanchDiscoveryJournal(root,source){
  const doc=root.ownerDocument,button=doc.createElement('button'),life=new AbortController();
  button.className='int-rh2-discoveries';button.type='button';button.hidden=true;button.dataset.action='ranch-discoveries';
  root.append(button);
  let last=null,busy=false;
  // Sit under the status bar's wallet, whatever its wrapping, and below any
  // other status pill that would share its row (a narrow phone wraps them).
  const rectOf=selector=>{const node=doc.querySelector?.(selector);return node?.getClientRects?.().length?node.getBoundingClientRect():null;};
  function place(){
    const wallet=rectOf('.cm-status-bar__currencies'),host=root.getBoundingClientRect?.();
    if(!wallet||!host||button.hidden)return;
    const width=button.getBoundingClientRect?.().width??0,left=wallet.right-width;
    let top=wallet.bottom+10;
    for(const selector of ['.cm-status-bar__matches','.cm-status-bar__save']){
      const pill=rectOf(selector);
      if(pill&&pill.left<wallet.right&&pill.right>left&&pill.bottom>top-10&&pill.top<top+(button.getBoundingClientRect?.().height??44))top=pill.bottom+10;
    }
    button.style.setProperty('--cm-journal-top',`${Math.round(top-host.top)}px`);
    button.style.setProperty('--cm-journal-right',`${Math.max(8,Math.round(host.right-wallet.right))}px`);
  }
  const view=doc.defaultView;
  view?.addEventListener?.('resize',place,{signal:life.signal});
  const observer=typeof view?.ResizeObserver==='function'?new view.ResizeObserver(place):null;
  const bar=doc.querySelector?.('.cm-status-bar');if(bar)observer?.observe(bar);
  function update(frame){
    last=frame?.exploration??null;button.hidden=!last?.pending?.length||!!frame?.tutorial&&!frame.tutorial.finished;
    const c=copy();button.textContent=`${c.title} · ${last?.pending.length??0}/12`;
    button.setAttribute('aria-label',button.textContent);
    place();
  }
  async function open(){
    if(busy)return;busy=true;
    try{
      source.intents.refreshDiscoveries();const data=source.getFrame().exploration;if(!data)return;
      const c=copy(),body=doc.createElement('div');body.className='int-rh2-discovery-list';
      const p=doc.createElement('p'),closed=data.boundaries.filter(b=>b.reason==='NO_SAFE_EXIT').length;
      p.className='int-rh2-discovery-paths';
      p.textContent=`${data.connections.length} ${c.path}${closed?` · ${closed} ${c.blocked}`:''}`;
      p.dataset.connections=String(data.connections.length);
      // Passages join areas; partners who share one area meet without one (the greeting rule).
      if(!data.connections.length){const note=doc.createElement('span');note.className='int-rh2-discovery-paths__note';note.textContent=uiText('同一區域內的拍檔仍會相遇');p.append(' · ',note);}
      body.append(p);
      if(!data.pending.length){const empty=doc.createElement('p');empty.textContent=data.active?c.empty:c.none;body.append(empty);}
      for(const item of data.pending){
        const reward=ranchDiscoveryReward(item.kind);if(!reward)continue;
        body.append(rewardRow(doc,reward,`${item.name??c.partner} · ${uiText(reward.name)}`));
      }
      if(source.getPartnerLife?.())body.append(strollSection(doc,source.getPartnerLife().log));
      const foot=doc.createElement('p');foot.className='int-rh2-discovery-foot';foot.textContent=`${uiText('收下的發現會放進背包，飼料、蛋白質、傷藥也會加到育成工具的數量。')} ${c.full}`;body.append(foot);
      const action=await showChoiceDialog({title:c.title,message:c.about,content:body,variant:'ranch-discoveries',signal:life.signal,
        actions:[{id:'close',label:c.close},{id:'collect',label:c.collect,tone:'primary',disabled:!data.pending.length}],cancelId:'close',doc});
      if(action==='collect'&&!life.signal.aborted){
        const before=data.pending,result=source.intents.collectDiscoveries();
        const left=new Set((source.getFrame().exploration?.pending??[]).map(p=>p.id));
        const got=ranchDiscoveryTotals(before.filter(p=>!left.has(p.id)));
        const message=result.ok?`${c.saved} · ${result.collected}${result.remaining?` · ${c.full}`:''}`
          :result.reason==='INVENTORY_FULL'?c.full:result.reason==='EMPTY'?c.empty:c.failed;
        let content=null;
        if(result.ok&&got.length){
          content=doc.createElement('div');content.className='int-rh2-discovery-list';
          const head=doc.createElement('p');head.textContent=uiText('已放入背包：');content.append(head);
          for(const reward of got)content.append(rewardRow(doc,reward,uiText(reward.name)));
        }
        await showChoiceDialog({title:c.title,message,content,variant:'ranch-discoveries',actions:[{id:'close',label:c.close}],cancelId:'close',signal:life.signal,doc});
      }
    }finally{busy=false;}
  }
  button.addEventListener('click',open);
  doc.addEventListener?.(RANCH_JOURNAL_OPEN_EVENT,open,{signal:life.signal});
  return {update,open,dispose(){life.abort();observer?.disconnect();button.remove();}};
}
