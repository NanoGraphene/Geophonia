import { clamp } from './coordinates.js';
export function mapViewport(width, height, expanded, centerY = .5) {
 const span=expanded&&width>0?Math.max(1/Math.max(width,1),Math.min(1,height/width)):1;
 const top=clamp(centerY-span/2,0,1-span);
 return {top,bottom:top+span,span};
}
export function toView(point, viewport){return {x:point.x,y:(point.y-viewport.top)/viewport.span};}
export function fromView(point, viewport){return {x:point.x,y:viewport.top+point.y*viewport.span};}
