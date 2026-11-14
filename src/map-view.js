// Both datasets render into square, full-world Web Mercator images.
// Fit that entire image in the stage; unused space is outside the interactive map.
export function fitMap(width, height) {
 const size=Math.max(0,Math.min(width,height));
 return {width:size,height:size,left:(width-size)/2,top:(height-size)/2};
}
export function mapViewport(){return {top:0,bottom:1,span:1};}
export function toView(point, viewport){return {x:point.x,y:(point.y-viewport.top)/viewport.span};}
export function fromView(point, viewport){return {x:point.x,y:viewport.top+point.y*viewport.span};}
