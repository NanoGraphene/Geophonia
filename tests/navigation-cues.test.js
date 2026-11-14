import test from 'node:test';
import assert from 'node:assert/strict';
import { boundaryZone, BoundaryTracker, clipExitPoint, boundaryPattern, BOUNDARY_NAMES } from '../src/navigation-cues.js';
const size={width:1000,height:1000};
const points={left:{x:.005,y:.5},right:{x:.995,y:.5},top:{x:.5,y:.005},bottom:{x:.5,y:.995},'top-left':{x:.005,y:.005},'top-right':{x:.995,y:.005},'bottom-left':{x:.005,y:.995},'bottom-right':{x:.995,y:.995}};
test('all four edges and four corners are recognized; corners have priority',()=>{
 for(const zone of BOUNDARY_NAMES)assert.equal(boundaryZone(points[zone],size),zone);
 assert.equal(boundaryZone({x:.5,y:.5},size),null);
 assert.equal(boundaryZone({x:1.1,y:.5},size),null);
 assert.equal(boundaryZone(points.left,{width:0,height:0}),null);
});
test('boundary zones use actual CSS pixels after resizing',()=>{
 for(const width of [320,640,1500]){
  assert.equal(boundaryZone({x:10/width,y:.5},{width,height:width}),'left');
  assert.equal(boundaryZone({x:20/width,y:.5},{width,height:width}),null);
 }
});
test('edge cues do not repeat while stationary or jittering and re-arm beyond release zone',()=>{
 const tracker=new BoundaryTracker();assert.equal(tracker.update(points.left,size),'left');
 assert.equal(tracker.update(points.left,size),null);
 for(const x of [.011,.014,.017,.01])assert.equal(tracker.update({x,y:.5},size),null);
 assert.equal(tracker.update({x:.02,y:.5},size),null);
 assert.equal(tracker.update(points.left,size),'left');
 tracker.reset();assert.equal(tracker.update(points.left,size),'left');
});
test('entering a corner upgrades an edge cue without corner/edge chatter',()=>{
 const tracker=new BoundaryTracker();assert.equal(tracker.update(points.left,size),'left');
 assert.equal(tracker.update(points['top-left'],size),'top-left');
 assert.equal(tracker.update({x:.005,y:.014},size),null);
 assert.equal(tracker.update(points['top-left'],size),null);
 assert.equal(tracker.update({x:.005,y:.03},size),null);
 assert.equal(tracker.update(points['top-left'],size),'top-left');
});
test('pointer exit clips a fast movement to the visible edge or exact corner',()=>{
 const from={x:.5,y:.5};
 assert.deepEqual(clipExitPoint(from,{x:1.5,y:.5}),{x:1,y:.5});
 assert.deepEqual(clipExitPoint(from,{x:-.5,y:-.5}),{x:0,y:0});
 assert.equal(boundaryZone(clipExitPoint(from,{x:2,y:2}),size),'bottom-right');
 const tracker=new BoundaryTracker();assert.equal(tracker.update(clipExitPoint(from,{x:-1,y:.5}),size),'left');
 assert.equal(tracker.update({x:0,y:.5},size),null);
});
test('all boundary patterns are distinct in mono and corners concatenate vertical then horizontal',()=>{
 const signatures=BOUNDARY_NAMES.map(z=>JSON.stringify(boundaryPattern(z)));
 assert.equal(new Set(signatures).size,8);
 assert.equal(boundaryPattern('left').length,1);assert.equal(boundaryPattern('right').length,3);
 const corner=boundaryPattern('top-right');assert.deepEqual(corner.slice(0,2),boundaryPattern('top'));
 assert.ok(corner.slice(2).every(n=>n.delay>=.42));
 assert.deepEqual(boundaryPattern('unknown'),[]);
});
