// Original, bounded environment rules. Initial occupancy remains the map's
// authored SOLID rectangles; only these timber supply stacks may be destroyed.
export function dataArenaPropSpecs(map) {
  const harbor = map.cols === 60 && map.rows === 40 && Boolean(map.stage);
  const duel = map.cols === 24 && map.rows === 16 && !map.stage;
  const authored = harbor ? [[7,11,24,2,1],[13,47,24,2,1],[17,6,37,2,1],[18,52,37,2,1]]
    : duel ? [[6,9,5,2,1],[7,13,5,2,1],[10,9,11,2,1],[11,13,11,2,1]] : [];
  return authored.map(([rectIndex,c,r,w,h]) => {
    const rect = map.rects[rectIndex];
    if (!rect || rect[4] !== 1 || [c,r,w,h].some((v,i) => rect[i] !== v)) throw Error("DATA_ARENA_PROP_LAYOUT_MISMATCH");
    return { id: `cargo-${rectIndex}`, rectIndex, col:c, row:r, width:w, height:h,
      material:"TIMBER", combustible:true, maxHp:120, burnDps:12 };
  });
}
