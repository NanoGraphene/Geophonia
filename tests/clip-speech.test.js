import test from 'node:test';
import assert from 'node:assert/strict';
import{ClipSpeech}from'../src/clip-speech.js';
function fixture(overrides={}) {
  const events=[],states=[],activity=[],help=[],sources=[];let fetches=0,decodes=0,clock=0;
  const tasks=new Map();
  const context={state:'suspended',currentTime:0,destination:{},resume(){events.push('resume');this.state='running';return Promise.resolve();},createGain:()=>({gain:{value:0,setValueAtTime(v){this.value=v;}},connect(){}}),decodeAudioData:async()=>{decodes++;return {duration:.5};},createBufferSource(){const source={playbackRate:{value:1},connect(){},disconnect(){},start(t){events.push('play');this.when=t;},stop(){this.stopped=true;}};sources.push(source);return source;}};
  const bank={clips:{a:{url:'a.ogg'},b:{url:'b.ogg'}}};
  const speech=new ClipSpeech({contextFactory:()=>context,loadBank:async()=>bank,fetcher:async()=>{events.push('fetch');fetches++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};},onStatus:s=>states.push(s),onActive:a=>activity.push(a),onBlocked:a=>help.push(a),schedule:fn=>{const id=++clock;tasks.set(id,fn);return id;},unschedule:id=>tasks.delete(id),...overrides});
  return {speech,context,events,states,activity,help,sources,tasks,fetches:()=>fetches,decodes:()=>decodes};
}
test('clip speech works without system TTS and resumes audio synchronously before any network wait',async()=>{
  const f=fixture();const result=f.speech.speak(['a','b']);assert.deepEqual(f.events,['resume']);
  assert.equal(await result,true);assert.equal(f.sources.length,2);assert.ok(f.sources[1].when>f.sources[0].when);assert.equal(f.context.state,'running');
  f.sources[0].onended();assert.equal(f.activity.at(-1),true);f.sources[1].onended();assert.equal(f.activity.at(-1),false);
});
test('prefetch is silent, cache reuse avoids refetch/redecode, and map mute is independent',async()=>{
  const f=fixture();await f.speech.warm(['a']);assert.equal(f.context.state,'suspended');assert.equal(f.sources.length,0);
  await f.speech.speak(['a']);await f.speech.speak(['a']);assert.equal(f.fetches(),1);assert.equal(f.decodes(),1);assert.equal(f.speech.gain.gain.value,1);
  f.speech.setVolume(0);assert.equal(f.sources.at(-1).stopped,true);assert.equal(await f.speech.speak(['a']),false);
});
test('cancelled async voice loads never play late and a newer key replaces prior speech',async()=>{
  let complete;const f=fixture({loadBank:()=>new Promise(resolve=>{complete=resolve;})});
  const pending=f.speech.speak(['a']);await Promise.resolve();f.speech.stop();complete({clips:{a:{url:'a.ogg'}}});assert.equal(await pending,false);assert.equal(f.sources.length,0);
  await f.speech.speak(['a']);const old=f.sources[0];await f.speech.speak(['a']);assert.equal(old.stopped,true);
});
test('missing/failed voice audio fails visibly, clears ducking, and can be retried',async()=>{
  const f=fixture();assert.equal(await f.speech.speak(['missing']),false);assert.equal(f.help.at(-1),true);assert.equal(f.activity.at(-1),false);
  assert.equal(await f.speech.speak(['a']),true);assert.equal(f.help.at(-1),false);
});
test('disabled speech does not fetch, and stalled browser audio activation has a bounded visible failure',async()=>{
  const f=fixture();f.speech.setEnabled(false);assert.equal(await f.speech.speak(['a']),false);assert.equal(f.fetches(),0);
  f.speech.setEnabled(true);f.context.resume=()=>new Promise(()=>{});
  const pending=f.speech.speak(['a']);for(const task of f.tasks.values())task();assert.equal(await pending,false);assert.equal(f.help.at(-1),true);
});
