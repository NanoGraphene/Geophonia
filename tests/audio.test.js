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
 constructor(){this.gain=new Param();this.frequency=new Param();this.stopped=false;}
 connect(){} disconnect(){} start(){} stop(){this.stopped=true;}
}
class Context {
 constructor(){this.currentTime=1;this.state='suspended';this.destination={};this.oscillators=[];}
 createGain(){return new Node();}
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
test('no-sample cue plays once per entry, is cancelled on a valid sample, and re-arms',async()=>{
 const context=new Context();const engine=new AudioEngine(()=>context);await engine.start();
 engine.update(missing,prefs,true);assert.equal(context.oscillators.length,3);
 engine.update(missing,prefs,true);assert.equal(context.oscillators.length,3);
 engine.update(valid,prefs,true);assert.equal(engine.pendingTones.size,0);
 engine.update(missing,prefs,true);assert.equal(context.oscillators.length,5);
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
 assert.deepEqual(context.oscillators.slice(1).map(o=>o.frequency.value),[200,Math.sqrt(200000),1000]);
 const old=[...engine.pendingTones];engine.legend('missing',prefs);
 assert.ok(old.every(e=>e.oscillator.stopped));assert.equal(engine.pendingTones.size,2);
 engine.stop();assert.equal(engine.pendingTones.size,0);
});
test('outside map fades continuous sound and a browser interruption stops audio',async()=>{
 const context=new Context();const engine=new AudioEngine(()=>context);await engine.start();
 engine.update(valid,prefs,true);engine.update(valid,prefs,false);assert.equal(engine.level.gain.value,0);
 let interrupted=false;engine.onInterrupted=()=>{interrupted=true;};context.state='suspended';context.onstatechange();
 assert.equal(engine.enabled,false);assert.equal(engine.master.gain.value,0);assert.equal(interrupted,true);
});
