import {SpeechPlayback} from './speech-playback.js';

// Startup loads a general-purpose model. Each reading streams fresh PCM frames.
export class PhononSpeech {
 constructor({createWorker,player,createContext,createURL=blob=>URL.createObjectURL(blob),revokeURL=url=>URL.revokeObjectURL(url),onStatus=()=>{},onActive=()=>{},onIdle=()=>{},onDiagnostic=()=>{},schedule=(fn,ms)=>setTimeout(fn,ms),unschedule=id=>clearTimeout(id),now=()=>performance.now()}={}){
  Object.assign(this,{createWorker,player,createURL,revokeURL,onStatus,onActive,onIdle,onDiagnostic,schedule,unschedule,now});
  this.worker=null;this.loading=null;this.ready=false;this.serial=0;this.url=null;this.loadTimer=null;this.stallTimer=null;this.enabled=true;this.volume=1;this.rate=1;this.chain=Promise.resolve();this.playbackError=null;
  this.speaking=false;
  this.playback=new SpeechPlayback({createContext,onActive,onFirst:({delayMs})=>{this.playbackStartMs=this.now()-this.requestAt+delayMs;this.diagnostic({state:'streaming',firstPCMms:this.firstPCMms,estimatedPlaybackStartMs:this.playbackStartMs,gaps:this.playback.gaps});},onGap:gaps=>this.diagnostic({state:'streaming',gaps}),onDone:()=>{this.speaking=false;this.onActive(false);if(!this.playbackError)this.onStatus('Phonon ready · 1 place · 2 value · 3 date');this.onIdle();}});
 }
 diagnostic(details){this.onDiagnostic({engine:'Phonon 31M',engineReady:this.ready,...details});}
 clearTimer(key){if(this[key]!==null){this.unschedule(this[key]);this[key]=null;}}
 prepare(){
  if(this.ready)return Promise.resolve();if(this.loading)return this.loading;
  this.onStatus('Loading Phonon automatically · about 65 MB on first use…');this.diagnostic({state:'loading'});
  const pending=new Promise((resolve,reject)=>{this.resolveLoad=resolve;this.rejectLoad=reject;
   try{const worker=this.createWorker();this.worker=worker;
    worker.onmessage=e=>{if(this.worker===worker)this.receive(e.data);};worker.onerror=e=>{if(this.worker===worker)this.fail(`Phonon worker failed: ${e.message||'worker unavailable'}`);};
    this.loadTimer=this.schedule(()=>this.fail('Phonon model loading timed out. Check the connection and press a reading key to retry.'),300000);worker.postMessage({type:'init'});
   }catch(e){this.fail(`Phonon could not start: ${e.name}: ${e.message}`);}
  });
  const loading=pending.finally(()=>{if(this.loading===loading)this.loading=null;});this.loading=loading;return loading;
 }
 stop(){
  this.speaking=false;
  this.serial++;this.clearTimer('stallTimer');this.worker?.postMessage({type:'cancel',id:this.serial});this.playback.stop();this.chain=Promise.resolve();this.playbackError=null;
  this.player.onplaying=null;this.player.onended=null;this.player.onpause=null;this.player.onerror=null;this.player.pause();this.player.removeAttribute('src');this.player.load();if(this.url){this.revokeURL(this.url);this.url=null;}this.onActive(false);
 }
 // Prime the audio context in a navigation gesture without generating speech.
 activateAudio(){if(!this.enabled||!this.volume)return Promise.resolve(false);const id=this.serial;return this.playback.unlock().then(()=>true).catch(error=>{if(id===this.serial)this.reportPlaybackError(error);return false;});}
 setEnabled(enabled){this.enabled=enabled;if(!enabled)this.stop();}
 setVolume(value){this.volume=Math.max(0,Math.min(1,value));this.player.volume=this.volume;this.playback.setVolume(this.volume);if(!this.volume)this.stop();}
 watchFrames(){this.clearTimer('stallTimer');this.stallTimer=this.schedule(()=>this.fail('Phonon stopped producing audio. Press a reading key to reload and retry.'),60000);}
 async speak(text){
  this.stop();if(!this.enabled){this.onStatus('Spoken shortcuts are off. Enable them in Speech.');return false;}if(!this.volume){this.onStatus('Speech volume is zero. Raise Speech volume to hear it.');return false;}
  if(typeof text!=='string'||!text.trim()||text.length>5000){this.onStatus('Enter between 1 and 5,000 characters.');return false;}
  // Hold ownership during model loading, generation gaps and buffered playback.
  this.speaking=true;
  const id=this.serial;this.requestAt=this.now();this.firstPCMms=null;this.playbackStartMs=null;this.playback.setVolume(this.volume);
  // Unlock in the original key/click handler, before awaiting model initialization.
  this.chain=this.playback.unlock().catch(e=>{if(id===this.serial){this.playbackError=e;this.reportPlaybackError(e);}});
  try{await this.prepare();if(id!==this.serial)return false;if(this.playbackError)this.reportPlaybackError(this.playbackError);else this.onStatus('Phonon · requesting first audio…');this.watchFrames();this.worker.postMessage({type:'speak',id,text,rate:this.rate});return true;}catch{return false;}
 }
 receive(message){
  if(message.type==='progress'){
   const p=message.progress??{},detail=p.total?` · ${(p.loaded/1e6).toFixed(1)} / ${(p.total/1e6).toFixed(1)} MB`:'';
   this.onStatus(`Phonon · ${p.status||'loading model'}${detail}`);this.diagnostic({state:'loading',...p});return;
  }
  if(message.type==='ready'){this.clearTimer('loadTimer');this.ready=true;this.diagnostic({state:'ready',mode:message.mode,loadMs:message.loadMs});this.onStatus('Phonon ready · 1 place · 2 value · 3 date');this.resolveLoad?.();this.resolveLoad=null;this.rejectLoad=null;return;}
  if(message.type==='error'){
   if(message.phase==='load'){this.fail(message.message);return;}
   if(message.id===this.serial){this.stop();this.onStatus(message.message);this.diagnostic({state:'synthesis error',error:message.message});this.onActive(false);}return;
  }
  if(message.id!==this.serial)return;const id=this.serial;
  if(message.type==='chunk'){
   this.watchFrames();this.firstPCMms??=this.now()-this.requestAt;
   this.chain=this.chain.then(()=>{if(id!==this.serial||this.playbackError)return;
    try{this.playback.enqueue(new Float32Array(message.samples),message.sampleRate,this.rate);this.onStatus('Speaking with Phonon · streaming audio');}
    catch(e){this.playbackError=e;this.playback.stop();this.reportPlaybackError(e);}
   });return;
  }
  if(message.type!=='complete')return;this.clearTimer('stallTimer');
  this.url=this.createURL(new Blob([message.wav],{type:'audio/wav'}));this.player.src=this.url;this.player.volume=this.volume;this.player.playbackRate=this.rate;this.player.load();
  this.player.onplaying=()=>{if(id===this.serial&&!this.player.paused){this.playback.stop();this.speaking=true;this.onActive(true);this.onStatus('Speaking · Phonon replay');}};
  this.player.onpause=()=>{if(id===this.serial){this.speaking=false;this.onActive(false);if(!this.player.ended)this.onStatus('Speech replay paused.');}};
  this.player.onended=()=>{if(id===this.serial){this.speaking=false;this.onActive(false);this.onStatus('Phonon ready · 1 place · 2 value · 3 date');this.onIdle();}};
  this.player.onerror=()=>{if(id===this.serial&&this.player.error){this.onActive(false);this.reportPlaybackError(this.player.error);}};
  this.diagnostic({state:this.playbackError?'playback error':'generated',generationMs:message.generationMs,firstPCMms:this.firstPCMms,estimatedPlaybackStartMs:this.playbackStartMs,chunks:message.chunks,duration:message.duration,sampleRate:message.sampleRate,gaps:this.playback.gaps,...(this.playbackError?{error:this.playbackError.message}:{})});
  if(this.playbackError)this.reportPlaybackError(this.playbackError);
  // WAV is replay/fallback only. Playing it automatically would repeat the stream.
  this.chain=this.chain.then(()=>{if(id===this.serial&&!this.playbackError)this.playback.finish();});
 }
 reportPlaybackError(error){this.speaking=false;const detail=`${error.name??'MediaError'}${error.code?' '+error.code:''}: ${error.message||'audio playback failed'}`;this.diagnostic({state:'playback error',error:detail});this.onStatus(`${detail}. Press Play on the completed audio below, or open the standalone app.`);}
 fail(message){this.clearTimer('loadTimer');this.stop();this.ready=false;if(this.worker){this.worker.onmessage=null;this.worker.onerror=null;this.worker.terminate();}this.worker=null;this.rejectLoad?.(new Error(message));this.resolveLoad=null;this.rejectLoad=null;this.onStatus(message);this.diagnostic({state:'engine error',error:message});}
 dispose(){this.stop();this.clearTimer('loadTimer');this.ready=false;if(this.worker){this.worker.onmessage=null;this.worker.onerror=null;this.worker.terminate();}this.worker=null;this.rejectLoad?.(new Error('Phonon was disposed before model loading finished.'));this.resolveLoad=null;this.rejectLoad=null;this.loading=null;this.playback.dispose().catch(()=>{});}
}
