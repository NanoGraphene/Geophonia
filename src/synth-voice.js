import { clamp } from './coordinates.js';

// Native additive synthesis keeps the fundamental tied to data, with quiet overtones.
export const PAD_PARTIALS = [0, 1, .32, .18, .10, .05];
export const MALLET_PARTIALS = [0, 1, .22, .38, .08, .12];
export function filterSettings(surface, fundamental, contrast = .65) {
  const strength = clamp(contrast, 0, 1);
  const ratio = surface === 'water' ? 3 - 1.5 * strength : surface === 'land' ? 3 + 4 * strength : 3;
  return { cutoff: clamp(fundamental * ratio, 100, 10000), resonance: .55 };
}
export function createSynthVoice(context, target, frequency, { profile = 'pad' } = {}) {
  const oscillator = context.createOscillator(), filter = context.createBiquadFilter();
  const partials = profile === 'mallet' ? MALLET_PARTIALS : PAD_PARTIALS;
  oscillator.setPeriodicWave(context.createPeriodicWave(new Float32Array(partials.length), Float32Array.from(partials)));
  oscillator.frequency.value = frequency;
  filter.type = 'lowpass'; filter.frequency.value = filterSettings('unknown', frequency).cutoff; filter.Q.value = .55;
  oscillator.connect(filter); filter.connect(target);
  return { oscillator, filter, disconnect() { oscillator.disconnect(); filter.disconnect(); } };
}
