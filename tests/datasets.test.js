import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sampleDataset,createSelectionGate} from '../src/datasets.js';
import {createSurfaceMask} from '../src/geography.js';
const manifest=JSON.parse(await readFile(new URL('../public/data/temperature-manifest.json',import.meta.url)));
const palette=JSON.parse(await readFile(new URL('../public/data/temperature-palette.json',import.meta.url))).rgb;
const patches=JSON.parse(await readFile(new URL('./fixtures/temperature-patches.json',import.meta.url)));
test('actual NASA temperature patches provide samples over land and water',async()=>{
 const geo=JSON.parse(await readFile(new URL('../public/geography/manifest.json',import.meta.url)));
 const bytes=new Uint8Array(await readFile(new URL('../public/geography/surface-mask.bin',import.meta.url)));
 const mask=createSurfaceMask({...geo.mask,bytes});
 for(const patch of patches){
  const sample=sampleDataset({manifest:{...manifest,masks:[]},palette,imageData:patch},{lon:0,lat:0},2);
  assert.equal(sample.validity,'valid',patch.name);assert.ok(sample.value>=0&&sample.value<=1);assert.ok(sample.matchedPixels>0);
  assert.equal(mask.classify(patch.location).surface,patch.name==='water'?'water':'land');
 }
});
test('temperature palette keeps valid gray endpoints and excludes annotation masks',()=>{
 const source={manifest:{matching:'rgb',masks:[]},palette:[[10,10,10],[200,200,200]],imageData:{width:1,height:1,data:[10,10,10,255]}};
 assert.equal(sampleDataset(source,{lon:0,lat:0},0).value,0);
 source.manifest.masks=[[0,0,1,1]];assert.equal(sampleDataset(source,{lon:0,lat:0},0).value,null);
});
test('late dataset requests cannot overwrite a newer request, including failure',()=>{
 const gate=createSelectionGate(),old=gate.next(),latest=gate.next();
 assert.equal(gate.current(old),false);assert.equal(gate.current(latest),true);
 const retry=gate.next();assert.equal(gate.current(latest),false);assert.equal(gate.current(retry),true);
});
test('temperature timestamp is explicit EDT to UTC transcription, not playback time',()=>{
 assert.equal(manifest.frames[0].timestamp,'2026-10-29T09:00:00Z');assert.ok(manifest.limitations.includes('2 m and 3 m'));
});
