import test from 'node:test';
import assert from 'node:assert/strict';
import {canUseBrowserFullscreen,enterBrowserFullscreen} from '../src/fullscreen.js';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
test('embedded fullscreen denial keeps the expanded-view fallback available',async()=>{
 let called=false;const element={requestFullscreen:async()=>{called=true;}};
 const result=await enterBrowserFullscreen({fullscreenEnabled:false},element);
 assert.equal(called,false);assert.equal(result.entered,false);assert.match(result.message,/expanded map/i);
});
test('browser rejection yields actionable visible fallback text rather than success',async()=>{
 const result=await enterBrowserFullscreen({fullscreenEnabled:true},{requestFullscreen:async()=>{throw new Error('blocked');}});
 assert.equal(result.entered,false);assert.match(result.message,/blocked/);assert.match(result.message,/standalone/);
});
test('fullscreen success requires actual browser fullscreen state',async()=>{
 const doc={fullscreenEnabled:true,fullscreenElement:null};const element={requestFullscreen:async()=>{doc.fullscreenElement=element;}};
 assert.equal(canUseBrowserFullscreen(doc,element),true);assert.equal((await enterBrowserFullscreen(doc,element)).entered,true);
 doc.fullscreenElement=null;element.requestFullscreen=async()=>{};
 assert.equal((await enterBrowserFullscreen(doc,element)).entered,false);
 assert.equal(canUseBrowserFullscreen(doc,{}),false);
});
test('temperature asset is the verified full-resolution sequence PNG, not a thumbnail',async()=>{
 const metadata=JSON.parse(await readFile(new URL('../public/data/temperature-provenance.json',import.meta.url)));
 const png=await readFile(new URL('../public/frames/temperature-20261029.png',import.meta.url));
 assert.equal(png.readUInt32BE(16),2048);assert.equal(png.readUInt32BE(20),1024);
 assert.match(metadata.sourceURL,/\/frames\/.+\/00000001\.png$/);assert.doesNotMatch(metadata.sourceURL,/_thm|_print|_searchweb/);
 assert.equal(createHash('sha256').update(png).digest('hex'),metadata.localPngSha256);
 assert.equal(metadata.localDecodedPixelsMatchOriginal,true);
});
