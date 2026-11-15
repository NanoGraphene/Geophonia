// Execute the BUILT worker's browser branch in an isolated JavaScript realm.
// This validates generated speech and production asset URLs, not speaker output.
import vm from 'node:vm';
import{readFile,readdir,writeFile}from'node:fs/promises';
import{resolve}from'node:path';
import assert from'node:assert/strict';
const dist=resolve('dist');
const worker=(await readdir('dist/assets')).find(name=>name.startsWith('speech-worker-')&&name.endsWith('.js'));
assert.ok(worker,'Build the site before verifying its speech worker.');
async function verify(wasmAvailable){
  const origin='https://speech.test',workerURL=origin+'/assets/'+worker,requests=[],messages=[],listeners=[];
  const context=vm.createContext({
    URL,Blob,TextEncoder,TextDecoder,DecompressionStream,Response,performance,setTimeout,clearTimeout,console,
    WebAssembly:wasmAvailable?WebAssembly:undefined,
    fetch:async resource=>{
      const url=new URL(resource,origin);requests.push(url.pathname);
      const body=await readFile(resolve(dist,'.'+url.pathname));
      return new Response(body,{headers:{'Content-Type':url.pathname.endsWith('.wasm')?'application/wasm':'application/octet-stream'}});
    },
    postMessage:message=>{messages.push(message);for(const listener of [...listeners])listener(message);}
  });
  context.self=context;context.location=new URL(workerURL);
  const modules=new Map();
  async function load(url){
    if(modules.has(url))return modules.get(url);
    const source=await readFile(resolve(dist,'.'+new URL(url).pathname),'utf8');
    const module=new vm.SourceTextModule(source,{context,identifier:url,initializeImportMeta:meta=>{meta.url=url;},importModuleDynamically:async(specifier,ref)=>{
      const imported=await load(new URL(specifier,ref.identifier).href);if(imported.status==='unlinked')await imported.link(link);if(imported.status==='linked')await imported.evaluate();return imported;
    }});
    modules.set(url,module);return module;
  }
  const link=(specifier,ref)=>load(new URL(specifier,ref.identifier).href);
  function next(type,id){return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{listeners.splice(listeners.indexOf(handle),1);reject(new Error('Worker verification timed out.'));},15000);
    function handle(message){if(message.type==='error'||message.type===type&&(id===undefined||message.id===id)){clearTimeout(timer);listeners.splice(listeners.indexOf(handle),1);if(message.type==='error')reject(new Error(message.message));else resolve(message);}}
    listeners.push(handle);
  });}
  const module=await load(workerURL);await module.link(link);await module.evaluate();
  const ready=next('ready');context.onmessage({data:{type:'init',dataUrl:origin+'/tts-data/'}});const initialized=await ready;
  const cases=[];
  for(const [index,text]of ['An unfamiliar sentence: the copper observatory recorded 472.6 units at dawn.','My custom grid is named Zephyr Meadow; its value is minus 18.75 meters.','The date is 15 November 2026, and this wording was not recorded in advance.'].entries()){
    const result=next('audio',index+1);context.onmessage({data:{type:'speak',id:index+1,text,voice:'en-gb',rate:1}});
    const audio=await result,wav=Buffer.from(audio.wav);assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');assert.equal(wav.readUInt32LE(24),22050);
    let peak=0;for(let i=44;i<wav.length;i+=2)peak=Math.max(peak,Math.abs(wav.readInt16LE(i))/32768);assert.ok(peak>0&&audio.samples>1000);
    cases.push({text,ms:audio.generationMs,duration:audio.duration,samples:audio.samples,peak,wavBytes:wav.length});
  }
  assert.deepEqual(requests.filter(path=>path.startsWith('/tts-data/')).sort(),['/tts-data/core.bin.gz','/tts-data/en_dict.gz','/tts-data/manifest.json']);
  return {mode:initialized.mode,loadMs:initialized.loadMs,cases,requests};
}
const report={scope:'Built production worker in an isolated browser-like JavaScript realm, with real synthesis and bundled WASM/JavaScript fallback. No graphical browser or speaker verification.',wasm:await verify(true),javascriptFallback:await verify(false)};
await writeFile('docs/live-speech-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
