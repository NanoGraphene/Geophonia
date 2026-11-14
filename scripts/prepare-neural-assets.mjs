import {mkdir,copyFile} from 'node:fs/promises';
const output=new URL('../public/runtime/',import.meta.url);await mkdir(output,{recursive:true});
for(const name of ['ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm']) await copyFile(new URL('../node_modules/onnxruntime-web/dist/'+name,import.meta.url),new URL(name,output));
console.log('Prepared matching ONNX runtime. Kitten Nano weights load only on request.');
