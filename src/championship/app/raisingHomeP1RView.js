import { uiText } from "../text/uiText.js";
import {raisingMessageText,RAISING_MESSAGE_SENDERS} from '../text/raisingMessages.zhHant.js';
import { speciesName } from "../text/zhHant.js";
// INT-RH2 — Codex-owned P1R DOM presentation.
//
// This module consumes only the published Raising presentation seam. It never
// imports the standalone app, Raising domain, save port, forensic catalogs, or
// Pixi bootstrap. The field presenter is injected by the Claude-owned runtime
// integration and remains the sole Pixi authority.

const SAVE_COPY = Object.freeze({
  DIRTY: "Changes are waiting to be saved.",
  CLEAN: "Raising Home is up to date.",
  SAVED: "Raising Home saved.",
  RESTORED: "Raising Home restored from save.",
  RECOVERED: "The last safe Raising Home state was recovered.",
  SAVE_FAILED: "Save did not complete. You can try again."
});

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
export async function createRaisingHomeP1RView({ root, source, mountField } = {}) {
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

  const header = node("header", "int-rh2-header");
  const identity = node("div", "int-rh2-header__identity");
  identity.append(
    node("p", "int-rh2-kicker", "DIGIMON CHAMPIONSHIP · 2026"),
    node("h1", "int-rh2-title", "RAISING HOME")
  );
  const clock = node("time", "int-rh2-clock", "--:--");
  clock.setAttribute("aria-label", uiText("Raising Home time"));
  const save = node("button", "int-rh2-system-button", "SAVE");
  save.type = "button";
  save.addEventListener("click", () => { void presentation.intents.requestSave(); });
  header.append(identity, clock, save);

  const fieldFrame = node("section", "int-rh2-field-frame");
  fieldFrame.setAttribute("aria-label", uiText("Playable Raising field"));
  const fieldLabel = node("div", "int-rh2-field-frame__label");
  const fieldState = node("span", "int-rh2-field-state", "FIELD ONLINE");
  fieldLabel.append(node("span", "int-rh2-kicker", "LIVE HABITAT"), fieldState);
  const fieldHost = node("div", "int-rh2-field-host");
  fieldHost.dataset.rendererAuthority = "PIXI_SINGLE_FIELD";
  fieldFrame.append(fieldLabel, fieldHost);

  const companion = node("section", "int-rh2-companion");
  companion.setAttribute("aria-live", "polite");
  const companionCopy = node("div", "int-rh2-companion__copy");
  const companionName = node("h2", "int-rh2-companion__name", "SELECT A RESIDENT");
  const companionLocation = node("p", "int-rh2-companion__location", "Touch a resident in the habitat.");
  companionCopy.append(node("p", "int-rh2-kicker", "COMPANION LINK"), companionName, companionLocation);

  // HP and TP, through the traced species -> stat-curve path. The original's
  // panel also shows AP, attack, defence, wisdom and speed; those are NOT here
  // because the stat curve carries one shared value for all of them, so there is
  // nothing to differentiate them with yet. Showing the same number under four
  // labels would read as parity and be invented.
  const vitals = node("dl", "int-rh2-vitals");
  const hpValue = node("dd", "int-rh2-vitals__value", "--");
  const tpValue = node("dd", "int-rh2-vitals__value", "--");
  vitals.append(
    node("dt", "int-rh2-vitals__label", "HP"), hpValue,
    node("dt", "int-rh2-vitals__label", "TP"), tpValue
  );
  companionCopy.append(vitals);
  // The generic CARE button was removed on 2026-09-03 at the Owner's direction:
  // the original has no such control. Care there is "pick a tool, touch the
  // target" over six distinct tools, and its effects are UNKNOWN_REQUIRES_TRACE
  // in OVL18. The intent seam (careForCreature) stays; nothing calls it until
  // the traced tool behaviour exists.
  companion.append(companionCopy);

  // The 8-slot toolbar shell that used to sit here was removed on 2026-09-03
  // by the Claude lane: championshipToolbar.js now mounts the real toolbar at
  // body level, which is where ui/toolbar.nxr belongs (Shared, attached by the
  // ARM9 main binary rather than by OVL18). Two toolbars is worse than one.
  const status = node("p", "int-rh2-status", "Raising Home is ready.");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  // One-screen adaptation of the original info-above-field hierarchy.
  // The shared status/toolbar remain mounted by the existing application.
  shell.append(header, companion, fieldFrame, status);
  root.append(shell);
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

  // A save is a RESULT; DIRTY/CLEAN is a STATE. The Raising clock advances on
  // every frame and legitimately marks the save dirty again on the frame after a
  // successful write, so the port's SAVED phase survived about eight
  // milliseconds and the player was told "changes are waiting to be saved"
  // immediately after saving a game that had in fact been written. Hold the
  // acknowledgement long enough to read it. `savedAt` is the port's own
  // timestamp for the last committed write and is already on the published
  // seam, so no new state is invented, the port stays truthful about dirtiness,
  // and a SAVE_FAILED is never masked.
  const SAVE_ACKNOWLEDGEMENT_MS = 1600;
  // Undefined until the first paint, so the baseline is never mistaken for a
  // commit: a new game starts at null and a restored one starts at the stored
  // save's timestamp, and neither is an acknowledgement.
  let savedAt;
  let acknowledgeUntil = 0;
  let acknowledgeTimer = null;

  function paintSaveStatus(saveStatus) {
    const committedAt = saveStatus?.savedAt ?? null;
    if (savedAt !== undefined && committedAt !== null && committedAt !== savedAt) {
      acknowledgeUntil = Date.now() + SAVE_ACKNOWLEDGEMENT_MS;
      clearTimeout(acknowledgeTimer);
      // render() is revision-gated and the clock stops publishing once the port
      // is already DIRTY, so the repaint that ends the acknowledgement has to be
      // scheduled rather than waited for.
      acknowledgeTimer = setTimeout(() => {
        acknowledgeTimer = null;
        paintSaveStatus(presentation.getFrame().save);
      }, SAVE_ACKNOWLEDGEMENT_MS);
    }
    savedAt = committedAt;
    const reported = saveStatus?.phase ?? "CLEAN";
    const phase = reported === "DIRTY" && Date.now() < acknowledgeUntil ? "SAVED" : reported;
    status.textContent = uiText(SAVE_COPY[phase] ?? "Raising Home status updated.");
    save.dataset.phase = phase;
    save.classList.toggle("is-dirty", phase === "DIRTY" || phase === "SAVE_FAILED");
  }

  let lastRevision = -1;
  function render(frame) {
    if (!frame || frame.revision === lastRevision) return;
    lastRevision = frame.revision;

    clock.textContent = uiText(frame.clock?.display ?? "--:--");
    fieldFrame.dataset.residentCount = String(frame.residents?.length ?? 0);
    const nativeRanch = frame.ranch?.layoutVersion === 'NATIVE_ANCHORS_V1';
    fieldState.textContent = uiText(nativeRanch ? 'SWIPE TO VIEW' : 'FIELD ONLINE');
    const resident = selectedResident(frame);
    companionName.textContent = resident?.displayName ?? uiText("SELECT A RESIDENT");
    const stats = resident?.stats ?? null;
    hpValue.textContent = uiText(stats ? `${stats.currentHp} / ${stats.maxHp}` : "--");
    tpValue.textContent = uiText(stats ? String(stats.maxTp) : "--");
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
    retry.hidden=day?.savePhase!=='SAVE_FAILED';save.disabled=Boolean(day||lifecycle?.evolution||lifecycle?.confirmation||activeMail);
    calendar.hidden=!day?.phase?.startsWith('calendar');calendar.disabled=day?.phase!=='calendar';
    if(!calendar.hidden){const c=day.calendar;calendar.dataset.season=String(c.season);
      calendar.style.opacity=String(day.phase==='calendar-in'?Math.min(1,day.frames/16):day.phase==='calendar-out'?Math.max(0,1-day.frames/16):1);
      dateTitle.textContent=`${['春季','夏季','秋季','冬季'][c.season]}　${c.dayOfSeason+1} 日`;
      calendarGrid.replaceChildren(...c.days.map(row=>{const cell=node('div','int-rh2-calendar__day');cell.classList.toggle('is-today',row.day===c.dayOfSeason);
        cell.append(node('strong','',String(row.day+1)));
        if(row.registered||row.unwon){const counts=node('div','int-rh2-calendar__counts');counts.append(node('span','',`☑ ×${row.registered}`),node('span','',`□ ×${row.unwon}`));cell.append(counts);}return cell;}));
    }
    fieldHost.inert=Boolean(day||lifecycle?.evolution||lifecycle?.confirmation||activeMail);
    const event=lifecycle?.message;
    if(event?.kind==='EVOLVED'||event?.kind==='REBORN'){
      const member=frame.residents.find(r=>r.creatureId===event.instanceId);
      if(member)status.textContent=event.kind==='EVOLVED'?`${member.displayName} 進化成了${speciesName(event.target)}。`:`${member.displayName} 回到了數碼蛋。`;
    }
    if(event?.kind==='DISAPPEARED')status.textContent='數碼獸消失了。';

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
        activeInteractiveActions: ["SELECT", "RELOCATE", "SAVE"],
        guessedToolbarSemantics: 0,
        sourceRevision: lastRevision
      });
    },
    dispose() {
      unsubscribe?.();
      clearTimeout(acknowledgeTimer);
      acknowledgeTimer = null;
      field.dispose();
      root.replaceChildren();
      root.className = "";
    }
  });
}
