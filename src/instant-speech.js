export function rankedVoices(voices) {
  const score=voice=>(/^en(?:-|$)/i.test(voice.lang)?1000:0)
    +(/natural|neural|enhanced|premium/i.test(voice.name)?300:0)
    +(/google.*english|samantha|ava\b|serena|sonia|jenny|aria/i.test(voice.name)?80:0)
    +(/^en-GB$/i.test(voice.lang)?15:0)+(voice.localService?5:0)+(voice.default?1:0)
    -(/daniel|espeak/i.test(voice.name)?60:0);
  const english=voices.filter(v=>/^en(?:-|$)/i.test(v.lang));
  return [...(english.length?english:voices)].sort((a,b)=>score(b)-score(a)||a.name.localeCompare(b.name));
}
export class InstantSpeech {
  constructor({synth=globalThis.speechSynthesis,createUtterance=text=>new SpeechSynthesisUtterance(text),onStatus=()=>{},onActive=()=>{},onVoices=()=>{}}={}) {
    Object.assign(this,{synth,createUtterance,onStatus,onActive,onVoices});
    this.enabled=true;this.serial=0;this.volume=.25;this.rate=1;this.voiceURI='';this.utterance=null;this.explicitVoice=false;
    this.refresh=()=>{this.voices=rankedVoices(this.synth?.getVoices()??[]);if(!this.explicitVoice||!this.voices.some(v=>v.voiceURI===this.voiceURI)) this.voiceURI=this.voices[0]?.voiceURI??'';this.onVoices(this.voices,this.voiceURI);};
    this.synth?.addEventListener('voiceschanged',this.refresh);this.refresh();
  }
  stop() {
    this.serial++;
    if(this.utterance){this.synth?.cancel();this.utterance=null;}
    this.onActive(false);
  }
  setEnabled(enabled){this.enabled=enabled;if(!enabled)this.stop();}
  setVolume(volume){this.volume=Math.max(0,Math.min(1,volume));if(this.volume===0)this.stop();}
  selectVoice(uri){this.stop();this.voiceURI=uri;this.explicitVoice=true;}
  speak(text) {
    this.stop();
    if(!this.enabled){this.onStatus('Spoken shortcuts are off. Enable them in Speech.');return false;}
    if(!this.synth){this.onStatus('Speech is unavailable in this browser. The reading is shown as text.');return false;}
    if(this.volume===0){this.onStatus('Volume is zero. The reading is shown as text.');return false;}
    const serial=this.serial;
    try {
      const utterance=this.createUtterance(text);this.utterance=utterance;
      const voice=this.voices.find(v=>v.voiceURI===this.voiceURI);
      if(voice)utterance.voice=voice;
      utterance.lang=voice?.lang??'en-GB';utterance.rate=this.rate;utterance.volume=this.volume;
      utterance.onstart=()=>{if(serial===this.serial){this.onActive(true);this.onStatus('Speaking.');}};
      utterance.onend=()=>{if(serial===this.serial){this.utterance=null;this.onActive(false);this.onStatus('Ready · 1 place · 2 value · 3 date');}};
      utterance.onerror=event=>{if(serial===this.serial){this.utterance=null;this.onActive(false);this.onStatus(event.error==='not-allowed'?'Speech was blocked. Press a reading button to retry.':'Voice could not speak. Select another voice and retry.');}};
      this.onStatus('Preparing speech…');this.synth.speak(utterance);return true;
    } catch {this.utterance=null;this.onActive(false);this.onStatus('Speech could not start. Select another voice and retry.');return false;}
  }
}
