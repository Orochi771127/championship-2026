import {showChoiceDialog} from './uiDialog.js';
import {uiText} from '../text/uiText.js';
import {formatNumber} from '../text/locale.js';
import {shopItemName} from '../text/zhHant.js';
import {shopGoodsPresentation} from '../presentation/shopGoodsUiArt.js';
import {RANCH_DISCOVERY_REWARDS} from '../raising/ranchDiscoveries.js';
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
      p.textContent=`${data.connections.length} ${c.path}${closed?` · ${closed} ${c.blocked}`:''}`;body.append(p);
      if(!data.pending.length){const empty=doc.createElement('p');empty.textContent=data.active?c.empty:c.none;body.append(empty);}
      for(const item of data.pending){
        const reward=ranchDiscoveryReward(item.kind);if(!reward)continue;
        body.append(rewardRow(doc,reward,`${item.name??c.partner} · ${uiText(reward.name)}`));
      }
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
