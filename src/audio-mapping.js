import { clamp } from './coordinates.js';
export function mapSpatialPosition(position) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return null;
  const horizontal = clamp(position.x, 0, 1) * 2 - 1;
  const vertical = 1 - clamp(position.y, 0, 1) * 2;
  return { x: horizontal * 2.5, y: vertical * 1.5, z: -1.5 + vertical * .5 };
}
export function validatePitchRange(min, max) {
  return Number.isFinite(min) && Number.isFinite(max) && min >= 80 && max <= 2000 && min < max;
}
export function mapAudio(sample, preferences) {
  if (!sample || sample.validity !== 'valid' || sample.value === null || !validatePitchRange(preferences.minHz, preferences.maxHz)) return { frequency: null, gain: 0 };
  const mapping=preferences.mapping;
  let normalized=clamp(sample.value,0,1);
  if(mapping) {
    const {min,max,curve}=mapping,raw=sample.measurement;
    if(!Number.isFinite(min)||!Number.isFinite(max)||min>=max||!Number.isFinite(raw)||(curve==='log'&&min<=0))return {frequency:null,gain:0};
    const clipped=clamp(raw,min,max);
    normalized=curve==='log'?Math.log(clipped/min)/Math.log(max/min):(clipped-min)/(max-min);
    if(curve==='sqrt')normalized=Math.sqrt(normalized);
  }
  // Exponential frequency gives uniform perceptual steps along the palette.
  const frequency = preferences.minHz * (preferences.maxHz / preferences.minHz) ** normalized;
  const amplitude=mapping?.amplitude==='value'?normalized:mapping?.amplitude==='intensity'?sample.intensity:sample.density;
  const gain = .12 * clamp(preferences.volume, 0, 1) * clamp(amplitude??0, 0, 1);
  return { frequency, gain };
}
