import test from 'node:test';
import assert from 'node:assert/strict';
import{numberPlan,unitPlan,readingPlan}from'../src/speech-plan.js';
test('place reading uses one complete natural clip and has explicit missing-name alternatives',()=>{
  assert.deepEqual(readingPlan('place',{place:{name:'Germany'}}),['place:Germany']);
  assert.deepEqual(readingPlan('place',{placeStatus:'loading'}),['phrase:namesLoading']);
  assert.deepEqual(readingPlan('test'),['phrase:test']);
});
test('number plans preserve zero, signs, decimals and named units without synthesizing text',()=>{
  assert.deepEqual(numberPlan(0),['number:0']);
  assert.deepEqual(numberPlan(-23.5,1),['phrase:minus','number:20','number:3','phrase:point','number:5']);
  assert.deepEqual(numberPlan(1402,0),['number:1','phrase:thousand','number:4','phrase:hundred','number:2']);
  assert.deepEqual(unitPlan('degrees Celsius'),['unit:celsius']);
  assert.deepEqual(unitPlan('µg/m³'),['unit:micrograms']);
  assert.deepEqual(unitPlan('kg'),['letter:k','letter:g']);
});
test('value readings preserve image estimates, scientific units, missing values and raw grid zero',()=>{
  const manifest={feature:{estimate:true},valueScale:{min:0,max:32,unit:'degrees Celsius',decimals:0}};
  assert.deepEqual(readingPlan('value',{manifest,state:{sample:{value:.5}}}),['phrase:approximately','number:16','unit:celsius']);
  const grid={feature:{estimate:false},valueScale:{unit:'meters',decimals:2}};
  assert.deepEqual(readingPlan('value',{manifest:grid,state:{sample:{value:0,measurement:0}}}),['number:0','unit:meters']);
  assert.deepEqual(readingPlan('value',{manifest,state:{sample:null}}),['phrase:loading']);
  assert.deepEqual(readingPlan('value',{manifest,state:{sample:{value:null,validity:'outside-coverage'}}}),['phrase:outside']);
});
test('date readings preserve UTC instants, annual averages and unverified animation dates',()=>{
  const instant=readingPlan('date',{frame:{timestamp:'2026-10-29T09:07:00Z'}});
  assert.deepEqual(instant,['ordinal:29','month:10','year:2026','phrase:at','number:9','phrase:oh','number:7','phrase:utc']);
  assert.deepEqual(readingPlan('date',{frame:{year:2018,timeLabel:'2018 annual average'}}),['year:2018','phrase:annualAverage']);
  assert.deepEqual(readingPlan('date',{frame:{originalFrame:420,timeLabel:'Animation frame420 · date unverified'}}),['phrase:animationFrame','number:4','phrase:hundred','number:20','phrase:dateUnverified']);
  assert.deepEqual(readingPlan('date',{frame:{timeLabel:'Undated grid'}}),['phrase:noDate']);
});
