// Verify actual production-worker synthesis in an isolated browser-like realm.
// This checks PCM streaming and cancellation, not a browser audio device.
import vm from 'node:vm';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const execFileAsync=promisify(execFile);
const dist=resolve('dist');
const cache=resolve(process.env.PHONON_VERIFY_CACHE||'.local/phonon-verify-cache');
const reportPath=resolve('docs/live-speech-verification.json');
const origin='https://speech-runtime.test';
const requests=[];
await mkdir(cache,{recursive:true});
const worker=(await readdir(join(dist,'assets'))).find(name=>/^speech-worker-.*\.js$/.test(name));
assert.ok(worker,'Build the application before running speech:verify.');

async function download(url){
  try{
    const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
    if(!response.ok){const error=new Error(`HTTP ${response.status} for ${url}`);error.http=true;throw error;}
    return new Uint8Array(await response.arrayBuffer());
  }catch(error){
    // Node fetch does not use every managed environment's proxy configuration.
    // Only the verifier has this fallback; browser application fetch is unchanged.
    const managedProxy=process.env.SITES_MANAGED_LINUX_CONTAINER==='1'||process.env.HTTPS_PROXY||process.env.HTTP_PROXY||process.env.ALL_PROXY;
    if(error.http||!managedProxy)throw error;
    const {stdout}=await execFileAsync('python3',['-c','import urllib.request,sys;sys.stdout.buffer.write(urllib.request.urlopen(sys.argv[1],timeout=90).read())',url],{encoding:'buffer',maxBuffer:160*1024*1024});
    return new Uint8Array(stdout);
  }
}

async function bytes(resource){
  const url=new URL(String(resource),origin);
  if(url.origin===origin)return readFile(join(dist,url.pathname));
  if(url.protocol==='blob:')return new Uint8Array(await(await fetch(url)).arrayBuffer());
  assert.equal(url.protocol,'https:','External verification resources must use HTTPS.');
  const path=join(cache,createHash('sha256').update(url.href).digest('hex'));
  try{return await readFile(path);}catch(error){if(error.code!=='ENOENT')throw error;}
  const body=await download(url.href);await writeFile(path,body);return body;
}

async function verify(){
  const messages=[],listeners=new Set(),workerURL=origin+'/assets/'+worker;
  class XHR{
    open(method,url){this.url=new URL(url,origin).href;}
    overrideMimeType(){}
    setRequestHeader(){}
    send(){bytes(this.url).then(body=>{this.status=200;this.response=body.buffer.slice(body.byteOffset,body.byteOffset+body.byteLength);this.responseURL=this.url;this.readyState=4;this.onload?.();this.onreadystatechange?.();}).catch(error=>this.onerror?.(error));}
  }
  const context=vm.createContext({
    XMLHttpRequest:XHR,console,ArrayBuffer,SharedArrayBuffer,DataView,Uint8Array,Int8Array,Uint16Array,Int16Array,Uint32Array,Int32Array,BigInt64Array,BigUint64Array,Float32Array,Float64Array,
    URL,Blob,TextEncoder,TextDecoder,Response,Request,Headers,AbortController,AbortSignal,ReadableStream,TransformStream,DecompressionStream,performance,setTimeout,clearTimeout,setInterval,clearInterval,queueMicrotask,WebAssembly,structuredClone,atob,btoa,crypto:globalThis.crypto,
    crossOriginIsolated:false,
    navigator:{userAgent:'Geophonia speech verification realm',hardwareConcurrency:1,storage:{getDirectory:async()=>{throw new Error('OPFS is unavailable in the verification realm.');}}},
    fetch:async resource=>{
      const url=new URL(resource instanceof Request?resource.url:String(resource),origin).href;requests.push(url);
      const body=await bytes(url);
      return new Response(body,{status:200,headers:{'Content-Type':new URL(url).pathname.endsWith('.wasm')?'application/wasm':'application/octet-stream','Content-Length':String(body.length)}});
    },
    postMessage:message=>{messages.push(message);for(const listener of [...listeners])listener(message);},
    importScripts:()=>{throw new Error('Unexpected classic-worker script import.');},
  });
  context.self=context;context.location=new URL(workerURL);context.WorkerGlobalScope=function(){};
  const modules=new Map();
  async function load(url){
    if(modules.has(url))return modules.get(url);
    const module=new vm.SourceTextModule(new TextDecoder().decode(await bytes(url)),{
      context,identifier:url,initializeImportMeta:meta=>{meta.url=url;},
      importModuleDynamically:async(specifier,ref)=>{
        const imported=await load(new URL(specifier,ref.identifier).href);
        if(imported.status==='unlinked')await imported.link(link);
        if(imported.status==='linked')await imported.evaluate();
        return imported;
      },
    });
    modules.set(url,module);return module;
  }
  const link=(specifier,ref)=>load(new URL(specifier,ref.identifier).href);
  const module=await load(workerURL);await module.link(link);await module.evaluate();

  function exchange(dispatch,{done,observe=()=>{},timeout=180000}){
    return new Promise((resolve,reject)=>{
      const cleanup=()=>{clearTimeout(timer);listeners.delete(handle);};
      const timer=setTimeout(()=>{cleanup();reject(new Error('Production speech-worker verification timed out.'));},timeout);
      function handle(message){
        try{
          if(message.type==='error')throw new Error(message.message);
          observe(message);
          if(done(message)){cleanup();resolve(message);}
        }catch(error){cleanup();reject(error);}
      }
      listeners.add(handle);
      try{dispatch();}catch(error){cleanup();reject(error);}
    });
  }
  const send=data=>context.onmessage({data});
  const initialized=await exchange(()=>send({type:'init'}),{done:message=>message.type==='ready'});
  assert.equal(messages.filter(message=>message.type==='chunk'||message.type==='complete').length,0,'Startup must load the model without prerendering speech.');
  const results=[{engine:'phonon',preparation:{loadMs:initialized.loadMs,generatedChunks:0}}];
  let serial=0;
  for(const text of [
    'The temperature over the Adriatic Sea is minus 18.75 degrees Celsius, on 15 November 2026.',
    'The cursor points to the Mediterranean Sea.',
  ]){
    const id=++serial,chunks=[];
    const result=await exchange(()=>send({type:'speak',id,text,rate:1}),{
      done:message=>message.type==='complete'&&message.id===id,
      observe:message=>{
        if(message.type!=='chunk'||message.id!==id)return;
        assert.equal(message.index,chunks.length,'PCM frames must retain their generation order.');
        assert.equal(message.sampleRate,24000);assert.equal(message.samples.length,1920,'Phonon should return 80 ms frames.');
        let peak=0;for(const sample of message.samples){assert.ok(Number.isFinite(sample),'PCM must be finite.');peak=Math.max(peak,Math.abs(sample));}
        chunks.push({index:message.index,length:message.samples.length,firstChunkMs:message.firstChunkMs,sampleRate:message.sampleRate,peak});
      },
    });
    assert.ok(chunks.length>1,'Expected actual incremental PCM frames, not a complete-utterance chunk.');
    assert.ok(chunks[0].firstChunkMs<result.generationMs,'First PCM must arrive before the full utterance is generated.');
    assert.equal(result.chunks,chunks.length);
    const wav=Buffer.from(result.wav);assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');assert.equal(wav.readUInt32LE(24),24000);assert.equal(wav.readUInt32LE(40),result.samples*2);
    let peak=0;for(let i=44;i<wav.length;i+=2)peak=Math.max(peak,Math.abs(wav.readInt16LE(i)));assert.ok(peak>100,'Synthesized WAV must contain nonzero audio.');
    results.push({engine:'phonon',text,peak,sampleRate:result.sampleRate,timing:{generationMs:result.generationMs,firstChunkMs:result.firstChunkMs,duration:result.duration,chunks:result.chunks},wavBytes:wav.length,streamVerification:{chunks:chunks.length,first:chunks[0],last:chunks.at(-1)}});
  }

  const before=messages.length,requestCount=requests.length;
  let replaced=false;
  const replacement=await exchange(()=>send({type:'speak',id:100,text:'This obsolete location reading should stop when the cursor moves across the map to another country.'}),{
    timeout:30000,
    done:message=>message.type==='complete'&&message.id===101,
    observe:message=>{
      if(message.type==='chunk'&&message.id===100&&!replaced){replaced=true;send({type:'cancel',id:101});send({type:'speak',id:101,text:'The cursor is over Italy.'});}
    },
  });
  const cancellationMessages=messages.slice(before);
  assert.ok(replaced,'Cancellation must occur during active generation.');
  assert.equal(cancellationMessages.filter(message=>message.type==='chunk'&&message.id===100).length,1,'Cancelled utterance must stop emitting PCM.');
  assert.ok(!cancellationMessages.some(message=>message.type==='complete'&&message.id===100),'Cancelled utterance must not emit a completed WAV.');
  assert.ok(replacement.chunks>1);assert.equal(requests.length,requestCount,'Cancellation and the next reading must reuse the loaded model.');assert.equal(messages.filter(message=>message.type==='ready').length,1);
  results.push({engine:'phonon',cancellation:{oldFrames:1,oldCompletion:false,newChunks:replacement.chunks,firstChunkMs:replacement.firstChunkMs,modelReloaded:false}});
  return results;
}

const scope='Actual built Geophonia speech worker with real Phonon model and CPU/WASM in an isolated browser-like Node VM realm. No graphical browser, audio-device or speaker verification. First PCM is not measured audible latency.';
try{
  const results=await verify();
  await mkdir(resolve('docs'),{recursive:true});
  const report={scope,worker,results,requests};await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}catch(error){
  await mkdir(resolve('docs'),{recursive:true});
  await writeFile(reportPath,JSON.stringify({scope,worker,error:error.message,requests},null,2)+'\n');
  console.error(error);process.exitCode=1;
}
