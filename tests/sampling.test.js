import test from 'node:test';
import assert from 'node:assert/strict';
import { preparePalette, matchColor, sampleNeighborhood } from '../src/sampling.js';
import { DEFAULT_MAX_HZ, DEFAULT_MIN_HZ, mapAudio, validatePitchRange } from '../src/audio-mapping.js';
import { readFile } from 'node:fs/promises';
const rgb=JSON.parse(await readFile(new URL('../public/data/palette.json',import.meta.url))).rgb;
const palette=preparePalette(rgb);
const preferences={minHz:200,maxHz:2000,volume:.25};
const image=(colors,width=colors.length)=>({width,height:colors.length/width,data:Uint8ClampedArray.from(colors.flat())});
test('actual source palette is ordered blue to red, including valid zero',()=>{
 const positions=[0,60,130,200,275].map(i=>matchColor(...rgb[i],255,palette));
 assert.equal(positions[0],0);assert.ok(positions.every((p,i)=>p!==null&&(i===0||p>positions[i-1])));
});
test('brightness normalization keeps dark and bright versions of a trace comparable',()=>{
 const c=rgb[130]; const full=matchColor(...c,255,palette);
 const dim=matchColor(...c.map(v=>Math.round(v*.4)),255,palette);
 assert.ok(Math.abs(full-dim)<.02);
});
test('gray land, black gaps, transparent, too-dark and off-palette colors are missing',()=>{
 for(const c of [[50,50,50,255],[0,0,0,255],[0,0,255,0],[1,2,3,255],[255,0,255,255]]) assert.equal(matchColor(...c,palette),null);
});
test('neighborhood separates trace proportion and palette mean, preserving zero',()=>{
 const im=image([[...rgb[0],255],[50,50,50,255],[0,0,0,255]]);
 const result=sampleNeighborhood(im,{lon:0,lat:0},1,palette);
 assert.equal(result.value,0);assert.equal(result.validity,'valid');
 assert.equal(result.density,1/3);assert.equal(result.totalPixels,3);
 const mapped=mapAudio(result,preferences);assert.equal(mapped.frequency,200);assert.ok(mapped.gain>0);
});
test('missing sample has null value and zero gain; no NaN from empty neighborhood',()=>{
 const result=sampleNeighborhood(image([[0,0,0,255]]),{lon:0,lat:0},0,palette);
 assert.equal(result.value,null);assert.equal(result.density,0);assert.equal(result.validity,'no-visual-sample');
 assert.deepEqual(mapAudio(result,preferences),{frequency:null,gain:0});
});
test('sampling wraps at the antimeridian and omits pixels beyond source poles',()=>{
 const im=image([[...rgb[0],255],[0,0,0,255],[...rgb[275],255],[0,0,0,255],[0,0,0,255],[0,0,0,255]],3);
 const result=sampleNeighborhood(im,{lon:-180,lat:90},1,palette);
 assert.equal(result.totalPixels,6);assert.equal(result.matchedPixels,2);assert.ok(result.value>.45&&result.value<.55);
 assert.throws(()=>sampleNeighborhood(im,{lon:0,lat:0},-1,palette));
});
test('value maps to continuous logarithmic pitch with a 2000 Hz ceiling and gain stays bounded',()=>{
 const s=value=>({value,density:1,validity:'valid'});
 assert.equal(mapAudio(s(0),preferences).frequency,DEFAULT_MIN_HZ);
 assert.equal(mapAudio(s(1),preferences).frequency,DEFAULT_MAX_HZ);
 assert.ok(Math.abs(mapAudio(s(.5),preferences).frequency-Math.sqrt(DEFAULT_MIN_HZ*DEFAULT_MAX_HZ))<1e-9);
 assert.ok(Math.abs(mapAudio(s(-1),preferences).frequency-DEFAULT_MIN_HZ)<1e-9);assert.ok(Math.abs(mapAudio(s(2),preferences).frequency-DEFAULT_MAX_HZ)<1e-9);
 const pitches=[0,.001,.002,.5,1].map(value=>mapAudio(s(value),preferences).frequency);assert.ok(pitches.every((f,i)=>!i||f>pitches[i-1]));
 assert.ok(Math.abs(pitches[1]/pitches[0]-pitches[2]/pitches[1])<1e-12,'equal small increments have equal pitch ratios');
 assert.equal(validatePitchRange(200,2001),false);
 assert.equal(mapAudio(s(1),preferences).gain,.03);
 assert.ok(mapAudio({...s(1),density:.5},preferences).gain>.015);
 assert.equal(mapAudio(s(1),{...preferences,volume:0}).gain,0);
 assert.equal(validatePitchRange(800,160),false);assert.equal(validatePitchRange(100,2000),true);
 assert.equal(validatePitchRange(NaN,2000),false);
});
test('the same color stays comparable across fixture frames, independent of nearby density',()=>{
 const c=[...rgb[130],255];
 const a=sampleNeighborhood(image([c,c,c]),{lon:0,lat:0},1,palette);
 const b=sampleNeighborhood(image([c,[0,0,0,255],[0,0,0,255]]),{lon:0,lat:0},1,palette);
 assert.equal(a.value,b.value);assert.ok(a.density>b.density);
 assert.equal(mapAudio(a,preferences).frequency,mapAudio(b,preferences).frequency);
});
test('real NASA patches distinguish cooler/warm colors and uncolored land',async()=>{
 const {patches}=JSON.parse(await readFile(new URL('./fixtures/nasa-patches.json',import.meta.url)));
 const results=Object.fromEntries(patches.map(p=>[p.name,sampleNeighborhood(p,{lon:0,lat:0},2,palette)]));
 assert.equal(results.start.validity,'valid');
 assert.equal(results['gray-land'].value,null);
 assert.ok(results['cool-traces'].value<results.start.value);
 assert.ok(results.start.value<results['warm-traces'].value);
 assert.equal(results['warm-traces'].matchedPixels,22);
 assert.equal(results['cool-traces'].matchedPixels,7);
});
test('trace color ordering tolerates saturation changes from visual compositing',()=>{
 const c=rgb[60];const normalized=matchColor(...c,255,palette);
 const lessSaturated=c.map(v=>Math.round(v*.5+50));
 assert.ok(Math.abs(normalized-matchColor(...lessSaturated,255,palette))<.02);
});
