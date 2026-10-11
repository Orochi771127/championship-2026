/** Wire only an explicit user-click Paste action; never read on mount or focus.
 * Reusable for future room-code fields. Manual browser paste stays available.
 */
export function bindCodePaste({button, field, status, text, isCurrent=()=>true, getRevision=()=>0}) {
  let edits=0, pending=false;
  field.addEventListener('input',()=>{edits++;status.hidden=true;});
  button.addEventListener('click',async()=>{
    if(pending||button.disabled||field.disabled||field.readOnly||!isCurrent())return;
    const previous=field.value, revision=getRevision(), edit=edits;
    const current=()=>field.isConnected&&button.isConnected&&isCurrent()
      &&!field.disabled&&!field.readOnly&&field.value===previous&&edits===edit&&getRevision()===revision;
    pending=true;button.setAttribute('aria-busy','true');
    try {
      // Invoke readText synchronously within this click's user activation.
      if(!globalThis.navigator?.clipboard?.readText)throw new Error('MANUAL_PASTE');
      const code=await globalThis.navigator.clipboard.readText();
      if(!current())return;
      if(!code){status.hidden=false;status.textContent=text('CODE_PASTE_EMPTY');return;}
      // Do not trim or rewrite codes; native fields may normalize line breaks.
      // Existing input handlers/decoders remain responsible for validation.
      field.value=code;
      const EventClass=field.ownerDocument?.defaultView?.Event??Event;
      field.dispatchEvent(new EventClass('input',{bubbles:true}));
      status.hidden=false;status.textContent=text('CODE_PASTED');
    } catch {
      if(!current())return;
      field.focus();
      status.hidden=false;status.textContent=text('CODE_PASTE_MANUAL');
    } finally {
      pending=false;button.removeAttribute('aria-busy');
    }
  });
}
