/* Local inference worker. No text or generated audio is sent to a TTS service. */
importScripts('../vendor/kittentts-web.js');
let model=null,loading=null,busy=false,pending=null,latest=0;
async function initialize(runtime){
 if(model){postMessage({type:'ready'});return;}
 if(loading)return loading;
 loading=KittenTTSWeb.KittenTTS.create({model:'nano-int8',analytics:false,ortNumThreads:1,downloadRetries:2,
  storageDirectory:'geophonia-kitten-nano-84781d7',
  modelBaseURL:'https://huggingface.co/KittenML/kitten-tts-nano-0.8-int8/resolve/84781d74e29ee25217551556398b42f80593a813',
  ortWasmPath:runtime
 },(progress,info)=>postMessage({type:'progress',progress,asset:info?.asset??'voice assets',stage:info?.stage??'loading'}));
 try{model=await loading;postMessage({type:'ready'});}catch{postMessage({type:'error',phase:'load',message:'Natural voice could not load. Check the connection and retry, or explicitly select the browser fallback.'});}finally{loading=null;}
}
async function drain(){
 if(busy)return;busy=true;
 try{while(pending){
  const request=pending;pending=null;
  try{
   const result=await model.generate(request.text,{voice:request.voice,speed:request.speed});
   if(request.id!==latest)continue;
   const wav=result.wavData();postMessage({type:'audio',id:request.id,wav:wav.buffer},[wav.buffer]);
  }catch{if(request.id===latest)postMessage({type:'error',id:request.id,phase:'generate',message:'Natural speech generation failed. Try a shorter reading or a different voice.'});}
 }}finally{busy=false;}
}
onmessage=event=>{
 const message=event.data;
 if(message.type==='init'){initialize(message.runtime);return;}
 if(message.type==='cancel'){latest=message.id;pending=null;return;}
 if(message.type==='generate'){
  latest=message.id;
  if(!model){postMessage({type:'error',id:message.id,message:'Load the natural voice first.'});return;}
  pending=message;drain();
 }
};
