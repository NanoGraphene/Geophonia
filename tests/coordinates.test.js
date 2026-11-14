import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LAT, geoToMercator, mercatorToGeo, geoToSource, pointerToGeo, moveLocation } from '../src/coordinates.js';
import { createStore, initialState } from '../src/state.js';
test('Mercator known positions and geographic round trips', () => {
  assert.deepEqual(geoToMercator(0, 0), { x: .5, y: .5 });
  for (const [lon, lat] of [[-180,0],[180,0],[-45,30],[135,-25],[-42,72],[0,MAX_LAT],[0,-MAX_LAT]]) {
    const p = geoToMercator(lon,lat); const q = mercatorToGeo(p.x,p.y);
    assert.ok(Math.abs(q.lon-lon)<1e-9); assert.ok(Math.abs(q.lat-lat)<1e-9);
  }
});
test('source rectangle uses full equirectangular image and clamps endpoints', () => {
  assert.deepEqual(geoToSource(0,0,2048,1024),{x:1024,y:512});
  assert.deepEqual(geoToSource(-180,90,2048,1024),{x:0,y:0});
  assert.deepEqual(geoToSource(180,-90,2048,1024),{x:2047,y:1023});
  assert.deepEqual(geoToSource(-45,30,2048,1024),{x:768,y:341});
});
test('pointer conversion respects offset, resizing, outside and zero-size maps', () => {
  for (const size of [320,640,1500]) {
    const p=pointerToGeo(23+size/2,80+size/2,{left:23,top:80,width:size,height:size});
    assert.deepEqual(p,{lon:0,lat:0});
  }
  assert.equal(pointerToGeo(0,0,{left:1,top:1,width:320,height:320}),null);
  assert.equal(pointerToGeo(0,0,{left:0,top:0,width:0,height:0}),null);
});
test('geographic key movements wrap longitude and stop at latitude limit', () => {
  assert.deepEqual(moveLocation({lon:179,lat:0},'ArrowRight',5),{lon:-176,lat:0});
  assert.deepEqual(moveLocation({lon:-179,lat:0},'ArrowLeft',5),{lon:176,lat:0});
  assert.equal(moveLocation({lon:0,lat:85},'ArrowUp',5).lat,MAX_LAT);
  assert.equal(moveLocation({lon:0,lat:-85},'ArrowDown',5).lat,-MAX_LAT);
});
test('shared location update preserves selected timestamp and preferences', () => {
  const store=createStore(); let notified=0;store.subscribe(()=>notified++);
  store.update({location:{lon:10,lat:20}});
  assert.equal(store.get().timestamp,initialState().timestamp);
  assert.equal(store.get().audio.volume,.25);assert.equal(notified,1);
});
