// TEST ONLY. One explicit zero-delta scene.render is required by redrawNormal.
export function assertContactRestoration(before,after){
 if(after.frames!==before.frames+1)throw Error('CONTACT_EVIDENCE_RENDER_PROGRESS_NOT_EXACTLY_ONE');
 if(before.three!==after.three||before.pixi!==after.pixi)throw Error('CONTACT_EVIDENCE_NORMAL_PIXELS_CHANGED');
 if(before.sceneClock!==after.sceneClock)throw Error('CONTACT_EVIDENCE_SCENE_CLOCK_CHANGED');
 if(JSON.stringify(before.state)!==JSON.stringify(after.state)||JSON.stringify(before.pose)!==JSON.stringify(after.pose))throw Error('CONTACT_EVIDENCE_RENDER_OR_POSE_STATE_CHANGED');
}
