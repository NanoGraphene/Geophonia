// Expanded mode stretches the entire rendered world independently on both axes.
// No camera crop or letterbox: normalized geography still spans the full rectangle.
export function fitMap(width, height) {
 return {width:Math.max(0,width),height:Math.max(0,height),left:0,top:0};
}
export function mapViewport(){return {top:0,bottom:1,span:1};}
export function toView(point, viewport){return {x:point.x,y:(point.y-viewport.top)/viewport.span};}
export function fromView(point, viewport){return {x:point.x,y:viewport.top+point.y*viewport.span};}
