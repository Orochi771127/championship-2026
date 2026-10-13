// Owner 2026-09-13: landscape displays the existing portrait UI, without
// rebuilding scenes or changing world coordinates. Owner 2026-10-13 permits
// Raising, Shop and Database to use a desktop viewport. This owns layout only.
export function isDesktopRaisingLayout({width,height,activeScreen,hidden=false}) {
  return width>=1024&&height>=600&&activeScreen==='RAISING_HOME'&&!hidden;
}
export function isDesktopBrowseLayout({width,height,activeScreen,hidden=false}) {
  return width>=1024&&height>=420&&['SHOP','DATABASE'].includes(activeScreen)&&!hidden;
}
export function mountPortraitFrame({window:win=globalThis.window,document:doc=globalThis.document}={}) {
  const body=doc.body,visual=win.visualViewport;
  const root=doc.getElementById?.('cm-root');
  const properties=['--cm-frame-scale','--cm-viewport-height','--cm-frame-center-x','--cm-frame-center-y'];
  let sideways=null,inputBaseline=null,disposed=false;
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
    const desktop=isDesktopRaisingLayout({width,height,activeScreen:root?.dataset.activeScreen,hidden:root?.hidden});
    const browse=isDesktopBrowseLayout({width,height,activeScreen:root?.dataset.activeScreen,hidden:root?.hidden});
    body.toggleAttribute('data-desktop-raising',desktop);
    body.toggleAttribute('data-desktop-browse',browse);
    sideways=!desktop&&!browse&&(keyboard?inputBaseline.sideways:width>height);
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
  return {dispose(){
    if(disposed)return;disposed=true;
    win.removeEventListener('resize',update);
    visual?.removeEventListener('resize',update);
    visual?.removeEventListener('scroll',update);
    doc.removeEventListener('focusin',update);doc.removeEventListener('focusout',update);
    body.removeAttribute('data-portrait-frame');
    body.removeAttribute('data-desktop-raising');
    body.removeAttribute('data-desktop-browse');
    observer?.disconnect();
    for(const name of properties)body.style.removeProperty(name);
  }};
}
