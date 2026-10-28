// Original vector effects, authored for this game's relay combat. No extracted
// pixels or third-party rendering code. Shared textures, allocated once.
// Projectile heads are centred at (64,32), radius 18; tails are decorative.
// White and grey only: the sprite tint carries the element colour. Stage two
// (2026-10-28) adds one head per VFX style family: leaf, seed, thorn, spore,
// missile, bullet, water drop, lightning, rock, wind blade, dark orb, sound ring.
// Names the relay style table may ask for ('wave' comes from the harbour textures).
export const RELAY_EFFECT_TEXTURES = Object.freeze(['relayFlame', 'relayLance', 'relayCrystal', 'relaySlash', 'relayLeaf', 'relaySeed', 'relayThorn',
  'relaySpore', 'relayMissile', 'relayBullet', 'relayDrop', 'relayBolt', 'relayRock', 'relayWind', 'relayOrb', 'relayRing', 'wave']);
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
    },128),
    make('relayLeaf',c=>{
      for(const [x,y,s] of [[64,32,1],[40,22,.6],[30,42,.5]]){
        c.save();c.translate(x,y);c.rotate(-.35);c.scale(s,s);c.fillStyle=s===1?'#fff':'#ffffffaa';
        c.beginPath();c.moveTo(-22,0);c.quadraticCurveTo(0,-15,22,0);c.quadraticCurveTo(0,15,-22,0);c.fill();
        line(c,[[-18,0],[18,0]],2,'#ffffff66');c.restore();
      }
    }),
    make('relaySeed',c=>{
      line(c,[[8,32],[44,32]],5,'#ffffff55');
      c.fillStyle='#fff';c.beginPath();c.ellipse(64,32,15,11,0,0,Math.PI*2);c.fill();
      c.fillStyle='#ffffff88';c.beginPath();c.ellipse(70,26,5,3,-.5,0,Math.PI*2);c.fill();
      line(c,[[50,32],[44,24]],2,'#fff');
    }),
    make('relayThorn',c=>{
      for(const dy of [-12,0,12]){c.fillStyle=dy?'#ffffffaa':'#fff';c.beginPath();c.moveTo(84,32+dy*.6);c.lineTo(40,26+dy);c.lineTo(46,32+dy);c.lineTo(40,38+dy);c.closePath();c.fill();}
      line(c,[[6,32],[38,32]],2,'#ffffff55');
    }),
    make('relaySpore',c=>{
      for(const [x,y,r,a] of [[64,32,14,'#fff'],[50,22,8,'#ffffffbb'],[48,42,9,'#ffffffbb'],[34,30,6,'#ffffff88'],[22,38,4,'#ffffff66']]){c.fillStyle=a;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
      c.fillStyle='#ffffff55';for(const [x,y] of [[60,28],[68,36],[64,24]]){c.beginPath();c.arc(x,y,2.5,0,Math.PI*2);c.fill();}
    }),
    make('relayMissile',c=>{
      const g=c.createLinearGradient(0,0,44,0);g.addColorStop(0,'#ffffff00');g.addColorStop(1,'#ffffffcc');
      c.fillStyle=g;c.beginPath();c.moveTo(2,26);c.lineTo(44,29);c.lineTo(44,35);c.lineTo(2,38);c.closePath();c.fill();
      c.fillStyle='#fff';c.beginPath();c.moveTo(44,25);c.lineTo(72,25);c.quadraticCurveTo(86,32,72,39);c.lineTo(44,39);c.closePath();c.fill();
      c.fillStyle='#ffffffaa';c.beginPath();c.moveTo(46,25);c.lineTo(38,16);c.lineTo(54,25);c.moveTo(46,39);c.lineTo(38,48);c.lineTo(54,39);c.fill();
    }),
    make('relayBullet',c=>{
      line(c,[[14,32],[52,32]],4,'#ffffff66');
      c.fillStyle='#fff';c.beginPath();c.moveTo(52,26);c.lineTo(70,26);c.quadraticCurveTo(80,32,70,38);c.lineTo(52,38);c.closePath();c.fill();
    }),
    make('relayDrop',c=>{
      const g=c.createLinearGradient(4,0,60,0);g.addColorStop(0,'#ffffff00');g.addColorStop(1,'#ffffffaa');
      c.fillStyle=g;c.beginPath();c.moveTo(4,30);c.quadraticCurveTo(40,22,60,24);c.lineTo(60,40);c.quadraticCurveTo(40,42,4,34);c.fill();
      c.fillStyle='#fff';c.beginPath();c.moveTo(82,32);c.quadraticCurveTo(66,14,52,32);c.quadraticCurveTo(66,50,82,32);c.fill();
      c.fillStyle='#ffffff88';c.beginPath();c.arc(64,27,3,0,Math.PI*2);c.fill();
    }),
    make('relayBolt',c=>{
      line(c,[[4,32],[18,24],[30,38],[44,22],[56,38],[66,28],[82,32]],6,'#ffffffaa');
      line(c,[[4,32],[18,24],[30,38],[44,22],[56,38],[66,28],[82,32]],2,'#fff');
      c.fillStyle='#fff';c.beginPath();c.arc(64,32,8,0,Math.PI*2);c.fill();
    }),
    make('relayRock',c=>{
      line(c,[[10,36],[34,34]],3,'#ffffff44');
      c.fillStyle='#fff';c.beginPath();c.moveTo(48,26);c.lineTo(62,16);c.lineTo(80,22);c.lineTo(82,40);c.lineTo(66,48);c.lineTo(50,42);c.closePath();c.fill();
      c.fillStyle='#ffffff77';c.beginPath();c.moveTo(62,16);c.lineTo(80,22);c.lineTo(66,30);c.closePath();c.fill();
    }),
    make('relayWind',c=>{
      for(const [r,w,a] of [[22,6,'#fff'],[30,3,'#ffffff99'],[38,2,'#ffffff55']]){c.beginPath();c.arc(48,32,r,-1.05,1.05);c.lineWidth=w;c.strokeStyle=a;c.lineCap='round';c.stroke();}
      line(c,[[6,22],[30,24]],2,'#ffffff55');line(c,[[10,42],[32,40]],2,'#ffffff55');
    }),
    make('relayOrb',c=>{
      c.fillStyle='#ffffffcc';c.beginPath();c.arc(64,32,14,0,Math.PI*2);c.fill();
      c.lineWidth=2;c.strokeStyle='#fff';for(const a of [.6,-.6]){c.beginPath();c.ellipse(64,32,19,9,a,0,Math.PI*2);c.stroke();}
      for(const [x,y,r] of [[42,28,5],[30,36,3.5],[20,30,2.5]]){c.fillStyle='#ffffff77';c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
    }),
    make('relayRing',c=>{
      for(const [r,w,a] of [[16,4,'#fff'],[24,3,'#ffffffaa'],[32,2,'#ffffff66']]){c.beginPath();c.arc(56,32,r,-1.2,1.2);c.lineWidth=w;c.strokeStyle=a;c.lineCap='round';c.stroke();}
      c.fillStyle='#fff';c.beginPath();c.arc(64,32,4,0,Math.PI*2);c.fill();
    })
  ]);
  return {...textures,destroy(){for(const t of owned.splice(0))t.destroy(true);}};
}
