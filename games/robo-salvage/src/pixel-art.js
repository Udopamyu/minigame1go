/* Distinct equipment silhouettes, handcrafted pixel mechanics.
   Nose points right, y is lateral. Each of 28 items changes the shape. */
const PIXEL_RENDER_MODE={enabled:true,cssBlockSize:3};
const MECH_PIXELS=document.createElement('canvas');
const SPRITE_SILHOUETTES={
 weapon:{pulse:'thin-coil-barrel',shot:'triple-flared-muzzle',rail:'extra-long-dual-rails',missile:'quad-rocket-pods',micro:'needle-array',burst:'triple-parallel-barrels',slug:'oversized-heavy-cannon'},
 armor:{mesh:'exposed-narrow-frame',plated:'stacked-heavy-panels',fortress:'broad-shielded-bastion',reactive:'angular-explosive-tiles',composite:'asymmetric-patchwork',feather:'swept-back-wings',prism:'stepped-diamond-plates'},
 legs:{wheel:'four-independent-wheels',booster:'four-floating-thrusters',tank:'two-caterpillar-belts',spider:'eight-jointed-legs',jet:'swept-wings-and-exhausts',crawler:'two-oversized-crawler-belts',ranger:'long-two-legged-walker'},
 core:{spark:'cross-spark',blaze:'flame-reactor',rapid:'triple-pulse-display',repair:'medical-cross',capacitor:'double-capacitor',aegis:'wide-energy-shield',salvager:'four-way-salvage-rotor'}
};
function mechTile(x,y,w,h,color){
 ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));
}
function hostileShade(c,isEnemy){
 if(!isEnemy||!/^#[\da-f]{6}$/i.test(c))return c;
 const hex=c.slice(1),rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
 return '#'+[Math.min(255,Math.round(rgb[0]*.86+232*.14)),Math.round(rgb[1]*.91+86*.09),Math.round(rgb[2]*.90+106*.10)]
  .map(v=>v.toString(16).padStart(2,'0')).join('');
}
function metal(x,y,w,h,fill,edge='#081421',shine='#d7e2e7'){
 mechTile(x-3,y-3,w+6,h+6,edge);
 mechTile(x,y,w,h,fill);
 mechTile(x+3,y+3,w-6,4,shine);
 mechTile(x+3,y+h-7,w-6,4,'#142c3a');
}
function pixelDiamond(cx,cy,rx,ry,fill,trim){
 for(let y=-ry;y<=ry;y+=4){
  const width=Math.max(4,Math.round(rx*(1-Math.abs(y)/(ry+4))/4)*4);
  mechTile(cx-width,cy+y,2*width,4,fill);
 }
 for(const step of [-1,1]){
  for(let i=0;i<4;i++){
   const x=cx+step*(rx-i*4);
   mechTile(x,cy-4-i*4,4,8,trim);
  }
 }
}
function drawTread(y,x,width,height,tint,heavy=false){
 metal(x,y,width,height,'#17232d','#040a11','#394957');
 mechTile(x+6,y+5,width-12,height-10,tint);
 for(let xx=x+5;xx<x+width-4;xx+=heavy?11:13){
  mechTile(xx,y-4,7,8,'#0d1823');
  mechTile(xx,y+height-4,7,8,'#07131e');
  mechTile(xx+2,y+6,4,height-12,'#0b222e');
 }
 for(let xx=x+12;xx<x+width-6;xx+=23){
  mechTile(xx,y+height/2-4,10,9,'#122533');
  mechTile(xx+3,y+height/2-2,4,5,'#a5c2c1');
 }
}
function drawLegEquipment(id,c,trim){
 switch(id){
 case 'wheel':
  for(const x of [-39,16])for(const y of [-49,31]){
   metal(x,y,24,21,'#253643','#060e18','#8ba5b2');
   mechTile(x+6,y+4,12,13,c);mechTile(x+10,y+8,4,5,'#11232d');
  }
  break;
 case 'tank':
  drawTread(-58,-44,92,26,c);drawTread(33,-44,92,26,c);
  mechTile(-35,-32,78,6,'#597078');mechTile(-35,26,78,6,'#597078');
  break;
 case 'crawler':
  drawTread(-67,-61,105,35,c,true);drawTread(32,-61,105,35,c,true);
  for(const x of [-57,32])mechTile(x,-36,6,73,'#a3b09b');
  break;
 case 'booster':
  for(const y of [-53,32])for(const x of [-40,1]){
   metal(x,y,33,24,c,'#18212a',trim);
   mechTile(x-11,y+7,11,9,'#e98b5f');
   mechTile(x-17,y+10,6,3,'#ffe09b');
  }
  break;
 case 'spider':
  for(let side of [-1,1])for(let k=0;k<4;k++){
   const x=-41+k*24,y=side*27;
   metal(x,y,13,16,c,'#111525',trim);
   mechTile(x-7,side*(35+k%2*5),10,7,c);
   mechTile(x-17,side*(46+k%2*5),21,7,c);
   mechTile(x-20,side*(58+k%2*6),6,16,'#1c3549');
   mechTile(x-23,side*(66+k%2*6),11,6,trim);
  }
  break;
 case 'jet':
  for(const side of [-1,1]){
   metal(-48,side*33-9,38,19,c,'#102135',trim);
   for(let i=0;i<5;i++)mechTile(-47+i*9,side*(39+i*6)-5,15,11,c);
   mechTile(-54,side*39-7,8,13,'#ffbd79');
   mechTile(-66-(Math.floor(clock*16)%3)*4,side*39-3,14,7,'#f9db8c');
  }
  break;
 case 'ranger':
  for(const side of [-1,1]){
   metal(-25,side*23-8,37,17,'#3d5463','#14202b',trim);
   mechTile(-35,side*38-8,24,15,c);
   mechTile(-44,side*45-8,16,13,trim);
   mechTile(12,side*37-6,27,11,c);
  }
  break;
 }
}
function drawArmorEquipment(id,c,trim){
 switch(id){
 case 'mesh':
  metal(-27,-25,55,50,c);
  for(const y of [-19,-7,5,17])mechTile(-21,y,42,5,'#193847');
  mechTile(-36,-15,10,30,trim);mechTile(26,-15,9,30,trim);
  break;
 case 'plated':
  metal(-37,-34,77,68,c);
  for(let y=-29;y<28;y+=15){
   mechTile(-31,y,67,12,trim);
   mechTile(-25,y+4,55,5,c);
  }
  for(const y of [-41,30])metal(-34,y,63,11,c);
  break;
 case 'fortress':
  metal(-48,-44,98,88,c,'#0c1720',trim);
  for(const y of [-56,41]){
   metal(-51,y,104,16,c,'#1d252e','#fff0bf');
   for(let x=-43;x<44;x+=21)mechTile(x,y+3,11,6,'#3c4a50');
  }
  for(const x of [-57,44])metal(x,-35,14,69,trim);
  metal(-31,-26,65,54,'#516677');
  break;
 case 'reactive':
  metal(-32,-33,68,65,c,'#151c2c',trim);
  for(const side of [-1,1])for(let x=-43;x<48;x+=28){
   metal(x,side*33-8,19,16,c,'#1b2740',trim);
   mechTile(x+7,side*49-7,8,12,'#f9e7ff');
  }
  for(const x of [-27,-3,21])for(const y of [-23,1]){
   mechTile(x,y,18,17,'#4d3a71');
   mechTile(x+4,y+4,10,9,c);
  }
  break;
 case 'composite':
  metal(-35,-28,74,57,c);
  metal(-49,-36,25,31,trim);metal(10,-47,30,24,'#637780');
  metal(-48,12,37,26,'#51657a');metal(19,7,31,34,c);
  for(let x=-20;x<=21;x+=14)mechTile(x,-6,8,12,trim);
  break;
 case 'feather':
  metal(-18,-19,45,38,c);
  for(const side of [-1,1]){
   for(let i=0;i<6;i++){
    mechTile(-57+i*8,side*(29+i*6)-6,18,12,c);
   }
   mechTile(-55,side*65-5,31,9,trim);
  }
  mechTile(17,-12,16,25,trim);
  break;
 case 'prism':
  pixelDiamond(0,0,48,49,c,trim);
  pixelDiamond(-4,0,29,34,'#346a81','#c5f8ed');
  for(const side of [-1,1]){
   mechTile(-24,side*43-5,43,9,trim);
   mechTile(-8,side*52-4,25,8,c);
  }
  break;
 }
}
function drawCoreEquipment(id,c,trim){
 const tick=Math.floor(clock*9)%3;
 switch(id){
 case 'spark':
  metal(-18,-18,36,36,c);
  mechTile(-21,-5,42,10,'#f3ffca');mechTile(-5,-21,10,42,'#f3ffca');
  mechTile(-8,-8,16,16,'#326c7f');break;
 case 'blaze':
  metal(-18,-20,36,40,'#794339');
  for(let i=0;i<3;i++){
   mechTile(-14+i*12,-26-((tick+i)%3)*6,8,20,'#ff9c4e');
   mechTile(-12+i*12,-18,5,22,c);
  }
  mechTile(-11,-10,22,22,'#ffe8a0');break;
 case 'rapid':
  metal(-19,-20,39,40,'#274c72');
  for(let i=0;i<3;i++){
   mechTile(-14,-15+i*12,28,8,i===tick?'#efffff':c);
   mechTile(15,-15+i*12,8,8,trim);
  }break;
 case 'repair':
  metal(-18,-19,38,38,'#356d60');
  mechTile(-7,-16,15,32,'#f3ffe1');mechTile(-17,-6,36,13,'#f3ffe1');
  mechTile(-3,-3,7,7,c);break;
 case 'capacitor':
  metal(-21,-20,42,40,'#21435a');
  for(let x=-16;x<=5;x+=21){
   metal(x,-16,14,32,c,'#122639',trim);
   mechTile(x+4,-11,6,22,'#c6e9ff');
  }break;
 case 'aegis':
  pixelDiamond(0,0,28,32,c,'#e7fff4');
  for(const side of [-1,1]){
   mechTile(-27,side*36-4,55,8,trim);
   mechTile(-35,side*28-4,10,15,c);
  }
  mechTile(-7,-8,14,17,'#244c56');break;
 case 'salvager':
  metal(-19,-20,38,40,'#584e36');
  for(let i=0;i<4;i++){
   const a=i*Math.PI/2+(tick-1)*.13;
   mechTile(Math.cos(a)*13-5,Math.sin(a)*13-5,11,11,c);
  }
  metal(-6,-7,12,14,trim);break;
 }
}
function drawWeaponEquipment(id,c,trim){
 switch(id){
 case 'pulse':
  metal(25,-10,55,20,c);
  for(let x=34;x<78;x+=11){
   mechTile(x,-16,6,32,'#2c667a');mechTile(x+2,-7,3,13,'#f3feff');
  }
  mechTile(79,-5,16,10,trim);break;
 case 'shot':
  metal(21,-21,33,42,c);
  for(const y of [-19,-5,9]){
   metal(43,y,39,12,'#9d7f54','#1e2b39',trim);
   mechTile(80,y-2,13,16,'#ffdb96');
  }
  break;
 case 'rail':
  metal(20,-15,28,30,'#494d73');
  for(const y of [-20,12]){
   metal(37,y,83,9,c,'#101a2a',trim);
   for(let x=49;x<113;x+=19)mechTile(x,y+2,9,4,'#dfcfff');
  }
  mechTile(38,-3,75,6,'#6d66db');
  mechTile(118,-18,10,38,'#e3d1ff');break;
 case 'missile':
  metal(20,-29,36,58,c);
  for(const y of [-26,-8,10]){
   metal(44,y,42,16,'#a77e73','#202133',trim);
   mechTile(85,y+3,16,9,'#ffdac3');
  }
  mechTile(17,-37,34,7,trim);mechTile(17,31,34,7,trim);
  break;
 case 'micro':
  metal(25,-12,46,24,c);
  for(let y=-16;y<18;y+=8){
   mechTile(64,y,49,5,'#aed7c1');
   mechTile(108,y-2,12,9,trim);
  }
  for(let x=32;x<63;x+=9)mechTile(x,-18,5,36,'#2f7b63');
  break;
 case 'burst':
  metal(20,-20,44,40,c);
  for(let y=-14;y<=14;y+=14){
   metal(57,y-5,52,10,'#446995','#15273b',trim);
  }
  mechTile(105,-24,10,48,'#aacce9');break;
 case 'slug':
  metal(15,-28,56,57,c,'#17192c','#f1d8e6');
  metal(56,-19,49,38,'#896e9d','#19162a',trim);
  metal(97,-26,22,52,'#51385e','#110f21','#efe8f8');
  mechTile(120,-13,14,26,'#ffe2f1');break;
 }
}
function drawMechEquipment(o){
 if(!o)return;
 const load=o.load,defs=o.stats,flash=o.hitFlash>0;
 const armor=flash?'#fff':hostileShade(defs.armor.color,o.enemy);
 const leg=hostileShade(defs.legs.color,o.enemy);
 const gun=hostileShade(defs.weapon.color,o.enemy);
 const core=hostileShade(defs.core.color,o.enemy);
 const trim=o.enemy?'#eac0c0':'#b6e9ea';
 const boss=o.enemy&&currentNode==='boss',elite=o.enemy&&currentNode==='elite';
 ctx.save();ctx.translate(Math.round(o.x),Math.round(o.y));
 mechTile(-55,52,118,7,'#02091499');
 ctx.rotate(o.angle);
 if(boss)ctx.scale(1.19,1.19);
 if(o.dashLeft>0)for(let k=0;k<4;k++)mechTile(-73-k*14,-4+k*3,13,6,'#79fcf6');
 drawLegEquipment(load.legs.id,leg,trim);
 if(boss||elite){
  const tint=boss?'#ffe49b':'#dfc1fa';
  mechTile(-56,-74,20,8,tint);mechTile(-56,-74,8,30,tint);
  mechTile(36,66,20,8,tint);mechTile(48,44,8,30,tint);
 }
 drawArmorEquipment(load.armor.id,armor,trim);
 drawCoreEquipment(load.core.id,core,trim);
 drawWeaponEquipment(load.weapon.id,gun,trim);
 if(o.status?.burn>0){
  mechTile(-16,-62,12,19,'#ff8b4f');mechTile(0,-56,11,14,'#fff0ae');
 }
 if(o.status?.stun>0){
  mechTile(-31,-66,13,8,'#fff1a0');mechTile(20,-63,15,8,'#fff1a0');
 }
 ctx.restore();
 if(state==='fight'){
  mechTile(o.x-45,o.y-90,90,10,'#051120');
  mechTile(o.x-43,o.y-88,Math.max(0,86*clamp(o.hp/o.maxHp,0,1)),6,
   o.enemy?'#ef9293':'#7ce7d8');
 }
}
function renderPixelFrame(){
 if(!PIXEL_RENDER_MODE.enabled)return;
 if(MECH_PIXELS.width!==canvas.width||MECH_PIXELS.height!==canvas.height){
  MECH_PIXELS.width=canvas.width;MECH_PIXELS.height=canvas.height;
 }
 ctx.imageSmoothingEnabled=false;
}
