import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createSurfaceMask, loadGeography, traceSurfacePath, SurfaceTransitionTracker } from '../src/geography.js';
import { createStore } from '../src/state.js';
const manifest = JSON.parse(await readFile(new URL('../public/geography/manifest.json', import.meta.url)));
const bytes = new Uint8Array(await readFile(new URL('../public/geography/surface-mask.bin', import.meta.url)));
const actual = createSurfaceMask({ ...manifest.mask, bytes });
function fixture(predicate, width = 128, height = 64) {
  const bytes = new Uint8Array(Math.ceil(width * height / 8));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (predicate(x, y)) {
    const i = y * width + x; bytes[i >> 3] |= 1 << (7 - (i & 7));
  }
  return createSurfaceMask({ width, height, bytes });
}
test('geographic mask integrity, independent checkpoints and shoreline alignment', async () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.mask.sha256);
  const report = JSON.parse(await readFile(new URL('../docs/geography-validation.json', import.meta.url)));
  assert.ok(report.agreementAwayFromCoasts > .99);
  for (const point of report.checkpoints) assert.equal(actual.classify(point.location).surface, point.expected, point.name);
  assert.ok(report.coastlineTransects.every(t => t.nearestEdgeErrorSourcePixels <= 1));
});
test('real lakes are water; islands and a mapped lake island retain land', () => {
  for (const p of [{lon:33,lat:-1},{lon:-87,lat:47},{lon:51,lat:42},{lon:-82.2,lat:45.5}]) assert.equal(actual.classify(p).surface,'water',JSON.stringify(p));
  for (const p of [{lon:47,lat:-20},{lon:138,lat:36},{lon:-2,lat:54},{lon:-82.15,lat:45.8}]) assert.equal(actual.classify(p).surface,'land',JSON.stringify(p));
});
test('packed mask preserves a lake hole and an island inside it', () => {
  const mask = fixture((x,y) => (x>=20&&x<100&&y>=8&&y<56) && (!(x>=40&&x<80&&y>=20&&y<44)||(x>=56&&x<64&&y>=28&&y<36)));
  const at=(x,y)=>mask.classify({lon:(x+.5)/128*360-180,lat:90-(y+.5)/64*180});
  assert.equal(at(30,30).surface,'land'); assert.equal(at(45,30).surface,'water');assert.equal(at(60,30).surface,'land');assert.equal(at(5,30).surface,'water');
  assert.equal(mask.classify({lon:NaN,lat:0}).surface,'unknown');
  assert.throws(()=>createSurfaceMask({width:128,height:64,bytes:new Uint8Array(2)}));
});
test('shoreline spatial hysteresis ignores boundary jitter and re-arms after a confident crossing', () => {
  const mask=fixture(x=>x>=64);const tracker=new SurfaceTransitionTracker(mask,{lon:-20,lat:0});
  let previous={lon:-20,lat:0};
  for (const lon of [-.1,.1,-.1,.1,-.1,.1]) {const next={lon,lat:0};assert.deepEqual(tracker.move(previous,next),[]);previous=next;}
  assert.deepEqual(tracker.move(previous,{lon:20,lat:0}),[{from:'water',to:'land'}]);
  assert.deepEqual(tracker.move({lon:20,lat:0},{lon:20,lat:0}),[]);
  assert.deepEqual(tracker.move({lon:20,lat:0},{lon:-20,lat:0}),[{from:'land',to:'water'}]);
});
test('rapid movement detects entry and exit of a narrow mapped island despite matching endpoints', () => {
  const mask=fixture(x=>x>=60&&x<=64);const from={lon:-30,lat:0},to={lon:30,lat:0};
  assert.equal(mask.classify(from).surface,'water');assert.equal(mask.classify(to).surface,'water');
  const tracker=new SurfaceTransitionTracker(mask,from);
  assert.deepEqual(tracker.move(from,to),[{from:'water',to:'land'},{from:'land',to:'water'}]);
  assert.ok(traceSurfacePath(mask,from,to).some(p=>p.surface==='land'&&p.confident));
});
test('real fast Madagascar transect detects both shores', () => {
  const from={lon:40,lat:-20},to={lon:55,lat:-20};
  const tracker=new SurfaceTransitionTracker(actual,from);
  assert.deepEqual(tracker.move(from,to),[{from:'water',to:'land'},{from:'land',to:'water'}]);
});
test('crossing a country border on land preserves surface and produces no shoreline cue', () => {
  const from={lon:2.35,lat:48.85},to={lon:13.4,lat:52.52};
  assert.equal(actual.classify(from).surface,'land');assert.equal(actual.classify(to).surface,'land');
  assert.deepEqual(new SurfaceTransitionTracker(actual,from).move(from,to),[]);
});
test('keyboard antimeridian movement follows the short path, pointer movement follows display path', () => {
  const mask=fixture(x=>x<5||x>=123);const from={lon:177,lat:0},to={lon:-177,lat:0};
  assert.deepEqual(new SurfaceTransitionTracker(mask,from).move(from,to,{wrap:true}),[]);
  assert.deepEqual(new SurfaceTransitionTracker(mask,from).move(from,to,{wrap:false}),[{from:'land',to:'water'},{from:'water',to:'land'}]);
});
test('resets, fixed-location time or preference changes do not manufacture spatial crossings', () => {
  const store=createStore();const tracker=new SurfaceTransitionTracker(actual,store.get().location);
  store.update({timestamp:'2007-03-25T16:07:00Z',timeIndex:1});
  assert.deepEqual(tracker.move(store.get().location,store.get().location),[]);
  assert.equal(actual.classify(store.get().location).surface,'water');
  tracker.reset({lon:15,lat:23});
  assert.deepEqual(tracker.move({lon:15,lat:23},{lon:15,lat:23}),[]);
});

test('geographic loader rejects a failed request without producing a classification',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('not available',{status:503}));
 await assert.rejects(loadGeography(),/metadata could not load/);
});
test('geographic loader rejects corrupted mask bytes',async t=>{
 const fake={mask:{url:'mask.bin',width:8,height:1,sha256:'0'.repeat(64)}};
 t.mock.method(globalThis,'fetch',async url=>url==='mask.bin'?new Response(new Uint8Array([255])):new Response(JSON.stringify(fake)));
 await assert.rejects(loadGeography(),/integrity validation/);
});
