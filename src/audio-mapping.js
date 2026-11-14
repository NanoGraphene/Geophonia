import { clamp } from './coordinates.js';
export function validatePitchRange(min, max) {
  return Number.isFinite(min) && Number.isFinite(max) && min >= 80 && max <= 2000 && min < max;
}
export function mapAudio(sample, preferences) {
  if (!sample || sample.validity !== 'valid' || sample.value === null || !validatePitchRange(preferences.minHz, preferences.maxHz)) return { frequency: null, gain: 0 };
  const normalized = clamp(sample.value, 0, 1);
  // Exponential frequency gives uniform perceptual steps along the palette.
  const frequency = preferences.minHz * (preferences.maxHz / preferences.minHz) ** normalized;
  const gain = .12 * clamp(preferences.volume, 0, 1) * clamp(sample.density, 0, 1);
  return { frequency, gain };
}
