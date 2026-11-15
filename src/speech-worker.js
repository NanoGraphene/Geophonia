import{createEspeak,canCompileWasm,encodeWav}from'@spelling-creator/spellophone/browser';
let engine=null,loading=null,pending=null,busy=false,latest=0;
async function initialize(dataUrl) {
  if(engine){postMessage({type:'ready',mode:canCompileWasm()?'WebAssembly':'JavaScript fallback'});return;}
  if(loading)return loading;
  const started=performance.now();
  loading=createEspeak({dataUrl,languages:['en'],fallback:()=>import('@spelling-creator/spellophone/wasm2js')});
  try{engine=await loading;postMessage({type:'ready',mode:canCompileWasm()?'WebAssembly':'JavaScript fallback',loadMs:performance.now()-started});}
  catch(error){postMessage({type:'error',phase:'load',message:`Speech engine could not load: ${error.name}: ${error.message}`});}
  finally{loading=null;}
}
async function drain() {
  if(busy)return;busy=true;
  try{while(pending){
    const request=pending;pending=null;
    try {
      const started=performance.now();
      const result=engine.synthesize(request.text,{voice:request.voice??'en-gb',rate:Math.round(175*(request.rate??1)),volume:100});
      const wav=encodeWav(result.samples,result.sampleRate);
      if(request.id===latest)postMessage({type:'audio',id:request.id,wav:wav.buffer,generationMs:performance.now()-started,duration:result.duration,samples:result.samples.length,sampleRate:result.sampleRate},[wav.buffer]);
    }catch(error){if(request.id===latest)postMessage({type:'error',phase:'generate',id:request.id,message:`Speech synthesis failed: ${error.name}: ${error.message}`});}
    await new Promise(resolve=>setTimeout(resolve,0));
  }}finally{busy=false;}
}
self.onmessage=event=>{
  const message=event.data;
  if(message.type==='init'){initialize(message.dataUrl);return;}
  if(message.type==='cancel'){latest=message.id;pending=null;return;}
  if(message.type==='speak'){
    latest=message.id;if(!engine){postMessage({type:'error',phase:'generate',id:message.id,message:'Speech engine is not ready yet.'});return;}
    if(typeof message.text!=='string'||!message.text.trim()||message.text.length>5000){postMessage({type:'error',phase:'generate',id:message.id,message:'Enter between 1 and 5,000 characters.'});return;}
    pending=message;drain();
  }
};
