import test from 'node:test';
import assert from 'node:assert/strict';
import {TextSpeech} from '../src/text-speech.js';

function fixture({workerError=null,playError=null}={}) {
  const workers=[],urls=[],revoked=[],statuses=[],activity=[],diagnostics=[],timers=new Map();
  let sequence=0,timerSequence=0;
  const player={
    src:'',paused:true,ended:false,volume:.25,readyState:0,networkState:0,error:null,loads:0,plays:0,
    pause(){this.paused=true;this.onpause?.();},
    removeAttribute(name){if(name==='src')this.src='';},
    load(){this.loads++;},
    play(){this.plays++;return playError?Promise.reject(playError):Promise.resolve();},
    playing(){this.paused=false;this.ended=false;this.onplaying?.();},
    finish(){this.paused=true;this.ended=true;this.onended?.();}
  };
  const speech=new TextSpeech({
    player,
    createWorker(){
      if(workerError)throw workerError;
      const worker={messages:[],terminated:false,postMessage(message){this.messages.push(message);},terminate(){this.terminated=true;},emit(message){this.onmessage({data:message});}};
      workers.push(worker);return worker;
    },
    createURL(blob){const url=`blob:speech-${++sequence}`;urls.push({blob,url});return url;},
    revokeURL:url=>revoked.push(url),onStatus:message=>statuses.push(message),onActive:value=>activity.push(value),onDiagnostic:entry=>diagnostics.push(entry),
    schedule(fn,ms){const id=++timerSequence;timers.set(id,{fn,ms});return id;},
    unschedule:id=>timers.delete(id)
  });
  return {speech,player,workers,urls,revoked,statuses,activity,diagnostics,timers};
}
async function ready(f) {
  const pending=f.speech.prepare('/speech/espeak.data');
  const worker=f.workers.at(-1);worker.emit({type:'ready',mode:'wasm',loadMs:12});
  await pending;return worker;
}
const wavMessage=id=>({type:'audio',id,wav:new Uint8Array([82,73,70,70]).buffer,generationMs:8,duration:.5,sampleRate:22050,samples:11025});
const speechMessages=worker=>worker.messages.filter(message=>message.type==='speak');

test('arbitrary new text, names and decimals reach synthesis unchanged without a vocabulary whitelist',async()=>{
  const f=fixture(),worker=await ready(f);
  const text='Quetzaltenango, Zyxorville and 12.375 micrograms per cubic metre; −4.125 degrees.';
  assert.equal(await f.speech.speak(text),true);
  assert.equal(speechMessages(worker)[0].text,text);
  assert.equal(speechMessages(worker)[0].voice,'en-gb');assert.equal(speechMessages(worker)[0].rate,1);
  worker.emit(wavMessage(f.speech.serial));
  assert.equal(f.player.src,'blob:speech-1');assert.equal(f.player.plays,1);assert.equal(f.urls[0].blob.type,'audio/wav');
  assert.equal(f.diagnostics.at(-1).state,'audio generated');assert.equal(f.diagnostics.at(-1).sampleRate,22050);
});

test('a cold request waits for worker readiness and shares a prewarm already in flight',async()=>{
  const f=fixture();const warm=f.speech.prepare('/speech/engine.data');const speaking=f.speech.speak('An entirely new reading.');
  assert.equal(f.workers.length,1);const worker=f.workers[0];
  assert.equal(worker.messages.filter(m=>m.type==='init').length,1);assert.equal(worker.messages.find(m=>m.type==='init').dataUrl,'/speech/engine.data');
  assert.equal(speechMessages(worker).length,0);
  worker.emit({type:'ready',mode:'wasm',loadMs:3});await warm;
  assert.equal(await speaking,true);assert.equal(speechMessages(worker)[0].text,'An entirely new reading.');assert.equal(f.timers.size,0);
  await f.speech.prepare('/speech/engine.data');assert.equal(f.workers.length,1);
});

test('failed prewarm is visible and can be retried with a fresh worker',async()=>{
  const f=fixture();const loading=f.speech.prepare('/speech/engine.data');const failure=assert.rejects(loading,/download failed/);
  const first=f.workers[0];first.emit({type:'error',phase:'load',message:'Engine data download failed.'});await failure;
  assert.equal(first.terminated,true);assert.equal(f.speech.ready,false);assert.equal(f.speech.worker,null);assert.equal(f.timers.size,0);
  assert.match(f.statuses.at(-1),/download failed/);assert.equal(f.diagnostics.at(-1).state,'engine error');
  const next=await ready(f);assert.notEqual(next,first);assert.equal(f.workers.length,2);assert.equal(await f.speech.speak('Retry this text.'),true);
});

test('new requests and mute invalidate old WAV results instead of playing a stale reading',async()=>{
  const f=fixture(),worker=await ready(f);
  await f.speech.speak('Old country.');const old=f.speech.serial;
  await f.speech.speak('New country.');const current=f.speech.serial;
  worker.emit(wavMessage(old));assert.equal(f.player.plays,0);assert.equal(f.urls.length,0);
  worker.emit(wavMessage(current));assert.equal(f.player.plays,1);f.player.playing();assert.equal(f.activity.at(-1),true);
  f.speech.stop();assert.equal(f.player.paused,true);assert.equal(f.player.src,'');assert.deepEqual(f.revoked,['blob:speech-1']);assert.equal(f.activity.at(-1),false);
  worker.emit(wavMessage(current));assert.equal(f.player.plays,1);assert.equal(f.urls.length,1);
  await f.speech.speak('Cancelled by speech toggle.');const disabled=f.speech.serial;f.speech.setEnabled(false);worker.emit(wavMessage(disabled));
  assert.equal(f.player.plays,1);assert.equal(f.activity.at(-1),false);
});

test('stopping a cold reading prevents it from being synthesized when initialization finishes',async()=>{
  const f=fixture();const speaking=f.speech.speak('No longer requested.');const worker=f.workers[0];f.speech.stop();
  worker.emit({type:'ready',mode:'wasm',loadMs:1});assert.equal(await speaking,false);assert.equal(speechMessages(worker).length,0);
});

test('speech uses independent full volume by default and zero volume cancels pending playback',async()=>{
  const f=fixture(),worker=await ready(f);assert.equal(f.speech.volume,1);
  await f.speech.speak('Full voice volume.');worker.emit(wavMessage(f.speech.serial));assert.equal(f.player.volume,1);
  f.speech.setVolume(.45);assert.equal(f.player.volume,.45);
  await f.speech.speak('Do not play this after mute.');const id=f.speech.serial;f.speech.setVolume(0);worker.emit(wavMessage(id));
  assert.equal(f.player.src,'');assert.equal(await f.speech.speak('Still muted.'),false);assert.match(f.statuses.at(-1),/Speech volume is zero/);
  f.speech.setVolume(2);assert.equal(f.player.volume,1);f.speech.setVolume(-1);assert.equal(f.player.volume,0);
});

test('disabled speech and empty, non-text or overly long requests are rejected without loading',async()=>{
  const f=fixture();f.speech.setEnabled(false);assert.equal(await f.speech.speak('Disabled.'),false);assert.match(f.statuses.at(-1),/shortcuts are off/);
  f.speech.setEnabled(true);
  for(const text of ['', '   ', null, 123, 'a'.repeat(5001)]){assert.equal(await f.speech.speak(text),false);assert.match(f.statuses.at(-1),/5,000 characters/);}
  assert.equal(f.workers.length,0);assert.equal(f.player.plays,0);
});

test('NotAllowedError retains generated WAV for native Play and reports the precise playback failure',async()=>{
  const error=Object.assign(new Error('Autoplay is not permitted'),{name:'NotAllowedError'});
  const f=fixture({playError:error}),worker=await ready(f);await f.speech.speak('A novel sentence.');worker.emit(wavMessage(f.speech.serial));await Promise.resolve();
  assert.equal(f.player.src,'blob:speech-1');assert.equal(f.speech.url,'blob:speech-1');assert.equal(f.revoked.length,0);
  assert.equal(f.activity.at(-1),false);assert.match(f.statuses.at(-1),/NotAllowedError: Autoplay is not permitted/);
  assert.match(f.statuses.at(-1),/Press Play on the audio player below/);assert.match(f.statuses.at(-1),/standalone app/);
  assert.equal(f.diagnostics.at(-1).state,'playback error');
  // Native Play acts on the retained media; the actual playing event owns ducking.
  f.player.playing();assert.equal(f.activity.at(-1),true);assert.match(f.statuses.at(-1),/Speaking/);
  f.player.pause();assert.equal(f.activity.at(-1),false);assert.match(f.statuses.at(-1),/paused/);
  f.player.playing();assert.equal(f.activity.at(-1),true);f.player.finish();assert.equal(f.activity.at(-1),false);
});

test('only actual playback ducks the map and stale media callbacks cannot restore ducking after stop',async()=>{
  const f=fixture(),worker=await ready(f);await f.speech.speak('Freshly generated.');worker.emit(wavMessage(f.speech.serial));
  assert.equal(f.activity.includes(true),false);f.player.playing();assert.equal(f.activity.at(-1),true);
  const stalePlaying=f.player.onplaying,staleEnded=f.player.onended;
  f.player.pause();assert.equal(f.activity.at(-1),false);f.player.playing();assert.equal(f.activity.at(-1),true);
  f.speech.stop();f.player.paused=false;stalePlaying();staleEnded();assert.equal(f.activity.at(-1),false);
});

test('worker creation failure and initialization timeout are visible and leave no active load',async()=>{
  const blocked=fixture({workerError:Object.assign(new Error('Worker denied by policy'),{name:'SecurityError'})});
  await assert.rejects(blocked.speech.prepare('/speech/data'),/SecurityError: Worker denied by policy/);
  assert.equal(blocked.speech.loading,null);assert.equal(blocked.speech.ready,false);assert.equal(blocked.diagnostics.at(-1).state,'engine error');assert.equal(blocked.activity.at(-1),false);
  const f=fixture();const loading=f.speech.prepare('/speech/data');const failure=assert.rejects(loading,/initialization timed out/);
  const [{fn,ms}]=f.timers.values();assert.equal(ms,15000);fn();await failure;
  assert.equal(f.workers[0].terminated,true);assert.equal(f.timers.size,0);assert.equal(f.speech.loading,null);assert.equal(f.speech.ready,false);assert.equal(f.player.src,'');
});

test('synthesis and native media errors retain useful diagnostics and restore map gain',async()=>{
  const f=fixture(),worker=await ready(f);await f.speech.speak('Unusual text.');const id=f.speech.serial;
  worker.emit({type:'error',phase:'synthesis',id,message:'Phoneme conversion failed.'});assert.equal(f.activity.at(-1),false);assert.match(f.statuses.at(-1),/Phoneme conversion failed/);
  await f.speech.speak('Try another sentence.');worker.emit(wavMessage(f.speech.serial));f.player.playing();
  f.player.error={code:4,message:'Unsupported WAV codec'};f.player.onerror();
  assert.equal(f.activity.at(-1),false);assert.match(f.statuses.at(-1),/MediaError 4: Unsupported WAV codec/);assert.equal(f.player.src,'blob:speech-1');
});
