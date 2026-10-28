// Read-only view of actual match-scoped prop states. Never drives collision.
// RELAY cover (stage three, 2026-10-28) draws as an original procedural block
// in its field's material: cracks grow with damage, rubble stays when broken,
// and a short HP bar shows after each hit. Timber stacks keep their art.
const COVER_LOOK = Object.freeze({
  STONE: { face: 0x8d949a, top: 0xb7bec2, edge: 0x5e666e, crack: 0x3b4148 },
  WOOD: { face: 0x8a5a33, top: 0xb07b48, edge: 0x553620, crack: 0x2d1d10, grain: 0x6f4628 },
  BASALT: { face: 0x3d3236, top: 0x5a4a4f, edge: 0x241c1f, crack: 0xff8a3c },
  CORAL: { face: 0xe0a99a, top: 0xf2c7b8, edge: 0xa96f62, crack: 0x7d4c42, pore: 0xc58676 },
  ICE: { face: 0x9fd8ec, top: 0xd6f3fb, edge: 0x5fa4c4, crack: 0xffffff, alpha: 0.88 },
  SANDSTONE: { face: 0xc9a46b, top: 0xe0c08a, edge: 0x8e6d3e, crack: 0x5f4626, grain: 0xb18c55 },
  CRYSTAL: { face: 0x2a5d7a, top: 0x4fb9d9, edge: 0x1b3a4f, crack: 0x8ff3ff, grain: 0x8ff3ff },
  METAL: { face: 0x6f7d8c, top: 0x9aa8b6, edge: 0x3f4a56, crack: 0x252c33, rivet: 0xc9d3dc }
});
const HP_BAR_SECONDS = 2.3;
function drawCover(g, prop, w, h, fraction, showBar) {
  const look = COVER_LOOK[prop.material] ?? COVER_LOOK.STONE, rise = 26;
  g.clear();
  if (prop.destroyed) {
    g.ellipse(w / 2, h / 2, w * .5, h * .38).fill({ color: prop.charred ? 0x211a13 : look.edge, alpha: .55 });
    for (let i = 0; i < 9; i++) g.rect(6 + (i * 17) % (w - 14), 6 + (i * 23) % (h - 12), 8 + i % 3 * 3, 5 + i % 2 * 3).fill({ color: i % 2 ? look.face : look.top });
    return;
  }
  const face = prop.charred ? 0x4a3a2c : look.face, alpha = look.alpha ?? 1;
  g.ellipse(w / 2, h - 2, w * .52, 9).fill({ color: 0x07101c, alpha: .35 });
  g.rect(2, 4 - rise + 12, w - 4, h - 6).fill({ color: look.edge, alpha });
  g.rect(3, -rise, w - 6, h - 10).fill({ color: face, alpha }).stroke({ color: look.edge, width: 2 });
  g.rect(3, -rise, w - 6, 12).fill({ color: prop.charred ? 0x66503b : look.top, alpha });
  // Material detail: grain lines, pores, data grid or rivets.
  if (look.grain) for (let i = 1; i < 4; i++) g.moveTo(6, -rise + 12 + i * (h - 22) / 4).lineTo(w - 6, -rise + 12 + i * (h - 22) / 4).stroke({ color: look.grain, width: 1.5, alpha: .7 });
  if (look.pore) for (let i = 0; i < 6; i++) g.circle(10 + (i * 19) % (w - 20), -rise + 20 + (i * 13) % (h - 30), 2.5).fill({ color: look.pore });
  if (look.rivet) for (const x of [8, w - 8]) for (const y of [-rise + 18, h - rise - 4]) g.circle(x, y, 2).fill({ color: look.rivet });
  // Cracks grow as the block weakens; basalt shows molten seams.
  const cracks = fraction < .4 ? 4 : fraction < .7 ? 2 : 0;
  for (let i = 0; i < cracks; i++) {
    const x = w * (.22 + (i % 3) * .28), y = -rise + 16 + (i * 17) % Math.max(8, h - 34);
    g.moveTo(x, y).lineTo(x - 6, y + 10).lineTo(x + 4, y + 18).lineTo(x - 3, Math.min(h - rise - 6, y + 28)).stroke({ color: look.crack, width: 2 });
  }
  if (showBar) {
    g.rect(4, -rise - 10, w - 8, 5).fill({ color: 0x111c2c, alpha: .85 });
    g.rect(5, -rise - 9, (w - 10) * fraction, 3).fill({ color: fraction > .4 ? 0xd0bc79 : 0xe59370 });
  }
}
export function mountDataArenaInteractionView({PIXI,grid,art,objects,ground,useHarborPatches=false,floorOffset=()=>0,propArt}) {
  const patches=[];
  if(art&&useHarborPatches)for(const record of art.manifest.harborPatches){
    const sprite=new PIXI.Sprite(art.textures.get(record.textures[art.tier].src));sprite.position.set(record.x,record.y);sprite.width=record.width;sprite.height=record.height;ground.addChild(sprite);patches.push({...record,sprite});
  }
  const views=grid.props.map(prop=>{
    const cover=Boolean(prop.material&&prop.material!=="TIMBER");
    const override=cover?null:propArt?.get(prop.id),initial=override?.states.INTACT;
    const sprite=override?new PIXI.Sprite(override.textures.get(initial.textures[override.tier].src)):art&&!cover?new PIXI.Sprite(art.textures.get(art.manifest.props.INTACT[art.tier].src)):new PIXI.Graphics();
    sprite.label=prop.id+":destructible";sprite.zIndex=(prop.row+prop.height)*grid.cell;
    if(override){sprite.position.set(initial.x,initial.y);sprite.width=initial.width;sprite.height=initial.height;}
    else if(art&&!cover){const x=(prop.col+prop.width/2)*grid.cell,y=(prop.row+prop.height/2)*grid.cell;sprite.position.set(x-128,y-128-floorOffset(x,y));sprite.width=sprite.height=256;}
    else sprite.position.set(prop.col*grid.cell,prop.row*grid.cell);
    objects.addChild(sprite);return{prop,sprite,override,cover,key:null,textureState:"INTACT",lastHp:prop.hp,barUntil:-1};
  });
  function update({left,right,top,bottom,elapsed=0}) {
    for(const p of patches)p.sprite.visible=p.x<right&&p.x+p.width>left&&p.y<bottom&&p.y+p.height>top;
    for(const entry of views){const{prop,sprite,override}=entry;const state=grid.propVisualState(prop),fraction=prop.hp/prop.maxHp;
      const textureState=prop.destroyed?"DESTROYED":prop.charred&&fraction<.4?"BURNT":fraction<.7?"DAMAGED":"INTACT";
      if(prop.hp!==entry.lastHp){entry.lastHp=prop.hp;entry.barUntil=elapsed+HP_BAR_SECONDS;}
      const showBar=entry.cover&&!prop.destroyed&&elapsed<entry.barUntil;
      const key=state+":"+(entry.cover?Math.round(fraction*40):Math.floor(fraction*10))+":"+prop.charred+":"+showBar;
      if(key!==entry.key){entry.key=key;entry.textureState=textureState;
        sprite.zIndex=prop.destroyed?prop.row*grid.cell-1:(prop.row+prop.height)*grid.cell;
        if(entry.cover)drawCover(sprite,prop,prop.width*grid.cell,prop.height*grid.cell,fraction,showBar);
        else if(override){sprite.texture=override.textures.get(override.states[textureState].textures[override.tier].src);sprite.tint=0xffffff;}
        else if(art){sprite.texture=art.textures.get(art.manifest.props[textureState][art.tier].src);sprite.tint=prop.charred?0xc3b49b:0xffffff;}
        else{sprite.clear();const w=prop.width*grid.cell,h=prop.height*grid.cell;
          if(prop.destroyed){sprite.ellipse(w/2,h/2,w*.48,h*.4).fill({color:prop.charred?0x211a13:0x59402b,alpha:.7});for(let i=0;i<7;i++)sprite.rect(8+i*15,8+(i%3)*12,25,5).fill({color:0x72502f});}
          else{sprite.rect(1,3,w-2,h-4).fill({color:0x442918});sprite.rect(3,-30,w-6,h-8).fill({color:prop.charred?0x66503b:0xb1844b}).stroke({color:0x503b24,width:3});for(let i=1;i<4;i++)sprite.moveTo(i*w/4,-28).lineTo(i*w/4,h-38).stroke({color:0x6f4e2e,width:3});if(textureState!=="INTACT")sprite.moveTo(16,0).lineTo(46,-14).lineTo(72,4).stroke({color:0x251d16,width:5});}
        }
      }
      const x=prop.col*grid.cell,y=prop.row*grid.cell;sprite.visible=x<right&&x+prop.width*grid.cell>left&&y-100<bottom&&y+prop.height*grid.cell+80>top;
    }
  }
  return{update,diagnostics:()=>({artLoaded:Boolean(art),tier:art?.tier??null,decodedBytes:art?.decodedBytes??0,props:views.map(e=>({id:e.prop.id,hp:e.prop.hp,state:grid.propVisualState(e.prop),texture:e.textureState,drawIndex:objects.children.indexOf(e.sprite)}))})};
}
