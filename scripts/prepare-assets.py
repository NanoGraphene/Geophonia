"""Reproduce local NASA PNGs, Mercator resampling, palette and alignment report.
Run from project root: python scripts/prepare-assets.py --cache /absolute/cache
Requires Pillow and NumPy (available in the development environment).
All scientific source bytes and Natural Earth geometry are hash-checked.
"""
import argparse, hashlib, json, urllib.request
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

parser = argparse.ArgumentParser()
parser.add_argument('--cache', required=True, type=Path)
args = parser.parse_args()
args.cache.mkdir(parents=True, exist_ok=True)
root = Path(__file__).resolve().parents[1]
base = 'https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/'

def fetch(name, url, expected=None):
    path = args.cache / name
    if not path.exists():
        urllib.request.urlretrieve(url, path)
    if expected and hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise ValueError(f'Source hash mismatch: {name}')
    return path

original = fetch('ocean-23000.tif', base+'frames/2048x1024_1x1_30p/orig/flat_global_ecco2_2028x1024.23000.tif', '0e135b7e502f23939ac8cf198fcdd9ae6a8ee94cbe5ed35fe55b134f40980f24')
geometry = fetch('ne_110m_land.geojson', 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson', '9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9')
legend_path = fetch('ocean-legend.png', base+'sst_ecco2_cbar.png')
im = Image.open(original).convert('RGB')
assert im.size == (2048, 1024)
im.save(root/'public/frames/ocean-23000.png')
w = h = 1536
lat = np.degrees(np.arctan(np.sinh(np.pi*(1-2*(np.arange(h)+.5)/h))))
sy = np.clip(np.floor((90-lat)/180*1024).astype(int), 0, 1023)
sx = np.clip(np.floor((np.arange(w)+.5)/w*2048).astype(int), 0, 2047)
Image.fromarray(np.asarray(im)[sy[:,None], sx[None,:]]).save(root/'public/frames/ocean-23000-mercator.png')
legend = Image.open(legend_path).convert('RGB')
legend.save(root/'public/frames/source-legend.png')
(root/'public/data/palette.json').write_text(json.dumps({'source':'NASA SVS 3912 sst_ecco2_cbar.png', 'sampleRow':50, 'sampleColumns':[15,290], 'rgb':[list(legend.getpixel((x,50))) for x in range(15,291)]}, separators=(',',':'))+'\n')
mask = Image.new('L', im.size)
draw = ImageDraw.Draw(mask)
for feature in json.loads(geometry.read_text())['features']:
    g = feature['geometry']
    polygons = [g['coordinates']] if g['type']=='Polygon' else g['coordinates']
    for polygon in polygons:
        for index, ring in enumerate(polygon):
            draw.polygon([((x+180)/360*2048,(90-y)/180*1024) for x,y,*_ in ring],fill=255 if index==0 else 0)
a = np.asarray(im).astype(int)
land = (a.max(2)-a.min(2)<3)&(a.mean(2)>12)
m = np.asarray(mask)>0
region = np.zeros_like(m);region[57:967]=True
inside = np.asarray(mask.filter(ImageFilter.MinFilter(11)))>0
outside = np.asarray(mask.filter(ImageFilter.MaxFilter(11)))>0
confident = region&(inside|~outside)
points = []
for name,lon,lat in [('Sahara',15,23),('Australia',135,-25),('Greenland',-42,72),('South America',-60,-15),('North Pacific',-150,25),('South Atlantic',-15,-25),('Indian Ocean',75,-25),('North America',-105,40)]:
    x=int((lon+180)/360*2048);y=int((90-lat)/180*1024)
    points.append({'checkpoint':name,'longitude':lon,'latitude':lat,'pixel':[x,y],'rgb':list(im.getpixel((x,y))),'geometryLand':bool(m[y,x]),'renderedGrayLand':bool(land[y,x]),'agrees':bool(m[y,x]==land[y,x])})
report={'method':'Empirical full-image equirectangular alignment; compare rendered grayscale land with independent Natural Earth 1:110m land geometry. Exclude 5 source pixels around geometry boundaries and latitudes beyond 80 degrees. Not authoritative CRS metadata.', 'agreement':float((land[confident]==m[confident]).mean()), 'comparisonPixelCount':int(confident.sum()), 'checkpoints':points, 'naturalEarthSha256':hashlib.sha256(geometry.read_bytes()).hexdigest()}
(root/'docs/alignment.json').write_text(json.dumps(report,indent=2))
assert report['agreement']>.99 and all(p['agrees'] for p in points)
print(f"Prepared assets. Empirical alignment agreement: {report['agreement']:.4%}")

# Store small real-source regression patches; scientific values are not inferred.
rgba = im.convert('RGBA')
patches = []
for name,lon,lat in [('start',-45,30),('gray-land',15,23),('cool-traces',-30,55),('warm-traces',-45,0)]:
    x=int((lon+180)/360*2048);y=int((90-lat)/180*1024)
    data=[c for dy in range(-2,3) for dx in range(-2,3) for c in rgba.getpixel(((x+dx)%2048,y+dy))]
    patches.append({'name':name,'location':{'lon':lon,'lat':lat},'sourcePixel':[x,y],'width':5,'height':5,'data':data})
(root/'tests/fixtures/nasa-patches.json').write_text(json.dumps({'sourceFrame':23000,'sourceSha256':hashlib.sha256(original.read_bytes()).hexdigest(),'patches':patches},indent=2)+'\n')
