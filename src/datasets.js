import { geoToSource } from './coordinates.js';
export const DATASETS = {
 'svs-3912': { manifest: './data/source-manifest.json', palette: './data/palette.json', label: 'Ocean currents · temperature color', feature: 'Temperature-color position', density: 'Visual trace coverage', topic: 'OCEAN CURRENTS', alt: 'NASA ocean surface flows colored by sea surface temperature.' },
 'svs-5147': { manifest: './data/temperature-manifest.json', palette: './data/temperature-palette.json', label: 'Near-surface temperature · land + ocean', feature: 'Temperature-color position', density: 'Matched color coverage', topic: 'LAND + OCEAN TEMPERATURE', alt: 'NASA GEOS-FP near-surface temperature visualization covering land and ocean.' }
};
export function sampleDataset(source, location, radius, oceanSampler) {
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
