// ------------------------------------------------------- frame assembly ---
function b3IdleCamera(size){
 R3.occluders=null;
 const aspect=size.cssW/Math.max(1,size.cssH),o=player||{x:W3.spawnP.x,y:W3.spawnP.z,h:b3Ground(W3.spawnP.x,W3.spawnP.z)+HOVER};
 if(o.h==null)o.h=b3Ground(o.x,o.y)+HOVER;
 BS.idleT+=1/60;const a=BS.idleT*.12+.6,r=150;
 const eye=[o.x+Math.cos(a)*r,o.h+46,o.y+Math.sin(a)*r];const gy=b3Ground(eye[0],eye[2])+18;if(eye[1]<gy)eye[1]=gy;
 b3SetCamera(eye,[o.x,o.h+6,o.y],(aspect<1?64:50)*Math.PI/180,aspect);
}
function b3ShotColor(b){const c=b3Hex(b.color);return b.source===player?c:[c[0]*.45+.55,c[1]*.55+.2,c[2]*.45+.15];}
function b3EmitProjectile(b){
 const p=[b.x,b.h,b.y],dir=[b.vx,b.vh,b.vy],c=b3ShotColor(b),k=b.kind;
 const tr=b.trail,n=tr.length;
 const ribbon=(w,alpha,col=c)=>{for(let i=1;i<n;i++){const t0=(i-1)/n,t1=i/n;b3Ribbon(G3.unAdd,tr[i-1],tr[i],w*t0,w*t1,[col[0],col[1],col[2],alpha*t0],[col[0],col[1],col[2],alpha*t1]);}};
 if(k==='missile'||b.homing&&k!=='boss'){
  b3EmitBox(G3.dyn,p,dir,null,5,5,20,[.62,.65,.7],.1);
  const f=v3.norm(dir),nose=v3.add(p,v3.mul(f,9));b3EmitBox(G3.dyn,nose,dir,null,3,3,4,c,1);
  const tail=v3.sub(p,v3.mul(f,8));b3EmitBox(G3.dyn,tail,dir,[0,1,0],12,1,5,[.35,.38,.42],0);b3EmitBox(G3.dyn,tail,dir,[1,0,0],12,1,5,[.35,.38,.42],0);
  const fl=v3.sub(p,v3.mul(f,12));G3.ptAdd.push8(fl[0],fl[1],fl[2],1,.75,.4,1,14+Math.random()*8);G3.ptAdd.push8(fl[0],fl[1],fl[2],1,1,.9,1,6);
  return;}
 if(k==='rail'){ribbon(7,1,[.9,.85,1]);b3EmitBox(G3.dyn,p,dir,null,2,2,44,c,1);G3.ptAdd.push8(p[0],p[1],p[2],c[0],c[1],c[2],1,28);return;}
 if(k==='shot'){b3EmitBox(G3.dyn,p,dir,null,3.6,3.6,7,c,1);ribbon(3.6,.7);G3.ptAdd.push8(p[0],p[1],p[2],c[0],c[1],c[2],.7,11);return;}
 if(k==='micro'){b3EmitBox(G3.dyn,p,dir,null,1.4,1.4,28,c,1);ribbon(2.2,.8);G3.ptAdd.push8(p[0],p[1],p[2],c[0],c[1],c[2],.6,8);return;}
 if(k==='slug'){b3EmitBox(G3.dyn,p,dir,null,11,11,22,c,.8);b3EmitBox(G3.dyn,v3.sub(p,v3.mul(v3.norm(dir),10)),dir,null,6,6,6,[1,.95,.8],1);ribbon(16,.55);G3.ptAdd.push8(p[0],p[1],p[2],c[0],c[1],c[2],.9,44);return;}
 if(k==='bounce'){const s=7;b3EmitBox(G3.dyn,p,[Math.cos(clock*30),0,Math.sin(clock*30)],null,s*1.6,2.4,s*1.6,c,1);ribbon(4,.6);G3.ptAdd.push8(p[0],p[1],p[2],c[0],c[1],c[2],.9,20);return;}
 if(k==='burst'){b3EmitBox(G3.dyn,p,dir,null,2.8,2.8,18,c,1);ribbon(3.8,.8,[1,.6,.3]);G3.ptAdd.push8(p[0],p[1],p[2],1,.6,.3,.7,12);return;}
 if(k==='boss'){G3.ptAdd.push8(p[0],p[1],p[2],c[0],c[1],c[2],1,30);G3.ptAdd.push8(p[0],p[1],p[2],1,1,1,1,10);ribbon(8,.5);return;}
 // pulse
 b3EmitBox(G3.dyn,p,dir,null,4,4,20,c,1);ribbon(4.6,.8);G3.ptAdd.push8(p[0],p[1],p[2],c[0],c[1],c[2],.85,22);
}
function b3EmitWorldFx(){
 for(const f of BS.fx){const t=f.t/f.life;
  if(f.k==='flash'){G3.ptAdd.push8(f.p[0],f.p[1],f.p[2],f.c[0],f.c[1],f.c[2],1-t,f.r*(1+t*.6));}
  else if(f.k==='beam'){const w=(f.w||7)*(1-t),a=1-t;b3Ribbon(G3.unAdd,f.a,f.b,w,w,[f.c[0],f.c[1],f.c[2],a],[f.c[0],f.c[1],f.c[2],a*.6]);b3Ribbon(G3.unAdd,f.a,f.b,w*.3,w*.3,[1,1,1,a],[1,1,1,a*.5]);}
 }
 for(const p of BS.parts){const a=p.a*Math.min(1,p.life/p.max*1.6),buf=p.add?G3.ptAdd:G3.ptA,grow=p.add?1:1+(1-p.life/p.max)*1.8;buf.push8(p.x,p.y,p.z,p.c[0],p.c[1],p.c[2],a,p.size*grow);}
 // Boundary fence: visible light wall where the arena ends.
 if(player&&(state==='fight'||state==='ready')){const R=W3.radius,pa=Math.atan2(player.y,player.x),pd=Math.hypot(player.x,player.y),vis=b3Smooth(R-520,R-120,pd);
  if(vis>.01){const acc=b3Hex(W3.biome.accent);for(let k=-10;k<10;k++){const a0=pa+k*.035,a1=pa+(k+1)*.035,fade=vis*(1-Math.abs(k+.5)/10);
   const P=(a,y)=>[Math.cos(a)*R,y,Math.sin(a)*R],g0=b3Ground(Math.cos(a0)*R,Math.sin(a0)*R),g1=b3Ground(Math.cos(a1)*R,Math.sin(a1)*R);
   for(const [y0,y1,al0,al1] of [[0,60,.5,.25],[60,150,.25,0]]){const A=P(a0,g0+y0),B=P(a1,g1+y0),C=P(a1,g1+y1),D=P(a0,g0+y1);
    for(const [q,al] of [[A,al0],[B,al0],[C,al1],[A,al0],[C,al1],[D,al1]])G3.unAdd.push7(q[0],q[1],q[2],acc[0],acc[1],acc[2],al*fade*.8);}
   if(k%2===0){const A=P(a0,g0),B=P(a0,g0+170);b3Ribbon(G3.unAdd,A,B,3,1,[acc[0],acc[1],acc[2],.8*fade],[acc[0],acc[1],acc[2],0]);}}}}
 // Boss telegraph.
 if(currentNode==='boss'&&bossAttack&&enemy&&!enemy.dead&&state==='fight'){const w=clamp(1-bossAttack.windup/1.05,0,1),c=[1,.35,.5,.25+w*.6];
  const s=[enemy.x,enemy.h+8,enemy.y];for(let k=0;k<24;k++){const a0=k/24*Math.PI*2,a1=(k+1)/24*Math.PI*2,r=60+w*20;b3Ribbon(G3.unAdd,[s[0]+Math.cos(a0)*r,s[1],s[2]+Math.sin(a0)*r],[s[0]+Math.cos(a1)*r,s[1],s[2]+Math.sin(a1)*r],3+w*4,3+w*4,c,c);}
  if(bossAttack.kind==='beam'&&bossAttack.aim3){const d=v3.norm(v3.sub(bossAttack.aim3,s));b3Ribbon(G3.unAdd,s,v3.add(s,v3.mul(d,1300)),2+w*5,2+w*5,[1,.3,.5,.3+w*.5],[1,.3,.5,0]);}}
}
function b3EmitActors(){
 const draw=o=>{if(!o||o.dead||o.h==null)return;const m=b3BuildMech(o.load,o.enemy),pose=b3Pose(o);b3EmitMech(G3.dyn,m,pose);
  const g=b3Ground(o.x,o.y),alt=o.h-g,a=.5*(1-clamp(alt/360,0,.85));b3Disc(G3.unA,o.x,o.y,26*(1-clamp(alt/400,0,.45))*pose.scale,[0,0,0],a);
  if(W3.water&&g<W3.water.y){b3Disc(G3.unAdd,o.x,o.y,30,[.6,.9,1],.12*(1-clamp(alt/200,0,1)),W3.water.y-g+.5);}};
 draw(player);draw(enemy);
 if(BS.debris){const F=BS.debris,pcs={};for(const k in F.pieces){const p=F.pieces[k];pcs[k]={off:p.off,axis:p.axis,ang:p.ang};}
  b3EmitMech(G3.dyn,F.model,{...F.pose,pieces:pcs,dim:.6,char:clamp(F.t*.9,0,.55)});}
 for(const b of bullets)if(b.b3)b3EmitProjectile(b);
}
function b3Render(){
 if(!R3.ok)return;
 const t0=performance.now(),size=b3ResizeCanvases();
 if(!W3.hgt){b3Generate(b3FieldIndex(),7);b3BuildWorldMesh();}
 if(player&&player.h==null&&W3.hgt){player.x=W3.spawnP.x;player.y=W3.spawnP.z;player.h=b3Ground(player.x,player.y)+HOVER;}
 if(enemy&&enemy.h==null&&W3.hgt){enemy.x=W3.spawnE.x;enemy.y=W3.spawnE.z;enemy.h=b3Ground(enemy.x,enemy.y)+HOVER+24;}
 for(const o of [player,enemy])if(o&&!o.v3){o.v3=[0,0,0];o.en=1;o.yaw=o.enemy?Math.PI:0;o.lean=o.bank=o.legSwing=o.gunPitch=0;o.dashT=0;}
 G3.dyn.n=G3.unA.n=G3.unAdd.n=G3.ptA.n=G3.ptAdd.n=0;
 if(state==='finisher'&&BS.debris)b3FinisherCamera(size);
 else if(state==='fight'){if(!BS.camEye||menuOpen&&!R3.cam.vp[15])b3CameraUpdate(1/60,size);}
 else if(state==='ready'&&player&&enemy&&enemy.v3){b3CameraUpdate(1/30,size);}
 else b3IdleCamera(size);
 b3EmitActors();b3EmitWorldFx();
 try{b3DrawScene();}catch(e){R3.err=String(e);console.error(e);}
 b3DrawHUD(size);
 // Adaptive resolution: drop scale while frames are slow during battle.
 const now=performance.now(),ft=now-(R3.lastT||now);R3.lastT=now;
 if(ft>0&&ft<1000){R3.fpsAvg+=(1000/ft-R3.fpsAvg)*.05;}
 if(B3.tune.autoQuality&&state==='fight'){R3.fpsSamples++;
  if(R3.fpsSamples>90&&R3.fpsAvg<40&&R3.autoScale>.5){R3.autoScale=Math.max(.5,R3.autoScale*.86);R3.fpsSamples=0;}
  else if(R3.fpsSamples>300&&R3.fpsAvg>57&&R3.autoScale<1){R3.autoScale=Math.min(1,R3.autoScale*1.08);R3.fpsSamples=0;}}
 R3.frame++;R3.lastCost=performance.now()-t0;
}

// ------------------------------------------------------------------ HUD ---
function b3DrawHUD(size){
 const g=ctx,W=canvas.width,H=canvas.height,k=W/Math.max(1,size.cssW),u=Math.min(W,H)/700;
 g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,W,H);
 if(state==='finisher'&&BS.fade>0){g.fillStyle=(finishSequence?.kind==='win'?'rgba(255,255,255,':'rgba(0,0,0,')+BS.fade+')';g.fillRect(0,0,W,H);}
 if(state!=='fight'||!player||!enemy)return;
 const cx=W/2,cy=H/2,rr=BS.reticleR,lock=BS.lock,e=enemy;
 g.lineCap='round';
 // Damage direction arcs (relative to camera heading).
 for(const d of BS.dmgDirs){const a=d.a-BS.camYaw-Math.PI/2,al=clamp(d.t/.7,0,1);g.strokeStyle=`rgba(255,90,90,${.75*al})`;g.lineWidth=7*u;g.beginPath();g.arc(cx,cy,H*.26,a-.32,a+.32);g.stroke();}
 // Opponent marker / off-screen arrow.
 const es=BS.enemyScr,on=es&&es.x>8&&es.x<W-8&&es.y>8&&es.y<H-8;
 const red=lock?'#ffc36e':BS.los?'#ff8f8f':'#c4a3ad';
 if(on){const s=clamp(BS.enemyScrR*1.25,10*u,90*u),len=Math.max(6*u,s*.38);
  g.strokeStyle=red;g.lineWidth=(lock?3.2:2)*u;if(!BS.los)g.setLineDash([4*u,4*u]);
  for(const sx of [-1,1])for(const sy of [-1,1]){g.beginPath();g.moveTo(es.x+sx*s,es.y+sy*(s-len));g.lineTo(es.x+sx*s,es.y+sy*s);g.lineTo(es.x+sx*(s-len),es.y+sy*s);g.stroke();}
  g.setLineDash([]);
  if(!BS.los){g.beginPath();g.moveTo(es.x,es.y-7*u);g.lineTo(es.x+7*u,es.y);g.lineTo(es.x,es.y+7*u);g.lineTo(es.x-7*u,es.y);g.closePath();g.stroke();}
  const bw=Math.max(40*u,s*2),bh=4*u,by=es.y-s-11*u;g.fillStyle='rgba(20,10,14,.65)';g.fillRect(es.x-bw/2,by,bw,bh);g.fillStyle='#ff7d86';g.fillRect(es.x-bw/2,by,bw*clamp(e.hp/e.maxHp,0,1),bh);
  // relative height tick
  const dh=e.h-player.h;if(Math.abs(dh)>40){g.fillStyle=red;const yy=es.y+(dh>0?-s-20*u:s+14*u),dir=dh>0?-1:1;g.beginPath();g.moveTo(es.x-6*u,yy);g.lineTo(es.x+6*u,yy);g.lineTo(es.x,yy+dir*8*u);g.closePath();g.fill();}
 }else{const cs=b3CamSpace([e.x,e.h,e.y]);let ax=cs[0],ay=-cs[1];if(cs[2]<0&&Math.hypot(ax,ay)<1){ax=0;ay=1;}
  const ang=Math.atan2(ay,ax),rx=W/2-34*u,ry=H/2-34*u,t=Math.min(rx/Math.abs(Math.cos(ang)||1e-6),ry/Math.abs(Math.sin(ang)||1e-6)),px=cx+Math.cos(ang)*t,py=cy+Math.sin(ang)*t;
  g.save();g.translate(px,py);g.rotate(ang);g.fillStyle='#ff8f8f';g.globalAlpha=.6+.4*Math.sin(clock*8);g.beginPath();g.moveTo(16*u,0);g.lineTo(-10*u,-11*u);g.lineTo(-5*u,0);g.lineTo(-10*u,11*u);g.closePath();g.fill();g.restore();g.globalAlpha=1;}
 // Reticle: shape and colour encode no-lock / blocked / out of range / locked.
 const blocked=BS.inReticle&&!BS.los,far=BS.inReticle&&BS.los&&!BS.inRange;
 g.strokeStyle=lock?'#ffc36e':blocked?'#9aa3ab':far?'#e8c78a':'#8ff5ee';g.lineWidth=(lock?3:1.8)*u;
 if(far)g.setLineDash([3*u,5*u]);
 const rot=lock?clock*2.4:0;for(let q=0;q<4;q++){const a=rot+q*Math.PI/2+.32;g.beginPath();g.arc(cx,cy,rr,a,a+Math.PI/2-.64);g.stroke();}
 g.setLineDash([]);
 if(lock){for(let q=0;q<4;q++){const a=rot+q*Math.PI/2;g.beginPath();g.moveTo(cx+Math.cos(a)*(rr+3*u),cy+Math.sin(a)*(rr+3*u));g.lineTo(cx+Math.cos(a)*(rr-7*u),cy+Math.sin(a)*(rr-7*u));g.stroke();}}
 g.fillStyle=g.strokeStyle;g.beginPath();g.arc(cx,cy,2*u,0,Math.PI*2);g.fill();
 if(blocked){g.lineWidth=2.4*u;g.beginPath();g.moveTo(cx-rr*.6,cy+rr*.6);g.lineTo(cx+rr*.6,cy-rr*.6);g.stroke();}
 if(BS.hitMark>0){g.strokeStyle=`rgba(255,240,200,${BS.hitMark/.14})`;g.lineWidth=2.2*u;const a=7*u,b=14*u;for(const [sx,sy] of [[1,1],[1,-1],[-1,1],[-1,-1]]){g.beginPath();g.moveTo(cx+sx*a,cy+sy*a);g.lineTo(cx+sx*b,cy+sy*b);g.stroke();}}
 // Ammo arc (below) and reload progress ring (outside).
 const mag=player.stats.mag,ammo=player.ammo,arcR=rr+12*u;
 if(player.reloadLeft>0){g.strokeStyle='rgba(255,255,255,.85)';g.lineWidth=3*u;g.beginPath();g.arc(cx,cy,arcR,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-player.reloadLeft/player.reloadTotal));g.stroke();}
 else{const span=Math.PI*.5,start=Math.PI/2+span/2;g.lineWidth=3*u;
  if(mag<=12){for(let i=0;i<mag;i++){const a=start-span*(i+.5)/mag;g.strokeStyle=i<ammo?'rgba(190,250,245,.9)':'rgba(120,140,150,.35)';g.beginPath();g.arc(cx,cy,arcR,a-span/mag*.32,a+span/mag*.32);g.stroke();}}
  else{g.strokeStyle='rgba(120,140,150,.35)';g.beginPath();g.arc(cx,cy,arcR,start-span,start);g.stroke();g.strokeStyle='rgba(190,250,245,.9)';g.beginPath();g.arc(cx,cy,arcR,start-span*ammo/mag,start);g.stroke();}}
 // Auto-fire state: a small filled pip right of the reticle when ON.
 g.fillStyle=B3.tune.autoFire?'#8ff5ee':'rgba(140,160,170,.5)';g.beginPath();g.arc(cx+rr+20*u,cy-rr*.7,3.2*u,0,Math.PI*2);g.fill();
 // Altitude ladder (right of the reticle): own height above ground + opponent's.
 const lx=cx+rr+46*u,lh=110*u,ly=cy+lh/2,gp=b3Ground(player.x,player.y),altP=clamp((player.h-gp)/CEIL_REL,0,1),altE=clamp((e.h-gp)/CEIL_REL,-.2,1.2);
 g.strokeStyle='rgba(180,230,235,.35)';g.lineWidth=1.5*u;g.beginPath();g.moveTo(lx,ly);g.lineTo(lx,ly-lh);g.stroke();
 for(let i=0;i<=4;i++){g.beginPath();g.moveTo(lx-3*u,ly-lh*i/4);g.lineTo(lx+3*u,ly-lh*i/4);g.stroke();}
 g.fillStyle='#8ff5ee';g.beginPath();g.moveTo(lx-2*u,ly-lh*altP);g.lineTo(lx-11*u,ly-lh*altP-5*u);g.lineTo(lx-11*u,ly-lh*altP+5*u);g.closePath();g.fill();
 g.fillStyle='#ff8f8f';const ey=ly-lh*clamp(altE,0,1);g.beginPath();g.moveTo(lx+2*u,ey);g.lineTo(lx+11*u,ey-5*u);g.lineTo(lx+11*u,ey+5*u);g.closePath();g.fill();
 // Player gauges (top-left, below the menu buttons): HP, EN, dash.
 const gx=14*k,gy=70*k,gw=Math.min(190*k,W*.36),hh=7*u;
 g.fillStyle='rgba(6,16,26,.6)';g.fillRect(gx-3*u,gy-3*u,gw+6*u,hh*2+18*u);
 g.fillStyle='#0d2633';g.fillRect(gx,gy,gw,hh);const hpF=clamp(player.hp/player.maxHp,0,1);g.fillStyle=hpF<.3?'#ff8a7a':'#7be8d6';g.fillRect(gx,gy,gw*hpF,hh);
 g.fillStyle='#2b2610';g.fillRect(gx,gy+hh+5*u,gw*.8,hh*.6);g.fillStyle=player.en<.15?'#ff9d5c':'#ffd27a';g.fillRect(gx,gy+hh+5*u,gw*.8*player.en,hh*.6);
 const dashR=player.dashCooldown<=0;g.fillStyle=dashR?'#9cf6ff':'rgba(120,140,150,.5)';g.beginPath();g.moveTo(gx+gw*.84,gy+hh+2*u);g.lineTo(gx+gw*.84+8*u,gy+hh+6*u);g.lineTo(gx+gw*.84,gy+hh+10*u);g.closePath();g.fill();
 g.beginPath();g.moveTo(gx+gw*.84+7*u,gy+hh+2*u);g.lineTo(gx+gw*.84+15*u,gy+hh+6*u);g.lineTo(gx+gw*.84+7*u,gy+hh+10*u);g.closePath();g.fill();
 // Status icons as coloured pips (stun / slow / burn / sunder).
 let sx=gx;for(const [key,col] of [['stun','#fff27a'],['slow','#7ab8ff'],['burn','#ff8a4a'],['sunder','#c79bff']])if(player.status[key]>0){g.fillStyle=col;g.fillRect(sx,gy+hh*2+10*u,8*u,4*u);sx+=12*u;}
 // Opponent HP (top centre).
 const ew=Math.min(300*u,W*.42,W-250*k),ex=cx-ew/2,eyy=24*k;g.fillStyle='rgba(20,8,12,.65)';g.fillRect(ex-2*u,eyy-2*u,ew+4*u,8*u+4*u);g.fillStyle='#ff7d86';g.fillRect(ex,eyy,ew*clamp(e.hp/e.maxHp,0,1),8*u);
 if(currentNode==='boss'){g.fillStyle='#ffc36e';for(let i=0;i<3;i++){g.beginPath();g.moveTo(ex-14*u-i*9*u,eyy+4*u);g.lineTo(ex-9*u-i*9*u,eyy-1*u);g.lineTo(ex-4*u-i*9*u,eyy+4*u);g.lineTo(ex-9*u-i*9*u,eyy+9*u);g.closePath();g.fill();}}
 // Radar (top-right): arena edge, cover, opponent, missiles; up = camera heading.
 const rR=Math.min(58*u,W*.13),rx=W-rR-14*k,ry=rR+16*k,sc=rR/1700,ca=-BS.camYaw-Math.PI/2;
 const toR=(x,z)=>{const dx=(x-player.x)*sc,dz=(z-player.y)*sc,c=Math.cos(ca),s=Math.sin(ca);return [rx+dx*c-dz*s,ry+dx*s+dz*c];};
 g.save();g.beginPath();g.arc(rx,ry,rR,0,Math.PI*2);g.fillStyle='rgba(6,18,28,.62)';g.fill();g.clip();
 g.strokeStyle='rgba(143,245,238,.55)';g.lineWidth=1.6*u;g.beginPath();const c0=toR(0,0);g.arc(c0[0],c0[1],W3.radius*sc,0,Math.PI*2);g.stroke();
 g.fillStyle='rgba(160,190,200,.35)';for(const o of W3.obs){const p=toR(o.x,o.z);if(Math.hypot(p[0]-rx,p[1]-ry)>rR+8)continue;g.beginPath();g.arc(p[0],p[1],Math.max(1.5,o.br*sc),0,Math.PI*2);g.fill();}
 for(const b of bullets)if(b.homing&&b.source!==player&&b.b3){const p=toR(b.x,b.y);g.fillStyle='#ffd27a';g.fillRect(p[0]-1.5*u,p[1]-1.5*u,3*u,3*u);}
 const ep=toR(e.x,e.y);g.fillStyle='#ff6d78';g.beginPath();g.arc(ep[0],ep[1],4*u,0,Math.PI*2);g.fill();
 g.fillStyle='#8ff5ee';g.beginPath();g.moveTo(rx,ry-6*u);g.lineTo(rx+4.5*u,ry+5*u);g.lineTo(rx-4.5*u,ry+5*u);g.closePath();g.fill();
 g.restore();g.strokeStyle='rgba(143,245,238,.4)';g.lineWidth=1.2*u;g.beginPath();g.arc(rx,ry,rR,0,Math.PI*2);g.stroke();
 // Missile warning: pulsing triangles at the edges toward inbound missiles.
 for(const b of bullets){if(!(b.homing&&b.source!==player&&b.b3))continue;const d=Math.hypot(b.x-player.x,b.y-player.y);if(d>650)continue;
  const cs=b3CamSpace([b.x,b.h,b.y]),ang=Math.atan2(-cs[1],cs[0]),r=Math.min(W,H)*.32;g.save();g.translate(cx+Math.cos(ang)*r,cy+Math.sin(ang)*r);g.rotate(ang);
  g.globalAlpha=.55+.45*Math.sin(clock*18);g.fillStyle='#ffd27a';g.beginPath();g.moveTo(12*u,0);g.lineTo(-6*u,-9*u);g.lineTo(-6*u,9*u);g.closePath();g.fill();g.restore();}
 g.globalAlpha=1;
}

// --------------------------------------------------------- touch / mouse --
(function b3InitControls(){
 const st=document.createElement('style');st.textContent=`
 #b3Touch{display:none;position:fixed;inset:0;z-index:6;pointer-events:none;user-select:none;-webkit-user-select:none}
 .shell.b3Battle.b3TouchOn #b3Touch{display:block}
 .shell.b3Battle .mobilePad,.shell.b3Battle #ammoHud,.shell.b3Battle .controls{display:none!important}
 .b3Stick{position:absolute;bottom:calc(18px + env(safe-area-inset-bottom));width:clamp(104px,28vw,138px);height:clamp(104px,28vw,138px);border-radius:50%;
  border:2px solid #7fdfe6a6;background:radial-gradient(circle,#123049b8,#0a1a2ca8);pointer-events:auto;touch-action:none;box-shadow:0 0 18px #2be6f120}
 .b3Stick i{position:absolute;left:50%;top:50%;width:42%;height:42%;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#7fd6dbd0,#26607cc8);border:2px solid #d4fbff;pointer-events:none}
 #b3MoveStick{left:calc(16px + env(safe-area-inset-left))}#b3LookStick{right:calc(16px + env(safe-area-inset-right))}
 #b3LookStick{border-color:#e6d6a6a6}#b3LookStick i{background:radial-gradient(circle,#d8c79ad0,#6a5a3cc8);border-color:#fff3d0}
 .b3Btn{position:absolute;display:grid;place-items:center;width:52px;height:52px;border-radius:50%;border:1.5px solid #8fd9e6b0;background:#0f2a40d0;color:#dffbff;
  font:600 22px/1 system-ui,sans-serif;pointer-events:auto;touch-action:none;padding:0}
 .b3Btn.on{background:#e6c48c;color:#122334}
 #b3Fire{width:66px;height:66px;font-size:30px;right:calc(28px + clamp(104px,28vw,138px));bottom:calc(26px + env(safe-area-inset-bottom));border-color:#ffd59a}
 #b3Dash{right:calc(22px + clamp(104px,28vw,138px));bottom:calc(104px + env(safe-area-inset-bottom))}
 #b3Rise{right:calc(28px + env(safe-area-inset-right));bottom:calc(30px + clamp(104px,28vw,138px))}
 #b3Desc{right:calc(86px + env(safe-area-inset-right));bottom:calc(30px + clamp(104px,28vw,138px));width:44px;height:44px;font-size:18px}
 #b3Reload{left:calc(30px + clamp(104px,28vw,138px));bottom:calc(22px + env(safe-area-inset-bottom));width:44px;height:44px;font-size:20px}
 @media (orientation:landscape) and (max-height:500px){.b3Stick{width:112px;height:112px;bottom:12px}#b3Fire{right:144px;bottom:16px;width:58px;height:58px}#b3Dash{right:140px;bottom:84px}#b3Rise{right:22px;bottom:136px}#b3Desc{right:78px;bottom:140px}#b3Reload{left:140px;bottom:14px}}
 #b3Lab{position:fixed;top:max(12px,env(safe-area-inset-top));left:calc(max(12px,env(safe-area-inset-left)) + 56px);z-index:24;width:44px;height:44px;border-radius:12px;border:1px solid #76cfe5a1;background:#09243fdb;color:#dff;font-size:21px;cursor:pointer;display:grid;place-items:center;padding:0}
 #b3Lab.on{background:#b6dfd3;color:#122b39}
 #b3Panel{display:none;position:fixed;z-index:44;right:0;top:0;bottom:0;width:min(420px,96vw);padding:20px 18px 26px;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;
  background:linear-gradient(165deg,#132539f9,#101a29fb 65%,#101a28fc);border-left:1px solid #54768b;box-shadow:-20px 0 65px #020910d6;color:#e5f5f5;font-family:system-ui,'Noto Sans JP',sans-serif}
 #b3Panel.open{display:block}#b3Panel *{box-sizing:border-box}
 #b3Panel h2{font-size:17px;margin:4px 0 6px;letter-spacing:.04em}#b3Panel p{font-size:11.5px;line-height:1.6;color:#aac6d0;margin:4px 0 10px}
 #b3Panel .row{display:grid;grid-template-columns:1fr auto;gap:8px;margin:13px 0 3px}#b3Panel label{font-size:12px;font-weight:650;color:#d5e4e8}
 #b3Panel output{font:700 12px ui-monospace,monospace;color:#f0cb91;min-width:54px;text-align:right}
 #b3Panel input[type=range]{width:100%;accent-color:#8cddd2;height:24px;touch-action:pan-y}
 #b3Panel select{width:100%;background:#1b3449;border:1px solid #537084;color:#e1f5f5;padding:8px;border-radius:7px;min-height:38px}
 #b3Panel input[type=checkbox]{width:22px;height:22px;accent-color:#8cddd2}
 #b3Panel button{font:700 12px system-ui;cursor:pointer;min-height:36px;padding:8px 11px;border-radius:7px;border:1px solid #5a7f8a;background:#182d43;color:#d1e9ec}
 #b3Panel .btns{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}#b3Panel .primary{background:#8fdcd1;color:#0c2734;border:0;flex:1}
 #b3Panel .tabs{display:flex;gap:4px;position:sticky;top:-20px;background:#112033;padding:8px 0;z-index:2}#b3Panel .tabs button{flex:1;font-size:11px;padding:7px 3px}
 #b3Panel .tabs button.active{background:#c0dcd6;color:#102432}
 #b3Panel textarea{width:100%;height:170px;background:#081722;color:#c4f2e5;border:1px solid #415f70;font:11px/1.5 ui-monospace,monospace;padding:9px;border-radius:8px}
 #b3Panel .keys{font-size:11.5px;line-height:1.75;color:#cfe3e8;background:#0b1b2c;border:1px solid #2b4558;border-radius:8px;padding:8px 10px}
 `;document.head.appendChild(st);
 const wrap=document.createElement('div');wrap.id='b3Touch';
 wrap.innerHTML=`<div class="b3Stick" id="b3MoveStick" aria-label="移動スティック"><i></i></div><div class="b3Stick" id="b3LookStick" aria-label="視点スティック"><i></i></div>
 <button class="b3Btn" id="b3Fire" type="button" aria-label="射撃（押している間）">◎</button><button class="b3Btn" id="b3Dash" type="button" aria-label="ダッシュ">»</button>
 <button class="b3Btn" id="b3Rise" type="button" aria-label="上昇（押している間）">▲</button><button class="b3Btn" id="b3Desc" type="button" aria-label="下降（押している間）">▼</button>
 <button class="b3Btn" id="b3Reload" type="button" aria-label="リロード">↻</button>`;
 document.querySelector('.shell').appendChild(wrap);
 const touchCapable=()=>matchMedia('(pointer:coarse)').matches||(navigator.maxTouchPoints||0)>0;
 const stick=(id,fx)=>{const el=document.getElementById(id),th=el.querySelector('i');let pid=null;
  const set=e=>{const r=el.getBoundingClientRect(),rad=r.width*.36;let dx=(e.clientX-r.left-r.width/2)/rad,dy=(e.clientY-r.top-r.height/2)/rad;const l=Math.hypot(dx,dy);if(l>1){dx/=l;dy/=l;}
   const dead=.12,m=Math.hypot(dx,dy),s=m<dead?0:(m-dead)/(1-dead)/m;fx(dx*s,dy*s);th.style.transform=`translate(calc(-50% + ${dx*rad}px),calc(-50% + ${dy*rad}px))`;};
  el.addEventListener('pointerdown',e=>{if(pid!==null)return;pid=e.pointerId;el.setPointerCapture(pid);set(e);e.preventDefault();});
  el.addEventListener('pointermove',e=>{if(e.pointerId===pid){set(e);e.preventDefault();}});
  const end=e=>{if(e.pointerId!==pid)return;pid=null;fx(0,0);th.style.transform='translate(-50%,-50%)';};
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,end);};
 stick('b3MoveStick',(x,y)=>{BS.touch.mx=x;BS.touch.my=y;});
 stick('b3LookStick',(x,y)=>{BS.touch.lx=x;BS.touch.ly=y;});
 const hold=(id,key)=>{const el=document.getElementById(id);const on=e=>{e.preventDefault();try{el.setPointerCapture(e.pointerId)}catch(_e){}BS.touch[key]=true;el.classList.add('on');};
  const off=()=>{BS.touch[key]=false;el.classList.remove('on');};el.addEventListener('pointerdown',on);for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,off);};
 hold('b3Fire','fire');hold('b3Rise','rise');hold('b3Desc','desc');
 document.getElementById('b3Dash').addEventListener('pointerdown',e=>{e.preventDefault();wantsDash=true;});
 document.getElementById('b3Reload').addEventListener('pointerdown',e=>{e.preventDefault();startReload(player);});
 // Mouse: drag to look (left = also manual fire, right = look only).
 canvas.addEventListener('contextmenu',e=>{if(b3Battle())e.preventDefault();});
 canvas.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||state!=='fight')return;if(e.button===2)fireMouse=false;BS.drag={x:e.clientX,y:e.clientY,moved:false};});
 canvas.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||!BS.drag||state!=='fight')return;const dx=e.clientX-BS.drag.x,dy=e.clientY-BS.drag.y;
  if(Math.abs(dx)+Math.abs(dy)>0){const s=B3.tune.mouseSensitivity;BS.camYaw+=dx*.0042*s;BS.camPitch=clamp(BS.camPitch-dy*.0036*s*(B3.tune.invertY?-1:1),-.95,.95);BS.drag.moved=true;BS.manualUntil=clock+B3.tune.manualReturn;}
  BS.drag.x=e.clientX;BS.drag.y=e.clientY;});
 window.addEventListener('pointerup',e=>{if(e.pointerType==='mouse')BS.drag=null;});
 window.addEventListener('blur',()=>{Object.assign(BS.touch,{mx:0,my:0,lx:0,ly:0,fire:false,rise:false,desc:false});BS.drag=null;});
 window.addEventListener('keydown',e=>{if(['KeyC','KeyJ','KeyK','KeyF'].includes(e.code)&&state==='fight'&&!e.target.closest('input,textarea,select'))e.preventDefault();});
 // In battle, Space/Enter must never "press" a focused (possibly hidden) button: Space is the rise key.
 for(const ev of ['keydown','keyup'])window.addEventListener(ev,e=>{if(state==='fight'&&(e.code==='Space'||e.code==='Enter')&&e.target.closest&&e.target.closest('button')&&!e.target.closest('#b3Panel')){e.preventDefault();}},true);
 BS.touchCapable=touchCapable;
 if(!R3.ok)wrap.remove();
})();

// ------------------------------------------------------------ tuning lab --
(function b3InitLab(){
 if(!R3.ok)return;
 const btn=document.createElement('button');btn.id='b3Lab';btn.type='button';btn.textContent='⚙';btn.setAttribute('aria-label','操作感の調整パネル（Tキー）');
 const panel=document.createElement('aside');panel.id='b3Panel';panel.setAttribute('aria-label','操作感の調整パネル');
 document.body.append(btn,panel);
 let tab=0,open=false;
 const fmt=(v,s)=>(Number.isInteger(v)?v:Number(v).toFixed(2).replace(/0+$/,'').replace(/\.$/,''))+(s||'');
 const exportText=()=>JSON.stringify({game:'PATROL_ROBO_SALVAGE',version:'hover-lab-v'+B3_VERSION,settings:{...B3.tune}},null,2);
 const set=(k,v)=>{B3.tune[k]=v;b3SaveTune();
  if(k==='weapon'&&BS.labSession&&player&&state==='fight'){player.load.weapon=part('weapon',v);player.stats=specs(player.load,true);player.ammo=player.stats.mag;player.reloadLeft=0;player.cd=0;b3PrepareModels();}
  if(k==='renderScale')R3.autoScale=1;};
 const build=()=>{
  panel.innerHTML=`<h2>HOVER COMBAT LAB v${B3_VERSION}</h2><p>戦闘中に数値を変えると即時に反映され、この端末に保存されます。「設定共有」タブからJSONをコピーして送れます。</p>
  <div class="btns"><button class="primary" id="b3Launch">試験戦闘を開始</button><button id="b3Close">閉じる</button></div>
  <p>試験戦闘は進行中のランを破棄し、自機が被弾しない練習戦です（敵HPは4割で回復）。</p>
  <div class="tabs">${B3_FIELDS.map((f,i)=>`<button data-tab="${i}" class="${i===tab?'active':''}">${f[0]}</button>`).join('')}<button data-tab="9" class="${tab===9?'active':''}">設定共有</button></div><div id="b3Ctl"></div>`;
  panel.querySelector('#b3Launch').onclick=()=>{b3StartLab();show(false);};
  panel.querySelector('#b3Close').onclick=()=>show(false);
  panel.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=Number(b.dataset.tab);build();});
  const host=panel.querySelector('#b3Ctl');
  if(tab===9){host.innerHTML=`<p>この内容をコピーし、「この設定でお願いします」と一緒に送ってください。</p><textarea id="b3Json" spellcheck="false" aria-label="調整設定JSON"></textarea>
   <div class="btns"><button class="primary" id="b3Copy">設定をコピー</button><button id="b3Save">JSON保存</button><button id="b3Reset">初期値に戻す</button></div><p id="b3Note"></p>
   <div class="keys"><b>PC</b>　WASD 移動／矢印・ドラッグ 視点／Space 上昇／C 下降／Shift ダッシュ／J・左クリック 手動射撃／R リロード／T このパネル<br>
   <b>スマホ</b>　左スティック 移動／右スティック 視点／◎ 手動射撃／» ダッシュ／▲▼ 上昇・下降／↻ リロード<br>
   自動射撃ON：敵が中央の照準円に入り、射線が通り、射程内の時だけ撃ちます。手動射撃は照準の方向へいつでも撃てます（ロック中は敵を狙います）。</div>`;
   const ta=host.querySelector('#b3Json');ta.value=exportText();
   host.querySelector('#b3Copy').onclick=async()=>{ta.value=exportText();let ok=false;try{await navigator.clipboard.writeText(ta.value);ok=true;}catch(_e){}
    if(!ok){ta.focus();ta.select();try{ok=document.execCommand('copy')}catch(_e){}}host.querySelector('#b3Note').textContent=ok?'コピーしました':'全選択しました。コピーして送ってください。';};
   host.querySelector('#b3Save').onclick=()=>{const blob=new Blob([exportText()],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='patrol-hover-settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
   host.querySelector('#b3Reset').onclick=()=>{if(!confirm('設定をすべて初期値に戻しますか？'))return;Object.assign(B3.tune,B3_DEFAULT);b3SaveTune();build();};
   return;}
  for(const [key,label,min,max,step,suf] of B3_FIELDS[tab][1]){
   const row=document.createElement('div');row.className='row';const id='b3_'+key;
   if(min==='bool'){row.innerHTML=`<label for="${id}">${label}</label><input type="checkbox" id="${id}" ${B3.tune[key]?'checked':''}>`;host.appendChild(row);row.querySelector('input').onchange=e=>set(key,e.target.checked);continue;}
   if(min==='weapon'||min==='biome'){row.innerHTML=`<label for="${id}">${label}</label>`;host.appendChild(row);const sel=document.createElement('select');sel.id=id;
    (min==='weapon'?DEF.weapon.map(w=>[w.id,w.name]):B3_BIOMES.map((b,i)=>[i,b.name])).forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;sel.appendChild(o);});
    sel.value=String(B3.tune[key]);sel.onchange=()=>set(key,min==='biome'?Number(sel.value):sel.value);host.appendChild(sel);continue;}
   row.innerHTML=`<label for="${id}">${label}</label><output>${fmt(B3.tune[key],suf)}</output>`;host.appendChild(row);
   const r=document.createElement('input');r.type='range';r.id=id;r.min=min;r.max=max;r.step=step;r.value=B3.tune[key];host.appendChild(r);
   r.oninput=()=>{set(key,Number(r.value));row.querySelector('output').textContent=fmt(B3.tune[key],suf);};}
 };
 const show=v=>{open=!!v;btn.classList.toggle('on',open);panel.classList.toggle('open',open);if(open)build();};
 btn.onclick=()=>show(!open);
 window.addEventListener('keydown',e=>{if(e.code==='KeyT'&&!e.repeat&&!e.target.closest('input,textarea,select')){e.preventDefault();show(!open);}else if(e.code==='Escape'&&open){show(false);}},true);
 panel.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea'))e.stopPropagation();},true);
 BS.showLab=show;
})();
function b3StartLab(){
 if(menuOpen)closeMenu();
 BS.labSession=false;beginRun();BS.labSession=true;currentNode='fight';
 if(B3.tune.weapon&&DEF.weapon.some(w=>w.id===B3.tune.weapon)){player.load.weapon=part('weapon',B3.tune.weapon);player.stats=specs(player.load,true);}
 startWave();state='fight';closeOverlay();setMusicMode('combat');
}

// ------------------------------------------------------------ integration --
const b3CoreUpdate=update,b3CoreRender=render,b3CoreMove=moveRobot,b3CoreDamage=damage,b3CoreBeginRun=beginRun,b3CoreShowRoute=showRoute;
if(R3.ok){
 update=function(dt){
  if(BS.qaHold&&!BS.qaStepping)return;
  const shell=document.querySelector('.shell');shell.classList.toggle('b3Battle',b3Battle());shell.classList.toggle('b3TouchOn',BS.touchCapable());
  if(state==='fight'&&BS.prevState!=='fight'){try{document.activeElement&&document.activeElement.blur&&document.activeElement.blur();}catch(_e){}}BS.prevState=state;
  b3Step(dt);
  if(BS.labSession&&state==='fight'&&enemy&&!enemy.dead&&enemy.hp<enemy.maxHp*.4)enemy.hp=enemy.maxHp;
  if(BS.labSession&&!['fight','ready','finisher'].includes(state))BS.labSession=false;
 };
 render=function(){b3Render();};
 moveRobot=function(o,dx,dy){if(b3Battle()&&o&&o.v3){o.v3[0]+=dx*7;o.v3[2]+=dy*7;return;}return b3CoreMove(o,dx,dy);};
 damage=function(t,n,...a){if(BS.labSession&&t===player)return;return b3CoreDamage(t,n,...a);};
 beginRun=function(...a){BS.labSession=false;return b3CoreBeginRun(...a);};
 document.title='PATROL × ROBO SALVAGE — HOVER COMBAT v'+B3_VERSION;
}
// Route map: dark board, three bright next nodes, dim future, mech token.
(function b3RouteStyle(){
 const st=document.createElement('style');st.textContent=`
 .routeDialog{background:#090e17!important;border-color:#566a7d!important;box-shadow:0 25px 80px #000e!important}
 .routeDialog .flag{color:#7db7c8!important}.routeDialog h2{letter-spacing:.2em!important;color:#e4e9f0!important}
 .routeDialog .mapWrap{background:#080d16!important;border:1px solid #2a3547!important;box-shadow:inset 0 0 50px #000d!important}
 .routeDialog .map-node:not(.completed):not(.current){opacity:.2!important}
 .routeDialog .map-node.current{filter:drop-shadow(0 0 9px #8be8e0)!important}
 .routeDialog .map-edge:not(.done):not(.active){opacity:.13!important}
 .routeDialog .map-edge.active{stroke:#93ddd7!important;stroke-width:4!important}`;document.head.appendChild(st);
})();
showRoute=function(){
 b3CoreShowRoute();
 const svg=document.querySelector('#mapScroll .mapBoard');if(!svg)return;
 const row=endlessRow(),p=row>0?{x:mapX(currentLane),y:mapY(Math.min(9,row-1))}:{x:320,y:MAP_START_Y};
 const ns='http://www.w3.org/2000/svg',g=document.createElementNS(ns,'g');
 g.setAttribute('transform',`translate(${p.x} ${p.y})`);g.setAttribute('style','pointer-events:none;filter:drop-shadow(0 0 9px #92f4f0)');
 for(const [tag,attrs] of [['path',{d:'M-22 2 L-10 -4 L-10 6 Z',fill:'#5f8fa3'}],['path',{d:'M22 2 L10 -4 L10 6 Z',fill:'#5f8fa3'}],
  ['rect',{x:-10,y:-11,width:20,height:20,rx:4,fill:'#b4e3e2',stroke:'#182c38','stroke-width':2}],['rect',{x:-7,y:-18,width:14,height:9,rx:3,fill:'#668d9b'}],
  ['rect',{x:-5,y:-15,width:10,height:3,fill:'#8cf9ff'}],['rect',{x:-8,y:9,width:5,height:9,fill:'#849fab'}],['rect',{x:3,y:9,width:5,height:9,fill:'#849fab'}],
  ['circle',{cx:-5.5,cy:20,r:2.5,fill:'#8ddfdc'}],['circle',{cx:5.5,cy:20,r:2.5,fill:'#8ddfdc'}]]){
  const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);g.appendChild(el);}
 svg.appendChild(g);
};

// --------------------------------------------------------------- QA hooks --
if(navigator.webdriver)window.__b3QA={
 get:()=>({version:B3_VERSION,state,gl:R3.ok,glError:R3.err,biome:W3.biome.id,obstacles:W3.obs.length,
  player:player&&{x:player.x,z:player.y,h:player.h,alt:player.h-b3Ground(player.x,player.y),v:player.v3,en:player.en,hp:player.hp,maxHp:player.maxHp,ammo:player.ammo,shots:player.shots,weapon:player.stats.weapon.id},
  enemy:enemy&&{x:enemy.x,z:enemy.y,h:enemy.h,alt:enemy.h-b3Ground(enemy.x,enemy.y),hp:enemy.hp,maxHp:enemy.maxHp,mode:enemy.ai?.mode,role:enemy.role,shots:enemy.shots,dead:enemy.dead},
  cam:{yaw:BS.camYaw,pitch:BS.camPitch,fov:BS.fov*180/Math.PI,dist:BS.dist,eye:R3.cam.eye,manual:BS.manualActive},
  lock:{lock:BS.lock,inReticle:BS.inReticle,los:BS.los,inRange:BS.inRange,track:BS.track,reticleR:BS.reticleR,firing:BS.firing},
  bullets:bullets.length,particles:BS.parts.length,fps:R3.fpsAvg,autoScale:R3.autoScale,cost:R3.lastCost,glSize:[R3.canvas.width,R3.canvas.height],hudSize:[canvas.width,canvas.height],stats:{...BS.stats},finish:finishSequence?{...finishSequence,target:undefined}:null}),
 frame:()=>{const W=canvas.width,H=canvas.height,pp=player&&b3Project(player.x,player.h,player.y),ep=enemy&&!enemy.dead&&b3Project(enemy.x,enemy.h,enemy.y);
  const inside=p=>!!p&&p.x>0&&p.x<W&&p.y>0&&p.y<H;
  return {W,H,player:pp&&{x:pp.x/W,y:pp.y/H},enemy:ep&&{x:ep.x/W,y:ep.y/H},visibleBoth:inside(pp)&&inside(ep),enemyNearCenter:!!ep&&Math.hypot(ep.x-W/2,ep.y-H/2)<H*.16,playerLow:!!pp&&pp.y/H>.55};},
 step:(n=1,dt=1/60)=>{BS.qaStepping=true;try{for(let i=0;i<n;i++)update(dt);}finally{BS.qaStepping=false;}render();return window.__b3QA.get();},
 hold:on=>{BS.qaHold=!!on;return BS.qaHold;},
 seed:n=>{BS.forceSeed=n;return n;},
 freezeAI:on=>{BS.freezeAI=!!on;},
 place:(who,x,z,alt)=>{const o=who==='enemy'?enemy:player;if(!o)return false;const p={x,y:b3Ground(x,z)+(alt??HOVER),z};b3Resolve(p,MECH_R,HOVER);o.x=p.x;o.y=p.z;o.h=p.y;o.v3=[0,0,0];BS.camEye=null;return true;},
 setCam:(yaw,pitch)=>{BS.camYaw=yaw;if(pitch!=null)BS.camPitch=pitch;BS.camEye=null;},
 setTune:(k,v)=>{B3.tune[k]=v;return B3.tune[k];},
 tune:()=>({...B3.tune}),
 lab:()=>{b3StartLab();return state;},
 biome:i=>{B3.tune.biome=i;b3StartLab();return W3.biome.id;},
 finish:(kind='win')=>{if(state!=='fight')return false;damage(kind==='win'?enemy:player,99999);return state;},
 obstacles:()=>W3.obs.map(o=>({t:o.t,x:o.x,z:o.z,y0:o.y0,y1:o.y1,br:o.br,mat:o.mat})),
 ground:(x,z)=>b3Ground(x,z),
 ray:(a,b)=>b3Ray(a[0],a[1],a[2],b[0],b[1],b[2]),
 sight:()=>b3Sight(player,enemy),
 fireAt:(who)=>{const s=who==='enemy'?enemy:player,t=s===player?enemy:player;s.cd=0;s.reloadLeft=0;s.ammo=Math.max(1,s.ammo);return b3Fire(s,t,[t.x,t.h,t.y]);},
 bulletsInfo:()=>bullets.map(b=>({kind:b.kind,src:b.source===player?'p':'e',x:b.x,z:b.y,h:b.h,life:b.life})),
 touch:(o)=>Object.assign(BS.touch,o),
 setWeapon:id=>{player.load.weapon=part('weapon',id);player.stats=specs(player.load,true);player.ammo=player.stats.mag;player.reloadLeft=0;b3PrepareModels();return player.stats.weapon.id;},
 setLoad:(who,parts)=>{const o=who==='enemy'?enemy:player;for(const [s,id] of Object.entries(parts))o.load[s]=part(s,id);o.stats=specs(o.load,who!=='enemy');b3PrepareModels();return true;}
};
