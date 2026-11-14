import {sourcePixel} from './data-profiles.js';
// A perceptually ordered blue→yellow ramp, independent of the measured unit.
export function gridColor(value) {
  const x=Math.max(0,Math.min(1,value));
  return [Math.round(30+220*x),Math.round(60+175*x),Math.round(110-70*x),255];
}
export function gridPixels(manifest,values,size=1024) {
  const pixels=new Uint8ClampedArray(size*size*4),scale=manifest.valueScale;
  for(let y=0;y<size;y++) {
    const lat=Math.atan(Math.sinh(Math.PI*(1-2*(y+.5)/size)))*180/Math.PI;
    for(let x=0;x<size;x++) {
      const point=sourcePixel(manifest,{lon:360*(x+.5)/size-180,lat}),index=(y*size+x)*4;
      const value=point?values[point.y*manifest.width+point.x]:null;
      const color=value==null||!Number.isFinite(value)?[10,22,24,0]:gridColor((value-scale.min)/(scale.max-scale.min));
      pixels.set(color,index);
    }
  }
  return pixels;
}
export function gridDisplay(manifest,values) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
  const context=canvas.getContext('2d');context.putImageData(new ImageData(gridPixels(manifest,values),1024,1024),0,0);
  return canvas.toDataURL('image/png');
}
