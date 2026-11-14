export class NaturalVoice {
 constructor({createWorker,createPlayer=()=>new Audio(),createURL=blob=>URL.createObjectURL(blob),revokeURL=url=>URL.revokeObjectURL(url),onState=()=>{},onActive=()=>{},browser=globalThis.speechSynthesis,createUtterance=text=>new SpeechSynthesisUtterance(text)}){
  Object.assign(this,{createWorker,createPlayer,createURL,revokeURL,onState,onActive,browser,createUtterance});
  this.onState=(state,message)=>{if(this.state===state&&this.message===message)return;this.state=state;this.message=message;onState(state,message);};
  this.worker=null;this.player=null;this.url=null;this.loaded=false;this.serial=0;this.loading=null;this.volume=.25;
 }
 async load(runtime){
  if(this.loaded)return;if(this.loading)return this.loading;
  this.onState('loading','Loading natural voice assets…');
  this.loading=new Promise((resolve,reject)=>{
   this.resolveLoad=resolve;this.rejectLoad=reject;
   try{this.worker=this.createWorker();this.worker.onmessage=event=>this.receive(event.data);this.worker.onerror=()=>this.fail('Natural voice worker could not start.',true);this.worker.postMessage({type:'init',runtime});}
   catch{this.fail('This browser could not start the natural voice worker.',true);}
  });
  // Keep a rejected load retryable, including synchronous worker creation failure.
  try{await this.loading;}finally{this.loading=null;}
 }
 stop(){
  this.serial++;this.worker?.postMessage({type:'cancel',id:this.serial});
  this.browser?.cancel();
  if(this.player){this.player.onplaying=null;this.player.onended=null;this.player.onerror=null;this.player.pause();this.player.removeAttribute('src');this.player.load();this.player=null;}
  if(this.url){this.revokeURL(this.url);this.url=null;}
  this.onActive(false);
  if(this.loaded)this.onState('ready','Natural voice ready.');
 }
 setVolume(volume){this.volume=Math.max(0,Math.min(1,volume));if(this.player)this.player.volume=this.volume;if(this.volume===0)this.browser?.cancel();}
 read(text,{voice='bella',speed=1,engine='neural'}={}){
  this.stop();const id=this.serial;
  if(engine==='browser'){
   if(!this.browser){this.onState('error','Browser voice fallback is unavailable.');return false;}
   try{
    const utterance=this.createUtterance(text);utterance.lang='en-US';utterance.rate=speed;utterance.volume=this.volume;
    utterance.onstart=()=>{if(id===this.serial){this.onState('speaking','Browser fallback speaking.');this.onActive(true);}};
    utterance.onend=()=>{if(id===this.serial){this.onActive(false);this.onState('ready','Browser fallback finished.');}};
    utterance.onerror=()=>{if(id===this.serial){this.onActive(false);this.onState('error','Browser fallback could not speak.');}};
    this.browser.speak(utterance);return true;
   }catch{this.onState('error','Browser fallback could not start.');return false;}
  }
  if(!this.loaded){this.onState('error','Load the natural voice first. No browser fallback has been selected.');return false;}
  this.onState('generating','Generating natural speech locally…');
  this.worker.postMessage({type:'generate',id,text,voice,speed});return true;
 }
 receive(message){
  if(message.type==='progress'){if(!this.loaded)this.onState('loading',`${message.stage}: ${message.asset} · ${Math.round(message.progress*100)}%`);return;}
  if(message.type==='ready'){this.loaded=true;this.onState('ready','Natural voice ready.');this.resolveLoad?.();this.resolveLoad=null;this.rejectLoad=null;return;}
  if(message.type==='error'){
   if(message.phase==='load'){this.fail(message.message,true);return;}
   if(message.id===this.serial){this.onActive(false);this.onState('error',message.message);}return;
  }
  if(message.type!=='audio'||message.id!==this.serial)return;
  const id=this.serial;const player=this.createPlayer();this.player=player;this.url=this.createURL(new Blob([message.wav],{type:'audio/wav'}));player.src=this.url;player.volume=this.volume;
  player.onplaying=()=>{if(id===this.serial){this.onState('speaking','Natural voice speaking.');this.onActive(true);}};
  player.onended=()=>{if(id===this.serial)this.stop();};
  player.onerror=()=>{if(id===this.serial){this.stop();this.onState('error','Voice playback failed. Try Read current data again.');}};
  Promise.resolve(player.play()).catch(()=>{if(id===this.serial){this.stop();this.onState('error','The browser blocked voice playback. Press Read current data to retry.');}});
 }
 fail(message,reset){this.stop();if(reset){this.loaded=false;this.worker?.terminate();this.worker=null;}this.rejectLoad?.(new Error(message));this.resolveLoad=null;this.rejectLoad=null;this.onState('error',message);}
}
