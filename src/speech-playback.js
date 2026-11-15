// Schedule PCM frames as they arrive. This never waits for the complete WAV.
export class SpeechPlayback {
 constructor({createContext=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)({latencyHint:'interactive'}),onFirst=()=>{},onGap=()=>{},onActive=()=>{},onDone=()=>{},unlockTimeoutMs=2000}={}){Object.assign(this,{createContext,onFirst,onGap,onActive,onDone,unlockTimeoutMs});this.context=null;this.nodes=new Set();this.serial=0;this.next=0;this.frames=0;this.gaps=0;this.complete=false;this.waiters=[];this.volume=1;this.gain=null;this.doneReported=false;}
 async unlock(){this.context??=this.createContext();if(!this.gain){this.gain=this.context.createGain();this.gain.gain.value=this.volume;this.gain.connect(this.context.destination);}let timer;try{await Promise.race([this.context.resume(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Audio activation timed out. Press a reading key or Speak this text again or use the completed WAV player.')),this.unlockTimeoutMs);})]);if(this.context.state!=='running')throw new Error(`Audio context is ${this.context.state}. Press a reading key or Speak this text again.`);}finally{clearTimeout(timer);}}
 enqueue(samples,rate,playbackRate=1){
  const c=this.context;if(!c||c.state!=='running')throw new Error('Audio playback is blocked. Press a reading key or Speak this text again, or use the completed WAV player.');
  if(!samples.length)return;const buffer=c.createBuffer(1,samples.length,rate);buffer.getChannelData(0).set(samples);const node=c.createBufferSource();node.buffer=buffer;node.playbackRate.value=playbackRate;node.connect(this.gain);
  const now=c.currentTime,when=Math.max(now+.01,this.next);if(this.frames&&now>this.next+.005){this.gaps++;this.onGap(this.gaps);}
  if(!this.frames)this.onFirst({delayMs:(when-now)*1000+(c.baseLatency||0)*1000+(c.outputLatency||0)*1000});
  this.frames++;this.next=when+samples.length/rate/playbackRate;if(!this.nodes.size)this.onActive(true);this.nodes.add(node);const serial=this.serial;
  node.onended=()=>{node.disconnect();this.nodes.delete(node);if(serial===this.serial){if(!this.nodes.size)this.onActive(false);this.settle();}};node.start(when);
 }
 finish(){this.complete=true;this.settle();return this.whenDone();}
 settle(){if(this.complete&&!this.nodes.size){if(!this.doneReported){this.doneReported=true;this.onDone();}for(const resolve of this.waiters.splice(0))resolve();}}
 whenDone(){return this.complete&&!this.nodes.size?Promise.resolve():new Promise(resolve=>this.waiters.push(resolve));}
 setVolume(value){this.volume=value;if(this.gain)this.gain.gain.value=value;}
 stop(){this.serial++;this.next=0;this.frames=0;this.gaps=0;this.doneReported=false;this.onActive(false);for(const node of this.nodes){node.onended=null;try{node.stop();node.disconnect();}catch{}}this.nodes.clear();this.complete=false;for(const resolve of this.waiters.splice(0))resolve();}
 async dispose(){this.stop();if(this.context&&this.context.state!=='closed')await this.context.close();}
}
