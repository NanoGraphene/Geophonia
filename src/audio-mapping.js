import { clamp } from './coordinates.js';
import { DEFAULT_SOUND_PRESET, SOUND_PRESETS } from './sound-presets.js';
export function validatePitchRange(min, max) {
  return Number.isFinite(min) && Number.isFinite(max) && min >= 80 && max <= 2000 && min < max;
}
export function mapAudio(sample, preferences, presetName = DEFAULT_SOUND_PRESET) {
  const preset = SOUND_PRESETS[presetName] ?? SOUND_PRESETS[DEFAULT_SOUND_PRESET];
  if (!sample || sample.validity !== 'valid' || sample.value === null) return { frequency: null, gain: 0 };
  const normalized = clamp(sample.value, 0, 1);
  const filter = preset.filter;
  const cutoff = filter.cutoffMin + (filter.cutoffMax - filter.cutoffMin) * normalized;
  const resonance = filter.resonanceMin + (filter.resonanceMax - filter.resonanceMin) * normalized;
  const gain = preset.gain * clamp(preferences.volume, 0, 1) * clamp(sample.density, 0, 1);
  return { frequency: preset.rootHz, gain, cutoff, resonance };
}
