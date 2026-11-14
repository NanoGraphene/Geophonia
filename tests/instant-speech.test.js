import test from 'node:test';
import assert from 'node:assert/strict';
import {InstantSpeech,rankedVoices} from '../src/instant-speech.js';
const voice=(name,lang='en-GB',extra={})=>({name,lang,voiceURI:name,localService:true,...extra});
function fixture(voices=[]) {
  const spoken=[],active=[],status=[];let listener,cancels=0;
  const synth={getVoices:()=>voices,addEventListener:(event,callback)=>{listener=callback;},speak:u=>spoken.push(u),cancel:()=>cancels++};
  const speech=new InstantSpeech({synth,createUtterance:text=>({text}),onStatus:m=>status.push(m),onActive:a=>active.push(a)});
  return {speech,spoken,active,status,synth,refresh:()=>listener(),cancels:()=>cancels};
}
test('speech is ready without loading a model and prefers natural voices over Daniel',()=>{
  const f=fixture([voice('Daniel'),voice('Microsoft Sonia Online (Natural)'),voice('Google US English','en-US')]);
  assert.equal(f.spoken.length,0);assert.equal(f.speech.voiceURI,'Microsoft Sonia Online (Natural)');
  assert.equal(f.speech.speak('Germany.'),true);assert.equal(f.spoken[0].text,'Germany.');assert.equal(f.spoken[0].voice.name,'Microsoft Sonia Online (Natural)');
});
test('late voice discovery upgrades the automatic default and preserves explicit choice',()=>{
  const list=[];const f=fixture(list);f.speech.speak('Date.');assert.equal(f.spoken[0].voice,undefined);
  list.push(voice('Daniel'));f.refresh();assert.equal(f.speech.voiceURI,'Daniel');
  list.push(voice('Samantha Enhanced','en-US'));f.refresh();assert.equal(f.speech.voiceURI,'Samantha Enhanced');
  f.speech.selectVoice('Daniel');list.push(voice('Serena Natural'));f.refresh();assert.equal(f.speech.voiceURI,'Daniel');
});
test('new readings replace previous speech; cancelled callbacks cannot restore ducking or status',()=>{
  const f=fixture();f.speech.speak('old');const old=f.spoken[0];f.speech.speak('new');const current=f.spoken[1];
  assert.equal(f.cancels(),1);current.onstart();assert.equal(f.active.at(-1),true);old.onend();assert.equal(f.active.at(-1),true);
  f.speech.stop();assert.equal(f.active.at(-1),false);const last=f.status.at(-1);current.onstart();current.onend();assert.equal(f.active.at(-1),false);assert.equal(f.status.at(-1),last);
});
test('disabling speech, zero volume and unavailable APIs leave text usable and cannot speak',()=>{
  const f=fixture();f.speech.setEnabled(false);assert.equal(f.speech.speak('off'),false);assert.equal(f.spoken.length,0);
  f.speech.setEnabled(true);f.speech.speak('on');f.speech.setVolume(0);assert.equal(f.cancels(),1);assert.equal(f.speech.speak('muted'),false);
  const absent=new InstantSpeech({synth:null});assert.equal(absent.speak('no API'),false);
});
test('playback error restores map gain and speaking rate/volume are applied',()=>{
  const f=fixture();f.speech.rate=.85;f.speech.setVolume(.4);f.speech.speak('test');const u=f.spoken[0];assert.equal(u.rate,.85);assert.equal(u.volume,.4);
  u.onstart();u.onerror({error:'network'});assert.equal(f.active.at(-1),false);assert.match(f.status.at(-1),/Select another voice/);
});
test('English voices win over non-English premium voices; fallback works when none exist',()=>{
  assert.equal(rankedVoices([voice('Premium German','de-DE'),voice('Daniel')])[0].name,'Daniel');
  assert.equal(rankedVoices([voice('Français','fr-FR')])[0].name,'Français');
});
