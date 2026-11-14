import test from 'node:test';
import assert from 'node:assert/strict';
import {Narrator} from '../src/speech.js';
import {currentDataText,spokenLocation} from '../src/announcements.js';
function rig(){
 const timers=new Map();let serial=0,cancels=0;const spoken=[],duck=[],fallback=[];
 const narrator=new Narrator({synthesis:{cancel(){cancels++;},speak:u=>spoken.push(u)},makeUtterance:text=>({text}),onSpeaking:v=>duck.push(v),onFallback:t=>fallback.push(t),setTimer:f=>{timers.set(++serial,f);return serial;},clearTimer:id=>timers.delete(id)});
 return {narrator,spoken,duck,fallback,get cancels(){return cancels;},flush(){const jobs=[...timers.values()];timers.clear();jobs.forEach(f=>f());}};
}
test('rapid completed time selections speak only the latest, without a backlog',()=>{
 const r=rig();r.narrator.say('old');r.narrator.say('latest');r.flush();assert.deepEqual(r.spoken.map(u=>u.text),['latest']);
});
test('speech off cancels active narration and restores ducking immediately',()=>{
 const r=rig();r.narrator.say('time');r.flush();r.spoken[0].onstart();assert.equal(r.duck.at(-1),true);
 r.narrator.setEnabled(false);assert.equal(r.duck.at(-1),false);assert.ok(r.cancels>=2);
 assert.equal(r.narrator.say('suppressed'),false);r.flush();assert.equal(r.spoken.length,1);
});
test('re-enabling speech affects subsequent changes only; explicit read bypasses auto-speech toggle',()=>{
 const r=rig();r.narrator.setEnabled(false);r.narrator.say('read',{explicit:true});r.flush();assert.equal(r.spoken.length,1);
 r.narrator.setEnabled(true);r.flush();assert.equal(r.spoken.length,1);
 r.narrator.say('future');r.flush();assert.equal(r.spoken.at(-1).text,'future');
});
test('stale end/error events cannot unduck or announce over a newer utterance',()=>{
 const r=rig();r.narrator.say('a');r.flush();const old=r.spoken[0];
 r.narrator.say('b');r.flush();r.spoken[1].onstart();old.onend();old.onerror();
 assert.equal(r.duck.at(-1),true);assert.deepEqual(r.fallback,[]);
 r.spoken[1].onend();assert.equal(r.duck.at(-1),false);
});
test('global cancellation invalidates pending speech and releases the data duck',()=>{
 const r=rig();r.narrator.say('pending');r.narrator.cancel();r.flush();assert.equal(r.spoken.length,0);assert.equal(r.duck.at(-1),false);
});
test('unsupported or failed browser speech returns accessible fallback information',()=>{
 assert.equal(new Narrator({synthesis:null}).say('text'),false);
 const r=rig();r.narrator.say('current data');r.flush();r.spoken[0].onstart();r.spoken[0].onerror();
 assert.deepEqual(r.fallback,['current data']);assert.equal(r.duck.at(-1),false);
});
test('spoken data contains actual UTC time, coordinates and image-derived value, including valid zero',()=>{
 const state={timestamp:'2026-10-29T10:00:00Z',location:{lon:15,lat:23},dataset:'svs-5147',variable:'Near-surface temperature-color position',sample:{value:0,density:1}};
 const text=currentDataText(state);assert.match(text,/29 October 2026 at 10:00 UTC/);assert.match(text,/23.00 degrees north/);assert.match(text,/15.00 degrees east/);assert.match(text,/0 out of 100/);assert.match(text,/not measured degrees Celsius/);
 assert.match(currentDataText({...state,sample:{value:null}}),/No data at this location and time/);
 assert.match(spokenLocation({lat:-12.5,lon:-45}),/12.50 degrees south.*45.00 degrees west/);
});
