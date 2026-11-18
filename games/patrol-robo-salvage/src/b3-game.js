// ------------------------------------------------------------- state -----
const HOVER=40,MECH_R=20,HIT_R=25,CEIL_REL=330,CEIL_ABS=720,SHOT_SPEED=1.4;
const B3_RANGE={pulse:900,shot:560,rail:1350,missile:1200,micro:820,burst:920,slug:1000,boss:1300};
// Spread gun: five pellets in a dice-five pattern (centre + four corners), radians.
const SHOT_DICE=[[0,0],[-1,1],[1,1],[-1,-1],[1,-1]],SHOT_DICE_SPREAD=.075;
const BS={enemyRef:null,camYaw:0,camPitch:-.05,camRoll:0,manualUntil:-1,manualActive:false,fov:1,dist:118,
 lock:false,inReticle:false,los:false,inRange:false,reticleR:40,enemyScr:null,enemyScrR:0,firing:false,track:'none',
 parts:[],fx:[],debris:null,hitMark:0,dmgDirs:[],lockBeep:0,warnT:0,panelT:0,shake:0,fade:0,idleT:0,
 touch:{mx:0,my:0,lx:0,ly:0,fire:false,rise:false,desc:false},drag:null,lastFight:0,labSession:false,
 stats:{frames:0,fightTime:0,shotsP:0,shotsE:0,hitsP:0,hitsE:0,blocked:0}};
const b3Battle=()=>state==='fight'||state==='finisher'||state==='ready';
function b3FieldIndex(){return BS.labSession?B3.tune.biome:Math.max(0,depth)%B3_BIOMES.length;}

// ----------------------------------------------------------- particles ---
function b3Part(x,y,z,vx,vy,vz,life,size,col,alpha,add,drag=1.6,grav=0){
 if(BS.parts.length>1600)BS.parts.shift();
 BS.parts.push({x,y,z,vx,vy,vz,life,max:life,size,c:col,a:alpha,add,drag,grav});}
function b3Burst(p,col,n,speed,life,size,add=true,grav=0){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,e=Math.random()*2-1,s=speed*(.35+Math.random()*.65),q=Math.sqrt(1-e*e);
 b3Part(p[0],p[1],p[2],Math.cos(a)*q*s,e*s,Math.sin(a)*q*s,life*(.6+Math.random()*.6),size*(.6+Math.random()*.8),col,1,add,2.2,grav);}}
function b3Explosion(p,scale=1,col=[1,.62,.3]){
 b3Burst(p,[1,.9,.6],Math.round(10*scale),260*scale,.32,16*scale,true);
 b3Burst(p,col,Math.round(16*scale),190*scale,.6,24*scale,true);
 b3Burst(p,[1,.85,.5],Math.round(14*scale),420*scale,.5,4*scale,true,-380);
 for(let i=0;i<Math.round(8*scale);i++)b3Part(p[0]+(Math.random()-.5)*20*scale,p[1]+(Math.random()-.5)*14*scale,p[2]+(Math.random()-.5)*20*scale,(Math.random()-.5)*50,30+Math.random()*50,(Math.random()-.5)*50,1.4+Math.random(),26*scale,[.32,.3,.3],.55,false,1.2,0);
 BS.fx.push({k:'flash',p,t:0,life:.18,r:70*scale,c:col});
}
function b3Impact(p,n,kind,col){
 if(kind==='ground'){const g=W3.biome.ground[1],c=b3Hex(g);b3Burst(p,c,7,120,.6,9,false,-200);}
 b3Burst(p,col||[1,.85,.5],6,240,.25,3.5,true,-300);
 BS.fx.push({k:'flash',p,t:0,life:.08,r:16,c:col||[1,.8,.5]});
}

// --------------------------------------------------------- generation ---
function b3SetupFight(){
 BS.enemyRef=enemy;BS.lastFight++;try{document.activeElement&&document.activeElement.blur&&document.activeElement.blur();}catch(_e){}
 const field=b3FieldIndex(),seed=BS.forceSeed!=null?BS.forceSeed:(runSeed*131+depth*17+BS.lastFight*(BS.labSession?7:0)+7)>>>0;
 b3Generate(field,seed);
 if(R3.ok)b3BuildWorldMesh();
 const put=(o,sp,face)=>{o.x=sp.x;o.y=sp.z;o.h=b3Ground(sp.x,sp.z)+HOVER+(o.enemy?24:0);o.v3=[0,0,0];o.en=1;o.yaw=face;o.lean=0;o.bank=0;o.legSwing=0;o.gunPitch=0;o.dashT=0;
  const p={x:o.x,y:o.h,z:o.y};b3Resolve(p,MECH_R,HOVER);o.x=p.x;o.h=p.y;o.y=p.z;};
 const face=Math.atan2(W3.spawnE.z-W3.spawnP.z,W3.spawnE.x-W3.spawnP.x);
 put(player,W3.spawnP,face);put(enemy,W3.spawnE,face+Math.PI);
 enemy.ai={mode:'strafe',modeT:0,decideT:0,side:Math.random()<.5?-1:1,sideT:2+Math.random()*2,stuckT:0,lx:enemy.x,lz:enemy.y,checkT:0,
  cover:null,hideT:0,dodgeCD:1,noLos:0,altGoal:30,burst:0,aimErr:[0,0],errT:0};
 bullets.length=0;BS.parts.length=0;BS.fx.length=0;BS.debris=null;BS.dmgDirs.length=0;BS.fade=0;
 BS.camYaw=face;BS.camPitch=-.05;BS.manualUntil=-1;BS.dist=B3.tune.camDistance;BS.fov=B3.tune.fovNear*Math.PI/180;BS.camEye=null;
 BS.stats={frames:0,fightTime:0,shotsP:0,shotsE:0,hitsP:0,hitsE:0,blocked:0};
 b3PrepareModels();
}
function b3PrepareModels(){if(player)b3BuildMech(player.load,false);if(enemy)b3BuildMech(enemy.load,true);}

// ---------------------------------------------------------------- input --
function b3MoveInput(){
 const k=keys;let sx=(k.KeyD?1:0)-(k.KeyA?1:0)+BS.touch.mx,fw=(k.KeyW?1:0)-(k.KeyS?1:0)-BS.touch.my;
 const l=Math.hypot(sx,fw);if(l>1){sx/=l;fw/=l;}return {sx,fw,mag:Math.min(1,l)};
}
function b3LookInput(){
 const k=keys;let x=(k.ArrowRight?1:0)-(k.ArrowLeft?1:0)+BS.touch.lx,y=(k.ArrowUp?1:0)-(k.ArrowDown?1:0)-BS.touch.ly;
 if(B3.tune.invertY)y=-y;return {x:clamp(x,-1,1),y:clamp(y,-1,1)};
}
function b3ManualTrigger(){return !!(fireMouse||keys.KeyJ||keys.KeyK||keys.KeyF||BS.touch.fire);}

// --------------------------------------------------------- movement -------
function b3LegMods(o){const id=o.load.legs.id;return {rise:id==='jet'||id==='booster'?1.22:id==='tank'||id==='crawler'?.8:1,cost:id==='jet'||id==='booster'?.82:id==='tank'||id==='crawler'?1.25:1};}
function b3MovePlayer(dt){
 const o=player,t=B3.tune,inp=b3MoveInput(),yaw=BS.camYaw,lm=b3LegMods(o);
 const fx=Math.cos(yaw),fz=Math.sin(yaw),rx=-Math.sin(yaw),rz=Math.cos(yaw);
 const slow=o.status.slow>0?.66:1,stun=o.status.stun>0?.25:1;
 const speed=o.stats.speed*t.moveSpeed*slow*stun;
 let dvx=(fx*inp.fw+rx*inp.sx)*speed,dvz=(fz*inp.fw+rz*inp.sx)*speed,dvy=0;
 const rise=keys.Space||BS.touch.rise,desc=keys.KeyC||keys.ControlLeft||BS.touch.desc;
 const groundY=b3Ground(o.x,o.y),alt=o.h-groundY;
 if(rise&&o.en>0)dvy+=t.verticalSpeed*lm.rise;
 if(desc)dvy-=t.verticalSpeed;
 // Look up/down + push forward = climb/dive along the line of sight.
 const p=BS.camPitch-(BS.framePitch||0),dz=t.climbDeadzone;
 if(Math.abs(p)>dz&&Math.abs(inp.fw)>.05)dvy+=clamp(inp.fw*speed*1.25*Math.sin(Math.sign(p)*(Math.abs(p)-dz)),-t.verticalSpeed*1.2,t.verticalSpeed*1.2);
 const k=inp.mag>.05?t.moveResponse:t.stopResponse,kk=b3Damp(k,dt);
 if(o.dashT<=0){o.v3[0]+=(dvx-o.v3[0])*kk;o.v3[2]+=(dvz-o.v3[2])*kk;}
 else{o.v3[0]*=1-b3Damp(2.2,dt);o.v3[2]*=1-b3Damp(2.2,dt);}
 if(Math.abs(dvy)>1)o.v3[1]+=(dvy-o.v3[1])*b3Damp(7,dt);else o.v3[1]+=(0-o.v3[1])*b3Damp(9,dt);
 // Energy: rising, dashing and holding a high altitude cost EN; low hover recharges.
 if(rise&&o.en>0)o.en-=.30*lm.cost*dt;
 if(alt>HOVER+22)o.en-=.035*lm.cost*dt;
 if(o.en<=0){o.en=0;if(alt>HOVER+4)o.v3[1]=Math.min(o.v3[1],-110);}
 if(!rise&&alt<HOVER+22&&o.dashT<=0)o.en=Math.min(1,o.en+.32*dt);
 // Dash (Shift / »): burst in the stick direction, i-frames via dashLeft (core rule).
 o.dashT=Math.max(0,o.dashT-dt);o.dashCooldown=Math.max(0,o.dashCooldown-dt);o.dashLeft=Math.max(0,o.dashLeft-dt);
 if(wantsDash){wantsDash=false;
  if(o.dashCooldown<=0&&o.en>=.1&&o.status.stun<=0){
   let dx=fx*inp.fw+rx*inp.sx,dzz=fz*inp.fw+rz*inp.sx,l=Math.hypot(dx,dzz);if(l<.1){dx=fx;dzz=fz;l=1;}
   const v=(speed*2.6+300)*t.dashPower;o.v3[0]=dx/l*v;o.v3[2]=dzz/l*v;o.dashT=.24;o.dashLeft=o.load.legs.id==='jet'?.29:.18;
   o.dashCooldown=o.stats.dashCooldown;o.en=Math.max(0,o.en-.14);beep(790,.12,.022);
   const pose=b3Pose(o);for(const em of b3BuildMech(o.load,false).emit){const wp=b3MechWorldPoint(null,pose,em.p);b3Burst(wp,[.5,.95,1],4,160,.25,8,true);}
  }
 }
 b3Integrate(o,dt);
 // Facing: the mech turns its torso toward the opponent (or the camera heading).
 const want=enemy&&!enemy.dead?Math.atan2(enemy.y-o.y,enemy.x-o.x):yaw;
 o.yaw+=b3Wrap(want-o.yaw)*b3Damp(9,dt);
 b3Animate(o,dt);
}
function b3Integrate(o,dt){
 const p={x:o.x+o.v3[0]*dt,y:o.h+o.v3[1]*dt,z:o.y+o.v3[2]*dt};
 const ox=p.x,oz=p.z;
 const res=b3Resolve(p,MECH_R,HOVER);
 if(res.hit){const mx=p.x-ox,mz=p.z-oz,ml=Math.hypot(mx,mz);if(ml>.01){const nx=mx/ml,nz=mz/ml,vn=o.v3[0]*nx+o.v3[2]*nz;if(vn<0){o.v3[0]-=vn*nx;o.v3[2]-=vn*nz;}}}
 if(res.ground&&o.v3[1]<0)o.v3[1]=0;
 const g=b3Ground(p.x,p.z);
 if(p.y>g+CEIL_REL){p.y=g+CEIL_REL;o.v3[1]=Math.min(0,o.v3[1]);}
 if(p.y>CEIL_ABS){p.y=CEIL_ABS;o.v3[1]=Math.min(0,o.v3[1]);}
 o.blocked=res.hit;o.x=p.x;o.h=p.y;o.y=p.z;
}
function b3Animate(o,dt){
 const f=[Math.cos(o.yaw),Math.sin(o.yaw)],r=[-Math.sin(o.yaw),Math.cos(o.yaw)];
 const vf=o.v3[0]*f[0]+o.v3[2]*f[1],vr=o.v3[0]*r[0]+o.v3[2]*r[1];
 o.lean+=(clamp(vf/520,-.22,.32)-o.lean)*b3Damp(6,dt);
 o.bank+=(clamp(-vr/420,-.42,.42)-o.bank)*b3Damp(6,dt);
 o.legSwing=o.lean*1.5+Math.sin(clock*2.1+(o.enemy?1:0))*.05+clamp(-o.v3[1]/600,-.2,.3);
 const tgt=o.enemy?player:enemy;
 if(tgt){const d=Math.hypot(tgt.x-o.x,tgt.y-o.y);o.gunPitch+=(clamp(Math.atan2(tgt.h-o.h,d),-.7,.7)-o.gunPitch)*b3Damp(8,dt);}
 o.hitFlash=Math.max(0,(o.hitFlash||0)-dt);
}
function b3Scale(o){return o.enemy?(currentNode==='boss'?1.6:1.1):B3.tune.modelScale;}
function b3Pose(o){
 const sc=b3Scale(o);
 return {x:o.x,y:o.h+Math.sin(clock*2.3+(o.enemy?2:0))*1.4,z:o.y,yaw:o.yaw,pitch:o.lean,roll:o.bank,scale:sc,legSwing:o.legSwing,gunPitch:o.gunPitch,flash:o.hitFlash>0?.65:0};
}
// Shots leave from the nose between the two side cannons; flashes show at both cannon tips.
function b3Muzzle(o){return b3MechWorldPoint(null,b3Pose(o),[0,3,24]);}
function b3CannonTips(o){const m=b3BuildMech(o.load,o.enemy),pose=b3Pose(o);return m.muzzles.map(p=>b3MechWorldPoint(m,pose,p));}

// ----------------------------------------------------------- enemy AI -----
// Engagement bands (approach / strafe / retreat / flank / cover / peek),
// context steering around obstacles, dodge, altitude choice and unsticking.
function b3EnemyAI(dt){
 const e=enemy,ai=e.ai,role=ENEMY_ROLES[e.role]||ENEMY_ROLES.skirmisher,w=e.stats.weapon;
 if(e.dead)return;
 const dx=player.x-e.x,dz=player.y-e.y,dh=Math.hypot(dx,dz)||1,ux=dx/dh,uz=dz/dh;
 const los=b3Sight(e,player);ai.noLos=los?0:ai.noLos+dt;
 const pref=clamp(role.distance*1.9+(w.idealRange-300)*.9,260,900);
 const hpFrac=e.hp/e.maxHp,reloading=e.reloadLeft>0;
 ai.modeT+=dt;ai.decideT-=dt;ai.coverCD=Math.max(0,(ai.coverCD||0)-dt);ai.sideT-=dt;ai.dodgeCD=Math.max(0,ai.dodgeCD-dt);
 if(ai.sideT<=0){ai.side=-ai.side;ai.sideT=2.2+Math.random()*2.6*(1/(role.strafe+.3));}
 if(ai.decideT<=0){ai.decideT=.45+Math.random()*.35;
  const prev=ai.mode;
  if(ai.mode==='cover'&&(ai.hideT<1.1||reloading)){}
  else if(ai.mode==='peek'&&ai.modeT<1.3){}
  else if(los&&ai.coverCD<=0&&((reloading&&Math.random()<({sniper:.75,guardian:.6,boss:.35,charger:.15}[e.role]??.4))||hpFrac<.35&&Math.random()<.5)&&(ai.cover=b3FindCover(e))){ai.mode='cover';ai.hideT=0;ai.coverCD=6+Math.random()*4;}
  else if(ai.mode==='cover'){ai.mode='peek';}
  else if(dh>pref*1.35||ai.noLos>1.6)ai.mode='approach';
  else if(dh<pref*.66)ai.mode='retreat';
  else if((e.role==='flanker'||e.role==='skirmisher')&&Math.random()<.35)ai.mode='flank';
  else ai.mode='strafe';
  if(ai.mode!==prev)ai.modeT=0;
 }
 let vx=0,vz=0,spd=e.stats.speed*role.speed*(e.status.slow>0?.66:1)*(e.status.stun>0?.2:1);
 const lat=[-uz*ai.side,ux*ai.side];
 switch(ai.mode){
  case 'approach':vx=ux+lat[0]*.4;vz=uz+lat[1]*.4;break;
  case 'retreat':vx=-ux+lat[0]*.6;vz=-uz+lat[1]*.6;spd*=1.06;break;
  case 'flank':{const a=Math.atan2(-uz,-ux)+ai.side*1.25,tx=player.x+Math.cos(a)*pref,tz=player.y+Math.sin(a)*pref,l=Math.hypot(tx-e.x,tz-e.y)||1;vx=(tx-e.x)/l;vz=(tz-e.y)/l;break;}
  case 'cover':{const c=ai.cover;if(!c){ai.mode='strafe';break;}
   const ax=c.x-player.x,az=c.z-player.y,al=Math.hypot(ax,az)||1,hx=c.x+ax/al*(c.br+46),hz=c.z+az/al*(c.br+46),l=Math.hypot(hx-e.x,hz-e.y);
   if(l>30){vx=(hx-e.x)/l;vz=(hz-e.y)/l;}else{ai.hideT+=dt;vx=lat[0]*.15;vz=lat[1]*.15;}
   if(ai.modeT>3.2||(!reloading&&ai.hideT>.8))ai.mode='peek';break;}
  case 'peek':vx=lat[0]+ux*.2;vz=lat[1]+uz*.2;spd*=.9;break;
  default:{const band=clamp((dh-pref)/260,-1,1);vx=lat[0]*role.strafe+ux*band*.8;vz=lat[1]*role.strafe+uz*band*.8;spd*=.86;}
 }
 // Don't hug the player's back: if behind the player's view, slide around instead of closing in.
 const camF=[Math.cos(BS.camYaw),Math.sin(BS.camYaw)],behind=(-dx*camF[0]-dz*camF[1])/dh<-.5;
 if(behind&&dh<560&&ai.mode!=='retreat'){vx=lat[0]-ux*.3;vz=lat[1]-uz*.3;}
 const vl=Math.hypot(vx,vz);
 let dirx=0,dirz=0;
 if(vl>.05){const best=b3Steer(e,vx/vl,vz/vl);dirx=best[0];dirz=best[1];if(best[2]){ai.altGoal=Math.max(ai.altGoal,best[2]);}}
 // Dodge incoming player shots (role dependent).
 const dodgeRoles=['flanker','sniper','guardian','boss','skirmisher'];
 if(ai.dodgeCD<=0&&dodgeRoles.includes(e.role)&&e.en>.15)for(const b of bullets){
  if(b.source!==player||!b.b3)continue;const rx=e.x-b.x,rz=e.y-b.y,ry=e.h-b.h,d=Math.hypot(rx,ry,rz);if(d>300||d<20)continue;
  const sp=Math.hypot(b.vx,b.vy,b.vh)||1,cos=(rx*b.vx+rz*b.vy+ry*b.vh)/(d*sp);if(cos<.9)continue;
  const sx=-b.vy/sp,sz=b.vx/sp,sg=Math.random()<.5?-1:1,imp=330*(e.role==='flanker'?1.15:1);
  e.v3[0]+=sx*sg*imp;e.v3[2]+=sz*sg*imp;e.en-=.12;ai.dodgeCD=e.role==='boss'?1.6:e.role==='flanker'?.8:1.2;break;}
 // Altitude: role band, hop over blocking cover, rise to regain sight.
 const g=b3Ground(e.x,e.y),roleAlt={sniper:70,flanker:52+Math.sin(clock*.8+enemySeed)*34,charger:24,guardian:28,boss:56,skirmisher:36+Math.sin(clock*.6+enemySeed)*18}[e.role]??32;
 let altGoal=Math.max(HOVER+2,roleAlt);
 if(ai.noLos>1.1&&ai.mode!=='cover')altGoal=Math.max(altGoal,roleAlt+80);
 ai.altGoal+=(altGoal-ai.altGoal)*b3Damp(1.2,dt);
 const wantH=g+Math.max(HOVER,ai.altGoal);
 const vy=clamp((wantH-e.h)*2.4,-170,200);
 const k=b3Damp(4.5,dt);
 e.v3[0]+=(dirx*spd-e.v3[0])*k;e.v3[2]+=(dirz*spd-e.v3[2])*k;e.v3[1]+=(vy-e.v3[1])*b3Damp(3,dt);
 e.en=Math.min(1,e.en+.25*dt);
 b3Integrate(e,dt);
 // Unstick: if barely moving while trying to move, flip side, climb, replan.
 ai.checkT+=dt;if(ai.checkT>.7){const moved=Math.hypot(e.x-ai.lx,e.y-ai.lz);
  if(moved<18&&vl>.05&&ai.mode!=='cover'){ai.stuckT+=ai.checkT;ai.side=-ai.side;ai.altGoal+=60;ai.mode=Math.random()<.5?'flank':'strafe';ai.modeT=0;}
  else ai.stuckT=0;ai.lx=e.x;ai.lz=e.y;ai.checkT=0;}
 e.yaw+=b3Wrap(Math.atan2(player.y-e.y,player.x-e.x)-e.yaw)*b3Damp(6,dt);
 b3Animate(e,dt);
 // Reload when low and out of sight / out of range (same ammo rules as the player).
 if(e.ammo<e.stats.mag&&e.reloadLeft<=0&&(e.ammo<=0||(e.ammo<=Math.max(1,Math.floor(e.stats.mag*.28))&&(!los||dh>pref*1.4))))startReload(e);
 // Fire only with a clear line (rail: terrain only — it pierces cover).
 const d3=Math.hypot(dx,dz,player.h-e.h),range=Math.min(B3_RANGE[w.id]||900,role.attackRange*1.6);
 const lineOK=w.id==='rail'?!b3Ray(e.x,e.h+6,e.y,player.x,player.h+4,player.y,{ignoreObstacles:true}):los;
 ai.errT-=dt;if(ai.errT<=0){ai.errT=.35+Math.random()*.4;const s=(.065+.06*Math.max(0,1-wave/14))/Math.max(.5,role.accuracy);ai.aimErr=[(Math.random()-.5)*2*s,(Math.random()-.5)*1.4*s];}
 if(lineOK&&d3<range&&e.status.stun<=0&&e.cd<=0&&e.reloadLeft<=0&&state==='fight'){
  const aimP=b3Lead(e,player,.45+Math.random()*.5);b3Fire(e,player,aimP,ai.aimErr);}
}
// Pick an obstacle that can hide the enemy from the player.
function b3FindCover(e){let best=null,bs=1e9;
 for(const o of W3.obs){if(o.y1-b3Ground(o.x,o.z)<50||o.br>260)continue;const d=Math.hypot(o.x-e.x,o.z-e.y);if(d>650)continue;
  const dp=Math.hypot(o.x-player.x,o.z-player.y);if(dp<180)continue;const s=d+Math.max(0,400-dp)*.5;if(s<bs){bs=s;best=o;}}
 return best;}
// Context steering: 16 headings scored by intent, blocked probes and boundary.
function b3Steer(o,dx,dz){
 let best=[dx,dz,0],bs=-1e9,hop=0;
 for(let k=0;k<16;k++){const a=k/16*Math.PI*2,cx=Math.cos(a),cz=Math.sin(a);
  let s=cx*dx+cz*dz;
  for(const L of [55,120]){const px=o.x+cx*L,pz=o.y+cz*L;
   if(!b3Free(px,o.h,pz,MECH_R+4)){s-=L<60?2.2:1.1;
    // can we hop it?
    for(const ob of W3.obs)if(b3Inside(ob,px,o.h,pz,MECH_R)){const rel=ob.y1-b3Ground(o.x,o.y);if(rel<200)hop=Math.max(hop,rel+40);}}}
  const r=Math.hypot(o.x+cx*140,o.y+cz*140);if(r>W3.radius-90)s-=1.5*(r-W3.radius+90)/90;
  const pd=Math.hypot(o.x+cx*80-player.x,o.y+cz*80-player.y);if(pd<150)s-=1.2;
  if(s>bs){bs=s;best=[cx,cz,0];}}
 if(bs<-.6&&hop)best[2]=hop;
 return best;}
function b3Lead(src,tgt,k){const d=Math.hypot(tgt.x-src.x,tgt.y-src.y,tgt.h-src.h),w=src.stats.weapon,sp=w.velocity*SHOT_SPEED,t=d/sp*k;
 return [tgt.x+tgt.v3[0]*t,tgt.h+tgt.v3[1]*t*.5,tgt.y+tgt.v3[2]*t];}

// ------------------------------------------------------------- shooting ---
// Reuses the core shoot(): cooldown, magazine, reload, pellets, spread and
// damage stay identical to the 2D rules. New bullets are then lifted into 3D.
function b3Fire(o,tgt,aim,err=[0,0]){
 const n0=bullets.length,m=b3Muzzle(o),ang=Math.atan2(aim[2]-m[2],aim[0]-m[0])+err[0];
 shoot(o,tgt,ang);
 if(bullets.length===n0)return false;
 const hd=Math.hypot(aim[0]-m[0],aim[2]-m[2]),pitch=Math.atan2(aim[1]-m[1],hd)+err[1],w=o.stats.weapon;
 if(w.id==='shot'){
  // Dice-five pattern around the aim line, square in the shooter's view.
  const f=[Math.cos(pitch)*Math.cos(ang),Math.sin(pitch),Math.cos(pitch)*Math.sin(ang)];let r=v3.cross(f,[0,1,0]);r=v3.norm(v3.len(r)<1e-4?[1,0,0]:r);const u=v3.cross(r,f);
  for(let i=n0;i<bullets.length;i++){const q=SHOT_DICE[(i-n0)%5],d=v3.norm(v3.add(f,v3.add(v3.mul(r,q[0]*SHOT_DICE_SPREAD),v3.mul(u,q[1]*SHOT_DICE_SPREAD))));
   b3LiftDir(bullets[i],m,d);}
 }else for(let i=n0;i<bullets.length;i++){const b=bullets[i];b3Lift(b,m,pitch,w.id==='burst'?(i-n0-1)*.012:0);}
 if(o===player)BS.stats.shotsP++;else BS.stats.shotsE++;
 // Muzzle flash, rail beam.
 const col=b3Hex(w.color);for(const tp of b3CannonTips(o)){b3Burst(tp,col,w.id==='shot'?6:3,150,.12,w.id==='slug'?14:8,true);BS.fx.push({k:'flash',p:tp,t:0,life:.06,r:w.id==='slug'?30:17,c:col});}
 if(w.id==='rail'){const dir=[Math.cos(pitch)*Math.cos(ang),Math.sin(pitch),Math.cos(pitch)*Math.sin(ang)],L=B3_RANGE.rail,e=[m[0]+dir[0]*L,m[1]+dir[1]*L,m[2]+dir[2]*L];
  const h=b3Ray(m[0],m[1],m[2],e[0],e[1],e[2],{ignoreObstacles:true});let t=h?h.t:1;
  // Draw the beam only a little past its target so a miss never sweeps through the camera.
  const along=(tgt.x-m[0])*dir[0]+(tgt.h-m[1])*dir[1]+(tgt.y-m[2])*dir[2];if(along>0)t=Math.min(t,(along+70)/L);
  BS.fx.push({k:'beam',a:m,b:[m[0]+(e[0]-m[0])*t,m[1]+(e[1]-m[1])*t,m[2]+(e[2]-m[2])*t],t:0,life:.38,c:o.enemy?[1,.55,.6]:col});}
 if(w.id==='slug')BS.shake=Math.max(BS.shake,o===player?5:2);
 return true;
}
function b3Lift(b,m,pitch,vSpread=0){
 const ang=Math.atan2(b.vy,b.vx),sp=(b.spd||Math.hypot(b.vx,b.vy))*SHOT_SPEED,p=pitch+vSpread;
 b.x=m[0];b.y=m[2];b.h=m[1];b.px=b.x;b.py=b.y;b.ph=b.h;
 b.vx=Math.cos(ang)*Math.cos(p)*sp;b.vy=Math.sin(ang)*Math.cos(p)*sp;b.vh=Math.sin(p)*sp;b.spd=sp;
 const range=B3_RANGE[b.kind]||900;b.life=Math.min(2.6,range*1.12/sp+(b.homing?.6:0));
 if(b.homing){b.vh+=sp*.32;b.smokeT=0;}
 b.b3=true;b.trail=[[b.x,b.h,b.y]];
}
function b3LiftDir(b,m,d){const sp=(b.spd||Math.hypot(b.vx,b.vy))*SHOT_SPEED;
 b.x=m[0];b.y=m[2];b.h=m[1];b.px=b.x;b.py=b.y;b.ph=b.h;b.vx=d[0]*sp;b.vh=d[1]*sp;b.vy=d[2]*sp;b.spd=sp;
 b.life=Math.min(2.6,(B3_RANGE[b.kind]||900)*1.12/sp);b.b3=true;b.trail=[[b.x,b.h,b.y]];}
// Boss pattern shots are created by the core in 2D; lift them from the boss.
function b3LiftLoose(b){
 const s=b.source||enemy,tgt=s===player?enemy:player;
 const m=[s.x,s.h+8,s.y],hd=Math.hypot(tgt.x-s.x,tgt.y-s.y);
 b3Lift(b,m,Math.atan2(tgt.h-s.h,hd)*.9,0);b.life=Math.max(b.life,2.4);
}
function b3SegSphere(a,b,c,r){const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],f=[a[0]-c[0],a[1]-c[1],a[2]-c[2]];
 const A=v3.dot(d,d),B=2*v3.dot(f,d),C=v3.dot(f,f)-r*r;if(C<=0)return 0;if(A<1e-9)return null;const D=B*B-4*A*C;if(D<0)return null;
 const t=(-B-Math.sqrt(D))/(2*A);return t>=0&&t<=1?t:null;}
function b3Projectiles(dt){
 for(let i=bullets.length-1;i>=0;i--){
  const b=bullets[i];if(!b.b3)b3LiftLoose(b);
  b.life-=dt;
  const tgt=b.source===player?enemy:player;
  if(b.life<=0){if(b.homing)b3Explosion([b.x,b.h,b.y],.45,b3Hex(b.color));bullets.splice(i,1);continue;}
  if(b.homing&&tgt&&!tgt.dead){
   const to=v3.norm([tgt.x-b.x,tgt.h-b.h,tgt.y-b.y]),cur=v3.norm([b.vx,b.vh,b.vy]),cos=clamp(v3.dot(to,cur),-1,1),ang=Math.acos(cos),max=(b.source===player?2.4:1.9)*dt;
   let nd=cur;if(ang>1e-4){const t=Math.min(1,max/ang);nd=v3.norm([cur[0]+(to[0]-cur[0])*t,cur[1]+(to[1]-cur[1])*t,cur[2]+(to[2]-cur[2])*t]);}
   b.vx=nd[0]*b.spd;b.vh=nd[1]*b.spd;b.vy=nd[2]*b.spd;
   b.smokeT-=dt;if(b.smokeT<=0){b.smokeT=.018;b3Part(b.x,b.h,b.y,(Math.random()-.5)*14,8+Math.random()*10,(Math.random()-.5)*14,1.1,13,[.82,.82,.84],.5,false,.8);}
  }
  b.px=b.x;b.py=b.y;b.ph=b.h;b.x+=b.vx*dt;b.y+=b.vy*dt;b.h+=b.vh*dt;
  b.trail.push([b.x,b.h,b.y]);if(b.trail.length>9)b.trail.shift();
  const a=[b.px,b.ph,b.py],c=[b.x,b.h,b.y];
  const wh=b3Ray(a[0],a[1],a[2],c[0],c[1],c[2],{ignoreObstacles:b.kind==='rail',water:true});
  let th=null;if(tgt&&!tgt.dead&&!b.hitDone)th=b3SegSphere(a,c,[tgt.x,tgt.h+2,tgt.y],HIT_R*b3Scale(tgt)+b.r);
  if(th!==null&&(!wh||th<=wh.t)){
   const hp=[a[0]+(c[0]-a[0])*th,a[1]+(c[1]-a[1])*th,a[2]+(c[2]-a[2])*th];
   if(b.homing){b3Explosion(hp,.7,b3Hex(b.color));}
   damage(tgt,b.damage);applyWeaponImpact(b,tgt);
   b3Impact(hp,null,'mech',tgt.enemy?[1,.6,.45]:[.6,.95,1]);
   if(b.source===player){BS.hitMark=.14;BS.stats.hitsP++;}else{BS.stats.hitsE++;BS.dmgDirs.push({a:Math.atan2(b.py-player.y,b.px-player.x),t:.7});BS.shake=Math.max(BS.shake,3);}
   if(b.kind==='rail'){b.hitDone=true;continue;} // rail keeps flying (already hit; avoid double hits below)
   bullets.splice(i,1);continue;
  }
  if(wh){
   const hp=[a[0]+(c[0]-a[0])*wh.t,a[1]+(c[1]-a[1])*wh.t,a[2]+(c[2]-a[2])*wh.t];
   if(b.homing){b3Explosion(hp,.75,b3Hex(b.color));
    const splash=(WEAPON_TRAITS.missile.splash||68)*1.4*(b.source.stats?.modifiers?.splash||1);
    if(tgt&&!tgt.dead&&Math.hypot(tgt.x-hp[0],tgt.h-hp[1],tgt.y-hp[2])<splash&&!b3Ray(hp[0]+wh.n[0]*4,hp[1]+wh.n[1]*4,hp[2]+wh.n[2]*4,tgt.x,tgt.h,tgt.y))damage(tgt,b.damage*.6);
   }else b3Impact(hp,wh.n,wh.kind,b3Hex(b.color));
   if(b.source!==player&&wh.kind==='obstacle')BS.stats.blocked++;
   bullets.splice(i,1);continue;
  }
  if(Math.hypot(b.x,b.y)>W3.radius+400||b.h>1600)bullets.splice(i,1);
 }
}
// Boss "beam": a 3D ray from the boss that real cover blocks.
const b3CoreExecuteBoss=executeBossAttack;
executeBossAttack=function(){
 if(!(R3.ok&&b3Battle())||!bossAttack||bossAttack.kind!=='beam')return b3CoreExecuteBoss();
 if(!enemy||enemy.dead||state!=='fight')return;
 const s=[enemy.x,enemy.h+8,enemy.y],aim=bossAttack.aim3||[player.x,player.h,player.y],dir=v3.norm(v3.sub(aim,s)),L=1300,e=v3.add(s,v3.mul(dir,L));
 const h=b3Ray(s[0],s[1],s[2],e[0],e[1],e[2]),t=h?h.t:1,end=v3.add(s,v3.mul(dir,L*t));
 const pc=[player.x,player.h,player.y],rel=v3.sub(pc,s),along=v3.dot(rel,dir);
 if(along>0&&along<L*t&&v3.len(v3.sub(rel,v3.mul(dir,along)))<HIT_R+18)damage(player,23);
 BS.fx.push({k:'beam',a:s,b:end,t:0,life:.5,c:[1,.35,.55],w:18});
 bossAttackCount++;beep(180,.16,.04,'sawtooth');
};

// --------------------------------------------------------------- camera ---
// Player fixed in the lower part of the frame, opponent at the reticle.
// Yaw/pitch track the opponent; right stick / arrows / drag override, then
// ease back. FOV narrows and the camera backs off as the gap grows so the
// own mech keeps the same on-screen size while the opponent stays readable.
function b3CameraUpdate(dt,size){
 const t=B3.tune,o=player,e=enemy&&!enemy.dead?enemy:null,aspect=size.cssW/Math.max(1,size.cssH);
 const look=b3LookInput();let manual=false;
 if(Math.abs(look.x)>.04||Math.abs(look.y)>.04){BS.camYaw+=look.x*t.lookSpeed*dt*1.2;BS.camPitch=clamp(BS.camPitch+look.y*t.lookPitchSpeed*dt*.9,-.95,.95);manual=true;}
 if(BS.drag&&BS.drag.moved){manual=true;}
 if(manual)BS.manualUntil=clock+t.manualReturn;
 BS.manualActive=clock<BS.manualUntil;
 const pc=[o.x,o.h+4,o.y];
 let gap=900;
 if(e){
  const ec=[e.x,e.h+2,e.y],dx=ec[0]-pc[0],dz=ec[2]-pc[2],dh=Math.hypot(dx,dz)||1,dy=ec[1]-pc[1];gap=Math.hypot(dh,dy);
  if(t.enemyTracking&&!BS.manualActive){
   const bearing=Math.atan2(dz,dx),err=b3Wrap(bearing-BS.camYaw);
   const box=Math.max(.001,t.trackBox),k=t.trackSpeed*(.35+.65*Math.min(1,Math.abs(err)/box))*(Math.abs(err)>1.6?1.6:1);
   BS.camYaw+=err*b3Damp(k,dt);
   // Pitch that places the opponent on the reticle while the player sits low.
   const fovNow=BS.fov,c=(t.playerScreenY-.5)*2*Math.tan(fovNow/2)*BS.dist,rho=Math.hypot(dh,dy),alpha=Math.atan2(dy,dh);
   BS.framePitch=-Math.asin(clamp(c/Math.max(rho,1),-.95,.95));const want=alpha+BS.framePitch;
   BS.camPitch+=(clamp(want,-.95,.95)-BS.camPitch)*b3Damp(k*.8,dt);
  }
 }
 // Zoom: narrower FOV and longer distance at long range, wider in portrait.
 const far=b3Smooth(260,1150,gap);let fovDeg=b3Mix(t.fovNear,t.fovFar,far);
 if(aspect<1)fovDeg=Math.min(84,fovDeg*(1+.42*(1-aspect)));
 const fovT=fovDeg*Math.PI/180,zk=b3Damp(Math.max(.5,t.followSpeed)*1.5,dt);BS.fov+=(fovT-BS.fov)*zk;
 const distT=t.camDistance*Math.tan(t.fovNear*Math.PI/360)/Math.tan(BS.fov/2)*(aspect<1?1+.95*(1-aspect):1)*(currentNode==='boss'?1.1:1);
 BS.dist+=(distT-BS.dist)*zk;
 const cy=Math.cos(BS.camYaw),sy=Math.sin(BS.camYaw),cp=Math.cos(BS.camPitch),sp=Math.sin(BS.camPitch);
 const f=[cy*cp,sp,sy*cp],u=[-cy*sp,cp,-sy*sp];
 const lift=(t.playerScreenY-.5)*2*Math.tan(BS.fov/2)*BS.dist;
 let eye=[pc[0]-f[0]*BS.dist+u[0]*lift,pc[1]-f[1]*BS.dist+u[1]*lift,pc[2]-f[2]*BS.dist+u[2]*lift];
 // Terrain between camera and player pulls the camera in; buildings/rocks
 // there stay in place but are drawn see-through (camera keeps its framing).
 const hit=b3Ray(pc[0],pc[1]+8,pc[2],eye[0],eye[1],eye[2],{ignoreObstacles:true});
 const pullT=hit?Math.max(.18,hit.t-.08):1;BS.pull=BS.pull==null?pullT:BS.pull+(pullT-BS.pull)*b3Damp(pullT<BS.pull?25:4,dt);
 if(BS.pull<.999)eye=[pc[0]+(eye[0]-pc[0])*BS.pull,pc[1]+8+(eye[1]-pc[1]-8)*BS.pull,pc[2]+(eye[2]-pc[2])*BS.pull];
 const gy=b3Ground(eye[0],eye[2])+14;if(eye[1]<gy)eye[1]=gy;
 // The eye sits exactly where the pilot stays low-centre; yaw/pitch are already
 // smoothed by tracking, and followSpeed smooths zoom / distance changes.
 BS.camEye=eye.slice();
 const occ=new Set(),E0=BS.camEye;
 for(let i=0;i<W3.obs.length;i++){const o=W3.obs[i];if(b3Inside(o,E0[0],E0[1],E0[2],4)||b3SegObstacle(o,E0[0],E0[1],E0[2],pc[0],pc[1]+6,pc[2]))occ.add(i);}
 R3.occluders=occ;
 const tgt=[BS.camEye[0]+f[0]*400,BS.camEye[1]+f[1]*400,BS.camEye[2]+f[2]*400];
 let shake=[0,0,0];if(BS.shake>0){const s=BS.shake*.6;shake=[(Math.random()-.5)*s,(Math.random()-.5)*s,(Math.random()-.5)*s];}
 BS.camRoll+=(clamp(-player.bank*.18,-.08,.08)-BS.camRoll)*b3Damp(4,dt);
 b3SetCamera(v3.add(BS.camEye,shake),v3.add(tgt,shake),BS.fov,aspect,BS.camRoll);
}
// Lock = opponent inside the drawn reticle AND clear line AND in range.
function b3EvaluateLock(){
 const e=enemy;BS.inReticle=BS.los=BS.inRange=BS.lock=false;BS.enemyScr=null;BS.track='none';
 const H=canvas.height,W=canvas.width;BS.reticleR=Math.max(14,B3.tune.aimTolerance*H*(player.stats.weapon.id==='missile'?1.35:player.stats.weapon.id==='shot'?1.2:1));
 if(!e||e.dead)return;
 const p=b3Project(e.x,e.h+2,e.y);
 if(p){const er=HIT_R*b3Scale(e),pr=b3Project(e.x+R3.cam.r[0]*er,e.h+2+R3.cam.r[1]*er,e.y+R3.cam.r[2]*er);
  BS.enemyScr=p;BS.enemyScrR=pr?Math.max(6,Math.hypot(pr.x-p.x,pr.y-p.y)):8;
  const on=p.x>0&&p.x<W&&p.y>0&&p.y<H;BS.track=BS.manualActive?'manual':on?'tracking':'offscreen';
  BS.inReticle=Math.hypot(p.x-W/2,p.y-H/2)<=BS.reticleR+BS.enemyScrR*.6;}
 else BS.track=BS.manualActive?'manual':'offscreen';
 const d=Math.hypot(e.x-player.x,e.y-player.y,e.h-player.h);
 BS.inRange=d<=(B3_RANGE[player.stats.weapon.id]||900);
 const m=b3Muzzle(player),wid=player.stats.weapon.id;
 BS.los=wid==='rail'?!b3Ray(m[0],m[1],m[2],e.x,e.h+2,e.y,{ignoreObstacles:true}):!b3Ray(m[0],m[1],m[2],e.x,e.h+2,e.y);
 BS.lock=BS.inReticle&&BS.los&&BS.inRange;
}
function b3PlayerFire(){
 const o=player;BS.firing=false;
 if(o.status.stun>0)return;
 const manual=b3ManualTrigger(),auto=B3.tune.autoFire&&BS.lock;
 if(!manual&&!auto)return;
 // Locked: lead the opponent. Manual without lock: straight down the reticle ray.
 let aim;
 if(BS.lock)aim=b3Lead(o,enemy,.9);
 else{const C=R3.cam,L=B3_RANGE[o.stats.weapon.id]||900,h=b3Ray(C.eye[0],C.eye[1],C.eye[2],C.eye[0]+C.f[0]*(L+BS.dist),C.eye[1]+C.f[1]*(L+BS.dist),C.eye[2]+C.f[2]*(L+BS.dist));
  const t=h?h.t:1;aim=[C.eye[0]+C.f[0]*(L+BS.dist)*t,C.eye[1]+C.f[1]*(L+BS.dist)*t,C.eye[2]+C.f[2]*(L+BS.dist)*t];}
 BS.firing=b3Fire(o,enemy,aim,[0,0])||o.cd>0;
}

// ------------------------------------------------------------- finisher ---
const b3CoreStartFinisher=startFinisher;
startFinisher=function(target){
 b3CoreStartFinisher(target);
 if(!(R3.ok&&finishSequence)||BS.debris)return;
 finishSequence.duration=2;
 const m=b3BuildMech(target.load,target.enemy),pose=b3Pose(target);
 const pieces={};
 m.parts.forEach((name,i)=>{const pv=m.pivot[name]||[0,0,0],dir=b3MechWorldDir(pose,v3.norm([pv[0]||(Math.random()-.5),pv[1]*.5+6,pv[2]||(Math.random()-.5)]));
  const sp=name==='hull'?60:160+Math.random()*120;
  pieces[i]={off:[0,0,0],vel:[dir[0]*sp+target.v3[0]*.3,Math.abs(dir[1])*sp*.6+120+Math.random()*110,dir[2]*sp+target.v3[2]*.3],
   axis:v3.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),ang:0,av:(Math.random()-.5)*(name==='hull'?3:12),smoke:Math.random()<.6};});
 pose.flash=0;BS.debris={target,model:m,pose,pieces,t:0,booms:[.32,.7,1.05],camA:BS.camYaw+Math.PI*.75};
 b3Explosion([pose.x,pose.y,pose.z],1.6,target.enemy?[1,.55,.3]:[.5,.85,1]);BS.shake=9;
 beep(110,.5,.06,'sawtooth');setTimeout(()=>beep(70,.6,.05,'square'),120);
};
function b3FinisherStep(dt){
 const F=BS.debris;finishSequence.elapsed=Math.min(finishSequence.duration,finishSequence.elapsed+dt);
 const t=finishSequence.elapsed,slow=t<.6?.32:t<.8?.6:1,sdt=dt*slow;
 if(F){F.t+=sdt;
  for(const k in F.pieces){const p=F.pieces[k];p.vel[1]-=560*sdt;p.off[0]+=p.vel[0]*sdt;p.off[1]+=p.vel[1]*sdt;p.off[2]+=p.vel[2]*sdt;p.ang+=p.av*sdt;
   const wy=F.pose.y+p.off[1],gy=b3Ground(F.pose.x+p.off[0],F.pose.z+p.off[2])+4;
   if(wy<gy){p.off[1]+=gy-wy;p.vel[1]=Math.abs(p.vel[1])*.32;p.vel[0]*=.55;p.vel[2]*=.55;p.av*=.5;}
   if(p.smoke&&Math.random()<sdt*22)b3Part(F.pose.x+p.off[0],F.pose.y+p.off[1],F.pose.z+p.off[2],(Math.random()-.5)*20,30,(Math.random()-.5)*20,1.2,16,[.25,.24,.26],.55,false,1);
   if(Math.random()<sdt*14)b3Part(F.pose.x+p.off[0],F.pose.y+p.off[1],F.pose.z+p.off[2],(Math.random()-.5)*60,40+Math.random()*60,(Math.random()-.5)*60,.4,6,[1,.7,.35],1,true,2,-300);}
  while(F.booms.length&&F.t>=F.booms[0]){F.booms.shift();const ks=Object.keys(F.pieces),p=F.pieces[ks[Math.floor(Math.random()*ks.length)]];
   b3Explosion([F.pose.x+p.off[0],F.pose.y+p.off[1],F.pose.z+p.off[2]],1,F.target.enemy?[1,.6,.3]:[.55,.85,1]);BS.shake=Math.max(BS.shake,5);beep(90,.25,.04,'sawtooth');}
 }
 b3UpdateParticles(sdt);
 BS.fade=clamp((t-(finishSequence.duration-.42))/.42,0,1);
 if(t>=finishSequence.duration){const wasWin=finishSequence.kind==='win';finishSequence=null;state='fight';BS.debris=null;BS.fade=0;if(wasWin)win();else lost();}
}
function b3FinisherCamera(size){
 R3.occluders=null;
 const F=BS.debris,aspect=size.cssW/Math.max(1,size.cssH);if(!F)return;
 F.camA+=.0035;const c=[F.pose.x,F.pose.y+8,F.pose.z],r=210,a=F.camA+F.t*.35;
 const eye=[c[0]+Math.cos(a)*r,c[1]+70,c[2]+Math.sin(a)*r];const gy=b3Ground(eye[0],eye[2])+20;if(eye[1]<gy)eye[1]=gy;
 let sh=[0,0,0];if(BS.shake>0){const s=BS.shake*.7;sh=[(Math.random()-.5)*s,(Math.random()-.5)*s,(Math.random()-.5)*s];}
 b3SetCamera(v3.add(eye,sh),c,(aspect<1?62:48)*Math.PI/180,aspect);
}

// --------------------------------------------------------------- update ---
function b3UpdateParticles(dt){
 for(let i=BS.parts.length-1;i>=0;i--){const p=BS.parts[i];p.life-=dt;if(p.life<=0){BS.parts.splice(i,1);continue;}
  const k=Math.exp(-p.drag*dt);p.vx*=k;p.vy*=k;p.vz*=k;p.vy+=p.grav*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;}
 for(let i=BS.fx.length-1;i>=0;i--){const f=BS.fx[i];f.t+=dt;if(f.t>=f.life)BS.fx.splice(i,1);}
 for(let i=BS.dmgDirs.length-1;i>=0;i--){BS.dmgDirs[i].t-=dt;if(BS.dmgDirs[i].t<=0)BS.dmgDirs.splice(i,1);}
 BS.shake=Math.max(0,BS.shake-22*dt);BS.hitMark=Math.max(0,BS.hitMark-dt);
}
function b3EngineFx(o,dt){
 const m=b3BuildMech(o.load,o.enemy),pose=b3Pose(o),sp=Math.hypot(o.v3[0],o.v3[2]),boost=(o.dashT>0?1:0)+(o.v3[1]>40?.6:0);
 const col=o.enemy?[1,.6,.35]:[.45,.92,1];
 for(const em of m.emit){if(Math.random()>dt*(10+sp*.05+boost*30)*em.k)continue;
  const p=b3MechWorldPoint(m,pose,em.p),d=b3MechWorldDir(pose,em.d),v=60+sp*.25+boost*220;
  b3Part(p[0],p[1],p[2],d[0]*v+o.v3[0]*.6,d[1]*v+o.v3[1]*.6,d[2]*v+o.v3[2]*.6,.16+boost*.1,6+boost*6,col,.9,true,4);}
}
let b3LastRealT=0;
function b3Step(dt){
 if(menuOpen)return;
 clock+=dt;effects.length=0;rings.length=0;
 if(enemy&&enemy!==BS.enemyRef&&player)b3SetupFight();
 if(state==='finisher'&&finishSequence){b3FinisherStep(dt);return;}
 if(state!=='fight'||!player||!enemy){b3UpdateParticles(dt);return;}
 BS.stats.frames++;BS.stats.fightTime+=dt;
 player.cd=Math.max(0,player.cd-dt);enemy.cd=Math.max(0,enemy.cd-dt);
 updateReload(player,dt);updateReload(enemy,dt);
 updateStatus(player,dt);updateStatus(enemy,dt);if(state!=='fight')return;
 b3MovePlayer(dt);
 if(!BS.freezeAI)b3EnemyAI(dt);else{enemy.v3=[0,0,0];b3Animate(enemy,dt);}if(state!=='fight')return;
 const size=b3ResizeCanvases();b3CameraUpdate(dt,size);b3EvaluateLock();
 if(BS.lock&&!BS.wasLock){beep(1240,.05,.012,'square');}BS.wasLock=BS.lock;
 b3PlayerFire();if(state!=='fight')return;
 if(currentNode==='boss'&&bossAttack&&bossAttack.kind==='beam'&&!bossAttack.aim3)bossAttack.aim3=[player.x,player.h,player.y];
 updateBossPatterns(dt);if(state!=='fight')return;
 b3Projectiles(dt);
 b3EngineFx(player,dt);if(enemy&&!enemy.dead)b3EngineFx(enemy,dt);
 b3UpdateParticles(dt);
 // Incoming-missile warning tone.
 BS.warnT-=dt;const inbound=bullets.some(b=>b.homing&&b.source!==player&&Math.hypot(b.x-player.x,b.y-player.y)<650);
 if(inbound&&BS.warnT<=0){beep(1480,.06,.016,'square');BS.warnT=.32;}
 BS.panelT-=dt;if(BS.panelT<=0){BS.panelT=.12;updatePanels(false);}
}
