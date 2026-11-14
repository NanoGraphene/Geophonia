import { DATASETS } from './datasets.js';
import { preparePalette } from './sampling.js';
import { gridDisplay } from './grid-renderer.js';
import { featureProfile, validateManifest } from './data-profiles.js';
import { frameCache } from './timeline.js';
const manifests=new Map(),localSources=new Map();
export function registerLocalSource(id,dataset){validateManifest(dataset.manifest);localSources.set(id,dataset);manifests.set(id,Promise.resolve(dataset.manifest));}
export function getManifest(id) {
  if(!DATASETS[id])return Promise.reject(new Error('Unknown dataset.'));
  if(!manifests.has(id))manifests.set(id,fetch(DATASETS[id].manifest).then(response=>{
    if(!response.ok)throw new Error(`Source manifest failed (${response.status}).`);
    return response.json().then(validateManifest);
  }).catch(error=>{manifests.delete(id);throw error;}));
  return manifests.get(id);
}
export const loadSource=frameCache(async(id='svs-3912',index=0)=>{
  const manifest=await getManifest(id),frame=manifest.frames[index];
  if(!Number.isInteger(index)||!frame)throw new Error('Selected frame is unavailable.');
  if(localSources.has(id)) {
    const gridData=localSources.get(id).grids[index];
    return {manifest,frame:{...frame,display:gridDisplay(manifest,gridData)},index,gridData};
  }
  const image=new Image(),display=new Image();image.src=frame.local;display.src=frame.display;
  await Promise.all([image.decode(),display.decode()]);
  if(image.naturalWidth!==manifest.width||image.naturalHeight!==manifest.height)throw new Error('Source dimensions do not match the manifest.');
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
  const profile=featureProfile(manifest),paletteURL=profile.paletteUrl??manifest.paletteUrl??DATASETS[id].palette;
  let palette=[];
  if(profile.method==='palette') {
    const response=await fetch(paletteURL);if(!response.ok)throw new Error('Source palette could not load.');
    const rgb=(await response.json()).rgb;
    palette=profile.matching==='chromatic'?preparePalette(rgb):rgb;
  }
  return {manifest,frame,index,palette,imageData:context.getImageData(0,0,canvas.width,canvas.height)};
});
