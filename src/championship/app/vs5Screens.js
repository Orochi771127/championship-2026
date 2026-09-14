import { titleEventText } from "../text/zhHant.js";
import { uiText } from "../text/uiText.js";
// VS5-P — Championship Modern presentation for the Battle menu, the match and
// the result.
//
// This module consumes only injected data and callbacks. It owns no screen
// lifecycle, gameplay state, battle logic, save data, Pixi bootstrap or ticker,
// and imports only display copy. Runtime values arrive from the caller; this
// view never reaches into simulation behind its back.
//
// THE BATTLE IS AUTOMATIC
// -----------------------
// This milestone is VS5 Auto Battle, and the trace agrees: the AI selection
// module chooses for all six slots and no traced site reads player input between
// the start of a match and its verdict. So the match screen has exactly one
// control, which leaves, and there is no command menu anywhere in this file.
//
// EVIDENCE IS SHOWN, NOT HIDDEN
// -----------------------------
// A roster mixes the product's own three creatures with three the cartridge
// supplies. The match screen carries that distinction in a data attribute so a
// reader can always tell which numbers are traced, rather than the screen
// quietly presenting both as if they were the same kind of thing.

export const VS5_UI_AUTHORITY = "CHAMPIONSHIP_MODERN_UI_SYSTEM_P1R";

export const VS5_EVIDENCE_LABELS = Object.freeze({
  VERIFIED_BINARY: "ROM VERIFIED",
  PRODUCT_AUTHORED: "PRODUCT AUTHORED"
});

export const VS5_END_REASON_LABELS = Object.freeze({
  RUNNING: "進行中",
  TIME_UP: "時間到",
  TEAM_DOWN: "一方全員倒下"
});

export const VS5_VERDICT_LABELS = Object.freeze({
  RUNNING: "尚未分出勝負",
  TEAM_ZERO_AHEAD: "我方獲勝",
  TEAM_ONE_AHEAD: "對手獲勝",
  LEVEL: "雙方平手"
});

function element(tag, className, text, localize = true) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = localize ? uiText(text) : text;
  return node;
}

function actionButton(label, { primary = false } = {}) {
  const button = element("button", `cm-vs5-action${primary ? " cm-vs5-action--primary" : ""}`, label);
  button.type = "button";
  return button;
}

function shell(root, screen, label) {
  root.replaceChildren();
  root.className = "cm-vs5-root";
  root.dataset.uiAuthority = VS5_UI_AUTHORITY;
  root.dataset.screen = screen;
  const section = element("section", "cm-vs5-shell");
  section.setAttribute("aria-label", uiText(label));
  root.append(section);
  return section;
}

/**
 * The battle menu. `matches` is what battleMatchSelection resolved: at most five
 * entries, each with a record index, a title, an entry fee and a reward.
 */
/**
 * The Battle menu.
 *
 * The original presents this as a rotating box whose faces are the battle KINDS
 * -- championship, title match, free battle, link battle -- proved by the node
 * table of battle_menu/launcher13.nsbmd. So the screen has two layers: pick a
 * kind on the box, then a match within it.
 *
 * Mode identity is now traced through OVL10 0210F88C's help-bank dispatch.
 * The application supplies each mode's entries; this view holds only selection.
 */
export function createBattleSelectView({ root, matches, onEnter, onExit, onOpenChampionship, mountCube, menuCopy, getPartySelection, getModeMatches, getPracticeSelection, getPasswordSelection, getLinkSelection, arenaChoices=[] }) {
  if (!Array.isArray(matches)) throw new TypeError("The Battle menu requires a resolved match list");
  if (typeof onEnter !== "function") throw new TypeError("The Battle menu requires an onEnter intent");

  if (!menuCopy) throw new TypeError("The Battle menu requires display copy");
  const section = shell(root, "BATTLE_SELECT", menuCopy.menu);
  const header = element("header", "cm-vs5-header");
  header.append(element("span", "cm-vs5-kicker", menuCopy.kicker));
  header.append(element("h1", "cm-vs5-title", menuCopy.chooseMatch));
  section.append(header);

  let cube = null;
  // `mountCube` is injected. The application injects a lazily-imported wrapper,
  // which is async, so the mount can land AFTER this function has returned and
  // even after dispose() has run. Holding only the raw return value meant the
  // Three.js cube was never disposed: its renderer, textures, geometry and
  // pointer listeners leaked on every exit from this screen, and dispose() threw
  // because a promise has no dispose(). A synchronous injector -- what the tests
  // use -- still assigns straight through, so the pinned synchronous factory
  // contract is unchanged.
  let cubeDisposed = false;
  let selectedMode='TITLE_MATCH',modeRequest=0,partyRequest=0,entering=false;
  const matchOnlyNodes = [];
  async function selectMode(id){
    if(cubeDisposed||entering)return;
    if(id==='CHAMPIONSHIP'){onOpenChampionship?.();return;}
    if(id==='PRACTICE_BATTLE'&&getPracticeSelection){modeRequest++;await choosePractice();return;}
    if(id==='PASSWORD_BATTLE'&&getPasswordSelection){modeRequest++;await choosePassword();return;}
    if(id==='LINK_BATTLE'&&getLinkSelection){modeRequest++;await chooseLink();return;}
    if(!['TITLE_MATCH','FREE_BATTLE'].includes(id)||!getModeMatches)return;
    const request=++modeRequest;
    let next;
    try{next=await getModeMatches(id);if(!Array.isArray(next))throw new Error('BATTLE_MATCH_LIST_REQUIRED');}
    catch(error){if(!cubeDisposed&&request===modeRequest)showRefusal({ok:false,message:'對戰清單載入失敗，請重新選擇模式。'},{});return;}
    if(cubeDisposed||request!==modeRequest)return;
    partyRequest++;selectedMatch=null;selectedIds=[];
    selectedMode=id;partyPanel.hidden=true;list.hidden=false;entryNotice.hidden=true;
    section.dataset.battleMode=id;
    for(const node of matchOnlyNodes)node.hidden=false;
    renderMatches(next);
  }
  if (typeof mountCube === "function") {
    const stage = element("div", "cm-vs5-cube");
    section.append(stage);
    const mounted = mountCube({
      host: stage,
      available: new Set(['TITLE_MATCH',...(onOpenChampionship?['CHAMPIONSHIP']:[]),...(getModeMatches?['FREE_BATTLE']:[]),...(getLinkSelection?['LINK_BATTLE']:[]),...(getPasswordSelection?['PASSWORD_BATTLE']:[]),...(getPracticeSelection?['PRACTICE_BATTLE']:[])]),
      onSelect:id=>{void selectMode(id);}
    });
    if (mounted && typeof mounted.then === "function") {
      mounted.then((presentation) => {
        // Losing the race to dispose() is normal: the player can leave before a
        // lazily-imported renderer finishes arriving.
        if (cubeDisposed) presentation?.dispose?.();
        else cube = presentation;
      }).catch(() => {});
    } else {
      cube = mounted;
    }
    const note = element("p", "cm-vs5-cube__note",
      menuCopy.faceNotice);
    section.append(note);
    matchOnlyNodes.push(stage, note);
  }

  const list = element("ul", "cm-vs5-matches");
  list.setAttribute("aria-label", uiText(menuCopy.availableMatches));
  const entryNotice = element("p", "cm-vs5-entry-notice");
  entryNotice.setAttribute("role", "status");
  entryNotice.setAttribute("aria-live", "polite");
  entryNotice.hidden = true;
  const partyPanel=element('section','cm-vs5-party');partyPanel.hidden=true;
  let selectedMatch=null,selectedIds=[];
  function arenaSelector(){
    const label=element('label','cm-vs5-arena-choice','對戰場地'),select=element('select');
    select.setAttribute('aria-label','對戰場地');select.append(element('option','','隨機場地'));select.children[0].value='';
    for(const arena of arenaChoices){const option=element('option','',arena.identifier.replace('BATTLE_',''));option.value=String(arena.index);select.append(option);}
    label.append(select);return {node:label,value:()=>select.value?Number(select.value):null};
  }
  function showRefusal(result,match){
    if(result?.ok!==false)return;
    entryNotice.hidden=false;entryNotice.dataset.reason=result.reason??'ENTRY_REFUSED';
    const fee=result.entryFee??match.entryFee,wallet=result.walletBits??result.wallet??result.bits;
    entryNotice.textContent=uiText(['INSUFFICIENT_FUNDS','INSUFFICIENT_BITS'].includes(result.reason)
      ?`持有金額不足。報名費 ${fee} 位元幣；持有 ${wallet??'—'} 位元幣。`
      :result.message??menuCopy.entryRefused??'目前無法參加這場對戰。');
  }
  async function chooseParty(match){
    const request=++partyRequest,mode=selectedMode;
    selectedMatch=match;selectedIds=[];list.hidden=true;partyPanel.hidden=false;partyPanel.replaceChildren();entryNotice.hidden=true;
    for (const node of matchOnlyNodes) node.hidden = true;
    let selection;
    try{selection=await getPartySelection(match.recordIndex,mode);}
    catch(error){
      if(!cubeDisposed&&request===partyRequest){partyPanel.hidden=true;list.hidden=false;for(const node of matchOnlyNodes)node.hidden=false;showRefusal({ok:false,message:'參賽隊伍載入失敗，請再試一次。'},match);}
      return;
    }
    if(cubeDisposed||request!==partyRequest)return;
    const {candidates,limit}=selection;
    partyPanel.append(element('h2','cm-vs5-title','選擇參賽數碼獸'),element('p','cm-vs5-entry-notice',`最多 ${limit} 隻`));
    const arena=mode==='FREE_BATTLE'?arenaSelector():null;if(arena)partyPanel.append(arena.node);
    const controls=[];
    const confirm=actionButton('決定',{primary:true});confirm.disabled=true;
    for(const entry of candidates){
      const button=actionButton(entry.displayName??entry.name??entry.instanceId);
      button.dataset.instanceId=entry.instanceId;button.setAttribute('aria-pressed','false');
      button.disabled=!entry.admission.ok;
      if(!entry.admission.ok)button.append(element('span','cm-vs5-match__fee',entry.admission.message));
      else if(entry.profile)button.append(element('span','cm-vs5-match__fee',`HP ${entry.profile.currentHp}／${entry.profile.maxHp}　TP ${entry.profile.currentTp}／${entry.profile.maxTp}`));
      button.addEventListener('click',()=>{
        selectedIds=selectedIds.includes(entry.instanceId)?selectedIds.filter(id=>id!==entry.instanceId):[...selectedIds,entry.instanceId];
        for(const [c,b] of controls){const picked=selectedIds.includes(c.instanceId);b.setAttribute('aria-pressed',String(picked));b.disabled=!c.admission.ok||(!picked&&selectedIds.length>=limit);}
        confirm.disabled=selectedIds.length===0;
      });
      controls.push([entry,button]);partyPanel.append(button);
    }
    if(!candidates.some(c=>c.admission.ok))partyPanel.append(element('p','cm-vs5-entry-notice','目前沒有符合這場比賽條件的數碼獸。'));
    confirm.addEventListener('click',async()=>{if(confirm.disabled||entering)return;confirm.disabled=true;entering=true;back.disabled=true;
      try{showRefusal(await onEnter(match.recordIndex,[...selectedIds],mode,...(arena?[arena.value()]:[])),match);}
      catch(error){if(!cubeDisposed)showRefusal({ok:false,message:'對戰準備失敗，請再試一次。'},match);}
      finally{entering=false;if(!cubeDisposed){confirm.disabled=selectedIds.length===0;back.disabled=false;}}});
    const back=actionButton('返回賽事選擇');back.addEventListener('click',()=>{if(entering)return;partyRequest++;selectedMatch=null;selectedIds=[];partyPanel.hidden=true;list.hidden=false;entryNotice.hidden=true;for(const node of matchOnlyNodes)node.hidden=false;});
    partyPanel.append(confirm,back);
  }

  async function choosePractice(){
    const request=++partyRequest;selectedMode='PRACTICE_BATTLE';section.dataset.battleMode=selectedMode;
    list.hidden=true;partyPanel.hidden=false;partyPanel.replaceChildren();entryNotice.hidden=true;
    for(const node of matchOnlyNodes)node.hidden=true;
    const back=actionButton('返回賽事選擇');back.addEventListener('click',()=>{if(!entering)void selectMode('TITLE_MATCH');});
    partyPanel.append(element('h2','cm-vs5-title','練習對戰'),element('p','cm-vs5-entry-notice','將自己培育的數碼獸分成兩隊，每隊最多 3 隻。'));
    let candidates;
    try{({candidates}=await getPracticeSelection());}
    catch(error){if(!cubeDisposed&&request===partyRequest){showRefusal({ok:false,message:'參賽隊伍載入失敗，請再試一次。'},{});partyPanel.append(back);}return;}
    if(cubeDisposed||request!==partyRequest)return;
    const teams=[[],[]],controls=[],summary=element('p','cm-vs5-entry-notice'),arena=arenaSelector();
    const confirm=actionButton('開始練習',{primary:true});confirm.disabled=true;
    const refresh=()=>{
      summary.textContent=`A 隊 ${teams[0].length}／3　B 隊 ${teams[1].length}／3`;
      for(const {button,entry,team} of controls){const picked=teams[team].includes(entry.instanceId);
        button.setAttribute('aria-pressed',String(picked));button.disabled=entering||!entry.admission.ok
          ||teams[1-team].includes(entry.instanceId)||(!picked&&teams[team].length>=3);}
      confirm.disabled=entering||teams.some(ids=>ids.length===0);back.disabled=entering;
    };
    partyPanel.append(summary,arena.node);
    for(const entry of candidates){
      const row=element('div','cm-vs5-practice-member'),name=entry.displayName??entry.name??entry.instanceId;
      row.append(element('span','cm-vs5-practice-member__name',name));
      if(!entry.admission.ok)row.append(element('span','cm-vs5-match__fee',entry.admission.message));
      for(const team of [0,1]){const button=actionButton(`${team===0?'A':'B'} 隊`);button.setAttribute('aria-label',`${name} ${team===0?'A':'B'} 隊`);
        button.addEventListener('click',()=>{if(button.disabled)return;const ids=teams[team],at=ids.indexOf(entry.instanceId);if(at<0)ids.push(entry.instanceId);else ids.splice(at,1);refresh();});
        controls.push({button,entry,team});row.append(button);}
      partyPanel.append(row);
    }
    if(candidates.filter(c=>c.admission.ok).length<2)partyPanel.append(element('p','cm-vs5-entry-notice','練習對戰需要至少兩隻可以參賽的數碼獸。'));
    confirm.addEventListener('click',async()=>{
      if(confirm.disabled)return;entering=true;refresh();
      try{showRefusal(await onEnter(-1,teams.map(ids=>[...ids]),'PRACTICE_BATTLE',arena.value()),{});}
      catch(error){if(!cubeDisposed)showRefusal({ok:false,message:'對戰準備失敗，請再試一次。'},{});}
      finally{entering=false;if(!cubeDisposed)refresh();}
    });
    refresh();partyPanel.append(confirm,back);
  }

  async function choosePassword(){
    const request=++partyRequest;selectedMode='PASSWORD_BATTLE';section.dataset.battleMode=selectedMode;
    list.hidden=true;partyPanel.hidden=false;partyPanel.replaceChildren();entryNotice.hidden=true;
    for(const node of matchOnlyNodes)node.hidden=true;
    const back=actionButton('返回賽事選擇');back.addEventListener('click',()=>{if(!entering)void selectMode('TITLE_MATCH');});
    let setup;
    try{setup=await getPasswordSelection();}
    catch(error){if(!cubeDisposed&&request===partyRequest){showRefusal({ok:false,message:'密碼對戰載入失敗，請再試一次。'},{});partyPanel.append(back);}return;}
    if(cubeDisposed||request!==partyRequest)return;
    const maxLength=Number.isInteger(setup?.maxLength)?setup.maxLength:22;
    partyPanel.append(element('h2','cm-vs5-title','密碼對戰'),
      element('p','cm-vs5-entry-notice','輸入兩組隊伍密碼。每組密碼可還原最多 3 隻數碼獸。'));
    const inputs=[];
    for(const team of ['A','B']){
      const label=element('label','cm-vs5-password-label',`${team} 隊密碼`);
      const input=element('input','cm-vs5-password-input');input.value='';input.maxLength=maxLength;
      input.setAttribute('maxlength',String(maxLength));input.setAttribute('autocomplete','off');input.setAttribute('autocapitalize','none');
      input.setAttribute('spellcheck','false');input.setAttribute('aria-label',`${team} 隊密碼`);
      label.append(input);inputs.push(input);partyPanel.append(label);
    }
    const confirm=actionButton('開始密碼對戰',{primary:true});confirm.disabled=true;
    const refresh=()=>{confirm.disabled=entering||inputs.some(input=>![...input.value].length);back.disabled=entering;};
    for(const input of inputs)input.addEventListener('input',refresh);
    confirm.addEventListener('click',async()=>{
      if(confirm.disabled)return;entering=true;refresh();entryNotice.hidden=true;
      try{showRefusal(await onEnter(-1,inputs.map(input=>input.value),'PASSWORD_BATTLE'),{});}
      catch(error){if(!cubeDisposed)showRefusal({ok:false,message:'密碼對戰準備失敗，請再試一次。'},{});}
      finally{entering=false;if(!cubeDisposed)refresh();}
    });
    refresh();partyPanel.append(confirm,back);
  }

  async function chooseLink(){
    const request=++partyRequest;selectedMode='LINK_BATTLE';section.dataset.battleMode=selectedMode;
    list.hidden=true;partyPanel.hidden=false;partyPanel.replaceChildren();entryNotice.hidden=true;
    for(const node of matchOnlyNodes)node.hidden=true;
    const back=actionButton('返回賽事選擇');back.addEventListener('click',()=>{if(!entering)void selectMode('TITLE_MATCH');});
    let setup;
    try{setup=await getLinkSelection();if(!Array.isArray(setup?.candidates))throw new Error('LINK_SELECTION_REQUIRED');}
    catch(error){if(!cubeDisposed&&request===partyRequest){showRefusal({ok:false,message:'通訊對戰載入失敗，請再試一次。'},{});partyPanel.append(back);}return;}
    if(cubeDisposed||request!==partyRequest)return;
    const rolePanel=element('section','cm-vs5-link');
    const title=element('h2','cm-vs5-title','通訊對戰');
    const note=element('p','cm-vs5-entry-notice','兩台裝置交換邀請碼與回覆碼，完成後會使用相同隊伍、場地與戰鬥亂數。');
    const host=actionButton('建立邀請'),guest=actionButton('加入邀請');
    partyPanel.append(title,note,host,guest,rolePanel,back);

    const teamPicker=(container,selected,refresh)=>{
      const controls=[];container.append(element('h3','cm-vs5-link__heading','選擇參賽數碼獸（1 至 3 隻）'));
      for(const entry of setup.candidates){
        const button=actionButton(entry.displayName??entry.name??entry.instanceId);button.setAttribute('aria-pressed','false');
        button.disabled=!entry.admission.ok;
        if(!entry.admission.ok)button.append(element('span','cm-vs5-match__fee',entry.admission.message));
        button.addEventListener('click',()=>{const at=selected.indexOf(entry.instanceId);if(at<0)selected.push(entry.instanceId);else selected.splice(at,1);refresh();});
        controls.push({entry,button});container.append(button);
      }
      return ()=>{for(const {entry,button} of controls){const picked=selected.includes(entry.instanceId);button.setAttribute('aria-pressed',String(picked));button.disabled=entering||!entry.admission.ok||(!picked&&selected.length>=3);}};
    };
    const codeField=(labelText,readOnly=false)=>{
      const label=element('label','cm-vs5-password-label',labelText),field=element('textarea','cm-vs5-link-code');
      field.value='';field.setAttribute('aria-label',labelText);field.setAttribute('autocomplete','off');field.setAttribute('spellcheck','false');
      if(readOnly){field.readOnly=true;field.setAttribute('readonly','');}
      label.append(field);return {label,field};
    };
    const start=async prepared=>{
      entering=true;host.disabled=true;guest.disabled=true;back.disabled=true;entryNotice.hidden=true;
      try{showRefusal(await onEnter(-1,prepared,'LINK_BATTLE'),{});}
      catch(error){if(!cubeDisposed)showRefusal({ok:false,message:'通訊對戰準備失敗，請再交換一次通訊碼。'},{});}
      finally{entering=false;if(!cubeDisposed){host.disabled=false;guest.disabled=false;back.disabled=false;}}
    };
    const renderHost=()=>{
      rolePanel.replaceChildren();const selected=[],invite=codeField('邀請碼',true),reply=codeField('對方回覆碼');
      const create=actionButton('產生邀請碼',{primary:true}),begin=actionButton('讀取回覆並開始',{primary:true});begin.disabled=true;
      let updateButtons=()=>{};
      const refresh=()=>{updateButtons();create.disabled=entering||selected.length===0;begin.disabled=entering||!invite.field.value||!reply.field.value;};
      updateButtons=teamPicker(rolePanel,selected,refresh);reply.field.addEventListener('input',refresh);
      create.addEventListener('click',async()=>{if(create.disabled)return;entering=true;refresh();
        const result=await setup.createInvite([...selected]);entering=false;if(result.ok){invite.field.value=result.inviteCode;invite.field.dataset.arena=String(result.arenaIndex);}else showRefusal(result,{});refresh();});
      begin.addEventListener('click',async()=>{if(begin.disabled)return;entering=true;refresh();const prepared=await setup.prepareHost(invite.field.value,reply.field.value);
        entering=false;refresh();if(!prepared.ok){showRefusal(prepared,{});return;}await start(prepared);});
      rolePanel.append(create,invite.label,reply.label,begin);refresh();
    };
    const renderGuest=()=>{
      rolePanel.replaceChildren();const selected=[],invite=codeField('對方邀請碼'),reply=codeField('回覆碼',true);
      const create=actionButton('產生回覆碼',{primary:true}),begin=actionButton('已分享回覆碼，開始對戰',{primary:true});begin.disabled=true;
      let prepared=null,updateButtons=()=>{};
      const refresh=()=>{updateButtons();create.disabled=entering||selected.length===0||!invite.field.value;begin.disabled=entering||!prepared;};
      updateButtons=teamPicker(rolePanel,selected,refresh);invite.field.addEventListener('input',()=>{prepared=null;reply.field.value='';refresh();});
      create.addEventListener('click',async()=>{if(create.disabled)return;entering=true;refresh();prepared=await setup.prepareGuest(invite.field.value,[...selected]);entering=false;
        if(prepared.ok)reply.field.value=prepared.replyCode;else{showRefusal(prepared,{});prepared=null;}refresh();});
      begin.addEventListener('click',async()=>{if(!begin.disabled)await start(prepared);});
      rolePanel.append(invite.label,create,reply.label,begin);refresh();
    };
    host.addEventListener('click',renderHost);guest.addEventListener('click',renderGuest);renderHost();
  }
  function renderMatches(nextMatches) {
    if (!Array.isArray(nextMatches)) return;
    matches = nextMatches;
    list.replaceChildren();
    entryNotice.hidden = true;
    if (matches.length === 0) {
      list.append(element("li", "cm-vs5-matches__empty", menuCopy.noMatch));
    }
    for (const match of matches) {
      const item = element("li", "cm-vs5-match");
      item.dataset.recordIndex = String(match.recordIndex);
      const button = actionButton(selectedMode==='FREE_BATTLE'?match.title:titleEventText(match.recordIndex, "name", match.title ?? `${menuCopy.match} ${match.recordIndex}`), { primary: true });
      button.classList.add("cm-vs5-match__enter");
      button.append(element("span", "cm-vs5-match__fee",
        `${menuCopy.entryFee ?? "報名費"} ${match.entryFee ?? "—"} 位元幣`));
      button.append(element("span", "cm-vs5-match__payout",
        `${menuCopy.prize ?? "獎金"} ${match.payout > 0 ? `${match.payout} 位元幣` : menuCopy.noPayout}`));
      button.addEventListener("click", async () => {
        if(getPartySelection){await chooseParty(match);return;}
        const result = await onEnter(match.recordIndex,undefined,selectedMode);
        if (result?.ok !== false) return;
        entryNotice.hidden = false;
        entryNotice.dataset.reason = result.reason ?? "ENTRY_REFUSED";
        const fee = result.entryFee ?? match.entryFee;
        const wallet = result.walletBits ?? result.wallet ?? result.bits;
        entryNotice.textContent = uiText(["INSUFFICIENT_FUNDS", "INSUFFICIENT_BITS"].includes(result.reason)
          ? `${menuCopy.insufficientFunds ?? "持有金額不足。"} ${menuCopy.entryFee ?? "報名費"} ${fee} 位元幣；${menuCopy.wallet ?? "持有"} ${wallet ?? "—"} 位元幣。`
          : (result.message ?? menuCopy.entryRefused ?? "目前無法參加這場對戰。"));
      });
      item.append(button);
      list.append(item);
    }
  }
  renderMatches(matches);
  section.append(list, partyPanel, entryNotice);

  // The multi-round tournaments sit in this menu in the original too:
  // ui/conference_list_item.nxr is a row here, not a screen of its own.
  if (typeof onOpenChampionship === "function") {
    const conference = actionButton(menuCopy.conference);
    conference.classList.add("cm-vs5-conference");
    conference.addEventListener("click", () => onOpenChampionship());
    section.append(conference);
  }

  if (typeof onExit === "function") {
    const exit = actionButton(menuCopy.returnHome);
    exit.classList.add("cm-vs5-exit");
    exit.addEventListener("click", () => onExit());
    section.append(exit);
  }

  return Object.freeze({
    render(reading = {}) { if(selectedMode==='TITLE_MATCH')renderMatches(reading.matches); },
    inspect() {
      return Object.freeze({
        screen: "BATTLE_SELECT",
        count: matches.length,
        mode: selectedMode,
        cube: cube?.getDiagnostics?.() ?? null
      });
    },
    dispose() {
      cubeDisposed = true;
      cube?.dispose?.();
      cube = null;
      root.replaceChildren();
    }
  });
}

/**
 * The clock band. One bar for the 7200 frames and one pip per 900-frame tier,
 * which is what the traced counter at +0x5E98 and its tier at +0x5E9C are.
 */
function clockBand(tierMax) {
  const band = element("div", "cm-vs5-clock");
  band.setAttribute("aria-label", uiText("Match clock"));
  const track = element("div", "cm-vs5-clock__track");
  const fill = element("span", "cm-vs5-clock__fill");
  track.append(fill);
  const pips = element("div", "cm-vs5-clock__pips");
  const marks = [];
  for (let index = 0; index <= tierMax; index += 1) {
    const pip = element("span", "cm-vs5-clock__pip");
    pip.dataset.tier = String(index);
    marks.push(pip);
    pips.append(pip);
  }
  band.append(track, pips);
  return {
    band,
    update(clock) {
      fill.style.width = `${Math.round(clock.ratio * 100)}%`;
      band.dataset.tier = String(clock.tier);
      marks.forEach((pip, index) => { pip.dataset.spent = String(index < clock.tier); });
    }
  };
}

/**
 * The event log band. VS5 is Auto Battle, so this is a record of what happened
 * and never a command menu -- see the contract's notShown.commandMenu.
 */
function eventLogBand(labels) {
  const band = element("section", "cm-vs5-log");
  band.setAttribute("aria-label", uiText("Match record"));
  const line = element("p", "cm-vs5-log__line", "");
  const detail = element("p", "cm-vs5-log__detail", "");
  band.append(line, detail);
  return {
    band,
    update(outcome) {
      band.dataset.ended = String(outcome.ended);
      if (!outcome.ended) {
        line.textContent = uiText(labels.running);
        detail.textContent = uiText("");
        return;
      }
      band.dataset.verdict = outcome.verdict;
      line.textContent = uiText(VS5_VERDICT_LABELS[outcome.verdict] ?? outcome.verdict);
      detail.textContent = uiText(VS5_END_REASON_LABELS[outcome.reason] ?? outcome.reason);
    }
  };
}

function meter(className, label) {
  const wrap = element("div", `cm-vs5-meter ${className}`);
  wrap.setAttribute("aria-label", uiText(label));
  const fill = element("span", "cm-vs5-meter__fill");
  wrap.append(fill);
  return { wrap, fill };
}

function combatantCard(combatant, compact,hudArt=null) {
  const card = element("li", `cm-vs5-fighter${compact ? " cm-vs5-fighter--compact" : ""}`);
  card.dataset.slot = String(combatant.slot);
  card.dataset.team = String(combatant.team);
  if (!combatant.present) {
    card.dataset.present = "false";
    card.append(element("span", "cm-vs5-fighter__empty", "—"));
    return { card, update() {} };
  }
  card.dataset.present = "true";
  const name = element("span", "cm-vs5-fighter__name", combatant.displayName ?? uiText(`SLOT ${combatant.slot + 1}`), false);
  const hp = meter("cm-vs5-meter--hp", "Health");
  const hpValue = element('span', 'cm-vs5-fighter__hp');
  const portrait=element('img','cm-vs5-fighter__portrait');portrait.alt='';portrait.hidden=true;
  card.append(portrait);
  card.append(name, hp.wrap, hpValue);
  let resource = null;
  let sequenceId=0,sequenceStart=0;
  if (!compact) {
    resource = meter("cm-vs5-meter--resource", "Action resource");
    card.append(resource.wrap);
  }
  return {
    card,
    update(next,frame=0,outcome=null) {
      const requested=outcome?.ended&&outcome.winningTeam===next.team?9:next.down?5:0;
      if(requested!==sequenceId){sequenceId=requested;sequenceStart=frame;}
      const image=hudArt?.getBattleFrame(next.speciesId,sequenceId,Math.max(0,frame-sequenceStart));
      portrait.hidden=!image;
      if(image){if(portrait.getAttribute('src')!==image.src)portrait.src=image.src;}
      hp.fill.style.width = `${Math.round(next.hp.ratio * 100)}%`;
      hpValue.textContent = uiText(`生命值 ${next.hp.current} / ${next.hp.maximum}`);
      hp.wrap.setAttribute('aria-label', uiText(hpValue.textContent));
      card.dataset.down = String(next.down);
      card.dataset.engaged = String(next.engaged);
      if (resource) resource.fill.style.width = `${Math.round(next.resource.ratio * 100)}%`;
    }
  };
}

/**
 * The match. `mountField` attaches the Pixi scene to the host this creates; the
 * DOM carries the words the scene cannot draw and nothing else.
 */
export function createBattleFieldView({ root, frame, mountField, onExit,hudArt=null,localTeamIndex=0 }) {
  if (!frame || !Array.isArray(frame.combatants)) throw new TypeError("The Battle field view requires a battle frame");
  if (typeof mountField !== "function") throw new TypeError("The Battle field view requires the published field mounter");
  if(![0,1].includes(localTeamIndex))throw new TypeError('The Battle field view requires a local team');

  const section = shell(root, "BATTLE_FIELD", "Battle");
  section.dataset.arena = frame.arena.identifier;
  section.dataset.rosterEvidence = frame.rosterEvidence ?? "PRODUCT_AUTHORED";

  const opponents = element("ul", "cm-vs5-roster cm-vs5-roster--opponent");
  const players = element("ul", "cm-vs5-roster cm-vs5-roster--player");
  const cards = new Map();
  for (const combatant of frame.combatants) {
    const compact = combatant.team !== localTeamIndex;
    const built = combatantCard(combatant, compact,hudArt);
    cards.set(combatant.slot, built);
    (compact ? opponents : players).append(built.card);
  }

  const host = element("div", "cm-vs5-field");
  host.setAttribute("aria-label", uiText("Battle field. The match runs on its own."));
  host.setAttribute('aria-busy','true');
  const loading=element('p','cm-vs5-field__loading','正在準備對戰場地…');
  loading.setAttribute('role','status');host.append(loading);

  // The arena name and the evidence label live INSIDE the clock band: the shell
  // holds the contract's five bands and nothing else, so a sixth child cannot
  // quietly shrink all five out of proportion.
  const clock = clockBand(frame.clockTierMax ?? 7);
  const caption = element("div", "cm-vs5-clock__caption");
  caption.append(element("span", "cm-vs5-kicker", frame.arena.identifier.replace("BATTLE_", "")));
  caption.append(element("span", "cm-vs5-evidence",
    VS5_EVIDENCE_LABELS[frame.rosterEvidence] ?? VS5_EVIDENCE_LABELS.PRODUCT_AUTHORED));
  clock.band.prepend(caption);
  const log = eventLogBand({ running: "對戰進行中" });
  const localOutcome=outcome=>localTeamIndex===0?outcome:{...outcome,
    verdict:outcome.verdict==='TEAM_ZERO_AHEAD'?'TEAM_ONE_AHEAD':outcome.verdict==='TEAM_ONE_AHEAD'?'TEAM_ZERO_AHEAD':outcome.verdict,
    winningTeam:outcome.winningTeam===null?null:1-outcome.winningTeam};

  const exit = actionButton("離開對戰");
  exit.classList.add("cm-vs5-exit");
  if (typeof onExit === "function") exit.addEventListener("click", () => onExit());
  log.band.append(exit);

  // The five bands the contract declares, in its order: clock, the opponent's
  // three, the field, the player's three, the record.
  section.append(clock.band, opponents, host, players, log.band);

  const field = mountField({ host,
    onReady(){host.setAttribute('aria-busy','false');loading.remove();},
    onError(){host.setAttribute('aria-busy','false');loading.textContent='對戰場地載入失敗，請返回牧場後再試。';}
  });

  return Object.freeze({
    /** Called with each view the presentation source publishes. */
    render(view) {
      for (const combatant of view.combatants) {
        if (!combatant.present) continue;
        cards.get(combatant.slot)?.update(combatant,view.animationFrame??0,view.outcome);
      }
      clock.update(view.clock);
      log.update(localOutcome(view.outcome));
      section.dataset.ended = String(view.outcome.ended);
      if (view.outcome.ended) {
        section.dataset.verdict = view.outcome.verdict;
        section.dataset.endReason = view.outcome.reason;
      }
    },
    inspect() {
      return Object.freeze({
        screen: "BATTLE_FIELD",
        arena: frame.arena.identifier,
        cards: cards.size,
        bands: [...section.children].map((child) => child.className.split(" ")[0])
      });
    },
    dispose() {
      field?.dispose?.();
      root.replaceChildren();
    }
  });
}

/** The result. One verdict, one reason, one way out. */
/**
 * The battle result -- the original's eight-scene sequence, not one page.
 *
 * The ROM carries eight scenes under battle_result, and their node tables say
 * what each one is for:
 *
 *   result_sub_scene        digimon1..3 + text   the verdict over the three slots
 *   result_sub_prize_scene  get1..6, have1..6    what was won against what is held
 *   result_sub_rankup_scene tamer_rank + text    the rank award
 *   result_sub_titleget     medal1..7, title_name, title_medal_get
 *   result_sub_status_scene battle0..3, win...   per-creature battle and win tallies
 *   battle_result_log_scene log_space
 *   result_sub_base                              the shared frame
 *   result_sub_net_scene                         the network variant
 *
 * A panel is only shown when this build has a traced source for it. The status
 * panel is NOT shown: per-creature battle counts and win rates have no traced
 * read site, and filling battle0..3 with zeroes would read as a real tally. The
 * net panel is out of scope for a single-player product.
 *
 * Panels advance one at a time, which is how the original presents them; the
 * last one returns home.
 */
export function createBattleResultView({ root, outcome, receipt = null, matchTitle = null, progression=null, statistics=null, unlocks=[], hudArt=null, onExit }) {
  if (!outcome || typeof outcome !== "object") throw new TypeError("The Battle result requires an outcome");

  const section = shell(root, "BATTLE_RESULT", "Battle result");
  section.dataset.verdict = outcome.verdict;
  section.dataset.endReason = outcome.reason;

  const panels = [];

  // result_sub_scene -- the verdict.
  panels.push({
    id: "RESULT",
    scene: "result_sub_scene",
    build() {
      const frag = document.createDocumentFragment();
      const header = element("header", "cm-vs5-header");
      header.append(element("span", "cm-vs5-kicker", VS5_END_REASON_LABELS[outcome.reason] ?? outcome.reason));
      header.append(element("h1", "cm-vs5-title", VS5_VERDICT_LABELS[outcome.verdict] ?? outcome.verdict));
      frag.append(header);
      // A level verdict is shown as a loss because OVL19 0x02110B5C demotes it
      // before anything reads it. The reason stays visible so running out of
      // time is still distinguishable from being knocked down.
      if (outcome.winningTeam === null) {
        frag.append(element("p", "cm-vs5-result__detail", "雙方都未取得領先。"));
      }
      return frag;
    }
  });

  // result_sub_prize_scene has "get" and "have" values. Both come from the
  // app's wallet receipt, never from the advertised catalog payout. A missing
  // receipt must not read as either a successful credit or a zero-valued prize.
  const credited = receipt?.status === "SETTLED"
    && Number.isSafeInteger(receipt.credited) && receipt.credited >= 0
    && Number.isSafeInteger(receipt.walletAfter) && receipt.walletAfter >= 0;
  section.dataset.settlement = credited ? "SETTLED" : "NOT_CREDITED";
  panels.push({
    id: "PRIZE",
    scene: "result_sub_prize_scene",
    build() {
      const frag = document.createDocumentFragment();
      frag.append(element("span", "cm-vs5-kicker", "獎金"));
      frag.append(element("h1", "cm-vs5-title", credited ? String(receipt.credited) : "—"));
      if (!credited) {
        frag.append(element("p", "cm-vs5-result__detail", "獎金尚未入帳。"));
        return frag;
      }
      frag.append(element("p", "cm-vs5-result__detail", `持有 ${receipt.walletAfter} 位元幣`));
      if (receipt.clamped) {
        frag.append(element("p", "cm-vs5-result__detail",
          `獎金 ${receipt.rewardBits} 位元幣；持有金額已達上限。`));
      } else if (receipt.credited === 0) {
        frag.append(element("p", "cm-vs5-result__detail", "本場沒有獲得獎金。"));
      }
      if (matchTitle) frag.append(element("p", "cm-vs5-result__detail", matchTitle));
      return frag;
    }
  });

  if(credited&&receipt.won&&Number.isInteger(progression?.rankBefore)&&Number.isInteger(progression?.rankAfter)&&progression.rankAfter>progression.rankBefore){
    panels.push({id:'RANK',scene:'result_sub_rankup_scene',build(){
      const frag=document.createDocumentFragment();frag.append(element('span','cm-vs5-kicker','馴獸師升階'),
        element('h1','cm-vs5-title',`階級 ${progression.rankBefore} → ${progression.rankAfter}`));return frag;
    }});
  }
  if(credited&&receipt.won&&progression?.earnedTitles?.length){
    panels.push({id:'TITLE',scene:'result_sub_titleget',build(){
      const frag=document.createDocumentFragment();frag.append(element('span','cm-vs5-kicker','取得頭銜'));
      for(const title of progression.earnedTitles){
        const medal=hudArt?.getMedal?.(title.id);
        if(medal){const img=element('img','cm-vs5-result__medal');img.src=medal.src;img.alt='';img.width=medal.width*2;img.height=medal.height*2;frag.append(img);}
        frag.append(element('h1','cm-vs5-title',title.name));
      }return frag;
    }});
  }
  if(statistics){panels.push({id:'STATUS',scene:'result_sub_status_scene',build(){
    const frag=document.createDocumentFragment();frag.append(element('h1','cm-vs5-title','戰績'));
    const rows=element('dl','cm-vs5-result__statistics');
    for(const [label,value] of [['對戰場次',statistics.battles??'—'],['勝率',statistics.winPercent===null?'—':`${statistics.winPercent}%`],['頭銜數',statistics.titleCount]]){
      rows.append(element('dt','',label),element('dd','',String(value)));
    }
    frag.append(rows);return frag;
  }});}
  if(unlocks.length){panels.push({id:'LOG',scene:'battle_result_log_scene',build(){
    const frag=document.createDocumentFragment();frag.append(element('h1','cm-vs5-title','新解鎖'));
    for(const item of unlocks)frag.append(element('p','cm-vs5-result__detail',item.name));return frag;
  }});}
  const advance = actionButton("下一頁", { primary: true });
  const exit = actionButton("返回牧場", { primary: true });
  exit.classList.add("cm-vs5-exit");
  if (typeof onExit === "function") exit.addEventListener("click", () => onExit());

  const body = element("div", "cm-vs5-result__body");
  const characterHost=element('div','cm-vs5-result__characters');
  characterHost.setAttribute('aria-label','參賽數碼獸');
  const resultStage=element('div','cm-vs5-result__stage');resultStage.append(characterHost,body);
  let index = 0;

  function paint() {
    body.replaceChildren(panels[index].build());
    section.dataset.panel = panels[index].id;
    section.dataset.originalScene = panels[index].scene;
    const last = index === panels.length - 1;
    advance.hidden = last;
    exit.hidden = !last;
  }

  advance.addEventListener("click", () => {
    if (index < panels.length - 1) { index += 1; paint(); }
  });

  section.append(resultStage, advance, exit);
  paint();

  return Object.freeze({
    getCharacterHost:()=>characterHost,
    render() {},
    inspect() {
      return Object.freeze({
        settlement: credited ? "SETTLED" : "NOT_CREDITED",
        credited: credited ? receipt.credited : null,
        panels: panels.map((panel) => panel.id),
        shownScenes: panels.map((panel) => panel.scene),
        // Named so the gap is visible rather than silently absent.
        notBuilt: Object.freeze([]),
        conditionalScenes: Object.freeze(['result_sub_rankup_scene','result_sub_titleget']),
        visualGaps:Object.freeze(['ORIGINAL_RANK_ART','ORIGINAL_SCENE_TRANSITIONS']),
        outOfScope: Object.freeze(["result_sub_net_scene"])
      });
    },
    dispose() {}
  });
}
