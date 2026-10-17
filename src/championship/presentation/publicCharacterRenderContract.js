export const PUBLIC_CHARACTER_RENDER_KIND='CHARACTER_RENDER_V1';

// Only fields consumed by the existing controllers/native frame presenters.
// No ownership, review status, source-bank identity or approval messages.
export function characterRenderAnimations(animations){
  return animations.map(animation=>({id:animation.id,name:animation.name,
    semanticAlias:animation.semanticAlias,playbackMode:animation.playbackMode,
    playback:animation.playback,
    ...(animation.loopStartFrame===undefined?{}:{loopStartFrame:animation.loopStartFrame}),
    frames:animation.frames.map(frame=>({texture:frame.texture,cell:frame.cell,ticks:frame.ticks}))}));
}
