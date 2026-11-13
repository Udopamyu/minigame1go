/*
 * PIXEL MECH VISUAL SYSTEM
 *
 * Completely original, procedural pixel-mecha: no sprites, copied characters,
 * image assets, shaders, remote files, or additional build dependencies.
 *
 * Every one of the four equipment slots has a tangible silhouette or color
 * change. The final blit uses nearest-neighbour scaling and a low-resolution
 * buffer; this is real pixel rendering rather than a pixel-font overlay.
 */

const MECH_PIXELS=document.createElement('canvas');
const MECH_PIXELS_CTX=MECH_PIXELS.getContext('2d',{alpha:false});
const PIXEL_RENDER_MODE={enabled:true,cssBlockSize:3};
const PIXEL_PALETTE={
 background:'#0b1427',
 shadow:'#101728',
 darkPlate:'#17263a',
 trim:'#b1c4d0',
 highlight:'#f0f7ff',
 tread:'#263b48',
 weaponSocket:'#1e3145',
 enemyBadge:'#ffb1a4',
 playerBadge:'#b2f6f2'
};

function mechTile(x,y,w,h,color){
 ctx.fillStyle=color;
 ctx.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));
}

function drawMechEquipment(o){
 const load=o.load,defs=o.stats;
 const weapon=defs.weapon,armor=defs.armor,legs=defs.legs,core=defs.core;
 const flicker=o.hitFlash>0;
 const armorColor=flicker?'#ffffff':armor.color;
 const trim=o.enemy?PIXEL_PALETTE.enemyBadge:PIXEL_PALETTE.playerBadge;
 const bootSize=defs.legs.id==='crawler'?21:defs.legs.id==='tank'?19:14;
 const armorWidth=defs.armor.id==='fortress'?49:
  defs.armor.id==='plated'||defs.armor.id==='composite'?43:
  defs.armor.id==='feather'?31:38;
 const coreFlicker=Math.floor(clock*8)%2;
 const isBoss=o.enemy&&currentNode==='boss';

 ctx.save();
 ctx.translate(Math.round(o.x),Math.round(o.y));

 // Square tactical warnings use block geometry, not smooth circular outlines.
 if(o.dashLeft>0){
  for(let i=0;i<4;i++){
   const a=i*TAU/4-clock*3;
   mechTile(Math.cos(a)*39-4,Math.sin(a)*39-4,8,8,'#71f3ee');
  }
 }
 if(o.enemy&&(isBoss||currentNode==='elite')){
  const size=isBoss?53:44;
  const bar=isBoss?'#fac77c':'#b7a2e3';
  for(const dx of [-size,size]){
   mechTile(dx-3,-size,6,21,bar);
   mechTile(dx-3,size-21,6,21,bar);
  }
  for(const dy of [-size,size]){
   mechTile(-size,dy-3,21,6,bar);
   mechTile(size-21,dy-3,21,6,bar);
  }
 }

 // A four-layer, strictly rectilinear shadow grounds the chassis.
 mechTile(-30,13,65,8,'#02071380');
 mechTile(-28,18,61,5,'#0207135e');

 ctx.rotate(o.angle);
 if(isBoss)ctx.scale(1.2,1.2);

 // Leg type changes the actual body silhouette.
 switch(load.legs.id){
 case 'wheel':
  mechTile(-27,-25,35,13,PIXEL_PALETTE.tread);
  mechTile(-27,12,35,13,PIXEL_PALETTE.tread);
  for(let j=0;j<4;j++){
   mechTile(-23+j*9,-22,5,7,legs.color);
   mechTile(-23+j*9,15,5,7,legs.color);
  }
  break;
 case 'booster':
 case 'jet':
  mechTile(-27,-24,39,10,legs.color);
  mechTile(-27,14,39,10,legs.color);
  mechTile(-32,-19,13,7,PIXEL_PALETTE.weaponSocket);
  mechTile(-32,12,13,7,PIXEL_PALETTE.weaponSocket);
  if(o.dashLeft>0||coreFlicker===1){
   mechTile(-39,-19,9,6,'#fff1ae');
   mechTile(-39,13,9,6,'#fff1ae');
  }
  break;
 case 'spider':
  for(const s of [-1,1]){
   for(let j=0;j<3;j++){
    const yy=s*(15+j*7);
    mechTile(-22+j*12,yy,15,5,legs.color);
    mechTile(-22+j*12,yy+s*4,5,10,PIXEL_PALETTE.tread);
   }
  }
  break;
 case 'crawler':
 case 'tank':
  mechTile(-31,-27,47,15,PIXEL_PALETTE.tread);
  mechTile(-31,12,47,15,PIXEL_PALETTE.tread);
  for(let j=0;j<6;j++){
   mechTile(-29+j*7,-25,4,11,legs.color);
   mechTile(-29+j*7,14,4,11,legs.color);
  }
  if(bootSize>18){
   mechTile(-32,-30,12,5,armorColor);
   mechTile(-32,25,12,5,armorColor);
  }
  break;
 default:
  mechTile(-27,-22,37,13,legs.color);
  mechTile(-27,9,37,13,legs.color);
 }

 // Armor cross-section: high-HP bodies are visibly broader.
 const aw=Math.round(armorWidth);
 mechTile(-aw/2-3,-21,aw+6,42,PIXEL_PALETTE.darkPlate);
 mechTile(-aw/2,-18,aw,36,armorColor);
 mechTile(-aw/2,-18,7,8,PIXEL_PALETTE.trim);
 mechTile(-aw/2,10,7,8,PIXEL_PALETTE.trim);
 mechTile(aw/2-7,-18,7,8,PIXEL_PALETTE.trim);
 mechTile(aw/2-7,10,7,8,PIXEL_PALETTE.trim);

 // Distinguishable armor decorations.
 switch(load.armor.id){
 case 'fortress':
  mechTile(-aw/2-9,-10,10,21,armorColor);
  mechTile(aw/2,-10,10,21,armorColor);
  mechTile(-9,-20,20,8,'#dbb477');
  break;
 case 'reactive':
  mechTile(-aw/2+2,-12,6,9,'#c9adff');
  mechTile(-aw/2+2,5,6,9,'#c9adff');
  mechTile(aw/2-8,-12,6,9,'#c9adff');
  mechTile(aw/2-8,5,6,9,'#c9adff');
  break;
 case 'prism':
  mechTile(-14,-17,7,7,'#e9f3ff');
  mechTile(8,10,7,7,'#e9f3ff');
  break;
 case 'feather':
  mechTile(-aw/2-6,-16,8,8,armorColor);
  mechTile(-aw/2-6,8,8,8,armorColor);
  break;
 case 'composite':
  for(let j=0;j<3;j++)mechTile(-aw/2+j*12,-16,7,6,'#cad9ce');
  break;
 }

 // Engine core shows the selected core's energy color.
 mechTile(-8,-11,22,22,PIXEL_PALETTE.weaponSocket);
 mechTile(-5,-8,16,16,core.color);
 mechTile(-2,-5,10,10,coreFlicker?'#e6f8ff':'#26445c');
 if(load.core.id==='aegis'){
  for(const y of [-13,11])mechTile(-7,y,23,3,'#cef6cb');
 }
 if(load.core.id==='salvager')mechTile(-15,-3,7,7,'#fed691');
 if(load.core.id==='blaze')mechTile(-14,-2,6,6,'#ff796d');

 // Every weapon has a different barrel geometry.
 mechTile(15,-9,22,18,PIXEL_PALETTE.weaponSocket);
 switch(load.weapon.id){
 case 'shot':
  for(let j=-1;j<=1;j++)mechTile(23,j*8-2,32,6,weapon.color);
  break;
 case 'rail':
  mechTile(23,-5,45,10,weapon.color);
  mechTile(29,-10,26,4,'#daccff');
  mechTile(29,6,26,4,'#daccff');
  break;
 case 'missile':
  mechTile(22,-14,23,28,weapon.color);
  for(const dy of [-9,6])mechTile(43,dy,12,6,'#232d41');
  break;
 case 'burst':
  mechTile(23,-10,32,7,weapon.color);
  mechTile(23,4,32,7,weapon.color);
  break;
 case 'micro':
  mechTile(23,-4,40,8,weapon.color);
  mechTile(39,-8,7,16,'#8bcfe8');
  break;
 case 'slug':
  mechTile(23,-11,29,22,weapon.color);
  mechTile(51,-8,9,16,'#f6dbfd');
  break;
 default:
  mechTile(23,-6,34,12,weapon.color);
  mechTile(54,-4,6,8,'#daffff');
 }
 if(o.status?.burn>0){
  mechTile(-14,-31,8,9,'#ff8d5a');
  mechTile(-7,-35,6,9,'#ffcf6b');
 }
 if(o.status?.stun>0){
  mechTile(-28,-33,8,7,'#fff5a0');
  mechTile(17,-31,9,7,'#fff5a0');
 }
 ctx.restore();

 // HP bars remain geometric and do not introduce combat labels.
 if(state==='fight'){
  const barWidth=64;
  mechTile(o.x-barWidth/2,o.y-44,barWidth,8,'#061320');
  mechTile(o.x-barWidth/2+1,o.y-43,
    Math.max(0,(barWidth-2)*clamp(o.hp/o.maxHp,0,1)),6,
    o.enemy?'#e78290':'#72eddf');
  mechTile(o.x-barWidth/2,o.y-44,barWidth,2,'#b6c9d9');
 }
}

function renderPixelFrame(){
 if(!PIXEL_RENDER_MODE.enabled)return;
 const density=Math.max(1,window.devicePixelRatio||1);
 // About three CSS pixels per logical pixel, including high DPI screens.
 const step=Math.max(3,Math.round(PIXEL_RENDER_MODE.cssBlockSize*density));
 const width=Math.max(60,Math.ceil(canvas.width/step));
 const height=Math.max(70,Math.ceil(canvas.height/step));
 if(MECH_PIXELS.width!==width||MECH_PIXELS.height!==height){
  MECH_PIXELS.width=width;
  MECH_PIXELS.height=height;
 }
 MECH_PIXELS_CTX.setTransform(1,0,0,1,0,0);
 MECH_PIXELS_CTX.imageSmoothingEnabled=true;
 MECH_PIXELS_CTX.drawImage(canvas,0,0,width,height);
 ctx.setTransform(1,0,0,1,0,0);
 ctx.imageSmoothingEnabled=false;
 ctx.drawImage(MECH_PIXELS,0,0,canvas.width,canvas.height);
 ctx.imageSmoothingEnabled=true;
}
