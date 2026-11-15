// Device voices avoid model downloads and remote synthesis in the default path.
export function rankedVoices(voices) {
  const score=voice=>(voice.localService===false?0:1000)
    +(/natural|neural|enhanced|premium/i.test(voice.name)?300:0)
    +(/samantha|ava\b|serena|sonia|jenny|aria/i.test(voice.name)?80:0)
    +(/^en-GB$/i.test(voice.lang)?15:0)+(voice.default?1:0)
    -(/daniel|espeak/i.test(voice.name)?60:0);
  const english=voices.filter(v=>/^en(?:-|$)/i.test(v.lang));
  return [...(english.length?english:voices)].sort((a,b)=>score(b)-score(a)||a.name.localeCompare(b.name));
}
export class InstantSpeech {
  constructor({synth=globalThis.speechSynthesis,createUtterance=text=>new SpeechSynthesisUtterance(text),onStatus=()=>{},onActive=()=>{},onVoices=()=>{},onBlocked=()=>{},schedule=(fn,ms)=>setTimeout(fn,ms),unschedule=id=>clearTimeout(id),startupTimeout=1200}={}) {
    Object.assign(this,{synth,createUtterance,onStatus,onActive,onVoices,onBlocked,schedule,unschedule,startupTimeout});
    this.enabled=true;this.serial=0;this.volume=1;this.rate=1;this.voiceURI='';this.utterance=null;this.explicitVoice=false;this.startTimer=null;
    this.refresh=()=>{
      try{this.voices=rankedVoices(this.synth?.getVoices?.()??[]);}catch{this.voices=[];}
      if(!this.explicitVoice||!this.voices.some(v=>v.voiceURI===this.voiceURI))this.voiceURI=this.voices[0]?.voiceURI??'';
      this.onVoices(this.voices,this.voiceURI);
    };
    try{this.synth?.addEventListener?.('voiceschanged',this.refresh);}catch{/* Some embedded browsers restrict voice discovery. */}
    this.refresh();
  }
  clearStartup(){if(this.startTimer!==null){this.unschedule(this.startTimer);this.startTimer=null;}}
  stop() {
    // Invalidate callbacks before cancel(), which can synchronously dispatch an error.
    this.serial++;this.clearStartup();
    const active=this.utterance;this.utterance=null;
    if(active){try{this.synth?.cancel();}catch{/* Still release application state. */}}
    this.onActive(false);
  }
  setEnabled(enabled){this.enabled=enabled;if(!enabled)this.stop();}
  setVolume(volume){this.volume=Math.max(0,Math.min(1,volume));if(this.volume===0)this.stop();}
  selectVoice(uri){this.stop();this.voiceURI=uri;this.explicitVoice=!!uri;}
  speak(text) {
    this.stop();this.onBlocked(false);
    if(!this.enabled){this.onStatus('Spoken shortcuts are off. Enable them in Speech.');return false;}
    if(!this.synth){this.onStatus('Speech is unavailable in this browser. The reading is shown as text.');this.onBlocked(true);return false;}
    if(this.volume===0){this.onStatus('Speech volume is zero. Raise Speech volume to hear a reading.');return false;}
    this.refresh();
    const chosen=this.voices.find(v=>v.voiceURI===this.voiceURI);
    return this.start(text,chosen,false);
  }
  start(text,voice,retried) {
    const serial=this.serial;let utterance;
    const current=()=>serial===this.serial&&this.utterance===utterance;
    try {
      utterance=this.createUtterance(text);this.utterance=utterance;
      if(voice)utterance.voice=voice;
      utterance.lang=voice?.lang??'en-GB';utterance.rate=this.rate;utterance.volume=this.volume;
      utterance.onstart=()=>{if(current()){this.clearStartup();this.onActive(true);this.onStatus(`Speaking${voice?' · '+voice.name:''}.`);}};
      utterance.onend=()=>{if(current()){this.clearStartup();this.utterance=null;this.onActive(false);this.onStatus('Ready · 1 place · 2 value · 3 date');}};
      utterance.onerror=event=>{if(current())this.failed(text,voice,retried,event.error);};
      // cancel() does not clear the browser's paused state. Resume within the key/click gesture.
      if(this.synth.paused)this.synth.resume?.();
      this.onStatus(retried?'Trying the device voice…':'Starting speech…');
      // Arm before speak(): test doubles and some engines dispatch events synchronously.
      this.startTimer=this.schedule(()=>{if(current())this.failed(text,voice,retried,'timeout');},this.startupTimeout);
      this.synth.speak(utterance);return true;
    }catch{if(serial===this.serial)this.failed(text,voice,retried,'synthesis-failed');return false;}
  }
  failed(text,voice,retried,error) {
    this.clearStartup();
    // A browser permission failure needs a user gesture/standalone context, not repeated requests.
    const blocked=error==='not-allowed'||error==='service-not-allowed';
    const fallback=this.voices.find(v=>v.localService!==false&&v.voiceURI!==voice?.voiceURI);
    if(!retried&&!blocked) {
      this.stop();
      // Omitting a selected voice also gives the platform default a chance when voice metadata lies.
      this.start(text,fallback,true);return;
    }
    this.stop();this.onBlocked(true);
    this.onStatus(blocked?'This browser blocked speech. Click Test voice, or open the standalone app.':error==='timeout'?'The browser did not start speech. Click Test voice, select another device voice, or open the standalone app.':'Speech could not play. Select another device voice and click Test voice.');
  }
}
