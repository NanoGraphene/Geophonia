import { geoToSource } from './coordinates.js';
import catalog from '../public/data/catalog.json' with {type:'json'};
import { valueFromPosition } from './data-profiles.js';
import { sampleFeatures } from './feature-sampling.js';
export const DATASETS=Object.fromEntries(catalog.datasets.map(d=>[d.id,d]));
export const UNAVAILABLE_DATASETS=catalog.unavailable;
export function registerDataset(id,definition){DATASETS[id]={id,...definition};}
export function sampleDataset(source, location, radius, oceanSampler, options = {}) {
 const sample=source.manifest.feature || source.gridData?sampleFeatures(source,location,radius,options):legacySample(source,location,radius,oceanSampler);
 return {...sample,measurement:sample.measurement??valueFromPosition(sample.value,source.manifest.valueScale)};
}
function legacySample(source,location,radius,oceanSampler) {
 if (source.manifest.matching !== 'rgb') return oceanSampler(source.imageData, location, radius, source.palette);
 const { width, height, data } = source.imageData, center = geoToSource(location.lon, location.lat, width, height);
 let total = 0, matched = 0, sum = 0;
 for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
  const y = center.y + dy; if (y < 0 || y >= height) continue;
  const x = ((center.x + dx) % width + width) % width; total++;
  if (source.manifest.masks?.some(([l,t,r,b])=>x>=l&&x<r&&y>=t&&y<b)) continue;
  const i=(y*width+x)*4; if(data[i+3]!==255) continue;
  let distance=Infinity, position=null;
  source.palette.forEach((color,index)=>{
   const d=color.reduce((s,c,k)=>s+(c-data[i+k])**2,0);
   if(d<distance){distance=d;position=index/(source.palette.length-1);}
  });
  if(distance<=120**2){sum+=position;matched++;}
 }
 return {value:matched?sum/matched:null,density:total?matched/total:0,validity:matched?'valid':'no-visual-sample',matchedPixels:matched,totalPixels:total,pixel:center};
}
// A late load can never commit over a newer selection, even when the newest fails.
export function createSelectionGate(){let ticket=0;return {next:()=>++ticket,current:id=>id===ticket};}
