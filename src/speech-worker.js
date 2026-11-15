import {wavBytes} from './speech-wav.js';

// A single model owns one generation at a time. Cancellation retains the loaded
// model, and every PCM frame yields to the worker event loop for new map keys.
export function createSpeechWorker({
  loadEngine=async onProgress=>(await import('./phonon-engine.js')).load({},onProgress),
  post=(message,transfer=[])=>postMessage(message,transfer),
  clock=()=>performance.now(),
  yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0)),
}={}) {
  let engine=null,loading=null,pending=null,busy=false,latest=0,active=null;

  async function initialize() {
    if(engine){post({type:'ready',mode:'CPU / WebAssembly SIMD',loadMs:0});return;}
    if(loading)return loading;
    const started=clock();
    loading=(async()=>{
      try{
        engine=await loadEngine(progress=>post({type:'progress',progress}));
        post({type:'ready',mode:'CPU / WebAssembly SIMD',loadMs:clock()-started});
      }catch(error){post({type:'error',phase:'load',message:`Phonon could not load: ${error.name}: ${error.message}`});}
      finally{loading=null;}
    })();
    return loading;
  }

  async function drain() {
    if(busy)return;
    busy=true;
    try{
      while(pending){
        const request=pending;pending=null;
        if(request.id!==latest)continue;
        const controller=new AbortController();active=controller;
        const started=clock(),frames=[];let sampleRate,total=0,firstChunkMs=null;
        try{
          for await(const frame of engine.stream(request.text,{signal:controller.signal})){
            if(controller.signal.aborted||request.id!==latest)break;
            if(!frame.samples?.length)continue;
            if(sampleRate&&frame.sampleRate!==sampleRate)throw new Error('Sample rate changed during speech');
            sampleRate=frame.sampleRate;
            const copy=new Float32Array(frame.samples);
            for(const value of copy)if(!Number.isFinite(value))throw new Error('Phonon returned non-finite audio');
            frames.push(copy);total+=copy.length;firstChunkMs??=clock()-started;
            const samples=copy.slice();
            post({type:'chunk',id:request.id,samples,sampleRate,firstChunkMs,index:frames.length-1},[samples.buffer]);
            await yieldTask();
          }
          if(controller.signal.aborted||request.id!==latest)continue;
          const samples=new Float32Array(total);let offset=0;
          for(const frame of frames){samples.set(frame,offset);offset+=frame.length;}
          const wav=wavBytes(samples,sampleRate);
          post({type:'complete',id:request.id,wav,sampleRate,samples:total,duration:total/sampleRate,generationMs:clock()-started,chunks:frames.length,firstChunkMs},[wav]);
        }catch(error){
          if(!controller.signal.aborted&&request.id===latest)post({type:'error',phase:'generate',id:request.id,message:`Phonon synthesis failed: ${error.name}: ${error.message}`});
        }finally{if(active===controller)active=null;}
        await yieldTask();
      }
    }finally{busy=false;}
  }

  return event=>{
    const message=event.data;
    if(message.type==='init')return initialize();
    if(message.type==='cancel'){
      latest=message.id;pending=null;active?.abort();return;
    }
    if(message.type!=='speak')return;
    latest=message.id;pending=null;active?.abort();
    if(typeof message.text!=='string'||!message.text.trim()||message.text.length>5000){
      post({type:'error',phase:'generate',id:message.id,message:'Enter between 1 and 5,000 characters.'});return;
    }
    if(!engine){post({type:'error',phase:'generate',id:message.id,message:'Phonon is not ready yet.'});return;}
    pending=message;return drain();
  };
}

if(typeof self!=='undefined')self.onmessage=createSpeechWorker();
