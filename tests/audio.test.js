import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../src/audio.js';
class Param {
 constructor(){this.value=0;this.events=[];}
 cancelScheduledValues(t){this.events.push(['cancel',t]);}
 setValueAtTime(v,t){this.value=v;this.events.push(['set',v,t]);}
 setTargetAtTime(v,t,tau){this.value=v;this.events.push(['smooth',v,t,tau]);}
 linearRampToValueAtTime(v,t){this.events.push(['ramp',v,t]);}
}
class Node {
 constructor(){this.gain=new Param();this.frequency=new Param();this.detune=new Param();this.positionX=new Param();this.positionY=new Param();this.positionZ=new Param();this.stopped=false;this.Q=new Param();}
 setPeriodicWave(wave){this.wave=wave;}
 connect(){} disconnect(){} start(time){this.started=true;this.startAt=time;} stop(time){this.stopped=true;this.stopAt=time;}
}
class Context {
 constructor(){this.currentTime=1;this.state='suspended';this.destination={};this.listener={setOrientation(){}};this.oscillators=[];}
 createGain(){return new Node();}
 createBiquadFilter(){return new Node();}
 createPanner(){const node=new Node();node.panningModel='HRTF';return node;}
 createPeriodicWave(real,imag){return {real,imag};}
 createOscillator(){const n=new Node();this.oscillators.push(n);return n;}
 async resume(){this.state='running';}
 async suspend(){this.state='suspended';}
}
const prefs={minHz:1000,maxHz:8000,volume:.25};
const valid={value:.5,density:1,validity:'valid'};
const missing={value:null,density:0,validity:'no-visual-sample'};
test('audio is user-started, smooths updates and synchronously closes master on stop',async()=>{
 const context=new Context();const engine=new AudioEngine(()=>context);
 engine.update(valid,prefs,true);assert.equal(engine.context,null);
 await engine.start();engine.update(valid,prefs,true);
 assert.equal(context.oscillators.length,4);
 assert.ok(engine.level.gain.events.some(e=>e[0]==='smooth'&&e[1]===.03));
 assert.ok(engine.oscillator.frequency.events.some(e=>e[0]==='smooth'));
 engine.stop();assert.equal(engine.master.gain.value,0);assert.equal(engine.enabled,false);
});
test('all harmonic voices follow the same data pitch instead of leaving fixed drones',async()=>{
 const context=new Context(),engine=new AudioEngine(()=>context);await engine.start();
 engine.update({...valid,value:0},{...prefs,voiceProfile:'temperature'},true);
 assert.deepEqual(engine.dataVoice.oscillators.map(node=>node.frequency.value),[1000,2000,3000,1000]);
 engine.update({...valid,value:.5},{...prefs,voiceProfile:'temperature'},true);
 const f=Math.sqrt(1000*8000);
 engine.dataVoice.oscillators.forEach((node,i)=>assert.ok(Math.abs(node.frequency.value-f*[1,2,3,1][i])<1e-8));
 const wave=engine.oscillator.wave;
 engine.update({...valid,value:.5},{...prefs,voiceProfile:'ozone'},true);
 assert.equal(context.oscillators.length,4,'changing dataset reuses the bounded voice bank');
 assert.notDeepEqual(engine.oscillator.wave.imag,wave.imag,'dataset identity changes harmonics');
 assert.equal(engine.dataVoice.profile,'ozone');assert.ok(Math.abs(engine.oscillator.frequency.value-f)<1e-8,'timbre cannot change the value pitch');engine.stop();
});
test('upper harmonic voices are limited at the audio-device Nyquist boundary',async()=>{
 const context=new Context();context.sampleRate=44100;
 const engine=new AudioEngine(()=>context);await engine.start();engine.update({...valid,value:1},prefs,true);
 assert.equal(engine.oscillator.frequency.value,8000);
 assert.ok(engine.dataVoice.oscillators.every(node=>node.frequency.value<44100/2));
 assert.ok(engine.dataVoice.filter.frequency.value<44100/2);engine.stop();
});
test('value legend uses the selected data timbre and starts and stops every voice',async()=>{
 const engine=new AudioEngine(()=>new Context());await engine.start();engine.legend('pitch',{...prefs,voiceProfile:'dust'});
 assert.equal(engine.pendingTones.size,3);
 for(const entry of engine.pendingTones){assert.equal(entry.voice.profile,'dust');assert.equal(entry.voice.oscillators.length,4);assert.ok(entry.voice.oscillators.every(node=>node.started&&node.stopped&&node.frequency.value<24000));}
 engine.stop();assert.equal(engine.pendingTones.size,0);
});
test('cursor position moves the current voice through HRTF space',async()=>{
 const context=new Context();const engine=new AudioEngine(()=>context);await engine.start();
 engine.update(valid,prefs,true,'unknown',{x:0,y:0});
 const panner=engine.dataVoice.panner;
 assert.equal(panner.panningModel,'HRTF');
 assert.ok(panner.positionX.events.some(event=>event[0]==='smooth'&&event[1]===-2.5));
 assert.ok(panner.positionY.events.some(event=>event[0]==='smooth'&&event[1]===1.5));
 assert.ok(panner.positionZ.events.some(event=>event[0]==='smooth'&&event[1]===-1));
 engine.stop();
});
test('missing samples do not trigger automatic notifications',async()=>{
 const context=new Context();const engine=new AudioEngine(()=>context);await engine.start();
 engine.update(missing,prefs,true);assert.equal(engine.pendingTones.size,0);
 engine.update(missing,prefs,true);assert.equal(engine.pendingTones.size,0);
 engine.update(valid,prefs,true);assert.equal(engine.pendingTones.size,0);
 engine.update(missing,prefs,true);assert.equal(engine.pendingTones.size,0);
 engine.stop();assert.equal(engine.pendingTones.size,0);
});
test('silence invalidates an in-flight resume and cannot be undone by late completion',async()=>{
 const context=new Context();let complete;
 context.resume=()=>new Promise(resolve=>{complete=resolve;});
 const engine=new AudioEngine(()=>context);const started=engine.start();engine.stop();
 complete();assert.equal(await started,false);assert.equal(engine.enabled,false);assert.equal(engine.master.gain.value,0);
});
test('a new legend cancels old examples and uses the configured pitch range',async()=>{
 const context=new Context();const engine=new AudioEngine(()=>context);await engine.start();
 engine.legend('pitch',{...prefs,minHz:1000,maxHz:8000});
 assert.deepEqual([...engine.pendingTones].map(o=>o.oscillator.frequency.value),[1000,Math.sqrt(8000000),8000]);
 const old=[...engine.pendingTones];engine.legend('missing',prefs);
 assert.ok(old.every(e=>e.oscillator.stopped));assert.equal(engine.pendingTones.size,1);
 engine.stop();assert.equal(engine.pendingTones.size,0);
});
test('outside map fades continuous sound and a browser interruption stops audio',async()=>{
 const context=new Context();const engine=new AudioEngine(()=>context);await engine.start();
 engine.update(valid,prefs,true);engine.update(valid,prefs,false);assert.equal(engine.level.gain.value,0);
 let interrupted=false;engine.onInterrupted=()=>{interrupted=true;};context.state='suspended';context.onstatechange();
 assert.equal(engine.enabled,false);assert.equal(engine.master.gain.value,0);assert.equal(interrupted,true);
});

test('geographic surface never changes the continuous data voice',async()=>{
 const context=new Context();const engine=new AudioEngine(()=>context);await engine.start();
 engine.update(valid,prefs,true,'water');const cutoff=engine.dataVoice.filter.frequency.value,voices=context.oscillators.length;
 engine.update(valid,prefs,true,'land');assert.equal(engine.dataVoice.filter.frequency.value,cutoff);
 assert.equal(context.oscillators.length,voices);assert.equal(engine.pendingTones.size,0);engine.stop();
});
test('missing data has no background guide on either surface',async()=>{
 const context=new Context();const engine=new AudioEngine(()=>context);await engine.start();
 engine.update(missing,prefs,true,'land');assert.equal(engine.level.gain.value,0);
 engine.update(missing,prefs,true,'water');assert.equal(engine.level.gain.value,0);
 assert.equal(context.oscillators.length,4);assert.equal(engine.pendingTones.size,0);engine.stop();
});
test('boundary and crossing cues replace stale sounds with bounded latest crossings',async()=>{
 const engine=new AudioEngine(()=>new Context());await engine.start();
 engine.navigationCue({boundary:'left'},prefs);const old=[...engine.pendingTones];
 engine.navigationCue({boundary:'top-right',crossings:[{to:'land'},{to:'water'},{to:'land'},{to:'water'}]},prefs);
 assert.ok(old.every(e=>e.oscillator.stopped));
 assert.equal([...engine.pendingTones].filter(t=>t.group==='navigation').length,1);
 assert.equal([...engine.pendingTones].filter(t=>t.group==='coast').length,2);
 engine.stop();assert.equal(engine.pendingTones.size,0);assert.equal(engine.master.gain.value,0);
});
test('muted and disabled cue preferences schedule no navigation sound',async()=>{
 const engine=new AudioEngine(()=>new Context());
 engine.navigationCue({boundary:'top',crossings:[{to:'land'}]},prefs);assert.equal(engine.context,null);
 await engine.start();engine.navigationCue({boundary:'top',crossings:[{to:'land'}]},{...prefs,coastCues:false,boundaryCues:false});assert.equal(engine.pendingTones.size,0);
 engine.navigationCue({boundary:'left'},{...prefs,volume:0});
 assert.ok([...engine.pendingTones].every(e=>e.gain.gain.events.filter(v=>v[0]==='ramp').every(v=>v[1]===0)));
 engine.stop();
});
test('missing-sample cancellation never cancels a valid navigation cue',async()=>{
 const engine=new AudioEngine(()=>new Context());await engine.start();engine.update(missing,prefs,true,'land');
 engine.navigationCue({boundary:'right'},prefs);assert.equal([...engine.pendingTones].filter(e=>e.group==='missing').length,0);
 engine.update(valid,prefs,true,'water');assert.equal([...engine.pendingTones].filter(e=>e.group==='navigation').length,1);
 engine.stop();
});

test('volume changes cancel already scheduled cue notes, including setting zero outside the map',async()=>{
 const engine=new AudioEngine(()=>new Context());await engine.start();engine.update(valid,prefs,true,'water');
 engine.navigationCue({boundary:'top-right',crossings:[{to:'land'}]},prefs);assert.ok(engine.pendingTones.size>0);
 engine.update(valid,{...prefs,volume:0},false,'water');assert.equal(engine.pendingTones.size,0);
 assert.equal(engine.level.gain.value,0);engine.stop();
});

test('land and water crossing signatures are distinct and remain short',async()=>{
 const engine=new AudioEngine(()=>new Context());await engine.start();
 engine.navigationCue({crossings:[{to:'land'},{to:'water'}]},prefs);
 const notes=[...engine.pendingTones];assert.equal(notes.length,2);
 assert.notDeepEqual([...notes[0].oscillator.wave.imag],[...notes[1].oscillator.wave.imag]);
 const ends=notes.map(n=>n.gain.gain.events.filter(e=>e[0]==='ramp').at(-1)[2]);
 assert.ok(Math.abs(ends[0]-1-.045)<1e-9);assert.ok(Math.abs(ends[1]-1-.1-.1)<1e-9);
 assert.ok(notes[1].oscillator.frequency.value<notes[0].oscillator.frequency.value);engine.stop();
});
test('boundary mallets use a harmonic wave and softened envelopes',async()=>{
 const engine=new AudioEngine(()=>new Context());await engine.start();engine.navigationCue({boundary:'left'},prefs);
 const note=[...engine.pendingTones][0];assert.ok(note.oscillator.wave.imag[3]>0);
 assert.equal(note.voice.filter.type,'lowpass');
 assert.ok(note.gain.gain.events.some(e=>e[0]==='ramp'&&e[2]>=1.04));engine.stop();
});
test('all map-edge cues use one drum profile with boundary spatial placement',async()=>{
 const engine=new AudioEngine(()=>new Context());await engine.start();engine.navigationCue({boundary:'left'},prefs);
 const note=[...engine.pendingTones][0];
 assert.ok(note.voice.panner);
 assert.ok(note.voice.panner.positionX.events.some(event=>event[0]==='set'&&event[1]===-2.5));
 assert.ok(note.voice.panner.positionY.events.some(event=>event[0]==='set'&&event[1]===0));
 assert.ok(note.voice.panner.positionZ.events.some(event=>event[0]==='set'&&event[1]===-1.5));
 assert.ok(Math.abs(note.voice.oscillator.wave.imag[2]-.8)<1e-6);engine.stop();
});

test('crossing legend auditions a single short impact and silence cancels it',async()=>{
 const engine=new AudioEngine(()=>new Context());await engine.start();
 engine.legend('coast-land',prefs);assert.equal(engine.pendingTones.size,1);
 engine.legend('coast-water',prefs);assert.equal(engine.pendingTones.size,1);
 engine.stop();assert.equal(engine.pendingTones.size,0);assert.equal(engine.master.gain.value,0);
});

test('narration ducks the data bus, including before start, and cannot reopen a muted master',async()=>{
 const engine=new AudioEngine(()=>new Context());engine.setNarrationActive(true);await engine.start();
 assert.equal(engine.narrationGain.gain.value,.2);engine.setNarrationActive(false);assert.equal(engine.narrationGain.gain.value,1);
 engine.stop();engine.setNarrationActive(true);engine.setNarrationActive(false);assert.equal(engine.master.gain.value,0);assert.equal(engine.enabled,false);
});
