"""Prepare frozen 2D NASA visualizations and declarative feature profiles.

Requires Pillow, NumPy, ffmpeg. Originals stay in --cache; only derived imagery and
pinned provenance are committed. Rolling GMAO assets are checked against recorded
hashes before reuse. Run with --cache /absolute/cache.
"""
from pathlib import Path
from PIL import Image
import argparse,hashlib,json,re,subprocess,urllib.request
import numpy as np

p=argparse.ArgumentParser();p.add_argument('--cache',type=Path,required=True);args=p.parse_args();cache=args.cache;cache.mkdir(parents=True,exist_ok=True)
root=Path(__file__).resolve().parents[1];frames=root/'public/frames';data=root/'public/data';docs=root/'docs';records=[];patches=[]
lock_path=docs/'additional-datasets.json';prior=json.loads(lock_path.read_text()) if lock_path.exists() else {};expected={r['url']:r['sha256'] for r in prior.get('originals',[])}

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def original(name,url):
 path=cache/name
 if not path.exists():urllib.request.urlretrieve(url,path)
 sha=digest(path)
 if url in expected and sha!=expected[url]:raise ValueError('Frozen upstream asset changed: '+url)
 records.append({'name':name,'url':url,'sha256':sha,'bytes':path.stat().st_size});return path

def sample_patches(im,id,index,points):
 a=np.asarray(im.convert('RGBA'));height,width=a.shape[:2]
 for label,lon,lat in points:
  x=min(width-1,max(0,int((lon+180)/360*width)));y=min(height-1,max(0,int((90-lat)/180*height)))
  neighborhood=[]
  for dy in range(-2,3):
   for dx in range(-2,3):neighborhood.extend(int(v) for v in a[min(height-1,max(0,y+dy)),(x+dx)%width])
  patches.append({'dataset':id,'frameIndex':index,'name':label,'location':{'lon':lon,'lat':lat},'sourcePixel':[x,y],'width':5,'height':5,'data':neighborhood})

def derived(im,stem,id,index=0,points=None):
 im=im.convert('RGB');local=frames/(stem+'.webp');display=frames/(stem+'-mercator.webp');im.save(local,lossless=True,method=6)
 size=1024;lat=np.degrees(np.arctan(np.sinh(np.pi*(1-2*(np.arange(size)+.5)/size))))
 sy=np.clip(np.floor((90-lat)/180*im.height).astype(int),0,im.height-1);sx=np.clip(np.floor((np.arange(size)+.5)/size*im.width).astype(int),0,im.width-1)
 Image.fromarray(np.asarray(im)[sy[:,None],sx[None,:]]).save(display,lossless=True,method=6)
 sample_patches(im,id,index,points or [('Sahara',15,23),('Atlantic',-45,30),('North Pacific',-150,25)])
 return {'local':'./frames/'+local.name,'display':'./frames/'+display.name,'localSha256':digest(local),'displaySha256':digest(display)}

def base(id,title,source_id,width,height):
 return {'id':id,'title':title,'sourcePage':f'https://svs.gsfc.nasa.gov/{source_id}/','credit':"NASA/Goddard Space Flight Center Scientific Visualization Studio",'width':width,'height':height,'geo':{'projection':'equirectangular','extent':[-180,-90,180,90],'authoritativeCRS':None,'validation':'Empirical full-image world alignment, not embedded georeferencing; see docs/additional-datasets.json.'},'displayProjection':{'name':'Web Mercator','width':1024,'height':1024,'latitudeLimit':85.0511287798066,'resampling':'nearest-neighbor at pixel centers'},'usage':'https://www.nasa.gov/nasa-brand-center/images-and-media/','frames':[],'missingBehavior':'Masked annotation pixels and unmatched feature colors are unavailable. Valid zero brightness remains distinct from missing data.'}
def save(m):
 path=data/(m['id']+'-manifest.json');path.write_text(json.dumps(m,indent=2)+'\n');return path

# Stable scalar alternatives to the multi-pollutant striped composite in SVS 5533.
air={
5151:{'name':'PM2.5','directory':'MC01_stage4_GMAO_pm25_2048x1024_en-hwtool','legend':'PM2.5_colorbar_plain.png','unit':'micrograms per cubic meter','symbol':'µg/m³','min':.4,'max':409.6,'interpolation':'log','columns':[74,461],'ticks':[(74,.4),(147.5,1.6),(226.5,6.4),(305.5,25.6),(384.5,102.4),(461,409.6)],'decimals':1},
5152:{'name':'Ozone','directory':'MC02_stage4_GMAO_O3_2048x1024_en-hwtool','legend':'O3_colorbar_plain.png','unit':'parts per billion by volume','symbol':'ppbv','min':5,'max':60,'interpolation':'linear','columns':[74,461],'ticks':[(74,5),(176.5,20),(319.5,40),(461,60)],'decimals':1},
5153:{'name':'Carbon monoxide','directory':'MC03_stage4_GMAO_CO_2048x1024_en-hwtool','legend':'CO_colorbar_plain.png','unit':'parts per billion by volume','symbol':'ppbv','min':40,'max':500,'interpolation':'linear','columns':[70,463],'ticks':[(70,40),(188.5,100),(279.5,130),(370.5,200),(463,500)],'decimals':0},
5154:{'name':'Nitrogen oxides','directory':'MC04_stage4_GMAO_NO2_2048x1024_en-hwtool','legend':'NOx_colorbar_plain.png','unit':'parts per billion by volume','symbol':'ppbv','min':.001,'max':10,'interpolation':'log','columns':[74,438],'ticks':[(74,.001),(176.5,.01),(280.5,.1),(358.5,1),(438,10)],'decimals':3},
}
for id,spec in air.items():
 prefix=f'https://svs.gsfc.nasa.gov/vis/a000000/a005100/a00{id}/'
 url=prefix+'frames/2048x1024_2x1_12p/'+spec['directory']+'/00000001.png';path=original(f'air-{id}.png',url)
 legend_url=prefix+spec['legend'];legend_path=original(f'air-{id}-legend.png',legend_url);im=Image.open(path);assert im.size==(2048,1024)
 legend=Image.open(legend_path).convert('RGBA');legend_local=frames/f'extra-air-{id}-legend.png';legend.save(legend_local)
 left,right=spec['columns'];palette=[list(legend.getpixel((x,50))[:3]) for x in range(left,right+1)];palette_path=data/f'air-{id}-palette.json';palette_path.write_text(json.dumps({'rgb':palette,'sampleRow':50,'sampleColumns':[left,right],'original':legend_url},separators=(',',':'))+'\n')
 m=base(f'air-{id}','GEOS-FP '+spec['name'],id,2048,1024);m['credit']="NASA’s Global Modeling and Assimilation Office; visualization Joseph V. Ardizzone (NASA/GSFC)"
 m['frames']=[{'timestamp':'2026-10-29T09:00:00Z','timeLabel':'29 Oct 2026 · 09:00 UTC','original':url,'originalSha256':digest(path),**derived(im,f'extra-air-{id}',m['id'])}]
 m['feature']={'method':'palette','matching':'rgb','kind':'quantitative','name':spec['name'],'unit':spec['unit'],'paletteUrl':'./data/'+palette_path.name,'estimate':True}
 m['feature']['background']={'maxChroma':12,'maxBrightness':235}
 m['matching']='rgb';m['paletteUrl']='./data/'+palette_path.name
 m['valueScale']={key:spec[key] for key in ['min','max','unit','symbol','decimals','interpolation']};m['valueScale']['anchors']=[{'position':(x-left)/(right-left),'value':value} for x,value in spec['ticks']]
 m['valueScale']['method']='Interpolation between visually transcribed labeled source ticks. Log interpolation is used between PM2.5/NOx anchors; CO uses nonuniform piecewise linear anchors. Values are estimates from rendered colors.'
 m['masks']=[[0,0,350,85],[0,930,520,1024]];m['legend']={'local':'./frames/'+legend_local.name,'original':legend_url,'meaning':spec['name']+' source colorbar; labeled ticks and nonuniform spacing are retained in valueScale.anchors.'}
 m['mapping']={'amplitude':'value','curve':'log' if spec['interpolation']=='log' else 'linear'}
 m['provenanceNote']='Full-resolution 2048 × 1024 GEOS-FP rendered frame. Logo/date overlays are masked. The related SVS 5533 composite interleaves pollutants in strips and is not used as a single global scalar.'
 m['description']='Frozen full-map GEOS-FP '+spec['name']+' layer, linked from the supplied Air Quality Model Runs resource. It is a separate GEOS-FP product, not the GEOS-CF striped composite.'
 m['representedInterval']='29 Oct 2026 05:00 EDT transcribed from the embedded frame label equals 09:00 UTC. Scientific averaging interval unverified; not live air quality.'
 m['limitations']='Rendered image colors and terrain/background compositing limit quantitative accuracy. Whole/decimal values are approximate colorbar estimates, not raw model-grid measurements.'
 if id==5154:m['limitations']+=' The unlabeled darkest tail beyond the last 10 ppbv tick is clipped to the last verified anchor; NOx label is retained rather than inferring NO2.'
 save(m)

# Categorical aerosol colors cannot be ranked as a scientific concentration.
aero_url='https://svs.gsfc.nasa.gov/vis/a000000/a005600/a005669/Aerosols_2025-08-19T20_00_00_1920x1080.png';path=original('aerosols.png',aero_url);im=Image.open(path);assert im.size==(1920,1080)
m=base('aerosols','GEOS Aerosols · 19 August 2025',5669,1920,1080);m['frames']=[{'timestamp':'2025-08-19T20:00:00Z','timeLabel':'19 Aug 2025 · 20:00 UTC','original':aero_url,'originalSha256':digest(path),**derived(im,'extra-aerosols','aerosols')}]
m['feature']={'method':'categories','kind':'visual','name':'Aerosol color strength','unit':'percent visual color strength','estimate':True,'categories':[{'id':'sea-salt','name':'Sea salt','hue':[170,240]},{'id':'dust','name':'Dust','hue':[265,325]},{'id':'smoke','name':'Smoke','hue':[0,45]},{'id':'sulfates','name':'Sulfates','hue':[65,165]}]}
m['valueScale']={'min':0,'max':100,'unit':'percent visual color strength','symbol':'%','decimals':0};m['mapping']={'amplitude':'value','curve':'linear'}
m['description']='GEOS model aerosol still: sea salt blue, dust purple/magenta, smoke orange/red and sulfates green. Select a category; its visual color strength drives sound.';m['provenanceNote']='Official 1920 × 1080 full-map visualization still, not a search thumbnail. Timestamp comes from NASA’s description and asset filename.'
m['representedInterval']='Model visualization at 19 Aug 2025 20:00 UTC; model averaging interval unverified.';m['limitations']='Color categories identify species, not an increasing scalar concentration. Hue selection and chroma describe the rendered overlay only; terrain, mixed aerosols and lights can contaminate matching. No aerosol concentration units are inferred.';save(m)

# The corresponding full flat-map annual lights film linked by EIC SVS 5313.
night_url='https://svs.gsfc.nasa.gov/vis/a000000/a005200/a005276/nightlights_flat_series_stills_only_lights_2160p3_h265.mp4';movie=original('nightlights.mp4',night_url)
city_points=[('Paris',2.35,48.86),('New York',-74.006,40.71),('Tokyo',139.69,35.68),('Sydney',151.2,-33.86),('Cairo',31.235,30.044),('Delhi',77.21,28.61)]
m=base('nightlights','Black Marble annual night lights',5313,2048,1152);m['relatedSourcePage']='https://svs.gsfc.nasa.gov/5276/';m['credit']="NASA’s Scientific Visualization Studio; Kel Elkins; NASA Black Marble/VIIRS science team"
night_alignment=[]
for index,(native_index,year) in enumerate([(0,2012),(6,2018),(11,2023)]):
 extracted=cache/f'night-native-{native_index}.png'
 if not extracted.exists():subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(movie),'-vf',f'select=eq(n\\,{native_index})','-frames:v','1',str(extracted)],check=True)
 im=Image.open(extracted).convert('RGB');assert im.size==(3840,2160);im=im.resize((2048,1152),Image.Resampling.LANCZOS)
 m['frames'].append({'timestamp':None,'timeLabel':f'{year} annual average','year':year,'original':night_url,'originalFrame':native_index,'nativeDimensions':[3840,2160],**derived(im,f'extra-nightlights-{year}','nightlights',index,city_points)})
 if year==2023:
  a=np.asarray(im)
  for name,lon,lat in city_points:
   x=int((lon+180)/360*2048);y=int((90-lat)/180*1152);patch=a[y-2:y+3,x-2:x+3]
   night_alignment.append({'name':name,'location':{'lon':lon,'lat':lat},'sourcePixel':[x,y],'rgb':[int(v) for v in a[y,x]],'patchMaxChannel':int(patch.max()),'patchMeanChannel':float(patch.mean()),'interpretation':'Expected city light cluster is bright at the full-image equirectangular coordinate.'})
   assert patch.max()>180 and patch.mean()>25
m['feature']={'method':'brightness','kind':'visual','name':'Night-light image brightness','unit':'percent image brightness','estimate':True};m['valueScale']={'min':0,'max':100,'unit':'percent image brightness','symbol':'%','decimals':1};m['mapping']={'amplitude':'value','curve':'sqrt'};m['masks']=[[870,690,1050,760]]
m['description']='Flat-map Black Marble annual-average light imagery for 2012, 2018 and 2023. Image brightness is a visual feature, not calibrated radiance.';m['provenanceNote']='Frames extracted from NASA’s 3840 × 2160 flat-map annual movie linked from the EIC collection, then resized to 2048 × 1152. Embedded year labels were visually verified and masked from sampling.'
m['representedInterval']='Each selected frame represents its labeled annual average; no January 1 instant or precise acquisition time is inferred.';m['limitations']='Rendered brightness is not calibrated physical radiance or a population measure. Dark pixels are valid low/zero visual brightness. Downsampling and compression can smooth small light clusters. No signed change palette or zoomed inset frames are used.';save(m)

# SOS texture is genuinely flat; rotating globe movies on the same page are excluded.
lightning_url='https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005011/iss_lightning_sos_yearly_07312023_2048p60.mp4';movie=original('lightning.mp4',lightning_url)
m=base('lightning','ISS LIS lightning · flat texture',5011,2048,1024)
for index,native_index in enumerate([420,600,1200]):
 extracted=cache/f'lightning-native-{native_index}.png'
 if not extracted.exists():subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(movie),'-vf',f'select=eq(n\\,{native_index})','-frames:v','1',str(extracted)],check=True)
 im=Image.open(extracted).convert('RGB');assert im.size==(4096,2048);im=im.resize((2048,1024),Image.Resampling.LANCZOS)
 m['frames'].append({'timestamp':None,'timeLabel':f'Animation frame {native_index} · exact date unverified','original':lightning_url,'originalFrame':native_index,'nativeDimensions':[4096,2048],**derived(im,f'extra-lightning-{native_index}','lightning',index)})
m['feature']={'method':'categories','kind':'visual','name':'Lightning-mark brightness','unit':'percent visual yellow-mark brightness','estimate':True,'categories':[{'id':'lightning','name':'Yellow lightning marks','hue':[40,75]}]};m['valueScale']={'min':0,'max':100,'unit':'percent visual yellow-mark brightness','symbol':'%','decimals':1};m['mapping']={'amplitude':'coverage','curve':'linear'}
m['description']='Quality-controlled ISS Lightning Imaging Sensor visualization, March 2017–July 2023, with a ten-day roving window. Yellow-mark brightness and neighborhood coverage are visual features, not event counts or flash rate.'
m['provenanceNote']='Extracted from the official 4096 × 2048 Science On a Sphere equirectangular texture movie, not the rotating globe preview; downsampled to 2048 × 1024.'
m['representedInterval']='Source collection March 2017–July 2023, displayed with a ten-day moving window. Exact scientific end date of each extracted animation frame is unverified.';m['limitations']='An unmarked region is only low visual mark coverage, not proof of zero flashes or satellite coverage. No per-frame dates are fabricated: the page’s labels.txt ends with an inconsistent 2003 date, and its mapping to this movie is unverified. Animation frame numbers establish ordering only. Grey guides and terrain are excluded by yellow-hue matching; marks are composited visual symbols and cannot recover lightning counts.';save(m)

# Derive provenance after all frames and feature assets are complete.
asset_records=[]
for path in sorted(frames.glob('extra-*')):asset_records.append({'path':str(path.relative_to(root)),'sha256':digest(path),'bytes':path.stat().st_size})
for path in sorted(data.glob('air-*-palette.json')):asset_records.append({'path':str(path.relative_to(root)),'sha256':digest(path),'bytes':path.stat().st_size})
report={'version':1,'originals':records,'derivedAssets':asset_records,'alignment':{'method':'Empirical full-world equirectangular alignment, independently of rendered aspect ratio. Mercator output resamples the entire source extent. Source files contain no authoritative embedded CRS.','nightLightsCheckpoints':night_alignment,'visualInspection':{'aerosols':['Greenland at about 42° W, 72° N','Madagascar at about 47° E, 20° S','Australia and Antarctica coastlines'],'lightning':['Mediterranean and African coasts','Madagascar','Australia','Greenland'],'airQuality':['Greenland','west African coast','South America','Australia']},'limits':'Visual/empirical support, not survey-grade georeferencing. Aerosols obscure coastlines; generalized geographic names/cues remain approximate.'},'legendCalibration':{'paletteRow':50,'airProfiles':{str(id):{'sampleColumns':s['columns'],'ticksPixelValue':s['ticks'],'interpolation':s['interpolation']} for id,s in air.items()},'limits':'Source ticks transcribed visually; tick pixel centers read from white guides. NOx palette ends at the last verified 10 ppbv tick rather than extrapolating the unlabeled darkest tail.'},'sourceSelection':{'airQuality':'Uses separate full-map GEOS-FP layers 5151–5154 linked from 5533. The striped GEOS-CF composite is excluded from global scalar mapping.','nightLights':'Flat annual maps from related 5276 are linked by the supplied EIC 5313 source.','lightning':'Flat SOS texture from 5011; exact per-frame science dates remain unknown.'},'excludedSources':[{'id':5196,'title':'DYAMOND Global Carbon Dioxide','reason':'Supplied assets show camera-orbit/zoom/tilt 3D globe point clouds; no verified fixed flat-map sampling grid found.'},{'id':4950,'title':'GEDI Forest Height','reason':'Supplied visualizations use 3D/globe or moving regional views with exaggerated height; no verified flat georeferenced raster found.'},{'id':4960,'title':'Atmospheric River','reason':'Explicit 3D atmospheric-river camera views; not treated as a flat geographical field.'},{'id':5425,'title':'Perpetual Ocean 2','reason':'3D globe/camera animations excluded as requested.'},{'id':13786,'title':'Caldwell 73','reason':'Sonification reference, not an Earth data layer.'}]}
lock_path.write_text(json.dumps(report,indent=2)+'\n');(root/'tests/fixtures/additional-patches.json').write_text(json.dumps(patches,separators=(',',':'))+'\n')
print('Prepared seven profiles: four air-quality layers, aerosols, night lights, lightning.')
print('Derived imagery total bytes:',sum(a['bytes'] for a in asset_records))
