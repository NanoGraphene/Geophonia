import test from 'node:test';
import assert from 'node:assert/strict';
import{readFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import{frameCache,stepFrame,keyboardCommand}from'../src/timeline.js';
import{createSelectionGate}from'../src/datasets.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('timeline clamps both endpoints and exposes numeric speech shortcuts without repeat chatter',()=>{
  assert.equal(stepFrame(0,-1,3),0);assert.equal(stepFrame(2,1,3),2);assert.equal(stepFrame(1,1,3),2);
  assert.equal(keyboardCommand({key:'1'}),'place');assert.equal(keyboardCommand({key:'2'}),'value');assert.equal(keyboardCommand({key:'3'}),'date');
  assert.equal(keyboardCommand({key:'1',repeat:true}),null);assert.equal(keyboardCommand({key:'1'},{speech:false}),null);
  assert.equal(keyboardCommand({key:'ArrowRight',repeat:true}),'next');assert.equal(keyboardCommand({key:'ArrowLeft'}),'previous');
});
test('speech/time shortcuts respect typing, modifiers, other sliders and spatial Shift+arrows',()=>{
  for(const key of ['1','2','3','ArrowLeft','ArrowRight']) {
    assert.equal(keyboardCommand({key},{editing:true}),null);assert.equal(keyboardCommand({key,ctrlKey:true}),null);assert.equal(keyboardCommand({key,metaKey:true}),null);
    assert.equal(keyboardCommand({key},{otherRange:true}),null);assert.equal(keyboardCommand({key,defaultPrevented:true}),null);
  }
  assert.equal(keyboardCommand({key:'ArrowLeft',shiftKey:true}),null);
  assert.equal(keyboardCommand({key:'Home'},{timeline:true}),'first');assert.equal(keyboardCommand({key:'End'},{timeline:true}),'last');
  assert.equal(keyboardCommand({key:'Home'}),null);
});
test('both manifests contain three chronologically ordered, distinct real sampling/display images',async()=>{
  for(const name of ['source-manifest','temperature-manifest']) {
    const m=JSON.parse(await readFile(`public/data/${name}.json`));assert.equal(m.frames.length,3);
    const originals=[],display=[];
    for(const [i,frame]of m.frames.entries()) {
      if(i)assert.ok(Date.parse(frame.timestamp)>Date.parse(m.frames[i-1].timestamp));
      for(const [path,list]of [[frame.local,originals],[frame.display,display]])list.push(createHash('sha256').update(await readFile('public/'+path.replace(/^\.\//,''))).digest('hex'));
    }
    assert.equal(new Set(originals).size,3);assert.equal(new Set(display).size,3);assert.equal(m.valueScale.unit,'degrees Celsius');
  }
});
test('rapid frame/dataset requests keep the newest sample and sample the current geographic location',async()=>{
  const gate=createSelectionGate(),loads=[deferred(),deferred()];
  let state={location:{lon:15,lat:23},sample:{value:.4},timestamp:'old'},errors=0;
  async function select(index){const ticket=gate.next();state.sample=null;try{const frame=await loads[index].promise;if(!gate.current(ticket))return;state.sample={value:frame.sampleAt(state.location)};state.timestamp=frame.timestamp;}catch{if(gate.current(ticket))errors++;}}
  const old=select(0),current=select(1);state.location={lon:20,lat:10};
  loads[1].resolve({timestamp:'new',sampleAt:location=>location.lon/100});await current;
  loads[0].reject(new Error('late failure'));await old;assert.equal(errors,0);assert.equal(state.timestamp,'new');assert.equal(state.sample.value,.2);assert.deepEqual(state.location,{lon:20,lat:10});
});
test('cache deduplicates loads, evicts old frames, and permits failed-frame retry',async()=>{
  let calls=0;const cached=frameCache(async(id,index)=>{calls++;if(calls===1)throw new Error('offline');return {id,index};},2);
  await assert.rejects(cached('x',0),/offline/);
  const a=cached('x',0),b=cached('x',0);assert.equal(a,b);await a;assert.equal(calls,2);
  await cached('x',1);await cached('x',2);await cached('x',0);assert.equal(calls,5);
});

test('same fixed location gets real new pixel samples and dates in each selected frame',async()=>{
  const {sampleDataset}=await import('../src/datasets.js');
  const {sampleNeighborhood,preparePalette}=await import('../src/sampling.js');
  const {temperatureEstimate}=await import('../src/narration-text.js');
  const patches=JSON.parse(await readFile('tests/fixtures/sequence-patches.json'));
  for(const [id,file,paletteFile]of [['svs-3912','source-manifest','palette'],['svs-5147','temperature-manifest','temperature-palette']]) {
    const manifest=JSON.parse(await readFile(`public/data/${file}.json`));const rgb=JSON.parse(await readFile(`public/data/${paletteFile}.json`)).rgb;
    const palette=manifest.matching==='rgb'?rgb:preparePalette(rgb);
    const samples=patches.filter(p=>p.dataset===id).map((patch,index)=>{
      assert.equal(patch.timestamp,manifest.frames[index].timestamp);
      const sample=sampleDataset({manifest:{...manifest,masks:[]},palette,imageData:patch},{lon:0,lat:0},2,sampleNeighborhood);
      assert.notEqual(sample.value,null);assert.ok(Number.isFinite(temperatureEstimate(sample,manifest)));return sample.value;
    });
    assert.equal(samples.length,3);assert.ok(new Set(samples).size>1,'time changes must resample actual new frame pixels');
  }
});
