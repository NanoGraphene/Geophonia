import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPlaceLookup,ringContains,loadPlaceNames} from '../src/place-names.js';
const bytes=await readFile(new URL('../public/geography/place-names.json',import.meta.url));
const lookup=createPlaceLookup(JSON.parse(bytes));
test('real country and marine polygons name land, seas, oceans and both sides of the date line',()=>{
  for(const [lon,lat,name]of[[15,23,'Chad'],[13.405,52.52,'Germany'],[2.35,48.86,'France'],[-.12,51.5,'United Kingdom'],[-45,30,'Atlantic Ocean'],[179,0,'Pacific Ocean'],[-179,0,'Pacific Ocean'],[15,35,'Mediterranean Sea'],[3,56,'North Sea'],[20,57,'Baltic Sea'],[-75,15,'Caribbean Sea'],[47,-20,'Madagascar']])assert.equal(lookup({lon,lat})?.name,name);
});
test('names asset matches provenance hash and retains named inland water rather than ocean fallback',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/geography/place-names-manifest.json',import.meta.url)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);assert.equal(lookup({lon:-87,lat:47.5}).kind,'lakes');
});
test('polygon holes and boundary points are handled and invalid/unmapped positions stay unknown',()=>{
  const ring=[[0,0],[10,0],[10,10],[0,10],[0,0]],hole=[[2,2],[4,2],[4,4],[2,4],[2,2]];
  const local=createPlaceLookup({regions:[{name:'Country',kind:'countries',bounds:[0,0,10,10],rings:[ring,hole]}]});
  assert.equal(local({lon:3,lat:3}),null);assert.equal(local({lon:1,lat:1}).name,'Country');assert.equal(local({lon:11,lat:5}),null);
  assert.equal(ringContains([0,5],ring),true);assert.equal(lookup({lon:NaN,lat:1}),null);
});
test('specific marine names take precedence over overlapping ocean polygons',()=>{
  const rings=[[[0,0],[10,0],[10,10],[0,10],[0,0]]];
  const local=createPlaceLookup({regions:[{name:'Ocean',kind:'marine',type:'ocean',bounds:[0,0,10,10],rings},{name:'Sea',kind:'marine',type:'sea',bounds:[0,0,10,10],rings}]});
  assert.equal(local({lon:5,lat:5}).name,'Sea');
});
test('failed or corrupted name downloads fail visibly instead of inventing a location',async()=>{
  await assert.rejects(loadPlaceNames(async()=>({ok:false})),/could not load/);
  let call=0;await assert.rejects(loadPlaceNames(async()=>++call===1?{ok:true,json:async()=>({url:'names',sha256:'incorrect'})}:{ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}),/integrity/);
});
