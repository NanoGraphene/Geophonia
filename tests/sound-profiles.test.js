import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SOUND_PROFILES,resolveSoundProfile} from '../src/sound-profiles.js';
import {mapAudio} from '../src/audio-mapping.js';

test('automatic sound profiles cover every bundled dataset and each aerosol type',()=>{
 const catalog=JSON.parse(readFileSync('public/data/catalog.json','utf8'));
 const expected=['temperature','temperature','particles','ozone','carbon-monoxide','nitrogen-oxides','nightlights','sea-salt','lightning'];
 catalog.datasets.forEach((definition,index)=>{
   const manifest=JSON.parse(readFileSync('public/'+definition.manifest.replace('./',''),'utf8'));
   assert.equal(resolveSoundProfile(manifest,manifest.feature?.categories?.[0]?.id),expected[index],definition.label);
   for(const category of manifest.feature?.categories??[])assert.equal(resolveSoundProfile(manifest,category.id),category.id);
 });
});
test('all dataset sounds have a dominant fundamental and distinct, non-sinusoidal harmonic spectra',()=>{
 const spectra=new Set();
 for(const profile of Object.values(SOUND_PROFILES)){
   assert.equal(profile.partials[0],0);assert.equal(profile.partials[1],1);
   assert.ok(profile.partials.slice(2).filter(value=>value>0).length>=3);
   assert.ok(profile.partials.every(value=>Number.isFinite(value)&&value>=0&&value<=1));
   spectra.add(JSON.stringify(profile.partials));
 }
 assert.equal(spectra.size,Object.keys(SOUND_PROFILES).length);
});
test('new datasets can declare profiles or use manual overrides, with a neutral fallback',()=>{
 assert.equal(resolveSoundProfile({title:'My own grid'}),'harmonic');
 assert.equal(resolveSoundProfile({sonification:{profile:'ozone'}}),'ozone');
 assert.equal(resolveSoundProfile({sonification:{profile:'ozone',categoryProfiles:{dust:'dust'}}},'dust'),'dust');
 assert.equal(resolveSoundProfile({title:'Temperature'},'value','smoke'),'smoke');
 assert.equal(resolveSoundProfile({sonification:{profile:'unknown'}}),'harmonic');
});
test('negative temperature and zero use logarithmic pitch without taking the log of a physical value',()=>{
 const preferences={minHz:1000,maxHz:8000,volume:.25,mapping:{min:-40,max:40,curve:'linear',amplitude:'coverage'}};
 const sample=value=>({value:.5,measurement:value,density:1,validity:'valid'});
 assert.equal(mapAudio(sample(-40),preferences).frequency,1000);
 assert.equal(mapAudio(sample(0),preferences).frequency,Math.sqrt(8000000));
 assert.equal(mapAudio(sample(40),preferences).frequency,8000);
 assert.ok(mapAudio(sample(.1),preferences).frequency>mapAudio(sample(0),preferences).frequency);
});
