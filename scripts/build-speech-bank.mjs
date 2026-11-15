/** Compile Bella natural speech into browser-independent clips.
 *
 * Developer-only: Node24+, ffmpeg, an external KittenTTS Web SDK checkout, pinned
 * model/voice/pronunciation caches, and matching onnxruntime-web@1.26.0 assets.
 * Nothing from the inference runtime is copied into the published app.
 *
 * node scripts/build-speech-bank.mjs --sdk /path/to/kittentts-web.js \
 *   --cache /path/to/kitten-cache --runtime /path/to/onnxruntime-web/dist
 * Optional --core-only, --limit N, --keys year:2026, --shard 0/2, or --assemble (no inference).
 */
import {readFile,writeFile,mkdir,readdir,access,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {resolve,join,basename,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const OUT=join(ROOT,'public/speech');
const MODEL_REVISION='84781d74e29ee25217551556398b42f80593a813';
const SDK_REVISION='c846fe92858f3447f4912226471f5a63983b3f94';
const EXPECTED_MODEL_SHA256='f7b0afcbee92870b32b8e0276d855b954dc25470c9f051b376ac7eee537c76fc';
const EXPECTED_VOICES_SHA256='8aa7cee235abb0739cb51e6559685f65a4dacd95568833d05699b1633f519b3f';
const EXPECTED_SDK_SHA256='6bbc1d35555d6c7f25dc9d69c9f870f5d436b6040a58240ab61c30d60126899c';
const COMPILER_REVISION='bella-opus24k-rms0015-margin50-v1';
const args=process.argv.slice(2);
function option(name,fallback){const i=args.indexOf(name);return i<0?fallback:args[i+1];}
const cache=resolve(option('--cache',join(ROOT,'work/kitten-cache')));
const runtime=option('--runtime','');const sdkPath=option('--sdk','');
const metadataDirectory=join(cache,'speech-bank-compiled-'+COMPILER_REVISION);
const sha=data=>createHash('sha256').update(data).digest('hex');
await mkdir(OUT,{recursive:true});await mkdir(metadataDirectory,{recursive:true});
const tokens=new Map(),coreKeys=new Set();
const add=(key,text,core=true)=>{tokens.set(key,text);if(core)coreKeys.add(key);};
add('phrase:test','Speech is ready.');
for(const name of ['Germany','France','United Kingdom','Chad','Atlantic Ocean','Pacific Ocean']) add('place:'+name,name+'.');
const numberWords=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
numberWords.forEach((word,i)=>add('number:'+i,word));
for(const [number,word] of [[20,'twenty'],[30,'thirty'],[40,'forty'],[50,'fifty'],[60,'sixty'],[70,'seventy'],[80,'eighty'],[90,'ninety']])add('number:'+number,word);
const phrases={approximately:'Approximately',imageEstimate:'An estimate from image color.',gridValue:'User supplied grid value.',hundred:'hundred',thousand:'thousand',million:'million',billion:'billion',minus:'minus',point:'point',oh:'oh',at:'at',oclock:"o'clock",utc:'UTC',annualAverage:'annual average',animationFrame:'Animation frame',dateUnverified:'Scientific date unverified.',period:'Period',noDate:'No date was supplied.',loading:'The selected frame is still loading.',loadError:'The selected frame could not load.',noValue:'No interpretable value is available at this location.',outside:'This location is outside the dataset coverage.',namesLoading:'Place names are still loading.',namesUnavailable:'Place names are unavailable.',unmapped:'No country, ocean or sea name is mapped here.',degrees:'degrees',north:'north',south:'south',east:'east',west:'west',per:'per',space:'space'};
for(const [key,text]of Object.entries(phrases))add('phrase:'+key,text);
const units={celsius:'degrees Celsius',micrograms:'micrograms per cubic meter',ppb:'parts per billion by volume',ppm:'parts per million',brightness:'percent image brightness',color:'percent visual color strength',lightning:'percent visual yellow mark brightness',meters:'meters',kilometers:'kilometers',percent:'percent',unspecified:'source units unspecified',demo:'demo units'};
for(const [key,text]of Object.entries(units))add('unit:'+key,text);
const ordinalWords=['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth','thirteenth','fourteenth','fifteenth','sixteenth','seventeenth','eighteenth','nineteenth','twentieth','twenty first','twenty second','twenty third','twenty fourth','twenty fifth','twenty sixth','twenty seventh','twenty eighth','twenty ninth','thirtieth','thirty first'];
ordinalWords.forEach((word,i)=>add('ordinal:'+(i+1),word));
['January','February','March','April','May','June','July','August','September','October','November','December'].forEach((word,i)=>add('month:'+(i+1),word));
const alphabetWords=['ay','bee','see','dee','ee','eff','jee','aitch','eye','jay','kay','ell','em','en','oh','pee','cue','are','ess','tee','you','vee','double you','ex','why','zee'];
alphabetWords.forEach((word,i)=>add('letter:'+String.fromCharCode(97+i),word));
for(const [key,word]of [['µ','micro'],['°','degrees'],['²','squared'],['³','cubed']])add('letter:'+key,word);
for(const [key,text]of [['sea-salt','Sea salt'],['dust','Dust'],['smoke','Smoke'],['sulfates','Sulfates'],['lightning','Yellow lightning marks']])add('category:'+key,text);
for(const [year,text]of [[2007,'two thousand seven'],[2012,'twenty twelve'],[2018,'twenty eighteen'],[2020,'twenty twenty'],[2021,'twenty twenty one'],[2022,'twenty twenty two'],[2023,'twenty twenty three'],[2025,'twenty twenty five'],[2026,'twenty twenty six']])add('year:'+year,text);
const {regions}=JSON.parse(await readFile(join(ROOT,'public/geography/place-names.json'),'utf8'));
const names=[...new Set(regions.map(region=>region.kind==='lakes'&&!/\blake\b|\bsea\b|\blago\b|\blac\b|\bloch\b/i.test(region.name)?`Lake ${region.name}`:region.name))].sort();
for(const name of names)if(!tokens.has('place:'+name))add('place:'+name,name+'.',false);
const priorities=['phrase:test',...['Germany','France','United Kingdom','Chad','Atlantic Ocean','Pacific Ocean'].map(n=>'place:'+n),'number:0','number:1','number:2','number:3','number:4','number:5','unit:celsius','unit:ppb','unit:brightness','phrase:approximately','phrase:imageEstimate','phrase:loading','phrase:noValue'];
const ordered=[...priorities,...[...tokens.keys()].filter(key=>!priorities.includes(key))];
const keyHash=key=>sha(JSON.stringify({text:tokens.get(key),voice:'bella',model:MODEL_REVISION,sdk:SDK_REVISION,compiler:COMPILER_REVISION})).slice(0,32);
const metadataPath=key=>join(metadataDirectory,keyHash(key)+'.json');
async function savedClip(key){try{const info=JSON.parse(await readFile(metadataPath(key),'utf8'));const bytes=await readFile(join(OUT,basename(info.url)));if(sha(bytes)!==info.sha256)return null;return info;}catch{return null;}}
async function assemble(requireComplete=false){
 const clips={},details=[],uniqueBytes=new Map();let bytes=0,duration=0;
 for(const key of ordered){const info=await savedClip(key);if(!info)continue;clips[key]={url:info.url,duration:info.duration,sha256:info.sha256};details.push({key,text:tokens.get(key),...info});uniqueBytes.set(info.url,info.bytes);duration+=info.duration;}
 bytes=[...uniqueBytes.values()].reduce((sum,value)=>sum+value,0);
 const missing=ordered.filter(key=>!clips[key]);
 if(requireComplete&&missing.length)throw new Error(`${missing.length} missing clips, first: ${missing.slice(0,8).join(', ')}`);
 const bank={voice:'Bella',format:'ogg-opus',clips};
 const tmp=join(OUT,`bank-${process.pid}.tmp`);await writeFile(tmp,JSON.stringify(bank,null,2)+'\n');await rename(tmp,join(OUT,'bank.json'));
 const sdkBytes=sdkPath?await readFile(resolve(sdkPath)):null;
 const runs=[];for(const file of await readdir(metadataDirectory))if(/^run-.*\.json$/.test(file))runs.push(JSON.parse(await readFile(join(metadataDirectory,file),'utf8')));
 const sourceInputs=JSON.parse(await readFile(join(metadataDirectory,'compiler-inputs.json'),'utf8').catch(()=>'null'));
 const timings=details.map(c=>c.generationSeconds).sort((a,b)=>a-b);const generationMeasurements={clipsMeasured:timings.length,totalClipProcessingSeconds:timings.reduce((sum,value)=>sum+value,0),medianClipProcessingSeconds:timings[Math.floor(timings.length/2)]??null,minClipProcessingSeconds:timings[0]??null,maxClipProcessingSeconds:timings.at(-1)??null,includes:'Local synthesis, trimming, Opus encoding and decoded PCM verification; cached duplicate tokens may reference the same measurement.'};
 const report={voice:'Bella',model:{id:'KittenML/kitten-tts-nano-0.8-int8',revision:MODEL_REVISION,license:'Apache-2.0'},sdk:{repository:'https://github.com/KittenML/KittenTTS-web',revision:SDK_REVISION,sha256:sdkBytes?sha(sdkBytes):null},compiler:{revision:COMPILER_REVISION,runtime:'onnxruntime-web 1.26.0 (generator only)',inference:'Offline local CPU/WASM with analytics disabled; no inference dependencies ship with the app',audio:'mono Ogg Opus, 24 kbps VBR; 24 kHz source PCM',trimming:'5ms RMS windows above .0015, retaining 50ms before/after detected speech; decoded output validated',duration:'Measured by decoding the encoded Ogg file to mono 24kHz float PCM, not container duration',determinism:'Stable text/config-derived filenames and cached outputs; stochastic synthesis output is retained once generated'},sourceInputs,generationMeasurements:{...generationMeasurements,runs},coverage:{tokensExpected:tokens.size,tokensAvailable:details.length,uniquePlaceNames:names.length,complete:missing.length===0,missing},assets:{uniqueFiles:new Set(details.map(c=>c.url)).size,encodedBytes:bytes,totalDecodedSeconds:duration},bankSha256:sha(await readFile(join(OUT,'bank.json'))),clips:details};
 const reportPath=join(ROOT,'docs/speech-bank.json'),reportTemp=reportPath+'.'+process.pid+'.tmp';await writeFile(reportTemp,JSON.stringify(report,null,2)+'\n');await rename(reportTemp,reportPath);
 return {available:details.length,total:tokens.size,places:names.length,missing:missing.length,bytes,decodedSeconds:duration};
}
if(args.includes('--assemble')){console.log(JSON.stringify(await assemble(true)));process.exit(0);}
if(!sdkPath||!runtime)throw new Error('Provide --sdk /path/to/kittentts-web.js and --runtime /path/to/onnxruntime-web/dist.');
async function find(name,directory){for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isFile()&&entry.name===name)return path;if(entry.isDirectory()&&!entry.name.startsWith('speech-bank-')){const result=await find(name,path);if(result)return result;}}return null;}
const [onnxPath,voicesPath,rulesPath,listPath]=await Promise.all(['kitten_tts_nano_v0_8.onnx','voices.npz','en_rules','en_list'].map(name=>find(name,cache)));
if(!onnxPath||!voicesPath||!rulesPath||!listPath)throw new Error('Pinned model, voices and English rules/list must already exist in --cache; compilation never downloads models.');
await access(join(resolve(runtime),'ort-wasm-simd-threaded.mjs'));await access(join(resolve(runtime),'ort-wasm-simd-threaded.wasm'));
const sdkSource=await readFile(resolve(sdkPath),'utf8');
if(sha(sdkSource)!==EXPECTED_SDK_SHA256)throw new Error('SDK bytes do not match the pinned browser bundle.');
if(sha(await readFile(onnxPath))!==EXPECTED_MODEL_SHA256||sha(await readFile(voicesPath))!==EXPECTED_VOICES_SHA256)throw new Error('Model/voice bytes do not match the pinned Kitten Nano INT8 revision.');
const runtimePackage=JSON.parse(await readFile(join(resolve(runtime),'../package.json'),'utf8'));if(runtimePackage.version!=='1.26.0')throw new Error('Use matching onnxruntime-web@1.26.0 assets.');
globalThis.require=createRequire(import.meta.url);
const KittenTTSWeb=new Function(sdkSource+';return KittenTTSWeb;')();
const model=await KittenTTSWeb.KittenTTS.create({model:'nano-int8',analytics:false,ortNumThreads:1,modelFiles:{onnxData:new Uint8Array(await readFile(onnxPath)),voicesData:new Uint8Array(await readFile(voicesPath))},phonemizer:new KittenTTSWeb.CEPhonemizer({rulesPath,listPath}),storageDirectory:cache,modelBaseURL:'https://huggingface.co/KittenML/kitten-tts-nano-0.8-int8/resolve/'+MODEL_REVISION,fetch:()=>{throw new Error('Offline compiler attempted a network request.');},ortWasmPath:pathToFileURL(resolve(runtime)+'/').href});
const inputFiles={model:onnxPath,voices:voicesPath,pronunciationRules:rulesPath,pronunciationList:listPath,wasm:join(resolve(runtime),'ort-wasm-simd-threaded.wasm'),wasmLoader:join(resolve(runtime),'ort-wasm-simd-threaded.mjs')};
const inputRecords={node:process.version,platform:process.platform,architecture:process.arch,files:{}};
for(const [key,path]of Object.entries(inputFiles)){const content=await readFile(path);inputRecords.files[key]={file:basename(path),sha256:sha(content),bytes:content.length};}
await writeFile(join(metadataDirectory,'compiler-inputs.json'),JSON.stringify(inputRecords)+'\n');
const limit=Number(option('--limit','Infinity'));if(limit!==Infinity&&(!Number.isInteger(limit)||limit<0))throw new Error('--limit must be a nonnegative integer.');
const shard=option('--shard','0/1').split('/').map(Number);if(shard.length!==2||!shard.every(Number.isInteger)||shard[0]<0||shard[1]<1||shard[0]>=shard[1])throw new Error('Use --shard index/count, e.g. 0/2.');
const requestedKeys=option('--keys','').split(',').filter(Boolean);for(const key of requestedKeys)if(!tokens.has(key))throw new Error('Unknown speech token: '+key);
const selection=ordered.filter(key=>(!args.includes('--core-only')||coreKeys.has(key))&&(!requestedKeys.length||requestedKeys.includes(key))).filter((key,index)=>index%shard[1]===shard[0]).slice(0,limit);
let generated=0,cached=0,started=Date.now();
const decode=file=>execFileSync('ffmpeg',['-v','error','-i',file,'-f','f32le','-ar','24000','-ac','1','pipe:1'],{maxBuffer:16*1024*1024});
function trimmedSamples(samples,rate){
 const window=Math.max(1,Math.round(rate*.005));let first=-1,last=-1;
 for(let i=0;i<samples.length;i+=window){let power=0,count=Math.min(window,samples.length-i);for(let k=0;k<count;k++)power+=samples[i+k]**2;if(Math.sqrt(power/count)>.0015){if(first<0)first=i;last=i+count;}}
 if(first<0)throw new Error('Synthesis yielded no detectable speech.');
 const margin=Math.round(rate*.05);return samples.slice(Math.max(0,first-margin),Math.min(samples.length,last+margin));
}
try {
 for(const key of selection){
  if(await savedClip(key)){cached++;continue;}
  const clipStarted=Date.now();const result=await model.generate(tokens.get(key),{voice:'bella',speed:1});
  if(result.sampleRate!==24000)throw new Error('Unexpected sample rate.');
  const samples=trimmedSamples(result.samples,result.sampleRate);const filename=keyHash(key)+'.ogg';const file=join(OUT,filename);
  const input=Buffer.from(samples.buffer,samples.byteOffset,samples.byteLength);
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','f32le','-ar','24000','-ac','1','-i','pipe:0','-c:a','libopus','-b:a','24k','-vbr','on','-application','voip','-frame_duration','20','-map_metadata','-1',file],{input,maxBuffer:1024*1024});
  const decoded=decode(file);const pcm=new Float32Array(decoded.buffer,decoded.byteOffset,decoded.byteLength/4);let peak=0;for(const sample of pcm){if(!Number.isFinite(sample))throw new Error('Nonfinite decoded speech.');peak=Math.max(peak,Math.abs(sample));}
  if(peak<.002)throw new Error('Silent decoded speech for '+key);
  const bytes=await readFile(file),info={url:'./speech/'+filename,duration:pcm.length/24000,sha256:sha(bytes),bytes:bytes.length,decodedPeak:peak,decodedFrames:pcm.length,generationSeconds:(Date.now()-clipStarted)/1000};
  await writeFile(metadataPath(key),JSON.stringify(info)+'\n');generated++;
  if(generated<=20||generated%25===0){const progress={key,generated,cached,selection:selection.length,elapsedSeconds:(Date.now()-started)/1000,secondsPerClip:(Date.now()-started)/1000/generated,duration:info.duration};console.log(JSON.stringify(progress));await assemble();}
 }
 const run={generated,cached,elapsedSeconds:(Date.now()-started)/1000,shard:shard.join('/'),selection:selection.length};await writeFile(join(metadataDirectory,`run-${Date.now()}-${process.pid}.json`),JSON.stringify(run)+'\n');
 console.log(JSON.stringify({finished:true,...run,...await assemble()}));
}finally{await model.dispose();}
