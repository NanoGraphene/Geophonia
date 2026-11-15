// Real application DOM/event wiring with actual fresh synthesis.
// Media device output is mocked; this is not a graphical browser test.
import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';
import{webcrypto}from'node:crypto';
import{JSDOM}from'jsdom';
import{build}from'esbuild';
import{createEspeak,encodeWav}from'@spelling-creator/spellophone';
async function until(condition){for(let i=0;i<100;i++){if(condition())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Application speech event timed out.');}
test('freeform UI and map keys generate new speech; blocked autoplay retains a working native Play path',async()=>{
  const bundled=await build({entryPoints:['src/main.js'],bundle:true,write:false,format:'iife',loader:{'.css':'empty'},define:{'import.meta.url':'"https://app.test/src/main.js"'},logLevel:'silent'});
  const dom=new JSDOM(await readFile('index.html','utf8'),{url:'https://app.test/',runScripts:'outside-only'}),window=dom.window;
  const errors=[];window.addEventListener('error',event=>errors.push(event.error));
  const engine=await createEspeak({languages:['en']}),spoken=[],blobs=new Map();let blocked=true,blobCount=0;
  Object.assign(window,{TextEncoder,TextDecoder,ResizeObserver:class{observe(){}},fetch:async url=>{
    const bytes=await readFile('public'+new URL(url,'https://app.test/').pathname);
    return {ok:true,json:async()=>JSON.parse(bytes),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
  }});
  Object.defineProperty(window,'crypto',{value:webcrypto});
  window.URL.createObjectURL=blob=>{const url='blob:app-test-'+(++blobCount);blobs.set(url,blob);return url;};window.URL.revokeObjectURL=url=>blobs.delete(url);
  window.Image=class{naturalWidth=2048;naturalHeight=1024;async decode(){}};
  window.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},getImageData:(x,y,width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)})});
  window.HTMLMediaElement.prototype.pause=function(){Object.defineProperty(this,'paused',{value:true,configurable:true});};
  window.HTMLMediaElement.prototype.load=function(){};
  window.HTMLMediaElement.prototype.play=function(){
    if(blocked)return Promise.reject(Object.assign(new Error('Autoplay requires a click'),{name:'NotAllowedError'}));
    Object.defineProperty(this,'paused',{value:false,configurable:true});this.dispatchEvent(new window.Event('playing'));return Promise.resolve();
  };
  window.Worker=class{
    postMessage(message){
      if(message.type==='init')setTimeout(()=>this.onmessage?.({data:{type:'ready',mode:'test real synthesis',loadMs:0}}),0);
      if(message.type==='speak'){
        spoken.push(message.text);const audio=engine.synthesize(message.text,{voice:message.voice,rate:175*message.rate}),wav=encodeWav(audio.samples,audio.sampleRate);
        setTimeout(()=>this.onmessage?.({data:{type:'audio',id:message.id,wav:wav.buffer,generationMs:1,duration:audio.duration,samples:audio.samples.length,sampleRate:audio.sampleRate}}),0);
      }
    }
    terminate(){this.onmessage=null;}
  };
  try{
    window.eval(bundled.outputFiles[0].text);
    await until(()=>window.document.getElementById('speech-engine-state').textContent.includes('ready'));
    const input=window.document.getElementById('speech-text'),button=window.document.getElementById('voice-test'),player=window.document.getElementById('speech-player');
    input.value='A newly invented instrument named Quasarbrook measures minus 37.25 volts.';button.click();
    await until(()=>window.document.getElementById('voice-status').textContent.includes('NotAllowedError'));
    assert.equal(spoken.at(-1),input.value);assert.ok(player.src.startsWith('blob:'));assert.ok(blobs.size>0);
    const diagnostic=JSON.parse(window.document.getElementById('speech-diagnostics').textContent);assert.equal(diagnostic.state,'playback error');assert.match(diagnostic.error,/NotAllowedError/);
    blocked=false;await player.play();player.tabIndex=0;player.focus();const currentSrc=player.src;player.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(player.src,currentSrc);assert.match(window.document.getElementById('voice-status').textContent,/Speaking/);
    await until(()=>window.document.getElementById('place-name').textContent==='Atlantic Ocean');
    const map=window.document.getElementById('map');map.focus();map.dispatchEvent(new window.KeyboardEvent('keydown',{key:'1',bubbles:true}));
    await until(()=>spoken.at(-1)==='Atlantic Ocean.');
    input.focus();const before=spoken.length;input.dispatchEvent(new window.KeyboardEvent('keydown',{key:'1',bubbles:true}));assert.equal(spoken.length,before);
    window.document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(player.getAttribute('src'),null);assert.deepEqual(errors,[]);
  }finally{engine.dispose?.();window.close();}
});
