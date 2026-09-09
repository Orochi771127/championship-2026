// DOM-only opening presentation. The application receives the confirmed names
// once; this view has no Save, RNG, gameplay state, router or ticker.
import {createOpeningStoryPresentation} from './openingStoryPresentation.js';
export function createOpeningPresentation({host,onStart}){
  let trainerName='',eggName='',busy=false,story=null;
  const el=(tag,className,text)=>{const n=document.createElement(tag);n.className=className;if(text!==undefined)n.textContent=text;return n;};
  const show=n=>{host.hidden=false;host.replaceChildren(n);};
  function envelope(next){const b=el('button','cm-opening__envelope');b.type='button';b.setAttribute('aria-label','開啟信件');b.addEventListener('click',next,{once:true});show(b);b.focus({preventScroll:true});}
  function letter(text,next,{egg=false}={}){
    const n=el('section','cm-opening__letter');n.setAttribute('aria-label','信件');n.setAttribute('role','dialog');
    if(egg)n.append(el('div','cm-opening__egg'));n.append(el('p','',text),el('small','','數位競技場'));
    const b=el('button','','確認');b.type='button';b.addEventListener('click',next,{once:true});n.append(b);show(n);b.focus({preventScroll:true});
  }
  function name(kind,next){
    const n=el('form','cm-opening__name'),label=el('label','',kind==='trainer'?'請輸入馴獸師姓名':'請替數碼蛋取名字');
    const input=el('input','');input.id='cm-opening-name';input.name=kind;input.maxLength=5;input.required=true;input.autocomplete='off';input.value=kind==='trainer'?trainerName:eggName;label.htmlFor=input.id;
    const b=el('button','','決定');b.type='submit';n.append(label,input,b);
    n.addEventListener('submit',e=>{e.preventDefault();const value=input.value.trim();if(!value||value.length>5||/[\p{Cc}\p{Cf}]/u.test(value)){input.setCustomValidity('請輸入一至五個字。');input.reportValidity();return;}
      input.setCustomValidity('');if(kind==='trainer')trainerName=value;else eggName=value;next();});input.addEventListener('input',()=>input.setCustomValidity(''));show(n);input.focus({preventScroll:true});
  }
  function confirmTrainer(){const n=el('section','cm-opening__name');n.append(el('p','',`馴獸師姓名使用「${trainerName}」嗎？`));const row=el('div','cm-opening__choices');
    for(const [label,next] of [['是',giftMail],['否',()=>name('trainer',confirmTrainer)]]){const b=el('button','',label);b.type='button';b.addEventListener('click',next,{once:true});row.append(b);}n.append(row);show(n);}
  function giftMail(){envelope(()=>letter('從現在起，你也是數碼獸馴獸師了。\n與夥伴一起，朝冠軍賽優勝邁進吧！\n贈禮應該就快送到了。',()=>letter('這顆數碼蛋送給你。\n請替牠取個名字。',()=>name('egg',start),{egg:true})));}
  async function start(){if(busy)return;busy=true;host.inert=true;try{if(await onStart({trainerName,eggName})===false){name('egg',start);return;}host.hidden=true;}finally{busy=false;host.inert=false;}}
  return {begin(){trainerName='';eggName='';story?.dispose();story=createOpeningStoryPresentation({host,onComplete(){story=null;envelope(()=>letter('歡迎來到數位世界。\n首先，請輸入姓名，完成馴獸師登錄。',()=>name('trainer',confirmTrainer)));}});},reset(){story?.dispose();story=null;host.replaceChildren();host.hidden=true;host.inert=false;busy=false;}};
}
