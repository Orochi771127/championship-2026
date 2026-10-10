import {medalCollection} from './medalCollection.js';
import {titleEventText,tamerRankName} from '../text/zhHant.js';
import {uiText} from '../text/uiText.js';
import {originalMedalArt,originalDatabaseIcon} from '../presentation/completedOriginalUi20261007.js';

function element(tag,className,text) {
  const node=document.createElement(tag); if(className)node.className=className;
  if(text!==undefined)node.textContent=uiText(text); return node;
}
function artImage(art,className) {
  if(!art)return null;
  const img=element('img',className);img.src=art.src;img.alt='';img.decoding='async';return img;
}
export function createMedalCollectionView({root,battleBadges=[],onExit}={}) {
  const entries=medalCollection(battleBadges),count=entries.filter(m=>m.acquired).length;
  root.replaceChildren();root.className='cm-vs2-root';root.dataset.screen='MEDALS';
  root.dataset.uiAuthority='CHAMPIONSHIP_MODERN_UI_SYSTEM_P1R';
  const shell=element('section','cm-vs2-shell cm-medals');shell.setAttribute('aria-label',uiText('徽章收藏'));
  const header=element('header','cm-vs2-header');
  const copy=element('div','cm-vs2-header__copy');
  copy.append(element('span','cm-vs2-kicker','收藏'),element('h1','cm-vs2-title','徽章收藏'),
    element('p','cm-vs2-subtitle',uiText('已取得 {count} / {total}',{count,total:entries.length})));
  const board=artImage(originalDatabaseIcon('MEDALS'),'cm-collection-icon');
  header.append(copy);if(board)header.append(board);
  const body=element('div','cm-vs2-body cm-medals__body');
  body.append(element('p','cm-medals__summary',count===0?'尚未取得徽章。贏得頭銜賽後，徽章會記錄在這裡。':'每一枚徽章，都是一場頭銜賽的勝利紀錄。'));
  const grid=element('div','cm-medals__grid');grid.setAttribute('aria-label',uiText('61 枚頭銜賽徽章'));
  body.append(grid);
  const dialog=element('dialog','cm-medal-dialog');dialog.setAttribute('aria-label',uiText('徽章詳情'));
  function select(entry) {
    const event=entry.event,name=titleEventText(entry.titleId,'name',event?.name??uiText('徽章 {number}',{number:entry.titleId+1}));
    dialog.replaceChildren();
    const art=artImage(originalMedalArt(entry.titleId),'cm-medal-dialog__art');if(art)dialog.append(art);
    dialog.append(element('span','cm-medals__status',entry.acquired?'已取得':'未取得'),element('h2','cm-vs2-title',name));
    const description=titleEventText(entry.titleId,'description',event?.description??'');
    if(description)dialog.append(element('p','cm-medal-dialog__description',description));
    const details=element('dl','cm-medal-dialog__facts');
    function fact(label,value){details.append(element('dt','',label),element('dd','',value));}
    fact('取得方式',entry.conditionEvidence==='ROM_VERIFIED_TITLE_WIN'?'贏得這場頭銜賽。':'取得條件尚待查證。');
    fact('賽事日期',event?uiText('{season} 第 {day} 日',{season:uiText(['春季','夏季','秋季','冬季'][event.season]),day:event.dayOfSeason+1}):'尚待查證');
    fact('參賽階級',Number.isInteger(entry.requiredRank)?tamerRankName(entry.requiredRank):'尚待查證');
    if(entry.acquired)fact('取得時間','此存檔未記錄取得日期。');
    dialog.append(details);
    const close=element('button','cm-vs2-action','關閉詳情');close.type='button';close.addEventListener('click',()=>dialog.close());dialog.append(close);
    dialog.showModal();close.focus({preventScroll:true});
  }
  for(const entry of entries) {
    const name=titleEventText(entry.titleId,'name',entry.event?.name??uiText('徽章 {number}',{number:entry.titleId+1}));
    const button=element('button','cm-medals__tile');button.type='button';button.dataset.titleId=String(entry.titleId);
    button.dataset.acquired=String(entry.acquired);button.setAttribute('aria-label',uiText('{number}. {name}，{status}',{number:entry.titleId+1,name,status:uiText(entry.acquired?'已取得':'未取得')}));
    const art=artImage(originalMedalArt(entry.titleId),'cm-medals__art');if(art)button.append(art);
    button.append(element('span','cm-medals__number',String(entry.titleId+1).padStart(2,'0')),
      element('span','cm-medals__name',name),element('span','cm-medals__status',entry.acquired?'已取得':'未取得'));
    button.addEventListener('click',()=>select(entry));grid.append(button);
  }
  const footer=element('footer','cm-vs2-footer');const back=element('button','cm-vs2-action','返回牧場');back.type='button';back.addEventListener('click',()=>onExit?.());footer.append(back);
  shell.append(header,body,footer);root.append(shell,dialog);
  return Object.freeze({dispose(){if(dialog.open)dialog.close();root.replaceChildren();}});
}
