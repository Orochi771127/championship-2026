// DOM-only opening presentation. The application receives the confirmed names
// once; this view has no Save, RNG, gameplay state, router or ticker.
import {createOpeningStoryPresentation} from './openingStoryPresentation.js';
import {uiText} from '../text/uiText.js';
import {openingEggChoices} from './openingEggChoices.js';
import {openingEggText} from '../text/openingEggText.js';
export function createOpeningPresentation({host,onStart,onCancel=()=>{},allowEggChoice=false}){
  let trainerName='',eggName='',eggSpeciesIndex=0,busy=false,story=null;
  // Copy is resolved when each card is built, so the language the player
  // chose on the title is the language of the whole opening.
  const el=(tag,className,text)=>{const n=document.createElement(tag);n.className=className;if(text!==undefined)n.textContent=uiText(text);return n;};
  const show=n=>{host.hidden=false;host.replaceChildren(n);};
  function envelope(next){const b=el('button','cm-opening__envelope');b.type='button';b.setAttribute('aria-label',uiText('開啟信件'));b.addEventListener('click',next,{once:true});show(b);b.focus({preventScroll:true});}
  function letter(text,next,{egg=false}={}){
    const n=el('section','cm-opening__letter');n.setAttribute('aria-label',uiText('信件'));n.setAttribute('role','dialog');
    if(egg)n.append(el('div','cm-opening__egg'));n.append(el('p','',text),el('small','','數位競技場'));
    const b=el('button','','確認');b.type='button';b.addEventListener('click',next,{once:true});n.append(b);show(n);b.focus({preventScroll:true});
  }
  function name(kind,next){
    const n=el('form','cm-opening__name'),label=el('label','',kind==='trainer'?'請輸入馴獸師姓名':'請替數碼蛋取名字');
    const input=el('input','');input.id='cm-opening-name';input.name=kind;input.maxLength=5;input.required=true;input.autocomplete='off';input.value=kind==='trainer'?trainerName:eggName;label.htmlFor=input.id;
    const b=el('button','','決定');b.type='submit';n.append(label,input,b);
    if(kind==='egg'&&allowEggChoice){const back=el('button','cm-opening__back',openingEggText().back);back.type='button';back.dataset.eggBack='true';back.addEventListener('click',()=>{eggName=input.value.trim();chooseEgg();});n.append(back);}
    n.addEventListener('submit',e=>{e.preventDefault();const value=input.value.trim();if(!value||value.length>5||/[\p{Cc}\p{Cf}]/u.test(value)){input.setCustomValidity(uiText('請輸入一至五個字。'));input.reportValidity();return;}
      input.setCustomValidity('');if(kind==='trainer')trainerName=value;else eggName=value;next();});input.addEventListener('input',()=>input.setCustomValidity(''));show(n);input.focus({preventScroll:true});
  }
  function confirmTrainer(){const n=el('section','cm-opening__name');n.append(el('p','',uiText('馴獸師姓名使用「{name}」嗎？',{name:trainerName})));const row=el('div','cm-opening__choices');
    for(const [label,next] of [['是',giftMail],['否',()=>name('trainer',confirmTrainer)]]){const b=el('button','',label);b.type='button';b.addEventListener('click',next,{once:true});row.append(b);}n.append(row);show(n);}
  function giftMail(){envelope(()=>letter('從現在起，你也是數碼獸馴獸師了。\n與夥伴一起，朝冠軍賽優勝邁進吧！\n贈禮應該就快送到了。',()=>letter('這顆數碼蛋送給你。\n請替牠取個名字。',()=>allowEggChoice?chooseEgg():name('egg',start),{egg:true})));}
  function chooseEgg(){
    const copy=openingEggText(),n=el('form','cm-opening__egg-choice'),title=el('h2','',copy.title),hint=el('p','',copy.hint);
    title.id='cm-egg-choice-title';n.setAttribute('aria-labelledby',title.id);
    const grid=el('div','cm-opening__egg-grid');
    for(const egg of openingEggChoices()){
      const label=el('label','cm-opening__egg-option'),input=el('input',''),image=el('img',''),caption=el('span','',egg.formalName);
      caption.lang='zh-Hant';
      input.type='radio';input.name='starterEgg';input.value=String(egg.speciesIndex);input.checked=egg.speciesIndex===eggSpeciesIndex;
      input.addEventListener('change',()=>{eggSpeciesIndex=egg.speciesIndex;});
      image.src=new URL(egg.src,document.baseURI).href;image.alt='';image.width=egg.width;image.height=egg.height;image.decoding='async';
      label.append(input,image,caption);grid.append(label);
    }
    const actions=el('div','cm-opening__egg-actions'),confirm=el('button','',copy.confirm),cancel=el('button','cm-opening__back',copy.cancel);
    confirm.type='submit';confirm.dataset.eggConfirm='true';cancel.type='button';cancel.dataset.openingCancel='true';
    cancel.addEventListener('click',()=>{host.replaceChildren();host.hidden=true;onCancel();});actions.append(confirm,cancel);
    n.append(title,hint);if(copy.nameNote)n.append(el('p','cm-opening__egg-name-note',copy.nameNote));
    n.append(grid,actions);n.addEventListener('submit',e=>{e.preventDefault();name('egg',start);});show(n);grid.querySelector('input:checked').focus({preventScroll:true});
  }
  async function start(){if(busy)return;busy=true;host.inert=true;try{if(await onStart({trainerName,eggName,eggSpeciesIndex})===false){name('egg',start);return;}host.hidden=true;host.replaceChildren();}finally{busy=false;host.inert=false;}}
  return {begin(){trainerName='';eggName='';eggSpeciesIndex=0;story?.dispose();story=createOpeningStoryPresentation({host,onComplete(){story=null;envelope(()=>letter('歡迎來到數位世界。\n首先，請輸入姓名，完成馴獸師登錄。',()=>name('trainer',confirmTrainer)));}});},reset(){story?.dispose();story=null;host.replaceChildren();host.hidden=true;host.inert=false;busy=false;}};
}
