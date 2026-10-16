import { createTransientHint, consumeRaisingHintDuration } from './transientHint.js';
import {getLocale} from '../text/locale.js';
import {productFormText} from '../text/productFormText.js';
const evolutionChoiceTitle=()=>productFormText('choose');
import { downloadSaveBackup } from './downloadSaveBackup.js';
import { isNativeRanchLayout } from "../cage/ranchExpansion.js";
import { retranslate, setLabel, setText, uiText } from "../text/uiText.js";
import {raisingMessageText,raisingMessageSender} from '../text/raisingMessages.zhHant.js';
import { speciesName } from "../text/zhHant.js";
import { assembledHudArt } from '../presentation/assembledUiArt.js';
import { prefersReducedMotion } from '../presentation/presentationPreferences.js';
import { playCeremony } from '../presentation/ceremony/ceremonyRunner.js';
import { buildEvolve } from '../presentation/ceremony/ceremonyScenes.js';
// INT-RH2 — Codex-owned P1R DOM presentation.
//
// This module consumes only the published Raising presentation seam. It never
// imports the standalone app, Raising domain, save port, forensic catalogs, or
// Pixi bootstrap. The field presenter is injected by the Claude-owned runtime
// integration and remains the sole Pixi authority.
//
// 2026-09-29 layout: the habitat is the whole screen between the shared status
// bar and toolbar. Nothing is held back for a readout any more. With nobody
// picked the screen shows the habitat and the tools only; picking a resident
// raises a compact card over the margin below the board (or above it, when the
// resident stands where the card would go); "詳細" opens the full record as a
// sheet. None of the three states resizes the field, so the board never moves
// under a finger.

// Owner 2026-09-16 removed the standing save line. DIRTY/CLEAN/SAVED are states
// the player no longer needs narrated; only a save that did not happen is worth
// interrupting them for.
const SAVE_COPY = Object.freeze({
  SAVE_FAILED: "Save did not complete. You can try again.",
  CONFLICT: "另一個分頁已更新存檔。請先匯出這裡的進度，再重新載入並選擇繼續遊戲。"
});
const NOTICE_HOLD_MS = 4000;

// Labels are remembered (setText / setLabel), so a language switch can
// relabel this screen in place: the habitat is not remounted.
function node(tag, className = "", text = undefined) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) setText(element, String(text));
  return element;
}

function button(className, text, label = null) {
  const element = node("button", className, text);
  element.type = "button";
  if (label) setLabel(element, "aria-label", label);
  return element;
}

const SEASON_NAMES = Object.freeze(["春季", "夏季", "秋季", "冬季"]);

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
 * @param {(creatureId: string) => object|null} [options.getRosterEntry] the roster record for the detail sheet
 * @param {(container: HTMLElement, entry: object) => void} [options.renderCreatureDetail] shared detail rows
 * @param {() => void} [options.openRoster] opens the Digimon roster
 */
export async function createRaisingHomeP1RView({ root, source, mountField, hudArt=null, getRosterEntry=null,
  renderCreatureDetail=null, openRoster=null, firstRunHint=false, nextHintDuration=consumeRaisingHintDuration } = {}) {
  if (!root) throw new TypeError("INT-RH2 P1R view requires a root element");
  const presentation = assertPresentationSource(source);
  if (typeof mountField !== "function") {
    throw new TypeError("INT-RH2 P1R view requires the Claude-owned field mount function");
  }

  root.replaceChildren();
  root.className = "int-rh2-root";
  root.dataset.uiAuthority = "P1R_DOM";
  root.dataset.selection = "none";

  const shell = node("main", "int-rh2-shell");
  shell.dataset.rendererSplit = "DOM_UI_PIXI_FIELD";

  // Owner 2026-09-16: no title band and no SAVE button here. The status bar
  // above names the screen and carries the clock, the toolbar's System menu
  // still has Save & Quit, and the application writes the save when the page
  // is hidden.
  const fieldFrame = node("section", "int-rh2-field-frame");
  setLabel(fieldFrame, "aria-label", "Playable Raising field");
  const fieldHost = node("div", "int-rh2-field-host");
  fieldHost.dataset.rendererAuthority = "PIXI_SINGLE_FIELD";
  fieldFrame.append(fieldHost);

  // Brief entry guidance. This is visual-only and never takes a field tap.
  const hint = node("p", "int-rh2-hint", "點選夥伴查看狀態・左右滑動查看牧場");
  hint.setAttribute("aria-hidden", "true");
  // The app enables entry guidance, not a gameplay/calendar predicate. The
  // first actual playable display lasts 5s; later view entries last 3s.
  let hintStarted = false, disposed = false, hintFocusReturn = null;
  function restoreHintFocus() {
    if (root.ownerDocument?.activeElement !== hint) return;
    if (hintFocusReturn?.isConnected) hintFocusReturn.focus?.();
    else hint.blur?.();
  }
  function syncHintOverflow() {
    if (disposed) return;
    const overflowing = !hint.hidden && hint.scrollHeight > hint.clientHeight + 1;
    hint.dataset.scroll = String(overflowing);
    hint.tabIndex = overflowing ? 0 : -1;
    hint.setAttribute('aria-hidden', String(!overflowing));
    if (!overflowing) restoreHintFocus();
  }
  hint.addEventListener('focus', event => { hintFocusReturn = event.relatedTarget; });
  const hintTimer = createTransientHint(hint, { beforeHide: restoreHintFocus, onPhaseChange: syncHintOverflow });
  function updateEntryHint(frame) {
    if (disposed || hintStarted || !firstRunHint || field.isPlayable === false) return;
    if (root.ownerDocument?.hidden || fieldHost.getAttribute('aria-busy') === 'true') return;
    const lifecycle = frame?.lifecycle;
    if (selectedResident(frame) || lifecycle?.day || lifecycle?.evolution || lifecycle?.confirmation || lifecycle?.mailbox?.activeId) return;
    const body = root.ownerDocument?.body;
    if (body?.hasAttribute?.('data-tutorial-guide')) return;
    hintStarted = true;
    hintTimer.show(nextHintDuration());
  }

  // ---- The resident card (a resident is picked) -------------------------
  const companion = node("section", "int-rh2-companion");
  companion.setAttribute("aria-live", "polite");
  setLabel(companion, "aria-label", "選取的夥伴");
  companion.dataset.open = "false";
  companion.dataset.expanded = "false";
  companion.dataset.placement = "bottom";
  companion.setAttribute("aria-hidden", "true");
  const portraitSlot=node('div','int-rh2-companion__portrait');
  const portrait=node('img');portrait.alt='';portrait.hidden=true;portraitSlot.append(portrait);
  // The name area is the way into the full record: one large target instead
  // of a separate small button, so the card stays two rows tall.
  const companionCopy = node("button", "int-rh2-companion__copy");
  companionCopy.type = "button";
  companionCopy.setAttribute("aria-haspopup", "dialog");
  const heading = node("span", "int-rh2-companion__head");
  const companionName = node("span", "int-rh2-companion__name", "SELECT A RESIDENT");
  const companionSpecies = node("span", "int-rh2-companion__species");
  heading.append(companionName, companionSpecies);
  const companionLocation = node("span", "int-rh2-companion__location", "Touch a resident in the habitat.");
  const ranchIcon = node('img', 'int-rh2-companion__ranch-icon');
  ranchIcon.alt = ''; ranchIcon.hidden = true;
  const placeChip = node('span', 'int-rh2-companion__place');
  placeChip.append(ranchIcon, companionLocation);
  const more = node("span", "int-rh2-companion__more", "詳細");
  more.setAttribute("aria-hidden", "true");

  // OVL18 0211F790 uses the individual's current/max HP and TP. Its AP
  // readout is a constant full bar, not a fabricated combat AP value; the
  // card leaves it to the detail sheet, where it sits with the full record.
  const vitals = node("dl", "int-rh2-vitals");
  vitals.id = "int-rh2-companion-vitals";
  function meter(stat, label, parent = vitals) {
    const term = node("dt", "int-rh2-vitals__label", label);
    term.dataset.stat = stat;
    const value = node("dd", "int-rh2-vitals__value");
    value.dataset.stat = stat;
    const bar = node("span", "int-rh2-vitals__bar");
    bar.dataset.stat = stat;
    const text = node("span", "int-rh2-vitals__num", "--");
    bar.append(text);
    value.append(bar);
    parent.append(term, value);
    return { term, value, bar, text };
  }
  const hp = meter('hp', 'HP');
  const tp = meter('tp', 'TP');
  const ap = meter('ap', 'AP');
  const capacity = meter('capacity', '容量');
  setLabel(ap.bar, 'aria-label', 'AP');
  ap.text.hidden = true;
  companionCopy.append(heading, placeChip, more);
  const details = companionCopy;

  // The generic CARE button was removed on 2026-09-03 at the Owner's direction:
  // the original has no such control. Care there is "pick a tool, touch the
  // target" over six distinct tools; the intent seam (careForCreature) stays.
  const actions = node("div", "int-rh2-companion__actions");
  const previous = button("int-rh2-companion__nav", "‹", "上一隻夥伴");
  previous.dataset.direction = "previous";
  const next = button("int-rh2-companion__nav", "›", "下一隻夥伴");
  next.dataset.direction = "next";
  const close = button("int-rh2-companion__close", "×", "取消選取");
  // Landscape-only disclosure: presentation state, never a selection/camera
  // intent. Portrait keeps its existing always-visible meters and controls.
  const cardToggle = button("int-rh2-companion__nav int-rh2-companion__toggle", "", "選取的夥伴");
  cardToggle.setAttribute("aria-controls", vitals.id);
  cardToggle.setAttribute("aria-expanded", "false");
  cardToggle.addEventListener("click", () => {
    const expanded = companion.dataset.expanded !== "true";
    companion.dataset.expanded = String(expanded);
    cardToggle.setAttribute("aria-expanded", String(expanded));
  });
  actions.append(previous, next, cardToggle, close);
  companion.append(portraitSlot, companionCopy, actions, vitals);

  // What the removed status line alone used to carry: a save that failed or
  // was overtaken by another tab, and the day's lifecycle events. An ordinary
  // event leaves again; a failed save stays until the port reports otherwise.
  const notice = node("div", "int-rh2-notice");
  notice.hidden = true;
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  const noticeText = node("p", "int-rh2-notice__text");
  const recovery=button('int-rh2-system-button','匯出未存成功的進度');recovery.hidden=true;
  const recoveryResult = node('p', 'int-rh2-notice__text'); recoveryResult.hidden = true;
  recovery.addEventListener('click',()=>{
    const outcome = downloadSaveBackup(() => presentation.intents.exportRecovery?.());
    setText(recoveryResult, outcome.key); recoveryResult.hidden = false;
  });
  notice.append(noticeText, recovery, recoveryResult);

  // ---- The full record (a sheet; bottom on phones, side on tablets) ------
  const detail = node("dialog", "int-rh2-detail");
  detail.setAttribute("aria-labelledby", "int-rh2-detail-name");
  const detailHead = node("header", "int-rh2-detail__head");
  const detailTitle = node("div", "int-rh2-detail__titles");
  const detailName = node("h2", "int-rh2-detail__name");
  detailName.id = "int-rh2-detail-name";
  const detailSpecies = node("p", "int-rh2-detail__species");
  detailTitle.append(detailName, detailSpecies);
  const detailClose = button("int-rh2-detail__close", "×", "收合詳細資料");
  detailHead.append(detailTitle, detailClose);
  const detailMeters = node("dl", "int-rh2-vitals int-rh2-detail__vitals");
  const dHp = meter('hp', 'HP', detailMeters);
  const dTp = meter('tp', 'TP', detailMeters);
  const dAp = meter('ap', 'AP', detailMeters);
  const dCapacity = meter('capacity', '容量', detailMeters);
  dAp.text.hidden = true;
  const detailRows = node("dl", "cm-digimon-detail int-rh2-detail__rows");
  const detailBody = node("div", "int-rh2-detail__body");
  detailBody.append(detailMeters, detailRows);
  const detailFooter = node("footer", "int-rh2-detail__footer");
  const collapse = button("cm-screen-back int-rh2-detail__collapse", "收合");
  detailFooter.append(collapse);
  if (typeof openRoster === "function") {
    const toRoster = button("cm-screen-primary int-rh2-detail__roster", "夥伴名單");
    toRoster.addEventListener("click", () => { closeDetail(); openRoster(); });
    detailFooter.append(toRoster);
  }
  detail.append(detailHead, detailBody, detailFooter);

  shell.append(fieldFrame, hint, companion, notice);
  root.append(shell, detail);
  // Only genuinely overflowing text becomes a bounded scroll/focus surface.
  // Ordinary short hints stay transparent to field gestures.
  const hintSizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(syncHintOverflow) : null;
  hintSizeObserver?.observe(hint, { box: 'border-box' });
  if (!hintSizeObserver) root.ownerDocument?.defaultView?.addEventListener?.('resize', syncHintOverflow);

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
  const evolutionChoice=node('div','int-rh2-evolution-choice');evolutionChoice.hidden=true;
  evolutionChoice.setAttribute('role','dialog');evolutionChoice.setAttribute('aria-modal','true');evolutionChoice.setAttribute('aria-label',evolutionChoiceTitle());
  evolutionChoice.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const options=Array.from(evolutionChoice.children).filter(child=>child.dataset?.speciesIndex);
    if(!options.length)return;
    const index=options.indexOf(document.activeElement);
    if(event.shiftKey?(index<=0):(index===options.length-1||index<0)){
      event.preventDefault();options[event.shiftKey?options.length-1:0].focus();
    }
  });
  transition.append(evolutionChoice);
  const retry=button('int-rh2-system-button','Retry');retry.hidden=true;
  retry.addEventListener('click',()=>presentation.intents.requestSave());transition.append(transitionText,retry);root.append(transition);
  const calendar=node('button','int-rh2-calendar');calendar.type='button';calendar.hidden=true;setLabel(calendar,'aria-label','確認新日期，返回育成');
  const dateTitle=node('div','int-rh2-calendar__date'),calendarGrid=node('div','int-rh2-calendar__grid');calendar.append(dateTitle,calendarGrid);transition.append(calendar);
  calendar.addEventListener('click',()=>presentation.intents.acknowledgeCalendar());
  const dayConfirm=node('div','int-rh2-day-confirm');dayConfirm.hidden=true;dayConfirm.setAttribute('role','dialog');setLabel(dayConfirm,'aria-label','結束今天');dayConfirm.setAttribute('aria-modal','true');
  const yes=button('int-rh2-system-button','是'),no=button('int-rh2-system-button','否');
  yes.addEventListener('click',()=>presentation.intents.confirmDayEnd(true));no.addEventListener('click',()=>presentation.intents.confirmDayEnd(false));
  dayConfirm.append(node('p','int-rh2-day-confirm__question','要結束今天嗎？'),yes,no);transition.append(dayConfirm);
  const mailIcon=button('int-rh2-mail-icon','','開啟信件');mailIcon.hidden=true;
  mailIcon.addEventListener('click',()=>presentation.intents.openMail());root.append(mailIcon);
  const letter=node('section','int-rh2-letter');letter.hidden=true;letter.setAttribute('role','dialog');setLabel(letter,'aria-label','信件');letter.setAttribute('aria-modal','true');
  const sender=node('p','int-rh2-letter__sender'),letterText=node('p','int-rh2-letter__text'),letterAck=button('int-rh2-letter__ack','確認');
  letterAck.addEventListener('click',()=>presentation.intents.acknowledgeMail());letter.append(sender,letterText,letterAck);transition.append(letter);

  const trainingLayer=node('div','int-rh2-training-labels');trainingLayer.setAttribute('aria-hidden','true');fieldHost.append(trainingLayer);
  // Ordered by the native command table, corroborated by Cage descriptions.
  const trainingNames=['病毒','疫苗','資料','龍','獸','水','鳥','機械','聖','昆蟲植物','暗','耐熱','耐寒','耐雷','耐暗','耐光','HP','TP','攻擊','防禦','智力','速度','飽足','HP','壓力','親密','友情','疲勞'];
  const trainingNodes=new Map();
  function renderTrainingLabels(labels){
    const live=new Set();for(const label of labels){live.add(label.id);let text=trainingNodes.get(label.id);
      if(!text){text=node('span','int-rh2-training-label');trainingLayer.append(text);trainingNodes.set(label.id,text);}
      const c=label.command;text.textContent=`${uiText(trainingNames[c.kind])} ${c.outcome==='MAX'?'MAX':c.outcome==='MIN'?'MIN':c.delta>0?'＋'+c.delta:String(c.delta)}`;
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
    if (!failed) recoveryResult.hidden = true;
    if (saveStatus?.conflict) showNotice(uiText(SAVE_COPY.CONFLICT), { sticky: true });
    else if (failed) showNotice(uiText(SAVE_COPY.SAVE_FAILED), { sticky: true });
    else clearStickyNotice();
  }

  // The resolved motion preference (settings), else the system setting.
  const reducedMotion = () => prefersReducedMotion();
  const percent = (current, max) => `${max > 0 ? Math.max(0, Math.min(100, Math.round(current / max * 100))) : 0}%`;
  function paintMeters(set, resident) {
    const stats = resident?.stats ?? null;
    const currentTp = stats ? stats.currentTp ?? stats.maxTp : 0;
    set.hp.text.textContent = uiText(stats ? `${stats.currentHp} / ${stats.maxHp}` : "--");
    set.tp.text.textContent = uiText(stats ? `${currentTp} / ${stats.maxTp}` : "--");
    set.hp.bar.style.setProperty('--fill', stats ? percent(stats.currentHp, stats.maxHp) : '0%');
    set.tp.bar.style.setProperty('--fill', stats ? percent(currentTp, stats.maxTp) : '0%');
    // Low HP is the one meter state worth a colour change, and it keeps its number.
    set.hp.bar.dataset.low = String(Boolean(stats && stats.maxHp > 0 && stats.currentHp / stats.maxHp <= 0.25));
    set.ap.bar.style.setProperty('--fill', resident ? '100%' : '0%');
    set.capacity.text.textContent = Number.isInteger(resident?.displayCapacityG) ? `${resident.displayCapacityG} G` : '--';
  }

  // The card sits on the edge where it does not cover the resident it
  // describes: chosen when the resident is picked, and moved to the other
  // edge only when that resident walks under it and the other edge is clear.
  // A move waits PLACE_DWELL_MS after the last one, so the card never flickers,
  // and the resident being touched with the hand is never under its own card.
  const PLACE_DWELL_MS = 1500;
  let placedFor = null, placedAt = 0;
  function covers(rect, placement, hostHeight, cardHeight) {
    return placement === "bottom"
      ? rect.y + rect.height > hostHeight - cardHeight - 20
      : rect.y < cardHeight + 12 + 20;
  }
  function placeCard(resident) {
    if (!resident) { placedFor = null; return; }
    const rect = field.actorScreenRect?.(resident.creatureId) ?? null;
    const hostHeight = fieldHost.clientHeight || 0;
    if (!rect || hostHeight <= 0) {
      if (placedFor !== resident.creatureId) { placedFor = resident.creatureId; companion.dataset.placement = "bottom"; }
      return;
    }
    const cardHeight = companion.offsetHeight || 132;
    const now = Date.now();
    if (placedFor !== resident.creatureId) {
      placedFor = resident.creatureId;
      placedAt = now;
      companion.dataset.placement = covers(rect, "bottom", hostHeight, cardHeight) ? "top" : "bottom";
      return;
    }
    if (now - placedAt < PLACE_DWELL_MS) return;
    const current = companion.dataset.placement === "top" ? "top" : "bottom";
    const other = current === "top" ? "bottom" : "top";
    if (covers(rect, current, hostHeight, cardHeight) && !covers(rect, other, hostHeight, cardHeight)) {
      companion.dataset.placement = other;
      placedAt = now;
    }
  }

  let lastRosterKey = null;
  function paintDetail(resident) {
    if (!detail.open || !resident) return;
    const entry = getRosterEntry?.(resident.creatureId) ?? null;
    detailName.textContent = resident.displayName ?? "";
    detailSpecies.textContent = uiText(entry?.identity?.speciesName ?? "");
    detailSpecies.hidden = !entry?.identity?.speciesName;
    paintMeters({ hp: dHp, tp: dTp, ap: dAp, capacity: dCapacity }, resident);
    const key = entry ? JSON.stringify([entry.instanceId, entry.displayName, entry.stats]) : null;
    if (key === lastRosterKey) return;
    lastRosterKey = key;
    detailRows.replaceChildren();
    if (entry && typeof renderCreatureDetail === "function") renderCreatureDetail(detailRows, entry);
    else detailRows.append(node("p", "int-rh2-detail__empty", "這隻夥伴的詳細資料暫時無法顯示。"));
  }

  function openDetail() {
    const resident = selectedResident(presentation.getFrame());
    if (!resident || detail.open) return;
    lastRosterKey = null;
    root.dataset.detail = "open";
    if (typeof detail.showModal === "function") detail.showModal(); else detail.setAttribute("open", "");
    paintDetail(resident);
    detailClose.focus?.();
  }
  function closeDetail() {
    if (!detail.open) return;
    if (typeof detail.close === "function") detail.close(); else detail.removeAttribute("open");
  }
  detail.addEventListener("close", () => {
    delete root.dataset.detail;
    // Back to the card that opened it, if the resident is still picked.
    if (companion.dataset.open === "true") details.focus?.();
  });
  detail.addEventListener("click", (event) => { if (event.target === detail) closeDetail(); });
  detailClose.addEventListener("click", closeDetail);
  collapse.addEventListener("click", closeDetail);
  details.addEventListener("click", openDetail);
  close.addEventListener("click", () => presentation.intents.selectCreature(null));

  // Step through the residents in the order the habitat lists them, and
  // bring each into view.
  function step(direction) {
    const frame = presentation.getFrame();
    const list = frame?.residents ?? [];
    if (list.length < 2) return;
    const at = list.findIndex((resident) => resident.creatureId === frame.selection?.creatureId);
    const target = list[(at + (direction === "next" ? 1 : -1) + list.length) % list.length];
    placedFor = null;
    presentation.intents.selectCreature(target.creatureId);
    field.focusResident?.(target.creatureId, { reducedMotion: reducedMotion() });
  }
  previous.addEventListener("click", () => step("previous"));
  next.addEventListener("click", () => step("next"));

  let lastRevision = -1;
  let lastEventKey = null;
  let pendingEvolution = null, evolutionCeremony = null;
  function render(frame) {
    if (disposed || !frame) return;
    updateEntryHint(frame);
    if (frame.revision === lastRevision) return;
    lastRevision = frame.revision;

    fieldFrame.dataset.residentCount = String(frame.residents?.length ?? 0);
    const nativeRanch = isNativeRanchLayout(frame.ranch?.layoutVersion);
    const resident = selectedResident(frame);
    root.dataset.selection = resident ? "selected" : "none";
    if (resident) { hintStarted = true; hintTimer.hide(); }
    const ranchImage = assembledHudArt(`ranch-${resident?.nativeCageDefinition}`);
    ranchIcon.hidden = !ranchImage;
    if (ranchImage && ranchIcon.getAttribute('src') !== ranchImage.src) ranchIcon.src = ranchImage.src;
    const image=hudArt?.getPortrait(resident?.speciesId);
    portrait.hidden=!image;
    // The portrait art is local-only, so on the public build the well would be
    // an empty square beside the name. No picture, no well.
    portraitSlot.hidden=!image;
    if(image&&portrait.getAttribute('src')!==image.src)portrait.src=image.src;
    companion.dataset.open = resident ? "true" : "false";
    companion.setAttribute("aria-hidden", resident ? "false" : "true");
    companion.inert = !resident;
    const several = (frame.residents?.length ?? 0) > 1;
    previous.hidden = next.hidden = !several;
    companionName.textContent = resident?.displayName ?? uiText("SELECT A RESIDENT");
    if (resident) companionCopy.setAttribute("aria-label", uiText("{name}，查看詳細資料", { name: resident.displayName }));
    else companionCopy.removeAttribute("aria-label");
    const entry = resident ? getRosterEntry?.(resident.creatureId) ?? null : null;
    const species = entry?.identity?.speciesName ?? null;
    companionSpecies.textContent = uiText(species && species !== resident?.displayName ? species : "");
    companionSpecies.hidden = !companionSpecies.textContent;
    paintMeters({ hp, tp, ap, capacity }, resident);
    vitals.dataset.evidence = resident?.stats?.evidence ?? "NONE";

    // The icon and the chip already say "where". The full wording stays as the
    // chip's title for anyone reading it out.
    const livesIn = resident
      ? nativeRanch ? resident.nativeCageName ?? 'Raising Home' : cageName(frame, resident.cageId)
      : null;
    companionLocation.textContent = uiText(livesIn ?? "Touch a resident in the habitat.");
    placeChip.title = livesIn ? uiText(`Living in ${livesIn}`) : '';
    placeCard(resident);
    if (!resident) closeDetail(); else paintDetail(resident);

    paintSaveStatus(frame.save);
    const lifecycle=frame.lifecycle,day=lifecycle?.day;
    const mailbox=lifecycle?.mailbox,activeMail=mailbox?.queue.find(q=>q.id===mailbox.activeId);
    mailIcon.hidden=!mailbox?.queue.length||!!activeMail||!!day||!!lifecycle?.evolution;
    letter.hidden=!activeMail||!!day||!!lifecycle?.evolution;
    if(activeMail){letter.dataset.system=String(activeMail.system);sender.textContent=raisingMessageSender(activeMail.sender);
      letterText.textContent=raisingMessageText(activeMail.textId,activeMail.subjectName)||uiText('新的通知已送達。');
      letterAck.disabled=!activeMail.system&&mailbox.activeFrames<61;
    }
    transition.hidden=!day&&!lifecycle?.evolution&&!lifecycle?.confirmation&&!activeMail;
    dayConfirm.hidden=!lifecycle?.confirmation;
    const choice=lifecycle?.evolution?.choicePending?lifecycle.evolution:null;
    evolutionChoice.hidden=!choice;
    const choiceKey=choice?`${getLocale()}:${choice.instanceId}:${choice.choices.join(',')}`:'';
    if(evolutionChoice.dataset.choiceKey!==choiceKey){
      const focusedSpecies=document.activeElement?.dataset?.speciesIndex;
      evolutionChoice.dataset.choiceKey=choiceKey;
      evolutionChoice.setAttribute('aria-label',evolutionChoiceTitle());
      if(choice)evolutionChoice.replaceChildren(node('p','int-rh2-evolution-choice__title',evolutionChoiceTitle()),
        ...choice.choices.map(target=>{
          const label=speciesName(target);
          const button=node('button','int-rh2-evolution-choice__option',uiText(label));button.type='button';button.dataset.speciesIndex=String(target);
          button.addEventListener('click',()=>presentation.intents.selectEvolutionChoice?.(choice.instanceId,target));return button;
        }));
      if(choice){
        const options=Array.from(evolutionChoice.children).filter(child=>child.dataset?.speciesIndex);
        (options.find(button=>button.dataset.speciesIndex===focusedSpecies)??options[0])?.focus();
      }
    }
    transition.dataset.phase=day?.phase??(lifecycle?.evolution?'evolution':'idle');
    transition.style.backgroundColor=day?`rgba(0,0,0,${day.phase==='fade-out'?Math.min(1,day.frames/8):day.phase==='fade-in'?Math.max(0,1-day.frames/8):1})`:'transparent';
    transitionText.textContent=day?.phase==='saving'?(day.savePhase==='SAVE_FAILED'?uiText('Save did not complete. You can try again.'):uiText('Saving...')):'';
    retry.hidden=day?.savePhase!=='SAVE_FAILED';
    calendar.hidden=!day?.phase?.startsWith('calendar');calendar.disabled=day?.phase!=='calendar';
    if(!calendar.hidden){const c=day.calendar;calendar.dataset.season=String(c.season);
      calendar.style.opacity=String(day.phase==='calendar-in'?Math.min(1,day.frames/16):day.phase==='calendar-out'?Math.max(0,1-day.frames/16):1);
      dateTitle.textContent=uiText('{season}　{day} 日',{season:uiText(SEASON_NAMES[c.season]),day:c.dayOfSeason+1});
      calendarGrid.replaceChildren(...c.days.map(row=>{const cell=node('div','int-rh2-calendar__day');cell.classList.toggle('is-today',row.day===c.dayOfSeason);
        cell.append(node('strong','',String(row.day+1)));
        if(row.registered||row.unwon){const counts=node('div','int-rh2-calendar__counts');counts.append(node('span','',`☑ ×${row.registered}`),node('span','',`□ ×${row.unwon}`));cell.append(counts);}return cell;}));
    }
    const lifecycleActive=Boolean(day||lifecycle?.evolution||lifecycle?.confirmation||activeMail);
    fieldHost.inert=lifecycleActive;
    root.dataset.lifecycle=lifecycleActive?'active':'idle';
    // A day change, an evolution or a letter takes the screen; the sheet yields.
    if(lifecycleActive)closeDetail();
    // The same lifecycle message rides along on later frames, so it is announced
    // once rather than restarting its own countdown on every repaint.
    const event=lifecycle?.message;
    const eventKey=event?`${event.kind}:${event.instanceId??''}:${event.target??''}`:null;
    if(eventKey!==null&&eventKey!==lastEventKey){
      if(event.kind==='EVOLVED')pendingEvolution={instanceId:event.instanceId,target:event.target};
      if(event.kind==='REBORN'){
        const member=frame.residents.find(r=>r.creatureId===event.instanceId);
        if(member)showNotice(uiText('{name} 回到了培育蛋。',{name:member.displayName}));
      }
      if(event.kind==='DISAPPEARED')showNotice(uiText('夥伴消失了。'));
    }
    lastEventKey=eventKey;
    // Ceremony (2026-10-15): the new form is revealed once the native
    // evolution sequence has finished and nothing else owns the screen. The
    // native sequence itself (ROM timing, ring/burst cells, writing) is untouched.
    if(pendingEvolution&&!lifecycle?.evolution&&!day&&!lifecycle?.confirmation&&!activeMail){
      const member=frame.residents.find(r=>r.creatureId===pendingEvolution.instanceId);
      const species=speciesName(pendingEvolution.target);
      pendingEvolution=null;
      if(member){
        evolutionCeremony?.dispose();
        evolutionCeremony=playCeremony({host:root,kind:'evolve',cue:'evolve',
          label:uiText('{name} 進化成了{species}。',{name:member.displayName,species}),
          build:(stage,env)=>buildEvolve(stage,env,{kicker:uiText('進化'),title:species,
            meta:uiText('{name} 進化成了{species}。',{name:member.displayName,species}),
            portrait:hudArt?.getPortrait(member.speciesId)??null,hint:uiText('輕觸繼續')}),
          onDone:()=>{evolutionCeremony=null;}});
      }
    }

    field.render(frame);
  }

  // Loading and tutorial suppression can finish without a new game
  // revision. Observe only their presentation flags, never poll or add a ticker.
  const reconsiderHint = () => updateEntryHint(presentation.getFrame());
  const hintObserver = typeof MutationObserver === 'function' ? new MutationObserver(reconsiderHint) : null;
  hintObserver?.observe(fieldHost, { attributes: true, attributeFilter: ['aria-busy', 'data-load-state'] });
  if (root.ownerDocument?.body) hintObserver?.observe(root.ownerDocument.body, { attributes: true, attributeFilter: ['data-tutorial-guide'] });
  root.ownerDocument?.addEventListener?.('visibilitychange', reconsiderHint);
  const unsubscribe = presentation.subscribe(render);
  // Evolution may introduce a portrait after this screen was mounted. Repaint
  // that same frame when its metadata arrives, without advancing simulation.
  let unsubscribeHud = hudArt?.subscribe?.(() => { lastRevision = -1; render(presentation.getFrame()); });
  render(presentation.getFrame());

  return Object.freeze({
    render,
    get isPlayable() { return field.isPlayable !== false; },
    setHudArt(next) {
      if (disposed) return;
      unsubscribeHud?.(); hudArt = next;
      unsubscribeHud = hudArt?.subscribe?.(() => { lastRevision = -1; render(presentation.getFrame()); });
      lastRevision = -1; render(presentation.getFrame());
    },
    /** Repaint every label in the current language; the habitat stays mounted. */
    relabel() {
      if (disposed) return;
      retranslate(root);
      lastRevision = -1;
      for (const text of trainingNodes.values()) text.remove();
      trainingNodes.clear();
      render(presentation.getFrame());
    },
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
      if (disposed) return;
      disposed = true;
      hintTimer.dispose();
      hintSizeObserver?.disconnect();
      root.ownerDocument?.defaultView?.removeEventListener?.('resize', syncHintOverflow);
      hintObserver?.disconnect();
      root.ownerDocument?.removeEventListener?.('visibilitychange', reconsiderHint);
      evolutionCeremony?.dispose();
      evolutionCeremony = null;
      unsubscribe?.();
      unsubscribeHud?.();
      clearTimeout(noticeTimer);
      noticeTimer = null;
      closeDetail();
      field.dispose();
      root.replaceChildren();
      root.className = "";
      delete root.dataset.selection;
      delete root.dataset.detail;
      delete root.dataset.lifecycle;
    }
  });
}


