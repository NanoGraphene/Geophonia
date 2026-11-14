from pathlib import Path
from PIL import Image
import numpy as np,json,hashlib
import argparse, urllib.request
parser=argparse.ArgumentParser();parser.add_argument('--cache',required=True,type=Path)
args=parser.parse_args();cache=args.cache;cache.mkdir(parents=True,exist_ok=True)
urls={'temperature.png':'https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005147/frames/2048x1024_2x1_12p/MC01_stage3_GMAO_near_surface_temperature_2048x1024_en-hwtool/00000001.png','temperature-legend.png':'https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005147/NearSurfaceTemperature_colorbar_plain.png'}
# This is a regularly refreshed SVS frame directory. Require the frozen snapshot hash.
for name,url in urls.items():
 if not (cache/name).exists():urllib.request.urlretrieve(url,cache/name)
assert hashlib.sha256((cache/'temperature.png').read_bytes()).hexdigest()=='025243a704a65148c15ce0f91577142a9ddc6534afa8fdefa7666c89e6dc1555', 'NASA rolling frame changed; retain committed frozen assets or assess the new source before updating.'
root=Path(__file__).resolve().parents[1];out=root/'public/frames';data=root/'public/data'
im=Image.open(cache/'temperature.png').convert('RGB');im.save(out/'temperature-20261029.png')
legend=Image.open(cache/'temperature-legend.png').convert('RGBA');legend.save(out/'temperature-legend.png')
palette=[list(legend.getpixel((x,90))[:3]) for x in range(74,462)]
(data/'temperature-palette.json').write_text(json.dumps({'rgb':palette})+'\n')
w=h=1536;lat=np.degrees(np.arctan(np.sinh(np.pi*(1-2*(np.arange(h)+.5)/h))))
sy=np.clip(np.floor((90-lat)/180*1024).astype(int),0,1023);sx=np.floor((np.arange(w)+.5)/w*2048).astype(int)
Image.fromarray(np.asarray(im)[sy[:,None],sx[None,:]]).save(out/'temperature-mercator.png')
base='https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005147/'
m={'id':'svs-5147','title':'GEOS-FP Near-Surface Temperature','variable':'Near-surface temperature-color position','sourcePage':'https://svs.gsfc.nasa.gov/5147/','credit':'NASA’s Global Modeling and Assimilation Office; visualizer Joseph V. Ardizzone (NASA/GSFC)','width':2048,'height':1024,'paletteUrl':'./data/temperature-palette.json','matching':'rgb','masks':[[0,0,350,85],[0,930,520,1024]],'frames':[{'timestamp':'2026-10-29T09:00:00Z','timeLabel':'29 Oct 2026 · 09:00 UTC','local':'./frames/temperature-20261029.png','display':'./frames/temperature-mercator.png','original':base+'frames/2048x1024_2x1_12p/MC01_stage3_GMAO_near_surface_temperature_2048x1024_en-hwtool/00000001.png','sha256':hashlib.sha256((cache/'temperature.png').read_bytes()).hexdigest()}],'legend':{'local':'./frames/temperature-legend.png','original':base+'NearSurfaceTemperature_colorbar_plain.png','meaning':'Ordered -40 to +40 degrees Celsius source colorbar, sampled row 90 columns 74–461. Report normalized visual position only; terrain shading prevents exact temperature recovery.'},'sourceProjection':'Empirically aligned full-world equirectangular; no embedded CRS. Extent [-180,-90,180,90]. Recognizable Greenland, South America, Africa, Madagascar and Australia align with the existing geographic mask; exact coastlines remain approximate.','displayProjection':'Nearest-neighbor Web Mercator, latitude ±85.0511 degrees.','representedInterval':'Timestamp transcribed from frame: 29 Oct 2026 05:00 EDT = 09:00 UTC. Averaging interval unknown. This is a frozen downloaded frame, not live weather.','limitations':'Page describes sampling at both 2 m and 3 m; height unresolved. Source palette is non-monotonic in hue; match literal RGB, never generic blue-to-red hue ordering. Terrain shading and repeated colors introduce ambiguity. Logos and date overlay are excluded from sampling; gray pixels are not automatically missing, as the palette contains gray endpoints. Image estimates only, no measured Celsius values.','missingBehavior':'Masked annotation pixels or RGB distance >120 yield no interpretable visual sample. Real zero normalized palette position remains valid.','usage':'https://www.nasa.gov/nasa-brand-center/images-and-media/'}
m['valueScale']={'min':-40,'max':40,'unit':'degrees Celsius','symbol':'°C','variable':'Near-surface temperature','method':'Linear source colorbar interpolation, rounded to whole degrees; image estimate, not a raw model measurement.'}
m['legend']['reportedUnits']='Approximate degrees Celsius from source colorbar; normalized visual position retained for audio mapping.'
(data/'temperature-manifest.json').write_text(json.dumps(m,indent=2)+'\n')
# Real source patches support land and water regression checks, not invented measurements.
patches=[]
for name,lon,lat in [('sahara',15,23),('australia',135,-25),('water',-45,30)]:
 x=int((lon+180)/360*2048);y=int((90-lat)/180*1024)
 patches.append({'name':name,'location':{'lon':lon,'lat':lat},'width':5,'height':5,'data':[c for dy in range(-2,3) for dx in range(-2,3) for c in (*im.getpixel((x+dx,y+dy)),255)]})
(root/'tests/fixtures/temperature-patches.json').write_text(json.dumps(patches)+'\n')
