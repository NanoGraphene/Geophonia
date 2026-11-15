import test from 'node:test';
import assert from 'node:assert/strict';
import{readFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import{readingPlan,numberPlan,unitPlan}from'../src/speech-plan.js';
import{valueFromPosition}from'../src/data-profiles.js';
import catalog from '../public/data/catalog.json' with {type:'json'};
const bank=JSON.parse(await readFile('public/speech/bank.json'));
function available(plan){for(const token of plan)assert.ok(bank.clips[token],`Recorded voice token exists: ${token}`);}
test('built-in voice covers every actual country, marine and inland-water name',async()=>{
  const geometry=JSON.parse(await readFile('public/geography/place-names.json'));const names=new Set();
  for(const region of geometry.regions){const name=region.kind==='lakes'&&!/\blake\b|\bsea\b|\blago\b|\blac\b|\bloch\b/i.test(region.name)?'Lake '+region.name:region.name;names.add(name);available(readingPlan('place',{place:{name}}));}
  assert.equal(names.size,842);assert.equal(Object.keys(bank.clips).length,1002);
});
test('recorded voice assets are real Ogg files matching pinned hashes and nonempty durations',async()=>{
  const checked=new Set();let bytes=0;
  for(const clip of Object.values(bank.clips)){
    assert.ok(clip.duration>.05&&Number.isFinite(clip.duration));
    assert.match(clip.url,/^\.\/speech\/[a-f0-9]+\.ogg$/);if(checked.has(clip.url))continue;
    const content=await readFile('public/'+clip.url.slice(2));assert.equal(content.subarray(0,4).toString(),'OggS');assert.ok(content.includes(Buffer.from('OpusHead')));
    assert.equal(createHash('sha256').update(content).digest('hex'),clip.sha256);checked.add(clip.url);bytes+=content.length;
  }
  assert.equal(checked.size,1000);assert.ok(bytes<6*1024*1024,'entire corpus stays small; runtime loads requested clips only');
});
test('every source unit, category and date plus zero/missing/error readings can use the built-in voice',async()=>{
  available(readingPlan('test'));available(readingPlan('place',{placeStatus:'loading',state:{location:{lat:23.5,lon:-45}}}));
  for(const d of catalog.datasets){
    const manifest=JSON.parse(await readFile('public/'+d.manifest.slice(2)));
    for(const frame of manifest.frames)available(readingPlan('date',{frame}));
    for(const category of manifest.feature?.categories??[{id:'value'}])for(const value of [0,.5,1])available(readingPlan('value',{manifest,state:{variable:category.id,sample:{value,measurement:valueFromPosition(value,manifest.valueScale)}}}));
  }
  for(const value of [0,-40,23.5,.0001,1999,2026,1e9])available(numberPlan(value,4));
  available(unitPlan('custom kg/m²'));available(readingPlan('value',{state:{sample:null}}));available(readingPlan('value',{state:{validity:'load-error'}}));
});
