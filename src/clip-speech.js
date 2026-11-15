// Pre-rendered speech: only the small clips in a requested reading are fetched.
// No speech service, model weights, inference runtime or system voices are needed.
export class ClipSpeech {
  constructor({loadBank=()=>fetch('./speech/bank.json').then(r=>{if(!r.ok)throw new Error('Voice index could not load.');return r.json();}),fetcher=fetch,contextFactory=()=>{const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)throw new Error('Web Audio is unavailable.');return new Context();},onStatus=()=>{},onActive=()=>{},onBlocked=()=>{},schedule=(fn,ms)=>setTimeout(fn,ms),unschedule=id=>clearTimeout(id),resumeTimeout=2000}={}) {
    Object.assign(this,{fetcher,contextFactory,onStatus,onActive,onBlocked,schedule,unschedule,resumeTimeout});
    this.context=null;this.volume=1;this.rate=1;this.enabled=true;this.serial=0;this.sources=[];this.encoded=new Map();this.decoded=new Map();
    this.loadBank=loadBank;this.bankPromise=null;
  }
  bank(){if(!this.bankPromise)this.bankPromise=Promise.resolve().then(this.loadBank).catch(error=>{this.bankPromise=null;throw error;});return this.bankPromise;}
  contextReady(){if(!this.context){this.context=this.contextFactory();this.gain=this.context.createGain();this.gain.gain.value=this.volume;this.gain.connect(this.context.destination);}return this.context;}
  bytes(token,bank) {
    if(!bank.clips[token])return Promise.reject(new Error('A voice clip is unavailable.'));
    if(!this.encoded.has(token)) {
      const request=this.fetcher(bank.clips[token].url).then(r=>{if(!r.ok)throw new Error('Voice audio could not load.');return r.arrayBuffer();}).catch(error=>{this.encoded.delete(token);throw error;});
      this.encoded.set(token,request);if(this.encoded.size>160)this.encoded.delete(this.encoded.keys().next().value);
    }
    return this.encoded.get(token);
  }
  async warm(tokens) {
    try{const bank=await this.bank();await Promise.all([...new Set(tokens)].map(t=>this.bytes(t,bank)));}catch{/* The explicit reading reports failures and can retry. */}
  }
  async buffer(token,bank) {
    if(!this.decoded.has(token)) {
      const task=this.bytes(token,bank).then(bytes=>this.context.decodeAudioData(bytes.slice(0))).catch(error=>{this.decoded.delete(token);throw error;});
      this.decoded.set(token,task);if(this.decoded.size>64)this.decoded.delete(this.decoded.keys().next().value);
    }
    return this.decoded.get(token);
  }
  stop() {
    this.serial++;
    if(this.gain)this.gain.gain.setValueAtTime(0,this.context.currentTime);
    for(const source of this.sources){source.onended=null;try{source.stop();}catch{/* Already finished. */}source.disconnect();}
    this.sources=[];this.onActive(false);
  }
  setEnabled(enabled){this.enabled=enabled;if(!enabled)this.stop();}
  setVolume(volume){this.volume=Math.max(0,Math.min(1,volume));if(this.gain)this.gain.gain.setValueAtTime(this.volume,this.context.currentTime);if(this.volume===0)this.stop();}
  async speak(tokens) {
    this.stop();this.onBlocked(false);
    if(!this.enabled){this.onStatus('Spoken shortcuts are off. Enable them in Speech.');return false;}
    if(this.volume===0){this.onStatus('Speech volume is zero. Raise Speech volume to hear a reading.');return false;}
    const serial=this.serial;
    try {
      const context=this.contextReady();
      // Resume synchronously in the actual key/click handler, before fetching any clips.
      this.onStatus('Starting built-in voice…');
      let timer;
      const resumed=Promise.race([context.resume(),new Promise((resolve,reject)=>{timer=this.schedule(()=>reject(new Error('Audio was blocked.')),this.resumeTimeout);})]).finally(()=>this.unschedule(timer));
      const [bank]=await Promise.all([this.bank(),resumed]);
      const buffers=await Promise.all(tokens.map(t=>this.buffer(t,bank)));
      if(serial!==this.serial)return false;
      if(context.state!=='running')throw new Error('Audio was blocked.');
      this.gain.gain.setValueAtTime(this.volume,context.currentTime);
      let time=context.currentTime+.01,remaining=buffers.length;
      for(const buffer of buffers) {
        const source=context.createBufferSource();source.buffer=buffer;source.playbackRate.value=this.rate;source.connect(this.gain);
        source.onended=()=>{source.disconnect();if(serial===this.serial&&!--remaining){this.sources=[];this.onActive(false);this.onStatus('Ready · 1 place · 2 value · 3 date');}};
        this.sources.push(source);source.start(time);time+=Math.max(.01,buffer.duration/this.rate-.012);
      }
      this.onActive(true);this.onStatus('Speaking · built-in natural voice.');return true;
    }catch(error){if(serial===this.serial){this.stop();this.onBlocked(true);this.onStatus('Voice audio could not start. Click Test voice to retry, or open the standalone app.');}return false;}
  }
}
