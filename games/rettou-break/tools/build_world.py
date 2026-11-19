import json, math, glob, heapq, numpy as np, shapefile
from PIL import Image, ImageDraw
from scipy import ndimage
WW,WH=1640,1760
KX,KY=89.8,111.0
def inset(lat,lon): return lat<29.6 and lon<131.6
def wp(lat,lon):
    if inset(lat,lon): return (10+(lon-122.9)*KX, 15+(29.25-lat)*KY)
    return (40+(lon-128.6)*KX, 10+(45.8-lat)*KY)
def inv(x,y,ins):
    if ins: return (29.25-(y-15)/KY, 122.9+(x-10)/KX)
    return (45.8-(y-10)/KY, 128.6+(x-40)/KX)
INSET_BOX=(0,0,800,640)  # world km box used for Nansei inset
S=2  # 0.5km supersample
# ---------- prefectures ----------
gj=json.load(open('work/data/japan.geojson'))
img=Image.new('L',(WW*S,WH*S),0);dr=ImageDraw.Draw(img)
for f in gj['features']:
    pid=f['properties']['id'];g=f['geometry'];polys=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
    for poly in polys:
        ext=poly[0];cl=sum(p[1] for p in ext)/len(ext);co=sum(p[0] for p in ext)/len(ext);ins=inset(cl,co)
        def pr(p):
            if ins: x,y=10+(p[0]-122.9)*KX,15+(29.25-p[1])*KY
            else: x,y=40+(p[0]-128.6)*KX,10+(45.8-p[1])*KY
            return (x*S,y*S)
        pts=[pr(p) for p in ext]
        xs=[p[0] for p in pts];ys=[p[1] for p in pts]
        if max(xs)<0 or min(xs)>WW*S or max(ys)<0 or min(ys)>WH*S: continue
        if ins and (min(xs)>INSET_BOX[2]*S or max(ys)>INSET_BOX[3]*S): continue
        if len(pts)>=3: dr.polygon(pts,fill=pid)
        for hole in poly[1:]:
            hp=[pr(p) for p in hole]
            if len(hp)>=3: dr.polygon(hp,fill=0)
pref_hi=np.array(img,dtype=np.uint8)
land_hi=pref_hi>0
print('land km2 (approx)',land_hi.sum()/S/S)
# signed distance (km) at 0.5km, then sample at 1km cell centers
d_out=ndimage.distance_transform_edt(~land_hi)/S
d_in=ndimage.distance_transform_edt(land_hi)/S
sdf_hi=np.where(land_hi,-(d_in-0.25),(d_out-0.25)).astype(np.float32)
sdf=sdf_hi.reshape(WH,S,WW,S).mean(axis=(1,3))
# pref at 1km: nearest land pref (within 20km)
_,ind=ndimage.distance_transform_edt(~land_hi,return_indices=True)
near=pref_hi[ind[0],ind[1]]
near[d_out>20]=0
pref=near.reshape(WH,S,WW,S)[:,0,:,0].copy()
# use majority of 2x2 for land cells
blk=pref_hi.reshape(WH,S,WW,S).transpose(0,2,1,3).reshape(WH,WW,S*S)
maj=np.where((blk>0).sum(axis=2)>0,blk.max(axis=2),0)
pref=np.where(maj>0,maj,pref).astype(np.uint8)
land=sdf<0
print('land cells 1km',land.sum())
# ---------- elevation from GSI dem_png z8 ----------
Z=8
tiles=glob.glob('work/data/dem/8_*.png')
xs=[int(t.split('_')[1]) for t in tiles];ys=[int(t.split('_')[2].split('.')[0]) for t in tiles]
x0,x1,y0,y1=min(xs),max(xs),min(ys),max(ys)
M=np.full(((y1-y0+1)*256,(x1-x0+1)*256),np.nan,np.float32)
for t,tx,ty in zip(tiles,xs,ys):
    a=np.array(Image.open(t).convert('RGB')).astype(np.int64)
    v=a[:,:,0]*65536+a[:,:,1]*256+a[:,:,2]
    h=np.where(v<2**23,v*0.01,np.where(v==2**23,np.nan,(v-2**24)*0.01)).astype(np.float32)
    M[(ty-y0)*256:(ty-y0+1)*256,(tx-x0)*256:(tx-x0+1)*256]=h
def lonlat2pix(lat,lon):
    n=2**Z;px=(lon+180)/360*n*256-x0*256
    r=np.radians(lat);py=(1-np.log(np.tan(r)+1/np.cos(r))/np.pi)/2*n*256-y0*256
    return px,py
# sample at 0.5km then average
gy,gx=np.mgrid[0:WH*S,0:WW*S].astype(np.float64)
wx=(gx+0.5)/S;wy=(gy+0.5)/S
insm=(wx<INSET_BOX[2])&(wy<INSET_BOX[3])
lat=np.where(insm,29.25-(wy-15)/KY,45.8-(wy-10)/KY);lon=np.where(insm,122.9+(wx-10)/KX,128.6+(wx-40)/KX)
px,py=lonlat2pix(np.clip(lat,-80,80),lon)
Mz=np.nan_to_num(M,nan=0.0)
elev_hi=ndimage.map_coordinates(Mz,[py-0.5,px-0.5],order=1,mode='constant',cval=0.0).astype(np.float32)
elev_hi[~land_hi]=0;elev_hi=np.maximum(elev_hi,0)
elev=elev_hi.reshape(WH,S,WW,S).mean(axis=(1,3))
cnt=land_hi.reshape(WH,S,WW,S).mean(axis=(1,3))
elev=np.where(cnt>0,elev/np.maximum(cnt,1e-6),0)
print('max elev',elev.max())
del gx,gy,wx,wy,lat,lon,px,py,elev_hi
# ---------- rivers: priority flood + D8 accumulation on 1km ----------
H,Wd=WH,WW
E=elev.copy();L=land.copy()
filled=np.full(E.shape,np.inf,np.float32);done=np.zeros(E.shape,bool);heap=[]
border=L&(ndimage.binary_dilation(~L))
for (r,c) in zip(*np.nonzero(border)):
    filled[r,c]=E[r,c];done[r,c]=True;heapq.heappush(heap,(float(E[r,c]),r,c))
nb=[(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)]
order=[]
while heap:
    h,r,c=heapq.heappop(heap);order.append((r,c))
    for dr_,dc in nb:
        rr,cc=r+dr_,c+dc
        if 0<=rr<H and 0<=cc<Wd and L[rr,cc] and not done[rr,cc]:
            done[rr,cc]=True;nh=max(float(E[rr,cc]),h+0.01);filled[rr,cc]=nh;heapq.heappush(heap,(nh,rr,cc))
# downstream: steepest descent in filled (the order popped is from low to high; each cell's receiver = neighbor with min filled that is lower or border->sea)
acc=np.zeros(E.shape,np.float32);acc[L]=1
recv={}
F=filled
for r,c in reversed(order):
    best=None;bh=F[r,c]
    for dr_,dc in nb:
        rr,cc=r+dr_,c+dc
        if 0<=rr<H and 0<=cc<Wd:
            hh=F[rr,cc] if L[rr,cc] else -1.0
            if hh<bh: bh=hh;best=(rr,cc)
    if best and L[best]: acc[best]+=acc[r,c];recv[(r,c)]=best
    elif best: recv[(r,c)]=None
river=np.where(L,np.clip(np.round(np.log2(np.maximum(acc,1))*16),0,255),0).astype(np.uint8)
# ---- vectorize rivers (acc>=40 km2) ----
TH=40
isr=(acc>=TH)&L
up=np.zeros(E.shape,np.int32)
for (r,c),b in recv.items():
    if b is not None and isr[r,c] and isr[b]: up[b]+=1
visited=np.zeros(E.shape,bool);polys=[]
srcs=[(r,c) for r,c in zip(*np.nonzero(isr)) if up[r,c]==0]
srcs.sort(key=lambda rc:-acc[rc])
for r,c in srcs:
    line=[];cur=(r,c)
    while cur is not None:
        line.append((cur[1]+0.5,cur[0]+0.5,float(acc[cur])))
        if visited[cur]: break
        visited[cur]=True
        nxt=recv.get(cur)
        if nxt is None:
            # extend toward sea one cell
            break
        cur=nxt
    if len(line)>=2: polys.append(line)
def rdp3(pts,eps):
    if len(pts)<3: return pts
    a=np.array(pts[0][:2]);b=np.array(pts[-1][:2]);ab=b-a;Lr=np.hypot(*ab)
    P=np.array([p[:2] for p in pts[1:-1]])
    d=np.abs(ab[0]*(P[:,1]-a[1])-ab[1]*(P[:,0]-a[0]))/Lr if Lr>0 else np.hypot(*(P-a).T)
    i=int(np.argmax(d))
    if d[i]>eps: return rdp3(pts[:i+2],eps)[:-1]+rdp3(pts[i+1:],eps)
    return [pts[0],pts[-1]]
import sys;sys.setrecursionlimit(20000)
rv=[]
for pl in polys:
    q=rdp3(pl,0.35)
    rv.append([v for p in q for v in (round(p[0]*10),round(p[1]*10),int(min(255,round(np.log2(p[2])*16))))])
json.dump(rv,open('work/out/rivers.json','w'),separators=(',',':'))
print('river polylines',len(rv),'points',sum(len(x)//3 for x in rv))
print('max acc',acc.max())
# ---------- lakes (Natural Earth 10m) ----------
lake=np.zeros((WH,WW),np.uint8)
try:
    ne=json.load(open('work/data/ne_lakes.geojson'))
    li=Image.new('L',(WW,WH),0);ld=ImageDraw.Draw(li)
    for f in ne['features']:
        g=f['geometry'];polys=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
        for poly in polys:
            ext=poly[0];cl=sum(p[1] for p in ext)/len(ext);co=sum(p[0] for p in ext)/len(ext)
            if not (24<cl<46 and 122<co<146.5): continue
            pts=[wp(p[1],p[0]) for p in ext]
            if len(pts)>=3: ld.polygon(pts,fill=1)
    lake=np.array(li,np.uint8)&land.astype(np.uint8)
    print('lake cells',lake.sum())
except Exception as e: print('no lakes',e)
# ---------- population (1km mesh, 2020) ----------
popg=np.zeros((WH,WW),np.float64)
tot=0
for f in glob.glob('work/data/mesh1k/1km_mesh_2024_SHP/**/*.dbf',recursive=True):
    r=shapefile.Reader(dbf=open(f,'rb'));fl=[x[0] for x in r.fields[1:]];im=fl.index('MESH_ID');ip=fl.index('PTN_2020')
    for rec in r.iterRecords():
        m=str(rec[im]);p=rec[ip] or 0
        if p<=0 or len(m)!=8: continue
        la=int(m[0:2])/1.5+int(m[4])*5/60+int(m[6])*30/3600+15/3600
        lo=int(m[2:4])+100+int(m[5])*7.5/60+int(m[7])*45/3600+22.5/3600
        x,y=wp(la,lo)
        if not (0<=x<WW-1 and 0<=y<WH-1): continue
        fx,fy=x-0.5,y-0.5;ix,iy=int(math.floor(fx)),int(math.floor(fy));tx,ty=fx-ix,fy-iy
        for dx,dy,w in ((0,0,(1-tx)*(1-ty)),(1,0,tx*(1-ty)),(0,1,(1-tx)*ty),(1,1,tx*ty)):
            if 0<=ix+dx<WW and 0<=iy+dy<WH: popg[iy+dy,ix+dx]+=p*w
        tot+=p
print('total pop',tot)
np.save('work/out/popg.npy',popg.astype(np.float32))
dens=np.clip(np.round(np.log2(popg+1)*16),0,255).astype(np.uint8)
# ---------- encode PNGs ----------
eu=np.clip(np.round(elev)+1000,0,65535).astype(np.uint16)
sd=np.clip(np.round(sdf*10)+128,0,255).astype(np.uint8)
terr=np.dstack([(eu>>8).astype(np.uint8),(eu&255).astype(np.uint8),sd])
Image.fromarray(terr,'RGB').save('work/out/terrain.png',optimize=True)
info=np.dstack([pref|(lake<<7),river,dens]).astype(np.uint8)
Image.fromarray(info,'RGB').save('work/out/info.png',optimize=True)
np.save('work/out/elev.npy',elev.astype(np.float32));np.save('work/out/pref.npy',pref);np.save('work/out/sdf.npy',sdf.astype(np.float32))
print('done')
