// Original vector effects, authored for this game's relay combat. No extracted
// pixels or third-party rendering code. Four shared textures, allocated once.
// Projectile heads are centred at (64,32), radius 18; tails are decorative.
export function createDataArenaRelayEffects(PIXI) {
  const owned=[];
  const make=(name,draw,height=64)=>{
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=height;
    const c=canvas.getContext('2d');draw(c);
    const texture=PIXI.Texture.from(canvas);owned.push(texture);return [name,texture];
  };
  const line=(c,points,width,color)=>{c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.lineWidth=width;c.strokeStyle=color;c.lineCap='round';c.lineJoin='round';c.stroke();};
  const textures=Object.fromEntries([
    make('relayFlame',c=>{
      const g=c.createLinearGradient(0,0,84,0);g.addColorStop(0,'#ffffff00');g.addColorStop(.55,'#ffffff88');g.addColorStop(1,'#fff');
      c.fillStyle=g;c.beginPath();c.moveTo(2,10);c.bezierCurveTo(25,25,36,7,65,14);c.bezierCurveTo(92,16,90,48,65,50);c.bezierCurveTo(40,51,24,39,2,54);c.quadraticCurveTo(25,31,2,10);c.fill();
      line(c,[[12,33],[36,27],[50,35],[66,31]],7,'#fff');c.fillStyle='#fff';c.beginPath();c.arc(64,32,11,0,Math.PI*2);c.fill();
    }),
    make('relayLance',c=>{
      const g=c.createLinearGradient(3,0,82,0);g.addColorStop(0,'#ffffff00');g.addColorStop(1,'#fff');c.fillStyle=g;
      c.beginPath();c.moveTo(2,28);c.lineTo(51,27);c.lineTo(64,14);c.lineTo(82,32);c.lineTo(64,50);c.lineTo(51,37);c.lineTo(2,36);c.closePath();c.fill();
      line(c,[[18,32],[77,32]],3,'#fff');line(c,[[47,13],[57,23]],2,'#ffffff99');line(c,[[47,51],[57,41]],2,'#ffffff99');
    }),
    make('relayCrystal',c=>{
      c.fillStyle='#ffffff99';c.beginPath();c.moveTo(38,32);c.lineTo(60,13);c.lineTo(82,32);c.lineTo(60,51);c.closePath();c.fill();
      line(c,[[38,32],[60,13],[82,32],[60,51],[38,32],[82,32]],2,'#fff');line(c,[[60,13],[66,32],[60,51]],2,'#fff');
      line(c,[[12,23],[28,23]],2,'#ffffff77');line(c,[[4,41],[22,41]],2,'#ffffff99');
    }),
    make('relaySlash',c=>{
      for(let i=0;i<3;i++){
        c.beginPath();c.moveTo(14+i*7,17+i*22);c.bezierCurveTo(88,9+i*19,110,46+i*13,74,92+i*9);
        c.lineWidth=8-i*1.5;c.strokeStyle=i===1?'#fff':'#ffffffaa';c.lineCap='round';c.stroke();
      }
    },128)
  ]);
  return {...textures,destroy(){for(const t of owned.splice(0))t.destroy(true);}};
}
