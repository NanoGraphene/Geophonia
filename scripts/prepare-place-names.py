"""Prepare local place polygons from pinned public-domain Natural Earth GeoJSON."""
from pathlib import Path
import argparse,json,hashlib,urllib.request
REVISION='ca96624a56bd078437bca8184e78163e5039ad19'
FILES={'countries':'ne_50m_admin_0_countries.geojson','marine':'ne_10m_geography_marine_polys.geojson','lakes':'ne_50m_lakes.geojson'}
p=argparse.ArgumentParser();p.add_argument('--cache',type=Path,required=True);args=p.parse_args();args.cache.mkdir(parents=True,exist_ok=True)
root=Path(__file__).resolve().parents[1];regions=[];sources=[]
def rounded(coords):
 if isinstance(coords[0],(float,int)):return [round(v,3) for v in coords[:2]]
 return [rounded(c) for c in coords]
for kind,file in FILES.items():
 url=f'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{REVISION}/geojson/{file}'
 path=args.cache/(REVISION+'-'+file)
 if not path.exists():urllib.request.urlretrieve(url,path)
 raw=path.read_bytes();sources.append({'kind':kind,'url':url,'sha256':hashlib.sha256(raw).hexdigest()})
 for f in json.loads(raw)['features']:
  props=f['properties'];name=props.get('NAME_EN') or props.get('name_en') or props.get('ADMIN') or props.get('name')
  if not name:continue
  feature=props.get('featurecla','')
  if kind=='marine' and feature in ['reef','bank','shoal','ridge','trench']:continue
  geometry=f['geometry'];polygons=[geometry['coordinates']] if geometry['type']=='Polygon' else geometry['coordinates']
  for polygon in polygons:
   rings=rounded(polygon);xs=[c[0] for c in rings[0]];ys=[c[1] for c in rings[0]]
   regions.append({'name':name,'kind':kind,'type':feature,'bounds':[min(xs),min(ys),max(xs),max(ys)],'rings':rings})
output=root/'public/geography/place-names.json';output.write_text(json.dumps({'regions':regions},separators=(',',':'))+'\n')
manifest={'source':'Natural Earth','revision':REVISION,'license':'Public domain','sources':sources,'url':'./geography/place-names.json','sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'regions':len(regions),'limits':'Approximate generalized present-day boundaries. No historical or authoritative border claims. Coordinates rounded to 0.001 degrees; polygon holes retained. Local point-in-polygon lookup; no reverse-geocoding service. Named inland lakes take priority over countries, and smaller marine areas take priority over oceans. Unmatched locations are reported explicitly.'}
(root/'public/geography/place-names-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Prepared {len(regions)} local named polygons; {output.stat().st_size} bytes.')
