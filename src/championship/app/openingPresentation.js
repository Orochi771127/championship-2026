// DOM-only opening presentation. The application receives the confirmed names
// once; this view has no Save, gameplay RNG, gameplay state, router or ticker.
// (The name suggestion keys draw from Math.random: display copy only.)
//
// Owner 2026-10-28: one visual language from the prologue to the ranch. The
// tamer name is a licence terminal, gift letters are holographic mail, the
// eight eggs sit in an elemental incubator, and the egg is named in a hatching
// pod that shows the egg actually chosen. Hooks other code and the browser
// gates rely on are unchanged: .cm-opening__envelope, .cm-opening__letter with
// one button, .cm-opening__name with one submit, #cm-opening-name,
// .cm-opening__choices, input[name=starterEgg] and [data-egg-confirm].
import {createOpeningStoryPresentation} from './openingStoryPresentation.js';
import {uiText} from '../text/uiText.js';
import {openingEggChoices} from './openingEggChoices.js';
import {openingEggText} from '../text/openingEggText.js';
import {openingStoryText} from '../text/openingStoryText.js';
import {onboardingText,fillOnboardingText} from '../text/onboardingText.js';
import {getActiveGameTitle} from '../text/brandTerms.js';
import {getLocale} from '../text/locale.js';

const NAME_MAX=5;
const pick=(list,current)=>{const options=list.filter(name=>name!==current);return options[Math.floor(Math.random()*options.length)]??list[0];};

export function createOpeningPresentation({host,onStart,onCancel=()=>{},allowEggChoice=false}){
  let trainerName='',eggName='',eggSpeciesIndex=0,busy=false,story=null;
  // Copy is resolved when each card is built, so the language the player
  // chose on the title is the language of the whole opening.
  const el=(tag,className,text)=>{const n=document.createElement(tag);n.className=className;if(text!==undefined)n.textContent=uiText(text);return n;};
  const raw=(tag,className,text)=>{const n=document.createElement(tag);n.className=className;if(text!==undefined)n.textContent=text;return n;};
  const show=n=>{host.hidden=false;host.replaceChildren(n);};
  const chosenEgg=()=>openingEggChoices().find(egg=>egg.speciesIndex===eggSpeciesIndex)??null;
  function eggImage(egg,className){
    const image=raw('img',className);
    image.src=new URL(egg.src,document.baseURI).href;image.alt='';image.width=egg.width;image.height=egg.height;image.decoding='async';image.draggable=false;
    return image;
  }
  function envelope(next){
    const b=el('button','cm-opening__envelope');b.type='button';b.setAttribute('aria-label',uiText('開啟信件'));
    const beacon=raw('span','cm-opening__envelope-beacon');beacon.setAttribute('aria-hidden','true');
    beacon.append(raw('span','cm-opening__envelope-ring'),raw('span','cm-opening__envelope-ring'),raw('span','cm-opening__envelope-glyph','✉'));
    b.append(beacon,raw('span','cm-opening__envelope-label',onboardingText().mailKicker));
    b.addEventListener('click',next,{once:true});show(b);b.focus({preventScroll:true});
  }
  // The gift egg: the mystery egg before the incubator, or the fixed gift egg
  // on a single-egg build, lifted on a hatching pedestal.
  function giftEgg(){
    const stage=raw('div','cm-opening__gift');stage.setAttribute('aria-hidden','true');
    stage.append(raw('span','cm-opening__gift-halo'),raw('span','cm-opening__gift-base'));
    const egg=allowEggChoice?null:chosenEgg();
    if(egg){stage.dataset.element=egg.element.key;stage.style.setProperty('--egg-aura',egg.element.color);stage.append(eggImage(egg,'cm-opening__gift-egg'));}
    else {stage.dataset.mystery='true';stage.append(raw('span','cm-opening__egg'),raw('span','cm-opening__gift-mark','?'));}
    return stage;
  }
  function letter(text,next,{egg=false}={}){
    const copy=onboardingText(),n=el('section','cm-opening__letter');n.setAttribute('aria-label',uiText('信件'));n.setAttribute('role','dialog');
    const header=raw('header','cm-opening__letter-head');
    header.append(raw('span','cm-opening__letter-icon','✉'),raw('span','cm-opening__letter-kicker',copy.mailKicker),el('span','cm-opening__letter-from','數位競技場'));
    n.append(header);
    if(egg)n.append(giftEgg());
    n.append(el('p','cm-opening__letter-body',openingStoryText(text)));
    const b=el('button','cm-onboard-cta','確認');b.type='button';b.addEventListener('click',next,{once:true});n.append(b);show(n);b.focus({preventScroll:true});
  }
  // One name slot for both names: a glowing input, a character count and a
  // random-name key that never submits.
  function nameSlot(kind,input){
    const copy=onboardingText(),slot=raw('div','cm-name-slot'),count=raw('p','cm-name-slot__count');
    count.setAttribute('aria-live','polite');
    if(kind==='egg')slot.append(raw('span','cm-name-slot__pen','✏️'));
    const dice=raw('button','cm-name-slot__dice cm-arcade-key');dice.type='button';dice.dataset.randomName=kind;
    dice.append(raw('span','cm-name-slot__dice-icon','🎲'),raw('span','',kind==='trainer'?copy.randomName:copy.randomPartner));
    const sync=()=>{count.textContent=fillOnboardingText(copy.nameCount,{n:input.value.length,max:NAME_MAX});slot.dataset.filled=String(input.value.length>0);};
    dice.addEventListener('click',()=>{
      input.value=pick(kind==='trainer'?copy.tamerNames:copy.partnerNames,input.value);input.setCustomValidity('');sync();
      slot.classList.remove('is-jelly');void slot.offsetWidth;slot.classList.add('is-jelly');input.focus({preventScroll:true});
    });
    input.addEventListener('input',sync);slot.addEventListener('animationend',()=>slot.classList.remove('is-jelly'));
    slot.append(input,dice);sync();
    return {slot,count};
  }
  function name(kind,next){
    const copy=onboardingText(),n=el('form',`cm-opening__name ${kind==='trainer'?'cm-license':'cm-pod'}`);n.dataset.kind=kind;
    const label=el('label','cm-opening__name-label',kind==='trainer'?'請輸入馴獸師姓名':openingStoryText('請替培育蛋取名字'));
    const input=el('input','');input.id='cm-opening-name';input.name=kind;input.maxLength=NAME_MAX;input.required=true;input.autocomplete='off';input.value=kind==='trainer'?trainerName:eggName;label.htmlFor=input.id;
    input.placeholder=kind==='trainer'?copy.namePlaceholder:copy.partnerPlaceholder;input.enterKeyHint='done';
    const {slot,count}=nameSlot(kind,input);
    const b=el('button','cm-onboard-cta','決定');b.type='submit';
    if(kind==='trainer'){
      const top=raw('div','cm-license__top'),crown=raw('span','cm-license__crown','♛'),heading=raw('div','cm-license__heading');
      crown.setAttribute('aria-hidden','true');
      heading.append(raw('p','cm-license__kicker',copy.licenseKicker),raw('h2','cm-license__title',copy.licenseTitle),raw('p','cm-license__org',getActiveGameTitle(getLocale())));
      top.append(crown,heading);
      const body=raw('div','cm-license__body'),photo=raw('div','cm-license__photo'),fields=raw('div','cm-license__fields');
      photo.setAttribute('aria-hidden','true');photo.append(raw('span','cm-license__photo-head'),raw('span','cm-license__photo-body'));
      const number=raw('p','cm-license__number');number.append(raw('span','',copy.licenseNumber),raw('strong','',copy.licensePending));
      fields.append(label,slot,count,number);body.append(photo,fields);
      const guest=raw('p','cm-guest-badge');guest.dataset.guestMode='true';
      guest.append(raw('span','cm-guest-badge__dot'),raw('strong','',copy.guestTitle),raw('span','cm-guest-badge__note',copy.guestNote));
      n.append(top,body,guest,b);
    }else{
      const egg=chosenEgg(),pod=raw('div','cm-pod__stage');pod.setAttribute('aria-hidden','true');
      pod.append(raw('span','cm-pod__beam'),raw('span','cm-pod__ring'),raw('span','cm-pod__base'));
      for(let i=0;i<6;i++){const mote=raw('i','cm-pod__mote');mote.style.setProperty('--m',String(i));pod.append(mote);}
      const caption=raw('p','cm-pod__caption');
      if(egg){
        n.dataset.element=egg.element.key;n.style.setProperty('--egg-aura',egg.element.color);pod.append(eggImage(egg,'cm-pod__egg'));
        const formal=raw('strong','',allowEggChoice?egg.formalName:copy.giftEgg);formal.lang=allowEggChoice?'zh-Hant':getLocale();
        caption.append(formal);
        if(allowEggChoice)caption.append(raw('span','cm-pod__element',`${egg.element.icon} ${copy.elements[egg.element.key]}`));
      }else pod.append(raw('span','cm-opening__egg'));
      n.append(raw('p','cm-pod__kicker',copy.podKicker),pod,caption,label,slot,count,b);
    }
    if(kind==='egg'&&allowEggChoice){const back=el('button','cm-opening__back',openingEggText().back);back.type='button';back.dataset.eggBack='true';back.addEventListener('click',()=>{eggName=input.value.trim();chooseEgg();});n.append(back);}
    // The partner's title on the ranch is this egg name. A partner named after
    // the trainer reads like a mix-up, so the same name asks once (Owner 2026-10-28).
    let sameNameAsked=null;const sameHint=raw('p','cm-name-slot__same',uiText('這是馴獸師的名字喔！想換一個拍檔名字嗎？再按一次「決定」就用這個名字。'));
    sameHint.hidden=true;sameHint.setAttribute('role','status');if(kind==='egg')count.after(sameHint);
    n.addEventListener('submit',e=>{e.preventDefault();const value=input.value.trim();if(!value||value.length>NAME_MAX||/[\p{Cc}\p{Cf}]/u.test(value)){input.setCustomValidity(uiText('請輸入一至五個字。'));input.reportValidity();return;}
      if(kind==='egg'&&value===trainerName&&sameNameAsked!==value){sameNameAsked=value;sameHint.hidden=false;input.focus({preventScroll:true});return;}
      input.setCustomValidity('');if(kind==='trainer')trainerName=value;else eggName=value;next();});
    input.addEventListener('input',()=>{input.setCustomValidity('');sameHint.hidden=true;});
    // iOS raises the keyboard over the lower half: the host already follows
    // the visible viewport, and once it has settled a card taller than that
    // scrolls itself (never the page) to bring the slot to its middle.
    input.addEventListener('focus',()=>setTimeout(()=>{
      if(!input.isConnected||n.scrollHeight<=n.clientHeight+1)return;
      const card=n.getBoundingClientRect(),target=slot.getBoundingClientRect();
      n.scrollTo({top:n.scrollTop+(target.top+target.height/2)-(card.top+card.height/2),behavior:'smooth'});
    },320));
    show(n);input.focus({preventScroll:true});
  }
  function confirmTrainer(){
    const copy=onboardingText(),n=el('section','cm-opening__name cm-license cm-license--stamp');
    const card=raw('div','cm-license__top'),crown=raw('span','cm-license__crown','♛'),heading=raw('div','cm-license__heading');
    crown.setAttribute('aria-hidden','true');heading.append(raw('p','cm-license__kicker',copy.licenseKicker),raw('p','cm-license__stamp-name',trainerName));
    card.append(crown,heading);
    n.append(card,el('p','cm-license__question',uiText('馴獸師姓名使用「{name}」嗎？',{name:trainerName})));const row=el('div','cm-opening__choices');
    for(const [label,next] of [['是',giftMail],['否',()=>name('trainer',confirmTrainer)]]){const b=el('button','',label);b.type='button';b.addEventListener('click',next,{once:true});row.append(b);}n.append(row);show(n);}
  function giftMail(){envelope(()=>letter('從現在起，你也是拍檔馴獸師了。\n與夥伴一起，朝冠軍賽優勝邁進吧！\n贈禮應該就快送到了。',()=>letter('這顆培育蛋送給你。\n請替牠取個名字。',()=>allowEggChoice?chooseEgg():name('egg',start),{egg:true})));}
  function chooseEgg(){
    const copy=openingEggText(),words=onboardingText(),n=el('form','cm-opening__egg-choice cm-incubator'),title=el('h2','',copy.title),hint=el('p','cm-incubator__hint',copy.hint);
    title.id='cm-egg-choice-title';n.setAttribute('aria-labelledby',title.id);
    const grid=el('div','cm-opening__egg-grid');
    for(const egg of openingEggChoices()){
      const label=el('label','cm-opening__egg-option'),input=el('input',''),caption=raw('span','cm-egg-card__name',egg.formalName);
      label.dataset.element=egg.element.key;label.style.setProperty('--egg-aura',egg.element.color);
      caption.lang='zh-Hant';
      input.type='radio';input.name='starterEgg';input.value=String(egg.speciesIndex);input.checked=egg.speciesIndex===eggSpeciesIndex;
      input.setAttribute('aria-label',`${egg.formalName} · ${words.elements[egg.element.key]}`);
      input.addEventListener('change',()=>{eggSpeciesIndex=egg.speciesIndex;});
      const pod=raw('span','cm-egg-card__pod');pod.append(eggImage(egg,'cm-egg-card__egg'));
      const tag=raw('span','cm-egg-card__element');tag.append(raw('span','cm-egg-card__icon',egg.element.icon),raw('span','',words.elements[egg.element.key]));
      const badge=raw('span','cm-egg-card__badge',`✓ ${words.locked}`);badge.setAttribute('aria-hidden','true');
      label.append(input,badge,pod,caption,tag);grid.append(label);
    }
    const actions=el('div','cm-opening__egg-actions'),confirm=el('button','cm-onboard-cta',copy.confirm),cancel=el('button','cm-opening__back',copy.cancel);
    confirm.type='submit';confirm.dataset.eggConfirm='true';cancel.type='button';cancel.dataset.openingCancel='true';
    cancel.addEventListener('click',()=>{host.replaceChildren();host.hidden=true;onCancel();});actions.append(confirm,cancel);
    n.append(raw('p','cm-incubator__kicker',words.incubatorKicker),title,hint);if(copy.nameNote)n.append(el('p','cm-opening__egg-name-note',copy.nameNote));
    n.append(grid,actions);n.addEventListener('submit',e=>{e.preventDefault();name('egg',start);});show(n);grid.querySelector('input:checked').focus({preventScroll:true});
  }
  async function start(){if(busy)return;busy=true;host.inert=true;try{if(await onStart({trainerName,eggName,eggSpeciesIndex})===false){name('egg',start);return;}host.hidden=true;host.replaceChildren();}finally{busy=false;host.inert=false;}}
  return {begin(){trainerName='';eggName='';eggSpeciesIndex=0;story?.dispose();story=createOpeningStoryPresentation({host,onCancel(){story=null;host.replaceChildren();host.hidden=true;onCancel();},onComplete(){story=null;envelope(()=>letter('歡迎來到數位世界。\n首先，請輸入姓名，完成馴獸師登錄。',()=>name('trainer',confirmTrainer)));}});},reset(){story?.dispose();story=null;host.replaceChildren();host.hidden=true;host.inert=false;busy=false;}};
}
