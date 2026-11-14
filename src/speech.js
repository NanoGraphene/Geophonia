export class Narrator {
 constructor({synthesis=globalThis.speechSynthesis,makeUtterance=text=>new globalThis.SpeechSynthesisUtterance(text),onSpeaking=()=>{},onFallback=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}={}){
  this.synthesis=synthesis;this.makeUtterance=makeUtterance;this.onSpeaking=onSpeaking;this.onFallback=onFallback;this.setTimer=setTimer;this.clearTimer=clearTimer;
  this.enabled=true;this.serial=0;this.timer=null;
 }
 get available(){return !!this.synthesis&&typeof this.synthesis.speak==='function';}
 cancel(){this.serial++;if(this.timer!==null)this.clearTimer(this.timer);this.timer=null;this.synthesis?.cancel();this.onSpeaking(false);}
 setEnabled(enabled){this.enabled=enabled;if(!enabled)this.cancel();}
 say(text,{explicit=false}={}){
  this.cancel();if(!this.available||(!this.enabled&&!explicit)||!text)return false;
  const serial=this.serial;
  this.timer=this.setTimer(()=>{
   this.timer=null;if(serial!==this.serial)return;
   try{
    const utterance=this.makeUtterance(text);utterance.lang='en-GB';
    utterance.onstart=()=>{if(serial===this.serial)this.onSpeaking(true);};
    utterance.onend=()=>{if(serial===this.serial)this.onSpeaking(false);};
    utterance.onerror=()=>{if(serial!==this.serial)return;this.onSpeaking(false);this.onFallback(text);};
    this.synthesis.speak(utterance);
   }catch{if(serial===this.serial){this.onSpeaking(false);this.onFallback(text);}}
  },explicit?0:180);
  return true;
 }
}
