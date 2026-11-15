// Actual autoregressive audio streaming, one 80 ms Mimi-decoder frame at a time.
// Direct CPU/WASM API keeps the existing app worker as the sole model owner.
import initWasm, {Model} from 'phonon-tts/raw';
import wasmUrl from 'phonon-tts/wasm/phonon_tts_simd_bg.wasm?url';

export const voices=['default'];
export const MODEL_REVISION='92741c5b07d085ff840e26fea8ce43110b87852f';
const BASE=`https://huggingface.co/gradium/phonon-31m-en/resolve/${MODEL_REVISION}/`;
const CACHE='geophonia-phonon-0.7.1';

async function bytes(file,onProgress) {
  const url=BASE+file;let cache;
  try{cache=await globalThis.caches?.open(CACHE);const cached=await cache?.match(url);if(cached){onProgress({status:`Loading cached ${file}`,file});return new Uint8Array(await cached.arrayBuffer());}}catch{}
  const response=await fetch(url);
  if(!response.ok)throw new Error(`Phonon ${file}: HTTP ${response.status}`);
  const total=Number(response.headers.get('content-length'))||0;
  if(!response.body){const result=new Uint8Array(await response.arrayBuffer());return result;}
  const reader=response.body.getReader(),chunks=[];let loaded=0;
  for(;;){const {value,done}=await reader.read();if(done)break;chunks.push(value);loaded+=value.byteLength;onProgress({status:`Downloading ${file}`,file,loaded,total});}
  const joined=new Uint8Array(loaded);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.length;}
  try{await cache?.put(url,new Response(joined,{headers:{'content-type':'application/octet-stream'}}));}catch{}
  return joined;
}

export async function load(options={},onProgress=()=>{}) {
  if(options.voice&&options.voice!=='default')throw new Error('This Phonon model uses its default voice.');
  onProgress({status:'Initializing Phonon CPU/WebAssembly'});
  // SIMD128 build, not Relaxed SIMD, supports browsers without the newer extension.
  await initWasm({module_or_path:options.wasmUrl??wasmUrl});
  const [weights,tokenizer,config,voice]=await Promise.all(['model.q8.gguf','tokenizer.json','config.json','default-voice.safetensors'].map(file=>bytes(file,onProgress)));
  onProgress({status:'Loading Phonon neural model and voice'});
  const model=await Model.load(weights,tokenizer,config,'q8','en','all',undefined,'cpu');
  let voiceIndex;
  try{voiceIndex=model.add_voice(voice);}catch(error){model.free();throw error;}
  const sampleRate=model.sample_rate();
  return {
    voice:'default',sampleRate,streamingKind:'audio-frames',
    // Speaking rate is applied by the app's PCM player; no hidden model reload.
    async *stream(text,settings={}) {
      const signal=settings.signal;
      if(signal?.aborted)return;
      model.start_generation(voiceIndex,text,settings.temperature??0.3,4242424242424242n);
      try{
        while(model.next_chunk()!==undefined){
          for(;;){
            if(signal?.aborted)return;
            const frame=await model.generation_step();
            if(!frame)break;
            yield {samples:Float32Array.from(frame),sampleRate};
          }
        }
      }finally{model.stop_generation();}
    },
    dispose(){model.stop_generation();model.free();},
  };
}
