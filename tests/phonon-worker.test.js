import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpeechWorker} from '../src/speech-worker.js';

const frame=()=>({samples:new Float32Array([.2,-.3,.1,.15]),sampleRate:24000});
const send=(handler,data)=>handler({data});
function fixture({stream,yieldTask}={}){
  const messages=[],requests=[];let loads=0,closed=0;
  const engine={async *stream(text,settings){requests.push(text);try{if(stream){yield* stream(text,settings);}else{yield frame();yield frame();}}finally{closed++;}}};
  const handler=createSpeechWorker({loadEngine:async progress=>{loads++;progress({status:'Loading model'});return engine;},post:message=>messages.push(message),yieldTask:yieldTask??(async()=>{}),clock:()=>0});
  return {handler,messages,requests,get loads(){return loads;},get closed(){return closed;}};
}

test('automatic init loads once without synthesizing or prerendering audio',async()=>{
  const f=fixture();await send(f.handler,{type:'init'});await send(f.handler,{type:'init'});
  assert.equal(f.loads,1);assert.deepEqual(f.requests,[]);assert.equal(f.messages.filter(m=>m.type==='ready').length,2);assert.equal(f.messages.filter(m=>m.type==='chunk'||m.type==='complete').length,0);
});

test('streams arbitrary input before completing the valid PCM WAV',async()=>{
  const f=fixture();await send(f.handler,{type:'init'});
  const text='A new grid: −18.75 µg/m³ over the Adriatic Sea, 15 November 2026.';
  await send(f.handler,{type:'speak',id:1,text,rate:1});
  assert.deepEqual(f.requests,[text]);const results=f.messages.filter(m=>m.type==='chunk'||m.type==='complete');
  assert.deepEqual(results.map(m=>m.type),['chunk','chunk','complete']);assert.deepEqual(results.slice(0,2).map(m=>m.index),[0,1]);
  assert.equal(results[0].samples.length,4);const complete=results.at(-1);assert.equal(complete.samples,8);assert.equal(complete.sampleRate,24000);assert.equal(complete.chunks,2);assert.equal(Buffer.from(complete.wav).toString('ascii',0,4),'RIFF');assert.equal(new DataView(complete.wav).getUint32(40,true),16);
});

test('rapid requests cancel the old stream and keep only the latest queued text',async()=>{
  let f,replaced=false;
  f=fixture({yieldTask:async()=>{if(!replaced){replaced=true;send(f.handler,{type:'cancel',id:2});send(f.handler,{type:'speak',id:2,text:'Obsolete queued text'});send(f.handler,{type:'speak',id:3,text:'Newest location'});}}});
  await send(f.handler,{type:'init'});await send(f.handler,{type:'speak',id:1,text:'Old location'});
  assert.deepEqual(f.requests,['Old location','Newest location']);assert.deepEqual(f.messages.filter(m=>m.type==='chunk').map(m=>m.id),[1,3,3]);assert.deepEqual(f.messages.filter(m=>m.type==='complete').map(m=>m.id),[3]);assert.equal(f.closed,2);assert.equal(f.loads,1,'loaded model retained across cancellation');
});

test('silencing a stream suppresses completion and preserves model for the next key',async()=>{
  let f,cancelled=false;f=fixture({yieldTask:async()=>{if(!cancelled){cancelled=true;send(f.handler,{type:'cancel',id:2});}}});
  await send(f.handler,{type:'init'});await send(f.handler,{type:'speak',id:1,text:'Cancel this'});
  assert.equal(f.messages.filter(m=>m.type==='complete').length,0);
  await send(f.handler,{type:'speak',id:2,text:'Next reading'});assert.equal(f.loads,1);assert.deepEqual(f.messages.filter(m=>m.type==='complete').map(m=>m.id),[2]);
});

test('a generation failure is reported and a later request reuses the ready model',async()=>{
  const f=fixture({stream:async function*(text){if(text==='bad')throw new Error('model failure');yield frame();}});
  await send(f.handler,{type:'init'});await send(f.handler,{type:'speak',id:1,text:'bad'});await send(f.handler,{type:'speak',id:2,text:'good'});
  const error=f.messages.find(m=>m.type==='error');assert.equal(error.phase,'generate');assert.equal(error.id,1);assert.match(error.message,/model failure/);assert.equal(f.loads,1);assert.equal(f.messages.at(-1).type,'complete');
});

test('cold requests and invalid inputs fail cleanly without running the model',async()=>{
  const f=fixture();await send(f.handler,{type:'speak',id:1,text:'before initialization'});await send(f.handler,{type:'init'});await send(f.handler,{type:'speak',id:2,text:' '});await send(f.handler,{type:'speak',id:3,text:'x'.repeat(5001)});
  assert.equal(f.messages.filter(m=>m.type==='error').length,3);assert.deepEqual(f.requests,[]);
});
