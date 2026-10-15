/** A single selected-detail invalidation queue, never a continuous ticker. */
export const MEDAL_HOME_POSE = Object.freeze({x:-0.13,y:-0.28});
export function createMedalFrameRuntime({requestFrame,cancelFrame,draw}) {
  let frame=null,visible=true,enabled=true,disposed=false,drawCount=0;
  let pose={...MEDAL_HOME_POSE};
  function cancel(){if(frame!==null)cancelFrame(frame);frame=null;}
  function invalidate(){if(!disposed&&visible&&enabled&&frame===null)frame=requestFrame(tick);}
  function tick(){frame=null;if(disposed||!visible||!enabled)return;draw({...pose});drawCount++;}
  return Object.freeze({
    invalidate,
    rotate(dx,dy){if(disposed||!visible||!enabled||!Number.isFinite(dx)||!Number.isFinite(dy))return;
      pose={x:Math.max(-.75,Math.min(.75,pose.x+dy)),y:((pose.y+dx+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI};invalidate();},
    reset(){if(disposed)return;pose={...MEDAL_HOME_POSE};invalidate();},
    setVisible(value){visible=!!value;if(visible)invalidate();else cancel();},
    setEnabled(value){enabled=!!value;if(enabled)invalidate();else cancel();},
    dispose(){if(disposed)return;disposed=true;cancel();},
    snapshot(){return {disposed,visible,enabled,framePending:frame!==null,drawCount,pose:{...pose},renderLoop:'ON_DEMAND_ONLY',automaticMotion:false};}
  });
}
