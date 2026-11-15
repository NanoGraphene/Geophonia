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
  return Number.isFinite(min) && Number.isFinite(max) && min >= 80 && max <= 2000 && min < max;
}
export const FILTER_MIN_HZ = 200;
export const FILTER_MAX_HZ = 14000;
export const COVERAGE_GAIN_FLOOR = .35;
export function validateToneFrequency(value) {
  return Number.isFinite(value) && value >= 40 && value <= 2000;
}
export function mapAudio(sample, preferences) {
  const toneHz = Number(preferences.toneHz ?? preferences.minHz);
  if (!sample || sample.validity !== 'valid' || sample.value === null || !validateToneFrequency(toneHz)) return { frequency: null, gain: 0 };
  const mapping=preferences.mapping;
  let normalized=clamp(sample.value,0,1);
  if(mapping) {
    const {min,max,curve}=mapping,raw=sample.measurement;
    if(!Number.isFinite(min)||!Number.isFinite(max)||min>=max||!Number.isFinite(raw)||(curve==='log'&&min<=0))return {frequency:null,gain:0};
    const clipped=clamp(raw,min,max);
    normalized=curve==='log'?Math.log(clipped/min)/Math.log(max/min):(clipped-min)/(max-min);
    if(curve==='sqrt')normalized=Math.sqrt(normalized);
  }
  const frequency = toneHz;
  const cutoff = Math.exp(Math.log(FILTER_MIN_HZ) + (Math.log(FILTER_MAX_HZ) - Math.log(FILTER_MIN_HZ)) * normalized);
  const rawAmplitude=mapping?.amplitude==='value'?normalized:mapping?.amplitude==='intensity'?sample.intensity:sample.density;
  const amplitude = mapping?.amplitude === 'coverage' || !mapping?.amplitude
    ? COVERAGE_GAIN_FLOOR + (1 - COVERAGE_GAIN_FLOOR) * Math.sqrt(clamp(rawAmplitude ?? 0, 0, 1))
    : clamp(rawAmplitude ?? 0, 0, 1);
  const gain = .12 * clamp(preferences.volume, 0, 1) * amplitude;
  return { frequency, cutoff, gain };
}
