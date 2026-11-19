import sys;sys.setrecursionlimit(20000)
import json,re,math,csv
import numpy as np
KX,KY=89.8,111.0
def inset(lat,lon): return lat<29.6 and lon<131.6
def wp(lat,lon):
    if inset(lat,lon): return (10+(lon-122.9)*KX, 15+(29.25-lat)*KY)
    return (40+(lon-128.6)*KX, 10+(45.8-lat)*KY)
src=open('work/rettou2/index.html',encoding='utf-8').read()
def jsobj(name):
    i=src.index('const '+name+'=');j=src.index(';\n',i);t=src[i+len('const '+name+'='):j]
    return json.loads(t.replace("'",'"'))
CITYDATA=jsobj('CITYDATA');PREFS=jsobj('PREFS')
pref_raster=np.load('work/out/pref.npy');popg=np.load('work/out/popg.npy')
NAMES=['北海道','青森','岩手','宮城','秋田','山形','福島','茨城','栃木','群馬','埼玉','千葉','東京','神奈川','新潟','富山','石川','福井','山梨','長野','岐阜','静岡','愛知','三重','滋賀','京都','大阪','兵庫','奈良','和歌山','鳥取','島根','岡山','広島','山口','徳島','香川','愛媛','高知','福岡','佐賀','長崎','熊本','大分','宮崎','鹿児島','沖縄']
# real population per pref from mesh raster
pops=np.zeros(48)
np.add.at(pops,pref_raster.ravel(),popg.ravel())
prefs=[]
for i,p in enumerate(PREFS):
    assert p[0]==NAMES[i]
    prefs.append({'name':p[0],'cap':p[1],'pop':round(float(pops[i+1])/1e4,1),'reg':p[7]})
print('pref pops',[ (p['name'],p['pop']) for p in prefs[:5]],'sum',sum(p['pop'] for p in prefs))
cities=[]
for pn,lst in CITYDATA.items():
    for n,la,lo,pp in lst:
        x,y=wp(la,lo);cities.append({'n':n,'p':NAMES.index(pn),'x':round(x,1),'y':round(y,1),'pop':pp})
# ---------- graph helpers ----------
def rdp(pts,eps):
    if len(pts)<3: return pts
    a,b=np.array(pts[0]),np.array(pts[-1]);ab=b-a;L=np.hypot(*ab)
    P=np.array(pts[1:-1])
    d=np.abs(ab[0]*(P[:,1]-a[1])-ab[1]*(P[:,0]-a[0]))/L if L>0 else np.hypot(*(P-a).T)
    i=int(np.argmax(d))
    if d[i]>eps: return rdp(pts[:i+2],eps)[:-1]+rdp(pts[i+1:],eps)
    return [pts[0],pts[-1]]
def tjoin(lines,thr=1.5):
    # split polylines where another line's endpoint touches their interior (T-junctions)
    import collections
    grid=collections.defaultdict(list)
    for li,pts in enumerate(lines):
        for vi,p in enumerate(pts): grid[(int(p[0]//2),int(p[1]//2))].append((li,vi))
    cut=collections.defaultdict(set)
    for li,pts in enumerate(lines):
        for ep in (pts[0],pts[-1]):
            best=None;bd=thr
            gx,gy=int(ep[0]//2),int(ep[1]//2)
            for dx in (-1,0,1):
                for dy in (-1,0,1):
                    for (lj,vj) in grid.get((gx+dx,gy+dy),[]):
                        if lj==li: continue
                        q=lines[lj][vj];d=math.hypot(q[0]-ep[0],q[1]-ep[1])
                        if d<bd: bd=d;best=(lj,vj)
            if best and 0<best[1]<len(lines[best[0]])-1: cut[best[0]].add(best[1])
    # interior-interior touches (junctions where both lines continue)
    for li,pts in enumerate(lines):
        for vi in range(1,len(pts)-1):
            p=pts[vi];gx,gy=int(p[0]//2),int(p[1]//2)
            for dx in (-1,0,1):
                for dy in (-1,0,1):
                    for (lj,vj) in grid.get((gx+dx,gy+dy),[]):
                        if lj<=li: continue
                        q=lines[lj][vj]
                        if abs(q[0]-p[0])<0.35 and abs(q[1]-p[1])<0.35:
                            cut[li].add(vi)
                            if 0<vj<len(lines[lj])-1: cut[lj].add(vj)
    out=[]
    for li,pts in enumerate(lines):
        cs=sorted(cut.get(li,[]));prev=0
        for c in cs: out.append(pts[prev:c+1]);prev=c
        out.append(pts[prev:])
    return out
def build(lines,typ,snap=1.0,maxlen=25):
    lines=tjoin([l for l in lines if len(l)>=2])
    key=lambda p:(round(p[0]/snap),round(p[1]/snap))
    nodes={};adj={};segs=[]
    for pts in lines:
        if len(pts)<2: continue
        a,b=key(pts[0]),key(pts[-1])
        for k,p in ((a,pts[0]),(b,pts[-1])): nodes.setdefault(k,p)
        sid=len(segs);segs.append([a,b,pts,True])
        adj.setdefault(a,[]).append(sid);adj.setdefault(b,[]).append(sid)
    # contract degree-2
    changed=True
    while changed:
        changed=False
        for k,lst in list(adj.items()):
            lst=[s for s in lst if segs[s][3]];adj[k]=lst
            if len(lst)!=2: continue
            s1,s2=lst
            if s1==s2: continue
            A=segs[s1];B=segs[s2]
            p1=A[2] if A[1]==k else A[2][::-1];o1=A[0] if A[1]==k else A[1]
            p2=B[2] if B[0]==k else B[2][::-1];o2=B[1] if B[0]==k else B[0]
            if o1==k or o2==k: continue
            nid=len(segs);segs.append([o1,o2,p1+p2[1:],True]);A[3]=False;B[3]=False
            adj[o1]=[s for s in adj[o1] if s!=s1]+[nid];adj[o2]=[s for s in adj[o2] if s!=s2]+[nid];adj[k]=[];changed=True
    out_nodes=[];nidx={}
    def nid_of(k,p):
        if k not in nidx: nidx[k]=len(out_nodes);out_nodes.append(p)
        return nidx[k]
    edges=[]
    for a,b,pts,alive in segs:
        if not alive or len(pts)<2: continue
        pts=rdp(pts,0.12)
        # split long polylines
        cum=[0]
        for i in range(1,len(pts)): cum.append(cum[-1]+math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]))
        total=cum[-1];n=max(1,int(total//maxlen+ (1 if total%maxlen>maxlen*.4 else 0)))
        cuts=[total*j/n for j in range(1,n)]
        pieces=[];cur=[pts[0]];ci=0
        for i in range(1,len(pts)):
            while ci<len(cuts) and cum[i]>=cuts[ci]:
                t=(cuts[ci]-cum[i-1])/max(1e-9,cum[i]-cum[i-1]);q=(pts[i-1][0]+(pts[i][0]-pts[i-1][0])*t,pts[i-1][1]+(pts[i][1]-pts[i-1][1])*t)
                cur.append(q);pieces.append(cur);cur=[q];ci+=1
            cur.append(pts[i])
        pieces.append(cur)
        prev=nid_of(a,pts[0])
        for j,pc in enumerate(pieces):
            if j==len(pieces)-1: nxt=nid_of(b,pts[-1])
            else: nxt=nid_of(('m',typ,len(out_nodes)),pc[-1])
            if prev!=nxt: edges.append({'a':prev,'b':nxt,'t':typ,'p':pc})
            prev=nxt
    return out_nodes,edges
def loadgeo(f):
    return json.loads(open(f,'rb').read().decode('utf-8',errors='replace'))['features']
hw=[f for f in loadgeo('work/data/N06-22_GML/UTF-8/N06-22_HighwaySection.geojson') if f['properties'].get('N06_003')==9999]
lines=[];names=[]
for f in hw:
    g=f['geometry'];parts=g['coordinates'] if g['type']=='MultiLineString' else [g['coordinates']]
    for c in parts: lines.append([wp(p[1],p[0]) for p in c])
en,ee=build(lines,'e')
rl=[f for f in loadgeo('work/data/N02-22_GML/UTF-8/N02-22_RailroadSection.geojson') if f['properties'].get('N02_002')=='1']
slines=[]
for f in rl:
    g=f['geometry'];parts=g['coordinates'] if g['type']=='MultiLineString' else [g['coordinates']]
    for c in parts: slines.append([wp(p[1],p[0]) for p in c])
sn,se=build(slines,'s',snap=0.4,maxlen=30)
print('expressway nodes/edges',len(en),len(ee),'shinkansen',len(sn),len(se))
def heal(nodes,edges,thr):
    N=len(nodes);par=list(range(N))
    def f(a):
        while par[a]!=a: par[a]=par[par[a]];a=par[a]
        return a
    deg=[0]*N
    for e in edges: par[f(e['a'])]=f(e['b']);deg[e['a']]+=1;deg[e['b']]+=1
    added=0
    for i in range(N):
        if deg[i]!=1: continue
        best=None;bd=thr
        for j in range(N):
            if f(j)==f(i): continue
            d=math.hypot(nodes[i][0]-nodes[j][0],nodes[i][1]-nodes[j][1])
            if d<bd: bd=d;best=j
        if best is not None:
            edges.append({'a':i,'b':best,'t':edges[0]['t'],'p':[nodes[i],nodes[best]]});par[f(i)]=f(best);added+=1
    return added
print('healed e',heal(en,ee,4.0),'s',heal(sn,se,4.0))
nodes=[[round(x,1),round(y,1)] for x,y in en]+[[round(x,1),round(y,1)] for x,y in sn]
off=len(en)
edges=[]
for e in ee: edges.append({'a':e['a'],'b':e['b'],'t':'e','p':[round(v*10) for q in e['p'] for v in q]})
for e in se: edges.append({'a':e['a']+off,'b':e['b']+off,'t':'s','p':[round(v*10) for q in e['p'] for v in q]})
# ---------- airports ----------
ap=loadgeo('work/data/C28-21_GML/UTF-8/C28-21_Airport.geojson')
PAX={'東京国際空港':85,'成田国際空港':33,'関西国際空港':30,'福岡空港':25,'新千歳空港':23,'那覇空港':21,'大阪国際空港':15,'中部国際空港':12,'鹿児島空港':5.6,'仙台空港':3.5,'熊本空港':3.4,'神戸空港':3.3,'長崎空港':3.2,'宮崎空港':3.1,'松山空港':3.1,'広島空港':2.8,'新石垣空港':2.5,'石垣空港':2.5,'大分空港':2.0,'高松空港':2.0,'函館空港':1.7,'小松飛行場':1.5,'宮古空港':1.5,'岡山空港':1.5,'秋田空港':1.3,'旭川空港':1.1,'北九州空港':1.2,'青森空港':1.0,'高知空港':1.4,'徳島飛行場':1.0}
airports=[]
for f in ap:
    pr=f['properties']
    if pr.get('C28_004')!='供用中': continue
    g=f['geometry'];ring=g['coordinates'][0] if g['type']=='Polygon' else g['coordinates'][0][0]
    lo=sum(p[0] for p in ring)/len(ring);la=sum(p[1] for p in ring)/len(ring)
    if not (24<la<46 and 122<lo<146.5): continue
    x,y=wp(la,lo)
    if x<0 or y<0 or x>1640 or y>1760: continue
    nm=pr['C28_005'];rw=max([int(v) for v in str(pr.get('C28_012') or 0).split(',') if v.strip().isdigit()] or [0])
    cls=pr.get('C28_003');pax=PAX.get(nm,0.3 if rw>=2000 else 0.1)
    airports.append({'n':nm.replace('国際空港','空港').replace('飛行場','空港').replace('東京空港','羽田空港').replace('大阪空港','伊丹空港'),'x':round(x,1),'y':round(y,1),'rw':rw,'pax':pax,'cls':cls})
print('airports',len(airports))
# ---------- ports & logistics ----------
PORTS=[['東京港',35.62,139.79,9],['横浜港',35.45,139.66,9],['川崎港',35.50,139.76,3],['千葉港',35.58,140.06,5],['名古屋港',35.04,136.85,10],['四日市港',34.96,136.65,3],['大阪港',34.64,135.42,6],['堺泉北港',34.55,135.43,3],['神戸港',34.67,135.21,7],['姫路港',34.77,134.67,2],['水島港',34.50,133.73,4],['広島港',34.35,132.46,2],['徳山下松港',34.03,131.80,3],['北九州港',33.92,130.90,5],['博多港',33.61,130.40,5],['鹿児島港',31.60,130.57,2],['那覇港',26.22,127.67,2],['苫小牧港',42.63,141.67,5],['室蘭港',42.35,140.95,2],['函館港',41.78,140.72,1.5],['八戸港',40.54,141.53,2],['仙台塩釜港',38.27,141.03,3],['小名浜港',36.94,140.90,2],['茨城港',36.40,140.62,2],['鹿島港',35.92,140.68,3],['清水港',35.01,138.51,3],['新潟港',37.95,139.08,2],['伏木富山港',36.78,137.10,1.5],['金沢港',36.61,136.60,1],['舞鶴港',35.48,135.38,1],['和歌山下津港',34.15,135.15,1.5],['高松港',34.35,134.05,1.5],['松山港',33.85,132.70,1],['大分港',33.26,131.68,2],['秋田港',39.75,140.07,1],['釧路港',42.98,144.37,1.5]]
LOGI=[['圏央道物流センター',35.95,139.45,6],['北関東物流センター',36.33,139.82,2.5],['中部内陸物流センター',35.25,136.95,3],['関西内陸物流センター',34.82,135.55,3],['九州物流センター',33.52,130.52,2],['東北物流センター',38.32,140.90,1.5]]
hubs=[]
for n,la,lo,c in PORTS: x,y=wp(la,lo);hubs.append({'n':n,'k':'港','x':round(x,1),'y':round(y,1),'cap':c})
for n,la,lo,c in LOGI: x,y=wp(la,lo);hubs.append({'n':n,'k':'物流','x':round(x,1),'y':round(y,1),'cap':c})
for a in airports:
    if a['pax']>=1: hubs.append({'n':a['n'],'k':'空港','x':a['x'],'y':a['y'],'cap':round(min(4,a['pax']/10+.5),2)})
# ---------- power plants (WRI GPPD, >=500MW) ----------
JA={'Kashiwazaki Kariwa':'柏崎刈羽原発','Futtsu':'富津火力','Higashi Niigata':'東新潟火力','Kawagoe':'川越火力','Fukushima Daina':'福島第二原発','Hirono':'広野火力','Kashima':'鹿島火力','Hekinan power station':'碧南火力','Chita':'知多火力','Hamaoka':'浜岡原発','Anegasaki':'姉崎火力','Sodegaura':'袖ケ浦火力','Genkai':'玄海原発','Takahama':'高浜原発','Yokohama':'横浜火力','Shin Nagoya':'新名古屋火力','Chiba':'千葉火力','Shin Oita':'新大分火力','Yokosuka':'横須賀火力','Onagawa':'女川原発','J-POWER Tachibana-wan power station':'橘湾火力','Kainan':'海南火力','Ikata':'伊方原発','Haramachi power station':'原町火力','Higashi Ogishima':'東扇島火力','Hitachinaka power station':'常陸那珂火力','Matsuura power station':'松浦火力','Sakaiko':'堺港火力','Shinchi power station':'新地火力','Tomari':'泊原発','Okutataragi':'奥多々良木発電所','Atsumi':'渥美火力','Goi':'五井火力','Gobo':'御坊火力','Maizuru power station':'舞鶴火力','Nanko':'南港火力','Shin Kokura':'新小倉火力','Shika':'志賀原発','Chita Daini':'知多第二火力','Nakoso power station':'勿来火力','Himeji Daini':'姫路第二火力','Tomato-atsuma power station':'苫東厚真火力','Kawasaki':'川崎火力','Okumino':'奥美濃発電所','Sakaide':'坂出火力','Toyama Shinko power station':'富山新港火力','Himeji Daiichi':'姫路第一火力','Kobe power station':'神戸発電所','Reihoku power station':'苓北火力','Yanai':'柳井火力','Akita':'秋田火力','Takehara power station':'竹原火力','Okawachi':'大河内発電所','Shin Takasegawa':'新高瀬川発電所','Anan':'阿南火力','Yokkaichi':'四日市火力','Ohgishima':'扇島火力','Okuyoshino':'奥吉野発電所','Ako':'赤穂火力','Isogo power station':'磯子火力','Matanogawa':'俣野川発電所','Nanao-Ohta Shinko power station':'七尾大田火力','Noshiro power station':'能代火力','Tamahara':'玉原発電所','Tamashima':'玉島火力','Tanagawa Daini':'多奈川第二火力','Tsuruga power station':'敦賀火力','Nishi Nagoya':'西名古屋火力','Tsuruga':'敦賀原発','Minami Yokohama':'南横浜火力','Shinagawa':'品川火力','Aioi':'相生火力','Shin Toyone':'新豊根発電所','Taketoyo':'武豊火力','Higashi-Dori':'東通原発','Tokai Daini':'東海第二原発','Imaichi':'今市発電所','Buzen':'豊前火力','Kashima Kyodo':'鹿島共同火力','Matsushima power station':'松島火力','Misumi power station':'三隅火力','Okukiyotsu':'奥清津発電所','Shimogo':'下郷発電所','Shin Onoda power station':'新小野田火力','Omarugawa':'小丸川発電所','Shiobara':'塩原発電所','Tobata':'戸畑共同火力','Owase Mita':'尾鷲三田火力','Kawasaki CCGT':'川崎火力','Mihama':'美浜原発','Shimane':'島根原発','Kazunogawa':'葛野川発電所','Okuyahagi Daini':'奥矢作第二発電所','Matsuura Kyushu power station':'松浦火力','Niigata Minato':'新潟火力','Sakata Kyodo power station':'酒田共同火力','Shikoku Tachibana-wan power station':'橘湾火力','Numappara':'沼原発電所','Oita Thermal Power Plant':'大分火力','Kashima Kita':'鹿島北共同火力','Azumi':'安曇発電所','Nabara':'南原発電所','Hongawa':'本川発電所','Tenzan':'天山発電所','Okutadami':'奥只見発電所','Sumitomo Metals Kashima power station':'鹿島製鉄所火力','Mishima Mill (Taio)':'大王製紙三島火力','Ohira':'大平発電所','Takasago power station':'高砂火力'}
# nuclear operating status as of 2026-11 (units restarted after 2011)
NUC_ON={'大飯原発':2360,'高浜原発':3392,'美浜原発':826,'玄海原発':2360,'川内原発':1780,'伊方原発':890,'女川原発':825,'島根原発':820,'柏崎刈羽原発':1356}
rows=[r for r in csv.DictReader(open('work/data/gppd.csv',encoding='utf-8')) if r['country']=='JPN' and float(r['capacity_mw'] or 0)>=500]
plants=[]
for r in sorted(rows,key=lambda r:-float(r['capacity_mw'])):
    nm=JA.get(r['name']);
    if not nm: continue
    if r['name']=='Ohi' and r['primary_fuel']=='Oil': nm='大井火力'
    if r['name']=='Ohi' and r['primary_fuel']=='Nuclear': nm='大飯原発'
    if r['name']=='Sendai' and r['primary_fuel']=='Nuclear': nm='川内原発'
    if r['name']=='Sendai' and r['primary_fuel']=='Oil': nm='川内火力'
    if nm=='福島第二原発': continue  # decommissioning
    la,lo,mw=float(r['latitude']),float(r['longitude']),float(r['capacity_mw']);x,y=wp(la,lo)
    fu=r['primary_fuel'];k='n' if fu=='Nuclear' else 'w' if fu=='Hydro' else 'f'
    m=next((p for p in plants if math.hypot(p['x']-x,p['y']-y)<2.0 and p['k']==k),None)
    if m: m['mw']+=mw;continue
    p={'n':nm,'k':k,'fuel':{'Gas':'ガス','Coal':'石炭','Oil':'石油','Hydro':'揚水・水力','Nuclear':'原子力'}[fu],'mw':mw,'x':round(x,1),'y':round(y,1)}
    if k=='n': p['on']=NUC_ON.get(nm,0)
    plants.append(p)
for p in plants: p['mw']=round(p['mw'])
print('plants',len(plants),sum(p['mw'] for p in plants if p['k']=='f'),'MW thermal')
# ---------- companies ----------
comp=json.load(open('work/data/co/companies.json'))
companies=[]
for c in comp:
    x,y=wp(c['lat'],c['lon']);companies.append({'n':c['name'],'pref':NAMES.index(c['pref'][:-1] if c['pref']!='北海道' else '北海道'),'rank':c['rank'],'cap':c['cap'],'ind':c['ind'],'city':c['city'],'x':round(x,1),'y':round(y,1)})
out={'prefs':prefs,'cities':cities,'nodes':nodes,'edges':edges,'airports':airports,'hubs':hubs,'plants':plants,'companies':companies,'meta':{'WW':1640,'WH':1760,'cap_date':'2026-11-19'}}
s=json.dumps(out,ensure_ascii=False,separators=(',',':'))
open('work/out/world.json','w').write(s);print('world.json bytes',len(s))
