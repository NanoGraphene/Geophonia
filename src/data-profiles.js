import { geoToMercator, wrapLongitude } from './coordinates.js';
export function featureProfile(manifest) {
  return manifest.feature??{method:'palette',name:'Temperature-color position',matching:manifest.matching??'chromatic',estimate:true};
}
export function valueFromPosition(position,scale) {
  if(!scale||!Number.isFinite(position))return null;
  const x=Math.max(0,Math.min(1,position)),anchors=scale.anchors??[{position:0,value:scale.min},{position:1,value:scale.max}];
  let right=anchors.findIndex(a=>a.position>=x);if(right<0)return anchors.at(-1).value;if(!right)return anchors[0].value;
  const a=anchors[right-1],b=anchors[right],t=(x-a.position)/(b.position-a.position);
  return scale.interpolation==='log'?Math.exp(Math.log(a.value)+t*(Math.log(b.value)-Math.log(a.value))):a.value+t*(b.value-a.value);
}
export function sourcePixel(manifest,location,width=manifest.width,height=manifest.height) {
  if(!location||!Number.isFinite(location.lon)||!Number.isFinite(location.lat))return null;
  const geo=manifest.geo??{},[west,south,east,north]=geo.extent??[-180,-90,180,90];
  let lon=location.lon;if(east-west>=359.999&&lon!==180)lon=wrapLongitude(lon);
  if(lon<west||lon>east||location.lat<south||location.lat>north)return null;
  let x=(lon-west)/(east-west),y=(north-location.lat)/(north-south);
  if(geo.projection==='web-mercator') {
    const a=geoToMercator(0,north).y,b=geoToMercator(0,south).y;
    y=(geoToMercator(0,location.lat).y-a)/(b-a);
  }
  if(geo.gridCenters) {
    const xs=geo.gridCenters.lon,ys=geo.gridCenters.lat;
    return {x:Math.max(0,Math.min(width-1,Math.round((lon-xs[0])/(xs[1]-xs[0])))),y:Math.max(0,Math.min(height-1,Math.round((ys[0]-location.lat)/(ys[0]-ys[1]))))};
  }
  return {x:Math.min(width-1,Math.max(0,Math.floor(x*width))),y:Math.min(height-1,Math.max(0,Math.floor(y*height)))};
}
export function frameLabel(frame,formatter) {
  return frame?.timestamp?formatter(frame.timestamp):(frame?.timeLabel||'Scientific date not supplied');
}
export function recommendedMapping(manifest) {
  const scale=manifest.valueScale??{min:0,max:1};
  return {min:scale.min,max:scale.max,curve:manifest.mapping?.curve??'linear',amplitude:'coverage'};
}

export function validateManifest(manifest) {
  if(!Number.isInteger(manifest.width)||!Number.isInteger(manifest.height)||manifest.width<1||manifest.height<1||!manifest.frames?.length)throw new Error('Dataset needs positive grid dimensions and at least one frame.');
  const profile=featureProfile(manifest);
  if(!['palette','grid','brightness','categories'].includes(profile.method))throw new Error('Unsupported feature decoder. Select an ordered palette, scalar grid, brightness or explicit category.');
  const geo=manifest.geo??{projection:'equirectangular',extent:[-180,-90,180,90]};
  if(!['equirectangular','web-mercator'].includes(geo.projection))throw new Error('Reproject this source to a supported flat map before sampling.');
  const extent=geo.extent;
  if(!extent||extent.length!==4||!extent.every(Number.isFinite)||extent[0]>=extent[2]||extent[1]>=extent[3]||extent[0]<-180||extent[2]>180||extent[1]<-90||extent[3]>90)throw new Error('Invalid geographic coverage.');
  if(geo.projection==='web-mercator'&&(extent[1]<-85.051129||extent[3]>85.051129))throw new Error('Web Mercator coverage exceeds its latitude limit.');
  const scale=manifest.valueScale;
  if(!scale||!Number.isFinite(scale.min)||!Number.isFinite(scale.max)||scale.min>=scale.max)throw new Error('Supply one finite value range for the complete sequence.');
  if(scale.anchors)for(const [index,anchor]of scale.anchors.entries()) {
    if(!Number.isFinite(anchor.position)||!Number.isFinite(anchor.value)||anchor.position<0||anchor.position>1||(scale.interpolation==='log'&&anchor.value<=0)||(index&&(anchor.position<=scale.anchors[index-1].position||anchor.value<=scale.anchors[index-1].value)))throw new Error('Legend anchors must be finite and increasing; logarithmic anchors must be positive.');
  }
  return manifest;
}
