import {showChoiceDialog} from './uiDialog.js';
import {uiText} from '../text/uiText.js';
const copy=()=>Object.fromEntries(["title", "about", "empty", "none", "full", "collect", "close", "food", "herb", "bits", "rare", "partner", "path", "blocked", "saved", "failed"].map(key=>[key,uiText(`RANCH_JOURNAL_${key.toUpperCase()}`)]));
export function mountRanchDiscoveryJournal(root,source){
  const doc=root.ownerDocument,button=doc.createElement('button'),life=new AbortController();
  button.className='int-rh2-discoveries';button.type='button';button.dataset.action='ranch-discoveries';
  root.append(button);
  let last=null,busy=false;
  function update(frame){
    last=frame?.exploration??null;button.hidden=!last||!!frame?.tutorial&&!frame.tutorial.finished;
    const c=copy();button.textContent=`${c.title} · ${last?.pending.length??0}/12`;
    button.setAttribute('aria-label',button.textContent);
  }
  button.addEventListener('click',async()=>{
    if(busy)return;busy=true;
    try{
      source.intents.refreshDiscoveries();const data=source.getFrame().exploration;if(!data)return;
      const c=copy(),body=doc.createElement('div');body.className='int-rh2-discovery-list';
      const p=doc.createElement('p'),closed=data.boundaries.filter(b=>b.reason==='NO_SAFE_EXIT').length;
      p.textContent=`${data.connections.length} ${c.path}${closed?` · ${closed} ${c.blocked}`:''}`;body.append(p);
      if(!data.pending.length){const empty=doc.createElement('p');empty.textContent=data.active?c.empty:c.none;body.append(empty);}
      for(const item of data.pending){
        const row=doc.createElement('p');row.className='int-rh2-discovery-item';row.textContent=`${item.name??c.partner} · ${c[item.kind]}`;body.append(row);
      }
      const foot=doc.createElement('p');foot.textContent=c.full;body.append(foot);
      const action=await showChoiceDialog({title:c.title,message:c.about,content:body,variant:'ranch-discoveries',signal:life.signal,
        actions:[{id:'close',label:c.close},{id:'collect',label:c.collect,tone:'primary',disabled:!data.pending.length}],cancelId:'close',doc});
      if(action==='collect'&&!life.signal.aborted){
        const result=source.intents.collectDiscoveries();
        const message=result.ok?`${c.saved} · ${result.collected}${result.remaining?` · ${c.full}`:''}`
          :result.reason==='INVENTORY_FULL'?c.full:result.reason==='EMPTY'?c.empty:c.failed;
        await showChoiceDialog({title:c.title,message,actions:[{id:'close',label:c.close}],cancelId:'close',signal:life.signal,doc});
      }
    }finally{busy=false;}
  });
  return {update,dispose(){life.abort();button.remove();}};
}
