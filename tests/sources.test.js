import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadSource} from '../src/sources.js';
test('source loader decodes selected sampling and display frames together, rejects invalid frames and retries failures',async()=>{
  const original={fetch:globalThis.fetch,Image:globalThis.Image,document:globalThis.document};
  const decoded=[];let failSecond=true;
  globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(await readFile('public/'+url.replace(/^\.\//,'')))});
  globalThis.Image=class {constructor(){this.naturalWidth=2048;this.naturalHeight=1024;}async decode(){decoded.push(this.src);if(failSecond&&this.src.includes('svs-5147-2'))throw new Error('decode failed');}};
  globalThis.document={createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({width:2048,height:1024,data:[]})})})};
  try {
    const first=await loadSource('svs-5147',0);assert.equal(first.frame.timestamp,'2026-10-29T09:00:00Z');assert.equal(first.index,0);
    await assert.rejects(loadSource('svs-5147',1),/decode failed/);failSecond=false;
    const next=await loadSource('svs-5147',1);assert.equal(next.index,1);assert.equal(next.frame.timestamp,'2026-10-29T10:00:00Z');
    assert.ok(decoded.includes('./frames/svs-5147-2.webp'));assert.ok(decoded.includes('./frames/svs-5147-2-mercator.webp'));
    await assert.rejects(loadSource('svs-5147',8),/unavailable/);
  } finally {Object.assign(globalThis,original);}
});
