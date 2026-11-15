import test from 'node:test';
import assert from 'node:assert/strict';
import {PhononSpeech} from '../src/phonon-speech.js';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({contextError=null,resumeError=null,holdResume=false,workerError=null}={}){
 const workers=[],contexts=[],urls=[],revoked=[],statuses=[],activity=[],diagnostics=[],timers=new Map();let timer=0,clock=100;
 const player={src:'',paused:true,ended:false,volume:.2,playbackRate:1,plays:0,loads:0,error:null,
  pause(){this.paused=true;this.onpause?.();},removeAttribute(name){if(name==='src')this.src='';},load(){this.loads++;},
  play(){this.plays++;this.paused=false;this.ended=false;this.onplaying?.();return Promise.resolve();},
  finish(){this.paused=true;this.ended=true;this.onended?.();}};
 const speech=new PhononSpeech({player,now:()=>clock,
  createWorker(){if(workerError)throw workerError;const worker={messages:[],terminated:false,postMessage(m){this.messages.push(m);},terminate(){this.terminated=true;},emit(m){this.onmessage?.({data:m});}};workers.push(worker);return worker;},
  createContext(){if(contextError)throw contextError;const context={state:'suspended',currentTime:0,baseLatency:.01,outputLatency:.02,nodes:[],gains:[],destination:{kind:'destination'},resumeCalls:0,
   resume(){this.resumeCalls++;if(resumeError)return Promise.reject(resumeError);if(holdResume)return new Promise(resolve=>{this.releaseResume=()=>{this.state='running';resolve();};});this.state='running';return Promise.resolve();},
   async close(){this.state='closed';},
   createGain(){const gain={gain:{value:1},connections:[],connect(target){this.connections.push(target);}};this.gains.push(gain);return gain;},
   createBuffer(channels,length,rate){const data=new Float32Array(length);return {channels,length,rate,data,getChannelData:()=>data};},
   createBufferSource(){const node={playbackRate:{value:1},connections:[],connect(target){this.connections.push(target);},disconnect(){this.disconnected=true;},start(time){this.startTime=time;},stop(){this.stopped=true;},end(){this.onended?.();}};this.nodes.push(node);return node;}};
   contexts.push(context);return context;},
  createURL(blob){const url=`blob:phonon-${urls.length+1}`;urls.push({url,blob});return url;},revokeURL:url=>revoked.push(url),
  onStatus:m=>statuses.push(m),onActive:value=>activity.push(value),onDiagnostic:d=>diagnostics.push(d),
  schedule(fn,ms){const id=++timer;timers.set(id,{fn,ms});return id;},unschedule:id=>timers.delete(id)});
 return {speech,player,workers,contexts,urls,revoked,statuses,activity,diagnostics,timers,advance:ms=>{clock+=ms;}};
}
async function ready(f){const loading=f.speech.prepare(),worker=f.workers.at(-1);worker.emit({type:'ready',mode:'CPU/WASM',loadMs:12});await loading;return worker;}
const speakMessages=w=>w.messages.filter(m=>m.type==='speak');
const chunk=(id,value=.25)=>({type:'chunk',id,samples:new Float32Array(1920).fill(value),sampleRate:24000,index:0,firstChunkMs:80});
const complete=id=>({type:'complete',id,wav:new Uint8Array([82,73,70,70]).buffer,sampleRate:24000,samples:3840,duration:.16,generationMs:100,firstChunkMs:80,chunks:2});

test('startup prepare loads a single reusable model without audio activation or prerendered text',async()=>{
 const f=fixture(),first=f.speech.prepare(),again=f.speech.prepare();assert.equal(first,again);assert.equal(f.workers.length,1);assert.deepEqual(f.workers[0].messages,[{type:'init'}]);assert.equal(f.contexts.length,0);assert.equal(f.player.plays,0);
 f.workers[0].emit({type:'progress',progress:{status:'Downloading model',loaded:10e6,total:65e6}});assert.match(f.statuses.at(-1),/10.0 \/ 65.0 MB/);
 f.workers[0].emit({type:'ready',mode:'CPU/WASM',loadMs:12});await first;await f.speech.prepare();assert.equal(f.workers.length,1);assert.equal(f.speech.ready,true);assert.equal(f.timers.size,0);
});

test('cold key gesture activates audio immediately while latest reading waits for model readiness',async()=>{
 const f=fixture(),loading=f.speech.prepare(),old=f.speech.speak('Old country.'),latest=f.speech.speak('New country, −18.75 degrees.');
 assert.equal(f.contexts.length,1);assert.equal(f.contexts[0].resumeCalls,2);assert.equal(speakMessages(f.workers[0]).length,0);
 f.workers[0].emit({type:'ready',mode:'CPU/WASM',loadMs:1});await loading;assert.equal(await old,false);assert.equal(await latest,true);assert.equal(speakMessages(f.workers[0]).length,1);assert.equal(speakMessages(f.workers[0])[0].text,'New country, −18.75 degrees.');
 f.speech.stop();
});

test('first PCM plays before complete WAV; frames preserve order and only playing nodes duck map audio',async()=>{
 const f=fixture(),worker=await ready(f),text='Quetzaltenango, Zyxorville and −4.125 degrees Celsius.';
 assert.equal(await f.speech.speak(text),true);assert.equal(speakMessages(worker)[0].text,text);assert.equal(f.activity.includes(true),false);
 f.advance(90);worker.emit(chunk(f.speech.serial,.2));worker.emit(chunk(f.speech.serial,.4));await f.speech.chain;
 const c=f.contexts[0];assert.equal(c.nodes.length,2);assert.equal(f.player.src,'');assert.equal(f.urls.length,0);assert.equal(c.nodes[0].buffer.data[0],Math.fround(.2));assert.equal(c.nodes[1].buffer.data[0],Math.fround(.4));assert.ok(c.nodes[1].startTime>c.nodes[0].startTime);assert.equal(f.activity.at(-1),true);
 worker.emit(complete(f.speech.serial));await f.speech.chain;assert.equal(f.urls.length,1);assert.equal(f.player.plays,0,'completed WAV must not replay the stream automatically');assert.equal(f.activity.at(-1),true,'generation completion is not playback completion');
 c.nodes[0].end();assert.equal(f.activity.at(-1),true);c.nodes[1].end();assert.equal(f.activity.at(-1),false);assert.match(f.statuses.at(-1),/Phonon ready/);
});

test('interrupt stops scheduled nodes and ignores stale frames/WAV while preserving loaded model and audio context',async()=>{
 const f=fixture(),worker=await ready(f);await f.speech.speak('Old ocean.');const old=f.speech.serial;worker.emit(chunk(old));await f.speech.chain;
 const oldNode=f.contexts[0].nodes[0],staleEnded=oldNode.onended;
 await f.speech.speak('New ocean.');const latest=f.speech.serial;assert.ok(oldNode.stopped);assert.equal(f.activity.at(-1),false);assert.ok(worker.messages.some(m=>m.type==='cancel'&&m.id===latest));assert.equal(f.workers.length,1);assert.equal(worker.terminated,false);assert.equal(f.contexts.length,1);
 worker.emit(chunk(old));worker.emit(complete(old));await flush();assert.equal(f.contexts[0].nodes.length,1);assert.equal(f.urls.length,0);
 worker.emit(chunk(latest));await f.speech.chain;staleEnded();assert.equal(f.activity.at(-1),true);assert.equal(f.contexts[0].nodes.length,2);f.speech.stop();
});

test('speech gain and rate are applied once, independently from the native replay volume',async()=>{
 const f=fixture(),worker=await ready(f);f.speech.setVolume(.45);f.speech.rate=.85;await f.speech.speak('Independent gain.');worker.emit(chunk(f.speech.serial,.6));await f.speech.chain;
 const c=f.contexts[0],node=c.nodes[0];assert.equal(c.gains.length,1);assert.equal(c.gains[0].gain.value,.45);assert.equal(node.buffer.data[0],Math.fround(.6),'PCM is not pre-attenuated');assert.deepEqual(node.connections,[c.gains[0]]);assert.equal(node.playbackRate.value,.85);assert.equal(speakMessages(worker)[0].rate,.85);
 f.speech.setVolume(.7);assert.equal(c.gains[0].gain.value,.7);worker.emit(complete(f.speech.serial));await f.speech.chain;assert.equal(f.player.volume,.7);assert.equal(f.player.playbackRate,.85);assert.equal(f.player.plays,0);f.speech.stop();
});

test('mute and disabled speech cancel queued sound and reject new speech without new loading',async()=>{
 const f=fixture(),worker=await ready(f);await f.speech.speak('Muted before finish.');const old=f.speech.serial;worker.emit(chunk(old));await f.speech.chain;f.speech.setVolume(0);assert.ok(f.contexts[0].nodes[0].stopped);assert.equal(await f.speech.speak('No sound.'),false);assert.match(f.statuses.at(-1),/volume is zero/);worker.emit(complete(old));assert.equal(f.urls.length,0);
 f.speech.setVolume(2);assert.equal(f.speech.volume,1);f.speech.setEnabled(false);assert.equal(await f.speech.speak('Disabled.'),false);assert.match(f.statuses.at(-1),/shortcuts are off/);assert.equal(f.workers.length,1);assert.equal(f.activity.at(-1),false);
});

test('invalid input is rejected before audio activation or model loading',async()=>{
 const f=fixture();for(const text of ['', '  ',null,123,'a'.repeat(5001)])assert.equal(await f.speech.speak(text),false);assert.equal(f.workers.length,0);assert.equal(f.contexts.length,0);assert.match(f.statuses.at(-1),/5,000 characters/);
});

test('blocked streaming keeps completed WAV for native Play, with precise error and manual replay ducking',async()=>{
 const error=Object.assign(new Error('Autoplay not allowed'),{name:'NotAllowedError'}),f=fixture({resumeError:error}),worker=await ready(f);
 await f.speech.speak('An entirely new sentence.');await flush();worker.emit(chunk(f.speech.serial));worker.emit(complete(f.speech.serial));await f.speech.chain;
 assert.equal(f.contexts[0].nodes.length,0);assert.equal(f.player.src,'blob:phonon-1');assert.equal(f.player.plays,0);assert.match(f.statuses.at(-1),/NotAllowedError/);assert.match(f.statuses.at(-1),/Press Play/);assert.equal(f.activity.includes(true),false);
 await f.player.play();assert.equal(f.activity.at(-1),true);f.player.pause();assert.equal(f.activity.at(-1),false);await f.player.play();f.player.finish();assert.equal(f.activity.at(-1),false);f.speech.stop();assert.deepEqual(f.revoked,['blob:phonon-1']);
});

test('failed startup can retry; callbacks from old worker cannot change the new model state',async()=>{
 const f=fixture(),loading=f.speech.prepare(),first=f.workers[0],stale=first.onmessage,rejected=assert.rejects(loading,/download failed/);first.emit({type:'error',phase:'load',message:'Model download failed.'});await rejected;assert.ok(first.terminated);assert.equal(f.speech.ready,false);assert.equal(f.speech.loading,null);
 const retry=f.speech.prepare(),next=f.workers[1];stale({data:{type:'ready',mode:'stale'}});assert.equal(f.speech.ready,false);next.emit({type:'ready',mode:'CPU/WASM',loadMs:1});await retry;assert.equal(f.speech.ready,true);assert.equal(f.speech.worker,next);
});

test('worker creation and audio-device failures surface precise errors without blocking model synthesis',async()=>{
 const denied=fixture({workerError:Object.assign(new Error('Worker blocked'),{name:'SecurityError'})});await assert.rejects(denied.speech.prepare(),/SecurityError: Worker blocked/);assert.equal(denied.speech.ready,false);assert.equal(denied.speech.loading,null);assert.equal(denied.diagnostics.at(-1).state,'engine error');
 const f=fixture({contextError:Object.assign(new Error('No output device'),{name:'NotSupportedError'})}),worker=await ready(f);assert.equal(await f.speech.speak('Keep a generated replay.'),true);await flush();worker.emit(chunk(f.speech.serial));worker.emit(complete(f.speech.serial));await f.speech.chain;assert.equal(f.urls.length,1);assert.match(f.statuses.at(-1),/NotSupportedError: No output device/);assert.equal(f.activity.includes(true),false);
});

test('startup and stalled generation have distinct bounded timers; each frame refreshes the stall timer',async()=>{
 const f=fixture(),loading=f.speech.prepare(),rejected=assert.rejects(loading,/loading timed out/);assert.equal([...f.timers.values()][0].ms,300000);[...f.timers.values()][0].fn();await rejected;assert.equal(f.workers[0].terminated,true);
 const worker=await ready(f);await f.speech.speak('Wait for speech.');const before=[...f.timers.keys()][0];assert.equal(f.timers.get(before).ms,60000);worker.emit(chunk(f.speech.serial));await f.speech.chain;assert.equal(f.timers.has(before),false);assert.equal([...f.timers.values()][0].ms,60000);[...f.timers.values()][0].fn();assert.equal(worker.terminated,true);assert.equal(f.activity.at(-1),false);assert.match(f.statuses.at(-1),/stopped producing audio/);
});

test('stopping a cold reading prevents late initialization from speaking it',async()=>{
 const f=fixture(),speaking=f.speech.speak('No longer requested.'),worker=f.workers[0];f.speech.stop();worker.emit({type:'ready',mode:'CPU/WASM',loadMs:1});assert.equal(await speaking,false);assert.equal(speakMessages(worker).length,0);assert.equal(f.activity.includes(true),false);
});

test('a generation error invalidates frames waiting for audio activation',async()=>{
 const f=fixture({holdResume:true}),worker=await ready(f);await f.speech.speak('Failed reading.');const id=f.speech.serial;worker.emit(chunk(id));worker.emit({type:'error',phase:'generate',id,message:'Decoder failed.'});f.contexts[0].releaseResume();await flush();
 assert.equal(f.contexts[0].nodes.length,0,'failed utterance must not speak queued frames');assert.equal(f.activity.at(-1),false);assert.equal(f.speech.ready,true,'a generation failure need not reload the model');
});

test('disposal settles an in-flight startup load and ignores callbacks from its terminated worker',{timeout:1000},async()=>{
 const f=fixture(),loading=f.speech.prepare(),worker=f.workers[0],stale=worker.onmessage;
 const rejected=assert.rejects(loading,/disposed|stopped|closed/i);f.speech.dispose();await rejected;
 assert.equal(worker.terminated,true);assert.equal(f.speech.worker,null);assert.equal(f.speech.ready,false);assert.equal(f.speech.loading,null);assert.equal(f.timers.size,0);assert.equal(f.contexts.length,0);
 stale({data:{type:'ready',mode:'stale'}});stale({data:chunk(0)});assert.equal(f.speech.ready,false);assert.equal(f.urls.length,0);assert.equal(f.activity.at(-1),false);
});
