// ============================================================================
// PATROL × ROBO SALVAGE — HOVER COMBAT v0.6 / BATTLE3D
// One combat module replaces the v0.1–v0.5 override layers (TPS / hybrid /
// free-flight / lab / v05). Progression (hangar, route, loot, shop, SP) is the
// unchanged Robo Salvage core above this file.
//   b3-world.js  : settings, math, terrain + obstacles (single source of truth),
//                  collision, line of sight
//   b3-render.js : WebGL2 renderer, mech models, effects, HUD
//   b3-game.js   : input → movement physics → enemy AI → camera → shooting →
//                  projectiles → finisher → integration with the core game
// ============================================================================
const B3_VERSION='0.6.1';
// The core 2D combat loop (kept as the no-WebGL2 fallback) still checks these.
let flightMode=false;const flightBulletStep=()=>{},flightHits=()=>false;
const B3_TUNE_KEY='patrolSalvageHoverTuneV061';
// Tuning defaults = the values the user defined on 2026-11-18 (hover-lab JSON).
// Every value is live-editable from the tuning panel (T / ⚙).
const B3_DEFAULT=Object.freeze({
 moveSpeed:1.5,moveResponse:9,stopResponse:21,verticalSpeed:230,climbDeadzone:.14,dashPower:1.5,
 lookSpeed:1.75,lookPitchSpeed:1.5,mouseSensitivity:1.5,invertY:false,
 camDistance:235,playerScreenY:.7,fovNear:68,fovFar:44,followSpeed:2,
 enemyTracking:true,trackSpeed:14,trackBox:.35,manualReturn:.9,modelScale:1,
 autoFire:true,aimTolerance:.035,renderScale:1.5,autoQuality:false,
 weapon:'pulse',biome:0
});
const B3_FIELDS=[
 ['移動',[
  ['moveSpeed','移動速度の倍率',.5,3,.05,'×'],['moveResponse','加速の応答',1,30,.5,''],
  ['stopResponse','手を離した時の停止の速さ',1,40,.5,''],['verticalSpeed','上昇・下降の速さ',60,450,5,''],
  ['climbDeadzone','視線で上昇する角度のあそび',0,.4,.01,'rad'],['dashPower','ダッシュの強さ',.5,2.5,.05,'×']]],
 ['カメラ',[
  ['camDistance','自機からカメラまでの距離',100,500,5,''],['playerScreenY','自機の画面上の高さ（下ほど大）',.54,.84,.01,''],
  ['fovNear','視野角（敵が近い時）',35,110,1,'°'],['fovFar','視野角（敵が遠い時）',26,105,1,'°'],
  ['followSpeed','カメラ追従の速さ',.5,25,.5,''],['enemyTracking','敵を自動で追うカメラ','bool'],
  ['trackSpeed','敵へ向き直る速さ',1,30,.5,''],['trackBox','追従のあそび（画面比）',0,.5,.01,''],
  ['manualReturn','右スティックを離してから戻るまで',0,2,.05,'秒'],
  ['lookSpeed','右スティック左右',.25,4,.05,'×'],['lookPitchSpeed','右スティック上下',.25,3,.05,'×'],
  ['mouseSensitivity','マウス感度',.25,3,.05,'×'],['invertY','上下操作の反転','bool'],['modelScale','機体の表示倍率',.5,1.5,.025,'×']]],
 ['射撃・表示',[
  ['autoFire','自動射撃','bool'],['aimTolerance','中央照準の判定半径（画面比）',.015,.12,.001,''],
  ['renderScale','3D描画の解像度（画面の何倍か）',.5,2,.05,'×'],['autoQuality','重い時に自動で解像度を下げる','bool'],
  ['weapon','試験用の武器','weapon'],['biome','試験用のフィールド','biome']]]
];
const B3={tune:{...B3_DEFAULT}};
try{const s=JSON.parse(localStorage.getItem(B3_TUNE_KEY)||'null');
 if(s&&typeof s==='object')for(const k of Object.keys(B3_DEFAULT))if(typeof s[k]===typeof B3_DEFAULT[k])B3.tune[k]=s[k];}catch(_e){}
function b3SaveTune(){try{localStorage.setItem(B3_TUNE_KEY,JSON.stringify(B3.tune))}catch(_e){}}

// ---------------------------------------------------------------- math ----
const b3Mix=(a,b,t)=>a+(b-a)*t;
const b3Smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const b3Wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const b3Damp=(k,dt)=>1-Math.exp(-k*dt);
function b3Hash(x,y,s=0){let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(s|0,2246822519);
 h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967296;}
function b3Noise(x,y,s=0){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
 const a=b3Hash(ix,iy,s),b=b3Hash(ix+1,iy,s),c=b3Hash(ix,iy+1,s),d=b3Hash(ix+1,iy+1,s);
 return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
function b3Fbm(x,y,s=0,oct=4){let a=.5,f=1,t=0,n=0;for(let i=0;i<oct;i++){t+=a*b3Noise(x*f,y*f,s+i*17);n+=a;a*=.5;f*=2.03;}return t/n;}
function b3Ridge(x,y,s=0,oct=4){let a=.5,f=1,t=0,n=0;for(let i=0;i<oct;i++){const v=1-Math.abs(b3Noise(x*f,y*f,s+i*29)*2-1);t+=a*v*v;n+=a;a*=.5;f*=2.1;}return t/n;}
function b3Rng(seed){let s=(seed>>>0)||1;return ()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296;};}
const b3Hex=s=>{const h=(s||'#888888').replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255)};

// --------------------------------------------------------------- biomes ---
// Each field changes the terrain topology and the cover, not just the palette.
const B3_SUN=[.48,.42,1];
const B3_BIOMES=[
 {id:'waste',name:'赤錆の荒野',sky:['#26394b','#b77b72','#ffcd99'],ground:['#906655','#ba8266','#dea17a'],rock:'#955c50',accent:'#e8aa78',sunColor:'#fff1c3',fogDensity:.00026},
 {id:'desert',name:'砂海の観測所',sky:['#44647d','#c9b59f','#ffdf9e'],ground:['#b18755','#d5a665','#efd194'],rock:'#aa714e',accent:'#f6cc89',sunColor:'#fff6ca',fogDensity:.00024},
 {id:'snow',name:'白嶺の峡谷',sky:['#254369','#75a9c5','#dcebe9'],ground:['#6e8fa3','#aec9d0','#eff4e8'],rock:'#849aa8',accent:'#e6f1ea',sunColor:'#fff8d8',fogDensity:.00026},
 {id:'mountain',name:'風切の尾根',sky:['#294754','#7a9892','#e1c9a0'],ground:['#536956','#829073','#abb08c'],rock:'#666d61',accent:'#b9b49c',sunColor:'#fff0b4',fogDensity:.00026},
 {id:'city',name:'高架都市',sky:['#343349','#966f83','#efa98e'],ground:['#454c58','#5d6370','#75767a'],rock:'#566371',accent:'#98d7dd',sunColor:'#ffdfb3',fogDensity:.00028},
 {id:'river',name:'碧流の水門',sky:['#345766','#8bbbb6','#efe0b7'],ground:['#507e77','#85a895','#b2bc96'],rock:'#687d75',accent:'#aed6cd',sunColor:'#fff4ce',fogDensity:.00025},
 {id:'arena',name:'環状競技場',sky:['#17263b','#364a65','#a2adb2'],ground:['#384b55','#495c63','#64757a'],rock:'#4b5d6c',accent:'#f5bc70',sunColor:'#ece6db',fogDensity:.00026},
 {id:'night',name:'夜間精錬区',sky:['#0c1429','#263044','#745463'],ground:['#273441','#394852','#55616a'],rock:'#354453',accent:'#ff9e5b',sunColor:'#e5eddc',fogDensity:.00032}
];
const b3HexOf=c=>'#'+c.map(v=>Math.round(clamp(v,0,1)*255).toString(16).padStart(2,'0')).join('');
const b3ShadeHex=(h,k)=>b3HexOf(b3Hex(h).map(v=>v*k));
const b3MixHex=(a,b,t)=>{const A=b3Hex(a),B=b3Hex(b);return b3HexOf(A.map((v,i)=>v+(B[i]-v)*t));};

// ---------------------------------------------------------------- world ---
// W3 is rebuilt at the start of every battle. Rendering and collision both
// read W3.hgt (terrain) and W3.obs (solid obstacles): there is no second,
// decorative terrain anywhere in the scene.
const W3={radius:1500,cell:32,extent:2080,n:0,hgt:null,obs:[],biome:B3_BIOMES[0],biomeIndex:0,seed:1,
 water:null,spawnP:{x:-560,z:0},spawnE:{x:420,z:0},version:0,decor:[]};
function b3Ground(x,z){
 if(!W3.hgt)return 0;
 const c=W3.cell,n=W3.n,e=W3.extent;
 let gx=(x+e)/c,gz=(z+e)/c;gx=clamp(gx,0,n-1e-4);gz=clamp(gz,0,n-1e-4);
 const i=Math.floor(gx),j=Math.floor(gz),fx=gx-i,fz=gz-j,s=n+1,H=W3.hgt;
 const h00=H[i*s+j],h10=H[(i+1)*s+j],h01=H[i*s+j+1],h11=H[(i+1)*s+j+1];
 // Same diagonal split as the rendered triangles: (00,10,01) and (10,11,01).
 return fx+fz<1?h00+(h10-h00)*fx+(h01-h00)*fz:h11+(h01-h11)*(1-fx)+(h10-h11)*(1-fz);
}
function b3GroundNormal(x,z){const k=6,a=b3Ground(x-k,z),b=b3Ground(x+k,z),c=b3Ground(x,z-k),d=b3Ground(x,z+k);
 const nx=a-b,ny=2*k,nz=c-d,l=Math.hypot(nx,ny,nz)||1;return [nx/l,ny/l,nz/l];}

// Raw (generation-time) terrain shape for each field.
function b3RawHeight(bi,x,z,seed){
 const d=Math.hypot(x,z),R=W3.radius;
 const rim=b3Smooth(R-140,R+420,d);
 const rimNoise=.55+.9*b3Fbm(x*.0016,z*.0016,seed+5,3);
 let h=0;
 switch(bi.id){
  case 'waste':{ // rolling badlands + a dry wash crossing the arena
   h=38*b3Fbm(x*.0018,z*.0018,seed,4)-14;
   const wash=Math.abs(z-180*Math.sin(x*.0021+seed))-90;h-=26*(1-b3Smooth(0,90,wash));
   h+=rim*360*rimNoise;break;}
  case 'desert':{ // long dune crests: real terrain cover that blocks shots
   const wx=x+60*Math.sin(z*.004+seed),crest=Math.pow(.5+.5*Math.sin(wx*.0062+z*.0021),2.4);
   h=70*crest+22*b3Fbm(x*.003,z*.003,seed,3)-18;
   h*=.55+.45*b3Smooth(160,520,Math.hypot(x-W3.spawnP.x,z)) ;
   h+=rim*300*rimNoise;break;}
  case 'snow':{ // canyon: the arena is a valley between two mountain walls
   const valley=Math.abs(z+120*Math.sin(x*.0017+seed))/560;
   const wall=b3Smooth(.45,1.25,valley);
   h=10+22*b3Fbm(x*.003,z*.003,seed,3)+wall*(250+180*b3Ridge(x*.0019,z*.0019,seed+3,4));
   // side gullies cut into the walls
   h-=wall*70*Math.pow(.5+.5*Math.sin(x*.009+seed*3),6);
   h+=rim*420*rimNoise;break;}
  case 'mountain':{ // ridges and valleys alternating across the arena
   const r=b3Ridge(x*.0021,z*.0021,seed,5);
   h=r*240-60;h=Math.max(h,12*b3Fbm(x*.004,z*.004,seed+9,2));
   h*=.35+.65*b3Smooth(140,620,Math.min(Math.hypot(x-W3.spawnP.x,z-W3.spawnP.z),Math.hypot(x-W3.spawnE.x,z-W3.spawnE.z)));
   h+=rim*420*rimNoise;break;}
  case 'city':{h=3*b3Fbm(x*.004,z*.004,seed,2)+rim*240*rimNoise;break;}
  case 'river':{ // a winding river channel with banks
   const cz=230*Math.sin(x*.0022+seed)+90*Math.sin(x*.0051+seed*2);
   const dd=Math.abs(z-cz);
   h=18+26*b3Fbm(x*.0025,z*.0025,seed,4);
   h-=58*(1-b3Smooth(80,240,dd));
   h+=rim*330*rimNoise;break;}
  case 'arena':{ // stadium floor with a raised central platform and tiers
   const c=b3Smooth(260,170,d);h=2+46*c;
   h+=b3Smooth(R-260,R-120,d)*36+b3Smooth(R-120,R+40,d)*120+rim*160;break;}
  case 'night':{ // industrial yard on two terraces
   h=4*b3Fbm(x*.004,z*.004,seed,2)+30*b3Smooth(-80,80,z+.35*x-260);
   h+=rim*260*rimNoise;break;}
 }
 return h;
}

// Obstacles: boxes (oriented) and frustums (cylinders with optional taper).
function b3Box(x,z,w,d,y0,y1,yaw,color,opt={}){return Object.assign({t:'box',x,z,hw:w/2,hd:d/2,y0,y1,yaw:yaw||0,c:Math.cos(yaw||0),s:Math.sin(yaw||0),color,br:Math.hypot(w,d)/2},opt);}
function b3Cyl(x,z,r0,r1,y0,y1,color,opt={}){return Object.assign({t:'cyl',x,z,r0,r1,y0,y1,color,br:Math.max(r0,r1),sides:opt.sides||10},opt);}

function b3Generate(fieldIndex,seed){
 const bi=B3_BIOMES[((fieldIndex%B3_BIOMES.length)+B3_BIOMES.length)%B3_BIOMES.length];
 W3.biome=bi;W3.biomeIndex=B3_BIOMES.indexOf(bi);W3.seed=seed;W3.obs=[];W3.water=null;W3.decor=[];W3.version++;
 const rnd=b3Rng(seed*7919+W3.biomeIndex*104729+13);
 W3.spawnP={x:-560,z:0};W3.spawnE={x:440,z:(rnd()-.5)*260};
 if(bi.id==='snow'){W3.spawnP.z=-120*Math.sin(-560*.0017+seed);W3.spawnE.z=-120*Math.sin(440*.0017+seed);}
 if(bi.id==='river'){W3.spawnP.z=230*Math.sin(-560*.0022+seed)+90*Math.sin(-560*.0051+seed*2)+260;W3.spawnE.z=W3.spawnP.z-520;}
 // Heightfield grid (shared by rendering and every collision query).
 const c=W3.cell,e=W3.extent,n=Math.ceil(2*e/c);W3.n=n;
 const s=n+1,H=new Float32Array(s*s);
 for(let i=0;i<=n;i++)for(let j=0;j<=n;j++)H[i*s+j]=b3RawHeight(bi,-e+i*c,-e+j*c,seed%1000);
 W3.hgt=H;
 const obs=W3.obs,g=(x,z)=>b3Ground(x,z),R=bi.rock,T=bi.accent,RAD=W3.radius;
 const clearOf=(x,z,r)=>Math.hypot(x-W3.spawnP.x,z-W3.spawnP.z)>r+110&&Math.hypot(x-W3.spawnE.x,z-W3.spawnE.z)>r+110;
 const freeSpot=(x,z,r)=>clearOf(x,z,r)&&Math.hypot(x,z)<RAD-r-60&&!obs.some(o=>Math.hypot(o.x-x,o.z-z)<o.br+r+38);
 const scatter=(count,maker,minR=0,maxR=RAD-80,tries=40)=>{for(let k=0;k<count;k++)for(let t=0;t<tries;t++){
  const a=rnd()*Math.PI*2,rr=minR+(maxR-minR)*Math.sqrt(rnd()),x=Math.cos(a)*rr,z=Math.sin(a)*rr;const o=maker(x,z);
  if(o&&freeSpot(x,z,o.br)){obs.push(o);if(o.extra)for(const q of o.extra)obs.push(q);delete o.extra;break;}}};
 switch(bi.id){
  case 'waste':
   scatter(9,(x,z)=>{const r=70+rnd()*80,h=110+rnd()*150,b=g(x,z)-20;return b3Cyl(x,z,r,r*.78,b,b+h,R,{mat:'mesa',sides:9,band:b3MixHex(R,T,.35),cap:b3MixHex(R,T,.55)})},180);
   scatter(16,(x,z)=>{const r=18+rnd()*26,b=g(x,z)-8;return b3Cyl(x,z,r,r*.55,b,b+r*1.5+10,b3ShadeHex(R,.85),{mat:'rock',sides:7})},120);
   break;
  case 'desert':
   scatter(7,(x,z)=>{const r=34+rnd()*30,h=150+rnd()*170,b=g(x,z)-25;return b3Cyl(x,z,r,r*.35,b,b+h,R,{mat:'spire',sides:7,band:b3MixHex(R,T,.3)})},160);
   scatter(6,(x,z)=>{const L=150+rnd()*170,yaw=rnd()*Math.PI,b=g(x,z)-10;return b3Box(x,z,L,22,b,b+70+rnd()*40,yaw,b3MixHex(R,T,.45),{mat:'ruin'})},150);
   break;
  case 'snow':
   scatter(10,(x,z)=>{if(b3Ground(x,z)>120)return null;const r=22+rnd()*20,h=90+rnd()*130,b=g(x,z)-10;return b3Cyl(x,z,r,r*.25,b,b+h,'#bfe0ea',{mat:'ice',sides:6})},100,1300);
   scatter(9,(x,z)=>{if(b3Ground(x,z)>110)return null;const r=40+rnd()*40,b=g(x,z)-14;return b3Cyl(x,z,r,r*.6,b,b+r*1.3,b3ShadeHex(R,.9),{mat:'rock',sides:8,cap:'#eef6f8'})},100,1300);
   break;
  case 'mountain':
   scatter(12,(x,z)=>{const r=45+rnd()*55,h=90+rnd()*120,b=g(x,z)-24;return b3Cyl(x,z,r,r*.45,b,b+h,R,{mat:'crag',sides:7,cap:b3MixHex(R,bi.ground[2],.5)})},150);
   break;
  case 'city':{
   // Street grid with tall blocks, a plaza, and an elevated highway that
   // can be flown under or over (deck and pillars are all solid).
   const blk=230;
   for(let ix=-6;ix<=6;ix++)for(let iz=-6;iz<=6;iz++){
    const cx=ix*blk+(rnd()-.5)*30,cz=iz*blk+(rnd()-.5)*30;
    if(Math.hypot(cx,cz)>RAD-120||Math.abs(iz*blk-0)<40||!clearOf(cx,cz,95))continue;
    if(rnd()<.26)continue;
    const w=90+rnd()*70,d=90+rnd()*70,h=70+Math.pow(rnd(),1.6)*300,b=g(cx,cz)-6;
    obs.push(b3Box(cx,cz,w,d,b,b+h,0,[R,b3ShadeHex(R,.85),b3ShadeHex(R,1.15),b3MixHex(R,'#7a7484',.5)][Math.floor(rnd()*4)],{mat:'tower',windows:true}));
   }
   const hz=-300,hy=110;
   obs.push(b3Box(0,hz,2*W3.radius-260,64,hy,hy+16,0,b3ShadeHex(R,1.2),{mat:'deck'}));
   for(let x=-W3.radius+200;x<=W3.radius-200;x+=230)obs.push(b3Box(x,hz,22,22,g(x,hz)-5,hy,0,b3ShadeHex(R,.8),{mat:'pillar'}));
   for(let i=W3.obs.length-1;i>=0;i--){const o=W3.obs[i];if(o.mat==='tower'&&Math.abs(o.z-hz)<o.hd+50)W3.obs.splice(i,1);}
   break;}
  case 'river':{
   const cz=x=>230*Math.sin(x*.0022+seed%1000)+90*Math.sin(x*.0051+(seed%1000)*2);
   W3.water={y:-20,color:'#3f8fa3'};
   for(const bx of [-700,40,760]){const z0=cz(bx),slope=(cz(bx+5)-cz(bx-5))/10,yaw=Math.atan(slope)+Math.PI/2;
    const deck=g(bx,z0+200)+4,dy=deck+46;
    obs.push(b3Box(bx,z0,420,58,dy,dy+12,yaw,b3ShadeHex(R,1.25),{mat:'bridge'}));
    for(const k of [-1,1])obs.push(b3Box(bx+Math.cos(yaw)*k*110,z0+Math.sin(yaw)*k*110,20,46,-40,dy,yaw,b3ShadeHex(R,.85),{mat:'pillar'}));}
   scatter(14,(x,z)=>{if(Math.abs(z-cz(x))<200)return null;const r=26+rnd()*30,b=g(x,z)-12;return b3Cyl(x,z,r,r*.6,b,b+r*1.6+20,R,{mat:'rock',sides:8,cap:b3MixHex(R,bi.ground[2],.4)})},120);
   scatter(8,(x,z)=>{if(Math.abs(z-cz(x))<210)return null;const b=g(x,z)-6;return b3Cyl(x,z,10,4,b,b+150+rnd()*80,b3ShadeHex(R,.7),{mat:'pylon',sides:6,glow:T})},200);
   break;}
  case 'arena':{
   // Stadium: ring of stands marks the boundary; symmetric cover inside.
   const ringR=RAD-60;
   for(let i=0;i<40;i++){const a=i/40*Math.PI*2,x=Math.cos(a)*ringR,z=Math.sin(a)*ringR;
    obs.push(b3Box(x,z,250,80,g(x,z)-10,g(x,z)+120,a+Math.PI/2,R,{mat:'stand',glow:T}));}
   for(let i=0;i<6;i++){const a=i/6*Math.PI*2+Math.PI/6,x=Math.cos(a)*560,z=Math.sin(a)*560;
    obs.push(b3Cyl(x,z,46,46,g(x,z)-6,g(x,z)+170,b3ShadeHex(R,1.15),{mat:'column',sides:12,glow:T}));}
   for(let i=0;i<4;i++){const a=i/4*Math.PI*2,x=Math.cos(a)*900,z=Math.sin(a)*900;
    obs.push(b3Box(x,z,260,26,g(x,z)-4,g(x,z)+64,a+Math.PI/2,b3ShadeHex(R,1.25),{mat:'barrier',glow:T}));}
   break;}
  case 'night':{
   scatter(9,(x,z)=>{const w=150+rnd()*120,d=100+rnd()*80,b=g(x,z)-6,h=70+rnd()*60;return b3Box(x,z,w,d,b,b+h,Math.floor(rnd()*4)*Math.PI/2,R,{mat:'hall',windows:true})},160);
   scatter(8,(x,z)=>{const r=44+rnd()*24,b=g(x,z)-4;return b3Cyl(x,z,r,r,b,b+90+rnd()*50,b3ShadeHex(R,1.15),{mat:'tank',sides:14,glow:T})},140);
   scatter(6,(x,z)=>{const b=g(x,z)-4;return b3Cyl(x,z,16,12,b,b+260+rnd()*90,b3ShadeHex(R,1.3),{mat:'stack',sides:10,glow:T})},140);
   break;}
 }
 // Precompute vertical bounds for quick rejection.
 for(const o of obs){o.top=o.y1;o.bot=o.y0;}
 // Make sure both spawn points are open and above the terrain.
 for(const sp of [W3.spawnP,W3.spawnE])for(let k=0;k<30&&!b3Free(sp.x,b3Ground(sp.x,sp.z)+40,sp.z,40);k++){sp.x+=(rnd()-.5)*120;sp.z+=(rnd()-.5)*120;}
 return W3;
}

// ------------------------------------------------------------ collision ---
// Point-in-obstacle (with padding).
function b3Inside(o,x,y,z,pad=0){
 if(y<o.y0-pad||y>o.y1+pad)return false;
 const dx=x-o.x,dz=z-o.z;
 if(dx*dx+dz*dz>(o.br+pad)*(o.br+pad)*2.1)return false;
 if(o.t==='box'){const lx=dx*o.c+dz*o.s,lz=-dx*o.s+dz*o.c;return Math.abs(lx)<o.hw+pad&&Math.abs(lz)<o.hd+pad;}
 const t=clamp((y-o.y0)/Math.max(1,o.y1-o.y0),0,1),r=o.r0+(o.r1-o.r0)*t;
 return dx*dx+dz*dz<(r+pad)*(r+pad);
}
function b3Free(x,y,z,r=20){
 if(y-r*.7<b3Ground(x,z))return false;
 if(Math.hypot(x,z)>W3.radius-r)return false;
 for(const o of W3.obs)if(b3Inside(o,x,y,z,r))return false;
 return true;
}
// Push a sphere out of the terrain, obstacles and arena boundary.
// Returns contact info for AI (blocked) and for landing on top surfaces.
function b3Resolve(p,r,clearance){
 let hit=false,ground=false;
 for(let iter=0;iter<2;iter++){
  for(const o of W3.obs){
   const dx=p.x-o.x,dz=p.z-o.z;
   if(Math.abs(dx)>o.br+r+4||Math.abs(dz)>o.br+r+4)continue;
   if(p.y-r>o.y1||p.y+r<o.y0)continue;
   if(o.t==='box'){
    const lx=dx*o.c+dz*o.s,lz=-dx*o.s+dz*o.c;
    const px=o.hw+r-Math.abs(lx),pz=o.hd+r-Math.abs(lz),py=o.y1+r*.8-p.y;
    if(px<=0||pz<=0)continue;
    hit=true;
    if(py>0&&py<Math.min(px,pz)&&p.y>o.y1-6){p.y=o.y1+r*.8;ground=true;continue;}
    let nx=0,nz=0;
    if(px<pz){nx=Math.sign(lx)||1;const m=px;const wx=nx*o.c,wz=nx*o.s;p.x+=wx*m;p.z+=wz*m;}
    else{nz=Math.sign(lz)||1;const m=pz;const wx=-nz*o.s,wz=nz*o.c;p.x+=wx*m;p.z+=wz*m;}
   }else{
    const t=clamp((p.y-o.y0)/Math.max(1,o.y1-o.y0),0,1),rr=o.r0+(o.r1-o.r0)*t+r;
    const d=Math.hypot(dx,dz);if(d>=rr)continue;
    hit=true;const py=o.y1+r*.8-p.y;
    if(p.y>o.y1-8&&py>0&&py<rr-d){p.y=o.y1+r*.8;ground=true;continue;}
    const k=(rr-d)/(d||1);p.x+=dx*k;p.z+=dz*k;if(!d)p.x+=rr;
   }
  }
  const d=Math.hypot(p.x,p.z),lim=W3.radius-r-8;
  if(d>lim){p.x*=lim/d;p.z*=lim/d;hit=true;}
 }
 const gy=b3Ground(p.x,p.z)+clearance;
 if(p.y<gy){p.y=gy;ground=true;}
 if(W3.water&&p.y<W3.water.y+clearance){p.y=W3.water.y+clearance;ground=true;}
 return {hit,ground};
}

// Segment vs world. Returns {t (0..1), kind, o, n} for the first hit or null.
function b3SegObstacle(o,ax,ay,az,bx,by,bz){
 const dx=bx-ax,dy=by-ay,dz=bz-az;
 if(o.t==='box'){
  // Slab test in the box's local frame.
  const lax=(ax-o.x)*o.c+(az-o.z)*o.s,laz=-(ax-o.x)*o.s+(az-o.z)*o.c;
  const ldx=dx*o.c+dz*o.s,ldz=-dx*o.s+dz*o.c;
  let t0=0,t1=1,axis=-1,sign=0;
  const slab=(p,d,mn,mx,ax_)=>{if(Math.abs(d)<1e-9)return p>=mn&&p<=mx;
   let ta=(mn-p)/d,tb=(mx-p)/d,s=-1;if(ta>tb){const q=ta;ta=tb;tb=q;s=1;}
   if(ta>t0){t0=ta;axis=ax_;sign=s;}if(tb<t1)t1=tb;return t0<=t1;};
  if(!slab(lax,ldx,-o.hw,o.hw,0)||!slab(ay,dy,o.y0,o.y1,1)||!slab(laz,ldz,-o.hd,o.hd,2))return null;
  if(t1<0||t0>1)return null;
  let n=[0,1,0];
  if(axis===0)n=[sign*o.c,0,sign*o.s];else if(axis===2)n=[-sign*o.s,0,sign*o.c];else if(axis===1)n=[0,sign,0];
  if(axis<0){n=[-dx,-dy,-dz];const l=Math.hypot(...n)||1;n=n.map(v=>v/l);} // started inside
  return {t:Math.max(0,t0),n};
 }
 // Frustum: clip to the bounding vertical cylinder then sample.
 const fx=ax-o.x,fz=az-o.z,A=dx*dx+dz*dz,B=2*(fx*dx+fz*dz),C=fx*fx+fz*fz-o.br*o.br;
 let ta=0,tb=1;
 if(A>1e-9){const D=B*B-4*A*C;if(D<0)return null;const q=Math.sqrt(D);ta=Math.max(0,(-B-q)/(2*A));tb=Math.min(1,(-B+q)/(2*A));if(ta>tb)return null;}
 else if(C>0)return null;
 const len=Math.sqrt(A+dy*dy)*(tb-ta),steps=Math.max(2,Math.ceil(len/5));
 for(let k=0;k<=steps;k++){const t=ta+(tb-ta)*k/steps,x=ax+dx*t,y=ay+dy*t,z=az+dz*t;
  if(b3Inside(o,x,y,z,0)){
   const tt=clamp((y-o.y0)/Math.max(1,o.y1-o.y0),0,1),rr=o.r0+(o.r1-o.r0)*tt;
   let n;if(y>o.y1-3)n=[0,1,0];else{const ex=x-o.x,ez=z-o.z,l=Math.hypot(ex,ez)||1;const slope=(o.r0-o.r1)/Math.max(1,o.y1-o.y0);const v=[ex/l,slope,ez/l],m=Math.hypot(...v);n=v.map(q=>q/m);}
   return {t,n};}
 }
 return null;
}
function b3Ray(ax,ay,az,bx,by,bz,opts={}){
 let best=null;
 const minX=Math.min(ax,bx),maxX=Math.max(ax,bx),minZ=Math.min(az,bz),maxZ=Math.max(az,bz),minY=Math.min(ay,by),maxY=Math.max(ay,by);
 if(!opts.ignoreObstacles)for(const o of W3.obs){
  if(o.x+o.br<minX||o.x-o.br>maxX||o.z+o.br<minZ||o.z-o.br>maxZ||o.y1<minY||o.y0>maxY)continue;
  const h=b3SegObstacle(o,ax,ay,az,bx,by,bz);
  if(h&&(!best||h.t<best.t))best={t:h.t,n:h.n,kind:'obstacle',o};
 }
 // Terrain march (cell-sized steps, then bisection).
 const dx=bx-ax,dy=by-ay,dz=bz-az,len=Math.hypot(dx,dy,dz),steps=Math.max(1,Math.ceil(len/14)),limit=best?best.t:1;
 let prev=0;
 for(let k=1;k<=steps;k++){
  const t=k/steps;if(t>limit+1/steps)break;
  const y=ay+dy*t,gy=b3Ground(ax+dx*t,az+dz*t);
  if(y<gy||(W3.water&&opts.water&&y<W3.water.y)){
   let lo=prev,hi=t;for(let q=0;q<6;q++){const m=(lo+hi)/2;if(ay+dy*m<b3Ground(ax+dx*m,az+dz*m))hi=m;else lo=m;}
   if(hi<limit||!best){best={t:hi,n:b3GroundNormal(ax+dx*hi,az+dz*hi),kind:'ground'};}
   break;
  }
  prev=t;
 }
 return best;
}
function b3Sight(a,b){
 const h=b3Ray(a.x,a.h+6,a.y,b.x,b.h+4,b.y);
 return !h;
}
