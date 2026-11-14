"""Build a packed geographic land/water mask and its independent alignment report.
Run: python scripts/prepare-geography.py --cache /absolute/cache
Requires Pillow and NumPy. Natural Earth vectors are public domain, pinned and hashed.
"""
import argparse, hashlib, json, urllib.request
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

parser=argparse.ArgumentParser();parser.add_argument('--cache',required=True,type=Path)
args=parser.parse_args();args.cache.mkdir(parents=True,exist_ok=True)
root=Path(__file__).resolve().parents[1]
commit='ca96624a56bd078437bca8184e78163e5039ad19'
base=f'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{commit}/geojson/'
sources=[('ne_50m_land.geojson','e874b27a51d146452be360cafb3cc50c86001074a67d534113e6534682f9826b'),('ne_50m_lakes.geojson','d350b75978b26fe839b797c2c529b2fb8f47fb3983c03f4964e36d5df9378a52')]
w,h=4096,2048
layers=[];metadata=[]
for name,expected in sources:
    path=args.cache/name
    if not path.exists():urllib.request.urlretrieve(base+name,path)
    digest=hashlib.sha256(path.read_bytes()).hexdigest()
    if digest!=expected:raise ValueError(f'Source hash mismatch: {name}')
    geo=json.loads(path.read_text());layer=np.zeros((h,w),dtype=bool);holes=0
    for feature in geo['features']:
        g=feature['geometry'];polygons=[g['coordinates']] if g['type']=='Polygon' else g['coordinates']
        for polygon in polygons:
            # Draw each polygon independently, then union; holes cannot erase an unrelated polygon.
            projected=[[(int((x+180)/360*w),int((90-y)/180*h)) for x,y,*_ in ring] for ring in polygon]
            x0=max(0,min(x for ring in projected for x,y in ring));x1=min(w-1,max(x for ring in projected for x,y in ring))
            y0=max(0,min(y for ring in projected for x,y in ring));y1=min(h-1,max(y for ring in projected for x,y in ring))
            if x0>x1 or y0>y1:continue
            tile=Image.new('L',(x1-x0+1,y1-y0+1));draw=ImageDraw.Draw(tile)
            for index,ring in enumerate(projected):draw.polygon([(x-x0,y-y0) for x,y in ring],fill=255 if index==0 else 0)
            layer[y0:y1+1,x0:x1+1]|=np.asarray(tile)>0
            holes+=len(polygon)-1
    layers.append(layer)
    metadata.append({'name':name,'url':base+name,'sha256':digest,'features':len(geo['features']),'polygonHoles':holes})
mask=layers[0]&~layers[1]
output=root/'public/geography';output.mkdir(exist_ok=True)
packed=np.packbits(mask.reshape(-1),bitorder='big').tobytes();(output/'surface-mask.bin').write_bytes(packed)
manifest={'name':'Natural Earth 1:50m land and lakes','sourceCommit':commit,'sources':metadata,'license':'Public domain','terms':'https://www.naturalearthdata.com/about/terms-of-use/','attribution':'Made with Natural Earth.','mask':{'url':'./geography/surface-mask.bin','width':w,'height':h,'extent':[-180,-90,180,90],'projection':'Equirectangular','packing':'row-major, one bit per cell, most-significant bit first; 1 land, 0 water','sha256':hashlib.sha256(packed).hexdigest(),'cellDegrees':360/w,'nominalEquatorialCellKm':40075/w,'rasterization':'Integer vertex rasterization, polygon union with holes preserved; subtract union of lake polygons. Classification refers to the selected cell.'},'limits':'Generalized 1:50m geometry and ~9.8 km equatorial raster cells. Small islands, narrow channels, exact shorelines and seasonal/historical water changes may be omitted. This is not a 2007 shoreline reconstruction. Near-coast means a 3x3 cell neighborhood contains both surfaces. Crossing notifications require a uniform 3x3 neighborhood on the new side; narrow features may not trigger a cue. Continuous data voicing is surface-neutral.'}
(output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
# Validate against source shading, excluding coast buffer and polar extremes.
im=Image.open(root/'public/frames/ocean-23000.png').convert('RGB');a=np.asarray(im).astype(int)
small=Image.fromarray(mask.astype('uint8')*255).resize(im.size,resample=Image.Resampling.NEAREST)
m=np.asarray(small)>0
inside=np.asarray(small.filter(ImageFilter.MinFilter(11)))>0
outside=np.asarray(small.filter(ImageFilter.MaxFilter(11)))>0
region=np.zeros_like(m);region[57:967]=True
confident=region&(inside|~outside)
rendered=(a.max(2)-a.min(2)<3)&(a.mean(2)>12)
checkpoints=[]
for name,lon,lat,expected in [('Sahara',15,23,'land'),('Australia',135,-25,'land'),('Greenland',-42,72,'land'),('South America',-60,-15,'land'),('North Pacific',-150,25,'water'),('South Atlantic',-15,-25,'water'),('Indian Ocean',75,-25,'water'),('North America',-105,40,'land'),('Madagascar',47,-20,'land'),('Lake Victoria',33,-1,'water'),('Lake Superior',-87,47,'water'),('Caspian Sea',51,42,'water')]:
    x=min(w-1,int((lon+180)/360*w));y=min(h-1,int((90-lat)/180*h));value='land' if mask[y,x] else 'water'
    sx=int((lon+180)/360*im.width);sy=int((90-lat)/180*im.height)
    checkpoints.append({'name':name,'location':{'lon':lon,'lat':lat},'expected':expected,'surface':value,'matchesExpected':value==expected,'sourceRGB':list(im.getpixel((sx,sy)))})
transects=[]
for name,lat,left,right in [('West Africa',10,-22,-8),('South America east coast',-20,-46,-33),('Australia west coast',-25,108,120),('Australia east coast',-25,145,159)]:
    y=int((90-lat)/180*im.height);lo=int((left+180)/360*im.width);hi=int((right+180)/360*im.width)
    source_edges=np.flatnonzero(rendered[y,lo:hi-1]!=rendered[y,lo+1:hi])+lo
    geometry_edges=np.flatnonzero(m[y,lo:hi-1]!=m[y,lo+1:hi])+lo
    error=min(abs(int(x)-int(z)) for x in source_edges for z in geometry_edges) if len(source_edges) and len(geometry_edges) else None
    transects.append({'name':name,'latitude':lat,'longitudeRange':[left,right],'sourceEdges':source_edges.tolist(),'maskEdges':geometry_edges.tolist(),'nearestEdgeErrorSourcePixels':error})
report={'method':'Independent Natural Earth 1:50m land/lakes mask compared with NASA rendered grayscale land. No source CRS metadata; empirical alignment only. Coastline comparison errors are nearest detected edges on four restricted transects, not global positional accuracy.','agreementAwayFromCoasts':float((rendered[confident]==m[confident]).mean()),'comparisonPixelCount':int(confident.sum()),'checkpoints':checkpoints,'coastlineTransects':transects}
(root/'docs/geography-validation.json').write_text(json.dumps(report,indent=2)+'\n')
assert report['agreementAwayFromCoasts']>.99 and all(p['matchesExpected'] for p in checkpoints)
assert all(t['nearestEdgeErrorSourcePixels'] is not None and t['nearestEdgeErrorSourcePixels']<=3 for t in transects)
print(json.dumps({'maskBytes':len(packed),'agreement':report['agreementAwayFromCoasts'],'checkpointsPassed':len(checkpoints),'transectErrors':[t['nearestEdgeErrorSourcePixels'] for t in transects]}))
