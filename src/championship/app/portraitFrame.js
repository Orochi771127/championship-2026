// Owner 2026-10-14 batch A: layout only, with the existing Raising scene.
// The historical desktop flag now means a wide Raising working area. Two
// usable columns need 720 CSS pixels; short landscapes scroll the native world.
// Battle and Hunt leave the frame only through their integrated opt-in readiness gates.
export function isDesktopRaisingLayout({width,height,activeScreen,hidden=false}) {
  return Number.isFinite(width)&&Number.isFinite(height)&&width>=720&&height>=320
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
// keep their own contracts. The 568px legacy frame remains intentional.
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
export function mountPortraitFrame({window:win=globalThis.window,document:doc=globalThis.document,responsiveRaising=false,responsiveBattle=false,responsiveMenus=false,isHuntWide=()=>false}={}) {
  const body=doc.body,visual=win.visualViewport;
  const root=doc.getElementById?.('cm-root');
  const menuProperties=['--cm-menu-viewport-height','--cm-menu-viewport-top'];
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
  function update(event){
    if(disposed)return;
    const width=win.innerWidth,height=win.innerHeight;
    if(!(width>0&&height>0))return;
    const hasInput=editing();
    const revealInput=()=>{
      // Scrolling the visual viewport must not fight an intentional pan.
      if(hasInput&&event?.type!=='scroll')doc.activeElement.scrollIntoView?.({block:'nearest',inline:'nearest'});
    };
    // A keyboard can make a portrait layout viewport wider than it is tall.
    // A genuine device rotation changes width, so it releases this guard.
    if(inputBaseline&&Math.abs(width-inputBaseline.width)>1)inputBaseline=null;
    if(hasInput&&!inputBaseline)inputBaseline={width,height,sideways:width>height};
    const keyboard=!!inputBaseline&&height<inputBaseline.height;
    const effectiveHeight=keyboard?inputBaseline.height:height;
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
    sideways=!battle&&!menu&&!compactMenu&&!cage&&!desktop&&!browse&&!hunt&&(keyboard?inputBaseline.sideways:width>height);
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
  visual?.addEventListener('resize',update);
  visual?.addEventListener('scroll',update);
  doc.addEventListener('focusin',update);
  doc.addEventListener('focusout',update);
  const Observer=win.MutationObserver;
  const observer=root&&Observer?new Observer(()=>update()):null;
  observer?.observe(root,{attributes:true,attributeFilter:['data-active-screen','hidden']});
  update();
  return {refresh(){update();},isBrowseWide(activeScreen){return !disposed&&browseWide(activeScreen);},dispose(){
    if(disposed)return;disposed=true;
    win.removeEventListener('resize',update);
    visual?.removeEventListener('resize',update);
    visual?.removeEventListener('scroll',update);
    doc.removeEventListener('focusin',update);doc.removeEventListener('focusout',update);
    body.removeAttribute('data-portrait-frame');
    body.removeAttribute('data-desktop-raising');
    body.removeAttribute('data-responsive-raising');
    body.removeAttribute('data-desktop-browse');
    body.removeAttribute('data-desktop-menu');
    body.removeAttribute('data-landscape-menu');
    body.removeAttribute('data-cage-landscape');
    body.removeAttribute('data-hunt-wide');
    observer?.disconnect();
    for(const name of [...properties,...menuProperties])body.style.removeProperty(name);
  }};
}
