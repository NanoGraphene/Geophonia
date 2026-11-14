import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FrameSelection,createFrameCache,timeStep} from '../src/timeline.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('timeline respects Home/End and endpoints without wrapping',()=>{
 assert.equal(timeStep(0,'ArrowLeft',3),0);assert.equal(timeStep(2,'ArrowRight',3),2);
 assert.equal(timeStep(1,'Home',3),0);assert.equal(timeStep(1,'End',3),2);
});
test('actual ocean timestamps preserve irregular available intervals and temperature dates are verified',async()=>{
 const ocean=JSON.parse(await readFile(new URL('../public/data/source-manifest.json',import.meta.url)));
 const temperature=JSON.parse(await readFile(new URL('../public/data/temperature-manifest.json',import.meta.url)));
 for(const m of [ocean,temperature]){assert.equal(m.frames.length,3);assert.ok(m.frames.every((f,i)=>!i||Date.parse(f.timestamp)>Date.parse(m.frames[i-1].timestamp)));}
 assert.equal((Date.parse(ocean.frames[1].timestamp)-Date.parse(ocean.frames[0].timestamp))/60000,247);
 assert.equal((Date.parse(ocean.frames[2].timestamp)-Date.parse(ocean.frames[1].timestamp))/60000,248);
 assert.equal(temperature.frames[2].timestamp,'2026-10-29T11:00:00Z');
});
test('rapid time changes cannot commit stale images, samples or announcements',async()=>{
 const loads=[deferred(),deferred()];const controller=new FrameSelection((id,index)=>loads[index].promise);const committed=[];
 const hooks={pending(){},commit:s=>committed.push(s),failed:e=>{throw e;}};
 const a=controller.select('ocean',0,hooks),b=controller.select('ocean',1,hooks);
 loads[0].resolve({time:0,value:.2});assert.equal(await a,'stale');assert.equal(committed.length,0);
 loads[1].resolve({time:1,value:.8});assert.equal(await b,'committed');assert.deepEqual(committed,[{time:1,value:.8}]);
});
test('failed newer frame never revives an older response or plays an old value',async()=>{
 const older=deferred(),newer=deferred();const controller=new FrameSelection((id,index)=>index?newer.promise:older.promise);
 let sample={value:.5},errors=0;const hooks={pending(){sample=null;},commit:s=>{sample=s;},failed(){errors++;}};
 const a=controller.select('ocean',0,hooks),b=controller.select('ocean',1,hooks);
 newer.reject(new Error('network'));assert.equal(await b,'failed');older.resolve({value:.1});assert.equal(await a,'stale');
 assert.equal(sample,null);assert.equal(errors,1);
});
test('fixed location survives temporal selection and commit samples the latest shared location',async()=>{
 const d=deferred(),state={location:{lon:15,lat:23},time:0,sample:.2};const before={...state.location};
 const controller=new FrameSelection(()=>d.promise);const selected=controller.select('temp',1,{pending(){state.sample=null;},commit(s){state.time=s.time;state.sample=s.sampleAt(state.location);},failed(){}});
 d.resolve({time:1,sampleAt:location=>location.lon/100});await selected;
 assert.deepEqual(state.location,before);assert.equal(state.time,1);assert.equal(state.sample,.15);
});
test('frame cache shares in-flight loads, bounds reuse and permits retry after failure',async()=>{
 let calls=0;const cached=createFrameCache(async(id,index)=>{calls++;if(calls===1)throw new Error('retry');return {index};},2);
 await assert.rejects(cached('x',0));const a=cached('x',0),b=cached('x',0);assert.equal(a,b);await a;assert.equal(calls,2);
 await cached('x',1);await cached('x',2);await cached('x',0);assert.equal(calls,5);
});
