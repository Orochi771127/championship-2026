import {medalCollection} from './medalCollection.js';
import {titleEventText,tamerRankName} from '../text/zhHant.js';
import {uiText} from '../text/uiText.js';
import {originalMedalArt,originalDatabaseIcon} from '../presentation/completedOriginalUi20261007.js';
import {mountSelectedMedalPresentation} from '../presentation/medals/selectedMedalPresentation.js';
import {medalPresentationText} from '../presentation/medals/medalPresentationText.js';
import {getMedalPresentationProfile} from '../presentation/medals/medalPresentationProfiles.js';
import {describeMedalDetails} from './medalDetails.js';

function element(tag,className,text) {
  const node=document.createElement(tag); if(className)node.className=className;
  if(text!==undefined)node.textContent=uiText(text); return node;
}
function artImage(art,className) {
  if(!art)return null;
  const img=element('img',className);img.src=art.src;img.alt='';img.decoding='async';return img;
}
function applyPresentationProfile(node,profile) {
  if(!profile)return;
  node.dataset.medalMaterial=profile.material;node.dataset.medalShape=profile.shape;
}
function statusIcon(acquired) {
  const icon=element('span',acquired?'cm-medals__state-icon cm-medals__state-icon--earned':'cm-medals__state-icon cm-medals__state-icon--locked',acquired?'✓':undefined);
  icon.setAttribute('aria-hidden','true');return icon;
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
  let activePresentation=null,disposed=false;
  function releaseDetail(){activePresentation?.dispose();activePresentation=null;}
  function closeDetail(){releaseDetail();if(dialog.open)dialog.close();}
  dialog.addEventListener('cancel',releaseDetail);
  dialog.addEventListener('close',()=>{if(!dialog.open)releaseDetail();});
  function select(entry) {
    if(disposed)return;releaseDetail();
    const event=entry.event,name=titleEventText(entry.titleId,'name',event?.name??uiText('徽章 {number}',{number:entry.titleId+1}));
    const presentationProfile=getMedalPresentationProfile(entry.titleId);
    dialog.replaceChildren();dialog.dataset.acquired=String(entry.acquired);applyPresentationProfile(dialog,presentationProfile);
    const display=element('div','cm-medal-display');display.dataset.acquired=String(entry.acquired);display.dataset.state=entry.acquired?'loading':'locked';applyPresentationProfile(display,presentationProfile);
    const stage=element('div','cm-medal-display__stage');stage.tabIndex=-1;stage.setAttribute('autofocus','');stage.setAttribute('role','img');stage.setAttribute('aria-label',name);
    const selectedArt=originalMedalArt(entry.titleId),detailSrc=selectedArt?.detailSrc??selectedArt?.src;
    const flat=element('span','cm-medal-display__flat');stage.append(flat);
    const art=artImage(detailSrc?{src:detailSrc}:null,'cm-medal-dialog__art');if(art)flat.append(art);
    let flatArtFailed=!art;
    const placeholder=element('span','cm-medal-display__placeholder');placeholder.setAttribute('aria-hidden','true');placeholder.append(statusIcon(entry.acquired));placeholder.hidden=!!art;flat.append(placeholder);
    art?.addEventListener('error',()=>{flatArtFailed=true;art.hidden=true;placeholder.hidden=display.dataset.state==='ready';});
    if(!entry.acquired){const seal=element('span','cm-medal-display__lock');seal.append(statusIcon(false));seal.setAttribute('aria-hidden','true');stage.append(seal);}
    const presentationStatus=element('p','cm-medal-display__status',medalPresentationText(entry.acquired?'loading':'locked'));
    const controls=element('p','cm-medal-display__controls',medalPresentationText('controls'));controls.hidden=true;
    const reset=element('button','cm-medal-display__reset',medalPresentationText('reset'));reset.type='button';reset.hidden=true;reset.addEventListener('click',()=>activePresentation?.reset());
    display.append(stage,presentationStatus,controls,reset);
    const status=element('span','cm-medals__status',entry.acquired?'已取得':'未取得');status.prepend(statusIcon(entry.acquired));
    dialog.append(display,status,element('h2','cm-vs2-title',name));
    const description=titleEventText(entry.titleId,'description',event?.description??'');
    if(description)dialog.append(element('p','cm-medal-dialog__description',description));
    const details=element('dl','cm-medal-dialog__facts');
    function fact(label,value,localized=false){
      const term=element('dt','',localized?undefined:label),definition=element('dd','',localized?undefined:value);
      if(localized){term.textContent=label;definition.textContent=value;}details.append(term,definition);
    }
    fact('取得方式',entry.conditionEvidence==='ROM_VERIFIED_TITLE_WIN'?'贏得這場頭銜賽。':'取得條件尚待查證。');
    fact('賽事日期',event?uiText('{season} 第 {day} 日',{season:uiText(['春季','夏季','秋季','冬季'][event.season]),day:event.dayOfSeason+1}):'尚待查證');
    fact('參賽階級',Number.isInteger(entry.requiredRank)?tamerRankName(entry.requiredRank):'尚待查證');
    if(entry.acquired)fact('取得時間','此存檔未記錄取得日期。');
    const extra=describeMedalDetails(entry.titleId);
    for(const item of extra?.facts??[])fact(item.label,item.value,true);
    dialog.append(details);
    for(const note of extra?.notes??[]){const paragraph=element('p','cm-medal-dialog__note');paragraph.textContent=note;dialog.append(paragraph);}
    const close=element('button','cm-vs2-action','關閉詳情');close.type='button';close.addEventListener('click',closeDetail);dialog.append(close);
    if(!dialog.open)dialog.showModal();stage.focus({preventScroll:true});dialog.scrollTop=0;
    if(entry.acquired&&detailSrc){
      activePresentation=mountSelectedMedalPresentation({host:stage,src:detailSrc,presentationProfile,onState(state){
        display.dataset.state=state;const ready=state==='ready';flat.hidden=ready;if(art)art.hidden=ready||flatArtFailed;placeholder.hidden=ready||!flatArtFailed;
        presentationStatus.hidden=ready;presentationStatus.textContent=ready?'':medalPresentationText(state==='loading'?'loading':'fallback');
        controls.hidden=!ready;reset.hidden=!ready;stage.tabIndex=ready?0:-1;
        stage.setAttribute('role',ready?'group':'img');stage.setAttribute('aria-label',ready?`${name}. ${medalPresentationText('controls')}`:name);
      }});
    }else if(entry.acquired){display.dataset.state='fallback';presentationStatus.textContent=medalPresentationText('fallback');}
  }
  for(const entry of entries) {
    const name=titleEventText(entry.titleId,'name',entry.event?.name??uiText('徽章 {number}',{number:entry.titleId+1}));
    const button=element('button','cm-medals__tile');button.type='button';button.dataset.titleId=String(entry.titleId);applyPresentationProfile(button,getMedalPresentationProfile(entry.titleId));
    button.dataset.acquired=String(entry.acquired);button.setAttribute('aria-label',uiText('{number}. {name}，{status}',{number:entry.titleId+1,name,status:uiText(entry.acquired?'已取得':'未取得')}));
    const artwork=element('span','cm-medals__artwork');
    const art=artImage(originalMedalArt(entry.titleId),'cm-medals__art');if(art)artwork.append(art);
    artwork.append(statusIcon(entry.acquired));button.append(artwork);
    button.append(element('span','cm-medals__number',String(entry.titleId+1).padStart(2,'0')),
      element('span','cm-medals__name',name),element('span','cm-medals__status',entry.acquired?'已取得':'未取得'));
    button.addEventListener('click',()=>select(entry));grid.append(button);
  }
  const footer=element('footer','cm-vs2-footer');const back=element('button','cm-vs2-action','返回牧場');back.type='button';back.addEventListener('click',()=>onExit?.());footer.append(back);
  shell.append(header,body,footer);root.append(shell,dialog);
  return Object.freeze({getDiagnostics(){return {tileCount:entries.length,activePresentation:activePresentation?.getDiagnostics()??null,disposed};},dispose(){if(disposed)return;disposed=true;closeDetail();root.replaceChildren();}});
}
