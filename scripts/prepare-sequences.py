"""Prepare frozen, dated NASA frame sequences; run with --cache /absolute/cache."""
from pathlib import Path
from PIL import Image
import numpy as np,json,hashlib,argparse,urllib.request
p=argparse.ArgumentParser();p.add_argument('--cache',type=Path,required=True);args=p.parse_args();args.cache.mkdir(parents=True,exist_ok=True)
root=Path(__file__).resolve().parents[1]
# Dates: ocean NASA flat_ecco2_dates.txt; temperature labels explicitly read as EDT (UTC−4).
specs=[('svs-3912',23004,'2007-03-25T16:07:00Z','ocean-23004.tif','https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/frames/2048x1024_1x1_30p/orig/flat_global_ecco2_2028x1024.23004.tif'),('svs-3912',23008,'2007-03-25T20:15:00Z','ocean-23008.tif','https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/frames/2048x1024_1x1_30p/orig/flat_global_ecco2_2028x1024.23008.tif'),('svs-5147',2,'2026-10-29T10:00:00Z','temp-2.png','https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005147/frames/2048x1024_2x1_12p/MC01_stage3_GMAO_near_surface_temperature_2048x1024_en-hwtool/00000002.png'),('svs-5147',3,'2026-10-29T11:00:00Z','temp-3.png','https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005147/frames/2048x1024_2x1_12p/MC01_stage3_GMAO_near_surface_temperature_2048x1024_en-hwtool/00000003.png')]
# Pinned hashes recorded in the sequence manifest on the first preparation.
paths={'svs-3912':'source-manifest.json','svs-5147':'temperature-manifest.json'}
manifests={id:json.loads((root/'public/data'/path).read_text()) for id,path in paths.items()}
for id,m in manifests.items():m['frames']=m['frames'][:1]
lat=np.degrees(np.arctan(np.sinh(np.pi*(1-2*(np.arange(1536)+.5)/1536))))
sy=np.clip(np.floor((90-lat)/180*1024).astype(int),0,1023);sx=np.floor((np.arange(1536)+.5)/1536*2048).astype(int)
lockpath=root/'public/data/sequence-lock.json';lock=json.loads(lockpath.read_text()) if lockpath.exists() else {}
for id,index,timestamp,name,url in specs:
 path=args.cache/name
 if not path.exists():urllib.request.urlretrieve(url,path)
 digest=hashlib.sha256(path.read_bytes()).hexdigest()
 if url in lock and lock[url]!=digest:raise ValueError('Rolling NASA source changed; assess before updating: '+url)
 lock[url]=digest
 im=Image.open(path).convert('RGB');assert im.size==(2048,1024)
 stem=f'{id}-{index}';im.save(root/f'public/frames/{stem}.webp',lossless=True)
 Image.fromarray(np.asarray(im)[sy[:,None],sx[None,:]]).save(root/f'public/frames/{stem}-mercator.webp',lossless=True)
 manifests[id]['frames'].append({'frame':index,'timestamp':timestamp,'original':url,'sha256':digest,'local':f'./frames/{stem}.webp','display':f'./frames/{stem}-mercator.webp'})
for id,m in manifests.items():
 m['sequenceVerification']='Three fixed-camera 2048x1024 frames, shared source palette and annotation masks; normalization fixed. Ocean times from NASA date table; temperature times transcribed from image labels. Scientific averaging intervals unverified.'
 (root/'public/data'/paths[id]).write_text(json.dumps(m,indent=2)+'\n')
lockpath.write_text(json.dumps(lock,indent=2)+'\n')
print('Prepared two three-frame sequences; source hashes pinned.')
