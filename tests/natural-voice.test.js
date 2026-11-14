import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {NaturalVoice} from '../src/natural-voice.js';
import {describeCurrent,locationText} from '../src/narration-text.js';
function fixture(overrides={}){
 const worker={messages:[],postMessage(m){this.messages.push(m);},terminate(){this.terminated=true;}};
 const player={play(){return Promise.resolve();},pause(){this.paused=true;},removeAttribute(){},load(){}};
 const states=[],activity=[],revoked=[];let browserCalls=0;
 const voice=new NaturalVoice({createWorker:()=>worker,createPlayer:()=>player,createURL:()=> 'blob:test',revokeURL:u=>revoked.push(u),onState:(...s)=>states.push(s),onActive:a=>activity.push(a),browser:{cancel(){},speak(){browserCalls++;}},...overrides});
 return {voice,worker,player,states,activity,revoked,browserCalls:()=>browserCalls};
}
async function ready(f){const promise=f.voice.load('https://app.test/runtime/');f.worker.onmessage({data:{type:'ready'}});await promise;}
test('neural loading is explicit, shared and retryable after download failure',async()=>{
 const f=fixture();assert.equal(f.worker.messages.length,0);
 const one=f.voice.load('/runtime/'),two=f.voice.load('/runtime/');
 assert.equal(f.worker.messages.filter(m=>m.type==='init').length,1);
 f.worker.onmessage({data:{type:'error',phase:'load',message:'offline'}});
 await assert.rejects(one,/offline/);await assert.rejects(two,/offline/);
 assert.equal(f.voice.loaded,false);assert.equal(f.worker.terminated,true);
 await ready(f);assert.equal(f.voice.loaded,true);
});
test('stopped and replaced readings cannot play late generated speech',async()=>{
 const f=fixture();await ready(f);f.voice.read('old');const old=f.voice.serial;
 f.voice.read('new');const current=f.voice.serial;
 f.voice.receive({type:'audio',id:old,wav:new ArrayBuffer(10)});assert.equal(f.voice.player,null);
 f.voice.receive({type:'audio',id:current,wav:new ArrayBuffer(10)});f.player.onplaying();assert.equal(f.activity.at(-1),true);
 f.voice.stop();assert.equal(f.player.paused,true);assert.equal(f.activity.at(-1),false);assert.deepEqual(f.revoked,['blob:test']);
 f.voice.receive({type:'audio',id:current,wav:new ArrayBuffer(10)});assert.equal(f.voice.player,null);
});
test('browser speech is used only when explicitly selected and respects volume zero',async()=>{
 let spoken;const f=fixture({browser:{cancel(){},speak:u=>{spoken=u;}},createUtterance:text=>({text})});
 assert.equal(f.voice.read('not loaded'),false);assert.equal(spoken,undefined);
 await ready(f);f.voice.read('neural');assert.equal(spoken,undefined);
 f.voice.setVolume(0);assert.equal(f.voice.read('fallback',{engine:'browser'}),true);assert.equal(spoken.text,'fallback');assert.equal(spoken.volume,0);
});
test('playback failures clear ducking and remain retryable',async()=>{
 const f=fixture();await ready(f);f.player.play=()=>Promise.reject(new Error('blocked'));
 f.voice.read('hello');f.voice.receive({type:'audio',id:f.voice.serial,wav:new ArrayBuffer(8)});await Promise.resolve();
 assert.equal(f.voice.player,null);assert.equal(f.activity.at(-1),false);assert.equal(f.states.at(-1)[0],'error');
 assert.equal(f.voice.read('retry'),true);
});
test('narration distinguishes zero from missing and says image estimates',()=>{
 const state={dataset:'svs-5147',timestamp:'2026-10-29T09:00:00Z',location:{lat:-2,lon:15},sample:{value:0,density:1}};
 assert.match(describeCurrent(state),/color is 0 out of one hundred/);assert.match(describeCurrent(state),/not measured temperatures/);
 assert.match(describeCurrent({...state,sample:{value:null}}),/No interpretable visual sample/);
 assert.match(describeCurrent({sample:null}),/not ready/);assert.equal(locationText(state.location),'2.00 degrees south, 15.00 degrees east');
});
test('worker runs only the newest pending reading and suppresses cancelled results',async()=>{
 const messages=[],calls=[];let complete,config;
 const model={generate(text){calls.push(text);return new Promise(resolve=>{complete=()=>resolve({wavData:()=>new Uint8Array([1,2])});});}};
 const context={importScripts(){},postMessage:m=>messages.push(m),KittenTTSWeb:{KittenTTS:{create:async c=>{config=c;return model;}}}};
 runInNewContext(await readFile('public/neural/worker.js','utf8'),context);
 context.onmessage({data:{type:'init',runtime:'/runtime/'}});await new Promise(setImmediate);
 assert.equal(config.analytics,false);assert.equal(config.ortNumThreads,1);assert.match(config.modelBaseURL,/84781d74/);
 context.onmessage({data:{type:'generate',id:1,text:'first'}});
 context.onmessage({data:{type:'generate',id:2,text:'second'}});
 context.onmessage({data:{type:'generate',id:3,text:'third'}});
 complete();await new Promise(setImmediate);assert.deepEqual(calls,['first','third']);assert.equal(messages.filter(m=>m.type==='audio').length,0);
 context.onmessage({data:{type:'cancel',id:4}});complete();await new Promise(setImmediate);assert.equal(messages.filter(m=>m.type==='audio').length,0);
});
