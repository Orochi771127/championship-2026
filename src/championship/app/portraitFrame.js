// Owner 2026-10-14 batch A: layout only, with the existing Raising scene.
// The historical desktop flag now means the floating Raising working area.
// Compact landscapes keep native-size HUD controls instead of shrinking the body.
// Battle and Hunt leave the frame only through their integrated readiness gates.
export function isDesktopRaisingLayout({width,height,activeScreen,hidden=false}) {
  return Number.isFinite(width)&&Number.isFinite(height)&&width>=568&&height>=320
    &&(width>=1024||width>=height+160)&&activeScreen==='RAISING_HOME'&&!hidden;
}
export function isDesktopBrowseLayout({width,height,activeScreen,hidden=false}) {
  return width>=1024&&height>=420&&['SHOP','DATABASE'].includes(activeScreen)&&!hidden;
}
// These DOM views already own responsive columns and scrolling. Keep this
// explicit: coordinate scenes, opening flows and unreviewed menus stay framed.
const DESKTOP_MENU_SCREENS = Object.freeze([
  'BATTLE_SELECT', 'CHAMPIONSHIP', 'DIGIMON_LIST', 'SCHEDULE', 'TAMER_INFO',
  'HELP', 'GATE_SELECT', 'HUNT_LOADOUT', 'HUNT_RESULT', 'MEDALS'
]);
export function isDesktopMenuLayout({width,height,activeScreen,hidden=false}) {
  return Number.isFinite(width)&&Number.isFinite(height)&&width>=1024&&height>=420
    &&DESKTOP_MENU_SCREENS.includes(activeScreen)&&!hidden;
}
// Fill only the short-landscape gap. Existing desktop and portrait layouts
// keep their own contracts. Other scenes retain their existing 720px landscape threshold.
export function isCompactLandscapeMenuLayout({width,height,activeScreen,hidden=false}) {
  return Number.isFinite(width)&&Number.isFinite(height)&&width>=720&&height>=320
    &&width>=height+160&&(width<1024||height<420)&&!hidden
    &&[...DESKTOP_MENU_SCREENS,'SHOP','DATABASE'].includes(activeScreen);
}
// The editor is DOM, not a Pixi coordinate scene. Its candidate owns a
// two-pane layout while retaining the native 508px board and scrollable cells.
export function isCageLandscapeLayout({width,height,activeScreen,hidden=false}) {
  return Number.isFinite(width)&&Number.isFinite(height)&&width>=720&&height>=320
    &&width>=height+160&&activeScreen==='CAGE_EDIT'&&!hidden;
}
// Entry owns a dedicated art-and-controls composition, not a stretched scene.
export function isLandscapeEntryLayout({width,height,hidden=false}) {
  return Number.isFinite(width)&&Number.isFinite(height)&&width>=720&&height>=320
    &&width>=height+160&&!hidden;
}
// The standalone viewport can be taller than CSS dvh on iOS. Paint the title
// to the measured viewport, while the existing controls retain safe-area insets.
export function titleViewportMetrics(win, doc, editing = false) {
  const visual = win.visualViewport;
  const unzoomed = visual && Math.abs((visual.scale ?? 1) - 1) < .01 && visual.height > 0;
  const standalone = win.navigator?.standalone === true || win.matchMedia?.('(display-mode: standalone)')?.matches === true
    || win.matchMedia?.('(display-mode: fullscreen)')?.matches === true;
  const height = standalone && !editing && (!visual || unzoomed)
    ? Math.max(win.innerHeight || 0, doc.documentElement?.clientHeight || 0, unzoomed ? visual.height : 0)
    : unzoomed ? visual.height : win.innerHeight;
  return {height, top:unzoomed ? visual.offsetTop || 0 : 0};
}
export function mountPortraitFrame({window:win=globalThis.window,document:doc=globalThis.document,responsiveRaising=false,responsiveBattle=false,responsiveMenus=false,responsiveEntry=false,isHuntWide=()=>false}={}) {
  const body=doc.body,visual=win.visualViewport;
  const screenOrientation=win.screen?.orientation;
  const orientationAxis=()=>/^(portrait|landscape)-(primary|secondary)$/.exec(screenOrientation?.type??'')?.[1]??null;
  const portraitScreen=()=>Number.isFinite(win.screen?.width)&&Number.isFinite(win.screen?.height)
    &&win.screen.width>0&&win.screen.width<win.screen.height;
  let knownOrientation=orientationAxis(),portraitRotation=null,unverifiedEditingAxis=null,pendingKeyboardWidth=null;
  const root=doc.getElementById?.('cm-root');
  const title=responsiveEntry?doc.getElementById?.('cm-title'):null;
  const menuProperties=['--cm-menu-viewport-height','--cm-menu-viewport-top'];
  const visibleProperties=['--cm-visible-viewport-height','--cm-visible-viewport-top'];
  const titleProperties=['--cm-title-viewport-height','--cm-title-viewport-top'];
  const properties=['--cm-frame-scale','--cm-viewport-height','--cm-frame-center-x','--cm-frame-center-y'];
  let sideways=null,inputBaseline=null,disposed=false;
  const layoutHeight=()=>inputBaseline&&Math.abs(win.innerWidth-inputBaseline.width)<=1&&win.innerHeight<inputBaseline.height
    ? inputBaseline.height : win.innerHeight;
  const browseWide=(activeScreen=root?.dataset.activeScreen)=>isDesktopBrowseLayout({width:win.innerWidth,height:layoutHeight(),activeScreen,hidden:root?.hidden})
    ||(responsiveMenus&&['SHOP','DATABASE'].includes(activeScreen)&&isCompactLandscapeMenuLayout({width:win.innerWidth,height:layoutHeight(),activeScreen,hidden:root?.hidden}));
  const editing=()=>{
    const e=doc.activeElement;
    return !!e&&(e.isContentEditable||e.tagName==='TEXTAREA'||(e.tagName==='INPUT'&&
      !['button','checkbox','radio','range','submit','reset','file','color','hidden'].includes(e.type)));
  };
  function orientationChanged(event){
    const next=orientationAxis(),previous=knownOrientation;
    if(disposed||next===previous)return;
    knownOrientation=next;
    const wasEditing=editing()||!!inputBaseline||unverifiedEditingAxis===next
      ||(pendingKeyboardWidth!==null&&Math.abs(win.innerWidth-pendingKeyboardWidth)<=1);
    unverifiedEditingAxis=null;pendingKeyboardWidth=null;
    // Use an actual rotation event, never screen orientation as a global
    // window-layout policy. Screen/viewport width agreement keeps this bounded
    // to the rotated viewport; no unoccluded keyboard height is invented.
    portraitRotation=wasEditing&&previous==='landscape'&&next==='portrait'&&portraitScreen()
      ? {width:win.screen.width,fromWidth:win.innerWidth,waiting:true} : null;
    update(event);
  }
  function update(event){
    if(disposed)return;
    const width=win.innerWidth,height=win.innerHeight;
    if(!(width>0&&height>0))return;
    // Opening cards are device-size DOM even inside the scaled title frame.
    // A software keyboard can shrink only the visual viewport; expose that
    // budget independently of frame orientation, without counteracting zoom.
    const cardViewport=visual&&Math.abs((visual.scale??1)-1)<0.01&&visual.width>0&&visual.height>0 ? visual : null;
    if(cardViewport&&(cardViewport.height!==height||(cardViewport.offsetTop??0)!==0)){
      body.style.setProperty('--cm-visible-viewport-height',`${cardViewport.height}px`);
      body.style.setProperty('--cm-visible-viewport-top',`${cardViewport.offsetTop??0}px`);
    }else for(const name of visibleProperties)body.style.removeProperty(name);
    const hasInput=editing();
    if(title){
      const titleViewport=titleViewportMetrics(win,doc,hasInput);
      body.style.setProperty('--cm-title-viewport-height',`${titleViewport.height}px`);
      body.style.setProperty('--cm-title-viewport-top',`${titleViewport.top}px`);
    }
    const axis=orientationAxis();
    // A resize may expose the new type before its change event. Remember only
    // editing context, including a following blur, until that event verifies it.
    if(hasInput&&axis&&axis!==knownOrientation)unverifiedEditingAxis=axis;
    else if(axis===knownOrientation)unverifiedEditingAxis=null;
    if(portraitRotation){
      if(!portraitScreen()||Math.abs(win.screen.width-portraitRotation.width)>1)portraitRotation=null;
      else if(Math.abs(width-portraitRotation.width)<=1)portraitRotation.waiting=false;
      else if(!portraitRotation.waiting||Math.abs(width-portraitRotation.fromWidth)>1)portraitRotation=null;
      if(portraitRotation&&!portraitRotation.waiting&&width<=height){
        portraitRotation=null;
        if(hasInput)inputBaseline={width,height,sideways:false};
      }
    }
    const revealInput=()=>{
      // Scrolling the visual viewport must not fight an intentional pan.
      if(hasInput&&event?.type!=='scroll')doc.activeElement.scrollIntoView?.({block:'nearest',inline:'nearest'});
    };
    // A keyboard can make a portrait layout viewport wider than it is tall.
    // A genuine device rotation changes width, so it releases this guard.
    if(pendingKeyboardWidth!==null&&(Math.abs(width-pendingKeyboardWidth)>1||width<=height))pendingKeyboardWidth=null;
    if(inputBaseline&&Math.abs(width-inputBaseline.width)>1){
      // The layout resize and blur can both precede the orientation property
      // and event. Retain only an already-shortened keyboard transition at
      // this exact width; it cannot change layout without the verified event.
      if(inputBaseline.keyboard&&width>height)pendingKeyboardWidth=width;
      inputBaseline=null;
    }
    if(hasInput&&!inputBaseline)inputBaseline={width,height,sideways:width>height};
    const keyboard=!!inputBaseline&&height<inputBaseline.height;
    if(inputBaseline)inputBaseline.keyboard=keyboard;
    const effectiveHeight=keyboard?inputBaseline.height:height;
    const entry=responsiveEntry&&!!title&&isLandscapeEntryLayout({width,height:effectiveHeight,hidden:title.hidden});
    body.toggleAttribute('data-landscape-entry',entry);
    const desktop=responsiveRaising
      ? isDesktopRaisingLayout({width,height:effectiveHeight,activeScreen:root?.dataset.activeScreen,hidden:root?.hidden})
      : width>=1024&&height>=600&&root?.dataset.activeScreen==='RAISING_HOME'&&!root?.hidden;
    const battle=responsiveBattle&&!root?.hidden&&['BATTLE_FIELD','BATTLE_RESULT'].includes(root?.dataset.activeScreen);
    // DOM menu readiness is independent of the playable scene's FX gate.
    // Reuse the established DOM layouts only at the bounded desktop threshold.
    const menu=responsiveMenus&&isDesktopMenuLayout({width,height:effectiveHeight,activeScreen:root?.dataset.activeScreen,hidden:root?.hidden});
    const compactMenu=responsiveMenus&&isCompactLandscapeMenuLayout({width,height:effectiveHeight,activeScreen:root?.dataset.activeScreen,hidden:root?.hidden});
    const cage=responsiveMenus&&isCageLandscapeLayout({width,height:effectiveHeight,activeScreen:root?.dataset.activeScreen,hidden:root?.hidden});
    const browse=browseWide();
    const hunt=root?.dataset.activeScreen==='HUNT_FIELD'&&!root?.hidden&&isHuntWide()===true;
    body.toggleAttribute('data-hunt-wide',hunt);
    body.toggleAttribute('data-desktop-raising',desktop);
    body.toggleAttribute('data-responsive-raising',responsiveRaising&&desktop);
    body.toggleAttribute('data-desktop-browse',browse);
    body.toggleAttribute('data-desktop-menu',menu);
    body.toggleAttribute('data-landscape-menu',compactMenu);
    body.toggleAttribute('data-cage-landscape',cage);
    if(compactMenu){
      // Fit the visible keyboard/chrome area, but do not cancel pinch zoom.
      const visible=visual&&Math.abs((visual.scale??1)-1)<0.01&&visual.height>0 ? visual : null;
      body.style.setProperty('--cm-menu-viewport-height',`${visible?.height??height}px`);
      body.style.setProperty('--cm-menu-viewport-top',`${visible?.offsetTop??0}px`);
    }else for(const name of menuProperties)body.style.removeProperty(name);
    sideways=!(portraitRotation&&!portraitRotation.waiting)&&!entry&&!battle&&!menu&&!compactMenu&&!cage&&!desktop&&!browse&&!hunt&&(keyboard?inputBaseline.sideways:width>height);
    if(!hasInput&&!keyboard)inputBaseline=null;
    body.toggleAttribute('data-portrait-frame',sideways);
    if(!sideways){for(const name of properties)body.style.removeProperty(name);revealInput();return;}

    // Account for browser chrome and the visible keyboard area. Pinch zoom
    // must remain the user's zoom, rather than being cancelled by our scale.
    const visible=visual&&Math.abs((visual.scale??1)-1)<0.01&&visual.width>0&&visual.height>0
      ? visual : {width,height,offsetLeft:0,offsetTop:0};
    const logicalWidth=390,logicalHeight=logicalWidth*16/9;
    const scale=Math.min(visible.width/logicalWidth,visible.height/logicalHeight);
    body.style.setProperty('--cm-frame-scale',String(scale));
    body.style.setProperty('--cm-viewport-height',`${logicalHeight}px`);
    body.style.setProperty('--cm-frame-center-x',`${(visible.offsetLeft??0)+visible.width/2}px`);
    body.style.setProperty('--cm-frame-center-y',`${(visible.offsetTop??0)+visible.height/2}px`);
    revealInput();
  }
  win.addEventListener('resize',update);
  win.addEventListener('pageshow',update);
  visual?.addEventListener('resize',update);
  visual?.addEventListener('scroll',update);
  screenOrientation?.addEventListener?.('change',orientationChanged);
  doc.addEventListener('focusin',update);
  doc.addEventListener('focusout',update);
  const Observer=win.MutationObserver;
  const observer=root&&Observer?new Observer(()=>update()):null;
  observer?.observe(root,{attributes:true,attributeFilter:['data-active-screen','hidden']});
  if(title)observer?.observe(title,{attributes:true,attributeFilter:['hidden']});
  update();
  return {refresh(){update();},isBrowseWide(activeScreen){return !disposed&&browseWide(activeScreen);},dispose(){
    if(disposed)return;disposed=true;
    win.removeEventListener('resize',update);
    win.removeEventListener('pageshow',update);
    visual?.removeEventListener('resize',update);
    visual?.removeEventListener('scroll',update);
    screenOrientation?.removeEventListener?.('change',orientationChanged);
    doc.removeEventListener('focusin',update);doc.removeEventListener('focusout',update);
    body.removeAttribute('data-portrait-frame');
    body.removeAttribute('data-landscape-entry');
    body.removeAttribute('data-desktop-raising');
    body.removeAttribute('data-responsive-raising');
    body.removeAttribute('data-desktop-browse');
    body.removeAttribute('data-desktop-menu');
    body.removeAttribute('data-landscape-menu');
    body.removeAttribute('data-cage-landscape');
    body.removeAttribute('data-hunt-wide');
    observer?.disconnect();
    for(const name of [...properties,...menuProperties,...visibleProperties,...titleProperties])body.style.removeProperty(name);
  }};
}
