import test from 'node:test';
import assert from 'node:assert/strict';
import {fitMap,mapViewport,toView,fromView} from '../src/map-view.js';
import {geoToMercator,mercatorToGeo} from '../src/coordinates.js';
test('expanded landscape retains the complete world extent',()=>{
 const v=mapViewport(1600,600,true,.5);assert.equal(v.span,1);assert.equal(v.top,0);assert.equal(v.bottom,1);
 assert.equal(fromView({x:0,y:0},v).y,v.top);assert.equal(fromView({x:1,y:1},v).y,v.bottom);
 const point=toView(fromView({x:.3,y:.7},v),v);assert.ok(Math.abs(point.x-.3)<1e-12&&Math.abs(point.y-.7)<1e-12);
});
test('geographic cursor stays fixed through expansion, resize and restoration',()=>{
 const location={lon:15,lat:23},p=geoToMercator(location.lon,location.lat);
 for(const [w,h,expanded] of [[600,600,false],[1600,600,true],[320,700,true],[600,600,false]]){
  const v=mapViewport(w,h,expanded,p.y),point=fromView(toView(p,v),v),result=mercatorToGeo(point.x,point.y);
  assert.ok(Math.abs(result.lat-location.lat)<1e-9);assert.ok(Math.abs(result.lon-location.lon)<1e-9);
 }
});
test('polar expanded views clamp to world extent; portrait shows full world latitude',()=>{
 const v=mapViewport(1600,500,true,0);assert.equal(v.top,0);assert.ok(v.bottom<=1);
 assert.equal(mapViewport(320,700,true,.8).span,1);
});

test('collapsed transient viewport dimensions do not produce division by zero',()=>{
 const v=mapViewport(800,0,true,.5);assert.ok(v.span>0);assert.ok(Number.isFinite(toView({x:.5,y:.5},v).y));
});

test('fullscreen map fits entirely inside landscape, portrait and compact stages',()=>{
 for(const [width,height] of [[1920,720],[1600,600],[320,500],[280,180],[800,0]]){
  const fit=fitMap(width,height);assert.equal(fit.width,fit.height);
  assert.ok(fit.left>=0&&fit.top>=0);assert.ok(fit.left+fit.width<=width);assert.ok(fit.top+fit.height<=height);
  const viewport=mapViewport(width,height,true,.9);
  for(const point of [{x:0,y:0},{x:1,y:1},{x:.5,y:.5}])assert.deepEqual(toView(point,viewport),point);
 }
});
