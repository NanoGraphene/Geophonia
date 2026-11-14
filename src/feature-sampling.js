import { featureProfile, sourcePixel, valueFromPosition } from './data-profiles.js';
import { matchColor } from './sampling.js';
function hue(r,g,b) {
  const max=Math.max(r,g,b),min=Math.min(r,g,b),chroma=max-min;if(!chroma)return 0;
  const h=max===r?((g-b)/chroma)%6:max===g?(b-r)/chroma+2:(r-g)/chroma+4;
  return (h*60+360)%360;
}
export function sampleFeatures(source,location,radius,{variable}={}) {
  if(!Number.isInteger(radius)||radius<0||radius>10)throw new Error('Sampling radius must be 0–10 source pixels.');
  const {manifest}=source,profile=featureProfile(manifest),image=source.imageData;
  const width=image?.width??manifest.width,height=image?.height??manifest.height;
  const center=sourcePixel(manifest,location,width,height);
  const empty={value:null,measurement:null,density:0,intensity:0,validity:'no-visual-sample',matchedPixels:0,totalPixels:0,pixel:center};
  if(!center)return {...empty,validity:'outside-coverage'};
  let total=0,valid=0,matched=0,sum=0,intensity=0;
  const category=profile.categories?.find(c=>c.id===variable)??profile.categories?.[0];
  const wrap=(manifest.geo?.extent?.[2]??180)-(manifest.geo?.extent?.[0]??-180)>=359.999;
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++) {
    const y=center.y+dy;let x=center.x+dx;if(y<0||y>=height||(!wrap&&(x<0||x>=width)))continue;
    x=((x%width)+width)%width;total++;
    if(manifest.masks?.some(([l,t,r,b])=>x>=l&&x<r&&y>=t&&y<b))continue;
    if(profile.method==='grid') {
      const value=source.gridData[y*width+x];if(value==null||!Number.isFinite(value))continue;
      valid++;matched++;sum+=value;continue;
    }
    const i=(y*width+x)*4,[r,g,b,a]=image.data.slice(i,i+4);if(a!==255)continue;
    const brightness=(.2126*r+.7152*g+.0722*b)/255;intensity+=brightness;
    if(profile.method==='brightness') {valid++;sum+=brightness;if(brightness>(profile.threshold??.02))matched++;continue;}
    if(profile.method==='categories') {
      valid++;const chroma=Math.max(r,g,b)-Math.min(r,g,b),h=hue(r,g,b),bounds=category?.hue??[0,360];
      const inside=bounds[0]<=bounds[1]?h>=bounds[0]&&h<=bounds[1]:h>=bounds[0]||h<=bounds[1];
      if(inside&&chroma>=(profile.minChroma??20)&&Math.max(r,g,b)>=(profile.minBrightness??24)){matched++;sum+=chroma/255;}
      continue;
    }
    if(profile.background&&Math.max(r,g,b)-Math.min(r,g,b)<=profile.background.maxChroma&&Math.max(r,g,b)<=profile.background.maxBrightness)continue;
    let position=null;
    if(profile.matching==='chromatic') position=matchColor(r,g,b,a,source.palette);
    else {
      let distance=Infinity;
      source.palette.forEach((color,index)=>{const d=(color[0]-r)**2+(color[1]-g)**2+(color[2]-b)**2;if(d<distance){distance=d;position=index/(source.palette.length-1);}});
      if(distance>(profile.maxDistance??120)**2)position=null;
    }
    if(position!==null){valid++;matched++;sum+=position;}
  }
  if(!valid)return {...empty,totalPixels:total};
  const raw=sum/valid;
  const value=profile.method==='grid'?Math.max(0,Math.min(1,(raw-manifest.valueScale.min)/(manifest.valueScale.max-manifest.valueScale.min))):raw;
  return {value,measurement:profile.method==='grid'?raw:valueFromPosition(raw,manifest.valueScale),density:total?matched/total:0,intensity:total?intensity/total:0,validity:'valid',matchedPixels:matched,totalPixels:total,pixel:center};
}
