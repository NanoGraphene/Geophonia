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
 constructor(){this.gain=new Param();this.frequency=new Param();this.stopped=false;this.Q=new Param();}
 setPeriodicWave(wave){this.wave=wave;}
 connect(){} disconnect(){} start(){} stop(){this.stopped=true;}
}
class Context {
 constructor(){this.currentTime=1;this.state='suspended';this.destination={};this.oscillators=[];}
 createGain(){return new Node();}
 createBiquadFilter(){return new Node();}
 createPeriodicWave(real,imag){return {real,imag};}
 createOscillator(){const n=new Node();this.oscillators.push(n);return n;}
 async resume(){this.state='running';}
 async suspend(){this.state='suspended';}
}
const prefs={minHz:160,maxHz:800,volume:.25};
const valid={value:.5,density:1,validity:'valid'};
const missing={value:null,density:0,validity:'no-visual-sample'};
test('audio is user-started, smooths updates and synchronously closes master on stop',async()=>{
 const context=new Context();const engine=new AudioEngine(()=>context);
 engine.update(valid,prefs,true);assert.equal(engine.context,null);
 await engine.start();engine.update(valid,prefs,true);
 assert.ok(engine.level.gain.events.some(e=>e[0]==='smooth'&&e[1]===.03));
 assert.ok(engine.oscillator.frequency.events.some(e=>e[0]==='smooth'));
 engine.stop();assert.equal(engine.master.gain.value,0);assert.equal(engine.enabled,false);
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
 engine.legend('pitch',{...prefs,minHz:200,maxHz:1000});
 assert.deepEqual([...engine.pendingTones].map(o=>o.oscillator.frequency.value),[200,Math.sqrt(200000),1000]);
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
 assert.equal(context.oscillators.length,1);assert.equal(engine.pendingTones.size,0);engine.stop();
});
test('boundary and crossing cues replace stale sounds with bounded latest crossings',async()=>{
 const engine=new AudioEngine(()=>new Context());await engine.start();
 engine.navigationCue({boundary:'left'},prefs);const old=[...engine.pendingTones];
 engine.navigationCue({boundary:'top-right',crossings:[{to:'land'},{to:'water'},{to:'land'},{to:'water'}]},prefs);
 assert.ok(old.every(e=>e.oscillator.stopped));
 assert.equal([...engine.pendingTones].filter(t=>t.group==='navigation').length,5);
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
 engine.update(valid,prefs,true,'water');assert.equal([...engine.pendingTones].filter(e=>e.group==='navigation').length,3);
 engine.stop();
});

test('volume changes cancel already scheduled cue notes, including setting zero outside the map',async()=>{
 const engine=new AudioEngine(()=>new Context());await engine.start();engine.update(valid,prefs,true,'water');
 engine.navigationCue({boundary:'top-right',crossings:[{to:'land'}]},prefs);assert.ok(engine.pendingTones.size>0);
 engine.update(valid,{...prefs,volume:0},false,'water');assert.equal(engine.pendingTones.size,0);
 assert.equal(engine.level.gain.value,0);engine.stop();
});

test('land and water crossing signatures are distinct and shorter than 100 ms',async()=>{
 const engine=new AudioEngine(()=>new Context());await engine.start();
 engine.navigationCue({crossings:[{to:'land'},{to:'water'}]},prefs);
 const notes=[...engine.pendingTones];assert.equal(notes.length,2);
 assert.notDeepEqual([...notes[0].oscillator.wave.imag],[...notes[1].oscillator.wave.imag]);
 const ends=notes.map(n=>n.gain.gain.events.filter(e=>e[0]==='ramp').at(-1)[2]);
 assert.ok(Math.abs(ends[0]-1-.045)<1e-9);assert.ok(Math.abs(ends[1]-1-.1-.085)<1e-9);
 assert.ok(notes[0].oscillator.frequency.value<notes[1].oscillator.frequency.value);engine.stop();
});
test('boundary mallets use a harmonic wave and softened envelopes',async()=>{
 const engine=new AudioEngine(()=>new Context());await engine.start();engine.navigationCue({boundary:'left'},prefs);
 const note=[...engine.pendingTones][0];assert.ok(note.oscillator.wave.imag[3]>0);
 assert.equal(note.voice.filter.type,'lowpass');
 assert.ok(note.gain.gain.events.some(e=>e[0]==='ramp'&&e[2]>=1.04));engine.stop();
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
