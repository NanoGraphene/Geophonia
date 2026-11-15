// Arbitrary text -> local synthesis worker -> freshly generated PCM/WAV -> media player.
export class TextSpeech {
  constructor({createWorker,player,createURL=blob=>URL.createObjectURL(blob),revokeURL=url=>URL.revokeObjectURL(url),onStatus=()=>{},onActive=()=>{},onDiagnostic=()=>{},schedule=(fn,ms)=>setTimeout(fn,ms),unschedule=id=>clearTimeout(id)}={}) {
    Object.assign(this,{createWorker,player,createURL,revokeURL,onStatus,onActive,onDiagnostic,schedule,unschedule});
    this.worker=null;this.loading=null;this.ready=false;this.serial=0;this.url=null;this.timer=null;
    this.enabled=true;this.volume=1;this.rate=1;this.voice='en-gb';
  }
  clearTimer(){if(this.timer!==null){this.unschedule(this.timer);this.timer=null;}}
  prepare(dataUrl=this.dataUrl) {
    this.dataUrl=dataUrl;if(this.ready)return Promise.resolve();if(this.loading)return this.loading;
    this.onStatus('Loading fast local speech engine…');
    this.loading=new Promise((resolve,reject)=>{
      this.resolveLoad=resolve;this.rejectLoad=reject;
      try {
        const worker=this.createWorker();this.worker=worker;
        worker.onmessage=event=>{if(this.worker===worker)this.receive(event.data);};
        worker.onerror=event=>{if(this.worker===worker)this.fail(`Speech worker failed: ${event.message||'blocked or unsupported worker'}`,true);};
        this.timer=this.schedule(()=>this.fail('Speech initialization timed out. Check the connection and retry.',true),15000);
        this.worker.postMessage({type:'init',dataUrl});
      }catch(error){this.fail(`Speech worker could not start: ${error.name}: ${error.message}`,true);}
    });
    return this.loading.finally(()=>{this.loading=null;});
  }
  stop() {
    this.serial++;this.worker?.postMessage({type:'cancel',id:this.serial});
    this.player.onplaying=null;this.player.onended=null;this.player.onpause=null;this.player.onerror=null;
    this.player.pause();this.player.removeAttribute('src');this.player.load();
    if(this.url){this.revokeURL(this.url);this.url=null;}this.onActive(false);
  }
  setEnabled(enabled){this.enabled=enabled;if(!enabled)this.stop();}
  setVolume(value){this.volume=Math.max(0,Math.min(1,value));this.player.volume=this.volume;if(this.volume===0)this.stop();}
  async speak(text) {
    this.stop();
    if(!this.enabled){this.onStatus('Spoken shortcuts are off. Enable them in Speech.');return false;}
    if(this.volume===0){this.onStatus('Speech volume is zero. Raise Speech volume to hear it.');return false;}
    if(typeof text!=='string'||!text.trim()||text.length>5000){this.onStatus('Enter between 1 and 5,000 characters.');return false;}
    const id=this.serial;
    try{await this.prepare();if(id!==this.serial)return false;
      this.onStatus('Generating speech locally…');this.worker.postMessage({type:'speak',id,text,voice:this.voice,rate:this.rate});return true;
    }catch{return false;}
  }
  receive(message) {
    if(message.type==='ready') {
      this.clearTimer();this.ready=true;this.onDiagnostic({engine:'eSpeak NG',state:'ready',mode:message.mode,loadMs:message.loadMs});
      this.onStatus('Local speech ready · 1 place · 2 value · 3 date');this.resolveLoad?.();this.resolveLoad=null;this.rejectLoad=null;return;
    }
    if(message.type==='error'){
      if(message.phase==='load'){this.fail(message.message,true);return;}
      if(message.id===this.serial){this.onStatus(message.message);this.onDiagnostic({state:'synthesis error',error:message.message});this.onActive(false);}return;
    }
    if(message.type!=='audio'||message.id!==this.serial)return;
    const id=this.serial;
    this.onDiagnostic({engine:'eSpeak NG',state:'audio generated',generationMs:message.generationMs,duration:message.duration,sampleRate:message.sampleRate,samples:message.samples});
    this.url=this.createURL(new Blob([message.wav],{type:'audio/wav'}));
    this.player.src=this.url;this.player.volume=this.volume;this.player.load();
    this.player.onplaying=()=>{if(id===this.serial&&!this.player.paused){this.onActive(true);this.onStatus('Speaking · freshly synthesized text');}};
    this.player.onpause=()=>{if(id===this.serial){this.onActive(false);if(!this.player.ended)this.onStatus('Speech paused. Press Play below to continue.');}};
    this.player.onended=()=>{if(id===this.serial){this.onActive(false);this.onStatus('Ready · press a reading key or enter new text');}};
    this.player.onerror=()=>{if(id===this.serial&&this.player.error){this.onActive(false);this.reportPlaybackError(this.player.error);}};
    this.onStatus('Speech generated. Starting playback…');
    Promise.resolve(this.player.play()).catch(error=>{if(id===this.serial){this.onActive(false);this.reportPlaybackError(error);}});
  }
  reportPlaybackError(error) {
    const detail=`${error.name??'MediaError'}${error.code?' '+error.code:''}: ${error.message||'audio playback failed'}`;
    this.onDiagnostic({state:'playback error',error:detail,readyState:this.player.readyState,networkState:this.player.networkState});
    this.onStatus(`${detail}. Press Play on the audio player below. If it is blocked here, open the standalone app.`);
  }
  fail(message,reset) {
    this.clearTimer();this.stop();
    if(reset){this.ready=false;if(this.worker){this.worker.onmessage=null;this.worker.onerror=null;this.worker.terminate();}this.worker=null;}
    this.rejectLoad?.(new Error(message));this.resolveLoad=null;this.rejectLoad=null;
    this.onStatus(message);this.onDiagnostic({state:'engine error',error:message});
  }
}
