// Read-only view of actual match-scoped prop states. Never drives collision.
export function mountDataArenaInteractionView({PIXI,grid,art,objects,ground,useHarborPatches=false,floorOffset=()=>0,propArt}) {
  const patches=[];
  if(art&&useHarborPatches)for(const record of art.manifest.harborPatches){
    const sprite=new PIXI.Sprite(art.textures.get(record.textures[art.tier].src));sprite.position.set(record.x,record.y);sprite.width=record.width;sprite.height=record.height;ground.addChild(sprite);patches.push({...record,sprite});
  }
  const views=grid.props.map(prop=>{
    const override=propArt?.get(prop.id),initial=override?.states.INTACT;
    const sprite=override?new PIXI.Sprite(override.textures.get(initial.textures[override.tier].src)):art?new PIXI.Sprite(art.textures.get(art.manifest.props.INTACT[art.tier].src)):new PIXI.Graphics();
    sprite.label=prop.id+":destructible";sprite.zIndex=(prop.row+prop.height)*grid.cell;
    if(override){sprite.position.set(initial.x,initial.y);sprite.width=initial.width;sprite.height=initial.height;}
    else if(art){const x=(prop.col+prop.width/2)*grid.cell,y=(prop.row+prop.height/2)*grid.cell;sprite.position.set(x-128,y-128-floorOffset(x,y));sprite.width=sprite.height=256;}
    else sprite.position.set(prop.col*grid.cell,prop.row*grid.cell);
    objects.addChild(sprite);return{prop,sprite,override,key:null,textureState:"INTACT"};
  });
  function update({left,right,top,bottom}) {
    for(const p of patches)p.sprite.visible=p.x<right&&p.x+p.width>left&&p.y<bottom&&p.y+p.height>top;
    for(const entry of views){const{prop,sprite,override}=entry;const state=grid.propVisualState(prop),fraction=prop.hp/prop.maxHp;
      const textureState=prop.destroyed?"DESTROYED":prop.charred&&fraction<.4?"BURNT":fraction<.7?"DAMAGED":"INTACT";
      const key=state+":"+Math.floor(fraction*10)+":"+prop.charred;
      if(key!==entry.key){entry.key=key;entry.textureState=textureState;
        sprite.zIndex=prop.destroyed?prop.row*grid.cell-1:(prop.row+prop.height)*grid.cell;
        if(override){sprite.texture=override.textures.get(override.states[textureState].textures[override.tier].src);sprite.tint=0xffffff;}
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
