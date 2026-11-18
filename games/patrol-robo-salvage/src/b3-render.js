// ---------------------------------------------------------- renderer -----
// WebGL2 world (terrain, obstacles, mechs, projectiles, particles) under a
// transparent Canvas 2D HUD (#game). The HUD uses shapes only, no prose.
const R3={gl:null,ok:false,err:null,canvas:null,progs:{},bufs:{},static:null,frame:0,
 cam:{eye:[0,100,-200],f:[0,0,1],r:[1,0,0],u:[0,1,0],fov:1,aspect:1.6,vp:new Float32Array(16)},
 scale:1,autoScale:1,fpsAvg:60,fpsSamples:0,lastT:0,pointMax:64,builtWorld:-1};
(function b3InitGL(){
 const glc=document.createElement('canvas');glc.id='b3gl';glc.setAttribute('aria-hidden','true');
 $('arenaFrame').insertBefore(glc,canvas);R3.canvas=glc;
 const st=document.createElement('style');st.textContent=`
 #b3gl{position:absolute;inset:0;width:100%;height:100%;display:block;z-index:0;background:#0b1828}
 .arenaFrame #game{position:absolute;inset:0;z-index:1;background:transparent!important;image-rendering:auto!important;object-fit:fill!important}
 `;document.head.appendChild(st);
 let gl=null;try{gl=glc.getContext('webgl2',{antialias:true,alpha:false,depth:true,powerPreference:'high-performance',preserveDrawingBuffer:false});}catch(e){R3.err=String(e);}
 if(!gl){R3.err=R3.err||'WebGL2 unavailable';return;}
 R3.gl=gl;
 const VS_LIT=`#version 300 es
 in vec3 aPos;in vec3 aNrm;in vec4 aCol;uniform mat4 uVP;out vec3 vPos;out vec3 vN;out vec4 vCol;
 void main(){vPos=aPos;vN=aNrm;vCol=aCol;gl_Position=uVP*vec4(aPos,1.);}`;
 const FS_LIT=`#version 300 es
 precision highp float;in vec3 vPos;in vec3 vN;in vec4 vCol;
 uniform vec3 uSun,uSunCol,uSkyAmb,uGndAmb,uFog,uEye;uniform float uFogDen,uDetail,uAlpha;out vec4 o;
 float h1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h1(i),h1(i+vec2(1,0)),f.x),mix(h1(i+vec2(0,1)),h1(i+1.),f.x),f.y);}
 void main(){vec3 n=normalize(vN);vec3 c=vCol.rgb;
  if(uDetail>0.){float d=vn(vPos.xz*.05)*.55+vn(vPos.xz*.21)*.3+vn(vPos.xz*.9)*.15;c*=mix(1.,.8+.4*d,uDetail);
   float stripe=smoothstep(.0,.06,abs(fract(vPos.y*.045)-.5)-.44);c*=1.-uDetail*.07*stripe*(1.-n.y);}
  float dif=max(dot(n,uSun),0.);vec3 amb=mix(uGndAmb,uSkyAmb,n.y*.5+.5);
  vec3 v=normalize(uEye-vPos);float rim=pow(1.-max(dot(n,v),0.),3.);
  vec3 hv=normalize(uSun+v);float spec=pow(max(dot(n,hv),0.),24.)*.22*(1.-uDetail);
  float fill=(1.-step(.01,uDetail))*max(dot(n,v),0.)*.42;
  vec3 col=c*(amb*.84+uSunCol*dif*.86+fill)+uSunCol*spec+c*rim*(.22+.25*(1.-step(.01,uDetail)))+c*vCol.a*1.7;
  float dist=length(uEye-vPos);float f=1.-exp(-pow(dist*uFogDen,2.));
  col=mix(col,uFog,clamp(f,0.,1.)*(1.-vCol.a*.5));o=vec4(col,uAlpha);}`;
 const VS_UN=`#version 300 es
 in vec3 aPos;in vec4 aCol;uniform mat4 uVP;out vec4 vCol;out vec3 vPos;
 void main(){vCol=aCol;vPos=aPos;gl_Position=uVP*vec4(aPos,1.);}`;
 const FS_UN=`#version 300 es
 precision highp float;in vec4 vCol;in vec3 vPos;uniform vec3 uFog,uEye;uniform float uFogDen,uAdd;out vec4 o;
 void main(){float dist=length(uEye-vPos);float f=clamp(1.-exp(-pow(dist*uFogDen,2.)),0.,1.);
  vec3 c=mix(vCol.rgb,uFog,f*(1.-uAdd));float a=vCol.a*(1.-f*uAdd*.8);o=uAdd>.5?vec4(c*a,1.):vec4(c,a);}`;
 const VS_PT=`#version 300 es
 in vec3 aPos;in vec4 aCol;in float aSize;uniform mat4 uVP;uniform float uScale,uMax;out vec4 vCol;
 void main(){vec4 p=uVP*vec4(aPos,1.);gl_Position=p;gl_PointSize=clamp(aSize*uScale/max(p.w,1.),1.,uMax);vCol=aCol;}`;
 const FS_PT=`#version 300 es
 precision highp float;in vec4 vCol;uniform float uAdd;out vec4 o;
 void main(){vec2 q=gl_PointCoord*2.-1.;float r=dot(q,q);if(r>1.)discard;float a=(1.-r);a*=a*vCol.a;
  o=uAdd>.5?vec4(vCol.rgb*a,1.):vec4(vCol.rgb,a);}`;
 const VS_SKY=`#version 300 es
 in vec2 aPos;out vec2 vUv;void main(){vUv=aPos;gl_Position=vec4(aPos,.9999,1.);}`;
 const FS_SKY=`#version 300 es
 precision highp float;in vec2 vUv;uniform vec3 uF,uR,uU,uTop,uMid,uHor,uSun,uSunCol;uniform float uTan,uAsp,uStars;out vec4 o;
 float h1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 void main(){vec3 rd=normalize(uF+uR*vUv.x*uTan*uAsp+uU*vUv.y*uTan);float y=rd.y;
  vec3 c=y<.0?mix(uHor,uHor*.82,clamp(-y*4.,0.,1.)):(y<.22?mix(uHor,uMid,smoothstep(0.,.22,y)):mix(uMid,uTop,smoothstep(.22,.85,y)));
  float s=max(dot(rd,uSun),0.);c+=uSunCol*(smoothstep(.9994,.9997,s)*1.4+pow(s,60.)*.22+pow(s,5.)*.07);
  if(uStars>0.&&y>.02){vec2 g=floor(rd.xz/(y+.35)*260.);float st=step(.9965,h1(g));c+=vec3(.75,.85,1.)*st*uStars*(.4+.6*h1(g+7.))*smoothstep(.02,.2,y);}
  float band=smoothstep(.0,.05,y)*(1.-smoothstep(.05,.18,y));c=mix(c,uHor*1.05,band*.25);
  o=vec4(c,1.);}`;
 const compile=(t,s)=>{const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;};
 const prog=(v,f,attrs,unis)=>{const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,v));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,f));
  attrs.forEach((a,i)=>gl.bindAttribLocation(p,i,a));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
  const u={};for(const n of unis)u[n]=gl.getUniformLocation(p,n);return {p,u};};
 try{
  R3.progs.lit=prog(VS_LIT,FS_LIT,['aPos','aNrm','aCol'],['uVP','uSun','uSunCol','uSkyAmb','uGndAmb','uFog','uEye','uFogDen','uDetail','uAlpha']);
  R3.progs.un=prog(VS_UN,FS_UN,['aPos','aCol'],['uVP','uFog','uEye','uFogDen','uAdd']);
  R3.progs.pt=prog(VS_PT,FS_PT,['aPos','aCol','aSize'],['uVP','uScale','uMax','uAdd']);
  R3.progs.sky=prog(VS_SKY,FS_SKY,['aPos'],['uF','uR','uU','uTop','uMid','uHor','uSun','uSunCol','uTan','uAsp','uStars']);
  const range=gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);R3.pointMax=Math.min(96,range?range[1]:64);
  const mk=(layout)=>{const vao=gl.createVertexArray(),buf=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buf);
   let stride=layout.reduce((a,b)=>a+b,0)*4,off=0;layout.forEach((n,i)=>{gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,n,gl.FLOAT,false,stride,off);off+=n*4;});
   gl.bindVertexArray(null);return {vao,buf,count:0,stride:stride/4};};
  R3.bufs.sky=mk([2]);gl.bindBuffer(gl.ARRAY_BUFFER,R3.bufs.sky.buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  R3.bufs.terrain=mk([3,3,4]);R3.bufs.obst=mk([3,3,4]);R3.bufs.far=mk([3,3,4]);
  R3.bufs.dyn=mk([3,3,4]);R3.bufs.unA=mk([3,4]);R3.bufs.unAdd=mk([3,4]);R3.bufs.water=mk([3,4]);
  R3.bufs.ptA=mk([3,4,1]);R3.bufs.ptAdd=mk([3,4,1]);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
  R3.ok=true;
 }catch(e){R3.err=String(e);R3.ok=false;console.error('B3 GL init',e);}
})();

// Growable float arrays for per-frame geometry (avoid per-frame allocation).
class B3Buf{constructor(n=4096){this.a=new Float32Array(n);this.n=0;}
 need(k){if(this.n+k>this.a.length){const b=new Float32Array(Math.max(this.a.length*2,this.n+k));b.set(this.a.subarray(0,this.n));this.a=b;}}
 push10(x,y,z,nx,ny,nz,r,g,b,e){this.need(10);const a=this.a,i=this.n;a[i]=x;a[i+1]=y;a[i+2]=z;a[i+3]=nx;a[i+4]=ny;a[i+5]=nz;a[i+6]=r;a[i+7]=g;a[i+8]=b;a[i+9]=e;this.n+=10;}
 push7(x,y,z,r,g,b,al){this.need(7);const a=this.a,i=this.n;a[i]=x;a[i+1]=y;a[i+2]=z;a[i+3]=r;a[i+4]=g;a[i+5]=b;a[i+6]=al;this.n+=7;}
 push8(x,y,z,r,g,b,al,s){this.need(8);const a=this.a,i=this.n;a[i]=x;a[i+1]=y;a[i+2]=z;a[i+3]=r;a[i+4]=g;a[i+5]=b;a[i+6]=al;a[i+7]=s;this.n+=8;}
}
const G3={dyn:new B3Buf(60000),unA:new B3Buf(20000),unAdd:new B3Buf(20000),ptA:new B3Buf(12000),ptAdd:new B3Buf(16000)};
const v3={sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
 dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
 len:a=>Math.hypot(a[0],a[1],a[2]),norm:a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l]}};

// Lit triangle into a buffer (flat normal from the face).
function b3Tri(buf,a,b,c,col,e=0,n=null){
 if(!n){const u=v3.sub(b,a),w=v3.sub(c,a);n=v3.norm(v3.cross(u,w));}
 buf.push10(a[0],a[1],a[2],n[0],n[1],n[2],col[0],col[1],col[2],e);
 buf.push10(b[0],b[1],b[2],n[0],n[1],n[2],col[0],col[1],col[2],e);
 buf.push10(c[0],c[1],c[2],n[0],n[1],n[2],col[0],col[1],col[2],e);
}
function b3QuadOut(buf,a,b,c,d,col,center,e=0){
 let n=v3.norm(v3.cross(v3.sub(b,a),v3.sub(d,a)));
 const fc=[(a[0]+b[0]+c[0]+d[0])/4,(a[1]+b[1]+c[1]+d[1])/4,(a[2]+b[2]+c[2]+d[2])/4];
 if(center&&v3.dot(n,v3.sub(fc,center))<0)n=v3.mul(n,-1);
 b3Tri(buf,a,b,c,col,e,n);b3Tri(buf,a,c,d,col,e,n);
}
const b3Shade=(c,k)=>[Math.min(1,c[0]*k),Math.min(1,c[1]*k),Math.min(1,c[2]*k)];

// ------------------------------------------------------- static world ----
function b3BuildWorldMesh(){
 const gl=R3.gl,bi=W3.biome,n=W3.n,c=W3.cell,e=W3.extent,s=n+1,H=W3.hgt;
 const low=b3Hex(bi.ground[0]),mid=b3Hex(bi.ground[1]),high=b3Hex(bi.ground[2]),rock=b3Hex(bi.rock),acc=b3Hex(bi.accent);
 const T=new B3Buf(n*n*6*10+10);
 const vcol=(x,z,h,nrm)=>{
  const slope=1-nrm[1],t=b3Noise(x*.011,z*.011,W3.seed)*.6+b3Noise(x*.043,z*.043,W3.seed+3)*.4;
  let col=t<.5?[b3Mix(low[0],mid[0],t*2),b3Mix(low[1],mid[1],t*2),b3Mix(low[2],mid[2],t*2)]:[b3Mix(mid[0],high[0],t*2-1),b3Mix(mid[1],high[1],t*2-1),b3Mix(mid[2],high[2],t*2-1)];
  const rk=clamp(slope*2.6-.25,0,1);col=[b3Mix(col[0],rock[0],rk),b3Mix(col[1],rock[1],rk),b3Mix(col[2],rock[2],rk)];
  if(bi.id==='snow'){const sn=clamp((h-40)/120,0,1)*(1-rk*.7);col=[b3Mix(col[0],.95,sn),b3Mix(col[1],.97,sn),b3Mix(col[2],.98,sn)];}
  if(bi.id==='mountain'){const sn=clamp((h-210)/80,0,1);col=[b3Mix(col[0],.9,sn),b3Mix(col[1],.92,sn),b3Mix(col[2],.9,sn)];}
  if(bi.id==='city'||bi.id==='night'){const gx=Math.abs(((x%230)+230)%230-115),gz=Math.abs(((z%230)+230)%230-115);
   if(gx<12||gz<12){col=b3Shade(col,.72);}else if((gx<15||gz<15))col=bi.id==='night'?[b3Mix(col[0],acc[0],.35),b3Mix(col[1],acc[1],.35),b3Mix(col[2],acc[2],.35)]:b3Shade(acc,.55);}
  if(bi.id==='arena'){const r=Math.hypot(x,z),ring=Math.abs(((r%180)+180)%180-90);if(ring<3)col=b3Shade(acc,.6);}
  if(bi.id==='river'&&W3.water&&h<W3.water.y+6){const k=clamp((W3.water.y+6-h)/14,0,1);col=[b3Mix(col[0],.42,k),b3Mix(col[1],.4,k),b3Mix(col[2],.33,k)];}
  if(bi.id==='desert'){const ripple=.5+.5*Math.sin(x*.09+Math.sin(z*.02)*3);col=b3Shade(col,.95+.08*ripple);}
  return col;};
 const nrmAt=(i,j)=>{const a=H[Math.max(0,i-1)*s+j],b=H[Math.min(n,i+1)*s+j],cc=H[i*s+Math.max(0,j-1)],d=H[i*s+Math.min(n,j+1)];return v3.norm([a-b,2*c,cc-d]);};
 const R=W3.radius,detailR=R+560;
 for(let i=0;i<n;i++)for(let j=0;j<n;j++){
  const x0=-e+i*c,z0=-e+j*c;if(Math.hypot(x0+c/2,z0+c/2)>detailR+c)continue;
  const P=(ii,jj)=>[-e+ii*c,H[ii*s+jj],-e+jj*c];
  const p00=P(i,j),p10=P(i+1,j),p01=P(i,j+1),p11=P(i+1,j+1);
  const v=[[p00,i,j],[p10,i+1,j],[p01,i,j+1],[p10,i+1,j],[p11,i+1,j+1],[p01,i,j+1]];
  for(const [p,ii,jj] of v){const nr=nrmAt(ii,jj),col=vcol(p[0],p[2],p[1],nr);T.push10(p[0],p[1],p[2],nr[0],nr[1],nr[2],col[0],col[1],col[2],0);}
 }
 // Far ring: low-resolution mountains to the horizon (never reachable).
 const F=new B3Buf(80000),rings=[detailR-40,detailR+500,detailR+1300,detailR+2600,detailR+4600,detailR+8000],seg=72;
 const farH=(a,r,k)=>{if(k===0)return b3Ground(Math.cos(a)*r,Math.sin(a)*r)-6;const base=bi.id==='city'?120:bi.id==='arena'?140:260;
  return base*(.6+.9*b3Fbm(Math.cos(a)*3+k*.7,Math.sin(a)*3+k*.3,W3.seed+k,3))*(1-.12*k)+(bi.id==='desert'?-60:0);};
 for(let k=0;k<rings.length-1;k++)for(let q=0;q<seg;q++){
  const a0=q/seg*Math.PI*2,a1=(q+1)/seg*Math.PI*2,r0=rings[k],r1=rings[k+1];
  const P=(a,r,kk)=>[Math.cos(a)*r,farH(a,r,kk),Math.sin(a)*r];
  const A=P(a0,r0,k),B=P(a1,r0,k),C=P(a1,r1,k+1),D=P(a0,r1,k+1);
  const nn=v3.norm(v3.cross(v3.sub(D,A),v3.sub(B,A)));
  const col=k<1?mid:[b3Mix(mid[0],rock[0],.5),b3Mix(mid[1],rock[1],.5),b3Mix(mid[2],rock[2],.5)];
  for(const p of [A,B,C,A,C,D])F.push10(p[0],p[1],p[2],nn[0],nn[1]<0?-nn[1]:nn[1],nn[2],col[0],col[1],col[2],0);
 }
 // Obstacles: exactly the collision shapes, plus flush surface details.
 const O=new B3Buf(120000);
 for(const o of W3.obs){o.vStart=O.n/10;b3EmitObstacle(O,o);o.vCount=O.n/10-o.vStart;}
 const up=(b,buf)=>{gl.bindBuffer(gl.ARRAY_BUFFER,b.buf);gl.bufferData(gl.ARRAY_BUFFER,buf.a.subarray(0,buf.n),gl.STATIC_DRAW);b.count=buf.n/10;};
 up(R3.bufs.terrain,T);up(R3.bufs.far,F);up(R3.bufs.obst,O);
 // Water surface.
 const Wt=new B3Buf(64);
 if(W3.water){const y=W3.water.y,r=R+300,wc=b3Hex(W3.water.color);for(const p of [[-r,y,-r],[r,y,-r],[r,y,r],[-r,y,-r],[r,y,r],[-r,y,r]])Wt.push7(p[0],p[1],p[2],wc[0],wc[1],wc[2],.62);}
 gl.bindBuffer(gl.ARRAY_BUFFER,R3.bufs.water.buf);gl.bufferData(gl.ARRAY_BUFFER,Wt.a.subarray(0,Wt.n),gl.STATIC_DRAW);R3.bufs.water.count=Wt.n/7;
 R3.builtWorld=W3.version;
}
function b3EmitObstacle(O,o){
 const col=b3Hex(o.color),center=[o.x,(o.y0+o.y1)/2,o.z];
 if(o.t==='box'){
  const pt=(lx,y,lz)=>[o.x+lx*o.c-lz*o.s,y,o.z+lx*o.s+lz*o.c];
  const xs=[-o.hw,o.hw],zs=[-o.hd,o.hd];
  const b=[pt(xs[0],o.y0,zs[0]),pt(xs[1],o.y0,zs[0]),pt(xs[1],o.y0,zs[1]),pt(xs[0],o.y0,zs[1])];
  const t=[pt(xs[0],o.y1,zs[0]),pt(xs[1],o.y1,zs[0]),pt(xs[1],o.y1,zs[1]),pt(xs[0],o.y1,zs[1])];
  const top=o.mat==='deck'||o.mat==='bridge'?b3Shade(col,1.1):b3Shade(col,1.05);
  b3QuadOut(O,t[0],t[1],t[2],t[3],top,center);
  for(let k=0;k<4;k++){const k2=(k+1)%4;b3QuadOut(O,b[k],b[k2],t[k2],t[k],col,center);}
  // Windows: emissive strips placed 0.4 units outside the face (visually flush).
  if(o.windows){const wcol=W3.biome.id==='night'?b3Hex('#ffcf8a'):b3Hex('#9fe6f2'),rows=Math.floor((o.y1-o.y0-14)/22);
   for(let face=0;face<4;face++){const alongX=face%2===0,half=alongX?o.hw:o.hd,depth=(alongX?o.hd:o.hw)+.6,sign=face<2?1:-1;
    const cols=Math.max(1,Math.floor(half*2/26));
    for(let r=0;r<rows;r++){const y=o.y0+14+r*22;if(b3Hash(r,face,o.x|0)<.28)continue;
     for(let q=0;q<cols;q++){if(b3Hash(q,r+face*31,o.z|0)<.35)continue;const u=-half+13+q*(half*2-12)/cols;
      const P=(du,dy)=>alongX?pt(u+du,y+dy,sign*depth):pt(sign*depth,y+dy,u+du);
      b3QuadOut(O,P(-7,0),P(7,0),P(7,9),P(-7,9),wcol,center,W3.biome.id==='night'?.9:.35);}}}}
  if(o.glow){const gc=b3Hex(o.glow),y=o.y1-6;const P=(lx,lz,dy)=>pt(lx,y+dy,lz);
   for(const s of [-1,1]){b3QuadOut(O,P(-o.hw,s*(o.hd+.6),0),P(o.hw,s*(o.hd+.6),0),P(o.hw,s*(o.hd+.6),3),P(-o.hw,s*(o.hd+.6),3),gc,center,1);}}
  if(o.mat==='deck'||o.mat==='bridge'){const lc=b3Hex(W3.biome.accent);for(const s of [-1,1]){const P=(lx,dy)=>pt(lx,o.y1+dy,s*(o.hd-3));b3QuadOut(O,P(-o.hw,0),P(o.hw,0),P(o.hw,6),P(-o.hw,6),b3Shade(lc,.8),center,.3);}}
 }else{
  const N=o.sides,band=o.band?b3Hex(o.band):null,cap=o.cap?b3Hex(o.cap):null;
  const ring=(y,r)=>{const a=[];for(let k=0;k<N;k++){const t=k/N*Math.PI*2+(o.x*.01);a.push([o.x+Math.cos(t)*r,y,o.z+Math.sin(t)*r]);}return a;};
  const levels=o.mat==='mesa'?[0,.33,.38,.7,.74,1]:[0,1];
  let prev=ring(o.y0,o.r0);
  for(let L=1;L<levels.length;L++){const tt=levels[L],y=o.y0+(o.y1-o.y0)*tt,r=o.r0+(o.r1-o.r0)*tt,cur=ring(y,r);
   const cc=band&&L%2===0?band:col;
   for(let k=0;k<N;k++){const k2=(k+1)%N;b3QuadOut(O,prev[k],prev[k2],cur[k2],cur[k],cc,[o.x,y,o.z]);}
   prev=cur;}
  const topc=cap||b3Shade(col,1.1),tc=[o.x,o.y1,o.z];
  for(let k=0;k<N;k++){const k2=(k+1)%N;b3Tri(O,prev[k],prev[k2],tc,topc,0,[0,1,0]);}
  if(o.glow){const gc=b3Hex(o.glow);for(const f of [.55,.85]){const y=o.y0+(o.y1-o.y0)*f,r=o.r0+(o.r1-o.r0)*f+.6,a=ring(y,r),b2=ring(y+3,r);
   for(let k=0;k<N;k+=2){const k2=(k+1)%N;b3QuadOut(O,a[k],a[k2],b2[k2],b2[k],gc,[o.x,y,o.z],1);}}}
 }
}

// ------------------------------------------------------------ mechs -----
// Local frame: +x right, +y up, +z forward. Model ~46 units tall.
const B3_MODELS=new Map();
function b3MechPalette(enemyTint){
 return enemyTint?{main:'#7c4a54',light:'#d99c94',dark:'#2c1a20',trim:'#efc2b6',glow:'#ffab6e',visor:'#ff7a68'}
  :{main:'#3f6f88',light:'#a8d8e2',dark:'#1a2834',trim:'#d6f4f6',glow:'#7ff3ff',visor:'#8cf9ff'};
}
function b3BuildMech(load,isEnemy){
 const key=Object.values(load).map(p=>p.id).join('|')+(isEnemy?'|E':'|P');
 if(B3_MODELS.has(key))return B3_MODELS.get(key);
 const pal=b3MechPalette(isEnemy),C=k=>b3Hex(pal[k]);
 const tint=hex=>{const c=b3Hex(hex);return isEnemy?[c[0]*.75+.25,c[1]*.55,c[2]*.5]:c;};
 const ids={weapon:load.weapon.id,armor:load.armor.id,legs:load.legs.id,core:load.core.id};
 const cols={armor:tint(find(load.armor).color),legs:tint(find(load.legs).color),core:tint(find(load.core).color),weapon:tint(find(load.weapon).color)};
 const tris=[];const emit=[];let part='body';
 // Rotations: rx (pitch about x), ry (yaw), rz (roll).
 const rot=(p,r)=>{let [x,y,z]=p;if(r[2]){const c=Math.cos(r[2]),s=Math.sin(r[2]);[x,y]=[x*c-y*s,x*s+y*c];}
  if(r[0]){const c=Math.cos(r[0]),s=Math.sin(r[0]);[y,z]=[y*c-z*s,y*s+z*c];}
  if(r[1]){const c=Math.cos(r[1]),s=Math.sin(r[1]);[x,z]=[x*c+z*s,-x*s+z*c];}return [x,y,z];};
 // Tapered box: top face scaled (tx,tz) and shifted (ox,oz) for slanted panels.
 const box=(cx,cy,cz,sx,sy,sz,col,o={})=>{const tx=o.tx??1,tz=o.tz??1,ox=o.ox||0,oz=o.oz||0,r=o.r||[0,0,0],e=o.e||0,fz=o.fz??1;
  const v=[];for(const [yy,kx,kz,dx,dz] of [[-sy/2,1,fz,0,0],[sy/2,tx,tz*fz,ox,oz]])for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]])
   v.push(rot([a*sx/2*kx+dx,yy,(b>0?sz/2*kz:-sz/2*(yy<0?1:tz))+dz],r).map((q,i)=>q+[cx,cy,cz][i]));
  const ctr=[cx,cy,cz],faces=[[4,5,6,7,1.12],[0,3,2,1,.55],[0,1,5,4,.78],[2,3,7,6,.98],[1,2,6,5,.86],[3,0,4,7,.86]];
  for(const [a,b,c,d,k] of faces)tris.push({q:[v[a],v[b],v[c],v[d]],col:b3Shade(col,k),ctr,part,e});};
 const cyl=(cx,cy,cz,r0,r1,len,col,o={})=>{const N=o.n||8,r=o.r||[0,0,0],e=o.e||0,ctr=[cx,cy,cz];
  const P=(t,rad,z)=>rot([Math.cos(t)*rad,Math.sin(t)*rad,z],r).map((q,i)=>q+ctr[i]);
  for(let k=0;k<N;k++){const a=k/N*Math.PI*2,b=(k+1)/N*Math.PI*2;
   tris.push({q:[P(a,r0,-len/2),P(b,r0,-len/2),P(b,r1,len/2),P(a,r1,len/2)],col:b3Shade(col,.75+.35*Math.max(0,Math.sin(a+.6))),ctr,part,e});}
  if(o.cap!==false){const capc=o.capCol||b3Shade(col,.6),ce=o.capE||0;for(let k=0;k<N;k++){const a=k/N*Math.PI*2,b=(k+1)/N*Math.PI*2;
   tris.push({t:[P(a,r1,len/2),P(b,r1,len/2),rot([0,0,len/2],r).map((q,i)=>q+ctr[i])],col:capc,ctr,part,e:ce});}}};
 const main=C('main'),light=C('light'),dark=C('dark'),trim=C('trim'),glow=C('glow');
 // ---- core / torso
 part='body';
 if(ids.core==='power'){box(0,7,0,32,22,22,main,{tx:.9,tz:.85});box(0,9,10,24,14,6,cols.core,{tx:.8});
  for(const s of [-1,1])box(s*9,19,-7,7,5,9,dark),box(s*9,21.6,-7,6,.6,8,C('glow'),{e:1});}
 else if(ids.core==='speed'){box(0,7,0,22,18,24,main,{tx:.75,tz:.7,oz:3});box(0,8,12,14,10,8,cols.core,{tx:.5,tz:.4,oz:2});box(0,18,-5,3,9,18,light,{tz:.5,oz:-4});}
 else if(ids.core==='tactical'){box(0,7,0,26,20,20,main,{tx:.85,tz:.85});box(0,8,10,18,12,5,cols.core);cyl(-11,19,-2,4,3,6,light,{r:[-Math.PI/2,0,0],n:8,capCol:glow,capE:.8});
  box(9,24,-6,1.2,14,1.2,trim);box(6,22,-8,1,10,1,trim);}
 else{box(0,7,0,26,20,20,main,{tx:.85,tz:.85});box(0,8,10,20,13,5,cols.core,{tx:.8});}
 box(0,-5,0,16,8,14,dark,{tx:1.2}); // waist
 box(0,8,10.5,8,3,1.5,C('glow'),{e:.9}); // chest light
 // head
 part='head';
 box(0,20,3,10,8,11,light,{tx:.8,tz:.8});box(0,20.5,8.8,8,2.2,1.2,C('visor'),{e:1});box(0,25,0,2,5,2,trim);
 // ---- shoulders & arms (armor decides the plates)
 for(const s of [-1,1]){
  part=s<0?'armL':'armR';
  box(s*17,13,0,10,10,12,dark);
  const A=ids.armor;
  if(A==='fortress'){box(s*22,14,0,10,24,26,cols.armor,{tx:.85});box(s*26,14,0,2,20,22,light);}
  else if(A==='plated'){box(s*20,17,0,14,6,16,cols.armor,{tx:.9});box(s*21,12,0,14,5,15,b3Shade(cols.armor,.85),{tx:.9});}
  else if(A==='reactive'){for(let k=0;k<3;k++)for(let q=0;q<2;q++)box(s*21,10+k*5,-4+q*8,9,4.2,7,b3Shade(cols.armor,.9+.08*((k+q)%2)));}
  else if(A==='composite'){box(s*20,16,0,13,10,18,cols.armor,{tx:.6,tz:.8,ox:s*2});}
  else if(A==='feather'){box(s*20,16,-2,12,3,16,cols.armor,{tx:.4,tz:.6,ox:s*5,oz:-4});}
  else if(A==='prism'){box(s*20,16,0,12,12,14,cols.armor,{tx:.05,tz:.3,e:.25});}
  else{box(s*20,16,0,11,5,13,cols.armor,{tx:.85});}
  box(s*19,3,2,6,12,7,main);box(s*19,-6,5,7,9,10,light,{tz:.9}); // upper / fore arm
 }
 // ---- weapon on the right arm (+ shoulder pods)
 part='gun';const W=ids.weapon,wc=cols.weapon,gx=19,gy=-7,gz=14;
 if(W==='rail'){box(gx-2.2,gy,gz+14,1.8,3,40,dark);box(gx+2.2,gy,gz+14,1.8,3,40,dark);box(gx,gy,gz+14,1.2,1.2,38,wc,{e:1});
  for(const z of [4,14,24])box(gx,gy,gz+z,7,6,2,light);}
 else if(W==='shot'){box(gx,gy,gz+6,10,8,16,dark);cyl(gx-2.5,gy,gz+16,2.6,2.6,8,wc,{r:[0,0,0],n:6,capCol:[.05,.05,.05]});cyl(gx+2.5,gy,gz+16,2.6,2.6,8,wc,{n:6,capCol:[.05,.05,.05]});}
 else if(W==='missile'){box(gx,gy,gz+4,6,6,14,dark);cyl(gx,gy,gz+12,2,2,6,wc,{n:6});
  part='pod';box(20,26,-2,14,10,18,b3Shade(wc,.8));for(let i=0;i<2;i++)for(let j=0;j<2;j++)box(16+i*7,24+j*5,7.2,3,3,1,C('visor'),{e:1});}
 else if(W==='micro'){box(gx,gy,gz+2,7,7,10,dark);for(let k=0;k<6;k++){const a=k/6*Math.PI*2;box(gx+Math.cos(a)*2.4,gy+Math.sin(a)*2.4,gz+15,1.2,1.2,20,k%2?wc:light);}}
 else if(W==='burst'){box(gx,gy,gz+5,7,10,14,dark);for(const dy of [-3,0,3])box(gx,gy+dy,gz+16,2,2,14,wc);}
 else if(W==='slug'){box(gx,gy,gz+2,10,10,12,dark);cyl(gx,gy,gz+18,5,4,30,wc,{n:10,capCol:[.06,.05,.05]});box(gx,gy+6,gz+6,6,3,10,light);}
 else if(W==='bounce'){box(gx,gy,gz+4,6,6,12,dark);cyl(gx,gy,gz+12,6,6,5,wc,{n:12,capCol:C('glow'),capE:.7});box(gx,gy,gz+18,3,3,10,light);}
 else{box(gx,gy,gz+8,4.5,5,24,wc);box(gx,gy-4,gz+3,3,6,4,dark);box(gx,gy+3.5,gz+3,2,2,8,light);}
 // left arm: compact shield
 part='armL';box(-21,-6,6,4,14,14,b3Shade(cols.armor,.9),{tz:.8});
 // ---- back unit: thrusters + wings (legs decide wing size)
 part='back';const L=ids.legs;
 box(0,10,-13,18,16,10,dark,{tx:.9});
 for(const s of [-1,1]){cyl(s*6,6,-19,4.2,3.2,8,light,{n:10,r:[0,Math.PI,0],capCol:b3Shade(glow,.7),capE:.45});emit.push({p:[s*6,6,-24],d:[0,0,-1],k:1});}
 const wingSpan=L==='jet'||L==='booster'?34:L==='crawler'||L==='tank'?16:26;
 for(const s of [-1,1]){part=s<0?'wingL':'wingR';
  box(s*(10+wingSpan/2),15,-14,wingSpan,2.4,12,b3Shade(main,1.05),{tx:.55,tz:.55,ox:s*wingSpan*.15,oz:-6});
  box(s*(10+wingSpan),17,-19,3,7,5,trim);emit.push({p:[s*(10+wingSpan),16,-22],d:[0,0,-1],k:.45});
  box(s*(8+wingSpan*.6),9,-15,wingSpan*.6,1.8,8,dark,{tx:.6,oz:-3});}
 // ---- legs
 for(const s of [-1,1]){part=s<0?'legL':'legR';const lc=cols.legs;
  if(L==='spider'){for(const f of [-1,1]){box(s*12,-12,f*8,4,4,18,dark,{r:[0,f*.5*s,s*.5]});box(s*19,-22,f*13,3,14,3,lc,{r:[0,0,-s*.25]});}}
  else if(L==='tank'||L==='crawler'){box(s*9,-14,0,9,14,12,main);box(s*10,-25,1,13,8,26,lc,{tz:.9});
   for(const z of [-8,0,8])box(s*16.8,-25,z+1,1.2,6,5,dark);emit.push({p:[s*10,-30,0],d:[0,-1,0],k:.6});}
  else if(L==='jet'){box(s*9,-12,1,7,12,8,main);box(s*9,-22,-3,6,11,7,lc,{r:[.45,0,0]});box(s*9,-29,2,7,4,11,dark);
   cyl(s*9,-24,-9,3.6,2.6,7,light,{r:[0,Math.PI,0],capCol:b3Shade(glow,.7),capE:.45});emit.push({p:[s*9,-25,-13],d:[0,-.4,-1],k:.9});}
  else if(L==='booster'){box(s*9,-12,0,7,12,8,main);box(s*10,-23,0,10,12,12,lc,{tx:.8});cyl(s*10,-29,-2,4,3,5,light,{r:[Math.PI/2,0,0],capCol:b3Shade(glow,.7),capE:.45});emit.push({p:[s*10,-32,-2],d:[0,-1,0],k:1});}
  else if(L==='ranger'){box(s*8,-12,0,6,13,7,main);box(s*8,-23,1,5,11,6,lc);box(s*12,-21,-4,1.4,9,9,trim,{tz:.4,oz:-3});box(s*8,-29,3,6,3,10,dark);}
  else{box(s*8,-12,0,7,13,8,main);box(s*8,-23,1,7,11,8,lc);cyl(s*8,-29,3,3.5,3.5,6,dark,{r:[0,Math.PI/2,0],n:10});emit.push({p:[s*8,-31,0],d:[0,-1,0],k:.5});}
 }
 // Flatten to arrays: positions, normals, colors, emissive, part index.
 const partNames=['body','head','armL','armR','gun','pod','back','wingL','wingR','legL','legR'];
 const out={pos:[],nrm:[],col:[],em:[],part:[],emit,parts:partNames,key,height:52,radius:24};
 const addTri=(a,b,c,col,ctr,pi,e)=>{let n=v3.norm(v3.cross(v3.sub(b,a),v3.sub(c,a)));const fc=v3.mul(v3.add(v3.add(a,b),c),1/3);if(v3.dot(n,v3.sub(fc,ctr))<0)n=v3.mul(n,-1);
  for(const p of [a,b,c]){out.pos.push(...p);out.nrm.push(...n);out.col.push(...col);out.em.push(e);out.part.push(pi);}};
 for(const t of tris){const pi=Math.max(0,partNames.indexOf(t.part));
  if(t.q){addTri(t.q[0],t.q[1],t.q[2],t.col,t.ctr,pi,t.e);addTri(t.q[0],t.q[2],t.q[3],t.col,t.ctr,pi,t.e);}else addTri(t.t[0],t.t[1],t.t[2],t.col,t.ctr,pi,t.e);}
 out.pos=new Float32Array(out.pos);out.nrm=new Float32Array(out.nrm);out.col=new Float32Array(out.col);out.em=new Float32Array(out.em);out.part=new Uint8Array(out.part);
 // Part pivots for animation / break-apart.
 out.pivot={body:[0,4,0],head:[0,18,2],armL:[-17,13,0],armR:[17,13,0],gun:[19,-6,8],pod:[20,26,-2],back:[0,10,-13],wingL:[-12,15,-14],wingR:[12,15,-14],legL:[-9,-6,0],legR:[9,-6,0]};
 B3_MODELS.set(key,out);return out;
}
// Basis for a mech: yaw (facing), pitch (lean), roll (bank).
function b3Basis(yaw,pitch,roll){
 const f0=[Math.cos(yaw),0,Math.sin(yaw)],r0=[-Math.sin(yaw),0,Math.cos(yaw)];
 // our model's +z is forward and +x is right; world right for yaw: (-sin,0,cos) rotated so that x→right.
 let f=[f0[0]*Math.cos(pitch),-Math.sin(pitch),f0[2]*Math.cos(pitch)],u=[f0[0]*Math.sin(pitch),Math.cos(pitch),f0[2]*Math.sin(pitch)];
 let r=[r0[0],r0[1],r0[2]];
 const cr=Math.cos(roll),sr=Math.sin(roll);
 const r2=[r[0]*cr+u[0]*sr,r[1]*cr+u[1]*sr,r[2]*cr+u[2]*sr],u2=[u[0]*cr-r[0]*sr,u[1]*cr-r[1]*sr,u[2]*cr-r[2]*sr];
 return {f,r:r2,u:u2};
}
// Draw a mech model into the dynamic buffer. pose: {x,y,z,yaw,pitch,roll,scale,legSwing,gunPitch,flash,parts(optional offsets)}
function b3EmitMech(buf,m,pose){
 const B=b3Basis(pose.yaw,pose.pitch,pose.roll),S=pose.scale||1,P=m.pos,N=m.nrm,Cc=m.col,E=m.em,PI=m.part;
 const legA=pose.legSwing||0,gunA=pose.gunPitch||0,flash=pose.flash||0;
 const rotX=(v,piv,a)=>{if(!a)return v;const c=Math.cos(a),s=Math.sin(a),y=v[1]-piv[1],z=v[2]-piv[2];return [v[0],piv[1]+y*c-z*s,piv[2]+y*s+z*c];};
 const rotXn=(n,a)=>{if(!a)return n;const c=Math.cos(a),s=Math.sin(a);return [n[0],n[1]*c-n[2]*s,n[1]*s+n[2]*c];};
 const pieces=pose.pieces; // finisher: per-part {off:[x,y,z] world, rot:[angle], axis}
 for(let i=0,k=0;i<PI.length;i++,k+=3){
  const pn=m.parts[PI[i]];let v=[P[k],P[k+1],P[k+2]],n=[N[k],N[k+1],N[k+2]];
  let a=0,piv=null;
  if(pn==='legL'||pn==='legR'){a=legA*(pn==='legL'?1:.85);piv=m.pivot[pn];}
  else if(pn==='gun'||pn==='armR'){a=-gunA;piv=m.pivot.armR;}
  if(a){v=rotX(v,piv,a);n=rotXn(n,a);}
  let wx=pose.x+(B.r[0]*v[0]+B.u[0]*v[1]+B.f[0]*v[2])*S,wy=pose.y+(B.r[1]*v[0]+B.u[1]*v[1]+B.f[1]*v[2])*S,wz=pose.z+(B.r[2]*v[0]+B.u[2]*v[1]+B.f[2]*v[2])*S;
  let nx=B.r[0]*n[0]+B.u[0]*n[1]+B.f[0]*n[2],ny=B.r[1]*n[0]+B.u[1]*n[1]+B.f[1]*n[2],nz=B.r[2]*n[0]+B.u[2]*n[1]+B.f[2]*n[2];
  if(pieces){const pc=pieces[PI[i]];if(pc){
   const pv=m.pivot[pn]||[0,0,0];const cx=pose.x+(B.r[0]*pv[0]+B.u[0]*pv[1]+B.f[0]*pv[2])*S,cy=pose.y+(B.r[1]*pv[0]+B.u[1]*pv[1]+B.f[1]*pv[2])*S,cz=pose.z+(B.r[2]*pv[0]+B.u[2]*pv[1]+B.f[2]*pv[2])*S;
   let dx=wx-cx,dy=wy-cy,dz=wz-cz;const ax=pc.axis,an=pc.ang,c=Math.cos(an),s=Math.sin(an),dt=dx*ax[0]+dy*ax[1]+dz*ax[2];
   const cr=[ax[1]*dz-ax[2]*dy,ax[2]*dx-ax[0]*dz,ax[0]*dy-ax[1]*dx];
   dx=dx*c+cr[0]*s+ax[0]*dt*(1-c);dy=dy*c+cr[1]*s+ax[1]*dt*(1-c);dz=dz*c+cr[2]*s+ax[2]*dt*(1-c);
   const ndt=nx*ax[0]+ny*ax[1]+nz*ax[2],ncr=[ax[1]*nz-ax[2]*ny,ax[2]*nx-ax[0]*nz,ax[0]*ny-ax[1]*nx];
   nx=nx*c+ncr[0]*s+ax[0]*ndt*(1-c);ny=ny*c+ncr[1]*s+ax[1]*ndt*(1-c);nz=nz*c+ncr[2]*s+ax[2]*ndt*(1-c);
   wx=cx+dx+pc.off[0];wy=cy+dy+pc.off[1];wz=cz+dz+pc.off[2];}}
  const e=Math.max(E[i],flash),ch=1-(pose.char||0);
  const cr=(Cc[k]+(1-Cc[k])*flash*.7)*ch,cg=(Cc[k+1]+(1-Cc[k+1])*flash*.7)*ch,cb=(Cc[k+2]+(1-Cc[k+2])*flash*.7)*ch;
  buf.push10(wx,wy,wz,nx,ny,nz,cr,cg,cb,e*(pose.dim??1));
 }
 return B;
}
function b3MechWorldPoint(m,pose,local){const B=b3Basis(pose.yaw,pose.pitch,pose.roll),S=pose.scale||1;
 return [pose.x+(B.r[0]*local[0]+B.u[0]*local[1]+B.f[0]*local[2])*S,pose.y+(B.r[1]*local[0]+B.u[1]*local[1]+B.f[1]*local[2])*S,pose.z+(B.r[2]*local[0]+B.u[2]*local[1]+B.f[2]*local[2])*S];}
function b3MechWorldDir(pose,d){const B=b3Basis(pose.yaw,pose.pitch,pose.roll);return [B.r[0]*d[0]+B.u[0]*d[1]+B.f[0]*d[2],B.r[1]*d[0]+B.u[1]*d[1]+B.f[1]*d[2],B.r[2]*d[0]+B.u[2]*d[1]+B.f[2]*d[2]];}

// ------------------------------------------------------------ camera -----
function b3SetCamera(eye,target,fovY,aspect,roll=0){
 const C=R3.cam;C.eye=eye;let f=v3.norm(v3.sub(target,eye));
 let r=v3.cross(f,[0,1,0]);if(v3.len(r)<1e-4)r=[1,0,0];r=v3.norm(r);let u=v3.cross(r,f);
 if(roll){const c=Math.cos(roll),s=Math.sin(roll);const r2=v3.add(v3.mul(r,c),v3.mul(u,s)),u2=v3.sub(v3.mul(u,c),v3.mul(r,s));r=r2;u=u2;}
 C.f=f;C.r=r;C.u=u;C.fov=fovY;C.aspect=aspect;
 const t=1/Math.tan(fovY/2),near=3,far=12000,A=(far+near)/(near-far),Bq=2*far*near/(near-far);
 const V=[r[0],u[0],-f[0],0, r[1],u[1],-f[1],0, r[2],u[2],-f[2],0, -v3.dot(r,eye),-v3.dot(u,eye),v3.dot(f,eye),1];
 const P=[t/aspect,0,0,0, 0,t,0,0, 0,0,A,-1, 0,0,Bq,0];
 const M=C.vp;for(let c=0;c<4;c++)for(let rr=0;rr<4;rr++){let s=0;for(let k=0;k<4;k++)s+=P[k*4+rr]*V[c*4+k];M[c*4+rr]=s;}
}
// World → HUD pixel coordinates.
function b3Project(x,y,z){
 const M=R3.cam.vp,cx=M[0]*x+M[4]*y+M[8]*z+M[12],cy=M[1]*x+M[5]*y+M[9]*z+M[13],w=M[3]*x+M[7]*y+M[11]*z+M[15];
 if(w<=1)return null;const W=canvas.width,H=canvas.height;
 return {x:(cx/w*.5+.5)*W,y:(1-(cy/w*.5+.5))*H,w};
}
// Direction to a world point in camera space (used for off-screen arrows even when behind).
function b3CamSpace(p){const C=R3.cam,d=v3.sub(p,C.eye);return [v3.dot(d,C.r),v3.dot(d,C.u),v3.dot(d,C.f)];}

// ------------------------------------------------------------- frame -----
function b3ResizeCanvases(){
 const rect=R3.canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
 const sc=clamp(B3.tune.renderScale*R3.autoScale,.3,2),w=Math.max(160,Math.round(rect.width*dpr*sc)),h=Math.max(120,Math.round(rect.height*dpr*sc));
 if(R3.canvas.width!==w||R3.canvas.height!==h){R3.canvas.width=w;R3.canvas.height=h;}
 const hw=Math.max(160,Math.round(rect.width*Math.min(dpr,1.5))),hh=Math.max(120,Math.round(rect.height*Math.min(dpr,1.5)));
 if(canvas.width!==hw||canvas.height!==hh){canvas.width=hw;canvas.height=hh;}
 return {w,h,cssW:rect.width,cssH:rect.height};
}
function b3DrawScene(){
 const gl=R3.gl,C=R3.cam,bi=W3.biome;
 if(R3.builtWorld!==W3.version)b3BuildWorldMesh();
 gl.viewport(0,0,R3.canvas.width,R3.canvas.height);
 gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 const sky=bi.sky.map(b3Hex),sun=v3.norm(bi.sun),sunC=b3Hex(bi.sunColor),fog=b3Hex(bi.fog),amb=bi.ambient.map(b3Hex);
 // sky
 gl.depthMask(false);gl.disable(gl.DEPTH_TEST);
 const S=R3.progs.sky;gl.useProgram(S.p);
 gl.uniform3fv(S.u.uF,C.f);gl.uniform3fv(S.u.uR,C.r);gl.uniform3fv(S.u.uU,C.u);gl.uniform3fv(S.u.uTop,sky[0]);gl.uniform3fv(S.u.uMid,sky[1]);gl.uniform3fv(S.u.uHor,sky[2]);
 gl.uniform3fv(S.u.uSun,sun);gl.uniform3fv(S.u.uSunCol,sunC);gl.uniform1f(S.u.uTan,Math.tan(C.fov/2));gl.uniform1f(S.u.uAsp,C.aspect);gl.uniform1f(S.u.uStars,bi.id==='night'||bi.id==='arena'?1:0);
 gl.bindVertexArray(R3.bufs.sky.vao);gl.drawArrays(gl.TRIANGLES,0,3);
 gl.enable(gl.DEPTH_TEST);gl.depthMask(true);
 // lit geometry
 const L=R3.progs.lit;gl.useProgram(L.p);
 gl.uniformMatrix4fv(L.u.uVP,false,C.vp);gl.uniform3fv(L.u.uSun,sun);gl.uniform3fv(L.u.uSunCol,sunC);gl.uniform3fv(L.u.uSkyAmb,amb[0]);gl.uniform3fv(L.u.uGndAmb,amb[1]);
 gl.uniform3fv(L.u.uFog,fog);gl.uniform3fv(L.u.uEye,C.eye);gl.uniform1f(L.u.uFogDen,bi.fogDensity);gl.uniform1f(L.u.uAlpha,1);
 const draw=(b,detail)=>{if(!b.count)return;gl.uniform1f(L.u.uDetail,detail);gl.bindVertexArray(b.vao);gl.drawArrays(gl.TRIANGLES,0,b.count);};
 draw(R3.bufs.terrain,1);draw(R3.bufs.far,.5);
 // Obstacles between the camera and the player are drawn see-through afterwards.
 const occ=R3.occluders,ob=R3.bufs.obst;
 if(!occ||!occ.size)draw(ob,.35);
 else if(ob.count){gl.uniform1f(L.u.uDetail,.35);gl.bindVertexArray(ob.vao);let s=-1,c=0;
  for(let i=0;i<W3.obs.length;i++){const o=W3.obs[i];if(occ.has(i)){if(c)gl.drawArrays(gl.TRIANGLES,s,c);s=-1;c=0;continue;}if(s<0)s=o.vStart;c+=o.vCount;}
  if(c)gl.drawArrays(gl.TRIANGLES,s,c);}
 const dyn=R3.bufs.dyn;gl.bindBuffer(gl.ARRAY_BUFFER,dyn.buf);gl.bufferData(gl.ARRAY_BUFFER,G3.dyn.a.subarray(0,G3.dyn.n),gl.DYNAMIC_DRAW);dyn.count=G3.dyn.n/10;draw(dyn,0);
 if(occ&&occ.size&&ob.count){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.uniform1f(L.u.uAlpha,.13);gl.uniform1f(L.u.uDetail,.35);gl.bindVertexArray(ob.vao);
  for(const i of occ){const o=W3.obs[i];if(o&&o.vCount)gl.drawArrays(gl.TRIANGLES,o.vStart,o.vCount);}
  gl.uniform1f(L.u.uAlpha,1);gl.depthMask(true);gl.disable(gl.BLEND);}
 // translucent / additive
 const U=R3.progs.un;gl.useProgram(U.p);gl.uniformMatrix4fv(U.u.uVP,false,C.vp);gl.uniform3fv(U.u.uFog,fog);gl.uniform3fv(U.u.uEye,C.eye);gl.uniform1f(U.u.uFogDen,bi.fogDensity);
 gl.enable(gl.BLEND);gl.depthMask(false);
 const drawUn=(b,src,add)=>{gl.bindBuffer(gl.ARRAY_BUFFER,b.buf);if(src){gl.bufferData(gl.ARRAY_BUFFER,src.a.subarray(0,src.n),gl.DYNAMIC_DRAW);b.count=src.n/7;}
  if(!b.count)return;gl.uniform1f(U.u.uAdd,add?1:0);gl.blendFunc(add?gl.ONE:gl.SRC_ALPHA,add?gl.ONE:gl.ONE_MINUS_SRC_ALPHA);gl.bindVertexArray(b.vao);gl.drawArrays(gl.TRIANGLES,0,b.count);};
 drawUn(R3.bufs.water,null,false);
 gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-2,-4);drawUn(R3.bufs.unA,G3.unA,false);gl.disable(gl.POLYGON_OFFSET_FILL);
 const P=R3.progs.pt;gl.useProgram(P.p);gl.uniformMatrix4fv(P.u.uVP,false,C.vp);gl.uniform1f(P.u.uScale,R3.canvas.height/(2*Math.tan(C.fov/2)));gl.uniform1f(P.u.uMax,R3.pointMax);
 const drawPt=(b,src,add)=>{gl.bindBuffer(gl.ARRAY_BUFFER,b.buf);gl.bufferData(gl.ARRAY_BUFFER,src.a.subarray(0,src.n),gl.DYNAMIC_DRAW);b.count=src.n/8;if(!b.count)return;
  gl.uniform1f(P.u.uAdd,add?1:0);gl.blendFunc(add?gl.ONE:gl.SRC_ALPHA,add?gl.ONE:gl.ONE_MINUS_SRC_ALPHA);gl.bindVertexArray(b.vao);gl.drawArrays(gl.POINTS,0,b.count);};
 drawPt(R3.bufs.ptA,G3.ptA,false);
 gl.useProgram(U.p);drawUn(R3.bufs.unAdd,G3.unAdd,true);
 gl.useProgram(P.p);drawPt(R3.bufs.ptAdd,G3.ptAdd,true);
 gl.depthMask(true);gl.disable(gl.BLEND);gl.bindVertexArray(null);
}
// Camera-facing ribbon segment (unlit), width in world units.
function b3Ribbon(buf,a,b,w0,w1,c0,c1){
 const C=R3.cam,d=v3.sub(b,a),view=v3.sub(a,C.eye);let s=v3.cross(d,view);const l=v3.len(s);if(l<1e-6)return;s=v3.mul(s,1/l);
 const A0=v3.add(a,v3.mul(s,w0/2)),A1=v3.sub(a,v3.mul(s,w0/2)),B0=v3.add(b,v3.mul(s,w1/2)),B1=v3.sub(b,v3.mul(s,w1/2));
 for(const [p,c] of [[A0,c0],[A1,c0],[B1,c1],[A0,c0],[B1,c1],[B0,c1]])buf.push7(p[0],p[1],p[2],c[0],c[1],c[2],c[3]);
}
// Flat disc on the ground (shadow / impact scorch).
function b3Disc(buf,x,z,r,col,alpha,lift=1.2){
 const N=14,g=b3Ground(x,z)+lift;
 for(let k=0;k<N;k++){const a=k/N*Math.PI*2,b=(k+1)/N*Math.PI*2;
  const p1=[x+Math.cos(a)*r,b3Ground(x+Math.cos(a)*r,z+Math.sin(a)*r)+lift,z+Math.sin(a)*r],p2=[x+Math.cos(b)*r,b3Ground(x+Math.cos(b)*r,z+Math.sin(b)*r)+lift,z+Math.sin(b)*r];
  buf.push7(x,g,z,col[0],col[1],col[2],alpha);buf.push7(p1[0],p1[1],p1[2],col[0],col[1],col[2],0);buf.push7(p2[0],p2[1],p2[2],col[0],col[1],col[2],0);}
}
// Oriented lit box for projectiles / debris.
function b3EmitBox(buf,c,dir,up,sx,sy,sz,col,e=0){
 const f=v3.norm(dir);let r=v3.cross(up||[0,1,0],f);if(v3.len(r)<1e-4)r=[1,0,0];r=v3.norm(r);const u=v3.cross(f,r);
 const P=(a,b,cc)=>[c[0]+r[0]*a*sx/2+u[0]*b*sy/2+f[0]*cc*sz/2,c[1]+r[1]*a*sx/2+u[1]*b*sy/2+f[1]*cc*sz/2,c[2]+r[2]*a*sx/2+u[2]*b*sy/2+f[2]*cc*sz/2];
 const v=[P(-1,-1,-1),P(1,-1,-1),P(1,1,-1),P(-1,1,-1),P(-1,-1,1),P(1,-1,1),P(1,1,1),P(-1,1,1)];
 const faces=[[4,5,6,7],[1,0,3,2],[0,4,7,3],[5,1,2,6],[3,7,6,2],[0,1,5,4]];
 for(const q of faces)b3QuadOut(buf,v[q[0]],v[q[1]],v[q[2]],v[q[3]],col,c,e);
}
