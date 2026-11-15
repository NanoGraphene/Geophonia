import { clamp } from './coordinates.js';
export function mapSpatialPosition(position) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return null;
  const horizontal = clamp(position.x, 0, 1) * 2 - 1;
  const vertical = 1 - clamp(position.y, 0, 1) * 2;
  return { x: horizontal * 2.5, y: vertical * 1.5, z: -1.5 + vertical * .5 };
}
export function mapBoundaryPosition(zone) {
  if (!zone) return null;
  return mapSpatialPosition({
    x: zone.includes('left') ? 0 : zone.includes('right') ? 1 : .5,
    y: zone.includes('top') ? 0 : zone.includes('bottom') ? 1 : .5
  });
}
export function validatePitchRange(min, max) {
  return Number.isFinite(min) && Number.isFinite(max) && min >= 100 && max <= 2000 && min < max;
}
export const DEFAULT_MIN_HZ = 200;
export const DEFAULT_MAX_HZ = 2000;
export const MIN_BEAT_HZ = .8;
export const MAX_BEAT_HZ = 12;
export function mapAudio(sample, preferences) {
  const minHz=preferences.minHz??DEFAULT_MIN_HZ,maxHz=preferences.maxHz??DEFAULT_MAX_HZ;
  if (!sample || sample.validity !== 'valid' || !Number.isFinite(sample.value) || !validatePitchRange(minHz,maxHz)) return { frequency: null, gain: 0 };
  const mapping=preferences.mapping;
  let normalized=clamp(sample.value,0,1);
  if(mapping) {
    const {min,max,curve}=mapping,raw=sample.measurement;
    if(!Number.isFinite(min)||!Number.isFinite(max)||min>=max||!Number.isFinite(raw)||(curve==='log'&&min<=0))return {frequency:null,gain:0};
    const clipped=clamp(raw,min,max);
    normalized=curve==='log'?Math.log(clipped/min)/Math.log(max/min):(clipped-min)/(max-min);
    if(curve==='sqrt')normalized=Math.sqrt(normalized);
  }
  // Equal value increments give equal pitch intervals, without quantizing notes.
  // This works for negative temperatures and zero too: only frequency is logged.
  const frequency = minHz * Math.pow(maxHz / minHz, normalized);
  const beatHz=MIN_BEAT_HZ+(MAX_BEAT_HZ-MIN_BEAT_HZ)*normalized;
  // Density alone sets the level; value changes pitch and beating, not gain.
  const amplitude = Math.sqrt(clamp(sample.density ?? 0,0,1));
  const gain = .12 * clamp(preferences.volume, 0, 1) * amplitude;
  return { frequency, beatHz, gain };
}
