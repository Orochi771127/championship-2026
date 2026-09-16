import { uiText } from "../text/uiText.js";
import {raisingMessageText,RAISING_MESSAGE_SENDERS} from '../text/raisingMessages.zhHant.js';
import { speciesName } from "../text/zhHant.js";
import { assembledHudArt } from '../presentation/assembledUiArt.js';
// INT-RH2 — Codex-owned P1R DOM presentation.
//
// This module consumes only the published Raising presentation seam. It never
// imports the standalone app, Raising domain, save port, forensic catalogs, or
// Pixi bootstrap. The field presenter is injected by the Claude-owned runtime
// integration and remains the sole Pixi authority.

// Owner 2026-09-16 removed the standing save line. DIRTY/CLEAN/SAVED are states
// the player no longer needs narrated; only a save that did not happen is worth
// interrupting them for.
const SAVE_COPY = Object.freeze({
  SAVE_FAILED: "Save did not complete. You can try again.",
  CONFLICT: "另一個分頁已更新存檔。請先匯出這裡的進度，再重新載入並選擇繼續遊戲。"
});
const NOTICE_HOLD_MS = 4000;

function node(tag, className = "", text = undefined) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = uiText(String(text));
  return element;
}

function assertPresentationSource(source) {
  if (!source || typeof source.getFrame !== "function" || typeof source.subscribe !== "function") {
    throw new TypeError("INT-RH2 requires a getFrame/subscribe presentation source");
  }
  const intents = source.intents;
  for (const name of ["selectCreature", "relocateCreature", "careForCreature", "requestSave"]) {
    if (typeof intents?.[name] !== "function") {
      throw new TypeError(`INT-RH2 presentation source is missing intent: ${name}`);
    }
  }
  return source;
}

function selectedResident(frame) {
  const id = frame?.selection?.creatureId ?? null;
  return frame?.residents?.find((resident) => resident.creatureId === id) ?? null;
}

function cageName(frame, cageId) {
  return frame?.cages?.find((cage) => cage.cageId === cageId)?.name ?? "Raising Home";
}

/**
 * Mount the P1R screen UI around the one Claude-owned Pixi field presenter.
 *
 * @param {object} options
 * @param {HTMLElement} options.root
 * @param {object} options.source getFrame/subscribe/intents seam
 * @param {(args: {host: HTMLElement, source: object}) => object|Promise<object>} options.mountField
 */
export async function createRaisingHomeP1RView({ root, source, mountField, hudArt=null } = {}) {
  if (!root) throw new TypeError("INT-RH2 P1R view requires a root element");
  const presentation = assertPresentationSource(source);
  if (typeof mountField !== "function") {
    throw new TypeError("INT-RH2 P1R view requires the Claude-owned field mount function");
  }

  root.replaceChildren();
  root.className = "int-rh2-root";
  root.dataset.uiAuthority = "P1R_DOM";

  const shell = node("main", "int-rh2-shell");
  shell.dataset.rendererSplit = "DOM_UI_PIXI_FIELD";

  // Owner 2026-09-16: no title band and no SAVE button here. The gold status
  // bar above already names the screen and carries the clock, the toolbar's
  // System menu still has Save & Quit, and the application now writes the save
  // when the page is hidden. The habitat gets the height all three used to take.
  const fieldFrame = node("section", "int-rh2-field-frame");
  fieldFrame.setAttribute("aria-label", uiText("Playable Raising field"));
  const fieldLabel = node("div", "int-rh2-field-frame__label");
  const fieldState = node("span", "int-rh2-field-state", "FIELD ONLINE");
  fieldLabel.append(fieldState);
  const fieldHost = node("div", "int-rh2-field-host");
  fieldHost.dataset.rendererAuthority = "PIXI_SINGLE_FIELD";
  fieldFrame.append(fieldLabel, fieldHost);

  // The companion readout floats over the habitat's headroom band rather than
  // taking a row of its own. It is the same height whether or not a resident is
  // picked, so the frame below no longer changes shape on selection, and it
  // never takes a tap: the residents underneath still do.
  const companion = node("section", "int-rh2-companion");
  companion.setAttribute("aria-live", "polite");
  companion.dataset.open = "false";
  companion.setAttribute("aria-hidden", "true");
  const portraitSlot=node('div','int-rh2-companion__portrait');
  const portrait=node('img');portrait.alt='';portrait.hidden=true;portraitSlot.append(portrait);
  const companionCopy = node("div", "int-rh2-companion__copy");
  const companionName = node("h2", "int-rh2-companion__name", "SELECT A RESIDENT");
  const companionLocation = node("p", "int-rh2-companion__location", "Touch a resident in the habitat.");
  const ranchIcon = node('img', 'int-rh2-companion__ranch-icon');
  ranchIcon.alt = ''; ranchIcon.hidden = true;
  const place = node('div', 'int-rh2-companion__place');
  place.append(ranchIcon, companionLocation);
  companionCopy.append(companionName, place);

  // OVL18 0211F790 uses the individual's current/max HP and TP. Its AP
  // readout is a constant full bar, not a fabricated combat AP value.
  const vitals = node("dl", "int-rh2-vitals");
  function meter(label) {
    const value = node("dd", "int-rh2-vitals__value");
    const text = node("span", "int-rh2-vitals__num", "--");
    const bar = node("span", "int-rh2-vitals__bar");
    value.append(text, bar);
    return { label: node("dt", "int-rh2-vitals__label", label), value, text, bar };
  }
  const hp = meter("HP"), tp = meter("TP");
  const apValue = node('dd','int-rh2-vitals__value int-rh2-vitals__ap');
  const apBar=node('span','int-rh2-vitals__ap-bar');apBar.setAttribute('aria-label','AP');apValue.append(apBar);
  const capacityValue=node('dd','int-rh2-vitals__value int-rh2-vitals__capacity','--');
  vitals.append(
    hp.label, hp.value,
    tp.label, tp.value,
    node('dt','int-rh2-vitals__label','AP'),apValue,
    node('dt','int-rh2-vitals__label','容量'),capacityValue
  );
  companionCopy.append(vitals);
  // The generic CARE button was removed on 2026-09-03 at the Owner's direction:
  // the original has no such control. Care there is "pick a tool, touch the
  // target" over six distinct tools, and its effects are UNKNOWN_REQUIRES_TRACE
  // in OVL18. The intent seam (careForCreature) stays; nothing calls it until
  // the traced tool behaviour exists.
  companion.append(portraitSlot,companionCopy);

  // The 8-slot toolbar shell that used to sit here was removed on 2026-09-03
  // by the Claude lane: championshipToolbar.js now mounts the real toolbar at
  // body level, which is where ui/toolbar.nxr belongs (Shared, attached by the
  // ARM9 main binary rather than by OVL18). Two toolbars is worse than one.
  // What the removed status line alone used to carry: a save that failed or
  // was overtaken by another tab, and the day's lifecycle events. It sits over
  // the habitat, under the companion card, and an ordinary event leaves again.
  const notice = node("div", "int-rh2-notice");
  notice.hidden = true;
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  const noticeText = node("p", "int-rh2-notice__text");
  const recovery=node('button','int-rh2-system-button','匯出未存成功的進度');recovery.type='button';recovery.hidden=true;
  recovery.addEventListener('click',()=>{
    const data=presentation.intents.exportRecovery?.();if(!data?.text)return;
    const url=URL.createObjectURL(new Blob([data.text],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='championship-recovery.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  notice.append(noticeText, recovery);
  fieldFrame.append(companion, notice);

  // One screen: the habitat, with its readout and notices over it. The shared
  // status bar and toolbar remain mounted by the existing application.
  shell.append(fieldFrame);
  root.append(shell);

  let noticeTimer = null;
  let stickyNotice = null;
  function showNotice(text, { sticky = false } = {}) {
    if (sticky) stickyNotice = text;
    noticeText.textContent = text;
    notice.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = null;
    if (sticky) return;
    noticeTimer = setTimeout(() => {
      noticeTimer = null;
      if (stickyNotice !== null) { noticeText.textContent = stickyNotice; return; }
      notice.hidden = true;
    }, NOTICE_HOLD_MS);
  }
  function clearStickyNotice() {
    if (stickyNotice === null) return;
    stickyNotice = null;
    if (noticeTimer === null) notice.hidden = true;
  }
  const transition=node('div','int-rh2-lifecycle');transition.hidden=true;transition.setAttribute('aria-live','polite');
  const transitionText=node('p','int-rh2-lifecycle__text');
  const retry=node('button','int-rh2-system-button','Retry');retry.type='button';retry.hidden=true;
  retry.addEventListener('click',()=>presentation.intents.requestSave());transition.append(transitionText,retry);root.append(transition);
  const calendar=node('button','int-rh2-calendar');calendar.type='button';calendar.hidden=true;calendar.setAttribute('aria-label','確認新日期，返回育成');
  const dateTitle=node('div','int-rh2-calendar__date'),calendarGrid=node('div','int-rh2-calendar__grid');calendar.append(dateTitle,calendarGrid);transition.append(calendar);
  calendar.addEventListener('click',()=>presentation.intents.acknowledgeCalendar());
  const dayConfirm=node('div','int-rh2-day-confirm');dayConfirm.hidden=true;dayConfirm.setAttribute('role','dialog');dayConfirm.setAttribute('aria-label','結束今天');dayConfirm.setAttribute('aria-modal','true');
  const yes=node('button','int-rh2-system-button','是'),no=node('button','int-rh2-system-button','否');yes.type=no.type='button';
  yes.addEventListener('click',()=>presentation.intents.confirmDayEnd(true));no.addEventListener('click',()=>presentation.intents.confirmDayEnd(false));
  dayConfirm.append(node('p','','要結束今天嗎？'),yes,no);transition.append(dayConfirm);
  const mailIcon=node('button','int-rh2-mail-icon');mailIcon.type='button';mailIcon.hidden=true;mailIcon.setAttribute('aria-label','開啟信件');
  mailIcon.addEventListener('click',()=>presentation.intents.openMail());root.append(mailIcon);
  const letter=node('section','int-rh2-letter');letter.hidden=true;letter.setAttribute('role','dialog');letter.setAttribute('aria-label','信件');letter.setAttribute('aria-modal','true');
  const sender=node('p','int-rh2-letter__sender'),letterText=node('p','int-rh2-letter__text'),letterAck=node('button','int-rh2-letter__ack','確認');letterAck.type='button';
  letterAck.addEventListener('click',()=>presentation.intents.acknowledgeMail());letter.append(sender,letterText,letterAck);transition.append(letter);

  const trainingLayer=node('div','int-rh2-training-labels');trainingLayer.setAttribute('aria-hidden','true');fieldHost.append(trainingLayer);
  // Ordered by the native command table, corroborated by Cage descriptions.
  const trainingNames=['病毒','疫苗','資料','龍','獸','水','鳥','機械','聖','昆蟲植物','暗','耐熱','耐寒','耐雷','耐暗','耐光','HP','TP','攻擊','防禦','智力','速度','飽足','HP','壓力','親密','友情','疲勞'];
  const trainingNodes=new Map();
  function renderTrainingLabels(labels){
    const live=new Set();for(const label of labels){live.add(label.id);let text=trainingNodes.get(label.id);
      if(!text){text=node('span','int-rh2-training-label');trainingLayer.append(text);trainingNodes.set(label.id,text);}
      const c=label.command;text.textContent=`${trainingNames[c.kind]} ${c.outcome==='MAX'?'MAX':c.outcome==='MIN'?'MIN':c.delta>0?'＋'+c.delta:String(c.delta)}`;
      text.dataset.positive=String(c.delta>=0);text.style.left=`${label.x}px`;text.style.top=`${label.y}px`;text.style.opacity=String(label.alpha);text.style.fontSize=`${Math.max(12,12*label.scale)}px`;
    }
    for(const [id,n] of trainingNodes)if(!live.has(id)){n.remove();trainingNodes.delete(id);}
  }
  const field = await mountField({ host: fieldHost, source: presentation,onTrainingFrame:renderTrainingLabels });
  if (!field || typeof field.render !== "function" || typeof field.dispose !== "function") {
    throw new TypeError("Claude-owned field presenter must expose render(frame) and dispose()");
  }

  // A save that succeeded says nothing: the player asked for the running
  // commentary to go. A save that did not happen still has to interrupt them,
  // and it stays up until the port reports otherwise.
  function paintSaveStatus(saveStatus) {
    const phase = saveStatus?.phase ?? "CLEAN";
    const failed = phase === "SAVE_FAILED";
    recovery.hidden = !failed || typeof presentation.intents.exportRecovery !== 'function';
    if (saveStatus?.conflict) showNotice(SAVE_COPY.CONFLICT, { sticky: true });
    else if (failed) showNotice(uiText(SAVE_COPY.SAVE_FAILED), { sticky: true });
    else clearStickyNotice();
  }

  let lastRevision = -1;
  let lastEventKey = null;
  function render(frame) {
    if (!frame || frame.revision === lastRevision) return;
    lastRevision = frame.revision;

    fieldFrame.dataset.residentCount = String(frame.residents?.length ?? 0);
    const nativeRanch = frame.ranch?.layoutVersion === 'NATIVE_ANCHORS_V1';
    const resident = selectedResident(frame);
    // With the readout hidden until someone is picked, this corner label is
    // where a player learns that a resident can be tapped at all.
    fieldState.textContent = !nativeRanch ? uiText('FIELD ONLINE')
      : resident ? uiText('SWIPE TO VIEW')
      : `${uiText('TAP A RESIDENT')}・${uiText('SWIPE TO VIEW')}`;
    const ranchImage = assembledHudArt(`ranch-${resident?.nativeCageDefinition}`);
    ranchIcon.hidden = !ranchImage;
    if (ranchImage && ranchIcon.getAttribute('src') !== ranchImage.src) ranchIcon.src = ranchImage.src;
    const image=hudArt?.getPortrait(resident?.speciesId);
    portrait.hidden=!image;
    // Sized by its well, not by the source pixels. Setting the source size here
    // is what made a tall portrait grow the card and reshape the frame below it.
    if(image&&portrait.getAttribute('src')!==image.src)portrait.src=image.src;
    companion.dataset.open = resident ? "true" : "false";
    companion.setAttribute("aria-hidden", resident ? "false" : "true");
    companionName.textContent = resident?.displayName ?? uiText("SELECT A RESIDENT");
    const stats = resident?.stats ?? null;
    const fill = (current, max) => `${max > 0 ? Math.max(0, Math.min(100, Math.round(current / max * 100))) : 0}%`;
    const currentTp = stats ? stats.currentTp ?? stats.maxTp : 0;
    hp.text.textContent = uiText(stats ? `${stats.currentHp} / ${stats.maxHp}` : "--");
    tp.text.textContent = uiText(stats ? `${currentTp} / ${stats.maxTp}` : "--");
    hp.bar.style.setProperty('--fill', stats ? fill(stats.currentHp, stats.maxHp) : '0%');
    tp.bar.style.setProperty('--fill', stats ? fill(currentTp, stats.maxTp) : '0%');
    hp.bar.hidden = tp.bar.hidden = !stats;
    apBar.hidden=!resident;
    capacityValue.textContent=Number.isInteger(resident?.displayCapacityG)?`${resident.displayCapacityG} G`:'--';
    vitals.dataset.evidence = stats?.evidence ?? "NONE";

    companionLocation.textContent = uiText(resident
      ? `Living in ${nativeRanch ? resident.nativeCageName??'Raising Home' : cageName(frame, resident.cageId)}`
      : "Touch a resident in the habitat.");

    paintSaveStatus(frame.save);
    const lifecycle=frame.lifecycle,day=lifecycle?.day;
    const mailbox=lifecycle?.mailbox,activeMail=mailbox?.queue.find(q=>q.id===mailbox.activeId);
    mailIcon.hidden=!mailbox?.queue.length||!!activeMail||!!day||!!lifecycle?.evolution;
    letter.hidden=!activeMail||!!day||!!lifecycle?.evolution;
    if(activeMail){letter.dataset.system=String(activeMail.system);sender.textContent=RAISING_MESSAGE_SENDERS[activeMail.sender];
      letterText.textContent=raisingMessageText(activeMail.textId,activeMail.subjectName)||'新的通知已送達。';
      letterAck.disabled=!activeMail.system&&mailbox.activeFrames<61;
    }
    transition.hidden=!day&&!lifecycle?.evolution&&!lifecycle?.confirmation&&!activeMail;
    dayConfirm.hidden=!lifecycle?.confirmation;
    transition.dataset.phase=day?.phase??(lifecycle?.evolution?'evolution':'idle');
    transition.style.backgroundColor=day?`rgba(0,0,0,${day.phase==='fade-out'?Math.min(1,day.frames/8):day.phase==='fade-in'?Math.max(0,1-day.frames/8):1})`:'transparent';
    transitionText.textContent=day?.phase==='saving'?(day.savePhase==='SAVE_FAILED'?uiText('Save did not complete. You can try again.'):uiText('Saving...')):'';
    retry.hidden=day?.savePhase!=='SAVE_FAILED';
    calendar.hidden=!day?.phase?.startsWith('calendar');calendar.disabled=day?.phase!=='calendar';
    if(!calendar.hidden){const c=day.calendar;calendar.dataset.season=String(c.season);
      calendar.style.opacity=String(day.phase==='calendar-in'?Math.min(1,day.frames/16):day.phase==='calendar-out'?Math.max(0,1-day.frames/16):1);
      dateTitle.textContent=`${['春季','夏季','秋季','冬季'][c.season]}　${c.dayOfSeason+1} 日`;
      calendarGrid.replaceChildren(...c.days.map(row=>{const cell=node('div','int-rh2-calendar__day');cell.classList.toggle('is-today',row.day===c.dayOfSeason);
        cell.append(node('strong','',String(row.day+1)));
        if(row.registered||row.unwon){const counts=node('div','int-rh2-calendar__counts');counts.append(node('span','',`☑ ×${row.registered}`),node('span','',`□ ×${row.unwon}`));cell.append(counts);}return cell;}));
    }
    fieldHost.inert=Boolean(day||lifecycle?.evolution||lifecycle?.confirmation||activeMail);
    // The same lifecycle message rides along on later frames, so it is announced
    // once rather than restarting its own countdown on every repaint.
    const event=lifecycle?.message;
    const eventKey=event?`${event.kind}:${event.instanceId??''}:${event.target??''}`:null;
    if(eventKey!==null&&eventKey!==lastEventKey){
      if(event.kind==='EVOLVED'||event.kind==='REBORN'){
        const member=frame.residents.find(r=>r.creatureId===event.instanceId);
        if(member)showNotice(event.kind==='EVOLVED'?`${member.displayName} 進化成了${speciesName(event.target)}。`:`${member.displayName} 回到了數碼蛋。`);
      }
      if(event.kind==='DISAPPEARED')showNotice('數碼獸消失了。');
    }
    lastEventKey=eventKey;

    field.render(frame);
  }

  const unsubscribe = presentation.subscribe(render);
  render(presentation.getFrame());

  return Object.freeze({
    render,
    inspect() {
      return Object.freeze({
        uiAuthority: "P1R_DOM",
        fieldAuthority: "PIXI_SINGLE_FIELD",
        toolbarSlots: 0,
        // SAVE left this screen on 2026-09-16: the toolbar's System menu and the
        // application's hidden-page write own it now.
        activeInteractiveActions: ["SELECT", "RELOCATE"],
        guessedToolbarSemantics: 0,
        sourceRevision: lastRevision
      });
    },
    dispose() {
      unsubscribe?.();
      clearTimeout(noticeTimer);
      noticeTimer = null;
      field.dispose();
      root.replaceChildren();
      root.className = "";
    }
  });
}
