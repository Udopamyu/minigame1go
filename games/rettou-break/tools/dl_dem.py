import math, os, concurrent.futures as cf, urllib.request
Z=8
def lon2x(lon): return int((lon+180)/360*2**Z)
def lat2y(lat):
    r=math.radians(lat); return int((1-math.log(math.tan(r)+1/math.cos(r))/math.pi)/2*2**Z)
xs=range(lon2x(122.8),lon2x(146.2)+1); ys=range(lat2y(45.8),lat2y(23.9)+1)
jobs=[(x,y) for x in xs for y in ys]
def get(xy):
    x,y=xy; fn=f'work/data/dem/{Z}_{x}_{y}.png'
    if os.path.exists(fn): return 'cached'
    try:
        urllib.request.urlretrieve(f'https://cyberjapandata.gsi.go.jp/xyz/dem_png/{Z}/{x}/{y}.png',fn); return 'ok'
    except Exception as e: return 'miss'
with cf.ThreadPoolExecutor(16) as ex: res=list(ex.map(get,jobs))
print(len(jobs),{k:res.count(k) for k in set(res)})
