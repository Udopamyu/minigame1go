/* Hand-authored pixel masks for all 28 equipped parts, not a mosaic filter.
   The same part shapes apply to player and enemies; hostile tint is subtle. */
const PIXEL_RENDER_MODE={enabled:true,cssBlockSize:3};
const MECH_PIXELS=document.createElement('canvas');
const PIXEL_SPRITES={
 armor:{
  mesh:[
   '..PPPPPPPP....','.P12222221P...','P1121111121P..','P1111111111P..',
   'P1222211221P..','P1111111111P..','P1121111121P..','.P12222221P...',
   '..PPPPPPPP....'],
  plated:[
   '...PPPPPP....','PPPP2222PPPP.','P1112222111P.','P1121111211P.',
   'P1122222211P.','P1111221111P.','P1122222211P.','PPPP2222PPPP.',
   '...PPPPPP....'],
  fortress:[
   '.PPPPPPPPPPPPPP.','PP111222222111PP','P11111111111111P','P12211111111221P',
   'P12212222112221P','P12211111111221P','P11111111111111P','PP111222222111PP',
   '.PPPPPPPPPPPPPP.'],
  reactive:[
   '...PPPPPP.....','PPPP2222PPPP..','P1112222111PP.','PP1121111211P.',
   '.P112222211PP.','PP1121111211P.','P1112222111PP.','PPPP2222PPPP..',
   '...PPPPPP.....'],
  composite:[
   '..PPPPPPPPPP..','PPP2111122PPP.','P11111111111P.','P1222PP22211P.',
   'P11221122111P.','P11112211111P.','P1222PP22211P.','PPP2111122PPP.',
   '..PPPPPPPPPP..'],
  feather:[
   '....PPPPP......','..PP22122PP....','.PP1111111PP...','PP211111112PP..',
   '.P121111121P...','.P121111121P...','..PP21112PP....','....PPPPP......',
   '.....PPP.......'],
  prism:[
   '....PPPPPP....','..PP221122PP..','PPP1111111PPP.','P12211111122P.',
   'P11112211111P.','P12211111122P.','PPP1111111PPP.','..PP221122PP..',
   '....PPPPPP....']
 },
 legs:{
  wheel:['.PP.PP.PP.','P11111111P','P22P22P22P','P11111111P','.PP.PP.PP.'],
  booster:['...P11P...','.PP1221PP.','P11122111P','PP22PP22PP','..3P..P3..'],
  tank:['PPPPPPPPPP','P11111111P','P2P2P2P2P','P11111111P','PPPPPPPPPP'],
  spider:['P...P...P.','PP..P..PP.','.P11111P..','PP..P..PP.','P...P...P.'],
  jet:['....PP....','.PP1221PP.','P11111111P','PP311113PP','..33..33..'],
  crawler:['PPPPPPPPPP','P11111111P','P22222222P','P1P1P1P1P','P11111111P','PPPPPPPPPP'],
  ranger:['..PP..PP..','.P111111P.','P11222111P','.PP1111PP.','..PP..PP..']
 },
 weapon:{
  pulse:['..PPP.....','.P111PP...','PP112221PP','P11111111P','PP112221PP','.P111PP...','..PPP.....'],
  shot:['..PPPPPP..','PP1111PPPP','P111PP111P','PP1111PPPP','..P11111PP','PP1111PPPP','P111PP111P','PP1111PPPP'],
  rail:['...PPPPPPP....','PPPP111111PPPP','P222222222222P','P111111111111P','PPPP111111PPPP','...PPPPPPP....'],
  missile:['..PPPPPPP..','PP1111111PP','P111PPPP111P','P113PPPP311P','P111PPPP111P','PP1111111PP','..PPPPPPP..'],
  micro:['..PPPPP.......','PP1111PPPPP...','P1111111111PP.','P22222222222P.','P1111111111PP.','PP1111PPPPP...','..PPPPP.......'],
  burst:['.PPPPPP....','P11111PPPP.','P11111111PP','PP11111111P','P11111111PP','P11111PPPP.','.PPPPPP....'],
  slug:['..PPPPPPP..','.P1111111P.','PP1122211PP','P111111111P','PP1122211PP','.P1111111P.','..PPPPPPP..']
 },
 core:{
  spark:['.P2P.','P232P','23P32','P232P','.P2P.'],
  blaze:['.3P3.','32223','P232P','32223','.3P3.'],
  rapid:['P3P3P','32P23','P232P','32P23','P3P3P'],
  repair:['.P3P.','P333P','33333','P333P','.P3P.'],
  capacitor:['PPPPP','P333P','P323P','P333P','PPPPP'],
  aegis:['.PPP.','P232P','P333P','P232P','.PPP.'],
  salvager:['3P3P3','P323P','33233','P323P','3P3P3']
 }
};
function mechTile(x,y,w,h,color){
 ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));
}
function hostileShade(c,isEnemy){
 if(!isEnemy||!/^#[\da-f]{6}$/i.test(c))return c;
 const hex=c.slice(1),rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
 return '#'+[Math.min(255,Math.round(rgb[0]*.87+232*.13)),Math.round(rgb[1]*.91+86*.09),Math.round(rgb[2]*.9+106*.1)]
  .map(v=>v.toString(16).padStart(2,'0')).join('');
}
function paintMask(mask,x,y,pixel,colors){
 if(!mask)return;
 for(let j=0;j<mask.length;j++){
  const row=mask[j];
  for(let i=0;i<row.length;i++){
   const tone=colors[row[i]];if(!tone)continue;
   mechTile(x+i*pixel,y+j*pixel,pixel,pixel,tone);
  }
 }
}
function drawMechEquipment(o){
 if(!o)return;
 const defs=o.stats,load=o.load,blink=o.hitFlash>0;
 const armorColor=blink?'#ffffff':hostileShade(defs.armor.color,o.enemy);
 const weaponColor=hostileShade(defs.weapon.color,o.enemy);
 const legColor=hostileShade(defs.legs.color,o.enemy);
 const coreColor=hostileShade(defs.core.color,o.enemy);
 const trim=o.enemy?'#e2a5a5':'#94e5e1';
 const colors=(primary,detail)=>({P:'#111c2c',1:primary,2:'#e1edf0',3:detail||trim,4:'#253a4c'});
 const boss=o.enemy&&currentNode==='boss',elite=o.enemy&&currentNode==='elite';
 ctx.save();ctx.translate(Math.round(o.x),Math.round(o.y));
 // A rectilinear ground shadow, before rotation.
 mechTile(-34,25,76,8,'#030b15a0');
 if(o.dashLeft>0){
  const shift=Math.floor(clock*11)%4;
  for(let i=0;i<4;i++)mechTile(-38-i*7+shift,-8,5,12,'#74f4e0');
 }
 ctx.rotate(o.angle);
 if(boss)ctx.scale(1.18,1.18);
 if(boss||elite){
  const color=boss?'#eac17c':'#c4b0fa';
  mechTile(-43,-42,20,5,color);mechTile(-43,-42,5,17,color);
  mechTile(32,34,16,5,color);mechTile(43,24,5,15,color);
 }
 const leg=PIXEL_SPRITES.legs[load.legs.id]||PIXEL_SPRITES.legs.wheel;
 paintMask(leg,-34,-35,4,colors(legColor,trim));
 ctx.save();ctx.scale(1,-1);paintMask(leg,-34,-35,4,colors(legColor,trim));ctx.restore();
 // Segmented mechanical hardpoints allow both armor and leg upgrades to change outline.
 mechTile(-31,-15,15,30,'#172c3d');
 mechTile(20,-14,14,28,'#172c3d');
 const body=PIXEL_SPRITES.armor[load.armor.id]||PIXEL_SPRITES.armor.mesh;
 const bodyWidth=Math.max(...body.map(r=>r.length))*4;
 paintMask(body,-Math.floor(bodyWidth/2),-18,4,colors(armorColor,trim));
 // Core sprite is embedded within the body, rather than a universal circular marker.
 const core=PIXEL_SPRITES.core[load.core.id]||PIXEL_SPRITES.core.spark;
 const pulse=(Math.floor(clock*8)%2===0)?'#f5ffe0':'#a9dcca';
 paintMask(core,-9,-10,4,{P:'#13293b',2:pulse,3:coreColor});
 const gun=PIXEL_SPRITES.weapon[load.weapon.id]||PIXEL_SPRITES.weapon.pulse;
 paintMask(gun,18,-Math.floor(gun.length*4/2),4,colors(weaponColor,trim));
 if(load.weapon.id==='rail')mechTile(69,-3,9,6,'#f0d6ff');
 if(load.weapon.id==='missile')for(const y of [-11,5])mechTile(59,y,11,6,'#e9bf89');
 if(load.weapon.id==='shot')for(const y of [-15,-3,9])mechTile(61,y,9,5,'#ffd08a');
 if(load.legs.id==='booster'||load.legs.id==='jet'){
  const thrust=Math.floor(clock*11)%2===0;
  for(const y of [-23,19])mechTile(-46,y,thrust?15:8,7,'#f5b875');
 }
 if(o.status?.burn>0){mechTile(-12,-35,8,12,'#fa9165');mechTile(-4,-38,5,8,'#fcd287')}
 if(o.status?.stun>0){mechTile(-23,-34,8,6,'#f7ee98');mechTile(18,-31,9,6,'#f7ee98')}
 ctx.restore();
 if(state==='fight'){
  mechTile(o.x-32,o.y-52,64,8,'#051222');
  mechTile(o.x-31,o.y-51,Math.max(0,62*clamp(o.hp/o.maxHp,0,1)),6,
   o.enemy?'#ef9293':'#76e8d6');
 }
}
/* Render directly at a deliberately low framebuffer resolution. The browser
   enlarges source pixels with nearest-neighbor scaling: no post blur/mosaic. */
function renderPixelFrame(){
 if(!PIXEL_RENDER_MODE.enabled)return;
 if(MECH_PIXELS.width!==canvas.width||MECH_PIXELS.height!==canvas.height){
  MECH_PIXELS.width=canvas.width;MECH_PIXELS.height=canvas.height;
 }
 ctx.imageSmoothingEnabled=false;
}
